import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as rules from '../src/game/rules.ts';

function tick(scene: any, milliseconds: number) {
  scene.game.loop.rawDelta = milliseconds;
  if (scene.activeFlight && !scene.timingPrimed) scene.update(0, milliseconds);
  scene.update(0, milliseconds);
}
function inputModule(factories: Record<string, Function>) {
  return Object.fromEntries(Object.entries(factories).map(([name, factory]) => [name, (...args: unknown[]) => {
    const input = factory(...args);
    return { ...input, readFrame() { const first = input.read(); return { first, continued: first }; } };
  }]));
}

test('deferred first launch recovers from load failure, starts once, and retry reuses game', async () => {
  const elements = new Map<string, any>();
  const windowListeners = new Map<string, Function>();
  function element(id: string): any {
    if (!elements.has(id)) elements.set(id, { hidden: false, value: '', checked: false,
      textContent: '', listeners: new Map(), attributes: new Map(), style: {}, scrollHeight: 260,
      getBoundingClientRect: () => ({ width: 480, height: 560 }),
      focus() {}, select() { this.selected = true; },
      setAttribute(name: string, value: string) { this.attributes.set(name, value); },
      replaceChildren() {},
      addEventListener(type: string, listener: Function) { this.listeners.set(type, listener); },
    });
    return elements.get(id);
  }
  let gameCount = 0;
  let gameShouldFail = false;
  let readyScene: any;
  const scaleRefreshRailStates: boolean[] = [];
  const graphics: any = new Proxy({}, { get: () => () => graphics });
  // Like Phaser, scene plugins are absent before Game initializes the scene.
  class Scene {}
  class Game {
    loop = { rawDelta: 16 };
    scale = { getParentBounds() {}, refresh: () => {
      const selectedRole = element('role').value;
      assert.equal(element('play').attributes.get('data-role'), selectedRole);
      assert.equal(element('action-rail').hidden, selectedRole !== 'Bomber' && !(selectedRole === 'Gunner' && element('situation').value === 'Space Battle'));
      scaleRefreshRailStates.push(element('action-rail').hidden);
    } };
    constructor(config: any) {
      if (gameShouldFail) throw new Error('renderer unavailable');
      gameCount++;
      readyScene = config.scene[0];
      readyScene.game = this;
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
      assert.ok(name in modules, `Unexpected import: ${name}`); return name === './game/input' ? inputModule(modules[name]) : modules[name];
    }, console, ...globals });
    return exports as any;
  }
  const scenes = load('../src/game/scene.ts', { phaser, './rules': rules });
  let spaceGunnerInputEnabled = false;
  let inputEnabled = false, gunnerInputEnabled = false, bomberInputEnabled = false;
  let spaceBomberInputEnabled = false, lifeSupportInputEnabled = false, spaceLifeInputEnabled = false;
  let runtimeImports = 0;
  let runtimeShouldFail = true;
  let copyShouldFail = false;
  let copiedText = '';
  load('../src/main.ts', { './style.css': {}, './bomber.css': {},
    get './game/runtime'() {
      runtimeImports++;
      if (runtimeShouldFail) throw new Error('offline');
      return { Phaser: phaser, FlightScene: scenes.FlightScene };
    },
    './game/rules': rules, './game/input': {
      createInput: () => ({ read: () => ({ x: 1, y: 0 }), enable: (v: boolean) => inputEnabled = v }),
      createSpaceGunnerInput: () => ({ read: () => ({ x: 1, y: 0, firing: true }), enable: (v: boolean) => spaceGunnerInputEnabled = v }),
      createGunnerInput: () => ({ read: () => ({ firing: false }), enable: (v: boolean) => gunnerInputEnabled = v }),
      createBomberInput: () => ({ read: () => ({ x: 1, y: 0, placing: true }), enable: (v: boolean) => bomberInputEnabled = v }),
      createSpaceBomberInput: () => ({ read: () => ({ placing: true }), enable: (v: boolean) => spaceBomberInputEnabled = v }),
      createLifeSupportInput: () => ({ read: () => ({ route: 'Shields' }), enable: (v: boolean) => lifeSupportInputEnabled = v, reset() {} }),
      createSpaceLifeInput: () => ({ read: () => ({ x: 0, jump: false }), enable: (v: boolean) => spaceLifeInputEnabled = v }),
    },
  }, {
    document: { querySelector: () => element('app'), getElementById: element, addEventListener() {} },
    window: { addEventListener(type: string, listener: Function) { windowListeners.set(type, listener); } },
    navigator: { clipboard: { async writeText(text: string) {
      if (copyShouldFail) throw new Error('clipboard denied');
      copiedText = text;
    } } }, console: { error() {} },
  });
  element('situation').value = 'Asteroid Field'; element('role').value = 'Pilot';
  element('total').value = '17'; element('natural-one').checked = true;
  const submit = () => element('flight-form').listeners.get('submit')({ preventDefault() {} });
  await submit();
  assert.equal(gameCount, 0);
  assert.equal(element('setup').hidden, false);
  assert.match(element('error').textContent, /Try again/);
  assert.equal(element('start').disabled, false);
  runtimeShouldFail = false;
  gameShouldFail = true;
  await submit();
  assert.equal(gameCount, 0);
  assert.equal(element('setup').hidden, false);
  assert.match(element('error').textContent, /Try again/);
  assert.equal(element('start').disabled, false);
  gameShouldFail = false;
  const firstStart = submit();
  assert.equal(gameCount, 0);
  assert.equal(element('start').disabled, true);
  assert.match(element('load-status').textContent, /Preparing the game/);
  await Promise.all([firstStart, submit()]);
  assert.equal(runtimeImports, 3);
  assert.equal(gameCount, 1); assert.equal(readyScene.activeFlight, true); assert.equal(inputEnabled, true);
  assert.equal(element('start').disabled, false);
  assert.equal(element('load-status').textContent, '');
  assert.match(element('flight-status').textContent, /Very Easy.*Natural 1/);
  const oldX = readyScene.flight.x;
  tick(readyScene, 16);
  assert.ok(readyScene.flight.x > oldX); assert.ok(readyScene.flight.elapsed > 0);
  const beforeInterruption = JSON.stringify(readyScene.flight);
  tick(readyScene, 251);
  assert.equal(JSON.stringify(readyScene.flight), beforeInterruption);
  assert.equal(element('pause-overlay').hidden, false);
  assert.equal(inputEnabled, false);
  assert.equal(element('pause-reason').textContent, 'Play paused after an interruption. Resume when ready.');
  element('resume').listeners.get('click')();
  readyScene.game.loop.rawDelta = 5000; readyScene.update(0, 16);
  assert.equal(JSON.stringify(readyScene.flight), beforeInterruption);
  assert.equal(element('pause-reason').textContent, 'Your timer is stopped.');

  element('pause').listeners.get('click')();
  const elapsed = readyScene.flight.elapsed; tick(readyScene, 16);
  assert.equal(readyScene.flight.elapsed, elapsed); assert.equal(inputEnabled, false);
  element('resume').listeners.get('click')(); tick(readyScene, 16);
  assert.ok(readyScene.flight.elapsed > elapsed);
  element('abandon').listeners.get('click')();
  element('role').value = 'Gunner'; await submit();
  assert.equal(gameCount, 1); assert.equal(readyScene.gunner.elapsed, 0);
  assert.equal(inputEnabled, false); assert.equal(gunnerInputEnabled, true);
  tick(readyScene, 16); assert.ok(readyScene.gunner.elapsed > 0);
  assert.match(element('flight-status').textContent, /Very Easy.*overheated gun/);
  element('abandon').listeners.get('click')();
  element('role').value = 'Bomber'; await submit();
  assert.equal(gameCount, 1); assert.equal(bomberInputEnabled, true);
  tick(readyScene, 16); assert.ok(readyScene.bomber.elapsed > 0);
  assert.equal(readyScene.bomber.minesPlaced, 1);
  assert.equal(readyScene.bomber.x, rules.automaticShipX(readyScene.bomber.elapsed));
  assert.equal(readyScene.bomber.mines[0].x, readyScene.bomber.x);
  assert.match(element('play-help').textContent, /Time your mine drops/);
  element('pause').listeners.get('click')();
  const pausedBomber = JSON.stringify(readyScene.bomber);
  tick(readyScene, 50);
  assert.equal(JSON.stringify(readyScene.bomber), pausedBomber);
  assert.equal(bomberInputEnabled, false);
  element('resume').listeners.get('click')();
  assert.equal(bomberInputEnabled, true);
  assert.match(element('flight-status').textContent, /Very Easy.*half-area mine blast target/);
  assert.equal(element('action').hidden, false);
  assert.equal(element('action-rail').hidden, false);
  assert.equal(scaleRefreshRailStates.at(-1), false);
  element('abandon').listeners.get('click')();
  element('role').value = 'Life Support'; element('role').listeners.get('change')();
  assert.match(element('controls-help').textContent, /hearts go to Shields and overloads to Guns/);
  assert.match(element('app').innerHTML, /Packets route when they reach the switch/);
  await submit();
  assert.equal(gameCount, 1); assert.equal(lifeSupportInputEnabled, true);
  assert.equal(element('routing-info').hidden, false);
  assert.match(element('routing-status').textContent, /Waiting for a packet.*Shields/);
  assert.equal(element('route-shields').attributes.get('aria-pressed'), 'true');
  readyScene.lifeSupport.spawnIn = 100;
  readyScene.lifeSupport.packets = [{id:1,x:240,y:404,speed:100,target:'Shields',kind:'power'}];
  tick(readyScene, 16); assert.equal(readyScene.lifeSupport.routed, 1);
  assert.match(element('routing-status').textContent, /Power → Shields.*Integrity 0/);
  readyScene.lifeSupport.packets = [{id:2,x:240,y:404,speed:100,target:'Guns',kind:'overload'}];
  tick(readyScene, 16);
  assert.match(element('routing-status').textContent, /misrouted to Shields.*Needed Guns.*Integrity -2/);
  assert.equal(element('routing-status').attributes.get('data-outcome'), 'incorrect');
  readyScene.lifeSupport.packets = [{id:3,x:240,y:404,speed:100,target:'Shields',kind:'heart'}];
  tick(readyScene, 16);
  assert.match(element('routing-status').textContent, /Heart → Shields.*Integrity \+1/);
  readyScene.lifeSupport.integrity = 5;
  readyScene.lifeSupport.packets = [{id:4,x:240,y:404,speed:100,target:'Shields',kind:'heart'}];
  tick(readyScene, 16);
  assert.match(element('routing-status').textContent, /Already full.*Integrity 0/);
  element('abandon').listeners.get('click')(); await submit();
  assert.match(element('routing-status').textContent, /Waiting for a packet.*Shields/);
  assert.match(element('flight-status').textContent, /Very Easy.*half hearts and extra overloads/);
  assert.equal(element('route-controls').hidden, false);
  assert.equal(element('health-label').textContent, 'INTEGRITY');
  element('abandon').listeners.get('click')();
  element('situation').value = 'Space Battle'; element('role').value = 'Gunner';
  element('situation').listeners.get('change')();
  assert.equal(element('role-gunner').disabled, false);
  assert.equal(element('role-bomber').disabled, false);
  assert.equal(element('role-life-support').disabled, false);
  assert.equal(element('role').value, 'Gunner');
  assert.match(element('controls-help').textContent, /touch aim never fires/);
  await submit();
  assert.equal(element('routing-info').hidden, true);
  assert.equal(spaceGunnerInputEnabled, true); assert.equal(gunnerInputEnabled, false);
  assert.equal(element('fire-action').textContent, 'Fire'); assert.equal(element('action').hidden, true);
  assert.equal(element('action-rail').hidden, false); assert.equal(scaleRefreshRailStates.at(-1), false);
  assert.equal(element('fuel-wrap').hidden, true);
  readyScene.spaceGunner.spawnIn = 100;
  tick(readyScene, 50); assert.equal(readyScene.spaceGunner.shots, 1);
  element('pause').listeners.get('click')();
  const frozenGunner = JSON.stringify(readyScene.spaceGunner);
  tick(readyScene, 50); assert.equal(JSON.stringify(readyScene.spaceGunner), frozenGunner);
  assert.equal(spaceGunnerInputEnabled, false);
  element('resume').listeners.get('click')(); assert.equal(spaceGunnerInputEnabled, true);
  windowListeners.get('blur')!(); assert.equal(spaceGunnerInputEnabled, false);
  element('resume').listeners.get('click')();
  readyScene.spaceGunner.hull = 0; readyScene.spaceGunner.finished = true; readyScene.spaceGunner.endReason = 'hull';
  readyScene.onSpaceGunnerStep(readyScene.spaceGunner);
  assert.equal(spaceGunnerInputEnabled, false); assert.equal(element('results').hidden, false);
  assert.match(element('summary').value, /Space Battle \/ Gunner/);
  assert.match(element('summary').value, /Projectiles intercepted: 0/);
  assert.match(element('summary').value, /Hull depleted/);
  element('again').listeners.get('click')(); await submit();
  assert.equal(readyScene.spaceGunner.shots, 0); assert.equal(readyScene.spaceGunner.hull, 3);
  readyScene.spaceGunner.elapsed = 60; readyScene.spaceGunner.finished = true; readyScene.spaceGunner.endReason = 'time';
  readyScene.onSpaceGunnerStep(readyScene.spaceGunner);
  assert.equal(element('outcome').textContent, 'Defense complete.');
  assert.match(element('summary').value, /Time: 60.0s/);
  assert.equal(spaceGunnerInputEnabled, false);
  element('abandon').listeners.get('click')(); element('role').value = 'Pilot';
  await submit();
  assert.equal(gameCount, 1); assert.equal(readyScene.situation, 'Space Battle');
  assert.equal(inputEnabled, true); assert.equal(gunnerInputEnabled, false);
  tick(readyScene, 16); assert.ok(readyScene.spacePilot.elapsed > 0);
  assert.match(element('mode-label').textContent, /SPACE BATTLE \/ PILOT/);
  readyScene.spacePilot.enemies = [{id:1,x:120,y:120,radius:16,speed:100,vx:10,shotIn:1}];
  readyScene.spacePilot.shots = [{x:130,y:150,vx:30,vy:100,radius:5}];
  readyScene.spacePilot.fuelCells = [{id:2,x:220,y:180,radius:11,speed:90,value:8}];
  readyScene.activeFlight = false;
  const beforePaint = JSON.stringify(readyScene.spacePilot);
  tick(readyScene, 16);
  assert.equal(JSON.stringify(readyScene.spacePilot), beforePaint);
  element('abandon').listeners.get('click')(); element('role').value = 'Bomber'; await submit();
  assert.equal(spaceBomberInputEnabled, true); assert.equal(inputEnabled, false);
  assert.equal(element('fire-action').hidden, true); assert.equal(element('action').hidden, false);
  assert.equal(element('fuel-wrap').hidden, true);
  tick(readyScene, 16); assert.ok(readyScene.spaceBomber.elapsed > 0);
  assert.equal(readyScene.spaceBomber.minesPlaced, 1);
  assert.match(element('mode-label').textContent, /SPACE BATTLE \/ BOMBER/);
  assert.match(element('play-help').textContent, /Automatic weaving/);
  assert.equal(readyScene.spaceBomber.x, rules.automaticShipX(readyScene.spaceBomber.elapsed));
  element('pause').listeners.get('click')();
  const pausedSpaceBomber = JSON.stringify(readyScene.spaceBomber);
  tick(readyScene, 50);
  assert.equal(JSON.stringify(readyScene.spaceBomber), pausedSpaceBomber);
  assert.equal(spaceBomberInputEnabled, false);
  element('resume').listeners.get('click')();
  assert.equal(spaceBomberInputEnabled, true);
  readyScene.spaceBomber.finished = true;
  readyScene.onSpaceBomberStep(readyScene.spaceBomber);
  assert.equal(element('results').hidden, false);
  assert.match(element('summary').value, /Space Battle \/ Bomber/);
  assert.match(element('summary').value, /Rating: \d+\/100 • Advisory band:/);
  assert.equal(element('final-score').textContent, String(rules.rateScore('space-bomber', rules.spaceBattleBomberScoreFor(readyScene.spaceBomber), false).rating));
  assert.match(element('rating-band').textContent, /Setback|Mixed|Success|Exceptional/);
  assert.match(element('raw-points').textContent, /raw points/);
  assert.equal(element('summary').style.height, '260px');
  element('summary').scrollHeight = 310;
  windowListeners.get('resize')!();
  assert.equal(element('summary').style.height, '310px');
  await element('copy').listeners.get('click')();
  assert.equal(copiedText, element('summary').value);
  copyShouldFail = true;
  await element('copy').listeners.get('click')();
  assert.equal(element('summary').selected, true);
  assert.match(element('copy-status').textContent, /Copy it manually/);
  element('again').listeners.get('click')();
  element('role').value = 'Life Support'; await submit();
  assert.equal(spaceLifeInputEnabled, true);
  assert.equal(element('platform-controls').hidden, false);
  assert.equal(element('route-controls').hidden, true);
  assert.equal(element('health-label').textContent, 'INTEGRITY');
  readyScene.spaceLife.fireIn = readyScene.spaceLife.iconIn = 100;
  readyScene.spaceLife.fires = [{ id: 1, x: 150, y: 520, kind: 'electrical', remaining: 8, sparkIn: 100 }];
  tick(readyScene, 16);
  assert.equal(readyScene.spaceLife.electricalRepaired, 0);
  assert.ok(readyScene.spaceLife.fires[0].repairProgress > 0);
  const partial = JSON.stringify(readyScene.spaceLife);
  element('pause').listeners.get('click')(); tick(readyScene, 50);
  assert.equal(JSON.stringify(readyScene.spaceLife), partial);
  element('resume').listeners.get('click')();
  for (let i = 0; i < 30; i++) tick(readyScene, 50);
  assert.equal(readyScene.spaceLife.electricalRepaired, 1);
  readyScene.spaceLife.sparks = [{ id: 5, x: 260, y: 506, vx: -165, remaining: 3 }];
  readyScene.spaceLife.fires = [{ id: 6, x: 395, y: 520, kind: 'electrical', remaining: 6, sparkIn: .4 },
    { id: 7, x: 85, y: 520, kind: 'ordinary', remaining: 6, arming: .3 }];
  element('pause').listeners.get('click')();
  const pausedSpaceLife = JSON.stringify(readyScene.spaceLife);
  tick(readyScene, 50);
  assert.equal(JSON.stringify(readyScene.spaceLife), pausedSpaceLife);
  assert.equal(spaceLifeInputEnabled, false);
  element('resume').listeners.get('click')();
  assert.equal(spaceLifeInputEnabled, true);
  readyScene.spaceLife.integrity = 0;
  readyScene.spaceLife.finished = true;
  readyScene.onSpaceLifeStep(readyScene.spaceLife);
  assert.equal(spaceLifeInputEnabled, false);
  assert.match(element('summary').value, /Space Battle \/ Life Support/);
  assert.match(element('summary').value, /Electrical repairs: 1/);
});

