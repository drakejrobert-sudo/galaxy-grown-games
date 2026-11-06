import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoarding, stepBoarding, boardingResultText, boardingScoreFor, boardingInAirlock,
  BOARDING_TUNING, BOARDING_AIM_SPEED, BOARDING_BLAST_RADIUS, BOARDING_VENT_RECHARGE,
  BOARDING_LINE, type BoardingInput, type BoardingState, type BoardingBoarder,
} from '../src/game/rules.ts';
const config = { total: 10, naturalOne: false };
const idle: BoardingInput = { x: 0, y: 0, firing: false };
function state(role: BoardingState['role']) { const s=createBoarding(role);s.spawnIn=100;return s; }
function tick(s: BoardingState, input: Partial<BoardingInput> = {}, dt=.05, cfg=config) { stepBoarding(s,cfg,{...idle,...input},dt,()=>.5); }
function run(s: BoardingState, seconds: number, input: Partial<BoardingInput> = {}, cfg=config) {
  for(let t=0;t<seconds-1e-8;t+=.05)tick(s,input,Math.min(.05,seconds-t),cfg);
}
function pod(id=1,x=240,y=300,vy=-100) {return {id,x,y,vx:0,vy,radius:12};}
function boarder(id=1,phase:BoardingBoarder['phase']='exposed',remaining=1,x=145,y=180):BoardingBoarder {
  return {id,phase,remaining,x,y,slot:0};
}
test('carrier locks warning target, closes into aft-mine reach, then withdraws without homing',()=>{
  const s=state('Pilot'); tick(s);const target=s.carrier.targetX;
  run(s,1,{x:1});assert.equal(s.carrier.targetX,target);assert.equal(s.carrier.y,500);
  run(s,3);assert.ok(s.carrier.y<=251);assert.equal(s.carrier.targetX,target);
  run(s,5);assert.ok(s.carrier.y>=499);
});
test('pods launch fixed vectors and clean Pilot misses retire without breaches',()=>{
  const s=state('Pilot');s.spawnIn=0;tick(s);const p=s.pods[0];assert.ok(p.vy<0);
  const velocity=[p.vx,p.vy];tick(s,{x:1});assert.deepEqual([p.vx,p.vy],velocity);
  s.pods=[pod(99,20,-39,-100)];tick(s);assert.equal(s.pods.length,0);assert.equal(s.hull,3);assert.equal(s.breaches,0);
});
test('Pilot keyboard and pointer direction share diagonal normalization and 60% Natural 1 in all bands',()=>{
  for(const total of [5,10,15,16]) for(const naturalOne of [false,true]) {
    const s=state('Pilot');tick(s,{x:1,y:-1},.05,{total,naturalOne});
    const speed=BOARDING_TUNING[total<=5?'Hard':total<=10?'Medium':total<=15?'Easy':'Very Easy'].moveSpeed;
    assert.ok(Math.abs(Math.hypot(s.x-240,s.y-140)-speed*.05*(naturalOne?.6:1))<1e-8);
  }
});
test('swept Pilot contact removes pods, applies one damage and protects simultaneous contacts',()=>{
  const s=state('Pilot');s.pods=[pod(1,240,175,-1500),pod(2,240,175,-1500)];tick(s);
  assert.equal(s.hull,2);assert.equal(s.hits,1);assert.equal(s.pods.length,0);assert.ok(s.grace>1.2);
  s.pods=[pod(3,s.x,s.y,0)];tick(s);assert.equal(s.hull,2);assert.equal(s.pods.length,0);
});
test('Gunner chooses one closest target, pod before carrier on a tie; miss consumes cooldown',()=>{
  const s=state('Gunner');s.pods=[pod(1,240,500,0)];tick(s,{aimX:240,aimY:500,firing:true});
  assert.equal(s.intercepted,1);assert.equal(s.carrierDamage,0);assert.equal(s.shots,1);
  const miss=state('Gunner');tick(miss,{aimX:20,aimY:20,firing:true});assert.ok(miss.cooldown>0);assert.equal(miss.carrierDamage,0);
});
test('carrier disable stops launches, retains existing pods, scores once, and does not end the round',()=>{
  const s=state('Gunner');s.carrier.hp=1;s.spawnIn=0;s.pods=[pod(9,40,400)];
  tick(s,{aimX:240,aimY:500,firing:true});assert.equal(s.disabled,true);assert.equal(s.carrierDamage,1);
  assert.equal(s.pods.length,1);assert.equal(s.finished,false);const score=boardingScoreFor(s);
  s.cooldown=0;tick(s,{aimX:240,aimY:500,firing:true});assert.equal(s.carrierDamage,1);
  assert.ok(boardingScoreFor(s)-score<10);
});
test('Gunner Natural 1 doubles only cooldown; aim clamps and keyboard diagonals use approved cap',()=>{
  for(const total of [5,10,15,16]) {
    const normal=state('Gunner'), impaired=state('Gunner');
    tick(normal,{x:1,y:1,firing:true},.05,{total,naturalOne:false});tick(impaired,{x:1,y:1,firing:true},.05,{total,naturalOne:true});
    assert.equal(impaired.cooldown,2*normal.cooldown);assert.equal(impaired.crosshairX,normal.crosshairX);
    assert.ok(Math.abs(Math.hypot(normal.crosshairX-240,normal.crosshairY-300)-BOARDING_AIM_SPEED*.05)<1e-8);
    normal.cooldown=0;tick(normal,{aimX:999,aimY:999});assert.deepEqual([normal.crosshairX,normal.crosshairY],[468,542]);
  }
});
test('weapon breaches remove every crossing pod, but grace limits simultaneous damage',()=>{
  for(const role of ['Gunner','Bomber'] as const){
    const s=state(role);s.pods=[pod(1,20,BOARDING_LINE+13),pod(2,460,BOARDING_LINE+13)];tick(s);
    assert.equal(s.pods.length,0);assert.equal(s.breaches,2);assert.equal(s.hull,2);assert.equal(s.intercepted,0);
  }
});
test('Bomber mines retain fixed landing positions and input attempts during cooldown never bank',()=>{
  const s=state('Bomber');tick(s,{placing:true});assert.equal(s.minesPlaced,1);
  run(s,.3);const point={x:s.mines[0].x,y:s.mines[0].y};run(s,.1,{placing:true});assert.equal(s.minesPlaced,1);
  run(s,.6);assert.equal(s.minesPlaced,1);assert.deepEqual({x:s.mines[0].x,y:s.mines[0].y},point);
});
test('aft launcher rejects forward releases, supports immediate rack arming, and expires mines',()=>{
  const s=state('Bomber');tick(s,{placing:true,launch:{x:240,y:100}});assert.equal(s.mines.length,0);
  tick(s,{placing:true,launch:{x:s.x,y:s.y+34}});assert.equal(s.mines[0].flight,undefined);assert.equal(s.mines[0].armIn,0);
  run(s,4.5);assert.equal(s.mines.length,0);
});
test('Bomber Natural 1 halves blast area in every band without changing cooldown',()=>{
  for(const total of [5,10,15,16])for(const naturalOne of [false,true]) {
    const s=state('Bomber');tick(s,{placing:true},.05,{total,naturalOne});
    assert.ok(Math.abs(s.mines[0].blastRadius**2-BOARDING_BLAST_RADIUS**2*(naturalOne?.5:1))<1e-8);
    assert.equal(s.cooldown,.85);
  }
});
test('moving mine contacts are swept and intercept before a later boarding breach',()=>{
  const s=state('Bomber');s.pods=[pod(1,240,235,-1800)];tick(s,{placing:true});
  assert.equal(s.intercepted,1);assert.equal(s.hull,3);assert.equal(s.mines.length,0);assert.equal(s.breaches,0);
  assert.ok(s.explosions[0].y>174&&s.explosions[0].y<199);
});
test('earlier breach cannot later trigger a mine or earn interception points',()=>{
  const s=state('Bomber');s.pods=[pod(1,240,175,-1000)];
  s.mines=[{id:4,x:240,y:100,armIn:0,expiresIn:4,blastRadius:58}];tick(s);
  assert.equal(s.breaches,1);assert.equal(s.hull,2);assert.equal(s.intercepted,0);assert.equal(s.mines.length,1);
});
test('carrier can be mined during its close approach; each blast damages it once',()=>{
  const s=state('Bomber');s.elapsed=4;s.carrier={...s.carrier,x:240,targetX:240,y:250,cycle:0};
  s.mines=[{id:4,x:240,y:250,armIn:0,expiresIn:4,blastRadius:58}];tick(s);
  assert.equal(s.carrierDamage,1);assert.equal(s.carrier.hp,4);assert.equal(s.mines.length,0);
  tick(s);assert.equal(s.carrierDamage,1);
});
test('two mines cannot score the same pod twice; explosion destroys nearby pods exactly once',()=>{
  const s=state('Bomber');s.pods=[pod(1,240,300,0),pod(2,260,300,0)];
  s.mines=[3,4].map(id=>({id,x:240,y:300,armIn:0,expiresIn:4,blastRadius:58}));tick(s);
  assert.equal(s.intercepted,2);assert.equal(s.mines.length,1);assert.equal(s.explosions.length,1);
});
test('interior warning, exposure, attack and relocation cycle; covered targets cannot be shot',()=>{
  const s=state('Life Support');s.boarders=[boarder(1,'warning',.05)];tick(s,{aimX:145,aimY:180,firing:true});
  assert.equal(s.shotBoarders,0);assert.equal(s.boarders[0].phase,'exposed');
  s.cooldown=0;tick(s,{aimX:145,aimY:180,firing:true});assert.equal(s.shotBoarders,1);assert.equal(s.boarders.length,0);
  run(s,2);assert.equal(s.hull,5);
});
test('uninterrupted boarder attacks cost integrity once, with shared grace',()=>{
  const s=state('Life Support');s.boarders=[boarder(1,'exposed',.02),{...boarder(2,'exposed',.02,335),slot:1}];tick(s);
  assert.equal(s.hull,4);assert.equal(s.hits,1);assert.ok(s.boarders.every(b=>b.phase==='relocating'));
  run(s,.8);assert.ok(s.boarders.some(b=>boardingInAirlock(b,0)));assert.ok(s.boarders.some(b=>boardingInAirlock(b,1)));
  run(s,.8);assert.ok(s.boarders.every(b=>b.phase==='warning'));
});
test('airlocks eject covered enemies at warning expiry before a tied attack; no later double award',()=>{
  const s=state('Life Support');s.boarders=[boarder(1,'exposed',.03,70),{...boarder(2,'warning',1,70,350),slot:2}];
  s.airlocks[0].warning=.03;s.airlocks[0].cooldown=7;tick(s);
  assert.equal(s.hull,5);assert.equal(s.ejected,2);assert.equal(s.boarders.length,0);
  tick(s,{aimX:70,aimY:180,firing:true});assert.equal(s.shotBoarders,0);assert.equal(s.ejected,2);
});
test('airlock zone is evaluated at ejection, including relocation during the warning',()=>{
  const s=state('Life Support');s.boarders=[boarder(1,'relocating',1.4)];
  tick(s,{ventLeft:true});run(s,.55);assert.equal(s.ejected,1);
});
test('empty vent consumes charge; unavailable request is discarded and left/right recharge independently',()=>{
  const s=state('Life Support');tick(s,{ventLeft:true});assert.equal(s.airlocks[0].cooldown,BOARDING_VENT_RECHARGE);
  assert.equal(s.airlocks[1].cooldown,0);run(s,.6);assert.equal(s.ejected,0);
  tick(s,{ventLeft:true,ventRight:true});assert.equal(s.airlocks[0].warning,null);assert.notEqual(s.airlocks[1].warning,null);
  run(s,8);assert.equal(s.airlocks[0].warning,null);assert.equal(s.airlocks[0].cooldown,0);
  s.airlocks[0].cooldown=.01;tick(s,{ventLeft:true});assert.equal(s.airlocks[0].warning,null);tick(s);assert.equal(s.airlocks[0].warning,null);
});
test('Life Support Natural 1 doubles airlock recharge only in every band',()=>{
  for(const total of [5,10,15,16]) {
    const a=state('Life Support'),b=state('Life Support');
    tick(a,{ventLeft:true,firing:true},.05,{total,naturalOne:false});tick(b,{ventLeft:true,firing:true},.05,{total,naturalOne:true});
    assert.equal(b.airlocks[0].cooldown,2*a.airlocks[0].cooldown);assert.equal(b.cooldown,a.cooldown);
  }
});
test('rifle and independent airlock can act simultaneously',()=>{
  const s=state('Life Support');s.boarders=[boarder()];tick(s,{aimX:145,aimY:180,firing:true,ventRight:true});
  assert.equal(s.shotBoarders,1);assert.notEqual(s.airlocks[1].warning,null);
});
test('health failure wins a time tie; all four terminal states are immutable and reports contain GM context',()=>{
  for(const role of ['Pilot','Gunner','Bomber','Life Support'] as const) {
    const s=state(role);s.elapsed=59.99;s.hull=1;
    if(role==='Life Support')s.boarders=[boarder(1,'exposed',.005)];else s.pods=[pod(1,240,role==='Pilot'?140:172,-100)];
    tick(s);assert.equal(s.finished,true);assert.equal(s.endReason,'hull');
    const before=structuredClone(s);tick(s,{firing:true,placing:true,ventLeft:true});assert.deepEqual(s,before);
    const report=boardingResultText({total:-2,naturalOne:true},s);
    for(const text of ['Boarding Party',role,'Check total: -2','Natural 1: Yes','Rating:','GM determines campaign outcome.'])assert.ok(report.includes(text));
  }
});
test('a disabled carrier allows timed completion without prematurely discarding surviving pods',()=>{
  const s=state('Gunner');s.carrier.hp=0;s.disabled=true;s.elapsed=59.98;s.pods=[pod(1,20,450)];tick(s);
  assert.equal(s.elapsed,60);assert.equal(s.finished,true);assert.equal(s.endReason,'time');assert.equal(s.pods.length,1);
});

test('Pilot pod launch leads current movement, then commits without homing',()=>{
  const s=state('Pilot');s.spawnIn=0;tick(s,{x:1});const p=s.pods[0];
  const flight=(s.y-p.y)/p.vy,aimedX=p.x+p.vx*flight;
  assert.ok(aimedX>s.x+100);const v={x:p.vx,y:p.vy};tick(s,{x:-1});assert.deepEqual({x:p.vx,y:p.vy},v);
});
test('interior failure prevents a later same-step ejection from awarding points',()=>{
  const s=state('Life Support');s.hull=1;s.boarders=[boarder(1,'exposed',.01),{...boarder(2,'warning',1,70,350),slot:2}];
  s.airlocks[0].warning=.04;tick(s);assert.equal(s.finished,true);assert.equal(s.ejected,0);
});

test('mine defense wins an exact boarding-line contact tie',()=>{
  const s=state('Bomber');s.pods=[pod(1,240,BOARDING_LINE+12,-100)];
  s.mines=[{id:4,x:240,y:BOARDING_LINE+12,armIn:0,expiresIn:4,blastRadius:58}];tick(s);
  assert.equal(s.hull,3);assert.equal(s.breaches,0);assert.equal(s.intercepted,1);
});
