import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoarding, stepBoarding, automaticShipX, BOARDING_TUNING, type BoardingState } from '../src/game/rules.ts';

const config = { total: 10, naturalOne: false };
const idle = { x: 0, y: 0, firing: false };
const rates = [1 / 60, 1 / 30, .05];
function near(actual: number, expected: number, note = '') { assert.ok(Math.abs(actual-expected)<1e-7, `${note}: ${actual} != ${expected}`); }
function staging(cycle: number) { return cycle % 2 ? 120 : 360; }
function beforeBoundary(boundary: number, offset: number, role: BoardingState['role'] = 'Pilot') {
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

test('the reviewed 11.99-second jump cannot sweep through a Pilot clear of both endpoints',()=>{
  const s=beforeBoundary(12,.01);s.x=300;s.y=500;
  near(s.carrier.x,359.6);assert.ok(Math.abs(s.x-s.carrier.x)>49);
  stepBoarding(s,config,idle,1/60,()=>.5);
  near(s.carrier.x,360);assert.ok(Math.abs(s.x-s.carrier.x)>49);assert.equal(s.hull,3);assert.equal(s.hits,0);
});

test('legitimate carrier contact during a boundary crossing still damages the Pilot once',()=>{
  const s=beforeBoundary(12,.01);s.x=350;s.y=500;
  stepBoarding(s,config,idle,.05,()=>.5);
  assert.equal(s.hull,2);assert.equal(s.hits,1);assert.ok(s.grace>1.19);
});

test('the next target locks once at the exact boundary using interpolated Pilot position or automatic prediction',()=>{
  for(const dt of rates) {
    const offset=dt/2,s=beforeBoundary(12,offset);s.x=200;
    stepBoarding(s,config,{...idle,x:1},dt,()=>.5);
    const expected=200+BOARDING_TUNING.Medium.moveSpeed*offset-45;
    near(s.carrier.targetX,expected);const locked=s.carrier.targetX;
    stepBoarding(s,config,{...idle,x:-1},dt,()=>.5);near(s.carrier.targetX,locked);
    const gunner=beforeBoundary(12,offset,'Gunner');stepBoarding(gunner,config,idle,dt,()=>.5);
    near(gunner.carrier.targetX,automaticShipX(16)-45);
  }
});

test('each full-round frame follows a continuous bounded carrier course at 60 Hz, 30 Hz and 50ms',()=>{
  for(const dt of rates) {
    const s=createBoarding('Pilot');s.x=s.y=22;s.spawnIn=1000;
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
