import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { roomApi } from '../src/rooms/api';
import type { HostedRoom, JoinedRoom, RoomList, RoomReport } from '../src/rooms/types';
import { applyDashboardMigration, roomsDatabase } from './fixtures/rooms-database';

const origin = 'https://galaxy.test';
const path = '/api/rooms';
const start = 1_800_000_000_000;
const hour = 60 * 60 * 1000;
const dm = { id: 'dm-id', email: 'dm@example.invalid' };
const pilot = { id: 'pilot-id', email: 'pilot@example.invalid' };
const gunner = { id: 'gunner-id', email: 'gunner@example.invalid' };
const secondDmSession = { ...dm, id: 'other-id' };

function fixture(t: TestContext, codes = ['ABCDEF23', 'BCDEFG34'], includeDashboard = true) {
  const { database, binding } = roomsDatabase(includeDashboard);
  t.after(() => database.close());
  let now = start;
  function call(endpoint: string, user: typeof dm | null, method = 'GET', data?: object, from = origin, extra: Record<string, string> = {}) {
    const headers = new Headers({ Origin: from, ...extra });
    if (user) {
      headers.set('oai-authenticated-user-id', user.id);
      headers.set('oai-authenticated-user-email', user.email);
    }
    if (data) headers.set('Content-Type', 'application/json');
    return roomApi(new Request(origin + path + endpoint, {
      method, headers, body: data ? JSON.stringify(data) : undefined,
    }), { DB: binding, ROOM_DM_EMAIL: dm.email, ROOM_RATE_LIMIT_KEY: 'fictional-fixture-key' }, now, () => codes.shift() ?? 'ZZZZZZZZ');
  }
  return {
    call,
    database,
    clock: (value: number) => { now = value; },
    async list(user: typeof dm | null, cookie?: string): Promise<RoomList> {
      const result = await call('', user, 'GET', undefined, origin, cookie ? { Cookie: cookie } : {});
      assert.equal(result.status, 200);
      assert.equal(result.headers.get('cache-control'), 'private, no-store');
      return result.json();
    },
    async create(user = dm): Promise<HostedRoom> {
      const result = await call('', user, 'POST');
      assert.equal(result.status, 201);
      return result.json();
    },
  };
}

test('only Drake can host, each room is scoped to the authenticated owner, and management requires Site identity', async (t) => {
  const { call, create, list } = fixture(t);
  assert.equal((await call('', null, 'POST')).status, 403);
  assert.equal((await call('', { ...dm, id: '' }, 'POST')).status, 403);
  assert.equal((await call('', pilot, 'POST')).status, 403);
  assert.equal((await call('', dm, 'POST', undefined, 'https://elsewhere.test')).status, 403);
  const room = await create();
  assert.deepEqual(await list(pilot), { canHost: false, hosted: [], joined: [] });
  assert.deepEqual((await list(secondDmSession)).hosted, []);
  assert.equal((await call('/' + room.id + '/close', secondDmSession, 'POST')).status, 404);
  assert.deepEqual((await list(dm)).hosted, [room]);
});

