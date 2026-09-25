import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpaceLifeSupport, stepSpaceLifeSupport, spaceLifeScoreFor, spaceLifeResultText,
  SPACE_LIFE_MAX_INTEGRITY, SPACE_LIFE_TUNING, type SpaceLifeState,
} from '../src/game/rules.ts';
import { createSpaceLifeInput } from '../src/game/input.ts';

const config = { total: 10, naturalOne: false };
const idle = { x: 0, jump: false, repair: false };
function quiet(): SpaceLifeState {
  const s = createSpaceLifeSupport();
  s.fireIn = s.iconIn = 100;
  return s;
}

test('jump lands on the next platform; ordinary fires require a descending stomp', () => {
  const s = quiet();
  s.fires = [{ id: 1, x: 150, y: 520, kind: 'ordinary', remaining: 100 }];
  stepSpaceLifeSupport(s, config, idle, 0.05);
  assert.equal(s.ordinaryCleared, 0);
  stepSpaceLifeSupport(s, config, { ...idle, jump: true }, 0.05);
  assert.ok(s.y < 520);
  for (let i = 0; i < 30 && !s.grounded; i++) stepSpaceLifeSupport(s, config, idle, 0.05);
  assert.equal(s.y, 410);
  assert.equal(s.ordinaryCleared, 0);
  // A fire on the landing platform is cleared from above, once.
  s.fires = [{ id: 2, x: 150, y: 410, kind: 'ordinary', remaining: 100 }];
  stepSpaceLifeSupport(s, config, { ...idle, jump: true }, 0.05);
  for (let i = 0; i < 30 && !s.grounded; i++) stepSpaceLifeSupport(s, config, idle, 0.05);
  assert.equal(s.y, 410); // The upper platform is out of horizontal reach at x=150.
  assert.equal(s.ordinaryCleared, 1);
  assert.equal(s.fires.length, 0);
  // From the platform edge, moving while jumping reaches the next tier.
  s.x = 240;
  stepSpaceLifeSupport(s, config, { x: 1, jump: true, repair: false }, 0.05);
  for (let i = 0; i < 30 && !s.grounded; i++) stepSpaceLifeSupport(s, config, { x: 1, jump: false, repair: false }, 0.05);
  assert.equal(s.y, 300);
});

test('electrical repairs require a nearby grounded action, and unresolved fires drain integrity', () => {
  const s = quiet();
  s.fires = [{ id: 1, x: 190, y: 520, kind: 'electrical', remaining: 1 }];
  stepSpaceLifeSupport(s, config, { ...idle, repair: true }, 0.05);
  assert.equal(s.electricalRepaired, 0);
  s.x = 160;
  stepSpaceLifeSupport(s, config, { ...idle, repair: true }, 0.05);
  assert.equal(s.electricalRepaired, 1);
  assert.equal(s.fires.length, 0);
  s.fires = [{ id: 2, x: 300, y: 300, kind: 'ordinary', remaining: 0.01 }];
  stepSpaceLifeSupport(s, config, idle, 0.05);
  assert.equal(s.integrity, 4);
  assert.equal(s.firesExpired, 1);
  s.integrity = 1;
  s.fires = [{ id: 3, x: 300, y: 300, kind: 'electrical', remaining: 0.01 }];
  s.icons = [{ id: 4, x: s.x, y: s.y - 19, kind: 'heart', remaining: 8 }];
  stepSpaceLifeSupport(s, config, idle, 0.05);
  assert.equal(s.integrity, 0);
  assert.equal(s.finished, true);
  assert.equal(s.heartsCollected, 0);
  const elapsed = s.elapsed;
  stepSpaceLifeSupport(s, config, idle, 0.05);
  assert.equal(s.elapsed, elapsed);
});

test('hearts heal up to five, overload contact damages once, and grace prevents repeated damage', () => {
  const s = quiet(); s.integrity = 4;
  s.icons = [{ id: 1, x: s.x, y: s.y - 19, kind: 'heart', remaining: 8 }];
  stepSpaceLifeSupport(s, config, idle, 0.01);
  assert.equal(s.integrity, SPACE_LIFE_MAX_INTEGRITY);
  assert.equal(s.heartsCollected, 1);
  s.icons = [{ id: 2, x: s.x, y: s.y - 19, kind: 'overload', remaining: 8 }];
  stepSpaceLifeSupport(s, config, idle, 0.01);
  assert.equal(s.integrity, 4);
  assert.equal(s.overloadHits, 1);
  s.icons = [{ id: 3, x: s.x, y: s.y - 19, kind: 'overload', remaining: 8 }];
  stepSpaceLifeSupport(s, config, idle, 0.01);
  assert.equal(s.integrity, 4);
});

