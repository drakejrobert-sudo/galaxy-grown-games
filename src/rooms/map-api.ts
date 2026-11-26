import type { RoomEnvironment } from './api';
import { mapKey, readSharedMap, validSharedCourse, type GuestRoutePlanner, type HostRoutePlanner,
  type ProposalStatus, type RoomMap } from './map-types';
import { roomIdPattern } from './types';

export const roomMapAction = /^\/api\/rooms\/([a-f0-9-]{36})\/(map|proposals(?:\/([a-f0-9-]{36}))?)$/;
type Db = NonNullable<RoomEnvironment['DB']>;
type MapRow = { revision: string; schematic: string; campaignId: string; mapId: string };
type ProposalRow = { id: string; stops: string; status: ProposalStatus; player: string; seatId: string };
type Reply = { error: string; status: number } | { data: unknown };

function asMap(row: MapRow): RoomMap {
  return { ...JSON.parse(row.schematic), revision: row.revision };
}

export async function routePlanners(db: Db, roomId: string, seatId: string): Promise<GuestRoutePlanner | undefined>;
export async function routePlanners(db: Db, roomId: string): Promise<HostRoutePlanner | undefined>;
export async function routePlanners(db: Db, roomId: string, seatId?: string) {
  const { results } = await db.prepare(`
    SELECT m.revision, m.schematic, m.campaign_id AS campaignId, m.map_id AS mapId,
      p.id, p.stops, p.status, p.seat_id AS seatId, s.name AS player
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
  const row = await db.prepare(`
    INSERT INTO room_maps (room_id, revision, campaign_id, map_id, schematic)
    SELECT r.id, ?, ?, ?, ? FROM rooms r WHERE r.id = ? AND r.owner_id = ? AND ${activeRoom}
    ON CONFLICT (room_id) DO UPDATE SET
      revision = excluded.revision, campaign_id = excluded.campaign_id,
      map_id = excluded.map_id, schematic = excluded.schematic
    WHERE room_maps.campaign_id <> excluded.campaign_id OR room_maps.map_id <> excluded.map_id
      OR room_maps.schematic <> excluded.schematic
    RETURNING revision
  `).bind(crypto.randomUUID(), campaignId, mapId, JSON.stringify(schematic), roomId, owner, now).first();
  if (!row && !await db.prepare(`
    SELECT id FROM rooms r WHERE r.id = ? AND r.owner_id = ? AND ${activeRoom}
  `).bind(roomId, owner, now).first()) return { error: 'Active room not found.', status: 404 };
  return { data: null };
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
