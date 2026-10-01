import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpaceBattleBomber, stepSpaceBattleBomber, automaticShipX, mineDropPosition,
  spaceBomberLanding, spaceBomberBlastRadius, SPACE_BATTLE_BOMBER_TUNING, difficultyFor, HEIGHT,
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
    const drop = mineDropPosition(s), landing = spaceBomberLanding(s), mine = s.mines[0];
    assert.equal(mine.x, drop.x); assert.equal(mine.y, drop.y);
    assert.equal(mine.blastRadius, spaceBomberBlastRadius(config));
    assert.ok(Math.abs(mine.blastRadius ** 2 / 58 ** 2 - (naturalOne ? .5 : 1)) < 1e-9);
    stepSpaceBattleBomber(s, config, {placing:true}, .01); // Rejected, not banked.
    advance(s, 1, config); assert.equal(s.minesPlaced, 1);
    assert.equal(mine.x, landing.x); assert.equal(mine.y, landing.y);
    assert.equal(mine.armIn,0); assert.equal(mine.flight,undefined);
    stepSpaceBattleBomber(s, config, {placing:true}, .01); assert.equal(s.minesPlaced, 2);
    advance(s, 4.6, config); assert.equal(s.mines.length, 0);
    const fuse = quiet(); stepSpaceBattleBomber(fuse, config, {placing:true}, .01);
    const m = fuse.mines[0], target = spaceBomberLanding(fuse);
    fuse.enemies = [{id:90,x:target.x,y:target.y,radius:16,speed:0,warningRemaining:0},
      {id:91,x:target.x+m.blastRadius-1,y:target.y,radius:16,speed:0,warningRemaining:0},
      {id:92,x:target.x+m.blastRadius+1,y:target.y,radius:16,speed:0,warningRemaining:0}];
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

test('aft aim is speed limited, bounded, resettable and rejects forward releases', () => {
  const s=quiet(), config={total:10,naturalOne:false};
  stepSpaceBattleBomber(s,config,{placing:false,turn:100},.05);
  assert.ok(Math.abs(s.aimAngle-Math.PI/2-Math.PI/30)<1e-10);
  for(let i=0;i<50;i++) stepSpaceBattleBomber(s,config,{placing:false,turn:1},.05);
  assert.equal(s.aimAngle,Math.PI);
  for(let i=0;i<50;i++) stepSpaceBattleBomber(s,config,{placing:false,turn:-1},.05);
  assert.equal(s.aimAngle,0);
  stepSpaceBattleBomber(s,config,{placing:false,straight:true},.01);
  assert.equal(s.aimAngle,Math.PI/2);
  stepSpaceBattleBomber(s,config,{placing:true,launch:{x:240,y:100}},.01);
  assert.equal(s.minesPlaced,0);
  for(const angle of [0,.3,Math.PI/2,Math.PI]) {
    const landing=spaceBomberLanding({...s,aimAngle:angle}), rack=mineDropPosition(s);
    assert.ok(Math.abs(Math.hypot(landing.x-rack.x,landing.y-rack.y)-100)<1e-9);
    assert.ok(landing.y>=rack.y);
  }
  const paused=JSON.stringify(s); stepSpaceBattleBomber(s,config,{placing:true,turn:1},0);
  assert.equal(JSON.stringify(s),paused);
  assert.equal(createSpaceBattleBomber().aimAngle,Math.PI/2);
});

