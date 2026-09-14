import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  difficultyFor, parseTotal, flightSpeed, createFlight, stepFlight, scoreFor, resultText,
  createGunner, stepGunner, gunnerFireEvery, gunnerScoreFor, gunnerResultText,
  bomberBlastRadius, bomberResultText, bomberScoreFor, createBomber, stepBomber,
  createLifeSupport, lifeSupportPacketKind, lifeSupportResultText, lifeSupportScoreFor, stepLifeSupport,
  createSpaceBattlePilot, stepSpaceBattlePilot, spaceBattlePilotSpeed,
  spaceBattlePilotScoreFor, spaceBattlePilotResultText, SPACE_BATTLE_TUNING,
  SPACE_BATTLE_MAX_FUEL,
  BOMBER_BLAST_RADIUS, BOMBER_TUNING, GUNNER_DEFENSE_LINE, GUNNER_TUNING,
  LIFE_SUPPORT_MAX_INTEGRITY, LIFE_SUPPORT_SWITCH_Y, LIFE_SUPPORT_TUNING,
  PILOT_RADIUS, SIDE_WARNING_SECONDS, WIDTH,
} from '../src/game/rules.ts';
test('modified total bands include negatives and values over 20', () => {
  for (const [value, expected] of [[-4,'Hard'],[0,'Hard'],[1,'Hard'],[5,'Hard'],[6,'Medium'],[10,'Medium'],[11,'Easy'],[15,'Easy'],[16,'Very Easy'],[27,'Very Easy']] as const) assert.equal(difficultyFor(value), expected);
  for (const invalid of ['', ' ', '2.5', 'word', '1e2', 'Infinity']) assert.equal(parseTotal(invalid), null);
  assert.equal(parseTotal(' -3 '), -3); assert.equal(parseTotal('+17'), 17);
});
test('natural one is separate from base difficulty and reduces actual movement', () => {
  const standard = { total: 17, naturalOne: false }, impaired = { ...standard, naturalOne: true };
  assert.equal(difficultyFor(impaired.total), 'Very Easy');
  assert.equal(flightSpeed(impaired), flightSpeed(standard) * 0.6);
  const a = createFlight(), b = createFlight();
  stepFlight(a, standard, { x: 1, y: 0 }, 0.05); stepFlight(b, impaired, { x: 1, y: 0 }, 0.05);
  assert.ok(Math.abs((b.x-240)/(a.x-240)-0.6) < 0.0001);
});
test('collision grace prevents multiple hits in the same frame and run ends at zero hull', () => {
  const s = createFlight(), config = { total: 10, naturalOne: false };
  s.asteroids = [1,2].map(() => ({ x:s.x,y:s.y,radius:20,speed:0 }));
  stepFlight(s, config, {x:0,y:0}, 0.01); assert.equal(s.hull, 2); assert.equal(s.hits, 1);
  s.hull=1;s.invulnerable=0;stepFlight(s,config,{x:0,y:0},0.01);assert.equal(s.finished,true);
  const time=s.elapsed;stepFlight(s,config,{x:1,y:0},0.05);assert.equal(s.elapsed,time);
});
test('survival completes at 60 seconds, scores consistently, and includes impairment in report', () => {
  const s=createFlight();s.elapsed=59.99;s.spawnIn=100;
  const config={total:22,naturalOne:true};stepFlight(s,config,{x:0,y:0},0.05);
  assert.equal(s.elapsed,60);assert.equal(s.finished,true);assert.equal(scoreFor(s),900);
  assert.match(resultText(config,s), /Natural 1: Yes/);assert.match(resultText(config,s),/Very Easy/);
});

