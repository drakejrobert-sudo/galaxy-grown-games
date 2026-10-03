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
    cooldown: .3, mineCooldown: .3,
    mines: [{ id: 1, x: 100, y: 280, blastRadius: radius, armIn: .1, expiresIn: lifetime },
      { id: 2, x: 260, y: 390, blastRadius: radius, armIn: 0, expiresIn: .2 }],
    explosions: [{ x: 350, y: 250, radius, remaining: .14 }] });
  scene.bomber.asteroids = [{ id: 1, x: 240, y: 200, radius: 22, speed: 100 }];
  scene.spaceBomber.aimAngle = 1.2;
  scene.spaceBomber.passes = [{id:9,x:300,y:125,radius:16,speed:100,warningRemaining:0,side:1,remaining:.15}];
  scene.spaceBomber.mines[0].flight = {x:90,y:260,targetX:140,targetY:330,duration:.2,remaining:.1};
  scene.spaceBomber.enemies = [
    { id: 1, x: 140, y: 140, radius: 20, speed: 100, warningRemaining: .4 },
    { id: 2, x: 350, y: 440, radius: 20, speed: 100, warningRemaining: .4 },
  ];
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
    const drop = situation === 'Space Battle' ? rules.spaceBomberLanding(state) : rules.mineDropPosition(state);
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

test('fuel remains centered and mine readiness changes artwork without relocating targets', () => {
  const h = harness(); pilotBomberFixtures(h.scene); h.setReduced(true);
  h.scene.situation = 'Space Battle'; h.scene.role = 'Pilot'; h.paint();
  assert.ok(h.commands.some(c => c[0] === 'fillRoundedRect' && c[1] === 82 && c[2] === 158));
  h.scene.role = 'Bomber'; h.paint(); const cooling = structuredClone(h.commands);
  h.scene.spaceBomber.mineCooldown = 0;
  h.paint(); assert.notDeepEqual(h.commands, cooling);
  const drop = rules.spaceBomberLanding(h.scene.spaceBomber);
  assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[1] === drop.x && c[2] === drop.y));
  const enemies = h.scene.spaceBomber.enemies;
  for (const enemy of enemies) {

    assert.ok(h.commands.some(c => c[0] === 'fillTriangle' && c[1] === enemy.x && c[2] === rules.HEIGHT - 22));
  }
});

test('repair progress and completion feedback render frozen without moving panel geometry', () => {
  const h = harness(); fixtures(h.scene);
  h.scene.situation = 'Space Battle'; h.scene.role = 'Life Support';
  h.scene.spaceLife.fires[1].repairProgress = .75;
  h.scene.spaceLife.repairFlashes = [{x:95,y:190,remaining:.2}];
  freeze(h.scene.spaceLife); h.paint();
  assert.ok(h.commands.some(c => c[0] === 'fillRect' && c[1] === 186 && c[2] === 370 && c[3] === 19));
  assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[1] === 95 && c[2] === 176 && c[3] === 24));
});

test('short-launch previews show the actual selected landing point and travelling mines look contact-live',()=>{
  const h=harness();h.scene.situation='Space Battle';h.scene.role='Bomber';
  for(const naturalOne of [false,true]) for(const distance of [0,25,50,100]) {
    h.scene.config.naturalOne=naturalOne;h.scene.spaceBomber.aimDistance=distance;h.scene.spaceBomber.aimAngle=.4;
    h.paint();const rack=rules.mineDropPosition(h.scene.spaceBomber),landing=rules.spaceBomberLanding(h.scene.spaceBomber);
    assert.ok(h.commands.some(c=>c[0]==='lineBetween'&&c[1]===rack.x&&c[2]===rack.y&&c[3]===landing.x&&c[4]===landing.y));
    assert.ok(h.commands.some(c=>c[0]==='strokeCircle'&&c[1]===landing.x&&c[2]===landing.y&&c[3]===rules.spaceBomberBlastRadius(h.scene.config)));
  }
  const mine={id:1,x:50,y:200,blastRadius:58,armIn:.1,expiresIn:4.5};
  h.commands.length=0;h.scene.paintMine(h.scene.add.graphics(),mine,0,4.5,true);
  assert.ok(h.commands.some(c=>c[0]==='fillCircle'&&c[1]===50&&c[2]===200&&c[3]===3));
});


