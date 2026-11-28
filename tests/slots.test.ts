import assert from 'node:assert/strict';
import test from 'node:test';
import {
  affordableWagers, beginSpin, drawReels, multiplier, openSession, requestCashOut,
  settlementReport, settleSpin, symbolAtStop, type SlotSession,
} from '../src/slots/rules';
import { readSession, sessionKey, writeSession } from '../src/slots/session';

const frequencies = new Map([[0, 23972], [1, 4096], [4, 4096], [13, 512], [30, 64], [50, 27], [100, 1]]);
const combinations = 32 ** 3;

test('each of the virtual reel combinations pays the intended tier', () => {
  const counts = new Map<number, number>();
  for (let left = 0; left < 32; left++) {
    for (let center = 0; center < 32; center++) {
      for (let right = 0; right < 32; right++) {
        const tier = multiplier([symbolAtStop(left), symbolAtStop(center), symbolAtStop(right)]);
        counts.set(tier, (counts.get(tier) ?? 0) + 1);
      }
    }
  }
  assert.deepEqual(counts, frequencies);
  assert.equal([...counts].reduce((sum, [tier, count]) => sum + tier * count, 0), 30506);
});

test('a reproducible five-million-spin sample agrees with the fixed payout rates', t => {
  const spins = 5_000_000;
  let state = 0x129c001;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  const counts = new Array<number>(101).fill(0);
  let total = 0;
  for (let i = 0; i < spins; i++) {
    const tier = multiplier(drawReels(random));
    counts[tier]++;
    total += tier;
  }
  for (const [tier, count] of frequencies) {
    const p = count / combinations;
    const deviation = Math.sqrt(spins * p * (1 - p));
    assert.ok(Math.abs(counts[tier] - spins * p) <= 6 * deviation, `Tier ${tier}`);
  }
  assert.ok(Math.abs(total / spins - 30506 / combinations) <= .008);
  t.diagnostic(`Observed return ${(100 * total / spins).toFixed(3)}%. Tier counts ${JSON.stringify(
    [...frequencies.keys()].map(tier => [tier, counts[tier]]),
  )}`);
});

test('opening gold and wagers enforce whole-gp limits and scale payout once', () => {
  for (const invalid of [-5, 0, 4, 5.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(openSession(invalid), null);
  }

  const session = openSession(5)!;
  const crown = () => 31 / 32;
  for (const invalid of [-1, 0, .5, 6, NaN]) assert.equal(beginSpin(session, invalid, crown), session);
  assert.equal(affordableWagers(3), 3);
  assert.equal(affordableWagers(Number.MAX_SAFE_INTEGER), 0);

  for (let wager = 1; wager <= 5; wager++) {
    const pending = beginSpin(session, wager, crown);
    assert.equal(pending.balance, 5 - wager);
    assert.equal(beginSpin(pending, wager, crown), pending);
    const result = settleSpin(pending);
    assert.equal(result.balance, 5 + 99 * wager);
    assert.equal(result.phase, 'ready');
    assert.equal(settleSpin(result), result);
  }
});

test('cash-out settles immediate, queued, break-even and zero-balance sessions', () => {
  const ready = openSession(5)!;
  const lostWager = [0, .5, .75];
  const losingRandom = () => lostWager.shift()!;
  const finished = requestCashOut(ready);
  assert.equal(finished.phase, 'finished');
  assert.match(settlementReport(finished), /Final gold: 5 gp\nNet: 0 gp$/);

  const pending = beginSpin(ready, 5, () => 0);
  const queued = requestCashOut(pending);
  assert.equal(queued.phase, 'spinning');
  assert.equal(requestCashOut(queued), queued);
  const paid = settleSpin(queued);
  assert.equal(paid.phase, 'finished');
  assert.match(settlementReport(paid), /Starting gold: 5 gp\nFinal gold: 20 gp\nNet: \+15 gp$/);

  const breakEven = [0, .25, .5];
  const pair = settleSpin(beginSpin(ready, 5, () => breakEven.shift()!));
  assert.equal(pair.balance, 5);
  assert.equal(pair.phase, 'ready');

  const broke = settleSpin(beginSpin(ready, 5, losingRandom));
  assert.equal(broke.phase, 'finished');
  assert.match(settlementReport(broke), /Final gold: 0 gp\nNet: −5 gp$/);
});

test('the persisted committed spin and report survive interruption without a second debit or award', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  assert.equal(readSession(storage), null);
  const committed = requestCashOut(beginSpin(openSession(7)!, 5, () => 0));
  writeSession(storage, committed);
  const recovered = readSession(storage)!;
  assert.deepEqual(recovered, committed);
  const finished = settleSpin(recovered);
  assert.equal(finished.balance, 22);
  writeSession(storage, finished);
  const report = readSession(storage)!;
  assert.equal(report.phase, 'finished');
  assert.equal(settleSpin(report), report);
  assert.equal(settlementReport(report), settlementReport(finished));

  assert.throws(() => writeSession({
    ...storage, setItem() { throw new Error('Storage unavailable'); },
  }, openSession(5)), /Storage unavailable/);
  assert.deepEqual(readSession(storage), report);
  writeSession(storage, null);
  assert.equal(readSession(storage), null);

  const invalid = { ...committed, pending: { wager: 5, reels: [0, 0, 8] } } as unknown as SlotSession;
  writeSession(storage, invalid);
  assert.throws(() => readSession(storage), /Invalid Casino Coolio session/);
  assert.ok(data.has(sessionKey));
});
