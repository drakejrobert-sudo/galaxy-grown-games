import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARDING_TUNING, boardingPilotAttackPosition, boardingPilotResultText, boardingPilotScore, createBoardingPilot,
  difficultyFor, rateScore, stepBoardingPilot,
} from '../src/game/rules.ts';

const config = { total: 10, naturalOne: false };
const idle = { x: 0, y: 0 };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} vs ${expected}`);

function seeded(seed: number) {
  return () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32);
}

type Course = ReturnType<typeof createBoardingPilot>;
function directHazards(s: Course) {
  const gates = s.rings.filter(r => r.kind === 'required');
  return gates.slice(1).flatMap((to, i) => {
    const from = gates[i];
    const dx = to.x - from.x, dy = to.y - from.y;
    const rock = s.debris.find(rock => {
      const fraction = (rock.time - from.time) / (to.time - from.time);
      return fraction > 0 && fraction < 1 &&
        Math.hypot(rock.x - from.x - dx * fraction, rock.y - from.y - dy * fraction) < 1e-8;
    });
    if (!rock) return [];
    const offset = (i % 2 ? -66 : 66) / Math.hypot(dx, dy);
    return [{ from, to, rock, dodge: { time: rock.time, x: rock.x - dy * offset, y: rock.y + dx * offset } }];
  });
}

test('seeded hazards vary, preserve the authored detours and leave a flyable dodge around direct hazards', () => {
  const first = createBoardingPilot(config, seeded(12));
  assert.deepEqual(first, createBoardingPilot(config, seeded(12)));
  assert.notDeepEqual(first.debris.slice(10), createBoardingPilot(config, seeded(44)).debris.slice(10));
  for (const [total, count] of [[5, 7], [10, 6], [15, 5], [16, 4]]) {
    for (let seed = 1; seed <= 24; seed++) {
      const cfg = { total, naturalOne: true };
      const s = createBoardingPilot(cfg, seeded(seed));
      assert.deepEqual(s.debris.slice(0, 10), first.debris.slice(0, 10));
      assert.ok(s.debris.length >= 10 + count + 5 && s.debris.length <= 10 + count + 7);
      const threats = directHazards(s);
      assert.equal(threats.length, count);
      assert.ok(threats.some(({ rock }) => rock.time < 30));
      assert.ok(threats.some(({ rock }) => rock.time > 30));
      for (const rock of s.debris.slice(10)) {
        assert.ok(rock.time > 4 && rock.time < 58);
        assert.ok(s.debris.every(other => other === rock || Math.abs(other.time - rock.time) >= .7));
        assert.ok(s.rings.every(ring => Math.abs(rock.time - ring.time) >= .5));
      }
    }
  }
});

test('taking the direct line between gates hits a generated hazard', () => {
  const cfg = { total: 5, naturalOne: true };
  const s = createBoardingPilot(cfg, seeded(78));
  const { from, to, rock } = directHazards(s)[0];
  Object.assign(s, { x: from.x, y: from.y, elapsed: from.time, rings: [to] });
  const distance = (to.time - from.time) * BOARDING_TUNING.Hard.moveSpeed * .6;
  const straight = { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
  while (s.elapsed < rock.time) stepBoardingPilot(s, cfg, straight, .05);
  assert.equal(s.hull, 2);
  assert.match(s.feedback?.text ?? '', /IMPACT/);
});

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

test('three missed gates each launch one dodgeable attack, including a miss at the final gate', () => {
  const cfg = { total: 5, naturalOne: true };
  for (const dt of [1 / 60, 1 / 30, .05]) {
    const s = createBoardingPilot(cfg);
    const gates = s.rings.filter(ring => ring.kind === 'required');
    s.rings = [gates[0], gates[1], gates.at(-1)!];
    s.debris = [];
    for (const [index, ring] of [...s.rings].entries()) {
      Object.assign(s, { x: 22, y: 22, elapsed: ring.time - .02 });
      while (s.elapsed < ring.time) stepBoardingPilot(s, cfg, idle, dt);
      const attack = s.attack!;
      assert.equal(s.misses, index + 1);
      assert.equal(attack.kind, index % 2 ? 'probe' : 'missile');
      near(attack.launchAt, ring.time + .35);
      near(attack.time, ring.time + 1);
      assert.deepEqual(boardingPilotAttackPosition(attack, attack.time), { x: 22, y: 22, z: 0 });
      assert.equal(s.hull, 3);
      while (s.attack) stepBoardingPilot(s, cfg, { x: 0, y: 1 }, dt);
      assert.equal(s.hull, 3);
      assert.equal(s.endReason, null);
    }
    while (!s.endReason) stepBoardingPilot(s, cfg, idle, dt);
    assert.equal(s.endReason, 'complete');
    assert.match(boardingPilotResultText(cfg, s), /Misses: 3 •/);
  }
});

test('missiles and probes hit a stationary pilot after the warning and respect collision grace', () => {
  for (const kind of ['missile', 'probe']) for (const dt of [1 / 60, 1 / 30, .05]) {
    const s = createBoardingPilot(config);
    Object.assign(s, { x: 440, elapsed: 3.99, misses: kind === 'probe' ? 1 : 0 });
    stepBoardingPilot(s, config, idle, dt);
    const attack = s.attack!;
    assert.equal(attack.kind, kind);
    const guarded = structuredClone(s);
    guarded.protectedUntil = attack.time + .2;
    while (s.elapsed < attack.launchAt) {
      stepBoardingPilot(s, config, idle, dt);
      assert.equal(s.hull, 3);
    }
    while (s.attack) stepBoardingPilot(s, config, idle, dt);
    while (guarded.attack) stepBoardingPilot(guarded, config, idle, dt);
    assert.equal(s.hull, 2);
    assert.equal(guarded.hull, 3);
    assert.equal(s.feedback?.text, kind.toUpperCase() + ' IMPACT');
    assert.ok(s.elapsed < attack.time);
  }
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
  const ended = structuredClone(s);
  stepBoardingPilot(s, config, { x: 1, y: 1 }, .05);
  assert.deepEqual(s, ended);
  assert.deepEqual(rateScore('boarding-pilot', 1650, true), { rating: 100, band: 'Success', capped: true });
});

test('repair rings cap hull at three, and clearing the final gate leaves time to escape', () => {
  const s = createBoardingPilot(config);
  const repair = s.rings.find(r => r.kind === 'repair')!;
  s.rings = [repair, s.rings.at(-1)!];
  Object.assign(s, { elapsed: repair.time - .01, x: repair.x, y: repair.y });
  stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.hull, 3);
  assert.equal(s.repairs, 0);
  assert.equal(boardingPilotScore(s), 0);
  Object.assign(s, { elapsed: 57.99, x: 240, y: 280 });
  stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.cleared, 1);
  assert.equal(s.endReason, null);
  while (!s.endReason) stepBoardingPilot(s, config, idle, .05);
  assert.equal(s.elapsed, 60);
  assert.equal(s.endReason, 'complete');
});

test('all bands and Natural 1 can dodge debris and clear every gate at 60Hz, 30Hz and 50ms', () => {
  for (const total of [5, 10, 15, 16]) for (const naturalOne of [false, true]) {
    const cfg = { total, naturalOne };
    const speed = BOARDING_TUNING[difficultyFor(total)].moveSpeed * (naturalOne ? .6 : 1);
    for (const dt of [1 / 60, 1 / 30, .05]) for (const detours of [false, true]) for (const seed of [9, 17, 91]) {
      const s = createBoardingPilot(cfg, seeded(seed));
      const route = [
        ...s.rings.filter(r => detours || r.kind === 'required'),
        ...directHazards(s).map(({ dodge }) => dodge),
      ].sort((a, b) => a.time - b.time);
      if (detours) s.hull = 1;
      while (!s.endReason) {
        const next = route.find(r => r.time > s.elapsed + 1e-9);
        if (!next) {
          stepBoardingPilot(s, cfg, idle, dt);
          continue;
        }
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
