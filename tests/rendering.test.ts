import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as rules from '../src/game/rules.ts';

function harness() {
  let reduced = false;
  const exports: any = {};
  const js = ts.transpileModule(readFileSync(new URL('../src/game/scene.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(js, { exports, require: (name: string) => {
    if (name === 'phaser') return { Scene: class {} };
    assert.equal(name, './rules'); return rules;
  }, window: { matchMedia: () => ({ get matches() { return reduced; } }) } });
  const scene = new exports.FlightScene('test');
  const commands: unknown[][] = [];
  let depth = 0;
  const graphics: any = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => {
    for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(name)} has invalid geometry`);
    if (name === 'save') depth++;
    if (name === 'restore') { depth--; assert.ok(depth >= 0); }
    commands.push([name, ...args]); return graphics;
  } });
  scene.add = { graphics: () => graphics };
  scene.create();
  return { scene, commands, setReduced: (value: boolean) => { reduced = value; },
    paint() { commands.length = 0; scene.paint(); assert.equal(depth, 0, 'rendering restores canvas transforms'); } };
}
function freeze(value: any): any {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
}
function fixtures(scene: any) {
  Object.assign(scene.spaceGunner, { elapsed: 8, beamTime: .05, grace: .5, impactFlash: .1,
    attackers: [
      { id: 1, x: 0, y: 100, radius: 21, speed: 85, hp: 1, maxHp: 1, fired: false },
      { id: 2, x: 240, y: 180, radius: 21, speed: 85, hp: 2, maxHp: 2, fired: false },
      { id: 3, x: 480, y: 400, radius: 21, speed: 85, hp: 1, maxHp: 2, fired: true },
    ], projectiles: [{ id: 4, x: 240, y: 330, radius: 10, speed: 180 }] });
  Object.assign(scene.spaceLife, { elapsed: 8, x: 150, y: 410, invulnerable: .5,
    fires: [{ id: 1, x: 85, y: 520, kind: 'ordinary', remaining: 5, arming: .4 },
      { id: 2, x: 205, y: 410, kind: 'electrical', remaining: 1, sparkIn: .4 }],
    sparks: [{ id: 5, x: 260, y: 396, vx: 165, remaining: 3 }],
    icons: [{ id: 3, x: 95, y: 155, kind: 'heart', remaining: 6 },
      { id: 4, x: 390, y: 265, kind: 'overload', remaining: 6 }] });
}

test('all eight renderers accept frozen game states without changing them or leaking canvas transforms', () => {
  const h = harness(); fixtures(h.scene);
  const keys = ['flight', 'gunner', 'spaceGunner', 'bomber', 'lifeSupport', 'spacePilot', 'spaceBomber', 'spaceLife'];
  const before = keys.map(key => JSON.stringify(h.scene[key]));
  for (const key of keys) freeze(h.scene[key]);
  for (const situation of ['Asteroid Field', 'Space Battle']) for (const role of ['Pilot', 'Gunner', 'Bomber', 'Life Support']) {
    h.scene.situation = situation; h.scene.role = role; h.paint();
    assert.ok(h.commands.length > 0);
    assert.deepEqual(keys.map(key => JSON.stringify(h.scene[key])), before);
  }
});

test('paused rendering does not advance animation or state; jump poses work at both horizontal edges', () => {
  const h = harness(); fixtures(h.scene);
  h.scene.situation = 'Space Battle'; h.scene.role = 'Life Support'; h.scene.activeFlight = false;
  for (const x of [11, 469]) for (const vy of [-100, 100]) {
    Object.assign(h.scene.spaceLife, { x, vy, grounded: false });
    h.paint();
  }
  const before = JSON.stringify(h.scene.spaceLife);
  h.paint(); const commands = structuredClone(h.commands);
  h.scene.update(12345, 1000);
  assert.equal(JSON.stringify(h.scene.spaceLife), before);
  assert.deepEqual(h.commands.slice(commands.length), commands);
});

test('added decorative motion follows the live reduced-motion preference and uses no wall clock', () => {
  const h = harness(); fixtures(h.scene);
  h.setReduced(true);
  assert.equal(h.scene.decorativeTime(8), 0);
  assert.equal(h.scene.decorativeTime(15), 0);
  h.setReduced(false);
  assert.equal(h.scene.decorativeTime(8), 8);
  h.scene.situation = 'Space Battle'; h.scene.role = 'Gunner';
  h.paint(); const moving = structuredClone(h.commands);
  h.setReduced(true); h.paint();
  assert.notDeepEqual(h.commands, moving);
  h.paint(); const stable = structuredClone(h.commands);
  h.paint(); assert.deepEqual(h.commands, stable);
});


test('hazard warnings and spark cores remain visible with reduced motion', () => {
  const h = harness(); fixtures(h.scene); h.setReduced(true);
  h.scene.situation = 'Space Battle'; h.scene.role = 'Life Support'; h.paint();
  assert.ok(h.commands.some(command => command[0] === 'strokeRoundedRect' && command[1] === 188 && command[2] === 380));
  assert.ok(h.commands.some(command => command[0] === 'fillCircle' && command[1] === 260 && command[2] === 396 && command[3] === 4));
  h.scene.spaceLife.fires[1].sparkIn = 1;
  h.paint();
  assert.ok(!h.commands.some(command => command[0] === 'strokeRoundedRect' && command[1] === 188 && command[2] === 380));
});

function pilotBomberFixtures(scene: any) {
  Object.assign(scene.flight, { elapsed: 8.1, invulnerable: .5, asteroids: [
    { x: -40, y: 100, radius: 20, speed: 100, vx: 80, side: 'left', rotation: .2 },
    { x: 520, y: 200, radius: 20, speed: 100, vx: -80, side: 'right' },
    { x: 240, y: 280, radius: 30, speed: 100, rotation: .7 },
  ] });
  Object.assign(scene.spacePilot, { elapsed: 8.1, invulnerable: .5, impactFlash: .1,
    fuelCells: [{ id: 1, x: 90, y: 170, radius: 13 }],
    enemies: [{ id: 2, x: 240, y: 260, radius: 20, speed: 100, fireIn: .1 }],
    shots: [{ x: 310, y: 350, vx: 30, vy: 100, radius: 5 }, { x: 100, y: 350, vx: 0, vy: 0, radius: 5 }] });
  for (const [key, radius, lifetime] of [
    ['bomber', rules.bomberBlastRadius(scene.config), rules.BOMBER_MINE_LIFETIME],
    ['spaceBomber', rules.spaceBomberBlastRadius(scene.config), rules.SPACE_BOMBER_MINE_LIFETIME],
  ] as const) Object.assign(scene[key], { elapsed: 8.1, invulnerable: .5, impactFlash: .1,
    cooldown: .3, mineCooldown: .3, missileCooldown: .2,
    mines: [{ id: 1, x: 100, y: 280, blastRadius: radius, armIn: .1, expiresIn: lifetime },
      { id: 2, x: 260, y: 390, blastRadius: radius, armIn: 0, expiresIn: .2 }],
    explosions: [{ x: 350, y: 250, radius, remaining: .14 }] });
  scene.bomber.asteroids = [{ id: 1, x: 240, y: 200, radius: 22, speed: 100 }];
  scene.spaceBomber.enemies = [
    { id: 1, x: 140, y: 140, radius: 20, speed: 100, approach: 'forward' },
    { id: 2, x: 350, y: 440, radius: 20, speed: 100, approach: 'pursuer' },
  ];
  scene.spaceBomber.missiles = [{ id: 3, x: 210, y: 300, vx: -60, vy: -200 }];
}

test('Pilot and Bomber representative states render frozen across both situations and Natural 1', () => {
  for (const naturalOne of [false, true]) {
    const h = harness(); h.scene.config.naturalOne = naturalOne; pilotBomberFixtures(h.scene);
    for (const key of ['flight', 'spacePilot', 'bomber', 'spaceBomber']) freeze(h.scene[key]);
    for (const situation of ['Asteroid Field', 'Space Battle']) for (const role of ['Pilot', 'Bomber']) {
      h.scene.situation = situation; h.scene.role = role; h.paint();
      const commands = structuredClone(h.commands);
      h.commands.length = 0; h.scene.update(90000, 1000);
      assert.deepEqual(h.commands, commands, 'pause uses simulation time');
      const key = situation === 'Space Battle' ? role === 'Pilot' ? 'spacePilot' : 'spaceBomber' : role === 'Pilot' ? 'flight' : 'bomber';
      h.scene[key] = { ...h.scene[key], finished: true };
      h.paint(); assert.deepEqual(h.commands, commands, 'terminal rendering stays frozen');
    }
  }
});

test('mine preview, deployed radius and explosion boundary use exact Natural 1 geometry in both Bomber modes', () => {
  for (const situation of ['Asteroid Field', 'Space Battle']) for (const naturalOne of [false, true]) {
    const h = harness(); h.scene.config.naturalOne = naturalOne; pilotBomberFixtures(h.scene);
    h.scene.situation = situation; h.scene.role = 'Bomber'; h.paint();
    const state = situation === 'Space Battle' ? h.scene.spaceBomber : h.scene.bomber;
    const radius = situation === 'Space Battle' ? rules.spaceBomberBlastRadius(h.scene.config) : rules.bomberBlastRadius(h.scene.config);
    const drop = rules.mineDropPosition(state);
    for (const [x, y] of [[drop.x, drop.y], [100, 280], [260, 390], [350, 250]]) {
      assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[1] === x && c[2] === y && c[3] === radius));
    }
  }
});

test('mine arming and expiry retain distinct cues and use each modes own lifetime', () => {
  const h = harness(); h.setReduced(true);
  for (const lifetime of [rules.BOMBER_MINE_LIFETIME, rules.SPACE_BOMBER_MINE_LIFETIME]) {
    const mine = { id: 1, x: 100, y: 100, blastRadius: 60, armIn: .1, expiresIn: lifetime };
    h.commands.length = 0; h.scene.paintMine(h.scene.add.graphics(), mine, 8, lifetime);
    assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[3] === 3), 'hollow unarmed core');
    assert.ok(h.commands.some(c => c[0] === 'arc' && c[3] === 18 && c[5] === Math.PI * 1.5));
    mine.armIn = 0; mine.expiresIn = lifetime / 2; h.commands.length = 0;
    h.scene.paintMine(h.scene.add.graphics(), mine, 8, lifetime);
    assert.ok(h.commands.some(c => c[0] === 'fillCircle' && c[3] === 3), 'solid armed core');
    assert.ok(h.commands.some(c => c[0] === 'arc' && c[3] === 18 && c[5] === Math.PI / 2));
  }
});

test('selected modes freeze decoration with reduced motion while preserving essential state feedback', () => {
  const h = harness(); pilotBomberFixtures(h.scene); h.setReduced(true);
  for (const situation of ['Asteroid Field', 'Space Battle']) for (const role of ['Pilot', 'Bomber']) {
    h.scene.situation = situation; h.scene.role = role;
    const state = situation === 'Space Battle' ? role === 'Pilot' ? h.scene.spacePilot : h.scene.spaceBomber
      : role === 'Pilot' ? h.scene.flight : h.scene.bomber;
    state.elapsed = 8; h.paint(); const commands = structuredClone(h.commands);
    state.elapsed = 15; h.paint(); assert.deepEqual(h.commands, commands);
    assert.ok(h.commands.some(c => c[0] === 'strokeEllipse' && c[3] === 9 && c[4] === 15), 'protected ship remains visible');
    if (situation === 'Asteroid Field' && role === 'Pilot')
      assert.ok(h.commands.some(c => c[0] === 'strokeRoundedRect' && c[1] === 6 && c[2] === 81), 'edge warning remains visible');
  }
});

test('fuel remains centered and missile/mine readiness changes artwork without relocating targets', () => {
  const h = harness(); pilotBomberFixtures(h.scene); h.setReduced(true);
  h.scene.situation = 'Space Battle'; h.scene.role = 'Pilot'; h.paint();
  assert.ok(h.commands.some(c => c[0] === 'fillRoundedRect' && c[1] === 82 && c[2] === 158));
  h.scene.role = 'Bomber'; h.paint(); const cooling = structuredClone(h.commands);
  h.scene.spaceBomber.mineCooldown = 0; h.scene.spaceBomber.missileCooldown = 0;
  h.paint(); assert.notDeepEqual(h.commands, cooling);
  const drop = rules.mineDropPosition(h.scene.spaceBomber);
  assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[1] === drop.x && c[2] === drop.y));
  const enemies = h.scene.spaceBomber.enemies;
  for (const enemy of enemies) {
    const direction = enemy.approach === 'forward' ? 1 : -1;
    assert.ok(h.commands.some(c => c[0] === 'fillTriangle' && c[1] === enemy.x && c[2] === enemy.y + direction * 30));
  }
});
