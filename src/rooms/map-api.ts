import { backgroundImageBytes } from '../galaxy/background';
import type { RoomEnvironment } from './api';
import { mapKey, readSharedMap, roomArtworkRevision, validSharedCourse, type GuestRoutePlanner, type HostRoutePlanner,
  type ProposalStatus, type RoomMap, type SharedMap, type StopType } from './map-types';
import { roomIdPattern } from './types';

export const roomMapAction = /^\/api\/rooms\/([a-f0-9-]{36})\/(map(?:\/artwork)?|proposals(?:\/([a-f0-9-]{36}))?)$/;
type Db = NonNullable<RoomEnvironment['DB']>;
type MapRow = { revision: string; schematic: string; campaignId: string; mapId: string;
  stopTypes?: string | null; artworkRevision?: string | null };
type ProposalRow = { id: string; stops: string; status: ProposalStatus; player: string; seatId: string };
type Reply = { error: string; status: number } | { data: unknown };

function asMap(row: MapRow): RoomMap {
  const map = JSON.parse(row.schematic) as SharedMap;
  if (row.stopTypes) {
    const types = new Map<string, StopType>(JSON.parse(row.stopTypes));
    for (const stop of map.stops) if (types.has(stop.id)) stop.type = types.get(stop.id);
  }
  return { ...map, revision: row.revision, ...(row.artworkRevision ? { artworkRevision: row.artworkRevision } : {}) };
}

export async function routePlanners(db: Db, roomId: string, seatId: string): Promise<GuestRoutePlanner | undefined>;
export async function routePlanners(db: Db, roomId: string): Promise<HostRoutePlanner | undefined>;
export async function routePlanners(db: Db, roomId: string, seatId?: string) {
  const { results } = await db.prepare(`
    SELECT m.revision, m.schematic, m.campaign_id AS campaignId, m.map_id AS mapId,
      m.stop_types AS stopTypes, m.artwork_revision AS artworkRevision, p.id, p.stops, p.status, p.seat_id AS seatId, s.name AS player
    FROM room_maps m
    LEFT JOIN room_route_proposals p ON p.room_id = m.room_id AND p.revision = m.revision
      AND (? IS NULL OR p.seat_id = ?)
    LEFT JOIN room_members s ON s.id = p.seat_id
    WHERE m.room_id = ? ORDER BY p.submitted_at, p.id
  `).bind(seatId ?? null, seatId ?? null, roomId).all<MapRow & ProposalRow>();
  const row = results[0];
  if (!row) return;
  const proposals = results.filter(row => row.id).map(({ id, stops, status, player, seatId: proposer }) =>
    ({ id, stops: JSON.parse(stops) as string[], status, ...(seatId ? {} : { player, seatId: proposer }) }));
  const map = asMap(row);
  return seatId ? { map, proposals } : { map, proposals, source: { campaignId: row.campaignId, mapId: row.mapId } };
}

const activeRoom = 'r.closed_at IS NULL AND r.expires_at > ?';
const stale = { error: 'The shared map changed. Refresh Rooms and try again.', status: 409 };

export async function changeRoomMap(db: Db, roomId: string, owner: string, now: number,
  fields: Record<string, unknown> | null): Promise<Reply> {
  const campaignId = fields?.campaignId;
  const mapId = fields?.mapId;
  const schematic = readSharedMap(fields?.map);
  if (!mapKey(campaignId) || !mapKey(mapId) || !schematic) {
    return { error: 'Choose a starting stop and connected stops to share.', status: 400 };
  }
  const artwork = fields?.artwork ?? null;
  if (artwork !== null && (typeof artwork !== 'string' || backgroundImageBytes(artwork) === null)) {
    return { error: 'Choose a valid map background under 750 KB.', status: 400 };
  }
  const artworkRevision = artwork ? await roomArtworkRevision(artwork) : null;
  const types = schematic.stops.flatMap(stop => stop.type ? [[stop.id, stop.type]] : []);
  const graph = { ...schematic, stops: schematic.stops.map(({ id, name, x, y }) => ({ id, name, x, y })) };
  const sameCourse = `room_maps.campaign_id = excluded.campaign_id AND room_maps.map_id = excluded.map_id
    AND room_maps.schematic = excluded.schematic`;
  const row = await db.prepare(`
    INSERT INTO room_maps (room_id, revision, campaign_id, map_id, schematic, stop_types, artwork, artwork_revision)
    SELECT r.id, ?, ?, ?, ?, ?, ?, ? FROM rooms r WHERE r.id = ? AND r.owner_id = ? AND ${activeRoom}
    ON CONFLICT (room_id) DO UPDATE SET
      revision = CASE WHEN ${sameCourse} THEN room_maps.revision ELSE excluded.revision END,
      campaign_id = excluded.campaign_id, map_id = excluded.map_id,
      schematic = excluded.schematic, stop_types = excluded.stop_types, artwork = excluded.artwork,
      artwork_revision = excluded.artwork_revision
    RETURNING revision
  `).bind(crypto.randomUUID(), campaignId, mapId, JSON.stringify(graph), types.length ? JSON.stringify(types) : null,
    artwork, artworkRevision, roomId, owner, now).first();
  if (!row && !await db.prepare(`
    SELECT id FROM rooms r WHERE r.id = ? AND r.owner_id = ? AND ${activeRoom}
  `).bind(roomId, owner, now).first()) return { error: 'Active room not found.', status: 404 };
  return { data: null };
}