test('each complete 12-opportunity cycle has the approved standard or Natural 1 icon mix', () => {
  for (const naturalOne of [false, true]) {
    const s = quiet(); s.iconIn = 0.8;
    const seen = new Map<number, string>();
    for (let i = 0; i < 1210 && !s.finished; i++) {
      stepSpaceLifeSupport(s, { total: 16, naturalOne }, idle, 0.05, () => 0);
      for (const icon of s.icons) seen.set(icon.id, icon.kind);
    }
    assert.equal(s.iconIndex, 12);
    assert.equal([...seen.values()].filter(kind => kind === 'heart').length, naturalOne ? 1 : 2);
    assert.equal([...seen.values()].filter(kind => kind === 'overload').length, naturalOne ? 2 : 1);
    assert.equal(s.finished, true);
    assert.equal(s.elapsed, 60);
  }
});

test('difficulty only changes fire pressure; scoring and report retain the GM boundary', () => {
  let previousInterval = Infinity;
  for (const total of [16, 11, 6, 5]) {
    const s = quiet(); s.fireIn = 0;
    stepSpaceLifeSupport(s, { total, naturalOne: false }, idle, 0.05, () => 0);
    const tuning = SPACE_LIFE_TUNING[total === 16 ? 'Very Easy' : total === 11 ? 'Easy' : total === 6 ? 'Medium' : 'Hard'];
    assert.equal(s.fireIn, tuning.spawnEvery - 0.05);
    assert.ok(tuning.spawnEvery < previousInterval);
    previousInterval = tuning.spawnEvery;
    assert.equal(s.fires[0].remaining, tuning.fireLifetime - 0.05);
  }
  const s = quiet(); s.elapsed = 20; s.integrity = 2; s.ordinaryCleared = 3; s.electricalRepaired = 2;
  assert.equal(spaceLifeScoreFor(s), 900);
  const report = spaceLifeResultText({ total: -2, naturalOne: true }, s);
  assert.match(report, /Space Battle \/ Life Support/);
  assert.match(report, /Difficulty: Hard/);
  assert.match(report, /one heart and two overload/);
  assert.match(report, /Fires stomped: 3 • Electrical repairs: 2/);
  assert.match(report, /GM determines campaign outcome/);
});

test('keyboard and simultaneous touch controls move, jump, repair, and clear on pause', () => {
  const oldWindow = globalThis.window;
  const listeners = new Map<string, Function>();
  globalThis.window = { addEventListener: (event: string, listener: Function) => listeners.set(event, listener) } as any;
  try {
    const handlers = new Map<string, Map<string, Function>>();
    const buttons = Object.fromEntries(['left', 'right', 'jump', 'repair'].map(action => {
      const events = new Map<string, Function>(); handlers.set(action, events);
      return [action, { addEventListener: (event: string, listener: Function) => events.set(event, listener), setPointerCapture() {} }];
    })) as any;
    const input = createSpaceLifeInput(buttons); input.enable(true);
    let prevented = 0;
    listeners.get('keydown')!({ code: 'KeyD', preventDefault: () => prevented++ });
    listeners.get('keydown')!({ code: 'Space', preventDefault: () => prevented++ });
    handlers.get('repair')!.get('pointerdown')!({ pointerId: 2, preventDefault: () => prevented++ });
    assert.deepEqual(input.read(), { x: 1, jump: true, repair: true });
    assert.deepEqual(input.read(), { x: 1, jump: false, repair: false });
    handlers.get('left')!.get('pointerdown')!({ pointerId: 3, preventDefault: () => prevented++ });
    assert.equal(input.read().x, 0);
    handlers.get('left')!.get('pointerup')!({ pointerId: 3 });
    assert.equal(input.read().x, 1);
    input.enable(false); input.enable(true);
    assert.deepEqual(input.read(), idle);
    assert.equal(prevented, 4);
  } finally { globalThis.window = oldWindow; }
});
