import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpaceBattleBomber, stepSpaceBattleBomber, automaticShipX, mineDropPosition,
  spaceBomberBlastRadius, SPACE_BATTLE_BOMBER_TUNING, difficultyFor, HEIGHT,
  type SpaceBattleBomberState } from '../src/game/rules.ts';
const idle = { placing: false };
function quiet() { const s = createSpaceBattleBomber(); s.pursuerSpawnIn = 100; return s; }
function advance(s: SpaceBattleBomberState, seconds: number, config = {total:10,naturalOne:false}) {
  for (let i = 0; i < Math.round(seconds / .01); i++) stepSpaceBattleBomber(s, config, idle, .01);
}
for (const total of [5,6,11,16]) for (const naturalOne of [false,true]) {
  const config = {total,naturalOne};
  test(`committed intercept and warnings, total ${total}, Natural 1 ${naturalOne}`, () => {
    const s = quiet(); s.elapsed = 1; s.pursuerSpawnIn = .025;
    const speed = SPACE_BATTLE_BOMBER_TUNING[difficultyFor(total)].enemySpeed;
    stepSpaceBattleBomber(s, config, idle, .05, () => .5);
    assert.equal(s.enemies.length, 1);
    const enemy = s.enemies[0];
    const mineApproach = (HEIGHT + 20 - mineDropPosition(s).y) / speed;
    assert.ok(mineApproach > 2, 'even Hard gives over two seconds from spawn to the mine row');
    assert.ok(mineDropPosition(s).y < HEIGHT / 3, 'mine row leaves the lower two thirds for approach');
    const arrival = 1.025 + (HEIGHT + 20 - s.y) / speed;
    assert.ok(Math.abs(enemy.x - automaticShipX(arrival)) < 1e-9);
    assert.ok(Math.abs(enemy.y - (HEIGHT + 20 - speed * .025)) < 1e-9);
    assert.ok(Math.abs(enemy.warningRemaining - .775) < 1e-9);
    const x = enemy.x, y = enemy.y;
    s.pursuerSpawnIn = 100;
    advance(s, .8, config);
    assert.equal(enemy.x, x); assert.ok(Math.abs(enemy.y - (y - speed * .8)) < 1e-8);
    assert.equal(enemy.warningRemaining, 0);
    assert.equal(s.x, automaticShipX(s.elapsed));
    assert.ok(!('missiles' in s) && !('aimX' in s) && !('forwardSpawnIn' in s));
  });
  test(`mine cooldown, fuse, expiry and blast area, total ${total}, Natural 1 ${naturalOne}`, () => {
    const s = quiet(); stepSpaceBattleBomber(s, config, {placing:true}, .01);
    const drop = mineDropPosition(s), mine = s.mines[0];
    assert.equal(mine.x, drop.x); assert.equal(mine.y, drop.y);
    assert.equal(mine.blastRadius, spaceBomberBlastRadius(config));
    assert.ok(Math.abs(mine.blastRadius ** 2 / 58 ** 2 - (naturalOne ? .5 : 1)) < 1e-9);
    stepSpaceBattleBomber(s, config, {placing:true}, .01); // Rejected, not banked.
    advance(s, 1, config); assert.equal(s.minesPlaced, 1);
    assert.equal(mine.x, drop.x); assert.equal(mine.y, drop.y);
    stepSpaceBattleBomber(s, config, {placing:true}, .01); assert.equal(s.minesPlaced, 2);
    advance(s, 4.6, config); assert.equal(s.mines.length, 0);
    const fuse = quiet(); stepSpaceBattleBomber(fuse, config, {placing:true}, .01);
    const m = fuse.mines[0];
    fuse.enemies = [{id:90,x:m.x,y:m.y,radius:16,speed:0,warningRemaining:0},
      {id:91,x:m.x+m.blastRadius-1,y:m.y,radius:16,speed:0,warningRemaining:0},
      {id:92,x:m.x+m.blastRadius+1,y:m.y,radius:16,speed:0,warningRemaining:0}];
    advance(fuse, .1, config); assert.equal(fuse.destroyed, 0);
    advance(fuse, .11, config); assert.equal(fuse.destroyed, 2);
    assert.equal(fuse.mines.length, 0); assert.equal(fuse.explosions[0].radius,m.blastRadius);
    assert.deepEqual(fuse.enemies.map(e=>e.id),[92]);
  });
  test(`collision grace, safe escapes, finish and reset, total ${total}, Natural 1 ${naturalOne}`, () => {
    const s = quiet();
    const hit = () => {
      const x = automaticShipX(s.elapsed + .01);
      s.enemies = [1,2].map(id=>({id,x,y:s.y,radius:16,speed:0,warningRemaining:0}));
      stepSpaceBattleBomber(s,config,idle,.01);
    };
    hit(); assert.equal(s.hull,2); assert.equal(s.hits,1); assert.equal(s.enemies.length,0);
    hit(); assert.equal(s.hull,2); advance(s,1.26,config); hit(); assert.equal(s.hull,1);
    s.enemies = [{id:3,x:20,y:-37,radius:16,speed:0,warningRemaining:0}];
    stepSpaceBattleBomber(s,config,idle,.01); assert.equal(s.hull,1); assert.equal(s.destroyed,0); assert.equal(s.enemies.length,0);
    const paused=JSON.stringify(s); stepSpaceBattleBomber(s,config,{placing:true},0); assert.equal(JSON.stringify(s),paused);
    advance(s,1.26,config); hit(); assert.equal(s.finished,true); assert.equal(s.hull,0);
    const finished=JSON.stringify(s); stepSpaceBattleBomber(s,config,{placing:true},.05); assert.equal(JSON.stringify(s),finished);
    const completed=quiet(); completed.elapsed=59.99; stepSpaceBattleBomber(completed,config,idle,.05);
    assert.equal(completed.elapsed,60); assert.equal(completed.finished,true);
    const fresh=createSpaceBattleBomber(); assert.equal(fresh.minesPlaced,0); assert.equal(fresh.enemies.length,0); assert.equal(fresh.hull,3);
  });
}