test('two active rooms retry code collisions and keep seats and assignments separate', async (t) => {
  const { call, create, list } = fixture(t, ['ABCDEF23', 'ABCDEF23', 'BCDEFG34']);
  const [first, second] = await Promise.all([create(), create()]);
  assert.notEqual(first.code, second.code);
  assert.equal(first.expiresAt, start + 12 * hour);
  const [a, b] = await Promise.all([
    call('/join', pilot, 'POST', { code: first.code.toLowerCase(), name: 'Zed' }),
    call('/join', gunner, 'POST', { code: second.code, name: 'Shay' }),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const player = await a.json();
  assert.equal(player.seat.station, null);
  assert.equal(player.code, undefined);
  assert.equal((await list(gunner)).joined[0].id, second.id);
  assert.equal((await list(dm)).hosted.find((room) => room.id === second.id)?.seats.length, 1);

  const assignment = '/' + first.id + '/seats/' + player.seat.id;
  assert.equal((await call(assignment, pilot, 'PUT', { station: 'Gunner' })).status, 403);
  assert.equal((await call(assignment, dm, 'PUT', { station: 'Mystic' })).status, 400);
  assert.equal((await call('/' + second.id + '/seats/' + player.seat.id, dm, 'PUT', { station: 'Gunner' })).status, 404);
  assert.equal((await call(assignment, dm, 'PUT', { station: 'Gunner' })).status, 200);
  assert.equal((await list(pilot)).joined[0].seat.station, 'Gunner');
  assert.equal((await list(gunner)).joined[0].seat.station, null);
  assert.equal((await call(assignment, dm, 'PUT', { station: null })).status, 200);
  assert.equal((await list(pilot)).joined[0].seat.station, null);
});

test('concurrent repeated joins and a fresh visit reclaim the original seat', async (t) => {
  const { call, create, list } = fixture(t);
  const room = await create();
  const attempts = await Promise.all(Array.from({ length: 5 }, () =>
    call('/join', pilot, 'POST', { code: room.code, name: 'Zed' })));
  const seatIds = await Promise.all(attempts.map(async (response) => {
    assert.equal(response.status, 200);
    return (await response.json()).seat.id;
  }));
  assert.equal(new Set(seatIds).size, 1);
  assert.equal((await list(dm)).hosted[0].seats.length, 1);
  const [seatId] = seatIds;
  const assign = '/' + room.id + '/seats/' + seatId;
  assert.equal((await call(assign, dm, 'PUT', { station: 'Pilot' })).status, 200);
  const retry = await call('/join', pilot, 'POST', { code: room.code, name: 'Different name' });
  assert.deepEqual((await retry.json()).seat, { id: seatId, name: 'Zed', station: 'Pilot', startedAt: null, report: null });
  assert.deepEqual((await list(pilot)).joined[0].seat, { id: seatId, name: 'Zed', station: 'Pilot', startedAt: null, report: null });
});

test('closing or expiring a room ends access and blocks further joins and assignments', async (t) => {
  const { call, clock, create, list } = fixture(t);
  const closed = await create();
  const expired = await create();
  const joinClosed = { code: closed.code, name: 'Zed' };
  const joinExpired = { code: expired.code, name: 'Zed' };
  const joined = await (await call('/join', pilot, 'POST', joinClosed)).json();
  assert.equal((await call('/join', pilot, 'POST', joinExpired)).status, 200);
  const close = '/' + closed.id + '/close';
  assert.equal((await call(close, pilot, 'POST')).status, 403);
  assert.equal((await call(close, dm, 'POST')).status, 204);
  assert.equal((await call(close, dm, 'POST')).status, 204);
  assert.equal((await call('/join', pilot, 'POST', joinClosed)).status, 404);
  assert.equal((await call('/' + closed.id + '/seats/' + joined.seat.id, dm, 'PUT', { station: 'Pilot' })).status, 404);
  assert.equal((await list(pilot)).joined.length, 1);
  clock(start + 12 * hour);
  assert.equal((await call('/join', pilot, 'POST', joinExpired)).status, 404);
  assert.equal((await list(pilot)).joined.length, 0);
  assert.equal((await list(dm)).hosted.length, 0);
});

test('rate limits repeated wrong room codes per account and resets after ten minutes', async (t) => {
  const { call, clock, create } = fixture(t);
  const { code } = await create();
  const guess = { code: 'ZZZZZZZZ', name: 'Zed' };
  const attempts = await Promise.all(Array.from({ length: 12 }, () => call('/join', pilot, 'POST', guess)));
  assert.deepEqual(attempts.map((response) => response.status), [...Array(10).fill(404), 429, 429]);
  assert.equal((await call('/join', gunner, 'POST', { code, name: 'Shay' })).status, 200);
  clock(start + 10 * 60 * 1000);
  assert.equal((await call('/join', pilot, 'POST', { code, name: 'Zed' })).status, 200);
});

test('invalid forms and oversized input cannot create a seat', async (t) => {
  const { call, create, list } = fixture(t);
  const room = await create();
  for (const data of [
    { code: '11111', name: 'Zed' }, { code: room.code, name: '  ' },
    { code: room.code, name: 'Zed\tFace' }, { code: room.code, name: 'a'.repeat(2000) },
  ]) {
    assert.equal((await call('/join', pilot, 'POST', data)).status, 400);
  }
  assert.equal((await list(dm)).hosted[0].seats.length, 0);
});

async function guestCookie(call: ReturnType<typeof fixture>['call']): Promise<string> {
  const response = await call('', null);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { canHost: false, hosted: [], joined: [] });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^__Host-gg_room_guest=[a-f0-9]{64}; Path=\/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax$/);
  return cookie.split(';')[0];
}

