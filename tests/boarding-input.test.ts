import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoardingVentInput, createSpaceGunnerInput } from '../src/game/input.ts';
function target() {
  const listeners = new Map<string, Function[]>();
  return {
    addEventListener(type:string,fn:Function){listeners.set(type,[...listeners.get(type)??[],fn]);},setPointerCapture(){},
    querySelector:()=>({getBoundingClientRect:()=>({left:10,top:20,width:240,height:280})}),
    send(type:string,values={}){const event={pointerId:1,pointerType:'touch',button:0,clientX:130,clientY:160,preventDefault(){},...values};for(const fn of listeners.get(type)??[])fn(event);},
  };
}
function harness(run:(h:ReturnType<typeof setup>)=>void){const old=globalThis.window;const win=target();globalThis.window=win as any;try{run(setup(win));}finally{globalThis.window=old;}}
function setup(win:ReturnType<typeof target>){
  const surface=target(),fire=target(),left=target(),right=target();
  const aim=createSpaceGunnerInput(surface as any,fire as any),vents=createBoardingVentInput(left as any,right as any);aim.enable(true);vents.enable(true);
  return {win,surface,fire,left,right,aim,vents};
}
test('touch aim, Fire and both airlocks have independent pointer ownership',()=>harness(h=>{
  h.surface.send('pointerdown');h.fire.send('pointerdown',{pointerId:2});h.left.send('pointerdown',{pointerId:3});h.right.send('pointerdown',{pointerId:4});
  assert.deepEqual(h.vents.read(),{ventLeft:true,ventRight:true});assert.equal(h.aim.read().firing,true);
  assert.deepEqual(h.vents.read(),{ventLeft:false,ventRight:false});
  h.surface.send('pointerup');h.left.send('pointerup',{pointerId:3});assert.equal(h.aim.read().firing,true);
  h.fire.send('pointerup',{pointerId:2});assert.equal(h.aim.read().firing,false);
  assert.deepEqual([h.aim.read().aimX,h.aim.read().aimY],[240,280]);
}));
test('airlock quick taps survive normal capture loss, cancel only their own pointer, and consume once',()=>harness(h=>{
  h.left.send('pointerdown',{pointerId:3});h.left.send('pointerup',{pointerId:3});h.left.send('lostpointercapture',{pointerId:3});
  h.right.send('pointerdown',{pointerId:4});h.right.send('pointercancel',{pointerId:4});
  assert.deepEqual(h.vents.read(),{ventLeft:true,ventRight:false});assert.deepEqual(h.vents.read(),{ventLeft:false,ventRight:false});
  h.left.send('pointerdown');h.left.send('lostpointercapture');assert.equal(h.vents.read().ventLeft,false);
}));
test('Q/E are one attempt per press; repeats and held keys never bank vent requests',()=>harness(h=>{
  h.win.send('keydown',{code:'KeyQ'});h.win.send('keydown',{code:'KeyE'});assert.deepEqual(h.vents.read(),{ventLeft:true,ventRight:true});
  h.win.send('keydown',{code:'KeyQ',repeat:true});h.win.send('keydown',{code:'KeyE',repeat:true});assert.deepEqual(h.vents.read(),{ventLeft:false,ventRight:false});
  h.win.send('keyup',{code:'KeyQ'});h.win.send('keydown',{code:'KeyQ'});assert.equal(h.vents.read().ventLeft,true);
}));
test('pause/disable and blur clear pending vents and fire without losing retained simulation aim',()=>harness(h=>{
  for(const action of [()=>{h.aim.enable(false);h.vents.enable(false);h.aim.enable(true);h.vents.enable(true);},()=>h.win.send('blur')]) {
    h.surface.send('pointerdown');h.fire.send('pointerdown',{pointerId:2});h.left.send('pointerdown',{pointerId:3});h.win.send('keydown',{code:'KeyE'});
    action();assert.deepEqual(h.vents.read(),{ventLeft:false,ventRight:false});assert.equal(h.aim.read().firing,false);assert.equal(h.aim.read().aimX,undefined);
  }
}));
