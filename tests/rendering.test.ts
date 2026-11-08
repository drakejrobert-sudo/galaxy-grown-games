import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as rules from '../src/game/rules.ts';
import * as aftView from '../src/game/boarding-aft-view.ts';

function harness() {
  let reduced = false;
  const exports: any = {};
  const js = ts.transpileModule(readFileSync(new URL('../src/game/scene.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(js, { exports, require: (name: string) => {
    if (name === 'phaser') return { Scene: class {} };
    if (name === './boarding-aft-view') return aftView;
    assert.equal(name, './rules'); return rules;
  }, window: { matchMedia: () => ({ get matches() { return reduced; } }) } });
  const scene = new exports.FlightScene('test');
  const commands: unknown[][] = [];
  let depth = 0;
  const layers: { depth: number; visible: boolean; commands: unknown[][] }[] = [];
  const makeGraphics = () => {
    const state = { depth: 0, visible: true, commands: [] as unknown[][] };layers.push(state);
    const graphics: any = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => {
      for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(name)} has invalid geometry`);
      if (name === 'save') depth++;
      if (name === 'restore') { depth--; assert.ok(depth >= 0); }
      if (name === 'setDepth') state.depth = args[0] as number;
      if (name === 'setVisible') state.visible = args[0] as boolean;
      if (name === 'clear') state.commands.length = 0;
      state.commands.push([name, ...args]); commands.push([name, ...args]); return graphics;
    } });
    return graphics;
  };
  scene.add = { graphics: makeGraphics };
  scene.create();
  return { scene, commands, layers, setReduced: (value: boolean) => { reduced = value; },
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
  scene.bomber.mines[0].flight = {x:90,y:260,targetX:140,targetY:330,duration:.2,remaining:.1};
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
      assert.deepEqual(structuredClone(h.commands), commands, 'pause uses simulation time');
      const key = situation === 'Space Battle' ? role === 'Pilot' ? 'spacePilot' : 'spaceBomber' : role === 'Pilot' ? 'flight' : 'bomber';
      h.scene[key] = { ...h.scene[key], finished: true };
      h.paint(); assert.deepEqual(structuredClone(h.commands), commands, 'terminal rendering stays frozen');
    }
  }
});

test('mine preview, deployed radius and explosion boundary use exact Natural 1 geometry in both Bomber modes', () => {
  for (const situation of ['Asteroid Field', 'Space Battle']) for (const naturalOne of [false, true]) {
    const h = harness(); h.scene.config.naturalOne = naturalOne; pilotBomberFixtures(h.scene);
    h.scene.situation = situation; h.scene.role = 'Bomber'; h.paint();
    const state = situation === 'Space Battle' ? h.scene.spaceBomber : h.scene.bomber;
    const radius = situation === 'Space Battle' ? rules.spaceBomberBlastRadius(h.scene.config) : rules.bomberBlastRadius(h.scene.config);
    const drop = rules.spaceBomberLanding(state);
    for (const [x, y] of [[drop.x, drop.y], [100, 280], [260, 390], [350, 250]]) {
      assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[1] === x && c[2] === y && c[3] === radius));
    }
  }
});

test('mine arming and expiry retain distinct cues and use each modes own lifetime', () => {
  const h = harness(); h.setReduced(true);
  for (const lifetime of [rules.BOMBER_MINE_LIFETIME, rules.SPACE_BOMBER_MINE_LIFETIME, rules.BOARDING_MINE_LIFETIME]) {
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
    state.elapsed = 15; h.paint(); assert.deepEqual(structuredClone(h.commands), commands);
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

test('Bomber rack status uses each simulation cooldown', () => {
  const h = harness();
  h.scene.role = 'Bomber';
  for (const [situation, stateKey, cooldownKey, duration] of [
    ['Asteroid Field', 'bomber', 'cooldown', rules.BOMBER_MINE_COOLDOWN],
    ['Space Battle', 'spaceBomber', 'mineCooldown', rules.SPACE_BOMBER_MINE_COOLDOWN],
    ['Boarding Party', 'boarding', 'cooldown', rules.BOARDING_MINE_COOLDOWN],
  ] as const) {
    h.scene.situation = situation;
    for (const fraction of [0, .25, 1]) {
      h.scene[stateKey][cooldownKey] = duration * fraction;
      h.paint();
      const bars = h.commands.filter(([name, x, y]) => name === 'fillRect' && x === rules.WIDTH / 2 + 39 && y === 28);
      assert.deepEqual(bars.map(c => c[3]), [44, 44 * (1 - fraction)]);
    }
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
  const mine = { id: 1, x: 50, y: 200, blastRadius: 58, armIn: .1, expiresIn: 4.5,
    flight: { x: 20, y: 160, targetX: 80, targetY: 240, duration: .2, remaining: .1 } };
  h.commands.length = 0; h.scene.paintMine(h.scene.add.graphics(), mine, 0, 4.5);
  assert.ok(h.commands.some(c => c[0] === 'fillCircle' && c[1] === 50 && c[2] === 200 && c[3] === 3));
  assert.ok(h.commands.some(c => c[0] === 'rotateCanvas' && c[1] === Math.atan2(80, 60)));
  assert.ok(h.commands.some(c => c[0] === 'lineBetween' && c[3] === mine.x && c[4] === mine.y), 'visible flight trail');
  h.setReduced(true);
  h.commands.length = 0; h.scene.paintMine(h.scene.add.graphics(), mine, 10, 4.5);
  assert.ok(!h.commands.some(c => c[0] === 'lineBetween' && c[3] === mine.x && c[4] === mine.y), 'reduced motion omits the trail');
  assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[3] === mine.blastRadius), 'coverage stays visible');
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

test('illustrated sprites reuse a bounded pool, hide retired objects and leave all simulation states unchanged', () => {
  const h = harness(); fixtures(h.scene);
  const images: any[] = [];
  h.scene.textures = { exists: () => true };
  h.scene.add.image = (_x: number, _y: number, texture: string) => {
    const image: any = { texture };
    for (const method of ['setCrop', 'setMask', 'clearMask', 'setTexture', 'setPosition', 'setDisplaySize', 'setRotation', 'setAlpha', 'setDepth', 'setVisible']) {
      image[method] = (...args: any[]) => { image[method.slice(3)] = args; return image; };
    }
    images.push(image); return image;
  };
  const rock = { id: 1, x: 120, y: 120, radius: 24, speed: 100, rotation: .5 };
  h.scene.flight.asteroids.push(rock);
  h.scene.gunner.elapsed = 2;
  const keys = ['flight', 'gunner', 'spaceGunner', 'bomber', 'lifeSupport', 'spacePilot', 'spaceBomber', 'spaceLife'];
  const before = keys.map(key => JSON.stringify(h.scene[key]));
  keys.forEach(key => freeze(h.scene[key]));
  for (const situation of ['Asteroid Field', 'Space Battle']) for (const role of ['Pilot', 'Gunner', 'Bomber', 'Life Support']) {
    h.scene.situation = situation; h.scene.role = role; h.paint();
    const count = images.length;
    h.paint(); assert.equal(images.length, count, 'steady rendering reuses Images');
    assert.deepEqual(keys.map(key => JSON.stringify(h.scene[key])), before);
    assert.ok(images.filter(image => image.Visible[0]).every(image => image.Depth[0] < 0), 'procedural feedback stays above art');
  }
  h.scene.situation = 'Asteroid Field'; h.scene.role = 'Gunner'; h.setReduced(true); h.paint();
  const ship = images.find(image => image.Texture[0] === 'illustrated-player' && image.Visible[0]);
  assert.equal(ship.Position[0], rules.automaticShipX(2), 'reduced motion cannot detach the hull from the moving turret');
  h.scene.situation = 'Asteroid Field'; h.scene.role = 'Pilot'; h.paint();
  const asteroid = images.find(image => image.Texture[0] === 'illustrated-asteroid' && image.Visible[0]);
  assert.deepEqual(asteroid.DisplaySize, [48, 48], 'art uses existing asteroid diameter');
  assert.deepEqual(asteroid.Position, [120, 120]);
  h.scene.textures.exists = (key: string) => key !== 'illustrated-space';
  h.paint();
  assert.ok(images.some(image => image.Texture[0] === 'illustrated-player' && image.Visible[0]), 'missing background does not disable loaded sprites');
  h.scene.textures.exists = () => false;
  h.paint();
  assert.ok(images.every(image => image.Visible[0] === false), 'failed/missing textures leave no stale sprites');
  assert.ok(h.commands.some(command => command[0] === 'fillPath'), 'procedural objects still render');
});

test('Boarding Party renderers keep frozen threats, cover, airlocks, warnings and HUD geometry finite',()=>{
  const h=harness();
  for(const role of ['Gunner','Bomber','Life Support'] as const) {
    h.scene.begin({total:5,naturalOne:true},'Boarding Party',role);
    const s=h.scene.boarding;s.grace=.5;s.beamTime=.05;s.carrier.targetX=120;
    s.pods=[{id:1,x:200,y:300,vx:10,vy:-160,radius:12,kind:'probe',hp:1,maxHp:1,warningRemaining:.3,hitFlash:.1}];
    s.boarders=[{id:2,x:145,y:180,slot:0,depth:0,phase:'exposed',remaining:.5},{id:3,x:60,y:350,slot:2,depth:1,phase:'relocating',remaining:.8}];
    s.airlocks[0].warning=.3;s.airlocks[1].cooldown=8;
    s.mines=[{id:4,x:200,y:250,armIn:0,expiresIn:3,blastRadius:41}];s.explosions=[{x:210,y:280,radius:41,remaining:.1}];
    const before=JSON.stringify(s);freeze(s);h.paint();h.setReduced(true);h.paint();
    assert.equal(JSON.stringify(s),before);assert.ok(h.commands.length>30);
  }
});

test('Boarding textures and labels are pooled, retire on mode switch, and retain partial-asset fallbacks',()=>{
  const h=harness(),images:any[]=[],labels:any[]=[];
  const object=(collection:any[],methods:string[])=>{const o:any={};for(const m of methods)o[m]=(...v:any[])=>{o[m.slice(3)]=v;return o;};collection.push(o);return o;};
  h.scene.textures={exists:()=>true};
  h.scene.add.image=()=>object(images,['setCrop','setMask','clearMask','setTexture','setPosition','setDisplaySize','setRotation','setAlpha','setDepth','setVisible']);
  h.scene.add.text=()=>object(labels,['setText','setPosition','setOrigin','setFontSize','setColor','setDepth','setVisible']);
  h.scene.begin({total:10,naturalOne:false},'Boarding Party','Life Support');
  const s=h.scene.boarding;s.boarders=[{id:1,x:200,y:193,slot:0,depth:0,phase:'exposed',remaining:.3},{id:2,x:415,y:372,slot:3,depth:1,phase:'relocating',remaining:.8}];
  s.lasers=[{id:3,x:200,y:193,side:0,duration:.9,remaining:.4}];const snapshot=JSON.stringify(s);freeze(s);h.paint();
  assert.ok(images.some(i=>i.Texture[0]==='illustrated-boarding-corridor'));
  assert.ok(images.some(i=>i.Texture[0]==='illustrated-boarding-rifle'&&i.Depth[0]>.0));
  assert.ok(labels.every(l=>!['SHOOT','STANDBY','OPENING','VENTING','COVERED','AIMING','FIRING','MOVING','LEFT AIRLOCK','RIGHT AIRLOCK'].includes(l.Text?.[0])));const count=[images.length,labels.length];h.paint();assert.deepEqual([images.length,labels.length],count);
  assert.equal(JSON.stringify(s),snapshot);
  h.scene.textures.exists=(key:string)=>key!=='illustrated-boarding-corridor';h.paint();assert.ok(h.commands.some(c=>c[0]==='strokeRect'&&c[1]===195&&c[2]===100));
  assert.ok(images.some(i=>i.Texture[0]==='illustrated-boarding-boarder'&&i.Visible[0]));
  h.scene.textures.exists=()=>false;h.paint();assert.ok(images.every(i=>!i.Visible[0]));assert.ok(labels.some(l=>l.Visible[0]));
  h.scene.situation='Asteroid Field';h.scene.role='Pilot';h.paint();assert.ok(labels.every(l=>!l.Visible[0]));
});

test('cargo stays present and depth-orders with enemies; ducked bodies do not leak beneath stacks',()=>{
  const h=harness(),images:any[]=[];
  const object=()=>{const o:any={};for(const m of ['setCrop','setMask','clearMask','setTexture','setPosition','setDisplaySize','setRotation','setAlpha','setDepth','setVisible'])o[m]=(...v:any[])=>{o[m.slice(3)]=v;return o;};images.push(o);return o;};
  h.scene.textures={exists:()=>true};h.scene.add.image=object;
  h.scene.begin({total:10,naturalOne:false},'Boarding Party','Life Support');h.paint();
  const cargo=()=>h.layers.filter(l=>l.visible&&l.commands.some(c=>c[0]==='fillEllipse'));
  assert.equal(cargo().length,6,'one fixed stack per side at each depth, even without enemies');
  const emptyDepths=cargo().map(l=>l.depth);
  const s=h.scene.boarding;s.boarders=[{id:1,...rules.boardingCover(0,0),slot:0,depth:0,phase:'exposed',remaining:1},{id:2,...rules.boardingCover(1,2),slot:1,depth:2,phase:'warning',remaining:.5}];
  h.paint();assert.deepEqual(cargo().map(l=>l.depth),emptyDepths);
  const boarders=images.filter(i=>i.Visible[0]&&i.Texture[0]==='illustrated-boarding-boarder');
  assert.equal(boarders.length,1,'covered bodies are hidden, with only a procedural helmet behind cargo');
  const ownCover=cargo().find(l=>Math.abs(l.depth-(-1.9+(s.boarders[0].y+1)/600))<1e-8)!;
  assert.ok(ownCover.depth>boarders[0].Depth[0],'own cover masks lower body');
  assert.ok(cargo().filter(l=>l.depth>ownCover.depth).length>0,'near cargo masks distant sprites');
  const count=h.layers.length;h.paint();assert.equal(h.layers.length,count,'graphics layers are reused');
  h.scene.situation='Asteroid Field';h.scene.role='Pilot';h.paint();assert.ok(h.layers.slice(2).every(l=>!l.visible),'no corridor graphics leak into another mode');
});
test('door/ejection animation phases render frozen states with art or fallbacks and reuse their pools',()=>{
  const h=harness();h.scene.begin({total:10,naturalOne:false},'Boarding Party','Life Support');
  for(const remaining of [.45,.225,.01]) {
    const state=structuredClone(rules.createBoarding('Life Support'));
    state.ejections=[{x:65,y:330,scale:.9,side:0,remaining}];state.airlocks[0].openRemaining=remaining;
    state.airlocks[1].warning=.3;h.scene.boarding=freeze(state);const before=JSON.stringify(state);
    h.paint();const count=h.layers.length;h.paint();assert.equal(h.layers.length,count);assert.equal(JSON.stringify(state),before);
    assert.ok(h.commands.some(c=>c[0]==='lineBetween'),'airflow is drawn');
  }
});

test('corridor keeps only opening guidance, then removes all in-scene labels, retaining nonverbal cues',()=>{
  const h=harness(),labels:any[]=[];
  h.scene.add.text=()=>{const o:any={};for(const m of ['setText','setPosition','setOrigin','setFontSize','setColor','setDepth','setVisible'])o[m]=(...v:any[])=>{o[m.slice(3)]=v;return o;};labels.push(o);return o;};
  h.scene.begin({total:10,naturalOne:true},'Boarding Party','Life Support');
  const s=h.scene.boarding;s.boarders=[{id:1,...rules.boardingCover(0,0),slot:0,depth:0,phase:'exposed',remaining:.2},{id:2,x:415,y:337,slot:1,depth:1,phase:'relocating',remaining:.8}];
  h.paint();assert.equal(labels.filter(l=>l.Visible?.[0]).length,2,'brief opening guidance only');
  s.elapsed=6;s.impactFlash=.2;s.airlocks[0].cooldown=8;h.paint();
  assert.equal(labels.filter(l=>l.Visible?.[0]).length,0,'no enemy, door or damage words in the corridor');
  assert.ok(h.commands.some(c=>c[0]==='fillCircle'&&c[1]===rules.BOARDING_AIRLOCK_TARGETS[1].x),'lit wall target remains');
  assert.ok(h.commands.filter(c=>c[0]==='fillRect'&&c[4]===3).length>=16,'two segmented recharge gauges');
});

test('textured airlock panels slide within two reused masks and release crops/masks on mode changes',()=>{
  const h=harness(),images:any[]=[];
  h.scene.textures={exists:()=>true};
  h.scene.add.image=()=>{
    const o:any={frame:{realWidth:640,realHeight:800},mask:null};
    for(const m of ['setTexture','setPosition','setDisplaySize','setRotation','setAlpha','setDepth','setVisible','setCrop'])o[m]=(...v:any[])=>{o[m.slice(3)]=v;return o;};
    o.setMask=(mask:any)=>{o.mask=mask;return o;};o.clearMask=()=>{o.mask=null;return o;};images.push(o);return o;
  };
  h.scene.begin({total:10,naturalOne:false},'Boarding Party','Life Support');h.paint();
  const panels=()=>images.filter(i=>i.Visible[0]&&i.mask);
  assert.equal(panels().length,4);assert.equal(new Set(panels().map(i=>i.mask)).size,2);
  assert.ok(panels().every(i=>i.Crop.length===4&&i.Crop.every(Number.isFinite)&&i.Crop[2]>0&&i.Crop[3]>0));
  const closed=panels().map(i=>i.Position[0]),count=h.layers.length;
  h.scene.boarding.airlocks[0].warning=.3;h.paint();
  assert.ok(panels()[0].Position[0]<closed[0]);assert.ok(panels()[1].Position[0]>closed[1]);
  assert.equal(h.layers.length,count,'door clipping shapes are reused');
  h.scene.situation='Asteroid Field';h.scene.role='Pilot';h.paint();
  assert.ok(images.filter(i=>i.Visible[0]).every(i=>i.mask===null&&i.Crop.length===0),'reused images never retain door clipping');
  h.scene.situation='Boarding Party';h.scene.role='Life Support';h.scene.textures.exists=(key:string)=>key!=='illustrated-boarding-corridor';h.paint();
  assert.equal(panels().length,0);assert.ok(h.commands.some(c=>c[0]==='fillPoints'),'perspective door fallback stays usable');
});

test('covered helmets clear their own cargo silhouette on both sides at every depth, with hidden bodies',()=>{
  for(const slot of [0,1])for(const depth of [0,1,2]) {
    const h=harness();h.scene.begin({total:10,naturalOne:false},'Boarding Party','Life Support');
    const c=rules.boardingCover(slot,depth),scale=rules.BOARDING_DEPTHS[depth].scale;
    h.scene.boarding.boarders=[{id:1,...c,slot,depth,phase:'warning',remaining:.5}];
    h.scene.boarding.elapsed=10;const before=JSON.stringify(h.scene.boarding);h.paint();
    const helmetLayer=h.layers.find(l=>l.visible&&l.commands.some(p=>p[0]==='fillCircle'&&p[1]===c.x&&p[3]===9*scale))!;
    assert.ok(helmetLayer,'warning helmet has a render layer');
    const helmet=helmetLayer.commands.find(p=>p[0]==='fillCircle')!,headY=helmet[2] as number,radius=helmet[3] as number;
    const cargoTop=c.y+6*scale;
    assert.ok(headY-radius<=cargoTop-6*scale,'a visible cap clears the upper case top face');
    assert.ok(headY+radius>cargoTop,'the lower helmet remains behind the case');
    const cargo=h.layers.find(l=>l.visible&&l.commands.some(p=>p[0]==='fillEllipse'&&p[1]===c.x&&p[2]===c.y+83*scale))!;
    assert.ok(cargo.depth>helmetLayer.depth,'cargo masks the lower helmet and body');
    assert.ok(!helmetLayer.commands.some(p=>p[0]==='fillRoundedRect'),'no ducked body can leak below cargo');
    const visor=helmetLayer.commands.find(p=>p[0]==='fillRect')!;
    assert.ok(visor,'amber visor supplies a readable warning cue');
    assert.ok((visor[2] as number)+(visor[4] as number)<cargoTop,'visor stays above the occluding face');
    assert.equal(JSON.stringify(h.scene.boarding),before);
  }
});

test('cockpit perspective paints a frozen debris detour without mutating its course', () => {
  const h = harness();
  h.scene.begin({total:5,naturalOne:true}, 'Boarding Party', 'Pilot');
  const s = h.scene.boardingPilot;
  s.elapsed = 9;
  const before = JSON.stringify(s);
  freeze(s);
  h.paint();
  assert.equal(JSON.stringify(s), before);
  assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c.slice(1).every(Number.isFinite)));
  assert.ok(h.commands.some(c => c[0] === 'strokePoints'));
});

test('cockpit debris stays visible past its center plane until contact or retirement', () => {
  const h = harness();
  const config = { total: 10, naturalOne: false };
  h.scene.begin(config, 'Boarding Party', 'Pilot');
  const s: rules.BoardingPilotState = h.scene.boardingPilot;
  const asteroid = s.debris.find(rock => rock.kind === 'asteroid')!;
  s.debris = [asteroid];
  s.rings = s.rings.filter(ring => ring.time > asteroid.time);
  Object.assign(s, { elapsed: asteroid.time + .01, x: asteroid.x + 40, y: asteroid.y });
  const paintsAsteroid = () => {
    h.paint();
    return h.commands.some(c => c[0] === 'fillStyle' && c[1] === 0x4d3344);
  };

  assert.equal(paintsAsteroid(), true);
  const contact = structuredClone(s);
  rules.stepBoardingPilot(contact, config, { x: -1, y: 0 }, .05);
  assert.equal(contact.hull, 2);
  h.scene.boardingPilot = contact;
  assert.equal(paintsAsteroid(), false);

  h.scene.boardingPilot = s;
  rules.stepBoardingPilot(s, config, { x: 0, y: 0 }, .05);
  assert.equal(paintsAsteroid(), true);
  for (let i = 0; i < 4; i++) rules.stepBoardingPilot(s, config, { x: 0, y: 0 }, .05);
  assert.equal(s.hull, 3);
  assert.equal(paintsAsteroid(), false);
});

test('cockpit attack warnings remain visible in reduced motion before the hazard is live', () => {
  const h = harness();
  const config = { total: 10, naturalOne: false };
  h.scene.begin(config, 'Boarding Party', 'Pilot');
  h.setReduced(true);
  const s: rules.BoardingPilotState = h.scene.boardingPilot;
  Object.assign(s, { x: 440, elapsed: 3.99 });
  rules.stepBoardingPilot(s, config, { x: 0, y: 0 }, .05);
  assert.ok(s.attack);
  const warning = () => h.commands.some(c => c[0] === 'fillStyle' && c[1] === 0xff967d);
  const trail = () => h.commands.some(c => c[0] === 'lineStyle' && c[2] === 0xff803e);
  h.paint();
  assert.ok(warning());
  assert.equal(trail(), false);
  s.elapsed = s.attack.launchAt + .2;
  freeze(s);
  h.paint();
  assert.ok(warning());
  assert.ok(trail());
});

test('Boarding Gunner renders projected targets and shot cues with frozen state, reduced motion, and missing art', () => {
  const h = harness(), labels: string[] = [];
  h.scene.add.text = () => {
    const label: any = new Proxy({}, { get: (_, name) => (...args: any[]) => {
      if (name === 'setText') labels.push(args[0]);
      return label;
    } });
    return label;
  };
  h.scene.begin({ total: 5, naturalOne: true }, 'Boarding Party', 'Gunner');
  const s: rules.BoardingState = h.scene.boarding;
  Object.assign(s, { beamTime: .06, beamX: 130, beamY: 300, hitFlash: .1, hitX: 130, hitY: 300,
    crosshairX: 130, crosshairY: 300, cooldown: .7, grace: .8, impactFlash: .2, breaches: 1 });
  s.pods = [
    { id: 1, kind: 'probe', x: 23, y: 470, vx: 8, vy: -100, radius: 12, hp: 1, maxHp: 1, warningRemaining: .4, hitFlash: 0 },
    { id: 2, kind: 'shuttle', x: 457, y: 185, vx: -8, vy: -100, radius: 18, hp: 1, maxHp: 2, warningRemaining: 0, hitFlash: 0 },
  ];
  const before = JSON.stringify(s);
  freeze(s);
  h.setReduced(true);
  h.paint();
  const poses = [rules.boardingTurretPose(s.carrier, rules.BOARDING_CARRIER_RADIUS),
    ...s.pods.map(p => rules.boardingTurretPose(p, p.radius))];
  assert.ok(poses[2].scale > poses[1].scale * 2);
  assert.ok(poses[2].y > poses[1].y);
  const rings = [...poses.map(p => [p.x, p.y, p.aimRadius]), [130, 300, 14]];
  for (const [x, y, radius] of rings) {
    assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[1] === x && c[2] === y && c[3] === radius));
  }
  assert.ok(h.commands.some(c => c[0] === 'lineBetween' && c[1] === 240 && c[2] === 449 && c[3] === 130 && c[4] === 300));
  assert.ok(h.commands.some(c => c[0] === 'lineBetween' && c[1] === 124 && c[2] === 294 && c[3] === 118 && c[4] === 288));
  assert.ok(h.commands.some(c => c[0] === 'lineStyle' && c[2] === 0xff6862));
  for (const [pose, color] of [[poses[1], 0xffc080], [poses[2], 0xff786e]] as const) {
    assert.ok(h.commands.some((c, i) => c[0] === 'strokeCircle' && c[1] === pose.x && c[2] === pose.y &&
      h.commands[i - 1]?.[0] === 'lineStyle' && h.commands[i - 1]?.[2] === color));
  }
  for (const label of ['COOLING', 'BREACHES 1', 'CARRIER 36/36']) assert.ok(labels.includes(label));
  assert.ok(!labels.includes('LAUNCH') && !labels.includes('BREACH'));
  assert.equal(JSON.stringify(s), before);

  h.scene.boarding = freeze({ ...s, carrier: { ...s.carrier, hp: 0 }, cooldown: 0, disabled: true });
  h.paint();
  assert.ok(labels.includes('CARRIER DISABLED') && labels.includes('READY'));
  assert.ok(h.commands.some(c => c[0] === 'strokeCircle' && c[1] === poses[2].x && c[2] === poses[2].y && c[3] === poses[2].aimRadius));
  assert.ok(!h.commands.some(c => c[0] === 'strokeCircle' && c[1] === poses[0].x && c[2] === poses[0].y && c[3] === poses[0].aimRadius));
});

test('Boarding Bomber projects the real landing, live mine and blast footprints with either Natural 1 setting', () => {
  const h = harness(), labels: string[] = [];
  h.scene.drawLabel = (text: string) => labels.push(text);
  for (const naturalOne of [false, true]) {
    const config = { total: 10, naturalOne };
    h.scene.begin(config, 'Boarding Party', 'Bomber');
    const state: rules.BoardingState = h.scene.boarding;
    state.x = 325;
    state.elapsed = 1;
    const rack = rules.mineDropPosition(state), landing = rules.spaceBomberLanding(state);
    const expected = structuredClone(state);
    rules.stepBoarding(expected, config, { x: 0, y: 0, firing: false, placing: true }, .05, () => .5);
    state.pods = [{ id: 20, kind: 'shuttle', x: 290, y: 230, vx: 0, vy: -100, radius: 18, hp: 1, maxHp: 2, warningRemaining: .4, hitFlash: 0 }];
    const { blastRadius } = expected.mines[0];
    const live = { id: 21, x: 285, y: 300, blastRadius, armIn: 0, expiresIn: 2 };
    const impact = { x: 355, y: 310, radius: blastRadius, remaining: .14 };
    state.mines = [live];
    state.explosions = [impact];
    freeze(state);
    for (const reduced of [false, true]) {
      h.setReduced(reduced);
      h.paint();
      const pod = aftView.projectAftPoint(state.pods[0], rack);
      assert.ok(h.commands.some((c, i) => c[0] === 'strokeCircle' && c[1] === pod.x && c[2] === pod.y &&
        h.commands[i - 1]?.[0] === 'lineStyle' && h.commands[i - 1]?.[2] === 0xffa6af));
      assert.ok(labels.includes('BREACH LINE'));
      assert.ok(!labels.includes('LAUNCH') && !labels.includes('BREACH'));
      const outlines = h.commands.filter(([name]) => name === 'strokePoints').map(c => c[1] as { x: number; y: number }[]);
      for (const center of [landing, live, impact]) {
        assert.ok(outlines.some(outline => outline.length === 48 && outline.every(point => {
          const world = aftView.unprojectAftAim(point, rack);
          return world && Math.abs(Math.hypot(world.x - center.x, world.y - center.y) - blastRadius) < 1e-9;
        })), 'the outline projects the exact world-space radius');
      }
      const commands = structuredClone(h.commands);
      h.scene.activeFlight = false;
      h.commands.length = 0; h.scene.update(90000, 1000);
      assert.deepEqual(structuredClone(h.commands), commands, 'pause freezes the cockpit and blast animation');
    }
    const near = aftView.projectAftPoint({ x: rack.x, y: rack.y + 15 }, rack);
    const far = aftView.projectAftPoint({ x: rack.x, y: rack.y + 240 }, rack);
    assert.ok(near.y > far.y && near.scale > far.scale, 'a closing craft grows as it moves toward the rack');
  }
});
