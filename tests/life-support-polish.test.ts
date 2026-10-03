import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLifeSupport, stepLifeSupport, lifeSupportScoreFor, type LifeSupportPacketKind, type LifeSupportRoute } from '../src/game/rules.ts';

function arrival(kind: LifeSupportPacketKind, target: LifeSupportRoute, route: LifeSupportRoute, integrity = 5) {
  const s = createLifeSupport(); s.integrity = integrity; s.spawnIn = 100;
  s.packets = [{ id: 1, x: 240, y: 404, speed: 100, kind, target }];
  stepLifeSupport(s, { total: 2, naturalOne: false }, { route }, .02, () => { throw new Error('unexpected random draw'); });
  return s;
}

test('routing feedback records actual healing, damage and expected/selected destinations', () => {
  for (const [kind, target, route, integrity, delta, correct] of [
    ['power', 'Thrusters', 'Thrusters', 5, 0, true],
    ['heart', 'Shields', 'Shields', 3, 1, true],
    ['heart', 'Shields', 'Shields', 5, 0, true],
    ['overload', 'Guns', 'Guns', 5, 0, true],
    ['power', 'Guns', 'Shields', 5, -1, false],
    ['heart', 'Shields', 'Guns', 5, -1, false],
    ['overload', 'Guns', 'Thrusters', 5, -2, false],
    ['overload', 'Guns', 'Thrusters', 1, -1, false],
  ] as const) {
    const s = arrival(kind, target, route, integrity);
    assert.deepEqual(s.routingFeedback, { kind, expectedRoute: target, selectedRoute: route, correct, integrityDelta: delta });
    assert.equal(s.integrity, integrity + delta);
    assert.equal(s.routed, correct ? 1 : 0); assert.equal(s.mistakes, correct ? 0 : 1);
    assert.equal(s.feedbackTime, .22); assert.equal(s.packets.length, 0);
    assert.equal(lifeSupportScoreFor(s), (correct ? 100 + (kind === 'power' ? 0 : 50) : 0) + s.integrity * 100);
  }
});

test('simultaneous arrivals preserve order and last outcome; feedback expires without erasing history', () => {
  const s = createLifeSupport(); s.spawnIn = 100;
  s.packets = [
    { id: 1, x: 240, y: 404, speed: 100, kind: 'power', target: 'Shields' },
    { id: 2, x: 240, y: 404, speed: 100, kind: 'overload', target: 'Guns' },
  ];
  const config = { total: 2, naturalOne: false };
  stepLifeSupport(s, config, { route: 'Shields' }, .02);
  assert.equal(s.routed, 1); assert.equal(s.mistakes, 1); assert.equal(s.integrity, 3);
  assert.equal(s.routingFeedback?.kind, 'overload'); assert.equal(s.routingFeedback?.correct, false);
  const feedback = structuredClone(s.routingFeedback);
  for (let i = 0; i < 5; i++) stepLifeSupport(s, config, { route: 'Guns' }, .05);
  assert.equal(s.feedbackTime, 0); assert.deepEqual(s.routingFeedback, feedback);
  s.finished = true; const before = structuredClone(s);
  stepLifeSupport(s, config, { route: 'Thrusters' }, .05); assert.deepEqual(s, before);
  assert.equal(createLifeSupport().routingFeedback, null); assert.equal(createLifeSupport().feedbackTime, 0);
});
