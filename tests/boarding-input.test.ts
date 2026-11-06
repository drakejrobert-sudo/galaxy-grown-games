import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpaceGunnerInput } from '../src/game/input.ts';
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
  const surface=target(),fire=target();
  const aim=createSpaceGunnerInput(surface as any,fire as any);aim.enable(true);
  return {win,surface,fire,aim};
}
test('touch aims at a door control without firing; Fire owns a separate pointer',()=>harness(h=>{
  h.surface.send('pointerdown',{clientX:60,clientY:160});assert.equal(h.aim.read().firing,false);
  h.fire.send('pointerdown',{pointerId:2});assert.equal(h.aim.read().firing,true);
  h.surface.send('pointerup');assert.equal(h.aim.read().firing,true);
  h.fire.send('pointerup',{pointerId:2});assert.equal(h.aim.read().firing,false);
  assert.deepEqual([h.aim.read().aimX,h.aim.read().aimY],[100,280]);
}));
test('removed Q/E shortcuts neither fire nor consume keyboard input',()=>harness(h=>{
  for(const code of ['KeyQ','KeyE'])h.win.send('keydown',{code,preventDefault(){throw Error('removed key consumed');}});
  assert.equal(h.aim.read().firing,false);
}));
test('pause/disable and blur clear queued firing and active aiming gestures',()=>harness(h=>{
  for(const action of [()=>{h.aim.enable(false);h.aim.enable(true);},()=>h.win.send('blur')]) {
    h.surface.send('pointerdown');h.fire.send('pointerdown',{pointerId:2});action();
    assert.equal(h.aim.read().firing,false);assert.equal(h.aim.read().aimX,undefined);
  }
}));
