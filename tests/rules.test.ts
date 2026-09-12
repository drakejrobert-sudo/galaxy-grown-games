import { test } from 'node:test';
import assert from 'node:assert/strict';
import { difficultyFor, parseTotal, flightSpeed, createFlight, stepFlight, scoreFor, resultText } from '../src/game/rules.ts';
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