test('guests join by code, recover their assigned seat only with their browser cookie, and cannot manage rooms', async (t) => {
  const { call, create, database, list } = fixture(t);
  const room = await create();
  const [first, second] = await Promise.all([guestCookie(call), guestCookie(call)]);
  assert.notEqual(first, second);
  const form = { code: room.code, name: 'Skye' };
  assert.equal((await call('/join', null, 'POST', form)).status, 400);
  const signedOut = (path: string, method: string, data?: object) => call(path, null, method, data, origin, { Cookie: first });
  const joins = await Promise.all([signedOut('/join', 'POST', form), signedOut('/join', 'POST', form)]);
  assert.deepEqual(joins.map((response) => response.status), [200, 200]);
  const [{ seat }, retry] = await Promise.all(joins.map((response) => response.json()));
  assert.equal(retry.seat.id, seat.id);
  const path = '/' + room.id + '/seats/' + seat.id;
  assert.equal((await signedOut(path, 'PUT', { station: 'Pilot' })).status, 403);
  assert.equal((await signedOut('/' + room.id + '/close', 'POST')).status, 403);
  assert.equal((await call(path, dm, 'PUT', { station: 'Pilot' })).status, 200);
  assert.equal((await list(null, first)).joined[0].seat.station, 'Pilot');
  assert.deepEqual((await list(null, second)).joined, []);
  assert.equal((await list(pilot, first)).joined[0].seat.id, seat.id);
  const loggedInRetry = await call('/join', pilot, 'POST', form, origin, { Cookie: first });
  assert.equal((await loggedInRetry.json()).seat.id, seat.id);
  const stored = database.prepare('SELECT user_id FROM room_members').get()?.user_id;
  assert.match(String(stored), /^guest:[a-f0-9]{64}$/);
  assert.ok(!first.includes(String(stored).slice(6)));
  assert.equal((await call('/' + room.id + '/close', dm, 'POST')).status, 204);
  assert.deepEqual((await list(null, first)).joined, []);
});

test('public guest requests are bounded across cookies on one network', async (t) => {
  const { call, create } = fixture(t);
  const room = await create();
  const cookies = await Promise.all(Array.from({ length: 61 }, () => guestCookie(call)));
  const form = { code: 'ZZZZZZZZ', name: 'Skye' };
  const requests = await Promise.all(cookies.map((Cookie) => call('/join', null, 'POST', form, origin, {
    Cookie, 'CF-Connecting-IP': '192.0.2.30',
  })));
  assert.equal(requests.filter((response) => response.status === 404).length, 60);
  assert.equal(requests.filter((response) => response.status === 429).length, 1);
  assert.equal((await call('/join', null, 'POST', { ...form, code: room.code }, origin, {
    Cookie: cookies[60], 'CF-Connecting-IP': '192.0.2.31',
  })).status, 200);
});

test('a full room still lets existing guests reclaim their seats', async (t) => {
  const { call, create, list } = fixture(t);
  const room = await create();
  const cookies = await Promise.all(Array.from({ length: 17 }, () => guestCookie(call)));
  const join = (Cookie: string) => call('/join', null, 'POST', { code: room.code, name: 'Crew' }, origin, { Cookie });
  const results = await Promise.all(cookies.map(join));
  assert.equal(results.filter((response) => response.status === 200).length, 16);
  assert.equal(results.filter((response) => response.status === 409).length, 1);
  const accepted = results.findIndex((response) => response.status === 200);
  const { seat } = await results[accepted].json();
  assert.equal((await (await join(cookies[accepted])).json()).seat.id, seat.id);
  assert.equal((await list(dm)).hosted[0].seats.length, 16);
});

const assignment = { situation: 'Asteroid Field', station: 'Pilot' };
const flightReport: RoomReport = {
  text: 'Galaxy Grown Flight Report\nAsteroid Field / Pilot\nRating: 60/100',
  outcome: 'Course complete.',
  rating: 60,
  ratingLabel: 'Steady',
  points: 750,
  victoryBonus: 0,
};

