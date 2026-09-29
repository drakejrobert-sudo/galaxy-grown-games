import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpaceGunner, stepSpaceGunner, spaceGunnerFireEvery, spaceGunnerScoreFor,
  spaceGunnerResultText, SPACE_GUNNER_TUNING, difficultyFor, rateScore,
  type SpaceGunnerAttacker, type SpaceGunnerProjectile, type SpaceGunnerInput,
} from '../src/game/rules.ts';
const config = { total: 10, naturalOne: false };
const idle: SpaceGunnerInput = { x: 0, y: 0, firing: false };
const fire = { ...idle, firing: true, aimX: 240, aimY: 280 };
const attacker = (id = 1, x = 240, y = 280, hp = 1): SpaceGunnerAttacker =>
  ({ id, x, y, radius: 20, speed: 0, hp, maxHp: hp, fired: true });
const projectile = (id = 2, x = 240, y = 280): SpaceGunnerProjectile =>
  ({ id, x, y, radius: 10, speed: 0 });
function state() { const s = createSpaceGunner(); s.spawnIn = 100; s.nextId = 100; return s; }

test('space gunner spawns at 0.7s with exact band cadence, speeds, and armor chance', () => {
  for (const total of [-10, 5, 6, 10, 11, 15, 16, 30]) for (const naturalOne of [false, true]) {
    const c = { total, naturalOne }, tuning = SPACE_GUNNER_TUNING[difficultyFor(total)];
    assert.equal(spaceGunnerFireEvery(c), tuning.fireEvery * (naturalOne ? 2 : 1));
    const s = createSpaceGunner();
    stepSpaceGunner(s, c, idle, -1, () => 0);
    assert.equal(s.elapsed, 0);
    for (let i = 0; i < 13; i++) stepSpaceGunner(s, c, idle, 1, () => 0);
    assert.equal(s.attackers.length, 0);
    stepSpaceGunner(s, c, idle, 0.05, () => 0);
    assert.equal(s.attackers.length, 1);
    assert.equal(s.attackers[0].x, 20);
    assert.equal(s.attackers[0].y, -24 + tuning.speed * 0.05);
    assert.equal(s.attackers[0].hp, tuning.armoredChance ? 2 : 1);
    assert.ok(Math.abs(s.spawnIn - tuning.spawnEvery) < 1e-8);
    const unarmored = createSpaceGunner(); unarmored.spawnIn = 0;
    stepSpaceGunner(unarmored, c, idle, 0.05, () => 0.99);
    assert.equal(unarmored.attackers[0].hp, 1);
    assert.equal(unarmored.attackers[0].x, 455.6);
  }
});

test('keyboard aim normalizes diagonals and caps speed; direct pointer aim clamps independently of flight', () => {
  for (const [x, y] of [[1, 0], [1, 1], [10, 10]]) {
    const s = state(); stepSpaceGunner(s, config, { ...idle, x, y }, 0.05);
    assert.ok(Math.abs(Math.hypot(s.crosshairX - 240, s.crosshairY - 280) - 11.25) < 1e-8);
  }
  const s = state(); stepSpaceGunner(s, config, { ...idle, aimX: -20, aimY: 999 }, 0.05);
  assert.deepEqual([s.crosshairX, s.crosshairY], [12, 484]);
  stepSpaceGunner(s, config, idle, 0.05); assert.deepEqual([s.crosshairX, s.crosshairY], [12, 484]);
  stepSpaceGunner(s, config, { ...idle, aimX: 999, aimY: -20 }, 0.05);
  assert.deepEqual([s.crosshairX, s.crosshairY], [468, 18]);
});

test('attackers emit exactly one projectile at 180; emitted shots wait a step and survive source destruction', () => {
  const s = state(); const a = attacker(1, 240, 179); a.speed = 20; a.fired = false; s.attackers = [a];
  stepSpaceGunner(s, config, idle, 0.05);
  assert.equal(a.fired, true); assert.equal(s.projectiles.length, 1);
  assert.equal(s.projectiles[0].y, 206);
  stepSpaceGunner(s, config, idle, 0);
  assert.equal(s.projectiles.length, 1, 'a surviving attacker never fires twice');
  stepSpaceGunner(s, config, { ...fire, aimY: 180 }, 0.05);
  assert.equal(s.attackers.length, 0); assert.equal(s.projectiles.length, 1);
  assert.equal(s.projectiles[0].y, 215);
  stepSpaceGunner(s, config, idle, 0.05); assert.equal(s.projectiles.length, 1);
});

test('one immediate turret shot chooses nearest center, then projectile, then lowest ID', () => {
  const s = state(); s.attackers = [attacker(9), attacker(1)]; s.projectiles = [projectile(8), projectile(3)];
  stepSpaceGunner(s, config, fire, 0.05);
  assert.deepEqual(s.projectiles.map(p => p.id), [8]);
  assert.equal(s.attackers.length, 2); assert.equal(s.intercepted, 1);
  s.cooldown = 0; s.projectiles = []; stepSpaceGunner(s, config, fire, 0.05);
  assert.deepEqual(s.attackers.map(a => a.id), [9]);
  const nearest = state(); nearest.attackers = [attacker(1)]; nearest.projectiles = [projectile(2, 245)];
  stepSpaceGunner(nearest, config, fire, 0.05);
  assert.equal(nearest.destroyed, 1); assert.equal(nearest.intercepted, 0);
});