test('side hazards provide warning at both edges, move across the field, and are cleaned up', () => {
  for (const left of [true, false]) {
    const s = createFlight(); s.spawnIn = 0;
    s.x = left ? 18 : WIDTH - 18;
    // Maximum-size, maximum-speed Hard rock aimed at a ship against the entry edge.
    const values = [1, 1, 0, left ? 0 : 0.9, 0.5, 0.5, 0.5];
    stepFlight(s, {total: 5, naturalOne: false}, {x:0,y:0}, 0.05, () => values.shift() ?? 0.5);
    assert.equal(s.asteroids.length, 1);
    const a = s.asteroids[0];
    assert.equal(a.side, left ? 'left' : 'right');
    assert.ok(left ? a.vx! > 0 && a.x + a.radius < 0 : a.vx! < 0 && a.x - a.radius > WIDTH);
    const secondsUntilVisible = left
      ? (-a.radius - a.x) / a.vx!
      : (a.x - (WIDTH + a.radius)) / -a.vx!;
    assert.ok(secondsUntilVisible >= SIDE_WARNING_SECONDS - 0.051);
    const secondsUntilPossibleHit = left
      ? (s.x - PILOT_RADIUS - a.radius - a.x) / a.vx!
      : (a.x - (s.x + PILOT_RADIUS + a.radius)) / -a.vx!;
    assert.ok(secondsUntilPossibleHit >= 1);
    const oldX = a.x; s.spawnIn = 100;
    stepFlight(s, {total:5,naturalOne:false}, {x:0,y:0}, 0.05);
    assert.ok(left ? a.x > oldX : a.x < oldX);
    a.x = left ? WIDTH + a.radius + 21 : -a.radius - 21;
    stepFlight(s, {total:5,naturalOne:false}, {x:0,y:0}, 0.05);
    assert.equal(s.asteroids.length, 0);
  }
});

test('difficulty increases hazard density and reduces steering speed without changing natural-one ratio', () => {
  let previousCount = 0, previousSpeed = Infinity;
  for (const total of [16, 11, 6, 5]) {
    const s = createFlight(); s.invulnerable = 100;
    for (let i = 0; i < 100; i++) stepFlight(s, {total,naturalOne:false}, {x:0,y:0}, 0.05, () => 0.5);
    assert.ok(s.asteroids.length >= previousCount);
    previousCount = s.asteroids.length;
    const speed = flightSpeed({total,naturalOne:false});
    assert.ok(speed < previousSpeed); previousSpeed = speed;
    assert.equal(flightSpeed({total,naturalOne:true}), speed * 0.6);
    assert.ok(s.asteroids.every(a => Number.isFinite(a.x) && Number.isFinite(a.y)));
  }
});

test('gunner natural one halves the selected difficulty fire rate', () => {
  for (const total of [5, 6, 11, 16]) {
    const normal = gunnerFireEvery({total, naturalOne:false});
    const impaired = gunnerFireEvery({total, naturalOne:true});
    assert.equal(impaired, normal * 2);
  }
  const normal = createGunner(), impaired = createGunner();
  normal.spawnIn = impaired.spawnIn = 100;
  const input = {firing:true};
  stepGunner(normal, {total:10,naturalOne:false}, input, 0.01);
  stepGunner(impaired, {total:10,naturalOne:true}, input, 0.01);
  assert.equal(impaired.cooldown, normal.cooldown * 2);
});

test('gunner targets asteroids, destroys standard rocks, and requires two hits for armor', () => {
  const s = createGunner(); s.spawnIn = 100;
  s.asteroids = [
    {id:1,x:100,y:100,radius:20,speed:0,hp:1,maxHp:1},
    {id:2,x:300,y:100,radius:20,speed:0,hp:2,maxHp:2},
  ];
  const config = {total:12,naturalOne:false};
  stepGunner(s, config, {aimX:100,aimY:100,firing:true}, 0.01);
  assert.equal(s.destroyed, 1); assert.deepEqual(s.asteroids.map(a => a.id), [2]);
  s.cooldown = 0;
  stepGunner(s, config, {aimX:300,aimY:100,firing:true}, 0.01);
  assert.equal(s.asteroids[0].hp, 1); assert.equal(s.destroyed, 1);
  s.cooldown = 0;
  stepGunner(s, config, {aimX:300,aimY:100,firing:true}, 0.01);
  assert.equal(s.asteroids.length, 0); assert.equal(s.destroyed, 2); assert.equal(s.shots, 3);
});