function asteroidGunnerFixture(scene: any) {
  scene.situation = 'Asteroid Field'; scene.role = 'Gunner'; scene.activeFlight = false;
  Object.assign(scene.gunner, { elapsed: 8.1, crosshairX: 110, crosshairY: 160, beamTime: .05,
    beamX: 110, beamY: 160, asteroids: [
      { id: 1, x: 100, y: 160, radius: 20, speed: 100, hp: 2, maxHp: 2, rotation: .3 },
      { id: 2, x: 310, y: 250, radius: 25, speed: 100, hp: 1, maxHp: 2, rotation: .7 },
      { id: 3, x: 220, y: 320, radius: 18, speed: 100, hp: 1, maxHp: 1 },
    ] });
}

test('Asteroid Gunner presents actual target selection and distinct bounded shot outcomes', () => {
  const h = harness(); asteroidGunnerFixture(h.scene);
  for (const outcome of ['miss', 'armor-hit', 'destroyed']) {
    h.scene.gunner.shotFeedback = { outcome, x: 200, y: 180, radius: outcome === 'miss' ? 0 : 20, remaining: .12 };
    freeze(h.scene.gunner); h.paint();
    assert.ok(!h.commands.some(c => c[0] === 'fillCircle' && c[1] === 110 && c[2] === 160 && c[3] === 5), 'misses never get the old impact dot');
    if (outcome === 'miss') assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[1] === 200 && c[2] === 180));
    if (outcome === 'armor-hit') assert.ok(h.commands.some(c => c[0] === 'lineStyle' && c[2] === 0xffca83 && Math.abs(Number(c[3]) - 2 / 3) < 1e-10));
    if (outcome === 'destroyed') assert.ok(h.commands.some(c => c[0] === 'fillTriangle' && Number(c[1]) > 200));
    assert.ok(h.commands.some(c => c[0] === 'lineBetween' && c[1] === 76 && c[2] === 136 && c[3] === 83));
    const commands = structuredClone(h.commands); h.commands.length = 0;
    h.scene.update(9999, 1000); assert.deepEqual(h.commands, commands);
    h.scene.gunner = { ...h.scene.gunner, finished: true }; h.paint(); assert.deepEqual(h.commands, commands);
    h.scene.gunner = structuredClone(h.scene.gunner);
  }
});

test('Asteroid Gunner cooldown dial uses every band and Natural 1, including edge reticles and open centers', () => {
  const h = harness(); asteroidGunnerFixture(h.scene);
  for (const total of [5, 6, 11, 16]) for (const naturalOne of [false, true]) {
    h.scene.config = { total, naturalOne };
    for (const fraction of [0, .25, .75, 1]) for (const [x, y] of [[12, 18], [468, rules.GUNNER_DEFENSE_LINE - 8]]) {
      Object.assign(h.scene.gunner, { crosshairX: x, crosshairY: y, cooldown: rules.gunnerFireEvery(h.scene.config) * (1 - fraction) });
      h.paint();
      const arcs = h.commands.filter(c => c[0] === 'arc' && c[1] === x && c[2] === y && c[3] === 21);
      assert.equal(arcs.length, fraction > 0 ? 2 : 1);
      if (fraction > 0) assert.ok(Math.abs(Number(arcs[1][5]) - Math.PI * fraction) < 1e-12);
      assert.ok(!h.commands.some(c => c[0] === 'fillCircle' && c[1] === x && c[2] === y), 'reticle center remains open');
    }
  }
});