test('armor requires two shots; armor damage and misses award no points; target tolerance is inclusive', () => {
  const s = state(); s.attackers = [attacker(1, 267, 280, 2)];
  stepSpaceGunner(s, config, fire, 0);
  assert.equal(s.attackers[0].hp, 1); assert.equal(s.destroyed, 0);
  assert.equal(spaceGunnerScoreFor(s), 300);
  stepSpaceGunner(s, config, fire, 0); assert.equal(s.shots, 1);
  s.cooldown = 0; stepSpaceGunner(s, config, fire, 0);
  assert.equal(s.destroyed, 1); assert.equal(s.attackers.length, 0);
  s.cooldown = 0; stepSpaceGunner(s, config, fire, 0);
  assert.equal(s.destroyed, 1); assert.equal(s.shots, 3); assert.equal(s.cooldown, 0.36);
  const miss = state(); miss.attackers = [attacker(1, 267.01)];
  stepSpaceGunner(miss, config, fire, 0); assert.equal(miss.destroyed, 0);
});

test('player hit precedes same-step enemy firing and defense-line breach', () => {
  const firing = state(); firing.attackers = [attacker(1, 240, 179)]; firing.attackers[0].speed = 40; firing.attackers[0].fired = false;
  stepSpaceGunner(firing, config, { ...fire, aimY: 179 }, 0.05);
  assert.equal(firing.projectiles.length, 0); assert.equal(firing.destroyed, 1);
  const crossing = state(); crossing.projectiles = [projectile(1, 240, 481)]; crossing.projectiles[0].speed = 40;
  stepSpaceGunner(crossing, config, { ...fire, aimY: 481 }, 0.05);
  assert.equal(crossing.hull, 3); assert.equal(crossing.intercepted, 1); assert.equal(crossing.breached, 0);
});

test('simultaneous breaches lose one hull; every crossing clears during grace and later damage resumes', () => {
  const s = state(); const a = attacker(1, 240, 472); a.fired = true;
  s.attackers = [a]; s.projectiles = [projectile(2, 240, 482), projectile(3, 200, 482)];
  stepSpaceGunner(s, config, idle, 0.05);
  assert.equal(s.hull, 2); assert.equal(s.impacts, 1); assert.equal(s.breached, 3); assert.equal(s.grace, 1.25);
  assert.equal(s.attackers.length + s.projectiles.length, 0);
  s.projectiles = [projectile(4, 240, 482)]; stepSpaceGunner(s, config, idle, 0.05);
  assert.equal(s.hull, 2); assert.equal(s.breached, 4); assert.equal(s.intercepted, 0);
  for (let i = 0; i < 25; i++) stepSpaceGunner(s, config, idle, 0.05);
  s.projectiles = [projectile(5, 240, 482)]; stepSpaceGunner(s, config, idle, 0.05);
  assert.equal(s.hull, 1); assert.equal(s.impacts, 2);
});

test('60-second end clamps elapsed; hull depletion wins a tie and terminal state cannot mutate', () => {
  for (const fails of [false, true]) {
    const s = state(); s.elapsed = 59.99;
    if (fails) { s.hull = 1; s.projectiles = [projectile(1, 240, 482)]; }
    stepSpaceGunner(s, config, idle, 0.05);
    assert.equal(s.elapsed, 60); assert.equal(s.finished, true); assert.equal(s.endReason, fails ? 'hull' : 'time');
    const snapshot = structuredClone(s); stepSpaceGunner(s, config, fire, 0.05, () => { throw Error('terminal random'); });
    assert.deepEqual(s, snapshot);
  }
});

test('space gunner fractional scoring and complete manual reports preserve failure caps', () => {
  const s = state(); s.elapsed = 10.4; s.destroyed = 2; s.intercepted = 3; s.shots = 8;
  assert.equal(spaceGunnerScoreFor(s), 627);
  const report = spaceGunnerResultText({ total: -5, naturalOne: true }, s);
  for (const pattern of [/Space Battle \/ Gunner/, /Check total: -5.*Hard/, /half normal fire rate/,
    /Attackers destroyed: 2/, /Projectiles intercepted: 3.*Shots fired: 8/, /Damaging hits: 0.*Breached threats: 0/,
    /Provisional v0.5/, /GM determines campaign outcome/]) assert.match(report, pattern);
  assert.deepEqual(rateScore('space-gunner', 6000, true), { rating: 100, band: 'Success', capped: true });
  assert.equal(rateScore('space-gunner', 37, false).rating, 0);
  assert.equal(rateScore('space-gunner', 5000, false).rating, 100);
});

test('Natural 1 halves sustained firing for each band, with no banked cooldown attempts', () => {
  for (const total of [5, 10, 15, 16]) {
    const normal = state(), impaired = state();
    for (let i = 0; i < 400; i++) {
      stepSpaceGunner(normal, { total, naturalOne: false }, fire, 0.05);
      stepSpaceGunner(impaired, { total, naturalOne: true }, fire, 0.05);
    }
    assert.ok(Math.abs(normal.shots - 2 * impaired.shots) <= 2);
  }
  const s = state(); s.cooldown = 0.1;
  stepSpaceGunner(s, config, fire, 0.05); stepSpaceGunner(s, config, idle, 0.05);
  assert.equal(s.shots, 0);
});
