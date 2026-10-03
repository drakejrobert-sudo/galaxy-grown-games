import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as rules from '../src/game/rules.ts';

const modes = [
  ['Asteroid Field', 'Pilot', 'flight', 'createFlight', 'stepFlight', 'onFlightStep'],
  ['Asteroid Field', 'Gunner', 'gunner', 'createGunner', 'stepGunner', 'onGunnerStep'],
  ['Asteroid Field', 'Bomber', 'bomber', 'createBomber', 'stepBomber', 'onBomberStep'],
  ['Asteroid Field', 'Life Support', 'lifeSupport', 'createLifeSupport', 'stepLifeSupport', 'onLifeSupportStep'],
  ['Space Battle', 'Pilot', 'spacePilot', 'createSpaceBattlePilot', 'stepSpaceBattlePilot', 'onSpacePilotStep'],
  ['Space Battle', 'Gunner', 'spaceGunner', 'createSpaceGunner', 'stepSpaceGunner', 'onSpaceGunnerStep'],
  ['Space Battle', 'Bomber', 'spaceBomber', 'createSpaceBattleBomber', 'stepSpaceBattleBomber', 'onSpaceBomberStep'],
  ['Space Battle', 'Life Support', 'spaceLife', 'createSpaceLifeSupport', 'stepSpaceLifeSupport', 'onSpaceLifeStep'],
] as const;
function random() {
  let seed = 42, draws = 0;
  return { next() { draws++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; },
    get draws() { return draws; }, get seed() { return seed; } };
}
function harness(mode: (typeof modes)[number] = modes[0], config = { total: 10, naturalOne: false }) {
  const rng = random(), calls: number[] = [], exports: any = {};
  const instrumented: any = { ...rules };
  for (const [, , , , step] of modes) instrumented[step] = (state: any, config: any, input: any, dt: number) => {
    calls.push(dt); (rules[step] as Function)(state, config, input, dt, rng.next);
  };
  const js = ts.transpileModule(readFileSync(new URL('../src/game/scene.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(js, { exports, require: (name: string) => name === 'phaser' ? { Scene: class {} } : instrumented });
  const scene = new exports.FlightScene();
  scene.game = { loop: { rawDelta: 0 } };
  scene.add = { graphics: () => new Proxy({}, { get: () => () => {} }) };
  scene.create();
  let paints = 0, hud = 0, reads = 0, interruptions = 0;
  scene.paint = () => paints++;
  scene[mode[5]] = () => hud++;
  const first = { x: 1, y: 0, firing: true, placing: true, route: 'Shields', jump: true, turn: 1 };
  const continued = { ...first, placing: mode[2] === 'spaceBomber' ? false : true, jump: false };
  const readFrame = () => { reads++; return { first, continued }; };
  scene.readInput = () => { reads++; return { x: 1, y: 0 }; };
  scene.readLifeSupportInput = () => { reads++; return { route: 'Shields' }; };
  for (const key of ['Gunner', 'SpaceGunner', 'Bomber', 'SpaceBomber', 'SpaceLife']) scene[`read${key}Frame`] = readFrame;
  scene.onTimingInterruption = () => interruptions++;
  scene.begin(config, mode[0], mode[1]);
  return { scene, rng, calls, first, continued,
    tick(raw: number, delivered = 16.67) { scene.game.loop.rawDelta = raw; scene.update(0, delivered); },
    get paints() { return paints; }, get hud() { return hud; }, get reads() { return reads; },
    get interruptions() { return interruptions; } };
}

for (const mode of modes) test(`${mode[0]} / ${mode[1]}: raw time, state and RNG match direct bounded rules across bands and Natural 1`, () => {
  for (const total of [5, 10, 15, 16]) for (const naturalOne of [false, true]) for (const raw of [16.67, 33.33, 50, 100, 250]) {
    const config = { total, naturalOne }, h = harness(mode, config), baseline = (rules[mode[3]] as Function)(), rng = random();
    h.tick(1000); // Startup interval is excluded, including a pre-launch stall.
    assert.equal(h.reads, 0); assert.equal(h.interruptions, 0);
    for (let frame = 0; frame < Math.ceil(6000 / raw) && !baseline.finished; frame++) {
      const before = h.calls.length, hud = h.hud, paints = h.paints, reads = h.reads;
      h.tick(raw, 1); // Delivered delta deliberately disagrees with raw time.
      for (let index = 0; index < Math.ceil(raw / 50) && !baseline.finished; index++) {
        const input = mode[1] === 'Pilot' ? { x: 1, y: 0 }
          : mode[2] === 'lifeSupport' ? { route: 'Shields' } : index === 0 ? h.first : h.continued;
        (rules[mode[4]] as Function)(baseline, config, input, Math.min(50, raw - index * 50) / 1000, rng.next);
      }
      assert.deepEqual(h.scene[mode[2]], baseline);
      assert.equal(h.rng.seed, rng.seed); assert.equal(h.rng.draws, rng.draws);
      assert.ok(h.calls.length - before <= 5); assert.ok(h.calls.slice(before).every(dt => dt > 0 && dt <= .05));
      assert.equal(h.reads - reads, mode[1] === 'Pilot' ? h.calls.length - before : 1);
      assert.equal(h.hud - hud, 1); assert.equal(h.paints - paints, 1);
    }
  }
});

test('250 ms advances fully; longer gaps pause without rule, input, HUD or RNG work; resume re-primes', () => {
  for (const mode of modes) {
    const h = harness(mode); h.tick(16); h.tick(250);
    assert.ok(Math.abs(h.scene[mode[2]].elapsed - .25) < 1e-12);
    assert.equal(h.calls.length, 5);
    const state = structuredClone(h.scene[mode[2]]), reads = h.reads, draws = h.rng.draws, hud = h.hud;
    h.tick(250.001);
    assert.deepEqual(h.scene[mode[2]], state); assert.equal(h.reads, reads); assert.equal(h.rng.draws, draws);
    assert.equal(h.hud, hud); assert.equal(h.interruptions, 1); assert.equal(h.scene.activeFlight, false);
    h.tick(5000); assert.equal(h.interruptions, 1);
    h.scene.activeFlight = true; h.tick(5000);
    assert.deepEqual(h.scene[mode[2]], state); assert.equal(h.reads, reads);
    h.tick(100); assert.ok(Math.abs(h.scene[mode[2]].elapsed - .35) < 1e-12);
    for (const invalid of [0, -1, NaN, Infinity]) h.tick(invalid);
    assert.ok(Math.abs(h.scene[mode[2]].elapsed - .35) < 1e-12);
    h.scene.begin({ total: 10, naturalOne: false }, mode[0], mode[1]); h.tick(1000);
    assert.equal(h.scene[mode[2]].elapsed, 0);
  }
});

test('terminal state stops remaining catch-up steps and publishes exactly one result', () => {
  for (const mode of modes) {
    const h = harness(mode); h.tick(16); h.scene[mode[2]].elapsed = 59.99;
    h.tick(250); assert.equal(h.scene[mode[2]].elapsed, 60); assert.equal(h.scene.activeFlight, false);
    assert.equal(h.calls.length, 1); assert.equal(h.hud, 1);
    const state = structuredClone(h.scene[mode[2]]), draws = h.rng.draws, reads = h.reads;
    h.tick(250); assert.deepEqual(h.scene[mode[2]], state); assert.equal(h.rng.draws, draws);
    assert.equal(h.reads, reads); assert.equal(h.hud, 1);
  }
});

test('rejected quick shots are not banked until a later catch-up step, while held fire can shoot', () => {
  for (const mode of [modes[1], modes[5]]) for (const held of [false, true]) {
    const h = harness(mode); h.tick(16);
    h.scene[mode[2]].cooldown = .075;
    h.continued.firing = held; h.tick(100);
    assert.equal(h.scene[mode[2]].shots, held ? 1 : 0);
  }
});

test('Pilot touch direction is recalculated from each substep position', () => {
  for (const mode of [modes[0], modes[4]]) {
    const h = harness(mode), positions: number[] = []; h.tick(16);
    const destination = h.scene[mode[2]].x + 20;
    h.scene.readInput = (x: number) => { positions.push(x); return { x: Math.abs(destination - x) < 5 ? 0 : Math.sign(destination - x), y: 0 }; };
    h.tick(250); assert.equal(positions.length, 5);
    assert.ok(positions.some(x => x !== positions[0]));
    assert.ok(Math.abs(h.scene[mode[2]].x - destination) < 5);
  }
});

test('Space Bomber release uses the displayed rack once and a rejected launch never repeats', () => {
  for (const cooldown of [0, .075]) {
    const h = harness(modes[6]); h.tick(16);
    h.scene.spaceBomber.mineCooldown = cooldown;
    const rack = rules.mineDropPosition(h.scene.spaceBomber);
    h.first.turn = 0; h.continued.turn = 0;
    (h.first as any).aim = { x: rack.x + 60, y: rack.y + 80 };
    (h.first as any).launch = (h.first as any).aim;
    h.tick(100);
    assert.equal(h.scene.spaceBomber.minesPlaced, cooldown ? 0 : 1);
    assert.ok(Math.abs(h.scene.spaceBomber.aimDistance - 100) < 1e-12);
    assert.ok(Math.abs(h.scene.spaceBomber.aimAngle - Math.atan2(80, 60)) < 1e-12);
  }
});

test('catch-up advances damage grace and automatic repair; pause preserves repair progress', () => {
  const pilot = harness(); pilot.tick(16); pilot.scene.flight.invulnerable = 1.25;
  pilot.tick(250); assert.ok(Math.abs(pilot.scene.flight.invulnerable - 1) < 1e-12);
  const life = harness(modes[7]); life.tick(16);
  Object.assign(life.first, { x: 0, jump: false }); Object.assign(life.continued, { x: 0, jump: false });
  Object.assign(life.scene.spaceLife, { x: 85, y: 520, vy: 0, grounded: true, fireIn: 100, iconIn: 100,
    fires: [{ id: 1, x: 85, y: 520, kind: 'electrical', remaining: 100, sparkIn: 100 }] });
  life.tick(250); assert.ok(Math.abs(life.scene.spaceLife.fires[0].repairProgress - .25) < 1e-12);
  life.tick(251); assert.equal(life.scene.spaceLife.electricalRepaired, 0);
  life.scene.activeFlight = true; life.tick(1000);
  for (let i = 0; i < 5; i++) life.tick(250);
  assert.equal(life.scene.spaceLife.electricalRepaired, 1); assert.equal(life.scene.spaceLife.fires.length, 0);
  life.tick(250); assert.equal(life.scene.spaceLife.electricalRepaired, 1);
});

test('fatal collision stops the frame before later steps can move, heal or award results twice', () => {
  const h = harness(); h.tick(16);
  Object.assign(h.scene.flight, { hull: 1, asteroids: [{ x: h.scene.flight.x, y: h.scene.flight.y, radius: 30, speed: 0, vx: 0 }] });
  h.tick(250); assert.equal(h.scene.flight.hull, 0); assert.equal(h.scene.activeFlight, false);
  assert.equal(h.calls.length, 1); assert.equal(h.hud, 1);
  const state = structuredClone(h.scene.flight); h.tick(250); assert.deepEqual(h.scene.flight, state);
});