test('dashboard migration preserves existing room codes, members and station assignments', async (t) => {
  const { call, database, list } = fixture(t, undefined, false);
  const roomId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const seatId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  database.prepare('INSERT INTO rooms (id, owner_id, code, expires_at) VALUES (?, ?, ?, ?)')
    .run(roomId, dm.id, 'ABCDEF23', start + hour);
  database.prepare('INSERT INTO room_members (id, room_id, user_id, name, station) VALUES (?, ?, ?, ?, ?)')
    .run(seatId, roomId, pilot.id, 'Skye', 'Pilot');

  applyDashboardMigration(database);
  assert.deepEqual((await list(dm)).hosted[0], {
    id: roomId, code: 'ABCDEF23', expiresAt: start + hour, situation: null,
    seats: [{ id: seatId, name: 'Skye', station: 'Pilot', startedAt: null, report: null }],
  });
  const rejoin = await call('/join', pilot, 'POST', { code: 'ABCDEF23', name: 'Skye' });
  assert.equal((await rejoin.json()).seat.id, seatId);
});

test('an assigned guest starts with the current encounter and station; only started choices lock', async (t) => {
  const { call, create, list } = fixture(t);
  const room = await create();
  const cookie = await guestCookie(call);
  const guest = (path: string, method: string, data?: object) => call(path, null, method, data, origin, { Cookie: cookie });
  const joined: JoinedRoom = await (await guest('/join', 'POST', { code: room.code, name: 'Skye' })).json();
  const second: JoinedRoom = await (await call('/join', gunner, 'POST', { code: room.code, name: 'Finch' })).json();
  const seatPath = `/${room.id}/seats/${joined.seat.id}`;
  const encounterPath = `/${room.id}/encounter`;

  assert.equal((await guest(encounterPath, 'PUT', assignment)).status, 403);
  assert.equal((await call(encounterPath, secondDmSession, 'PUT', assignment)).status, 404);
  assert.equal((await call(encounterPath, dm, 'PUT', { situation: 'Other' })).status, 400);
  assert.equal((await guest(seatPath + '/start', 'POST', assignment)).status, 409);
  assert.equal((await call(encounterPath, dm, 'PUT', { situation: 'Space Battle' })).status, 204);
  assert.equal((await call(seatPath, dm, 'PUT', { station: 'Gunner' })).status, 200);
  assert.equal((await guest(seatPath + '/start', 'POST', assignment)).status, 409);
  assert.equal((await call(encounterPath, dm, 'PUT', assignment)).status, 204);
  assert.equal((await guest(seatPath + '/start', 'POST', assignment)).status, 409);
  assert.equal((await call(seatPath, dm, 'PUT', assignment)).status, 200);
  assert.equal((await call(seatPath + '/start', gunner, 'POST', assignment)).status, 404);
  assert.equal((await guest(seatPath, 'GET')).status, 200);
  assert.deepEqual(await (await guest(seatPath, 'GET')).json(), (await list(null, cookie)).joined[0]);

  for (const result of await Promise.all(Array.from({ length: 2 }, () => guest(seatPath + '/start', 'POST', assignment)))) {
    assert.equal(result.status, 204);
  }
  assert.equal((await list(dm)).hosted[0].seats.find((seat) => seat.id === joined.seat.id)?.startedAt, start);
  assert.equal((await call(encounterPath, dm, 'PUT', { situation: 'Space Battle' })).status, 409);
  assert.equal((await call(seatPath, dm, 'PUT', { station: 'Gunner' })).status, 409);
  assert.equal((await call(`/${room.id}/seats/${second.seat.id}`, dm, 'PUT', { station: 'Gunner' })).status, 200);
});