test('uncleared gunner hazards damage hull and end the run', () => {
  const s = createGunner(); s.spawnIn = 100; s.hull = 1;
  s.asteroids = [{id:1,x:200,y:GUNNER_DEFENSE_LINE-20,radius:20,speed:10,hp:1,maxHp:1}];
  stepGunner(s, {total:10,naturalOne:false}, {firing:false}, 0.01);
  assert.equal(s.impacts, 1); assert.equal(s.hull, 0); assert.equal(s.asteroids.length, 0);
  assert.equal(s.finished, true); assert.ok(s.impactFlash > 0);
});

test('gunner difficulty scales hazards and final report stays manual and role-specific', () => {
  assert.ok(GUNNER_TUNING.Hard.spawnEvery < GUNNER_TUNING.Medium.spawnEvery);
  assert.ok(GUNNER_TUNING.Medium.spawnEvery < GUNNER_TUNING.Easy.spawnEvery);
  assert.ok(GUNNER_TUNING.Easy.spawnEvery < GUNNER_TUNING['Very Easy'].spawnEvery);
  assert.ok(GUNNER_TUNING.Hard.speed > GUNNER_TUNING['Very Easy'].speed);
  const s = createGunner(); s.elapsed = 60; s.destroyed = 4; s.hull = 2; s.shots = 7; s.finished = true;
  assert.equal(gunnerScoreFor(s), 900);
  const report = gunnerResultText({total:4,naturalOne:true}, s);
  assert.match(report, /Asteroid Field \/ Gunner/); assert.match(report, /Difficulty: Hard/);
  assert.match(report, /half normal fire rate/); assert.match(report, /Destroyed: 4/);
  assert.match(report, /GM determines campaign outcome/);
});

test('bomber natural one gives the rendered and collision target exactly half normal area', () => {
  const normal = bomberBlastRadius({total:10, naturalOne:false});
  const impaired = bomberBlastRadius({total:10, naturalOne:true});
  assert.equal(normal, BOMBER_BLAST_RADIUS);
  assert.ok(Math.abs((Math.PI * impaired ** 2) / (Math.PI * normal ** 2) - 0.5) < Number.EPSILON * 4);

  const createBlastTest = (naturalOne: boolean) => {
    const s = createBomber(); s.spawnIn = 100;
    s.mines = [{id:1,x:100,y:300,blastRadius:bomberBlastRadius({total:10,naturalOne}),armIn:0,expiresIn:5}];
    s.asteroids = [
      {id:2,x:100,y:300,radius:15,speed:0},
      {id:3,x:160,y:300,radius:15,speed:0},
    ];
    stepBomber(s, {total:10,naturalOne}, {x:0,y:0,placing:false}, 0.01);
    return s;
  };
  assert.equal(createBlastTest(false).destroyed, 2);
  assert.equal(createBlastTest(true).destroyed, 1);
});

test('bomber steering and mine placement share one simulation action', () => {
  const s = createBomber(); s.spawnIn = 100;
  const oldX = s.x;
  stepBomber(s, {total:12,naturalOne:false}, {x:1,y:0,placing:true}, 0.05);
  assert.ok(s.x > oldX);
  assert.equal(s.minesPlaced, 1);
  assert.equal(s.mines.length, 1);
  assert.equal(s.mines[0].x, s.x);
  assert.equal(s.mines[0].blastRadius, BOMBER_BLAST_RADIUS);
  assert.ok(s.cooldown > 0);
});

test('bomber hazards approach the mine trail and collisions can end the run', () => {
  const s = createBomber(); s.spawnIn = 0;
  stepBomber(s, {total:5,naturalOne:false}, {x:0,y:0,placing:false}, 0.01, () => 0.5);
  assert.equal(s.asteroids.length, 1);
  const asteroid = s.asteroids[0];
  const oldY = asteroid.y; s.spawnIn = 100;
  stepBomber(s, {total:5,naturalOne:false}, {x:0,y:0,placing:false}, 0.05);
  assert.ok(asteroid.y < oldY);
  s.hull = 1; s.asteroids = [{id:99,x:s.x,y:s.y,radius:15,speed:0}];
  stepBomber(s, {total:5,naturalOne:false}, {x:0,y:0,placing:false}, 0.01);
  assert.equal(s.hull, 0); assert.equal(s.impacts, 1); assert.equal(s.finished, true);

  const complete = createBomber(); complete.spawnIn = 100; complete.elapsed = 59.99;
  stepBomber(complete, {total:5,naturalOne:false}, {x:0,y:0,placing:false}, 0.05);
  assert.equal(complete.elapsed, 60); assert.equal(complete.finished, true); assert.equal(complete.hull, 3);
});

