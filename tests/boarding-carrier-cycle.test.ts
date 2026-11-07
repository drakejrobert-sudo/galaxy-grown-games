import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoarding, stepBoarding, automaticShipX, type BoardingState } from '../src/game/rules.ts';

const config = { total: 10, naturalOne: false };
const idle = { x: 0, y: 0, firing: false };
const rates = [1 / 60, 1 / 30, .05];
function near(actual: number, expected: number, note = '') { assert.ok(Math.abs(actual-expected)<1e-7, `${note}: ${actual} != ${expected}`); }
function staging(cycle: number) { return cycle % 2 ? 120 : 360; }
function beforeBoundary(boundary: number, offset: number, role: BoardingState['role'] = 'Gunner') {
  const s = createBoarding(role), cycle = boundary / 12 - 1;
  s.elapsed = boundary - offset; s.spawnIn = 1000; s.x = 22; s.y = 22;
  const startX = cycle ? staging(cycle-1) : 240;
  Object.assign(s.carrier, { cycle, startX, targetX: 200, x: startX+(staging(cycle)-startX)*(3-offset)/3, y: 500 });
  return s;
}

test('carrier preserves exact staging/start positions at exact and straddled cycle boundaries',()=>{
  for(const boundary of [12,24,36,48,60])for(const dt of rates)for(const offset of [dt,dt/2]) {
    const s=beforeBoundary(boundary,offset), expected=staging(boundary/12-1);
    stepBoarding(s,config,idle,dt,()=>.5);
    near(s.carrier.x,expected,`boundary ${boundary}, dt ${dt}`);near(s.carrier.y,500);
    assert.equal(s.carrier.cycle,boundary/12);near(s.carrier.startX,expected);assert.equal(s.hull,3);
    if(boundary===60){assert.equal(s.finished,true);assert.equal(s.elapsed,60);}
    else {const target=s.carrier.targetX;stepBoarding(s,config,{...idle,x:1},dt,()=>.5);near(s.carrier.x,expected);near(s.carrier.targetX,target);}
  }
});

test('the next target locks once at the exact boundary using the automatic course prediction',()=>{
  for(const dt of rates) for (const role of ['Gunner', 'Bomber'] as const) {
    const s=beforeBoundary(12,dt/2,role);
    stepBoarding(s,config,idle,dt,()=>.5);
    const target=Math.max(80,Math.min(400,automaticShipX(16)-45));
    near(s.carrier.targetX,target);
    stepBoarding(s,config,idle,dt,()=>.5);
    near(s.carrier.targetX,target);
  }
});

test('each full-round frame follows a continuous bounded carrier course at 60 Hz, 30 Hz and 50ms',()=>{
  for(const dt of rates) {
    const s=createBoarding('Gunner');s.spawnIn=1000;
    while(!s.finished) {
      const before={x:s.carrier.x,y:s.carrier.y},time=s.elapsed;
      stepBoarding(s,config,idle,dt,()=>.5);
      assert.ok(Math.hypot(s.carrier.x-before.x,s.carrier.y-before.y)<=150*(s.elapsed-time)+1e-7,`discontinuity at ${s.elapsed}`);
    }
    assert.equal(s.elapsed,60);near(s.carrier.x,360);assert.equal(s.hull,3);
  }
});

test('a mine at a shared cycle endpoint damages the carrier once, never once per motion segment',()=>{
  const s=beforeBoundary(12,.01,'Bomber');
  s.mines=[{id:90,x:360,y:544,armIn:0,expiresIn:2,blastRadius:58}];
  stepBoarding(s,config,idle,.05,()=>.5);
  assert.equal(s.carrierDamage,1);assert.equal(s.carrier.hp,4);assert.equal(s.mines.length,0);assert.equal(s.explosions.length,1);
});

test('a carrier contact at the approach/hold turn resolves before a later mine expiry in the same step',()=>{
  const s=createBoarding('Bomber');s.elapsed=3.99;s.spawnIn=1000;
  Object.assign(s.carrier,{cycle:0,startX:240,targetX:240,x:240,y:250+(.01*250/2.8)});
  s.mines=[{id:90,x:240,y:206,armIn:0,expiresIn:.025,blastRadius:58}];
  stepBoarding(s,config,idle,.05,()=>.5);
  assert.equal(s.carrierDamage,1);assert.equal(s.explosions.length,1);near(s.explosions[0].remaining,.24);
});

test('a mine contact at the withdrawal/staging corner is not lost by sweeping across the corner',()=>{
  const s=createBoarding('Bomber');s.elapsed=8.99;s.spawnIn=1000;
  Object.assign(s.carrier,{cycle:0,startX:240,targetX:240,x:240,y:500-(.01*250/3)});
  s.mines=[{id:90,x:240,y:544,armIn:0,expiresIn:.025,blastRadius:58}];
  stepBoarding(s,config,idle,.05,()=>.5);
  assert.equal(s.carrierDamage,1);assert.equal(s.explosions.length,1);near(s.explosions[0].remaining,.24);
});
