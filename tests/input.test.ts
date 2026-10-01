import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBomberInput, createGunnerInput, createInput, createLifeSupportInput, createSpaceBomberInput } from '../src/game/input.ts';

test('shared pilot input supports keyboard steering and speed-capped touch destinations', () => {
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
    const input = createInput(surface); input.enable(true);
    let prevented = 0;
    windowListeners.get('keydown')!({code:'KeyA',preventDefault:() => prevented++});
    assert.deepEqual(input.read(240, 280), {x:-1,y:0});
    assert.equal(prevented, 1);
    windowListeners.get('keyup')!({code:'KeyA'});
    surfaceListeners.get('pointerdown')!({pointerId:4,clientX:480,clientY:280,preventDefault:() => prevented++});
    assert.deepEqual(input.read(240, 280), {x:1,y:0});
    surfaceListeners.get('pointerup')!({});
    assert.deepEqual(input.read(240, 280), {x:0,y:0});
  } finally { globalThis.window = oldWindow; }
});

test('gunner touch input maps the canvas, supports drag firing, and retains its last aim', () => {
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
    surfaceListeners.get('pointerdown')!({pointerId:7,pointerType:'touch',clientX:130,clientY:160,preventDefault:() => prevented++});
    assert.equal(captured, 7); assert.equal(prevented, 1);
    assert.deepEqual(input.read(), {aimX:240,aimY:280,firing:true});
    surfaceListeners.get('pointermove')!({pointerId:7,pointerType:'touch',clientX:70,clientY:90,preventDefault:() => prevented++});
    assert.deepEqual(input.read(), {aimX:120,aimY:140,firing:true});
    surfaceListeners.get('pointerup')!({pointerId:7});
    assert.deepEqual(input.read(), {aimX:120,aimY:140,firing:false});
  } finally { globalThis.window = oldWindow; }
});

test('gunner mouse input follows hover and preserves a quick click until simulation reads it', () => {
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
    surfaceListeners.get('pointermove')!({pointerId:1,pointerType:'mouse',clientX:90,clientY:110,preventDefault() {}});
    assert.deepEqual(input.read(), {aimX:90,aimY:110,firing:false});
    surfaceListeners.get('pointerdown')!({pointerId:1,pointerType:'mouse',clientX:100,clientY:120,preventDefault() {}});
    surfaceListeners.get('pointerup')!({pointerId:1,pointerType:'mouse'});
    assert.deepEqual(input.read(), {aimX:100,aimY:120,firing:true});
    assert.deepEqual(input.read(), {aimX:100,aimY:120,firing:false});
  } finally { globalThis.window = oldWindow; }
});

test('asteroid bomber only times mine releases and ignores aiming controls', () => {
  const oldWindow = globalThis.window;
  const windowListeners = new Map<string, Function>(), actions = new Map<string, Function>();
  globalThis.window = {addEventListener:(type:string, listener:Function)=>windowListeners.set(type,listener)} as any;
  try {
    const surface = {addEventListener() { throw new Error('Asteroid Bomber must not bind aim controls'); }} as any;
    const action = {addEventListener:(type:string, listener:Function)=>actions.set(type,listener),setPointerCapture() {}} as any;
    const input = createBomberInput(surface,action); input.enable(true);
    windowListeners.get('keydown')!({code:'KeyD',preventDefault() {throw new Error('steering key consumed');}});
    assert.deepEqual(input.read(),{x:0,y:0,placing:false});
    windowListeners.get('keydown')!({code:'Space',preventDefault() {}});
    assert.equal(input.read().placing,true);
    windowListeners.get('keyup')!({code:'Space'});
    assert.equal(input.read().placing,false);
    actions.get('pointerdown')!({pointerId:1,preventDefault() {}});
    actions.get('pointerup')!({pointerId:1});
    assert.equal(input.read().placing,true);
    assert.equal(input.read().placing,false);
    actions.get('pointerdown')!({pointerId:2,preventDefault() {}});
    actions.get('pointercancel')!({pointerId:2});
    assert.equal(input.read().placing,false);
    actions.get('pointerdown')!({pointerId:3,preventDefault() {}});
    input.enable(false); input.enable(true);
    assert.equal(input.read().placing,false);
    windowListeners.get('keydown')!({code:'Enter',preventDefault() {}});
    windowListeners.get('blur')!();
    assert.equal(input.read().placing,false);
  } finally {globalThis.window=oldWindow;}
});

