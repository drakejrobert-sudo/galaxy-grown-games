import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpaceGunnerInput } from '../src/game/input.ts';
import { createSpaceGunner, stepSpaceGunner } from '../src/game/rules.ts';

function harness(run: (h: ReturnType<typeof setup>) => void) {
  const old = globalThis.window;
  const window = target(); globalThis.window = window as any;
  try { run(setup(window)); } finally { globalThis.window = old; }
}
function target() {
  const listeners = new Map<string, Function[]>();
  return {
    addEventListener(type: string, fn: Function) { listeners.set(type, [...listeners.get(type) ?? [], fn]); },
    setPointerCapture() {},
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 10, top: 20, width: 240, height: 280 }) }),
    send(type: string, values = {}) {
      const event = { pointerId: 1, pointerType: 'touch', button: 0, clientX: 130, clientY: 160, preventDefault() {}, ...values };
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}
function setup(window: ReturnType<typeof target>) {
  const surface = target(), button = target();
  const input = createSpaceGunnerInput(surface as any, button as any); input.enable(true);
  return { surface, button, window, input };
}

test('touch aims at scaled canvas coordinates without held/queued firing or cooldown consumption', () => harness(h => {
  const s = createSpaceGunner(); s.spawnIn = 100;
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'lostpointercapture']) {
    h.surface.send(type);
    const i = h.input.read(); assert.equal(i.firing, false);
    assert.deepEqual([i.aimX, i.aimY], [240, 280]);
    stepSpaceGunner(s, { total: 10, naturalOne: false }, i, 0.05);
  }
  assert.equal(s.shots, 0); assert.equal(s.cooldown, 0);
}));

test('aim and Fire release independently; Fire coordinates never alter aim', () => harness(h => {
  h.surface.send('pointerdown'); h.button.send('pointerdown', { pointerId: 2, clientX: 999, clientY: 999 });
  assert.deepEqual(h.input.read(), { x: 0, y: 0, aimX: 240, aimY: 280, firing: true });
  h.surface.send('pointerup'); h.surface.send('lostpointercapture');
  assert.equal(h.input.read().firing, true);
  h.button.send('pointerup', { pointerId: 2 }); assert.equal(h.input.read().firing, false);
  assert.equal(h.input.read().aimX, 240);
  h.surface.send('pointerdown'); h.button.send('pointerdown', { pointerId: 2 }); h.input.read();
  h.button.send('pointerup', { pointerId: 2 }); h.button.send('lostpointercapture', { pointerId: 2 });
  h.surface.send('pointermove', { clientX: 70 });
  assert.equal(h.input.read().aimX, 120); assert.equal(h.input.read().firing, false);
}));

test('quick Fire taps survive ordinary release plus capture loss and are consumed once', () => harness(h => {
  h.button.send('pointerdown'); h.button.send('pointerup'); h.button.send('lostpointercapture');
  assert.equal(h.input.read().firing, true); assert.equal(h.input.read().firing, false);
  const s = createSpaceGunner(); s.spawnIn = 100; s.cooldown = 0.2;
  h.button.send('pointerdown'); h.button.send('pointerup');
  stepSpaceGunner(s, { total: 10, naturalOne: false }, h.input.read(), 0.05);
  for (let i = 0; i < 6; i++) stepSpaceGunner(s, { total: 10, naturalOne: false }, h.input.read(), 0.05);
  assert.equal(s.shots, 0, 'tap cannot bank across cooldown');
}));

test('cancel/lost capture clears only affected pointer; aim cancellation does not clear Fire', () => harness(h => {
  for (const event of ['pointercancel', 'lostpointercapture']) {
    h.input.enable(true);
    h.surface.send('pointerdown', { pointerType: 'mouse' });
    h.button.send('pointerdown', { pointerId: 2 });
    h.surface.send(event); assert.equal(h.input.read().firing, true);
    h.button.send(event, { pointerId: 2 }); assert.equal(h.input.read().firing, false);
  }
  h.surface.send('pointerdown'); h.button.send('pointerdown', { pointerId: 2 });
  h.surface.send('pointercancel'); assert.equal(h.input.read().firing, true);
  h.button.send('pointercancel', { pointerId: 2 }); assert.equal(h.input.read().firing, false);
  h.button.send('pointerdown', { pointerId: 3 }); h.button.send('pointerup', { pointerId: 3 });
  h.button.send('pointerdown', { pointerId: 4 }); h.button.send('pointercancel', { pointerId: 4 });
  assert.equal(h.input.read().firing, true, 'other pointer quick tap survives');
}));

test('keyboard/mouse handoff retains simulation aim and ignores held-key repeats after pointer takeover', () => harness(h => {
  h.surface.send('pointermove', { pointerType: 'mouse', clientX: 70 });
  assert.equal(h.input.read().aimX, 120);
  h.window.send('keydown', { code: 'KeyD' });
  assert.deepEqual(h.input.read(), { x: 1, y: 0, aimX: undefined, aimY: undefined, firing: false });
  h.surface.send('pointermove', { pointerType: 'mouse', clientX: 130 });
  h.window.send('keydown', { code: 'KeyD', repeat: true });
  assert.equal(h.input.read().aimX, 240);
  h.window.send('keyup', { code: 'KeyD' });
  h.window.send('keydown', { code: 'KeyW' }); assert.equal(h.input.read().y, -1);
  h.surface.send('pointerdown'); h.surface.send('pointerup'); assert.equal(h.input.read().aimY, 280);
}));

test('mouse primary click, Fire, and keyboard combine into one shared simulation cooldown', () => harness(h => {
  const s = createSpaceGunner(); s.spawnIn = 100;
  h.surface.send('pointerdown', { pointerType: 'mouse', button: 2 }); assert.equal(h.input.read().firing, false);
  h.surface.send('pointerdown', { pointerType: 'mouse' });
  h.button.send('pointerdown', { pointerId: 2 }); h.window.send('keydown', { code: 'Space' });
  stepSpaceGunner(s, { total: 10, naturalOne: false }, h.input.read(), 0.05);
  assert.equal(s.shots, 1);
  for (let i = 0; i < 6; i++) stepSpaceGunner(s, { total: 10, naturalOne: false }, h.input.read(), 0.05);
  assert.equal(s.shots, 1);
  h.surface.send('pointerup'); h.button.send('pointerup', { pointerId: 2 });
  assert.equal(h.input.read().firing, true);
  h.window.send('keyup', { code: 'Space' }); assert.equal(h.input.read().firing, false);
  h.window.send('keydown', { code: 'Enter' }); h.window.send('keyup', { code: 'Enter' });
  assert.equal(h.input.read().firing, true); assert.equal(h.input.read().firing, false);
}));

test('pause/blur clears all queued and held controls; disabled input leaves menus usable', () => harness(h => {
  for (const clear of [() => h.window.send('blur'), () => { h.input.enable(false); h.input.enable(true); }]) {
    h.surface.send('pointerdown'); h.button.send('pointerdown', { pointerId: 2 });
    h.window.send('keydown', { code: 'Space' }); h.window.send('keydown', { code: 'KeyD' });
    clear(); assert.deepEqual(h.input.read(), { x: 0, y: 0, aimX: undefined, aimY: undefined, firing: false });
  }
  h.input.enable(false);
  h.window.send('keydown', { code: 'Space', preventDefault() { throw Error('menu key consumed'); } });
  h.button.send('pointerdown'); h.surface.send('pointerdown'); assert.equal(h.input.read().firing, false);
}));
