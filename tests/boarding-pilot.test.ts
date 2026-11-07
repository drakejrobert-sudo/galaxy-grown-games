import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARDING_TUNING, boardingPilotResultText, boardingPilotScore, createBoardingPilot,
  difficultyFor, rateScore, stepBoardingPilot,
} from '../src/game/rules.ts';

const config = { total: 10, naturalOne: false };
const idle = { x: 0, y: 0 };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} vs ${expected}`);

test('rings use position at crossing, include the opening edge, and resolve only once', () => {
  const s = createBoardingPilot(config);
  const ring = s.rings[0];
  s.elapsed = 3.98;
  s.x = ring.x + ring.radius - BOARDING_TUNING.Medium.moveSpeed * .02;
  stepBoardingPilot(s, config, { x: 1, y: 0 }, .05);
  assert.ok(s.x > ring.x + ring.radius);
  assert.equal(s.cleared, 1);
  assert.equal(boardingPilotScore(s), 100);
  stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.cleared, 1);
  assert.equal(s.rings.length, 19);
});

test('the third total miss ends at the ring plane, including misses separated by a clear', () => {
  const s = createBoardingPilot(config);
  s.misses = 2;
  s.elapsed = 3.99;
  stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.cleared, 1);
  assert.equal(s.misses, 2);
  s.elapsed = 7.99;
  stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.misses, 3);
  assert.equal(s.endReason, 'misses');
  near(s.elapsed, 8);
  const ended = structuredClone(s);
  stepBoardingPilot(s, config, { x: 1, y: 1 }, .05);
  assert.deepEqual(s, ended);
  assert.match(boardingPilotResultText(config, s), /Miss limit reached/);
  assert.deepEqual(rateScore('boarding-pilot', 1650, true), { rating: 100, band: 'Success', capped: true });
});

test('swept debris contacts damage once with grace, and hull failure wins an exact repair tie', () => {
  const s = createBoardingPilot(config);
  s.elapsed = 9.95;
  const rock = { x: s.x, y: s.y, radius: 24, time: 10.2, kind: 'asteroid' as const };
  s.debris = [rock, { ...rock, kind: 'junk' }];
  stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.hull, 2);
  assert.equal(s.debris.length, 0);
  near(s.protectedUntil, 10.2 - 36 / 150 + 1.25);

  s.elapsed = 21.99;
  s.hull = 1;
  s.rings = [{ x: s.x, y: s.y, radius: 31, time: 22, kind: 'repair' }];
  s.debris = [{ ...rock, x: s.x + 36, time: 22 }];
  stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.endReason, 'hull');
  near(s.elapsed, 22);
  assert.equal(s.repairs, 0);
  assert.equal(s.rings.length, 1);
  assert.match(boardingPilotResultText(config, s), /Hull depleted/);
});

test('repair rings cap hull at three, and the final ring resolves before time completion', () => {
  const s = createBoardingPilot(config);
  const repair = s.rings.find(r => r.kind === 'repair')!;
  s.rings = [repair, s.rings.at(-1)!];
  Object.assign(s, { elapsed: repair.time - .01, x: repair.x, y: repair.y });
  stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.hull, 3);
  assert.equal(s.repairs, 0);
  assert.equal(boardingPilotScore(s), 0);
  Object.assign(s, { elapsed: 59.99, x: 240, y: 280 });
  stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.cleared, 1);
  assert.equal(s.elapsed, 60);
  assert.equal(s.endReason, 'complete');
});

test('all bands and Natural 1 can clear the safe course or every detour at 60Hz, 30Hz and 50ms', () => {
  for (const total of [5, 10, 15, 16]) for (const naturalOne of [false, true]) {
    const cfg = { total, naturalOne };
    const speed = BOARDING_TUNING[difficultyFor(total)].moveSpeed * (naturalOne ? .6 : 1);
    for (const dt of [1 / 60, 1 / 30, .05]) for (const detours of [false, true]) {
      const s = createBoardingPilot(cfg);
      if (detours) s.hull = 1;
      while (!s.endReason) {
        const next = s.rings.find(r => detours || r.kind === 'required')!;
        const time = Math.max(next.time - s.elapsed, dt);
        const input = { x: (next.x - s.x) / (time * speed), y: (next.y - s.y) / (time * speed) };
        assert.ok(Math.hypot(input.x, input.y) <= 1, `unreachable ring at ${next.time}`);
        stepBoardingPilot(s, cfg, input, dt);
      }
      assert.equal(s.endReason, 'complete');
      assert.deepEqual([s.elapsed, s.cleared, s.misses, s.bonuses, s.repairs, s.hull],
        [60, 15, 0, detours ? 3 : 0, detours ? 2 : 0, 3]);
      assert.equal(boardingPilotScore(s), detours ? 1650 : 1500);
    }
    const normal = createBoardingPilot({ ...cfg, naturalOne: false });
    const impaired = createBoardingPilot({ ...cfg, naturalOne: true });
    stepBoardingPilot(normal, { ...cfg, naturalOne: false }, { x: 1, y: -1 }, .05);
    stepBoardingPilot(impaired, { ...cfg, naturalOne: true }, { x: 1, y: -1 }, .05);
    near(Math.hypot(normal.x - 240, normal.y - 280), BOARDING_TUNING[difficultyFor(total)].moveSpeed * .05);
    near(Math.hypot(impaired.x - 240, impaired.y - 280), Math.hypot(normal.x - 240, normal.y - 280) * .6);
    assert.equal(normal.elapsed, impaired.elapsed);
  }
});