test('life support switch supports cycling, direct keyboard selection, and touch buttons', () => {
  const windowListeners = new Map<string, Function>();
  const buttonListeners = Array.from({length: 3}, () => new Map<string, Function>());
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener: (type: string, listener: Function) => windowListeners.set(type, listener) } as any;
  try {
    const buttons = buttonListeners.map(listeners => ({
      addEventListener: (type: string, listener: Function) => listeners.set(type, listener),
    })) as any;
    const input = createLifeSupportInput(buttons); input.enable(true);
    let prevented = 0;
    assert.deepEqual(input.read(), {route:'Shields'});
    windowListeners.get('keydown')!({code:'ArrowRight',preventDefault:() => prevented++});
    assert.deepEqual(input.read(), {route:'Guns'});
    windowListeners.get('keydown')!({code:'ArrowRight',repeat:true,preventDefault:() => prevented++});
    assert.deepEqual(input.read(), {route:'Guns'});
    windowListeners.get('keydown')!({code:'ArrowRight',preventDefault:() => prevented++});
    assert.deepEqual(input.read(), {route:'Thrusters'});
    windowListeners.get('keydown')!({code:'Digit2',preventDefault:() => prevented++});
    assert.deepEqual(input.read(), {route:'Shields'});
    buttonListeners[0].get('pointerdown')!({preventDefault:() => prevented++});
    assert.deepEqual(input.read(), {route:'Thrusters'});
    assert.equal(prevented, 4);
    input.enable(false);
    buttonListeners[2].get('pointerdown')!({preventDefault:() => prevented++});
    assert.deepEqual(input.read(), {route:'Thrusters'});
    input.enable(true);
    assert.deepEqual(input.read(), {route:'Thrusters'});
    input.reset();
    assert.deepEqual(input.read(), {route:'Shields'});
  } finally { globalThis.window = oldWindow; }
});


function mineHarness() {
  const oldWindow = globalThis.window;
  const keys = new Map<string, Function>(), pointers = new Map<string, Function>(), surface = new Map<string, Function>();
  globalThis.window = { addEventListener: (name: string, fn: Function) => keys.set(name, fn) } as any;
  const input = createSpaceBomberInput({ addEventListener: (name: string, fn: Function) => surface.set(name, fn), setPointerCapture() {}, querySelector: () => ({ getBoundingClientRect: () => ({left:10,top:20,width:240,height:280}) }) } as any, { addEventListener: (name: string, fn: Function) => pointers.set(name, fn), setPointerCapture() {} } as any);
  input.enable(true);
  return { input, keys, pointers, surface, restore: () => { globalThis.window = oldWindow; } };
}
test('Space Bomber consumes one mine press and rejects repeats and held input', () => {
  const h = mineHarness();
  try {
    for (const code of ['ShiftLeft']) h.keys.get('keydown')!({ code, preventDefault() { throw Error('unexpected control'); } });
    assert.deepEqual(h.input.read(), { placing: false });
    for (const code of ['Space', 'Enter']) {
      h.keys.get('keydown')!({ code, repeat: false, preventDefault() {} });
      assert.equal(h.input.read().placing, true);
      for (let i = 0; i < 60; i++) assert.equal(h.input.read().placing, false);
      h.keys.get('keydown')!({ code, repeat: true, preventDefault() {} });
      assert.equal(h.input.read().placing, false);
      h.keys.get('keyup')!({ code });
      h.keys.get('keydown')!({ code, repeat: false, preventDefault() {} });
      h.keys.get('keyup')!({ code });
      assert.equal(h.input.read().placing, true); // Quick press survives release.
    }
    h.input.enable(false); h.input.enable(true);
    h.keys.get('keydown')!({ code: 'Space', repeat: true, preventDefault() {} });
    assert.equal(h.input.read().placing, false); // Held key after resume cannot fire.
  } finally { h.restore(); }
});
test('Space Bomber quick pointer taps survive release; holds, cancellation, pause and blur never fire stale mines', () => {
  const h = mineHarness();
  try {
    const e = { pointerId: 7, pointerType: 'touch', preventDefault() {} };
    h.pointers.get('pointerdown')!(e);
    assert.equal(h.input.read().placing, true); assert.equal(h.input.read().placing, false);
    h.pointers.get('pointerup')!(e);
    h.pointers.get('pointerdown')!(e); h.pointers.get('pointerup')!(e);
    h.pointers.get('lostpointercapture')!(e);
    assert.equal(h.input.read().placing, true);
    for (const event of ['pointercancel', 'lostpointercapture']) {
      h.pointers.get('pointerdown')!(e); h.pointers.get(event)!(e);
      assert.equal(h.input.read().placing, false);
    }
    h.pointers.get('pointerdown')!(e); h.input.enable(false); h.input.enable(true);
    assert.equal(h.input.read().placing, false);
    h.pointers.get('pointerdown')!(e); h.keys.get('blur')!(); assert.equal(h.input.read().placing, false);
    h.pointers.get('pointerdown')!({ ...e, pointerType: 'mouse', button: 2 });
    assert.equal(h.input.read().placing, false);
    h.pointers.get('pointerdown')!({ ...e, pointerType: 'mouse', button: 0 });
    assert.equal(h.input.read().placing, true);
  } finally { h.restore(); }
});

