import { test } from 'node:test';
import assert from 'node:assert/strict';
import { difficultyFor, parseTotal, flightSpeed, createFlight, stepFlight, scoreFor, resultText, PILOT_RADIUS, SIDE_WARNING_SECONDS, WIDTH } from '../src/game/rules.ts';
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
