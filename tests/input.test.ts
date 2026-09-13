import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBomberInput, createGunnerInput, createInput, createLifeSupportInput } from '../src/game/input.ts';

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

test('bomber supports simultaneous keyboard steering and mine placement', () => {
  const windowListeners = new Map<string, Function>();
  const surfaceListeners = new Map<string, Function>();
  const actionListeners = new Map<string, Function>();
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener: (type: string, listener: Function) => windowListeners.set(type, listener) } as any;
  try {
    let prevented = 0;
    const surface = {
      addEventListener: (type: string, listener: Function) => surfaceListeners.set(type, listener),
      querySelector: () => ({ getBoundingClientRect: () => ({left:0,top:0,width:480,height:560}) }),
      setPointerCapture() {},
    } as any;
    const action = {
      addEventListener: (type: string, listener: Function) => actionListeners.set(type, listener),
      setPointerCapture() {},
    } as any;
    const input = createBomberInput(surface, action); input.enable(true);
    windowListeners.get('keydown')!({code:'KeyD',preventDefault:() => prevented++});
    windowListeners.get('keydown')!({code:'Space',preventDefault:() => prevented++});
    assert.deepEqual(input.read(240, 100), {x:1,y:0,placing:true});
    assert.equal(prevented, 2);
    windowListeners.get('keyup')!({code:'Space'});
    assert.deepEqual(input.read(240, 100), {x:1,y:0,placing:false});
  } finally { globalThis.window = oldWindow; }
});

test('bomber touch can steer while the separate mine control is held', () => {
  const windowListeners = new Map<string, Function>();
  const surfaceListeners = new Map<string, Function>();
  const actionListeners = new Map<string, Function>();
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener: (type: string, listener: Function) => windowListeners.set(type, listener) } as any;
  try {
    const surface = {
      addEventListener: (type: string, listener: Function) => surfaceListeners.set(type, listener),
      querySelector: () => ({ getBoundingClientRect: () => ({left:0,top:0,width:480,height:560}) }),
      setPointerCapture() {},
    } as any;
    const action = {
      addEventListener: (type: string, listener: Function) => actionListeners.set(type, listener),
      setPointerCapture() {},
    } as any;
    const input = createBomberInput(surface, action); input.enable(true);
    surfaceListeners.get('pointerdown')!({pointerId:4,clientX:480,clientY:100,preventDefault() {}});
    actionListeners.get('pointerdown')!({pointerId:9,preventDefault() {}});
    assert.deepEqual(input.read(240, 100), {x:1,y:0,placing:true});
    actionListeners.get('pointerup')!({pointerId:9});
    assert.deepEqual(input.read(240, 100), {x:1,y:0,placing:false});
  } finally { globalThis.window = oldWindow; }
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
