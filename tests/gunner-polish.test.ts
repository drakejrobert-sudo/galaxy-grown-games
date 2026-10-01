import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGunner, stepGunner, gunnerTargetAt, gunnerFireEvery, gunnerScoreFor,
  GUNNER_SHOT_FEEDBACK_SECONDS, type GunnerAsteroid } from '../src/game/rules.ts';

const rock = (id: number, x: number, hp = 1): GunnerAsteroid => ({ id, x, y: 100, radius: 20, speed: 0, hp, maxHp: hp });
const config = { total: 10, naturalOne: false };

test('target helper preserves tolerance, nearest-center selection and array-order ties without mutation', () => {
  const rocks = [rock(9, 127), rock(1, 73), rock(3, 126)];
  const before = structuredClone(rocks);
  for (const r of rocks) Object.freeze(r);
  Object.freeze(rocks);
  assert.equal(gunnerTargetAt(rocks, 100, 100)?.id, 3);
  assert.equal(gunnerTargetAt(rocks.slice(0, 2), 100, 100)?.id, 9);
  assert.equal(gunnerTargetAt([rocks[0]], 99.999, 100), undefined);
  assert.deepEqual(rocks, before);
  const s = createGunner(); s.spawnIn = 100; s.asteroids = before.slice(0, 2);
  stepGunner(s, config, { aimX: 100, aimY: 100, firing: true }, .01);
  assert.deepEqual(s.asteroids.map(r => r.id), [1]);
});

test('feedback distinguishes misses, armor hits and destruction at original impact coordinates', () => {
  for (const total of [5, 6, 11, 16]) for (const naturalOne of [false, true]) {
    const c = { total, naturalOne };
    const s = createGunner(); s.spawnIn = 100;
    assert.equal(s.shotFeedback, null);
    stepGunner(s, c, { aimX: 100, aimY: 100, firing: true }, .01);
    assert.deepEqual(s.shotFeedback, { outcome: 'miss', x: 100, y: 100, radius: 0, remaining: GUNNER_SHOT_FEEDBACK_SECONDS });
    s.cooldown = 0; s.asteroids = [{ ...rock(1, 110, 2), speed: 100 }];
    stepGunner(s, c, { firing: true }, .01);
    assert.deepEqual(s.shotFeedback, { outcome: 'armor-hit', x: 110, y: 100, radius: 20, remaining: GUNNER_SHOT_FEEDBACK_SECONDS });
    assert.equal(s.asteroids[0].hp, 1); assert.equal(s.asteroids[0].y, 101);
    assert.equal(s.destroyed, 0);
    s.cooldown = 0;
    stepGunner(s, c, { firing: true }, .01);
    assert.equal(s.shotFeedback?.outcome, 'destroyed'); assert.equal(s.shotFeedback?.y, 101);
    assert.equal(s.asteroids.length, 0); assert.equal(s.destroyed, 1); assert.equal(s.shots, 3);
    assert.equal(s.cooldown, gunnerFireEvery(c)); assert.equal(s.beamX, 100); assert.equal(s.beamY, 100);
    assert.equal(gunnerScoreFor(s), 400);
  }
});

test('feedback expires in simulation time, rejected shots do not replace it and terminal state freezes it', () => {
  const s = createGunner(); s.spawnIn = 100;
  stepGunner(s, config, { firing: true }, .01);
  const first = s.shotFeedback;
  stepGunner(s, config, { aimX: 200, aimY: 100, firing: true }, .05);
  assert.equal(s.shotFeedback, first); assert.equal(s.shots, 1); assert.equal(first?.x, 240);
  assert.ok(Math.abs(first!.remaining - .13) < 1e-12);
  for (let i = 0; i < 3; i++) stepGunner(s, config, { firing: false }, .05);
  assert.equal(s.shotFeedback, null);
  s.cooldown = 0; s.elapsed = 59.99;
  stepGunner(s, config, { firing: true }, .05);
  assert.equal(s.finished, true);
  const terminal = structuredClone(s);
  stepGunner(s, config, { firing: true }, .05);
  assert.deepEqual(s, terminal); assert.equal(createGunner().shotFeedback, null);
});

test('feedback and target inspection consume no randomness; spawning retains its seven draws', () => {
  const s = createGunner(); s.spawnIn = 100; s.asteroids = [rock(1, 240)];
  let calls = 0;
  const random = () => { calls++; return .5; };
  gunnerTargetAt(s.asteroids, 240, 100);
  stepGunner(s, config, { aimX: 240, aimY: 100, firing: true }, .01, random);
  assert.equal(calls, 0);
  s.spawnIn = 0;
  stepGunner(s, config, { firing: false }, .01, random);
  assert.equal(calls, 7); assert.equal(s.asteroids.length, 1);
});