for(const total of [5,6,11,16]) for(const naturalOne of [false,true]) {
  const config={total,naturalOne};
  const enemy=(id:number,x:number,y:number,speed=0)=>({id,x,y,radius:16,speed,warningRemaining:0});
  test(`flight landing, expiry and swept armed contacts: ${total}/${naturalOne}`,()=>{
    const s=quiet(); s.aimAngle=.6;
    stepSpaceBattleBomber(s,config,{placing:true},.01);
    const mine=s.mines[0], rack={x:mine.x,y:mine.y}, target=spaceBomberLanding(s);
    // An enemy on the launch path does not detonate an unarmed mine.
    s.enemies=[enemy(100,rack.x,rack.y+10)];
    advance(s,.1,config);
    assert.equal(s.destroyed,0); assert.equal(s.mines.length,1);
    assert.ok(Math.abs(mine.x-(rack.x+target.x)/2)<1e-9);
    assert.ok(Math.abs(mine.y-(rack.y+target.y)/2)<1e-9);
    const paused=JSON.stringify(s); stepSpaceBattleBomber(s,config,idle,0); assert.equal(JSON.stringify(s),paused);
    s.enemies=[]; advance(s,.1,config);
    assert.equal(mine.flight,undefined); assert.ok(mine.armIn<1e-9);
    assert.deepEqual({x:mine.x,y:mine.y},target);
    advance(s,1,config); assert.deepEqual({x:mine.x,y:mine.y},target);
    advance(s,3.31,config); assert.equal(s.mines.length,0);
    const swept=quiet();
    swept.mines=[{id:1,x:240,y:260,blastRadius:spaceBomberBlastRadius(config),armIn:0,expiresIn:1}];
    // Neither endpoint touches the fuse. A swept contact must detonate.
    swept.enemies=[enemy(2,240,300,1600)];
    stepSpaceBattleBomber(swept,config,idle,.05);
    assert.equal(swept.destroyed,1); assert.equal(swept.hull,3);
    assert.equal(swept.mines.length,0);
  });
  test(`arming boundary and expiry window: ${total}/${naturalOne}`,()=>{
    const s=quiet(); stepSpaceBattleBomber(s,config,{placing:true},.01);
    const target=spaceBomberLanding(s);
    s.enemies=[enemy(100,target.x,target.y)];
    for(let i=0;i<3;i++) stepSpaceBattleBomber(s,config,idle,.05);
    assert.equal(s.destroyed,0);
    stepSpaceBattleBomber(s,config,idle,.05); assert.equal(s.destroyed,1);
    const expires=quiet();
    expires.mines=[{id:1,x:240,y:260,blastRadius:spaceBomberBlastRadius(config),armIn:0,expiresIn:.02}];
    expires.enemies=[enemy(2,240,290,1000)]; // Contact at .006, before expiry within this frame.
    stepSpaceBattleBomber(expires,config,idle,.05); assert.equal(expires.destroyed,1);
    const late=quiet();
    late.mines=[{id:1,x:240,y:260,blastRadius:spaceBomberBlastRadius(config),armIn:0,expiresIn:.005}];
    late.enemies=[enemy(2,240,290,1000)];
    stepSpaceBattleBomber(late,config,idle,.05); assert.equal(late.destroyed,0); assert.equal(late.mines.length,0);
  });
  test(`crossing collisions, clean passes and defensive priority: ${total}/${naturalOne}`,()=>{
    const hit=quiet(); hit.enemies=[enemy(10,240,180,1600)];
    stepSpaceBattleBomber(hit,config,idle,.05);
    assert.equal(hit.hits,1,'collision before crossing even though final endpoint is ahead');
    assert.equal(hit.passes.length,0);
    const crossing=quiet(); crossing.enemies=[enemy(10,240,141,1000)];
    stepSpaceBattleBomber(crossing,config,idle,.05); assert.equal(crossing.hits,1);
    const safe=quiet(); safe.enemies=[enemy(10,340,141,100)];
    stepSpaceBattleBomber(safe,config,idle,.05);
    assert.equal(safe.enemies.length,0); assert.equal(safe.passes.length,1);
    assert.ok(Math.abs(safe.passes[0].remaining-.26)<1e-9);
    // Even rendering a retired ship on top of the player/mine cannot revive it.
    safe.passes[0].x=safe.x; safe.passes[0].y=safe.y;
    safe.mines=[{id:1,x:safe.x,y:safe.y,blastRadius:100,armIn:0,expiresIn:1}];
    advance(safe,.3,config); assert.equal(safe.passes.length,0);
    assert.equal(safe.hits,0); assert.equal(safe.destroyed,0); assert.equal(safe.mines.length,1);
    const defended=quiet();
    defended.enemies=[enemy(10,240,145),enemy(11,245,145)];
    defended.mines=[{id:1,x:240,y:145,blastRadius:spaceBomberBlastRadius(config),armIn:0,expiresIn:1}];
    stepSpaceBattleBomber(defended,config,idle,.01);
    assert.equal(defended.destroyed,2); assert.equal(defended.hits,0);
    stepSpaceBattleBomber(defended,config,idle,.01); assert.equal(defended.destroyed,2);
  });
}

test('a mine ignores pre-landing swept contact but catches a contact after landing within the same step',()=>{
  const config={total:10,naturalOne:false};
  for(const after of [false,true]) {
    const s=quiet(); s.mines=[{id:1,x:240,y:250,blastRadius:58,armIn:.03,expiresIn:1,
      flight:{x:240,y:174,targetX:240,targetY:260,remaining:.03}}];
    s.enemies=[{id:2,x:240,y:after?330:290,radius:16,speed:2000,warningRemaining:0}];
    stepSpaceBattleBomber(s,config,idle,.05);
    assert.equal(s.destroyed,after?1:0);
  }
});