test('Space Bomber canvas previews hover and drag, launches on release, and clears cancelled gestures', () => {
  const h = mineHarness();
  try {
    const e = {pointerId:2,pointerType:'mouse',button:0,clientX:130,clientY:220,preventDefault(){}};
    h.surface.get('pointermove')!(e);
    assert.deepEqual(h.input.read(), {placing:false,aim:{x:240,y:400}});
    h.surface.get('pointerdown')!(e); assert.equal(h.input.read().placing,false);
    h.surface.get('pointerup')!(e); h.surface.get('lostpointercapture')!(e);
    assert.deepEqual(h.input.read(), {placing:true,aim:{x:240,y:400},launch:{x:240,y:400}});
    assert.equal(h.input.read().placing,false);
    for (const event of ['pointercancel','lostpointercapture']) {
      h.surface.get('pointerdown')!({...e,pointerType:'touch'});
      h.surface.get(event)!(e); h.surface.get('pointerup')!(e);
      assert.deepEqual(h.input.read(),{placing:false});
    }
    h.surface.get('pointerdown')!(e); h.input.enable(false); h.input.enable(true);
    h.surface.get('pointerup')!(e); assert.deepEqual(h.input.read(),{placing:false});
    h.keys.get('keydown')!({code:'KeyA',preventDefault(){}});
    assert.deepEqual(h.input.read(),{placing:false,turn:1});
    h.keys.get('keydown')!({code:'ArrowRight',preventDefault(){}});
    assert.deepEqual(h.input.read(),{placing:false});
    h.keys.get('keydown')!({code:'KeyS',preventDefault(){}});
    assert.equal(h.input.read().straight,true);
    h.keys.get('keyup')!({code:'KeyS'});
    h.keys.get('keydown')!({code:'ArrowDown',preventDefault(){}});
    h.keys.get('keyup')!({code:'ArrowDown'});
    assert.equal(h.input.read().straight,true, 'quick straight-aft taps survive release');
    assert.equal(h.input.read().straight,undefined);
  } finally { h.restore(); }
});

test('Space Bomber consumes pointer targets after release/hover and retains active drag previews',()=>{
  const h=mineHarness();
  try {
    const e={pointerId:2,pointerType:'touch',clientX:130,clientY:120,preventDefault(){}};
    h.surface.get('pointerdown')!(e);
    assert.deepEqual(h.input.read().aim,{x:240,y:200});assert.deepEqual(h.input.read().aim,{x:240,y:200});
    h.surface.get('pointerup')!(e);assert.deepEqual(h.input.read().launch,{x:240,y:200});
    assert.deepEqual(h.input.read(),{placing:false});
    h.pointers.get('pointerdown')!(e);assert.deepEqual(h.input.read(),{placing:true});
    h.surface.get('pointermove')!({...e,pointerType:'mouse'});
    assert.deepEqual(h.input.read().aim,{x:240,y:200});assert.deepEqual(h.input.read(),{placing:false});
  } finally {h.restore();}
});
