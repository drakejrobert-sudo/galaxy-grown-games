import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { roomApi } from '../src/rooms/api';
import type { HostedRoom, RoomList } from '../src/rooms/types';
import { roomsDatabase } from './fixtures/rooms-database';

const origin = 'https://galaxy.test';
const path = '/api/rooms';
const start = 1_800_000_000_000;
const hour = 60 * 60 * 1000;
const dm = { id: 'dm-id', email: 'dm@example.invalid' };
const pilot = { id: 'pilot-id', email: 'pilot@example.invalid' };
const gunner = { id: 'gunner-id', email: 'gunner@example.invalid' };
const secondDmSession = { ...dm, id: 'other-id' };

function fixture(t: TestContext, codes = ['ABCDEF23', 'BCDEFG34']) {
  const { database, binding } = roomsDatabase();
  t.after(() => database.close());
  let now = start;
  function call(endpoint: string, user: typeof dm | null, method = 'GET', data?: object, from = origin) {
    const headers = new Headers({ Origin: from });
    if (user) {
      headers.set('oai-authenticated-user-id', user.id);
      headers.set('oai-authenticated-user-email', user.email);
    }
    if (data) headers.set('Content-Type', 'application/json');
    return roomApi(new Request(origin + path + endpoint, {
      method, headers, body: data ? JSON.stringify(data) : undefined,
    }), { DB: binding, ROOM_DM_EMAIL: dm.email }, now, () => codes.shift() ?? 'ZZZZZZZZ');
  }
  return {
    call,
    clock: (value: number) => { now = value; },
    async list(user: typeof dm): Promise<RoomList> {
      const result = await call('', user);
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

test('only Drake can host, each room is scoped to the authenticated owner, and requests require Site identity', async (t) => {
  const { call, create, list } = fixture(t);
  assert.equal((await call('', null)).status, 401);
  const missingId = await roomApi(new Request(origin + path, {
    headers: { 'oai-authenticated-user-email': dm.email },
  }), {});
  assert.equal(missingId.status, 401);
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
  assert.deepEqual((await retry.json()).seat, { id: seatId, name: 'Zed', station: 'Pilot' });
  assert.deepEqual((await list(pilot)).joined[0].seat, { id: seatId, name: 'Zed', station: 'Pilot' });
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
