import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpaceLifeSupport, stepSpaceLifeSupport, spaceLifeScoreFor, spaceLifeResultText,
  SPACE_LIFE_MAX_INTEGRITY, SPACE_LIFE_TUNING, type SpaceLifeState,
} from '../src/game/rules.ts';
import { createSpaceLifeInput } from '../src/game/input.ts';

const config = { total: 10, naturalOne: false };
const idle = { x: 0, jump: false };
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
  stepSpaceLifeSupport(s, config, { x: 1, jump: true }, 0.05);
  for (let i = 0; i < 30 && !s.grounded; i++) stepSpaceLifeSupport(s, config, { x: 1, jump: false }, 0.05);
  assert.equal(s.y, 300);
});

test('electrical repairs need accumulated proximity, and unresolved fires drain integrity', () => {
  const s = quiet();
  s.fires = [{ id: 1, x: 190, y: 520, kind: 'electrical', remaining: 10, sparkIn: 100 }];
  stepSpaceLifeSupport(s, config, { ...idle }, 0.05);
  assert.equal(s.electricalRepaired, 0);
  s.x = 160;
  advance(s, 1.5);
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

test('difficulty changes hazard pressure; scoring and report retain the GM boundary', () => {
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
  s.elapsed = 10.4;
  assert.equal(spaceLifeScoreFor(s), 852);
  const report = spaceLifeResultText({ total: -2, naturalOne: true }, s);
  assert.match(report, /Score: 852 • Time: 10\.4s/);
  assert.match(report, /Space Battle \/ Life Support/);
  assert.match(report, /Difficulty: Hard/);
  assert.match(report, /one heart and two overload/);
  assert.match(report, /Fires stomped: 3 • Electrical repairs: 2/);
  assert.match(report, /GM determines campaign outcome/);
});

test('keyboard and simultaneous touch controls move, jump, and clear on pause', () => {
  const oldWindow = globalThis.window;
  const listeners = new Map<string, Function>();
  globalThis.window = { addEventListener: (event: string, listener: Function) => listeners.set(event, listener) } as any;
  try {
    const handlers = new Map<string, Map<string, Function>>();
    const buttons = Object.fromEntries(['left', 'right', 'jump'].map(action => {
      const events = new Map<string, Function>(); handlers.set(action, events);
      return [action, { addEventListener: (event: string, listener: Function) => events.set(event, listener), setPointerCapture() {} }];
    })) as any;
    const input = createSpaceLifeInput(buttons); input.enable(true);
    for (const code of ['KeyE', 'Enter']) listeners.get('keydown')!({ code, preventDefault() { throw Error('removed repair key consumed'); } });
    let prevented = 0;
    listeners.get('keydown')!({ code: 'KeyD', preventDefault: () => prevented++ });
    listeners.get('keydown')!({ code: 'Space', preventDefault: () => prevented++ });
    handlers.get('jump')!.get('pointerdown')!({ pointerId: 2, preventDefault: () => prevented++ });
    assert.deepEqual(input.read(), { x: 1, jump: true });
    assert.deepEqual(input.read(), { x: 1, jump: false });
    handlers.get('left')!.get('pointerdown')!({ pointerId: 3, preventDefault: () => prevented++ });
    assert.equal(input.read().x, 0);
    handlers.get('left')!.get('pointerup')!({ pointerId: 3 });
    assert.equal(input.read().x, 1);
    input.enable(false); input.enable(true);
    assert.deepEqual(input.read(), idle);
    assert.equal(prevented, 4);
  } finally { globalThis.window = oldWindow; }
});

function advance(s: SpaceLifeState, seconds: number, total = 2) {
  for (let i = 0; i < Math.round(seconds / .01) && !s.finished; i++)
    stepSpaceLifeSupport(s, { total, naturalOne: false }, idle, .01);
}
function panel(s: SpaceLifeState, sparkIn = 1) {
  s.fires = [{ id: 20, x: 85, y: 520, kind: 'electrical', remaining: 100, sparkIn }];
  s.nextId = 21;
}

test('panels warn without damage, first burst waits one second, and bursts scale by band', () => {
  for (const total of [16, 11, 6, 2]) {
    const s = quiet(); panel(s);
    advance(s, .2, total);
    assert.ok(Math.abs(s.fires[0].sparkIn! - .8) < 1e-8);
    assert.equal(s.sparks.length, 0); assert.equal(s.integrity, 5);
    advance(s, .79, total); assert.equal(s.sparks.length, 0);
    advance(s, .01, total); assert.equal(s.sparks.length, 2);
    const tuning = SPACE_LIFE_TUNING[total === 16 ? 'Very Easy' : total === 11 ? 'Easy' : total === 6 ? 'Medium' : 'Hard'];
    assert.equal(Math.abs(s.sparks[0].vx), tuning.sparkSpeed);
    assert.deepEqual(s.sparks.map(spark => [spark.x, spark.y]), [[67, 506], [103, 506]]);
    assert.ok(Math.abs(s.fires[0].sparkIn! - tuning.sparkEvery) < 1e-8);
    assert.equal(s.sparks[0].remaining, 4);
  }
});

test('newly spawned panels retain a full second before firing', () => {
  const s = quiet(); s.fireIn = 0;
  stepSpaceLifeSupport(s, config, idle, .05, () => 0);
  assert.equal(s.fires[0].sparkIn, 1);
  advance(s, .99); assert.equal(s.sparks.length, 0);
  advance(s, .01); assert.equal(s.sparks.length, 2);
});

test('repair wins over a due burst while launched sparks survive source repair', () => {
  const s = quiet(); panel(s, .01); s.x = 85; s.fires[0].repairProgress = 1.45;
  s.sparks = [{ id: 19, x: 200, y: 506, vx: 165, remaining: 2 }];
  stepSpaceLifeSupport(s, config, { ...idle }, .05);
  assert.equal(s.fires.length, 0); assert.equal(s.electricalRepaired, 1);
  assert.equal(s.sparks.length, 1); assert.ok(s.sparks[0].x > 200);
  advance(s, .5); assert.equal(s.sparks.length, 1);
});

test('armed flames hurt side and rising contact; spawn warning and descending stomp stay safe', () => {
  const s = quiet();
  s.fires = [{ id: 1, x: 150, y: 520, kind: 'ordinary', remaining: 100, arming: .6 }];
  advance(s, .59); assert.equal(s.integrity, 5);
  advance(s, .02); assert.equal(s.integrity, 4); assert.equal(s.fireContactHits, 1);
  assert.equal(s.ordinaryCleared, 0);
  const rising = quiet(); rising.y = 530; rising.vy = -100; rising.grounded = false;
  rising.fires = [{ id: 1, x: 150, y: 520, kind: 'ordinary', remaining: 10 }];
  stepSpaceLifeSupport(rising, config, idle, .05);
  assert.equal(rising.fireContactHits, 1); assert.equal(rising.ordinaryCleared, 0);
  const stomp = quiet(); stomp.y = 480; stomp.vy = 400; stomp.grounded = false;
  stomp.fires = [{ id: 1, x: 150, y: 520, kind: 'ordinary', remaining: 10 }];
  advance(stomp, .1);
  assert.equal(stomp.ordinaryCleared, 1); assert.equal(stomp.integrity, 5);
  assert.equal(stomp.fires.length, 0);
});

test('jump and outside-contact geometry provide safe routes', () => {
  const s = quiet(); s.x = 173;
  s.fires = [{ id: 1, x: 150, y: 520, kind: 'ordinary', remaining: 10 }];
  advance(s, .05); assert.equal(s.integrity, 5);
  s.x = 150; s.y = 480; s.vy = 0; s.grounded = false;
  s.sparks = [{ id: 2, x: 150, y: 506, vx: 165, remaining: 4 }];
  stepSpaceLifeSupport(s, config, idle, .01);
  assert.equal(s.integrity, 5); assert.equal(s.sparks.length, 1);
});

test('spark sweep catches crossings and moving crew, with a circular rather than square corner', () => {
  const crossing = quiet();
  crossing.sparks = [{ id: 1, x: 100, y: 506, vx: 2000, remaining: 4 }];
  stepSpaceLifeSupport(crossing, config, idle, .05);
  assert.equal(crossing.sparkHits, 1); assert.equal(crossing.sparks.length, 0);
  const moving = quiet();
  moving.sparks = [{ id: 1, x: 169, y: 506, vx: -165, remaining: 4 }];
  stepSpaceLifeSupport(moving, config, { ...idle, x: 1 }, .05);
  assert.equal(moving.sparkHits, 1);
  const corner = quiet();
  corner.sparks = [{ id: 1, x: 164, y: 489, vx: 0, remaining: 4 }];
  stepSpaceLifeSupport(corner, config, idle, .01);
  assert.equal(corner.sparkHits, 0); // Four pixels beyond both edges is outside a radius-four circle.
});

test('sparks leave bounds, expire, and are consumed even during contact grace', () => {
  const s = quiet(); s.invulnerable = 1;
  s.sparks = [{ id: 1, x: 150, y: 506, vx: 165, remaining: 4 },
    { id: 2, x: 483, y: 100, vx: 165, remaining: 4 },
    { id: 3, x: 0, y: 100, vx: -165, remaining: .01 }];
  stepSpaceLifeSupport(s, config, idle, .05);
  assert.equal(s.sparks.length, 0); assert.equal(s.integrity, 5); assert.equal(s.sparkHits, 0);
});

test('fire, spark and overload share grace in that order; expiry remains independent', () => {
  const s = quiet();
  s.fires = [{ id: 1, x: 150, y: 520, kind: 'ordinary', remaining: 100 }];
  s.sparks = [{ id: 2, x: 150, y: 506, vx: 0, remaining: 4 }];
  s.icons = [{ id: 3, x: 150, y: 501, kind: 'overload', remaining: 4 }];
  stepSpaceLifeSupport(s, config, idle, .05);
  assert.equal(s.integrity, 4); assert.equal(s.fireContactHits, 1);
  assert.equal(s.sparkHits, 0); assert.equal(s.overloadHits, 0);
  advance(s, 1); assert.equal(s.integrity, 4);
  advance(s, .3); assert.equal(s.integrity, 3); assert.equal(s.fireContactHits, 2);
  s.fires.push({ id: 4, x: 395, y: 520, kind: 'ordinary', remaining: .01 });
  stepSpaceLifeSupport(s, config, idle, .05);
  assert.equal(s.integrity, 2); assert.equal(s.firesExpired, 1);
});

test('every fatal contact ends before a heart can revive the crew', () => {
  for (const kind of ['fire', 'spark', 'overload']) {
    const s = quiet(); s.integrity = 1;
    if (kind === 'fire') s.fires = [{ id: 1, x: 150, y: 520, kind: 'ordinary', remaining: 10 }];
    if (kind === 'spark') s.sparks = [{ id: 1, x: 150, y: 506, vx: 0, remaining: 4 }];
    if (kind === 'overload') s.icons.push({ id: 1, x: 150, y: 501, kind: 'overload', remaining: 4 });
    s.icons.push({ id: 2, x: 150, y: 501, kind: 'heart', remaining: 4 });
    stepSpaceLifeSupport(s, config, idle, .05);
    assert.equal(s.integrity, 0); assert.equal(s.finished, true); assert.equal(s.heartsCollected, 0);
    const before = JSON.stringify(s); stepSpaceLifeSupport(s, config, idle, .05);
    assert.equal(JSON.stringify(s), before);
  }
});

test('zero time freezes hazards; fresh retry state and reports include contact counters', () => {
  const s = quiet(); panel(s, .3);
  s.sparks = [{ id: 1, x: 100, y: 506, vx: 165, remaining: 4 }];
  const before = JSON.stringify(s); stepSpaceLifeSupport(s, config, idle, 0);
  assert.equal(JSON.stringify(s), before);
  const fresh = createSpaceLifeSupport();
  assert.equal(fresh.sparks.length, 0); assert.equal(fresh.sparkHits, 0); assert.equal(fresh.fireContactHits, 0);
  s.sparkHits = 2; s.fireContactHits = 3;
  assert.match(spaceLifeResultText(config, s), /Spark hits: 2 • Fire contact hits: 3/);
});


test('expired sparks cannot hit crew that moves into their old position later in the step', () => {
  const s = quiet();
  s.sparks = [{ id: 1, x: 172, y: 506, vx: 0, remaining: .001 }];
  stepSpaceLifeSupport(s, config, { ...idle, x: 1 }, .05);
  assert.equal(s.sparkHits, 0); assert.equal(s.sparks.length, 0);
  s.sparks = [{ id: 2, x: 250, y: 100, vx: 0, remaining: 4 }];
  advance(s, 4.01); assert.equal(s.sparks.length, 0);
});

test('Natural 1 keeps panel cadence unchanged and successive bursts follow the band interval', () => {
  for (const total of [16, 11, 6, 2]) for (const naturalOne of [false, true]) {
    const s = quiet(); panel(s); s.x = 450; s.y = 190; s.grounded = true;
    const band = total === 16 ? 'Very Easy' : total === 11 ? 'Easy' : total === 6 ? 'Medium' : 'Hard';
    const interval = SPACE_LIFE_TUNING[band].sparkEvery;
    for (let i = 0; i < Math.round((1 + interval) * 100); i++)
      stepSpaceLifeSupport(s, { total, naturalOne }, idle, .01);
    assert.equal(s.nextId, 25); // Two bursts, two sparks each.
    assert.ok(Math.abs(s.fires[0].sparkIn! - interval) < 1e-8);
  }
});

test('automatic repair retains progress through leaving, jumping, pause, and completes once', () => {
  const s = quiet(); s.x = 85; panel(s,100);
  advance(s,.6); const progress = s.fires[0].repairProgress!;
  assert.ok(Math.abs(progress - .6) < 1e-9); assert.equal(s.electricalRepaired,0);
  s.x = 121; advance(s,.2); assert.equal(s.fires[0].repairProgress,progress);
  s.x = 85; stepSpaceLifeSupport(s,config,{x:0,jump:true},.05);
  assert.equal(s.fires[0].repairProgress,progress);
  s.y=520; s.vy=0; s.grounded=true;
  const snapshot=JSON.stringify(s); stepSpaceLifeSupport(s,config,idle,0); assert.equal(JSON.stringify(s),snapshot);
  advance(s,.89); assert.equal(s.electricalRepaired,0);
  advance(s,.01); assert.equal(s.electricalRepaired,1); assert.equal(s.fires.length,0);
  assert.equal(s.repairFlashes.length,1); advance(s,.5);
  assert.equal(s.electricalRepaired,1); assert.equal(s.repairFlashes.length,0);
  assert.deepEqual(createSpaceLifeSupport().repairFlashes,[]);
});
test('repair selects nearest same-platform panel, then lowest ID on ties, and only one at a time', () => {
  const s=quiet(); s.x=150;
  s.fires=[{id:4,x:130,y:520,kind:'electrical',remaining:100,sparkIn:100},
    {id:2,x:170,y:520,kind:'electrical',remaining:100,sparkIn:100},
    {id:1,x:150,y:410,kind:'electrical',remaining:100,sparkIn:100}];
  advance(s,.1); assert.equal(s.fires[0].repairProgress,undefined);
  assert.ok(Math.abs(s.fires[1].repairProgress!-.1)<1e-9); assert.equal(s.fires[2].repairProgress,undefined);
  s.x=130; advance(s,.1); assert.ok(Math.abs(s.fires[0].repairProgress!-.1)<1e-9);
  assert.ok(Math.abs(s.fires[1].repairProgress!-.1)<1e-9);
});
test('repair range is inclusive, expiry can defeat partial repair, and exact deadline completion wins', () => {
  for (const total of [5,6,11,16]) for (const naturalOne of [false,true]) {
    const cfg={total,naturalOne}; const s=quiet(); panel(s,100); s.x=120;
    stepSpaceLifeSupport(s,cfg,idle,.05); assert.equal(s.fires[0].repairProgress,.05);
    s.x=120.01; stepSpaceLifeSupport(s,cfg,idle,.05); assert.equal(s.fires[0].repairProgress,.05);
    s.x=85; s.fires[0].remaining=.01; s.fires[0].repairProgress=1.48;
    stepSpaceLifeSupport(s,cfg,idle,.05); assert.equal(s.electricalRepaired,0); assert.equal(s.firesExpired,1); assert.equal(s.integrity,4);
    panel(s,100); s.fires[0].remaining=.02; s.fires[0].repairProgress=1.48;
    stepSpaceLifeSupport(s,cfg,idle,.05); assert.equal(s.electricalRepaired,1); assert.equal(s.firesExpired,1);
  }
});
