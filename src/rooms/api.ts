import { stations, type HostedRoom, type JoinedRoom, type RoomList, type Seat } from './types';

interface DatabaseStatement {
  bind(...values: (string | number | null)[]): DatabaseStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

export interface RoomEnvironment {
  DB?: { prepare(query: string): DatabaseStatement };
  ROOM_DM_EMAIL?: string;
  ROOM_RATE_LIMIT_KEY?: string;
}

const roomLifetime = 12 * 60 * 60 * 1000;
const joinWindow = 10 * 60 * 1000;
const joinLimit = 10;
const networkJoinLimit = 60;
const maxRoomSeats = 16;
const guestCookieName = '__Host-gg_room_guest';
const guestTokenPattern = /^[a-f0-9]{64}$/;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codePattern = /^[A-HJ-NP-Z2-9]{8}$/;
const roomAction = /^\/api\/rooms\/([a-f0-9-]{36})\/(close|seats\/([a-f0-9-]{36}))$/;
const unavailable = 'This room code is invalid, expired, or closed.';
const noStore = { 'Cache-Control': 'private, no-store' };

function randomCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => alphabet[byte % alphabet.length]).join('');
}

function json(data: unknown, status = 200, guestToken?: string): Response {
  const headers = new Headers(noStore);
  if (guestToken) {
    headers.set('Set-Cookie', `${guestCookieName}=${guestToken}; Path=/; Max-Age=${roomLifetime / 1000}; HttpOnly; Secure; SameSite=Lax`);
  }
  return Response.json(data, { status, headers });
}

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readGuestToken(request: Request): string | undefined {
  const cookie = request.headers.get('Cookie')?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(guestCookieName + '='));
  const token = cookie?.slice(guestCookieName.length + 1);
  return token && guestTokenPattern.test(token) ? token : undefined;
}

