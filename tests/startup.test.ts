import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as rules from '../src/game/rules.ts';

test('first launch waits for scene creation before starting simulation; retry reuses game', () => {
  const elements = new Map<string, any>();
  function element(id: string): any {
    if (!elements.has(id)) elements.set(id, { hidden: false, value: '', checked: false,
      textContent: '', listeners: new Map(), attributes: new Map(), focus() {},
      setAttribute(name: string, value: string) { this.attributes.set(name, value); },
      addEventListener(type: string, listener: Function) { this.listeners.set(type, listener); },
    });
    return elements.get(id);
  }
  let gameCount = 0;
  let readyScene: any;
  const graphics: any = new Proxy({}, { get: () => () => graphics });
  // Like Phaser, scene plugins are absent before Game initializes the scene.
  class Scene {}
  class Game {
    scale = { refresh() {} };
    constructor(config: any) {
      gameCount++;
      readyScene = config.scene[0];
      assert.equal(readyScene.events, undefined);
      readyScene.add = { graphics: () => graphics };
      readyScene.events = {};
      readyScene.create();
    }
  }
  const phaser = { Scene, Game, CANVAS: 1, Scale: { FIT: 1, CENTER_BOTH: 1 } };
  function load(path: string, modules: Record<string, any>, globals = {}) {
    const exports = {};
    const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    runInNewContext(js, { exports, require: (name: string) => {
      assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name];
    }, console, ...globals });
    return exports as any;
  }
  const scenes = load('../src/game/scene.ts', { phaser, './rules': rules });
  let inputEnabled = false, gunnerInputEnabled = false, bomberInputEnabled = false, lifeSupportInputEnabled = false;
  load('../src/main.ts', { phaser, './style.css': {}, './bomber.css': {}, './game/scene': scenes,
    './game/rules': rules, './game/input': {
      createInput: () => ({ read: () => ({ x: 1, y: 0 }), enable: (v: boolean) => inputEnabled = v }),
      createGunnerInput: () => ({ read: () => ({ firing: false }), enable: (v: boolean) => gunnerInputEnabled = v }),
      createBomberInput: () => ({ read: () => ({ x: 1, y: 0, placing: true }), enable: (v: boolean) => bomberInputEnabled = v }),
      createLifeSupportInput: () => ({ read: () => ({ route: 'Shields' }), enable: (v: boolean) => lifeSupportInputEnabled = v, reset() {} }),
    },
  }, {
    document: { querySelector: () => element('app'), getElementById: element, addEventListener() {} },
    window: { addEventListener() {} }, navigator: {},
  });
  element('situation').value = 'Asteroid Field'; element('role').value = 'Pilot';
  element('total').value = '17'; element('natural-one').checked = true;
  const submit = () => element('flight-form').listeners.get('submit')({ preventDefault() {} });
  submit();
  assert.equal(gameCount, 1); assert.equal(readyScene.activeFlight, true); assert.equal(inputEnabled, true);
  assert.match(element('flight-status').textContent, /Very Easy.*Natural 1/);
  const oldX = readyScene.flight.x;
  readyScene.update(0, 16);
  assert.ok(readyScene.flight.x > oldX); assert.ok(readyScene.flight.elapsed > 0);
  element('pause').listeners.get('click')();
  const elapsed = readyScene.flight.elapsed; readyScene.update(0, 16);
  assert.equal(readyScene.flight.elapsed, elapsed); assert.equal(inputEnabled, false);
  element('resume').listeners.get('click')(); readyScene.update(0, 16);
  assert.ok(readyScene.flight.elapsed > elapsed);
  element('abandon').listeners.get('click')();
  element('role').value = 'Gunner'; submit();
  assert.equal(gameCount, 1); assert.equal(readyScene.gunner.elapsed, 0);
  assert.equal(inputEnabled, false); assert.equal(gunnerInputEnabled, true);
  readyScene.update(0, 16); assert.ok(readyScene.gunner.elapsed > 0);
  assert.match(element('flight-status').textContent, /Very Easy.*overheated gun/);
  element('abandon').listeners.get('click')();
  element('role').value = 'Bomber'; submit();
  assert.equal(gameCount, 1); assert.equal(bomberInputEnabled, true);
  readyScene.update(0, 16); assert.ok(readyScene.bomber.elapsed > 0);
  assert.equal(readyScene.bomber.minesPlaced, 1);
  assert.match(element('flight-status').textContent, /Very Easy.*half-area mine blast target/);
  assert.equal(element('action').hidden, false);
  element('abandon').listeners.get('click')();
  element('role').value = 'Life Support'; submit();
  assert.equal(gameCount, 1); assert.equal(lifeSupportInputEnabled, true);
  readyScene.lifeSupport.spawnIn = 100;
  readyScene.lifeSupport.packets = [{id:1,x:240,y:404,speed:100,target:'Shields',kind:'power'}];
  readyScene.update(0, 16); assert.equal(readyScene.lifeSupport.routed, 1);
  assert.match(element('flight-status').textContent, /Very Easy.*half hearts and extra overloads/);
  assert.equal(element('route-controls').hidden, false);
  assert.equal(element('health-label').textContent, 'INTEGRITY');
  element('abandon').listeners.get('click')();
  element('situation').value = 'Space Battle'; element('role').value = 'Gunner';
  element('situation').listeners.get('change')();
  assert.equal(element('role-gunner').disabled, true);
  assert.equal(element('role-bomber').disabled, true);
  assert.equal(element('role-life-support').disabled, true);
  assert.equal(element('role').value, 'Pilot');
  submit();
  assert.equal(gameCount, 1); assert.equal(readyScene.situation, 'Space Battle');
  assert.equal(inputEnabled, true); assert.equal(gunnerInputEnabled, false);
  readyScene.update(0, 16); assert.ok(readyScene.spacePilot.elapsed > 0);
  assert.match(element('mode-label').textContent, /SPACE BATTLE \/ PILOT/);
  readyScene.spacePilot.enemies = [{id:1,x:120,y:120,radius:16,speed:100,vx:10,shotIn:1}];
  readyScene.spacePilot.shots = [{x:130,y:150,vx:30,vy:100,radius:5}];
  readyScene.spacePilot.fuelCells = [{id:2,x:220,y:180,radius:11,speed:90,value:8}];
  readyScene.activeFlight = false;
  const beforePaint = JSON.stringify(readyScene.spacePilot);
  readyScene.update(0, 16);
  assert.equal(JSON.stringify(readyScene.spacePilot), beforePaint);
});
