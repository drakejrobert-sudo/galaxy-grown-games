import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGunnerInput } from '../src/game/input.ts';

test('gunner keyboard input moves the crosshair, fires, and prevents page actions', () => {
  const windowListeners = new Map<string, Function>();
  const surfaceListeners = new Map<string, Function>();
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener: (type: string, listener: Function) => windowListeners.set(type, listener) } as any;
  try {
    const surface = {
      addEventListener: (type: string, listener: Function) => surfaceListeners.set(type, listener),
      querySelector: () => ({ getBoundingClientRect: () => ({left:0,top:0,width:480,height:560}) }),
      setPointerCapture() {},
    } as any;
    const input = createGunnerInput(surface); input.enable(true);
    let prevented = 0;
    windowListeners.get('keydown')!({code:'ArrowRight',preventDefault:() => prevented++});
    windowListeners.get('keydown')!({code:'Space',preventDefault:() => prevented++});
    assert.deepEqual(input.read(), {x:1,y:0,aimX:undefined,aimY:undefined,firing:true});
    assert.equal(prevented, 2);
    windowListeners.get('keyup')!({code:'ArrowRight'}); windowListeners.get('keyup')!({code:'Space'});
    assert.deepEqual(input.read(), {x:0,y:0,aimX:undefined,aimY:undefined,firing:false});
  } finally { globalThis.window = oldWindow; }
});

test('gunner pointer input maps the canvas, supports drag aiming, and clears on release', () => {
  const windowListeners = new Map<string, Function>();
  const surfaceListeners = new Map<string, Function>();
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener: (type: string, listener: Function) => windowListeners.set(type, listener) } as any;
  try {
    let captured: number | null = null, prevented = 0;
    const surface = {
      addEventListener: (type: string, listener: Function) => surfaceListeners.set(type, listener),
      querySelector: () => ({ getBoundingClientRect: () => ({left:10,top:20,width:240,height:280}) }),
      setPointerCapture: (id: number) => captured = id,
    } as any;
    const input = createGunnerInput(surface); input.enable(true);
    surfaceListeners.get('pointerdown')!({pointerId:7,clientX:130,clientY:160,preventDefault:() => prevented++});
    assert.equal(captured, 7); assert.equal(prevented, 1);
    assert.deepEqual(input.read(), {x:0,y:0,aimX:240,aimY:280,firing:true});
    surfaceListeners.get('pointermove')!({pointerId:7,clientX:70,clientY:90,preventDefault:() => prevented++});
    assert.deepEqual(input.read(), {x:0,y:0,aimX:120,aimY:140,firing:true});
    surfaceListeners.get('pointerup')!({pointerId:7});
    assert.deepEqual(input.read(), {x:0,y:0,aimX:undefined,aimY:undefined,firing:false});
  } finally { globalThis.window = oldWindow; }
});
