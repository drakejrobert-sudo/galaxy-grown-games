import assert from 'node:assert/strict';
import test from 'node:test';
import {createMatch, active, drive, fire, step, ground, muzzle, tankSurface, DRIVE, STEP, type Match, type Aim} from '../src/tanks/rules.ts';

const aim: Aim = {direction:1,angle:45,power:50,ammo:'standard'};
function match(count = 3, battlefield: Match['battlefield'] = 'hillside') {
  const m = createMatch(Array.from({length:count},(_,i) => 'Tank '+i),0,17,battlefield);
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
    fire(m,aim); drive(m,1);
    assert.equal(m.shells.length,1); assert.equal(m.drive,DRIVE); assert.equal(active(m),0);
    resolve(m); assert.match(m.report,/wide/); assert.equal(active(m),2);
  }
});
test('heavy stock, DM restriction and three projectiles at the starburst apex',() => {
  const m=match();
  fire(m,{...aim,ammo:'starburst'}); fire(m,{...aim,ammo:'starburst'});
  assert.equal(m.starburst,0);
  for (let i=0; i<1000 && m.shells.length===1; i++) step(m);
  assert.equal(m.shells.length,3); resolve(m);
  fire(m,{...aim,ammo:'heavy'}); assert.equal(m.phase,'aim'); assert.equal(m.heavy,2);
  m.turn=0; fire(m,{...aim,ammo:'starburst'}); assert.equal(m.phase,'aim');
  for (let i=0;i<2;i++) {fire(m,{...aim,ammo:'heavy'}); resolve(m); m.turn=0;}
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

test('automatic handoff retains only each seat’s last valid fired elevation and power', () => {
  const m = match();
  const shot = [{angle: 25, power: 70}, {angle: 50, power: 62}, {angle: 75, power: 34}];
  for (const [i, settings] of shot.entries()) {
    assert.equal(active(m), i);
    assert.equal(m.drive, DRIVE);
    assert.deepEqual([m.tanks[i].angle, m.tanks[i].power], [45, 55]);
    drive(m, 1);
    fire(m, {...aim, ...settings, ammo: i === 0 ? 'standard' : 'heavy'});
    if (i !== 0) {
      assert.equal(m.phase, 'aim');
      assert.deepEqual([m.tanks[i].angle, m.tanks[i].power], [45, 55]);
      fire(m, {...aim, ...settings});
    }
    Object.assign(m.shells[0], {x: 799, vx: 500});
    resolve(m);
    assert.equal(m.phase, 'aim');
    assert.match(m.report, /wide/);
  }
  assert.equal(active(m), 0);
  assert.deepEqual(m.tanks.map(({angle, power}) => ({angle, power})), shot);
  const fresh = createMatch(m.tanks.map(t => t.name), m.dm, 33, m.battlefield);
  assert.ok(fresh.tanks.every(t => t.angle === 45 && t.power === 55));
});

test('handoff waits for the final explosion and stops on a surviving winner', () => {
  const m = match(2);
  m.tanks[1].hull = 1;
  const target = tankSurface(m, m.tanks[1]);
  fire(m, aim);
  Object.assign(m.shells[0], {x: target.x, y: target.y - 6, vx: 0, vy: 0});
  step(m);
  assert.equal(m.tanks[1].hull, 0);
  assert.equal(m.phase, 'shot');
  assert.equal(m.blasts.length, 1);
  resolve(m);
  assert.equal(m.phase, 'over');
  assert.equal(m.tanks.find(t => t.hull > 0)?.name, 'Tank 0');
});

test('Moon Basin has seeded cratered terrain and lower gravity than Hillside', () => {
  const hillside = match(), moon = match(3, 'moon');
  assert.deepEqual(moon, match(3, 'moon'));
  assert.notDeepEqual(moon.terrain, hillside.terrain);
  assert.ok(ground(moon, 400) > ground(moon, 100) + 40);
  fire(moon, aim);
  fire(hillside, aim);
  step(moon);
  step(hillside);
  assert.ok(moon.shells[0].vy < hillside.shells[0].vy);
});

test('planetary matches distribute seats with clearance and drive and aim on the underside', () => {
  for (let count = 2; count <= 8; count++) {
    const m = match(count, 'planets');
    assert.deepEqual(m, match(count, 'planets'));
    assert.equal(m.planets.length, 3);
    assert.equal(new Set(m.tanks.map(t => t.planet)).size, Math.min(count, 3));
    for (const [i, tank] of m.tanks.entries()) {
      const p = tankSurface(m, tank);
      for (const other of m.tanks.slice(i + 1)) {
        const q = tankSurface(m, other);
        assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 24);
      }
    }
    m.turn = 1;
    const tank = m.tanks[1];
    const underside = tankSurface(m, tank);
    const barrel = muzzle(m, {...aim, angle: 90});
    assert.ok(underside.ny > 0);
    assert.ok(Math.abs(barrel.dx - underside.nx) < 1e-9);
    assert.ok(barrel.y > underside.y);
    const start = tank.x;
    drive(m, 1);
    assert.equal(tank.x, start + 6);
    assert.equal(m.drive, DRIVE - 6);
  }
});

test('a curved shot hits a different planet, carves its surface, and settles the surviving tank', () => {
  const m = match(3, 'planets');
  const target = m.tanks[1], planet = m.planets[target.planet!];
  const before = tankSurface(m, target);
  fire(m, {...aim, direction: 1, angle: 40, power: 75});
  const initial = {...m.shells[0]};
  for (let i = 0; i < 30; i++) step(m);
  assert.ok(Math.hypot(m.shells[0].x - (initial.x + initial.vx * STEP * 30),
    m.shells[0].y - (initial.y + initial.vy * STEP * 30)) > 1);
  resolve(m);
  const after = tankSurface(m, target);
  assert.equal(target.hull, 1);
  assert.ok(Math.hypot(after.x - planet.x, after.y - planet.y) < Math.hypot(before.x - planet.x, before.y - planet.y));
  assert.ok(m.planets[0].surface.every(r => r === m.planets[0].radius));
  assert.equal(active(m), 1);
});

test('planetary starburst fans out at its launch planet apex', () => {
  const m = match(3, 'planets');
  fire(m, {...aim, direction: -1, angle: 35, power: 15, ammo: 'starburst'});
  for (let i = 0; i < 700 && m.shells.length === 1; i++) step(m);
  assert.equal(m.shells.length, 3);
  assert.ok(m.shells.every(s => !s.split));
  resolve(m);
  assert.equal(active(m), 1);
});

test('a projectile that stays in orbit times out and starts the next turn', () => {
  const m = match(2, 'planets');
  fire(m, aim);
  Object.assign(m.shells[0], {x: 150, y: 128, vx: 106, vy: 0});
  for (let i = 0; i < 12 / STEP - 1; i++) step(m);
  assert.equal(m.phase, 'shot');
  assert.equal(m.shells.length, 1);
  step(m);
  assert.equal(m.phase, 'aim');
  assert.equal(m.report, 'Shot timed out.');
  assert.equal(active(m), 1);
});
