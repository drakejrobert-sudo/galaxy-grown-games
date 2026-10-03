import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGunnerInput, createBomberInput, createSpaceGunnerInput, createSpaceBomberInput, createSpaceLifeInput } from '../src/game/input.ts';

function surface() {
  const listeners = new Map<string, Function[]>();
  return { addEventListener(type: string, fn: Function) { listeners.set(type, [...listeners.get(type) ?? [], fn]); },
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 560 }) }),
    setPointerCapture() {},
    emit(type: string, properties = {}) { for (const fn of listeners.get(type) ?? []) fn({ preventDefault() {}, pointerId: 1, pointerType: 'touch', clientX: 240, clientY: 460, ...properties }); } };
}
test('weapon frame snapshots consume a released tap once and preserve supported holds', () => {
  const original = globalThis.window;
  try {
    for (const kind of ['gunner', 'bomber', 'spaceGunner', 'spaceBomber']) for (const held of [false, true]) {
      const win = surface(), playfield = surface(), action = surface(); globalThis.window = win as any;
      const input = kind === 'gunner' ? createGunnerInput(playfield as any)
        : kind === 'bomber' ? createBomberInput(playfield as any, action as any)
          : kind === 'spaceGunner' ? createSpaceGunnerInput(playfield as any, action as any)
            : createSpaceBomberInput(playfield as any, action as any);
      input.enable(true);
      const control = kind === 'gunner' ? playfield : action;
      control.emit('pointerdown'); if (!held) { control.emit('pointerup'); control.emit('lostpointercapture'); }
      const frame = input.readFrame() as any, property = kind.includes('unner') ? 'firing' : 'placing';
      assert.equal(frame.first[property], true);
      assert.equal(frame.continued[property], held && kind !== 'spaceBomber');
      assert.equal((input.readFrame() as any).first[property], held && kind !== 'spaceBomber');
      input.enable(false); input.enable(true); assert.equal((input.readFrame() as any).first[property], false);
    }
  } finally { globalThis.window = original; }
});
test('Space Bomber pointer coordinates and queued straight command occur once, while held reset continues', () => {
  const original = globalThis.window;
  try {
    const win = surface(), playfield = surface(), action = surface(); globalThis.window = win as any;
    const input = createSpaceBomberInput(playfield as any, action as any); input.enable(true);
    playfield.emit('pointerdown'); playfield.emit('pointerup');
    const frame = input.readFrame(); assert.ok(frame.first.aim); assert.ok(frame.first.launch);
    assert.deepEqual(frame.continued, { placing: false });
    win.emit('keydown', { code: 'ArrowDown' }); win.emit('keyup', { code: 'ArrowDown' });
    assert.equal(input.readFrame().continued.straight, undefined);
    win.emit('keydown', { code: 'ArrowDown' }); assert.equal(input.readFrame().continued.straight, true);
  } finally { globalThis.window = original; }
});
test('Space Life Support jump remains a single action alongside held movement', () => {
  const original = globalThis.window;
  try {
    const win = surface(), left = surface(), right = surface(), jump = surface(); globalThis.window = win as any;
    const input = createSpaceLifeInput({ left, right, jump } as any); input.enable(true);
    right.emit('pointerdown', { pointerId: 2 }); jump.emit('pointerdown'); jump.emit('pointerup');
    assert.deepEqual(input.readFrame(), { first: { x: 1, jump: true }, continued: { x: 1, jump: false } });
    assert.deepEqual(input.readFrame().first, { x: 1, jump: false });
  } finally { globalThis.window = original; }
});