test('bomber difficulty scales hazard pressure and report remains manual', () => {
  assert.ok(BOMBER_TUNING.Hard.spawnEvery < BOMBER_TUNING.Medium.spawnEvery);
  assert.ok(BOMBER_TUNING.Medium.spawnEvery < BOMBER_TUNING.Easy.spawnEvery);
  assert.ok(BOMBER_TUNING.Easy.spawnEvery < BOMBER_TUNING['Very Easy'].spawnEvery);
  assert.ok(BOMBER_TUNING.Hard.speed > BOMBER_TUNING['Very Easy'].speed);
  const s = createBomber(); s.elapsed = 60; s.destroyed = 5; s.minesPlaced = 7; s.hull = 2; s.finished = true;
  assert.equal(bomberScoreFor(s), 1000);
  const report = bomberResultText({total:4,naturalOne:true}, s);
  assert.match(report, /Asteroid Field \/ Bomber/); assert.match(report, /Difficulty: Hard/);
  assert.match(report, /half normal area/); assert.match(report, /Destroyed: 5/);
  assert.match(report, /GM determines campaign outcome/);
});

test('life support natural one exactly halves hearts and adds overloads per packet cycle', () => {
  const standard = Array.from({length: 12}, (_, index) => lifeSupportPacketKind(index, false));
  const impaired = Array.from({length: 12}, (_, index) => lifeSupportPacketKind(index, true));
  assert.equal(standard.filter(kind => kind === 'heart').length, 2);
  assert.equal(impaired.filter(kind => kind === 'heart').length, 1);
  assert.equal(standard.filter(kind => kind === 'overload').length, 1);
  assert.equal(impaired.filter(kind => kind === 'overload').length, 2);
});

test('life support routes matching packets and repair hearts restore integrity', () => {
  const s = createLifeSupport(); s.spawnIn = 100; s.integrity = 3;
  s.packets = [
    {id:1, x:240, y:LIFE_SUPPORT_SWITCH_Y - 1, speed:100, target:'Shields', kind:'heart'},
  ];
  stepLifeSupport(s, {total:12,naturalOne:false}, {route:'Shields'}, 0.02);
  assert.equal(s.routed, 1); assert.equal(s.heartsRouted, 1);
  assert.equal(s.integrity, 4); assert.equal(s.packets.length, 0);
  assert.equal(s.lastResult, 'correct');
});

test('life support mistakes damage integrity and a missed overload costs two', () => {
  const s = createLifeSupport(); s.spawnIn = 100;
  s.packets = [
    {id:1, x:240, y:LIFE_SUPPORT_SWITCH_Y - 1, speed:100, target:'Guns', kind:'overload'},
  ];
  stepLifeSupport(s, {total:10,naturalOne:true}, {route:'Thrusters'}, 0.02);
  assert.equal(s.integrity, LIFE_SUPPORT_MAX_INTEGRITY - 2);
  assert.equal(s.mistakes, 1); assert.equal(s.lastResult, 'incorrect');
  s.integrity = 1;
  s.packets = [{id:2, x:240, y:LIFE_SUPPORT_SWITCH_Y - 1, speed:100, target:'Shields', kind:'power'}];
  stepLifeSupport(s, {total:10,naturalOne:true}, {route:'Guns'}, 0.02);
  assert.equal(s.integrity, 0); assert.equal(s.finished, true);
});

