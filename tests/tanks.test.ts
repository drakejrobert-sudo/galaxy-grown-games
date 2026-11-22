import assert from 'node:assert/strict';
import test from 'node:test';
import {createMatch, active, advance, drive, fire, step, ground, DRIVE, type Match, type Aim} from '../src/tanks/rules.ts';

const aim: Aim = {direction:1,angle:45,power:50,ammo:'standard'};
function match(count = 3) {
  const m = createMatch(Array.from({length:count},(_,i) => 'Tank '+i),0,17);
  m.order = m.tanks.map((_,i) => i);
  return m;
}
function resolve(m: Match) {
  for (let i=0; i<3000 && m.phase==='shot'; i++) step(m);
  assert.notEqual(m.phase,'shot');
}
test('seeded two- and eight-seat matches and rematches start clean',() => {
  for (const count of [2,8]) {
    const m = match(count), names = m.tanks.map(t=>t.name);
    const fresh = createMatch(names,1,25);
    assert.deepEqual(fresh,createMatch(names,1,25));
    assert.equal(new Set(fresh.order).size,count);
    assert.deepEqual(fresh.tanks.map(t=>t.hull),names.map(()=>3));
    assert.equal(fresh.dm,1);
    assert.equal(fresh.heavy,2); assert.equal(fresh.starburst,1);
    assert.notDeepEqual(fresh.terrain,m.terrain);
  }
});
test('driving spends a shared allowance both directions and stops at edges, occupied ground and crater walls',() => {
  const m=match(); m.terrain.fill(260);
  const t=m.tanks[0], start=t.x;
  drive(m,-1); drive(m,1);
  assert.equal(t.x,start); assert.equal(m.drive,DRIVE-12);
  for (let i=0;i<10;i++) drive(m,1);
  assert.equal(t.x,start+36); assert.equal(m.drive,0);
  m.drive=DRIVE; t.x=12; drive(m,-1); assert.equal(m.drive,DRIVE);
  m.tanks[1].x=36; drive(m,1); assert.equal(t.x,12);
  t.x=100; m.terrain[101]+=12; drive(m,1); assert.equal(t.x,100);
});
test('firing direction, misses, turn locking and eliminated seat skipping',() => {
  for (const direction of [-1,1] as const) {
    const m=match(); m.tanks[0].x=direction===1?760:40; m.tanks[1].hull=0;
    fire(m,{...aim,direction});
    assert.equal(Math.sign(m.shells[0].vx),direction);
    fire(m,aim); drive(m,1); advance(m);
    assert.equal(m.shells.length,1); assert.equal(m.drive,DRIVE); assert.equal(active(m),0);
    resolve(m); assert.match(m.report,/wide/); advance(m); assert.equal(active(m),2);
  }
});
test('heavy stock, DM restriction and three projectiles at the starburst apex',() => {
  const m=match();
  fire(m,{...aim,ammo:'starburst'}); fire(m,{...aim,ammo:'starburst'});
  assert.equal(m.starburst,0);
  for (let i=0; i<1000 && m.shells.length===1; i++) step(m);
  assert.equal(m.shells.length,3); resolve(m); advance(m);
  fire(m,{...aim,ammo:'heavy'}); assert.equal(m.phase,'aim'); assert.equal(m.heavy,2);
  m.turn=0; fire(m,{...aim,ammo:'starburst'}); assert.equal(m.phase,'aim');
  for (let i=0;i<2;i++) {fire(m,{...aim,ammo:'heavy'}); resolve(m); advance(m); m.turn=0;}
  assert.equal(m.heavy,0); fire(m,{...aim,ammo:'heavy'}); assert.equal(m.phase,'aim');
});
test('impact deals direct and splash damage, lowers ground and settles survivors',() => {
  const m=match(); m.terrain.fill(280);
  m.tanks[1].x=200; m.tanks[2].x=224;
  fire(m,aim); Object.assign(m.shells[0],{x:200,y:274,vx:0,vy:10});
  resolve(m);
  assert.deepEqual(m.tanks.map(t=>t.hull),[3,1,2]);
  assert.ok(ground(m,200)>280); assert.ok(ground(m,224)>280);
});
test('resolve self-hits and all remaining projectiles before a final draw',() => {
  const m=match(2); m.tanks.forEach(t=>t.hull=1);
  fire(m,aim);
  m.shells=m.tanks.map((t,i)=>({x:t.x,y:ground(m,t.x)-6-i*30,vx:0,vy:60,split:false}));
  step(m); assert.equal(m.phase,'shot'); assert.equal(m.tanks[0].hull,0);
  resolve(m); assert.equal(m.phase,'over'); assert.equal(m.tanks[1].hull,0);
  assert.match(m.report,/Tank 0/);
});
