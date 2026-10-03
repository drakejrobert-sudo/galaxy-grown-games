import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as rules from '../src/game/rules.ts';

function startup() {
  const elements = new Map<string, any>();
  const frames = new Map<number, Function>();
  const inputCalls: boolean[] = [];
  const sizingCalls: string[] = [];
  let width = 480, height = 560, nextFrame = 0, gameCount = 0;
  let observerCallback: Function;
  let scene: any;
  function element(id: string): any {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, value: '', checked: false, textContent: '', attributes: new Map(),
      listeners: new Map(), style: {}, scrollHeight: 260,
      focus() {}, replaceChildren() {},
      getBoundingClientRect: () => ({ width: element('play').hidden ? 0 : width, height: element('play').hidden ? 0 : height }),
      setAttribute(name: string, value: string) { this.attributes.set(name, value); },
      addEventListener(name: string, callback: Function) { this.listeners.set(name, callback); },
    });
    return elements.get(id);
  }
  // Model Phaser's stale-cache failure: refresh sizes first, then remeasures.
  const scale = {
    parentWidth: 0, displayWidth: 0,
    getParentBounds() {
      sizingCalls.push('measure');
      this.parentWidth = element('canvas').getBoundingClientRect().width;
    },
    refresh() {
      sizingCalls.push('refresh');
      assert.equal(element('play').hidden, false);
      assert.equal(element('play').attributes.get('data-role'), element('role').value);
      const rail = element('role').value === 'Bomber' || (element('role').value === 'Gunner' && element('situation').value === 'Space Battle');
      assert.equal(element('action-rail').hidden, !rail);
      this.displayWidth = this.parentWidth;
      this.getParentBounds();
    },
  };
  class Scene {}
  const graphics: any = new Proxy({}, { get: () => () => graphics });
  class Game {
    scale = scale;
    constructor(config: any) {
      gameCount++;
      assert.equal(config.width, 480); assert.equal(config.height, 560);
      scene = config.scene[0];
      scene.add = { graphics: () => graphics };
      // Delay readiness as Phaser does, until the Game reference is assigned.
    }
  }
  class ResizeObserver {
    constructor(callback: Function) { observerCallback = callback; }
    observe(target: any) { assert.equal(target, element('canvas')); }
  }
  function load(path: string, modules: Record<string, any>, globals = {}) {
    const exports: any = {};
    const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    runInNewContext(js, { exports, require: (name: string) => {
      assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name];
    }, console, ...globals });
    return exports;
  }
  const Phaser = { Scene, Game, CANVAS: 1, Scale: { FIT: 1, CENTER_BOTH: 1 } };
  const scenes = load('../src/game/scene.ts', { phaser: Phaser, './rules': rules });
  const idleInput = () => ({ read: () => ({}), enable: (enabled: boolean) => inputCalls.push(enabled), reset() {} });
  load('../src/main.ts', {
    './style.css': {}, './bomber.css': {}, './game/runtime': { Phaser, FlightScene: scenes.FlightScene },
    './game/rules': rules,
    './game/input': Object.fromEntries(['createInput', 'createGunnerInput', 'createSpaceGunnerInput', 'createBomberInput', 'createSpaceBomberInput', 'createLifeSupportInput', 'createSpaceLifeInput'].map(name => [name, idleInput])),
  }, {
    document: { querySelector: () => element('app'), getElementById: element, addEventListener() {}, hidden: false },
    window: { addEventListener() {} }, ResizeObserver,
    requestAnimationFrame: (callback: Function) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  element('total').value = '16';
  return {
    element, scale, sizingCalls, inputCalls, frames,
    get scene() { return scene; }, get gameCount() { return gameCount; },
    resize(w: number, h = w * 7 / 6) { width = w; height = h; observerCallback!(); },
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    submit: () => element('flight-form').listeners.get('submit')({ preventDefault() {} }),
  };
}

test('visible launch remeasures zero cached bounds for all modes and reuses one game', async () => {
  const page = startup();
  for (const situation of ['Asteroid Field', 'Space Battle']) for (const role of ['Pilot', 'Gunner', 'Bomber', 'Life Support']) {
    page.element('situation').value = situation; page.element('role').value = role;
    page.scale.parentWidth = page.scale.displayWidth = 0;
    page.sizingCalls.length = 0;
    await page.submit();
    if (page.gameCount === 1 && !page.scene.events) { page.scene.events = {}; page.scene.create(); }
    assert.equal(page.gameCount, 1);
    assert.equal(page.scale.displayWidth, 480, `${situation}/${role}`);
    assert.deepEqual(page.sizingCalls.slice(0, 2), ['measure', 'refresh']);
    assert.equal(page.scene.activeFlight, true);
    page.element('pause').listeners.get('click')();
    page.resize(320); assert.equal(page.frames.size, 1);
    page.element('abandon').listeners.get('click')();
    assert.equal(page.frames.size, 0, 'leaving play cancels queued work');
    const calls = page.sizingCalls.length;
    page.resize(390); page.flush();
    assert.equal(page.sizingCalls.length, calls, 'hidden setup is never refreshed');
    page.resize(480);
  }
});

test('observer batches changes and preserves paused state, aim and input; hidden/zero sizes do not refresh', async () => {
  const page = startup();
  page.element('situation').value = 'Space Battle'; page.element('role').value = 'Gunner';
  await page.submit(); page.scene.events = {}; page.scene.create();
  page.scene.spaceGunner.crosshairX = 123; page.scene.spaceGunner.crosshairY = 234;
  page.scene.spaceGunner.elapsed = 7;
  const active = JSON.stringify(page.scene.spaceGunner);
  page.inputCalls.length = 0; page.sizingCalls.length = 0;
  page.resize(390); page.resize(320); page.resize(480);
  assert.equal(page.frames.size, 1); page.flush();
  assert.equal(page.sizingCalls.filter(call => call === 'refresh').length, 1);
  assert.equal(page.scene.activeFlight, true);
  assert.equal(JSON.stringify(page.scene.spaceGunner), active);
  assert.equal(page.inputCalls.length, 0, 'sizing never enables or clears inputs');
  page.element('pause').listeners.get('click')();
  page.inputCalls.length = 0;
  const paused = JSON.stringify(page.scene.spaceGunner);
  page.resize(320); page.flush();
  assert.equal(page.scene.activeFlight, false);
  assert.equal(page.element('pause-overlay').hidden, false);
  assert.equal(JSON.stringify(page.scene.spaceGunner), paused);
  assert.equal(page.inputCalls.length, 0);
  const calls = page.sizingCalls.length;
  page.resize(0, 0); assert.equal(page.frames.size, 0);
  page.resize(390); page.resize(0, 0); page.flush();
  assert.equal(page.sizingCalls.length, calls, 'queued refresh rechecks current dimensions');
  page.resize(390); page.flush(); assert.equal(page.scale.displayWidth, 390);
  page.element('resume').listeners.get('click')(); assert.equal(page.scene.activeFlight, true);
  page.resize(320);
  page.scene.spaceGunner.finished = true; page.scene.spaceGunner.endReason = 'time';
  page.scene.onSpaceGunnerStep(page.scene.spaceGunner);
  assert.equal(page.frames.size, 0, 'results cancel queued refresh');
  const resultCalls = page.sizingCalls.length;
  page.resize(480); page.flush(); assert.equal(page.sizingCalls.length, resultCalls);
  page.element('again').listeners.get('click')();
  page.scale.parentWidth = page.scale.displayWidth = 0;
  await page.submit();
  assert.equal(page.gameCount, 1); assert.equal(page.scale.displayWidth, 480);
  assert.equal(page.scene.spaceGunner.elapsed, 0);
});
