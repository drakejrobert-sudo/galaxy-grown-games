import { stations, type HostedRoom, type JoinedRoom, type RoomList, type Seat } from './types';

interface DatabaseStatement {
  bind(...values: (string | number | null)[]): DatabaseStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

export interface RoomEnvironment {
  DB?: { prepare(query: string): DatabaseStatement };
  ROOM_DM_EMAIL?: string;
}

const roomLifetime = 12 * 60 * 60 * 1000;
const joinWindow = 10 * 60 * 1000;
const joinLimit = 10;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codePattern = /^[A-HJ-NP-Z2-9]{8}$/;
const roomAction = /^\/api\/rooms\/([a-f0-9-]{36})\/(close|seats\/([a-f0-9-]{36}))$/;
const unavailable = 'This room code is invalid, expired, or closed.';
const noStore = { 'Cache-Control': 'private, no-store' };

function randomCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => alphabet[byte % alphabet.length]).join('');
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: noStore });
}

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function readForm(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const buffer = new Uint8Array(1024);
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > buffer.length) {
        await reader.cancel();
        return null;
      }
      buffer.set(value, length);
      length += value.length;
    }
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)));
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

// Identity comes from the hosted Sites gateway. The test server injects fictional identities.
export async function roomApi(
  request: Request,
  env: RoomEnvironment,
  now = Date.now(),
  generateCode = randomCode,
): Promise<Response> {
  const url = new URL(request.url);
  const userId = request.headers.get('oai-authenticated-user-id')?.trim();
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!userId || !email) return error('Sign in with ChatGPT to open Rooms.', 401);

  const db = env.DB;
  if (!db) return error('Rooms are temporarily unavailable.', 503);
  const canHost = email === env.ROOM_DM_EMAIL?.trim().toLowerCase();
  const method = request.method;
  if (method !== 'GET' && request.headers.get('Origin') !== url.origin) {
    return error('Open Rooms from this Site to make changes.', 403);
  }

  try {
    if (url.pathname === '/api/rooms' && method === 'GET') {
      const [joinedRows, hostedRows] = await Promise.all([
        db.prepare(`
          SELECT r.id AS roomId, r.expires_at AS expiresAt, m.id, m.name, m.station
          FROM room_members m JOIN rooms r ON r.id = m.room_id
          WHERE m.user_id = ? AND r.closed_at IS NULL AND r.expires_at > ?
          ORDER BY r.expires_at DESC
        `).bind(userId, now).all<Seat & { roomId: string; expiresAt: number }>(),
        canHost
          ? db.prepare(`
              SELECT r.id, r.code, r.expires_at AS expiresAt,
                m.id AS seatId, m.name, m.station
              FROM rooms r LEFT JOIN room_members m ON m.room_id = r.id
              WHERE r.owner_id = ? AND r.closed_at IS NULL AND r.expires_at > ?
              ORDER BY r.expires_at DESC, m.name COLLATE NOCASE, m.id
            `).bind(userId, now).all<Omit<HostedRoom, 'seats'> & { seatId: string | null; name: string; station: Seat['station'] }>()
          : { results: [] },
      ]);
      const hosted = new Map<string, HostedRoom>();
      for (const { id, code, expiresAt, seatId, name, station } of hostedRows.results) {
        let room = hosted.get(id);
        if (!room) {
          room = { id, code, expiresAt, seats: [] };
          hosted.set(id, room);
        }
        if (seatId) room.seats.push({ id: seatId, name, station });
      }
      const joined = joinedRows.results.map(({ roomId, expiresAt, id, name, station }) => ({
        id: roomId, expiresAt, seat: { id, name, station },
      }));
      return json({ canHost, hosted: [...hosted.values()], joined } satisfies RoomList);
    }

    if (url.pathname === '/api/rooms' && method === 'POST') {
      if (!canHost) return error('Only the DM can create a room.', 403);
      const id = crypto.randomUUID();
      const expiresAt = now + roomLifetime;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const room = await db.prepare(`
          INSERT INTO rooms (id, owner_id, code, expires_at) VALUES (?, ?, ?, ?)
          ON CONFLICT (code) DO NOTHING RETURNING id
        `).bind(id, userId, code, expiresAt).first();
        if (room) return json({ id, code, expiresAt, seats: [] } satisfies HostedRoom, 201);
      }
      return error('Could not create a room code. Try again.', 503);
    }

    if (url.pathname === '/api/rooms/join' && method === 'POST') {
      const fields = await readForm(request);
      const code = typeof fields?.code === 'string' ? fields.code.trim().toUpperCase() : '';
      const name = typeof fields?.name === 'string' ? fields.name.trim() : '';
      if (!codePattern.test(code)) return error('Enter the eight-character room code.', 400);
      if (!name || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) {
        return error('Enter a display name of 1 to 32 characters.', 400);
      }

      const reservation = await db.prepare(`
        INSERT INTO room_join_attempts (user_id, window_start, attempts) VALUES (?, ?, 1)
        ON CONFLICT (user_id) DO UPDATE SET
          window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
          attempts = CASE WHEN window_start <= ? THEN 1 ELSE attempts + 1 END
        WHERE window_start <= ? OR attempts < ?
        RETURNING window_start
      `).bind(userId, now, now - joinWindow, now - joinWindow, now - joinWindow, joinLimit)
        .first<{ window_start: number }>();
      if (!reservation) return error('Too many attempts. Try again in a few minutes.', 429);

      await db.prepare(`
        INSERT INTO room_members (id, room_id, user_id, name)
        SELECT ?, id, ?, ? FROM rooms WHERE code = ? AND closed_at IS NULL AND expires_at > ?
        ON CONFLICT (room_id, user_id) DO NOTHING RETURNING id
      `).bind(crypto.randomUUID(), userId, name, code, now).first();
      const joined = await db.prepare(`
        SELECT r.id AS roomId, r.expires_at AS expiresAt, m.id, m.name, m.station
        FROM rooms r JOIN room_members m ON m.room_id = r.id
        WHERE r.code = ? AND r.closed_at IS NULL AND r.expires_at > ? AND m.user_id = ?
      `).bind(code, now, userId).first<Seat & { roomId: string; expiresAt: number }>();
      if (!joined) return error(unavailable, 404);

      await db.prepare(`
        UPDATE room_join_attempts SET attempts = attempts - 1
        WHERE user_id = ? AND window_start = ? AND attempts > 0 RETURNING user_id
      `).bind(userId, reservation.window_start).first();
      const { roomId, expiresAt, ...seat } = joined;
      return json({ id: roomId, expiresAt, seat } satisfies JoinedRoom);
    }

    const action = url.pathname.match(roomAction);
    if (action && ((action[2] === 'close' && method === 'POST') || (action[3] && method === 'PUT'))) {
      if (!canHost) return error('Only the DM can manage this room.', 403);
      const roomId = action[1];
      if (action[2] === 'close') {
        const room = await db.prepare(`
          UPDATE rooms SET closed_at = COALESCE(closed_at, ?)
          WHERE id = ? AND owner_id = ? RETURNING id
        `).bind(now, roomId, userId).first();
        if (!room) return error('Room not found.', 404);
        return new Response(null, { status: 204, headers: noStore });
      }

      const fields = await readForm(request);
      const station = fields?.station;
      if (station !== null && !stations.some((option) => option === station)) {
        return error('Choose a Flight Deck station.', 400);
      }
      const seat = await db.prepare(`
        UPDATE room_members SET station = ? WHERE id = ? AND room_id = ?
          AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND owner_id = ?
            AND expires_at > ? AND closed_at IS NULL)
        RETURNING id, name, station
      `).bind(station as Seat['station'], action[3], roomId, roomId, userId, now).first<Seat>();
      if (!seat) return error('Seat or active room not found.', 404);
      return json(seat);
    }
    return error('Room action not found.', 404);
  } catch (cause) {
    console.error('Room storage request failed', cause instanceof Error ? cause.name : 'Unknown error');
    return error('Rooms are temporarily unavailable. Try again.', 503);
  }
}
