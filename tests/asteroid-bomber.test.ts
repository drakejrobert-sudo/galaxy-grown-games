import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBomber, stepBomber, spaceBomberLanding, mineDropPosition, bomberBlastRadius,
  automaticShipX, type BomberState } from '../src/game/rules.ts';
const config = { total: 10, naturalOne: false }, idle = { placing: false };
function quiet() { const s = createBomber(); s.spawnIn = 100; return s; }
function advance(s: BomberState, seconds: number) {
  while (seconds > 1e-9) { const dt = Math.min(.01, seconds); stepBomber(s, config, idle, dt); seconds -= dt; }
}
for (const naturalOne of [false, true]) for (const distance of [0, 25, 50, 100]) {
  test(`asteroid landing ${distance}px, Natural 1 ${naturalOne}`, () => {
    const s = quiet(), rack = mineDropPosition(s);
    stepBomber(s, { ...config, naturalOne }, { placing: true, launch: { x: rack.x, y: rack.y + distance } }, .01);
    const mine = s.mines[0];
    assert.equal(mine.x, rack.x); assert.equal(mine.y, rack.y + Math.min(distance, 5));
    assert.equal(mine.expiresIn, 4.99); assert.equal(s.cooldown, .65);
    assert.equal(mine.blastRadius, bomberBlastRadius({ ...config, naturalOne }));
    advance(s, .25);
    assert.equal(mine.y, rack.y + distance); assert.equal(mine.flight, undefined); assert.equal(mine.armIn, 0);
    const landing = { x: mine.x, y: mine.y };
    advance(s, 1); assert.deepEqual({ x: mine.x, y: mine.y }, landing);
    assert.equal(s.x, automaticShipX(s.elapsed));
    advance(s, 3.8); assert.equal(s.mines.length, 0);
  });
}
test('asteroid rear targeting clamps range, retains distance and rejects forward release', () => {
  const s = quiet(), rack = mineDropPosition(s);
  stepBomber(s, config, { placing: false, aim: { x: rack.x + 400, y: rack.y } }, .01);
  assert.equal(s.aimDistance, 100); assert.equal(s.aimAngle, 0);
  stepBomber(s, config, { placing: false, turn: -1 }, .05); assert.equal(s.aimAngle, 0);
  s.aimDistance = 25;
  stepBomber(s, config, { placing: false, straight: true }, .01);
  assert.equal(s.aimAngle, Math.PI / 2); assert.equal(s.aimDistance, 25);
  stepBomber(s, config, { placing: true, launch: { x: s.x, y: s.y } }, .01);
  assert.equal(s.minesPlaced, 0);
  stepBomber(s, config, { placing: false, turn: 1 }, .05);
  assert.ok(Math.abs(s.aimAngle - (Math.PI / 2 + Math.PI / 30)) < 1e-9);
  stepBomber(s, config, { placing: true }, .01);
  stepBomber(s, config, { placing: true }, .01);
  advance(s, .8); assert.equal(s.minesPlaced, 1);
  const snapshot = JSON.stringify(s); stepBomber(s, config, { placing: true, turn: 1 }, 0);
  assert.equal(JSON.stringify(s), snapshot);
  const reset = quiet(); assert.equal(reset.aimDistance, 100); assert.equal(reset.aimAngle, Math.PI / 2);
  assert.equal(spaceBomberLanding(reset).y, reset.y + 134);
});
test('asteroid release-frame sweep hits during travel at actual impact with exact splash and no double score', () => {
  const s = quiet();
  // Mine starts at y139, moves down 25px; asteroid moves up from y180 at 500px/s.
  // Relative gap closes to the 18px contact radius at t=.023, mine y150.5.
  s.asteroids = [{ id: 90, x: 240, y: 180, radius: 10, speed: 500 },
    { id: 91, x: 306, y: 150.5, radius: 1, speed: 0 },
    { id: 92, x: 306.01, y: 150.5, radius: 1, speed: 0 }];
  stepBomber(s, config, { placing: true }, .05);
  assert.equal(s.destroyed, 2); assert.equal(s.hull, 3); assert.equal(s.mines.length, 0);
  assert.ok(Math.abs(s.explosions[0].y - 150.5) < 1e-9);
  assert.deepEqual(s.asteroids.map(a => a.id), [92]);
  advance(s, .1); assert.equal(s.destroyed, 2);
});
test('asteroid stationary rack mine protects hull on launch frame and expires without late contact', () => {
  const s = quiet(), rack = mineDropPosition(s);
  s.asteroids = [{ id: 90, x: rack.x, y: rack.y, radius: 15, speed: 500 }];
  stepBomber(s, config, { placing: true, launch: rack }, .05);
  assert.equal(s.destroyed, 1); assert.equal(s.hull, 3);
  const expired = quiet();
  expired.mines = [{ id: 1, x: 240, y: 200, blastRadius: 66, armIn: 0, expiresIn: .01 }];
  expired.asteroids = [{ id: 90, x: 240, y: 240, radius: 10, speed: 500 }];
  stepBomber(expired, config, idle, .05); assert.equal(expired.destroyed, 0); assert.equal(expired.mines.length, 0);
});
test('asteroid sweeps include lateral drift and hull tunnelling', () => {
  const s = quiet();
  s.mines = [{ id: 1, x: 240, y: 300, blastRadius: 66, armIn: 0, expiresIn: 5 }];
  s.asteroids = [{ id: 90, x: 200, y: 300, radius: 10, speed: 0, vx: 1600 }];
  stepBomber(s, config, idle, .05);
  assert.equal(s.destroyed, 1); assert.equal(s.explosions[0].x, 240);
  const hit = quiet();
  hit.asteroids = [{ id: 90, x: 240, y: 150, radius: 10, speed: 1800 }];
  stepBomber(hit, config, idle, .05); assert.equal(hit.hull, 2); assert.equal(hit.impacts, 1);
});
test('a detonated mine and overlapping asteroids score only once', () => {
  const s = quiet();
  s.mines = [1, 2].map(id => ({ id, x: 240, y: 300, blastRadius: 66, armIn: 0, expiresIn: 5 }));
  s.asteroids = [90, 91].map(id => ({ id, x: 240, y: 300, radius: 10, speed: 0 }));
  stepBomber(s, config, idle, .05);
  assert.equal(s.destroyed, 2); assert.equal(s.explosions.length, 1); assert.equal(s.mines.length, 1);
  advance(s, .1); assert.equal(s.destroyed, 2);
});