export async function roomMapArtwork(db: Db, roomId: string, revision: string, now: number,
  owner: string | null, account: string | null, guest: string | null): Promise<Response | null> {
  if (!/^[a-f0-9]{64}$/.test(revision)) return null;
  const row = await db.prepare(`
    SELECT m.artwork FROM room_maps m JOIN rooms r ON r.id = m.room_id
    WHERE r.id = ? AND m.artwork_revision = ? AND ${activeRoom}
      AND (r.owner_id = ? OR EXISTS (
        SELECT 1 FROM room_members s WHERE s.room_id = r.id AND s.user_id IN (?, ?)
      ))
  `).bind(roomId, revision, now, owner, account, guest).first<{ artwork: string }>();
  if (!row?.artwork) return null;
  const separator = row.artwork.indexOf(';base64,');
  const mime = row.artwork.slice(5, separator);
  const bytes = Uint8Array.from(atob(row.artwork.slice(separator + 8)), value => value.charCodeAt(0));
  return new Response(bytes, { headers: {
    'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}

export async function submitRouteProposal(db: Db, roomId: string, account: string | null, guest: string | null,
  now: number, fields: Record<string, unknown> | null): Promise<Reply> {
  const { id, revision, stops } = fields ?? {};
  if (typeof id !== 'string' || !roomIdPattern.test(id) || typeof revision !== 'string'
    || !roomIdPattern.test(revision) || !Array.isArray(stops) || !stops.every(mapKey)) {
    return { error: 'Choose a connected course on the shared map.', status: 400 };
  }
  const current = await db.prepare(`
    SELECT m.revision, m.schematic, s.id AS seatId FROM rooms r
    JOIN room_members s ON s.room_id = r.id LEFT JOIN room_maps m ON m.room_id = r.id
    WHERE r.id = ? AND ${activeRoom} AND s.user_id IN (?, ?)
    ORDER BY (s.user_id = ?) DESC LIMIT 1
  `).bind(roomId, now, account, guest, account).first<MapRow & { seatId: string }>();
  if (!current) return { error: 'Your seat or active room could not be found.', status: 404 };
  if (revision !== current.revision) return stale;
  if (!validSharedCourse(asMap(current), stops)) return { error: 'Choose a connected course on the shared map.', status: 400 };
  const course = JSON.stringify(stops);
  const saved = await db.prepare(`
    INSERT INTO room_route_proposals (room_id, seat_id, id, revision, stops, submitted_at)
    SELECT r.id, ?, ?, ?, ?, ? FROM rooms r JOIN room_maps m ON m.room_id = r.id
    WHERE r.id = ? AND m.revision = ? AND ${activeRoom}
      AND (SELECT COUNT(*) FROM room_route_proposals WHERE room_id = r.id AND seat_id = ?) < 8
    ON CONFLICT DO NOTHING RETURNING id
  `).bind(current.seatId, id, revision, course, now, roomId, revision, now, current.seatId).first();
  if (saved) return { data: saved };
  const retry = await db.prepare(`
    SELECT p.id, p.stops FROM room_route_proposals p JOIN rooms r ON p.room_id = r.id
    WHERE r.id = ? AND p.seat_id = ? AND p.revision = ? AND ${activeRoom}
      AND (p.id = ? OR p.stops = ?) ORDER BY (p.id = ?) DESC LIMIT 1
  `).bind(roomId, current.seatId, revision, now, id, course, id).first<{ id: string; stops: string }>();
  if (retry && retry.stops === course) return { data: { id: retry.id } };
  if (retry) return { error: 'This submission already belongs to another course.', status: 409 };
  const stillCurrent = await db.prepare(`
    SELECT revision FROM room_maps m JOIN rooms r ON r.id = m.room_id
    WHERE r.id = ? AND m.revision = ? AND ${activeRoom}
  `).bind(roomId, revision, now).first();
  return stillCurrent ? { error: 'You have reached the proposal limit for this map.', status: 409 } : stale;
}

export async function decideRouteProposal(db: Db, roomId: string, owner: string, id: string, now: number,
  fields: Record<string, unknown> | null): Promise<Reply> {
  const { revision, status, seatId } = fields ?? {};
  if (typeof revision !== 'string' || !roomIdPattern.test(revision)
    || typeof seatId !== 'string' || !roomIdPattern.test(seatId)
    || (status !== 'accepted' && status !== 'declined')) {
    return { error: 'Choose a proposal decision.', status: 400 };
  }
  const saved = await db.prepare(`
    UPDATE room_route_proposals SET status = ?
    WHERE room_id = ? AND seat_id = ? AND id = ? AND revision = ? AND status IN ('pending', ?)
      AND EXISTS (SELECT 1 FROM rooms r JOIN room_maps m ON r.id = m.room_id
        WHERE r.id = ? AND r.owner_id = ? AND m.revision = ? AND ${activeRoom})
    RETURNING id
  `).bind(status, roomId, seatId, id, revision, status, roomId, owner, revision, now).first();
  return saved ? { data: null } : { error: 'This proposal is no longer available for that decision.', status: 409 };
}
