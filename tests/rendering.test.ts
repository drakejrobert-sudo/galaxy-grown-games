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