test('life support difficulty scales pressure and result reporting remains manual', () => {
  assert.ok(LIFE_SUPPORT_TUNING.Hard.spawnEvery < LIFE_SUPPORT_TUNING.Medium.spawnEvery);
  assert.ok(LIFE_SUPPORT_TUNING.Medium.spawnEvery < LIFE_SUPPORT_TUNING.Easy.spawnEvery);
  assert.ok(LIFE_SUPPORT_TUNING.Easy.spawnEvery < LIFE_SUPPORT_TUNING['Very Easy'].spawnEvery);
  assert.ok(LIFE_SUPPORT_TUNING.Hard.speed > LIFE_SUPPORT_TUNING['Very Easy'].speed);
  const s = createLifeSupport();
  s.elapsed = 60; s.routed = 7; s.heartsRouted = 1; s.overloadsRouted = 2; s.integrity = 4; s.finished = true;
  assert.equal(lifeSupportScoreFor(s), 1250);
  const report = lifeSupportResultText({total:4,naturalOne:true}, s);
  assert.match(report, /Asteroid Field \/ Life Support/); assert.match(report, /Difficulty: Hard/);
  assert.match(report, /one heart and two overloads per 12 packets/);
  assert.match(report, /Correct routes: 7/); assert.match(report, /GM determines campaign outcome/);
});

test('life support completes at 60 seconds when system integrity remains', () => {
  const s = createLifeSupport(); s.spawnIn = 100; s.elapsed = 59.99;
  stepLifeSupport(s, {total:16,naturalOne:false}, {route:'Shields'}, 0.05);
  assert.equal(s.elapsed, 60); assert.equal(s.finished, true);
  assert.equal(s.integrity, LIFE_SUPPORT_MAX_INTEGRITY);
});

test('space battle pilot uses the established natural-one engine impairment', () => {
  for (const total of [5, 6, 11, 16]) {
    const normal = spaceBattlePilotSpeed({total, naturalOne:false});
    assert.equal(spaceBattlePilotSpeed({total, naturalOne:true}), normal * 0.6);
  }
});

test('space battle fuel pickups extend the run without exceeding the tank cap', () => {
  const s = createSpaceBattlePilot();
  s.enemySpawnIn = s.fuelSpawnIn = 100;
  s.fuel = SPACE_BATTLE_MAX_FUEL - 1;
  s.fuelCells = [{id:1, x:s.x, y:s.y, radius:11, speed:0, value:8}];
  stepSpaceBattlePilot(s, {total:12, naturalOne:false}, {x:0,y:0}, 0.01);
  assert.equal(s.fuel, SPACE_BATTLE_MAX_FUEL);
  assert.equal(s.fuelCollected, 1);
  assert.equal(s.fuelCells.length, 0);
});

test('space battle enemies fire aimed shots and impacts consume one hull during collision grace', () => {
  const s = createSpaceBattlePilot();
  s.enemySpawnIn = s.fuelSpawnIn = 100;
  s.enemies = [{id:1, x:100, y:100, radius:16, speed:0, vx:0, shotIn:0}];
  stepSpaceBattlePilot(s, {total:10, naturalOne:false}, {x:0,y:0}, 0.01);
  assert.equal(s.shots.length, 1);
  assert.ok(s.shots[0].vy > 0);
  s.enemies = [{id:2, x:s.x, y:s.y, radius:16, speed:0, vx:0, shotIn:100}];
  s.shots = [{x:s.x, y:s.y, vx:0, vy:0, radius:5}];
  stepSpaceBattlePilot(s, {total:10, naturalOne:false}, {x:0,y:0}, 0.01);
  assert.equal(s.hull, 2);
  assert.equal(s.hits, 1);
  assert.ok(s.invulnerable > 0);
});

test('space battle fuel depletion ends the run and report remains manual and role-specific', () => {
  const s = createSpaceBattlePilot();
  s.enemySpawnIn = s.fuelSpawnIn = 100;
  s.fuel = 0.01;
  stepSpaceBattlePilot(s, {total:4, naturalOne:true}, {x:0,y:0}, 0.02);
  assert.equal(s.finished, true);
  assert.equal(s.endReason, 'fuel');
  assert.equal(spaceBattlePilotScoreFor(s), 300);
  const report = spaceBattlePilotResultText({total:4, naturalOne:true}, s);
  assert.match(report, /Space Battle \/ Pilot/);
  assert.match(report, /Difficulty: Hard/);
  assert.match(report, /overloaded engine/);
  assert.match(report, /Fuel depleted/);
  assert.match(report, /GM determines campaign outcome/);
});