test('the first explicit report wins across concurrent tabs and is visible only to the member and DM', async (t) => {
  const { call, clock, create, database, list } = fixture(t);
  const [room, otherRoom] = await Promise.all([create(), create(secondDmSession)]);
  const player: JoinedRoom = await (await call('/join', pilot, 'POST', { code: room.code, name: 'Skye' })).json();
  const other: JoinedRoom = await (await call('/join', gunner, 'POST', { code: otherRoom.code, name: 'Finch' })).json();
  const seatPath = `/${room.id}/seats/${player.seat.id}`;
  const reportPath = seatPath + '/report';
  const secondReport = { ...flightReport, rating: 70, points: 900 };

  assert.equal((await call(reportPath, pilot, 'POST', flightReport)).status, 409);
  assert.equal((await call(`/${room.id}/encounter`, dm, 'PUT', assignment)).status, 204);
  assert.equal((await call(seatPath, dm, 'PUT', assignment)).status, 200);
  assert.equal((await call(seatPath + '/start', pilot, 'POST', assignment)).status, 204);
  assert.equal((await call(reportPath, gunner, 'POST', flightReport)).status, 404);
  assert.equal((await call(reportPath, null, 'POST', flightReport)).status, 404);
  assert.equal((await call(reportPath, pilot, 'POST', flightReport, 'https://elsewhere.test')).status, 403);
  assert.equal((await call(reportPath, pilot, 'POST', { ...flightReport, rating: 101 })).status, 400);
  assert.equal((await call(reportPath, pilot, 'POST', { ...flightReport, text: 'a'.repeat(9000) })).status, 400);

  const responses = await Promise.all([flightReport, secondReport, flightReport].map((report) =>
    call(reportPath, pilot, 'POST', report)));
  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
  const [saved, ...retries] = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(retries, [saved, saved]);
  assert.deepEqual(await (await call(reportPath, pilot, 'POST', secondReport)).json(), saved);
  assert.equal(database.prepare('SELECT count(*) AS count FROM room_members WHERE report IS NOT NULL').get()?.count, 1);
  assert.deepEqual((await list(dm)).hosted[0].seats[0].report, saved);
  assert.deepEqual((await list(pilot)).joined[0].seat.report, saved);
  assert.equal((await call(seatPath, dm)).status, 404, 'only a seat member can open the player flight');
  assert.equal((await call(seatPath, gunner)).status, 404);
  assert.equal((await list(secondDmSession)).hosted[0].seats[0].report, null);
  assert.equal((await list(gunner)).joined[0].seat.id, other.seat.id);
  assert.equal((await call(seatPath + '/start', pilot, 'POST', assignment)).status, 409);

  assert.equal((await call(`/${room.id}/close`, dm, 'POST')).status, 204);
  assert.equal((await call(reportPath, pilot, 'POST', flightReport)).status, 404);
  assert.equal((await call(seatPath, pilot)).status, 404);
  assert.equal((await call(seatPath + '/start', pilot, 'POST', assignment)).status, 404);
  assert.deepEqual((await list(dm)).hosted, []);
  clock(start + 12 * hour);
  const expiredSeat = `/${otherRoom.id}/seats/${other.seat.id}`;
  assert.equal((await call(expiredSeat, gunner)).status, 404);
  assert.equal((await call(expiredSeat + '/start', gunner, 'POST', assignment)).status, 404);
  assert.equal((await call(expiredSeat + '/report', gunner, 'POST', flightReport)).status, 404);
});