test('a deferred launch stays paused after switching away until explicit resume', async () => {
  function startup(spaceGunner = false) {
    const elements = new Map<string, any>();
    const windowListeners = new Map<string, Function>();
    const documentListeners = new Map<string, Function>();
    let hidden = false;
    let failImport = false;
    let inputEnabled = false;
    let spaceGunnerInputEnabled = false;
    let scene: any;
    const graphics: any = new Proxy({}, { get: () => () => graphics });
    function element(id: string): any {
      if (!elements.has(id)) elements.set(id, { hidden: false, value: '', checked: false,
        textContent: '', listeners: new Map(), attributes: new Map(), focus() {}, replaceChildren() {},
        getBoundingClientRect: () => ({ width: 480, height: 560 }),
        setAttribute(name: string, value: string) { this.attributes.set(name, value); },
        addEventListener(type: string, listener: Function) { this.listeners.set(type, listener); },
      });
      return elements.get(id);
    }
    class Scene {}
    class Game {
      loop = { rawDelta: 16 };
      scale = { getParentBounds() {}, refresh() {} };
      constructor(config: any) {
        scene = config.scene[0];
        scene.game = this;
        scene.add = { graphics: () => graphics };
        scene.events = {};
        // Phaser boot is deliberately delayed until the test calls scene.create().
      }
    }
    const phaser = { Scene, Game, CANVAS: 1, Scale: { FIT: 1, CENTER_BOTH: 1 } };
    function load(path: string, modules: Record<string, any>, globals = {}) {
      const exports: any = {};
      const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText;
      runInNewContext(js, { exports, require: (name: string) => {
        assert.ok(name in modules, `Unexpected import: ${name}`);
        return name === './game/input' ? inputModule(modules[name]) : modules[name];
      }, console: { error() {} }, ...globals });
      return exports;
    }
    const sceneExports = load('../src/game/scene.ts', { phaser, './rules': rules });
    const idleInput = () => ({ read: () => ({}), enable() {}, reset() {} });
    load('../src/main.ts', { './style.css': {}, './bomber.css': {}, './game/rules': rules,
      get './game/runtime'() {
        if (failImport) throw new Error('offline');
        return { Phaser: phaser, FlightScene: sceneExports.FlightScene };
      },
      './game/input': {
        createInput: () => ({ read: () => ({ x: 0, y: 0 }), enable: (value: boolean) => inputEnabled = value }),
        createSpaceGunnerInput: () => ({ read: () => ({ x: 0, y: 0, firing: false }), enable: (v: boolean) => spaceGunnerInputEnabled = v }), createGunnerInput: idleInput, createBomberInput: idleInput,
        createSpaceBomberInput: idleInput, createLifeSupportInput: idleInput, createSpaceLifeInput: idleInput,
      },
    }, {
      document: { querySelector: () => element('app'), getElementById: element,
        addEventListener: (type: string, listener: Function) => documentListeners.set(type, listener),
        get hidden() { return hidden; },
      },
      window: { addEventListener: (type: string, listener: Function) => windowListeners.set(type, listener) },
      navigator: {},
    });
    element('total').value = '17'; element('role').value = spaceGunner ? 'Gunner' : 'Pilot'; element('situation').value = spaceGunner ? 'Space Battle' : 'Asteroid Field';
    return {
      element, windowListeners, documentListeners, get scene() { return scene; },
      get inputEnabled() { return spaceGunner ? spaceGunnerInputEnabled : inputEnabled; },
      setHidden(value: boolean) { hidden = value; },
      setFailImport(value: boolean) { failImport = value; },
      submit: () => element('flight-form').listeners.get('submit')({ preventDefault() {} }),
    };
  }

  for (const spaceGunner of [false, true]) for (const awayDuring of ['import', 'boot', 'visibility', 'hidden-at-ready']) {
    const page = startup(spaceGunner);
    const submission = page.submit();
    if (awayDuring === 'import') page.windowListeners.get('blur')!();
    await submission;
    assert.ok(page.scene, 'Phaser Game constructed before delayed scene readiness');
    if (awayDuring === 'boot') page.windowListeners.get('blur')!();
    if (awayDuring === 'visibility') {
      page.setHidden(true);
      page.documentListeners.get('visibilitychange')!();
      page.setHidden(false);
    }
    // Return before readiness for latched cases, or remain hidden to check readiness itself.
    page.setHidden(awayDuring === 'hidden-at-ready');
    page.scene.create();
    assert.equal(page.scene.activeFlight, false, awayDuring);
    assert.equal(page.inputEnabled, false, awayDuring);
    assert.equal(page.element('pause-overlay').hidden, false, awayDuring);
    tick(page.scene, 16);
    assert.equal((spaceGunner ? page.scene.spaceGunner : page.scene.flight).elapsed, 0, awayDuring);
    page.setHidden(false);
    page.element('resume').listeners.get('click')();
    assert.equal(page.scene.activeFlight, true, awayDuring);
    assert.equal(page.inputEnabled, true, awayDuring);
    tick(page.scene, 16);
    assert.ok((spaceGunner ? page.scene.spaceGunner : page.scene.flight).elapsed > 0, awayDuring);
  }

  const foreground = startup();
  await foreground.submit();
  foreground.scene.create();
  assert.equal(foreground.scene.activeFlight, true);
  assert.equal(foreground.element('pause-overlay').hidden, true);

  const afterFailure = startup();
  afterFailure.setFailImport(true);
  const failed = afterFailure.submit();
  afterFailure.windowListeners.get('blur')!();
  await failed;
  afterFailure.setFailImport(false);
  await afterFailure.submit();
  afterFailure.scene.create();
  assert.equal(afterFailure.scene.activeFlight, true);
  assert.equal(afterFailure.element('pause-overlay').hidden, true);
});

test('space battle bomber cooldown dial shares the simulation constant', () => {
  const scene = readFileSync(new URL('../src/game/scene.ts', import.meta.url), 'utf8');

  assert.match(scene, /mineCooldown \/ SPACE_BOMBER_MINE_COOLDOWN/);
  assert.doesNotMatch(scene, /missileCooldown/);
});