test('space battle difficulty increases enemy pressure and reduces pilot speed', () => {
  assert.ok(SPACE_BATTLE_TUNING.Hard.enemySpawnEvery < SPACE_BATTLE_TUNING.Medium.enemySpawnEvery);
  assert.ok(SPACE_BATTLE_TUNING.Medium.enemySpawnEvery < SPACE_BATTLE_TUNING.Easy.enemySpawnEvery);
  assert.ok(SPACE_BATTLE_TUNING.Easy.enemySpawnEvery < SPACE_BATTLE_TUNING['Very Easy'].enemySpawnEvery);
  assert.ok(SPACE_BATTLE_TUNING.Hard.enemyFireEvery < SPACE_BATTLE_TUNING['Very Easy'].enemyFireEvery);
  assert.ok(spaceBattlePilotSpeed({total:5,naturalOne:false}) < spaceBattlePilotSpeed({total:16,naturalOne:false}));
});

test('space battle can also end by hull loss or completing the timer', () => {
  const destroyed = createSpaceBattlePilot();
  destroyed.enemySpawnIn = destroyed.fuelSpawnIn = 100;
  destroyed.hull = 1;
  destroyed.enemies = [{id:1, x:destroyed.x, y:destroyed.y, radius:16, speed:0, vx:0, shotIn:100}];
  stepSpaceBattlePilot(destroyed, {total:10,naturalOne:false}, {x:0,y:0}, 0.01);
  assert.equal(destroyed.finished, true);
  assert.equal(destroyed.endReason, 'hull');

  const complete = createSpaceBattlePilot();
  complete.enemySpawnIn = complete.fuelSpawnIn = 100;
  complete.elapsed = 59.99;
  complete.fuel = 30;
  stepSpaceBattlePilot(complete, {total:10,naturalOne:false}, {x:0,y:0}, 0.05);
  assert.equal(complete.elapsed, 60);
  assert.equal(complete.finished, true);
  assert.equal(complete.endReason, 'time');
});

test('bomber misses leave the field without damage, score, or impact feedback in every band', () => {
  for (const total of [5, 10, 15, 16]) for (const naturalOne of [false, true]) {
    const s = createBomber(); s.spawnIn = 100; s.hull = 1;
    s.asteroids = [
      {id:1,x:60,y:-40,radius:15,speed:0},
      {id:2,x:s.x + 29,y:s.y,radius:15,speed:0},
    ];
    stepBomber(s, {total,naturalOne}, {x:0,y:0,placing:false}, 0.01);
    assert.equal(s.hull, 1); assert.equal(s.impacts, 0); assert.equal(s.impactFlash, 0);
    assert.equal(s.finished, false); assert.equal(s.destroyed, 0);
    assert.deepEqual(s.asteroids.map(a => a.id), [2]);
    assert.equal(bomberScoreFor(s), 100);
  }
});

test('bomber clustered collisions cost one hull and grace expires before the next damaging hit', () => {
  const s = createBomber(); s.spawnIn = 100;
  const config = {total:10,naturalOne:false}, input = {x:0,y:0,placing:false};
  const hit = (ids: number[]) => {
    s.asteroids = ids.map(id => ({id,x:s.x,y:s.y,radius:15,speed:0}));
    stepBomber(s, config, input, 0.01);
  };
  hit([1,2,3]);
  assert.equal(s.hull, 2); assert.equal(s.impacts, 1); assert.equal(s.asteroids.length, 0);
  assert.equal(s.invulnerable, 1.25);
  hit([4]);
  assert.equal(s.hull, 2); assert.equal(s.impacts, 1); assert.equal(s.asteroids.length, 0);
  for (let i = 0; i < 26; i++) stepBomber(s, config, input, 0.05);
  assert.equal(s.invulnerable, 0);
  hit([5]); assert.equal(s.hull, 1); assert.equal(s.impacts, 2);
});