test('room map proposals use approved schematic fields, isolate players, and allow safe retries', async (t) => {
  const { call, create, list, clock } = fixture(t);
  const room = await create();
  const other = await create();
  const guestSession = await call('', null);
  const cookie = guestSession.headers.get('set-cookie')!.split(';')[0];
  const join = await call('/join', null, 'POST', { code: room.code, name: 'Mira' }, origin, { Cookie: cookie });
  const { seat } = await join.json() as JoinedRoom;
  await call('/join', gunner, 'POST', { code: room.code, name: 'Zed' });
  const path = '/' + room.id;
  const map = {
    start: 'a',
    stops: [{ id: 'a', name: 'Alpha', x: 100, y: 100, notes: 'secret' },
      { id: 'b', name: 'Beta', x: 450, y: 250 }, { id: 'c', name: 'Gamma', x: 800, y: 400 }],
    links: [['a', 'b'], ['b', 'c']],
    backgroundImage: 'secret art',
  };
  const share = { map, campaignId: 'private campaign', mapId: 'private map' };
  assert.equal((await call(path + '/map', gunner, 'PUT', share)).status, 403);
  assert.equal((await call(path + '/map', secondDmSession, 'PUT', share)).status, 404);
  assert.equal((await call(path + '/map', dm, 'PUT', share)).status, 204);
  const planner = (await list(null, cookie)).joined[0].planner!;
  const { revision } = planner.map;
  assert.deepEqual(planner.map.stops[0], { id: 'a', name: 'Alpha', x: 100, y: 100 });
  assert.doesNotMatch(JSON.stringify(planner), /secret|private|source/);

  const send = (stops: string[], id = crypto.randomUUID(), version = revision) => call(path + '/proposals', null,
    'POST', { id, revision: version, stops }, origin, { Cookie: cookie });
  assert.equal((await send(['a', 'c'])).status, 400);
  assert.equal((await send(['a', 'hidden'])).status, 400);
  assert.equal((await send(['b', 'c'])).status, 400);
  const id = crypto.randomUUID();
  const retries = await Promise.all([send(['a', 'b', 'c'], id), send(['a', 'b', 'c'], id), send(['a', 'b', 'c'])]);
  assert.deepEqual(await Promise.all(retries.map(response => response.json())), [{ id }, { id }, { id }]);
  assert.equal((await send(['a', 'b'])).status, 200);
  assert.equal((await list(null, cookie)).joined[0].planner!.proposals.length, 2);
  assert.deepEqual((await list(gunner)).joined[0].planner!.proposals, []);
  assert.deepEqual((await list(dm)).hosted.find(item => item.id === other.id)?.planner, undefined);
  const host = (await list(dm)).hosted.find(item => item.id === room.id)?.planner!;
  assert.deepEqual(host.source, { campaignId: share.campaignId, mapId: share.mapId });
  assert.equal(host.proposals.find(item => item.id === id)?.player, 'Mira');

  const accepted = { status: 'accepted', revision, seatId: seat.id };
  assert.equal((await call(path + '/proposals/' + id, gunner, 'PUT', accepted)).status, 403);
  assert.equal((await call(path + '/proposals/' + id, secondDmSession, 'PUT', accepted)).status, 409);
  assert.equal((await call('/' + other.id + '/proposals/' + id, dm, 'PUT', accepted)).status, 409);
  assert.equal((await call(path + '/proposals/' + id, dm, 'PUT', accepted)).status, 204);
  assert.equal((await call(path + '/proposals/' + id, dm, 'PUT', accepted)).status, 204);
  assert.equal((await call(path + '/proposals/' + id, dm, 'PUT', { ...accepted, status: 'declined' })).status, 409);
  assert.equal((await list(null, cookie)).joined[0].planner!.proposals.find(item => item.id === id)?.status, 'accepted');

  assert.equal((await call(path + '/map', dm, 'PUT', share)).status, 204);
  assert.equal((await list(null, cookie)).joined[0].planner!.map.revision, revision);
  assert.equal((await call(path + '/map', dm, 'PUT', { ...share, map: { ...map, links: [['a', 'b']] } })).status, 204);
  assert.equal((await send(['a', 'b'])).status, 409);
  assert.equal((await call(path + '/proposals/' + id, dm, 'PUT', accepted)).status, 409);
  assert.deepEqual((await list(null, cookie)).joined[0].planner!.proposals, []);
  const updated = (await list(null, cookie)).joined[0].planner!.map.revision;
  clock(room.expiresAt);
  assert.equal((await send(['a', 'b'], crypto.randomUUID(), updated)).status, 404);
  assert.deepEqual((await list(null, cookie)).joined, []);
});

test('closing a room deletes its shared schematic and proposals', async (t) => {
  const { call, create, list, database } = fixture(t);
  const room = await create();
  const path = '/' + room.id;
  await call('/join', pilot, 'POST', { code: room.code, name: 'Mira' });
  await call(path + '/map', dm, 'PUT', { campaignId: 'campaign', mapId: 'sector', map: {
    start: 'a', stops: [{ id: 'a', name: 'A', x: 100, y: 100 }, { id: 'b', name: 'B', x: 200, y: 100 }],
    links: [['a', 'b']],
  } });
  const { revision } = (await list(pilot)).joined[0].planner!.map;
  await call(path + '/proposals', pilot, 'POST', { id: crypto.randomUUID(), revision, stops: ['a', 'b'] });
  assert.equal((await call(path + '/close', dm, 'POST')).status, 204);
  assert.deepEqual(database.prepare('SELECT room_id FROM room_maps').all(), []);
  assert.deepEqual(database.prepare('SELECT room_id FROM room_route_proposals').all(), []);
});