test('Asteroid Gunner reduced motion freezes decoration and feedback geometry while gameplay cues remain', () => {
  const h = harness(); asteroidGunnerFixture(h.scene); h.setReduced(true);
  for (const outcome of ['miss', 'armor-hit', 'destroyed']) {
    h.scene.gunner.shotFeedback = { outcome, x: 200, y: 180, radius: 20, remaining: .15 };
    h.paint();
    const geometry = h.commands.filter(c => !['lineStyle', 'fillStyle'].includes(String(c[0])));
    h.scene.gunner.elapsed += 8;
    h.scene.gunner.shotFeedback.remaining = .05;
    h.paint();
    const laterGeometry = h.commands.filter(c => !['lineStyle', 'fillStyle'].includes(String(c[0])));
    assert.equal(geometry.length, laterGeometry.length);
    geometry.forEach((c, i) => c.forEach((v, j) => typeof v === 'number'
      ? assert.ok(Math.abs(v - Number(laterGeometry[i][j])) < 1e-9)
      : assert.equal(v, laterGeometry[i][j])));
  }
});

function routingFixture(scene: any) {
  scene.situation = 'Asteroid Field'; scene.role = 'Life Support';
  Object.assign(scene.lifeSupport, { elapsed: 8, selectedRoute: 'Shields', feedbackTime: .12,
    routingFeedback: { kind: 'heart', expectedRoute: 'Shields', selectedRoute: 'Shields', correct: true, integrityDelta: 1 },
    packets: [
      { id: 1, x: 240, y: 125, speed: 100, target: 'Thrusters', kind: 'power' },
      { id: 2, x: 240, y: 215, speed: 100, target: 'Shields', kind: 'heart' },
      { id: 3, x: 240, y: 305, speed: 100, target: 'Guns', kind: 'overload' },
    ] });
}

test('routing packets have distinct housings and only the selected bay has a steady marker', () => {
  const h = harness(); routingFixture(h.scene);
  for (const [route, x] of [['Thrusters', 92], ['Shields', 240], ['Guns', 388]] as const) {
    h.scene.lifeSupport.selectedRoute = route; h.paint();
    assert.ok(h.commands.some(c => c[0] === 'strokeRoundedRect' && c[1] === 218 && c[2] === 103 && c[5] === 5));
    assert.ok(h.commands.some(c => c[0] === 'strokeRoundedRect' && c[1] === 218 && c[2] === 193 && c[5] === 15));
    assert.ok(h.commands.some(c => c[0] === 'strokePoints'));
    assert.ok(h.commands.some(c => c[0] === 'strokeRoundedRect' && c[1] === x - 48 && c[2] === 462));
    assert.equal(h.commands.filter(c => c[0] === 'fillTriangle' && c[2] === 449).length, 1);
    assert.ok(!h.commands.some(c => c[0] === 'fillRect' && c[1] === 16 && c[2] === 15), 'no full-playfield flash');
  }
});

test('routing outcome is localized to its recorded bay even after selection changes', () => {
  const h = harness(); routingFixture(h.scene);
  for (const correct of [true, false]) {
    h.scene.lifeSupport.routingFeedback.correct = correct;
    h.scene.lifeSupport.selectedRoute = 'Guns'; h.paint();
    assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[1] === 240 && c[2] === 405 && c[3] === 38));
    assert.ok(h.commands.some(c => c[0] === 'lineBetween' && c[1] === (correct ? 233 : 234) && c[2] === (correct ? 482 : 479)));
  }
  h.scene.lifeSupport.feedbackTime = 0; h.paint();
  assert.ok(!h.commands.some(c => c[0] === 'strokeCircle' && c[3] === 38));
});

test('routing renderer freezes decoration with reduced motion and never mutates frozen state', () => {
  const h = harness(); routingFixture(h.scene); h.setReduced(true);
  h.paint(); const before = structuredClone(h.commands);
  h.scene.lifeSupport.elapsed = 27; h.paint();
  assert.deepEqual(structuredClone(h.commands), before, 'background, panel lights, scanner, flow and pulses freeze');
  freeze(h.scene.lifeSupport);
  h.scene.activeFlight = false; h.paint();
  const paused = structuredClone(h.commands); h.scene.update(0, 50);
  assert.deepEqual(structuredClone(h.commands.slice(paused.length)), paused);
});