async function guestMemberId(token: string): Promise<string> {
  return 'guest:' + hex(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
}

async function networkRateKey(request: Request, secret: string | undefined): Promise<string> {
  // Cloudflare owns this header. Use a single conservative bucket if Sites omits it.
  const ip = request.headers.get('CF-Connecting-IP')?.trim();
  if (!ip || !secret) return 'network:shared';
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return 'network:' + hex(await crypto.subtle.sign('HMAC', key, encoder.encode(ip)));
}

async function reserveJoin(db: NonNullable<RoomEnvironment['DB']>, key: string, now: number, limit: number) {
  return db.prepare(`
    INSERT INTO room_join_attempts (user_id, window_start, attempts) VALUES (?, ?, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
      attempts = CASE WHEN window_start <= ? THEN 1 ELSE attempts + 1 END
    WHERE window_start <= ? OR attempts < ?
    RETURNING window_start
  `).bind(key, now, now - joinWindow, now - joinWindow, now - joinWindow, limit)
    .first<{ window_start: number }>();
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
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  const accountId = email ? request.headers.get('oai-authenticated-user-id')?.trim() : undefined;
  const guestToken = readGuestToken(request);

  const db = env.DB;
  if (!db) return error('Rooms are temporarily unavailable.', 503);
  const dmId = accountId && email === env.ROOM_DM_EMAIL?.trim().toLowerCase() ? accountId : undefined;
  const method = request.method;
  if (method !== 'GET' && request.headers.get('Origin') !== url.origin) {
    return error('Open Rooms from this Site to make changes.', 403);
  }

  try {
    if (url.pathname === '/api/rooms' && method === 'GET') {
      const anonymousId = guestToken ? await guestMemberId(guestToken) : null;
      if (!accountId && !anonymousId) {
        const token = hex(crypto.getRandomValues(new Uint8Array(32)));
        return json({ canHost: false, hosted: [], joined: [] } satisfies RoomList, 200, token);
      }
      const [joinedRows, hostedRows] = await Promise.all([
        db.prepare(`
          SELECT r.id AS roomId, r.expires_at AS expiresAt, m.id, m.name, m.station
          FROM room_members m JOIN rooms r ON r.id = m.room_id
          WHERE m.user_id IN (?, ?) AND r.closed_at IS NULL AND r.expires_at > ?
          ORDER BY r.expires_at DESC
        `).bind(accountId ?? null, anonymousId, now).all<Seat & { roomId: string; expiresAt: number }>(),
        dmId
          ? db.prepare(`
              SELECT r.id, r.code, r.expires_at AS expiresAt,
                m.id AS seatId, m.name, m.station
              FROM rooms r LEFT JOIN room_members m ON m.room_id = r.id
              WHERE r.owner_id = ? AND r.closed_at IS NULL AND r.expires_at > ?
              ORDER BY r.expires_at DESC, m.name COLLATE NOCASE, m.id
            `).bind(dmId, now).all<Omit<HostedRoom, 'seats'> & { seatId: string | null; name: string; station: Seat['station'] }>()
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
      return json({ canHost: Boolean(dmId), hosted: [...hosted.values()], joined } satisfies RoomList);
    }

    if (url.pathname === '/api/rooms' && method === 'POST') {
      if (!dmId) return error('Only the signed-in DM can create a room.', 403);
      const id = crypto.randomUUID();
      const expiresAt = now + roomLifetime;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const room = await db.prepare(`
          INSERT INTO rooms (id, owner_id, code, expires_at) VALUES (?, ?, ?, ?)
          ON CONFLICT (code) DO NOTHING RETURNING id
        `).bind(id, dmId, code, expiresAt).first();
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

      const anonymousId = guestToken ? await guestMemberId(guestToken) : null;
      const memberId = accountId ?? anonymousId;
      if (!memberId) return error('Allow cookies and refresh Rooms before joining.', 400);

      if (!accountId) {
        const network = await networkRateKey(request, env.ROOM_RATE_LIMIT_KEY);
        if (!await reserveJoin(db, network, now, networkJoinLimit)) {
          return error('Too many attempts. Try again in a few minutes.', 429);
        }
      }
      const reservation = await reserveJoin(db, memberId, now, joinLimit);
      if (!reservation) return error('Too many attempts. Try again in a few minutes.', 429);

      await db.prepare(`
        INSERT INTO room_members (id, room_id, user_id, name)
        SELECT ?, r.id, ?, ? FROM rooms r WHERE r.code = ? AND r.closed_at IS NULL AND r.expires_at > ?
          AND (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) < ?
          AND NOT EXISTS (
            SELECT 1 FROM room_members WHERE room_id = r.id AND user_id IN (?, ?)
          )
        ON CONFLICT (room_id, user_id) DO NOTHING RETURNING id
      `).bind(crypto.randomUUID(), memberId, name, code, now, maxRoomSeats, memberId, anonymousId).first();
      const joined = await db.prepare(`
        SELECT r.id AS roomId, r.expires_at AS expiresAt, m.id, m.name, m.station
        FROM rooms r JOIN room_members m ON m.room_id = r.id
        WHERE r.code = ? AND r.closed_at IS NULL AND r.expires_at > ? AND m.user_id IN (?, ?)
        ORDER BY (m.user_id = ?) DESC LIMIT 1
      `).bind(code, now, memberId, anonymousId, memberId).first<Seat & { roomId: string; expiresAt: number }>();
      if (!joined) {
        const active = await db.prepare(`
          SELECT id FROM rooms WHERE code = ? AND closed_at IS NULL AND expires_at > ?
        `).bind(code, now).first();
        if (!active) return error(unavailable, 404);
      }

      await db.prepare(`
        UPDATE room_join_attempts SET attempts = attempts - 1
        WHERE user_id = ? AND window_start = ? AND attempts > 0 RETURNING user_id
      `).bind(memberId, reservation.window_start).first();
      if (!joined) return error('This room is full.', 409);
      const { roomId, expiresAt, ...seat } = joined;
      return json({ id: roomId, expiresAt, seat } satisfies JoinedRoom, 200, accountId ? undefined : guestToken);
    }

    const action = url.pathname.match(roomAction);
    if (action && ((action[2] === 'close' && method === 'POST') || (action[3] && method === 'PUT'))) {
      if (!dmId) return error('Only the signed-in DM can manage this room.', 403);
      const roomId = action[1];
      if (action[2] === 'close') {
        const room = await db.prepare(`
          UPDATE rooms SET closed_at = COALESCE(closed_at, ?)
          WHERE id = ? AND owner_id = ? RETURNING id
        `).bind(now, roomId, dmId).first();
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
      `).bind(station as Seat['station'], action[3], roomId, roomId, dmId, now).first<Seat>();
      if (!seat) return error('Seat or active room not found.', 404);
      return json(seat);
    }
    return error('Room action not found.', 404);
  } catch (cause) {
    console.error('Room storage request failed', cause instanceof Error ? cause.name : 'Unknown error');
    return error('Rooms are temporarily unavailable. Try again.', 503);
  }
}