test('shared artwork is separately authorized and artwork updates retain course proposals', async t => {
  const { call, create, list, clock, database } = fixture(t);
  const room = await create();
  const other = await create();
  const guest = await call('', null);
  const cookie = guest.headers.get('set-cookie')!.split(';')[0];
  await call('/join', null, 'POST', { code: room.code, name: 'Mira' }, origin, { Cookie: cookie });
  await call('/join', gunner, 'POST', { code: other.code, name: 'Zed' });
  const path = '/' + room.id;
  const map = {
    start: 'a',
    stops: [{ id: 'a', name: 'Alpha', x: 100, y: 100 }, { id: 'b', name: 'Beta', x: 450, y: 250 }],
    links: [['a', 'b']],
  };
  const artwork = 'data:image/png;base64,iVBORw0KGgo=';
  const share = { map, campaignId: 'private campaign', mapId: 'private map' };
  assert.equal((await call(path + '/map', dm, 'PUT', share)).status, 204);
  const { revision } = (await list(null, cookie)).joined[0].planner!.map;
  const id = crypto.randomUUID();
  assert.equal((await call(path + '/proposals', null, 'POST',
    { id, revision, stops: ['a', 'b'] }, origin, { Cookie: cookie })).status, 200);

  const withTypes = { ...map, stops: map.stops.map(stop => ({ ...stop, type: 'planet' })) };
  assert.equal((await call(path + '/map', dm, 'PUT', { ...share, map: withTypes, artwork })).status, 204);
  const planner = (await list(null, cookie)).joined[0].planner!;
  const artRevision = planner.map.artworkRevision!;
  assert.equal(planner.map.revision, revision);
  assert.notEqual(artRevision, undefined);
  assert.equal(planner.map.stops[0].type, 'planet');
  assert.equal(planner.proposals[0].id, id);
  assert.doesNotMatch(JSON.stringify(planner), /data:image|private campaign|private map/);
  const artPath = path + '/map/artwork?revision=' + artRevision;
  const allowed = await call(artPath, null, 'GET', undefined, origin, { Cookie: cookie });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('cache-control'), 'private, no-store');
  assert.equal(allowed.headers.get('content-type'), 'image/png');
  assert.equal(await allowed.arrayBuffer().then(buffer => Buffer.from(buffer).toString('base64')), 'iVBORw0KGgo=');
  assert.equal((await call(artPath, dm)).status, 200);
  assert.equal((await call(artPath, secondDmSession)).status, 404);
  assert.equal((await call(artPath, gunner)).status, 404);
  assert.equal((await call(artPath, null)).status, 404);
  assert.equal((await call(artPath.replace(room.id, other.id), gunner)).status, 404);

  assert.equal((await call(path + '/map', dm, 'PUT', { ...share, artwork: 'data:image/svg+xml;base64,AAAA' })).status, 400);
  assert.equal((await call(artPath, dm)).status, 200);
  assert.equal((await call(path + '/map', dm, 'PUT', { ...share, artwork: null })).status, 204);
  assert.equal((await call(artPath, dm)).status, 404);
  assert.equal((await list(null, cookie)).joined[0].planner!.proposals.length, 1);
  assert.equal((await call(path + '/map', dm, 'PUT', { ...share, map: { ...map, start: 'b' }, artwork })).status, 204);
  const changed = (await list(null, cookie)).joined[0].planner!;
  assert.notEqual(changed.map.revision, revision);
  assert.deepEqual(changed.proposals, []);
  clock(room.expiresAt);
  assert.equal((await call(artPath, dm)).status, 404);
  assert.equal((await call(artPath, null, 'GET', undefined, origin, { Cookie: cookie })).status, 404);
  assert.equal((await call(path + '/close', dm, 'POST')).status, 204);
  assert.deepEqual(database.prepare('SELECT artwork FROM room_maps WHERE room_id = ?').all(room.id), []);
});
