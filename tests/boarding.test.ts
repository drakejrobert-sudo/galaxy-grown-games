import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoarding, stepBoarding, boardingTurretPose, boardingTurretBreachSoon, boardingResultText, boardingScoreFor, boardingVictoryBonus, boardingInAirlock,
  BOARDING_TUNING, BOARDING_AIM_SPEED, BOARDING_BLAST_RADIUS, BOARDING_VENT_RECHARGE, BOARDING_AIRLOCK_TARGETS, BOARDING_EJECTION_TIME, BOARDING_RELOCATION_TIME, boardingAirlockTargetActive,
  BOARDING_LINE, BOARDING_DEPTHS, boardingCover, BOARDING_DEFENSE_TUNING, BOARDING_LAUNCH_WARNING, BOARDING_MIN_FLIGHT, type BoardingInput, type BoardingState, type BoardingBoarder,
} from '../src/game/rules.ts';
import { projectAftPoint } from '../src/game/boarding-aft-view.ts';
const config = { total: 10, naturalOne: false };
const idle: BoardingInput = { x: 0, y: 0, firing: false };
function state(role: BoardingState['role']) { const s=createBoarding(role);s.spawnIn=100;return s; }
function tick(s: BoardingState, input: Partial<BoardingInput> = {}, dt=.05, cfg=config) { stepBoarding(s,cfg,{...idle,...input},dt,()=>.5); }
function run(s: BoardingState, seconds: number, input: Partial<BoardingInput> = {}, cfg=config) {
  for(let t=0;t<seconds-1e-8;t+=.05)tick(s,input,Math.min(.05,seconds-t),cfg);
}
function pod(id=1,x=240,y=300,vy=-100) {return {id,x,y,vx:0,vy,radius:12,kind:'probe' as const,hp:1,maxHp:1,warningRemaining:0,hitFlash:0};}
function aimTurret(target: {x:number;y:number}) {
  const { x, y } = boardingTurretPose(target);
  return { aimX: x, aimY: y };
}
function boarder(id=1,phase:BoardingBoarder['phase']='exposed',remaining=1,x=145,y=180):BoardingBoarder {
  return {id,phase,remaining,x,y,slot:0,depth:0};
}
test('Gunner chooses one closest target, pod before carrier on a tie; miss consumes cooldown',()=>{
  const s=state('Gunner');s.pods=[pod(2,240,500,0),pod(1,240,500,0)];
  tick(s,{...aimTurret(s.carrier),firing:true});
  assert.deepEqual(s.pods.map(p=>p.id),[2]);
  assert.equal(s.intercepted,1);assert.equal(s.carrierDamage,0);assert.equal(s.shots,1);
  const miss=state('Gunner');tick(miss,{aimX:20,aimY:20,firing:true});assert.ok(miss.cooldown>0);assert.equal(miss.carrierDamage,0);
});
test('the final Gunner shot wins before a pod can breach and awards one victory bonus', () => {
  const s = state('Gunner');
  s.elapsed = 12;
  s.carrier.hp = 1;
  s.carrierDamage = 35;
  s.hull = 1;
  s.spawnIn = 0;
  s.pods = [pod(9, 40, BOARDING_LINE + 12)];
  const aim = aimTurret(s.carrier);
  tick(s, { ...aim, firing: true });
  assert.equal(s.carrier.hp, 0);
  assert.equal(s.disabled, true);
  assert.equal(s.carrierDamage, 36);
  assert.equal(s.finished, true);
  assert.equal(s.endReason, 'victory');
  assert.equal(s.elapsed, 12);
  assert.equal(s.hull, 1);
  assert.equal(s.breaches, 0);
  assert.equal(s.pods.length, 1);
  assert.equal(s.launchedCraft, 0);
  assert.equal(boardingVictoryBonus(s), 740);
  assert.equal(boardingScoreFor(s), 1620);
  const report = boardingResultText(config, s);
  assert.match(report, /Victory — carrier destroyed/);
  assert.match(report, /Provisional v0\.9/);
  assert.deepEqual(report.match(/Victory bonus: \+740 points/g), ['Victory bonus: +740 points']);
  const before = structuredClone(s);
  tick(s, { ...aim, firing: true });
  assert.deepEqual(s, before);
});

test('Gunner Natural 1 doubles only cooldown; aim clamps and keyboard diagonals use approved cap',()=>{
  for(const total of [5,10,15,16]) {
    const normal=state('Gunner'), impaired=state('Gunner');
    tick(normal,{x:1,y:1,firing:true},.05,{total,naturalOne:false});tick(impaired,{x:1,y:1,firing:true},.05,{total,naturalOne:true});
    assert.equal(impaired.cooldown,2*normal.cooldown);assert.equal(impaired.crosshairX,normal.crosshairX);
    assert.ok(Math.abs(Math.hypot(normal.crosshairX-240,normal.crosshairY-260)-BOARDING_AIM_SPEED*.05)<1e-8);
    normal.cooldown=0;tick(normal,{aimX:999,aimY:999});assert.deepEqual([normal.crosshairX,normal.crosshairY],[468,542]);
  }
});
test('weapon breaches remove every crossing pod, but grace limits simultaneous damage',()=>{
  for(const role of ['Gunner','Bomber'] as const){
    const s=state(role);s.pods=[pod(1,20,BOARDING_LINE+13),pod(2,460,BOARDING_LINE+13)];tick(s);
    assert.equal(s.pods.length,0);assert.equal(s.breaches,2);assert.equal(s.hull,2);assert.equal(s.intercepted,0);
  }
});
test('the turret breach marker begins a half-second out, and only damaging breaches flash the canopy',()=>{
  const s=state('Gunner');
  const p=pod(1,240,BOARDING_LINE+62.01);
  s.pods=[p];
  assert.equal(boardingTurretBreachSoon(p),false);
  p.y-=.01;
  assert.equal(boardingTurretBreachSoon(p),true);
  p.warningRemaining=.1;
  assert.equal(boardingTurretBreachSoon(p),false);
  p.warningRemaining=0;
  run(s,.45);
  assert.equal(s.impactFlash,0);
  assert.equal(s.hull,3);
  tick(s);
  assert.ok(s.impactFlash>.2);
  assert.equal(s.hull,2);
  run(s,.3);
  assert.equal(s.impactFlash,0);
  s.pods=[pod(2,240,BOARDING_LINE+13)];
  tick(s);
  assert.equal(s.breaches,2);
  assert.equal(s.hull,2);
  assert.equal(s.impactFlash,0);
});
test('Bomber mines rise and sway around their arming point while cooldown attempts never bank',()=>{
  const s=state('Bomber');
  const rack={x:s.x,y:s.y+34}, landing={x:rack.x,y:rack.y+100};
  tick(s,{placing:true});
  run(s,.15);
  const mine=s.mines[0];
  assert.ok(Math.abs(mine.y-landing.y)<1e-9);
  run(s,.4);
  assert.equal(mine.flight,undefined);
  assert.ok(Math.abs(mine.x-landing.x-12)<1e-9);
  assert.ok(Math.abs(mine.y-landing.y-28)<1e-9);
  assert.ok(projectAftPoint(mine,rack).y<projectAftPoint(landing,rack).y);
  run(s,.1,{placing:true});
  run(s,.7);
  assert.equal(s.minesPlaced,1);
  assert.ok(Math.abs(mine.x-landing.x+12)<1e-9);
  assert.ok(Math.abs(mine.y-landing.y-84)<1e-9);
});
test('a drifting mine reaches the carrier beyond its initial arming point',()=>{
  const s=state('Bomber');
  const landingY=s.y+34+100;
  tick(s,{placing:true});
  run(s,.15);
  assert.equal(s.carrierDamage,0);
  assert.ok(s.carrier.y-landingY>100);
  run(s,2.5);
  assert.equal(s.carrierDamage,1);
  assert.equal(s.carrier.hp,4);
  assert.equal(s.hull,3);
  assert.equal(s.mines.length,0);
});
test('the post-arming segment can intercept in the same step as launch travel',()=>{
  const s=state('Bomber');
  s.pods=[pod(1,240,205.5,0)];
  tick(s,{placing:true,launch:{x:240,y:184}});
  assert.equal(s.intercepted,1);
  assert.equal(s.breaches,0);
  assert.equal(s.hull,3);
  assert.ok(s.explosions[0].y>185 && s.explosions[0].y<186);
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
test('uninterrupted attacks emit visible bolts before integrity damage, with shared grace',()=>{
  const s=state('Life Support');s.boarders=[boarder(1,'exposed',.02),{...boarder(2,'exposed',.02,335),slot:1}];tick(s);
  assert.equal(s.hull,5);assert.equal(s.lasers.length,2);assert.ok(s.boarders.every(b=>b.phase==='relocating'));
  run(s,.8);assert.ok(s.boarders.some(b=>boardingInAirlock(b,0)));assert.ok(s.boarders.some(b=>boardingInAirlock(b,1)));
  run(s,.8);assert.ok(s.boarders.every(b=>b.phase==='warning'));assert.equal(s.hull,4);assert.equal(s.hits,1);assert.ok(s.boarders.every(b=>b.depth===1));
});
test('airlocks eject covered enemies at warning expiry before a tied attack; no later double award',()=>{
  const s=state('Life Support');s.boarders=[boarder(1,'exposed',.03,70),{...boarder(2,'warning',1,70,350),slot:2}];
  s.airlocks[0].warning=.03;s.airlocks[0].cooldown=7;tick(s);
  assert.equal(s.hull,5);assert.equal(s.ejected,2);assert.equal(s.boarders.length,0);
  tick(s,{aimX:70,aimY:180,firing:true});assert.equal(s.shotBoarders,0);assert.equal(s.ejected,2);
});
test('airlock zone is evaluated at ejection, including relocation during the warning',()=>{
  const s=state('Life Support');s.boarders=[boarder(1,'relocating',1.4)];
  tick(s,{firing:true,...aimControl(0)});run(s,.55);assert.equal(s.ejected,1);
});
function aimControl(side: number) { const t=BOARDING_AIRLOCK_TARGETS[side];return {aimX:t.x,aimY:t.y}; }
function crossing(side=0,remaining=BOARDING_RELOCATION_TIME) { return {...boarder(50+side,'relocating',remaining),slot:side}; }
test('only lit crossing controls activate; rifle cooldown and both independent recharges apply',()=>{
  const s=state('Life Support');
  tick(s,{firing:true,...aimControl(0)});assert.equal(s.airlocks[0].cooldown,0);assert.equal(s.shots,1);
  s.boarders=[crossing()];tick(s,{firing:true,...aimControl(0)});assert.equal(s.airlocks[0].warning,null,'rifle cooling');
  s.cooldown=0;tick(s,{firing:true,...aimControl(0)});assert.equal(s.airlocks[0].cooldown,8);assert.notEqual(s.airlocks[0].warning,null);
  assert.equal(s.airlocks[1].cooldown,0);assert.equal(s.shotBoarders,0);assert.equal(s.shots,2);
  s.boarders.push(crossing(1));s.cooldown=0;tick(s,{firing:true,...aimControl(1)});assert.equal(s.airlocks[1].cooldown,8);
  run(s,1);assert.equal(s.ejected,2);s.cooldown=0;s.boarders=[crossing()];tick(s,{firing:true,...aimControl(0)});assert.equal(s.airlocks[0].warning,null,'recharge cannot be bypassed');
});
test('targets light on approach and occupancy, extinguish on departure, and never bank an unlit shot',()=>{
  const s=state('Life Support');
  for(const [remaining,active] of [[1.6,true],[1.1,true],[.8,true],[1.6/3,true],[.5,false]] as const) {
    s.boarders=[crossing(0,remaining)];assert.equal(boardingAirlockTargetActive(s,0),active);assert.equal(boardingAirlockTargetActive(s,1),false);
  }
  s.boarders=[boarder()];tick(s,{firing:true,...aimControl(0)});s.boarders=[crossing()];tick(s);assert.equal(s.airlocks[0].warning,null);
  s.cooldown=0;tick(s,{firing:true,aimX:BOARDING_AIRLOCK_TARGETS[0].x+24,aimY:280});assert.equal(s.airlocks[0].warning,null,'miss outside control radius');
});
test('late control shot opens the door but misses a boarder which has left the bay',()=>{
  const s=state('Life Support');s.boarders=[crossing(0,.55)];
  tick(s,{firing:true,...aimControl(0)});run(s,.6);assert.equal(s.ejected,0);assert.ok(s.airlocks[0].openRemaining>0);assert.equal(s.ejections.length,0);
});
test('Life Support Natural 1 doubles control-triggered recharge only in every band',()=>{
  for(const total of [5,10,15,16]) {
    const a=state('Life Support'),b=state('Life Support');a.boarders=[crossing()];b.boarders=[crossing()];
    tick(a,{firing:true,...aimControl(0)},.05,{total,naturalOne:false});tick(b,{firing:true,...aimControl(0)},.05,{total,naturalOne:true});
    assert.equal(b.airlocks[0].cooldown,2*a.airlocks[0].cooldown);assert.equal(b.cooldown,a.cooldown);assert.equal(b.airlocks[0].warning,a.airlocks[0].warning);
  }
});
test('one rifle shot cannot activate a control and kill an overlapping exposed boarder',()=>{
  const s=state('Life Support'),t=BOARDING_AIRLOCK_TARGETS[0];s.boarders=[crossing(),boarder(2,'exposed',1,t.x,t.y)];
  tick(s,{firing:true,...aimControl(0)});assert.equal(s.shotBoarders,0);assert.notEqual(s.airlocks[0].warning,null);assert.equal(s.shots,1);
});
test('ejection awards once and preserves fired lasers; bounded visual effects expire and retry resets',()=>{
  const s=state('Life Support');s.boarders=[crossing()];tick(s,{firing:true,...aimControl(0)});
  s.lasers=[{id:99,x:65,y:280,side:0,duration:.9,remaining:.9}];run(s,.55);
  assert.equal(s.ejected,1);assert.equal(s.ejections.length,1);assert.ok(s.ejections[0].remaining<=BOARDING_EJECTION_TIME);assert.equal(s.lasers.length,1);
  run(s,.5);assert.equal(s.hull,4);assert.equal(s.ejected,1);assert.equal(s.ejections.length,0);assert.equal(s.airlocks[0].openRemaining,0);
  const fresh=createBoarding('Life Support');assert.deepEqual(fresh.ejections,[]);assert.ok(fresh.airlocks.every(l=>l.openRemaining===0&&l.cooldown===0&&l.warning===null));
});
test('health failure wins a time tie; all four terminal states are immutable and reports contain GM context',()=>{
  for(const role of ['Gunner','Bomber','Life Support'] as const) {
    const s=state(role);s.elapsed=59.99;s.hull=1;
    if(role==='Life Support')s.lasers=[{id:9,x:145,y:180,side:0,duration:.9,remaining:.005}];else s.pods=[pod(1,240,172,-100)];
    tick(s);assert.equal(s.finished,true);assert.equal(s.endReason,'hull');
    const before=structuredClone(s);tick(s,{firing:true,placing:true});assert.deepEqual(s,before);
    const report=boardingResultText({total:-2,naturalOne:true},s);
    for(const text of ['Boarding Party',role,'Check total: -2','Natural 1: Yes','Rating:','GM determines campaign outcome.'])assert.ok(report.includes(text));
  }
});
test('Gunner and Bomber survive to the timer with no victory bonus if the carrier is alive', () => {
  for (const role of ['Gunner', 'Bomber'] as const) {
    const s = state(role);
    s.elapsed = 59.98;
    tick(s);
    assert.equal(s.elapsed, 60);
    assert.equal(s.finished, true);
    assert.equal(s.endReason, 'time');
    assert.equal(boardingScoreFor(s), 600);
    assert.equal(boardingVictoryBonus(s), 0);
    assert.match(boardingResultText(config, s), /Defense complete/);
    assert.doesNotMatch(boardingResultText(config, s), /Victory/);
  }
});

function finalBomberMine(armIn: number, elapsed = 4) {
  const s = state('Bomber');
  s.elapsed = elapsed;
  s.hull = 1;
  s.carrierDamage = 4;
  const holding = elapsed < 6;
  const y = holding ? 250 : 500;
  s.carrier = { ...s.carrier, x: 240, startX: 240, targetX: 240, y,
    cycle: Math.floor(elapsed / 12), hp: 1 };
  s.mines = [{ id: 4, x: 240, y, armIn, expiresIn: 4, blastRadius: 58 }];
  return s;
}

test('Bomber wins at mine contact, credits the whole blast, and ignores later events', () => {
  const s = finalBomberMine(.02);
  s.pods = [
    pod(1, 290, 250, 0), // Inside the final blast but outside its contact fuse.
    pod(2, 40, BOARDING_LINE + 15), // Fatal breach at .03.
    pod(3, 380, 300, 0), // Separate mine would intercept at .04.
  ];
  s.mines.push({ id: 5, x: 380, y: 300, armIn: .04, expiresIn: 4, blastRadius: 58 });
  tick(s);
  assert.equal(s.endReason, 'victory');
  assert.equal(s.finished, true);
  assert.equal(s.elapsed, 4.02);
  assert.equal(s.hull, 1);
  assert.equal(s.breaches, 0);
  assert.equal(s.carrierDamage, 5);
  assert.equal(s.intercepted, 1);
  assert.deepEqual(s.pods.map(p => p.id), [2, 3]);
  assert.equal(s.explosions.length, 1);
  assert.equal(boardingVictoryBonus(s), 780);
  assert.equal(boardingScoreFor(s), 1500);
  const before = structuredClone(s);
  tick(s, { placing: true });
  assert.deepEqual(s, before);
});

test('an earlier fatal breach beats Bomber victory, and a tied breach yields to the mine', () => {
  const earlier = finalBomberMine(.02);
  earlier.pods = [pod(1, 40, BOARDING_LINE + 13)];
  tick(earlier);
  assert.equal(earlier.endReason, 'hull');
  assert.equal(earlier.carrier.hp, 1);
  assert.equal(earlier.hull, 0);
  assert.equal(boardingVictoryBonus(earlier), 0);
  const tied = finalBomberMine(0);
  tied.pods = [pod(1, 40, BOARDING_LINE + 12)];
  tick(tied);
  assert.equal(tied.endReason, 'victory');
  assert.equal(tied.elapsed, 4);
  assert.equal(tied.hull, 1);
  assert.equal(tied.breaches, 0);
});

test('a Bomber mine contacting the carrier at the timer boundary wins', () => {
  const elapsed = 59.98;
  const s = finalBomberMine(60 - elapsed, elapsed);
  s.carrier.x = 240 + (360 - 240) * (elapsed - 57) / 3;
  s.mines[0].x = 360;
  tick(s);
  assert.equal(s.elapsed, 60);
  assert.equal(s.endReason, 'victory');
  assert.equal(boardingVictoryBonus(s), 500);
});

test('interior failure prevents a later same-step ejection from awarding points',()=>{
  const s=state('Life Support');s.hull=1;s.boarders=[boarder(1,'exposed',.01),{...boarder(2,'warning',1,70,350),slot:2}];
  s.lasers=[{id:9,x:145,y:180,side:0,duration:.9,remaining:.01}];s.airlocks[0].warning=.04;tick(s);assert.equal(s.finished,true);assert.equal(s.ejected,0);
});

test('mine defense wins an exact boarding-line contact tie',()=>{
  const s=state('Bomber');s.pods=[pod(1,240,BOARDING_LINE+12,-100)];
  s.mines=[{id:4,x:240,y:BOARDING_LINE+12,armIn:0,expiresIn:4,blastRadius:58}];tick(s);
  assert.equal(s.hull,3);assert.equal(s.breaches,0);assert.equal(s.intercepted,1);
});

test('probe/shuttle selection has exact 80/20 boundary and alternating launch ports independent of mine IDs',()=>{
  for(const [random,kind] of [[.799999,'probe'],[.8,'shuttle']] as const) {
    const s=state('Bomber');s.spawnIn=0;stepBoarding(s,config,idle,.05,()=>random);
    assert.equal(s.pods[0].kind,kind);assert.equal(s.pods[0].hp,kind==='probe'?1:2);
    assert.equal(s.pods[0].radius,kind==='probe'?12:18);
    const first=s.pods[0].x-s.carrier.x;s.nextId+=3;s.spawnIn=0;tick(s);
    assert.ok(first<0);assert.ok(s.pods.at(-1)!.x-s.carrier.x>0);
  }
});
test('shuttle is slower, takes two turret hits, and awards one unchanged interception reward',()=>{
  const s=state('Gunner');s.spawnIn=0;stepBoarding(s,config,idle,.05,()=>.9);
  const shuttle=s.pods[0];assert.ok(Math.hypot(shuttle.vx,shuttle.vy)<=BOARDING_DEFENSE_TUNING.Medium.podSpeed*.75+1e-8);
  s.spawnIn=100;tick(s,{firing:true,...aimTurret(shuttle)});assert.equal(shuttle.hp,1);assert.equal(s.intercepted,0);assert.ok(shuttle.hitFlash>0);
  s.cooldown=0;tick(s,{firing:true,...aimTurret(shuttle)});assert.equal(s.pods.length,0);assert.equal(s.intercepted,1);assert.equal(s.shuttlesIntercepted,1);assert.equal(s.probesIntercepted,0);
});
test('a single mine destroys a full-health shuttle and reports each craft type once',()=>{
  const s=state('Bomber');s.pods=[{...pod(1,240,300,0),kind:'shuttle',hp:2,maxHp:2,radius:18},pod(2,250,300,0)];
  s.mines=[{id:4,x:240,y:300,armIn:0,expiresIn:4,blastRadius:58}];tick(s);
  assert.equal(s.pods.length,0);assert.equal(s.intercepted,2);assert.equal(s.shuttlesIntercepted,1);assert.equal(s.probesIntercepted,1);
  assert.match(boardingResultText(config,s),/probes 1, shuttles 1/);
});
test('Gunner/Bomber opening and minimum warning plus flight window hold at closest carrier approach in every band',()=>{
  for(const total of [5,10,15,16])for(const role of ['Gunner','Bomber'] as const)for(const random of [.5,.9]) {
    const cfg={total,naturalOne:false},opening=createBoarding(role);run(opening,1.95,{},cfg);assert.equal(opening.pods.length,0);
    const s=state(role);s.elapsed=4;s.carrier={...s.carrier,x:240,startX:240,targetX:240,y:250,cycle:0};s.spawnIn=0;
    stepBoarding(s,cfg,idle,.05,()=>random);s.spawnIn=100;const p=s.pods[0],spawn=s.elapsed,point={x:p.x,y:p.y};
    assert.equal(p.warningRemaining,BOARDING_LAUNCH_WARNING);assert.ok((p.y-p.radius-BOARDING_LINE)/-p.vy>=BOARDING_MIN_FLIGHT-1e-9);
    run(s,.55,{},cfg);assert.deepEqual({x:p.x,y:p.y},point);
    while(s.pods.some(q=>q.id===p.id)&&s.elapsed-spawn<10)tick(s,{},.05,cfg);
    assert.ok(s.elapsed-spawn>=BOARDING_LAUNCH_WARNING+BOARDING_MIN_FLIGHT-1e-8);assert.equal(s.breaches,1);
  }
});
test('carrier approaches and repositions laterally while preserving its locked target',()=>{
  const s=state('Bomber');tick(s);const target=s.carrier.targetX,from=s.carrier.x;
  run(s,2);assert.notEqual(s.carrier.x,from);assert.equal(s.carrier.targetX,target);assert.ok(s.carrier.y<500);
  run(s,8);const distant=s.carrier.x;run(s,1);assert.equal(s.carrier.y,500);assert.notEqual(s.carrier.x,distant);
});
test('incoming laser remains visible and dangerous after its shooter is killed or ejected',()=>{
  for(const action of ['shoot','eject']) {
    const s=state('Life Support');s.boarders=[boarder(1,'exposed',1,70,180)];s.lasers=[{id:9,x:70,y:180,side:0,duration:.9,remaining:.2}];
    if(action==='shoot')tick(s,{firing:true,aimX:70,aimY:180});else {s.airlocks[0].warning=.01;tick(s);}
    assert.equal(s.boarders.length,0);assert.equal(s.hull,5);assert.equal(s.lasers.length,1);run(s,.2);
    assert.equal(s.hull,4);assert.equal(s.lasers.length,0);assert.ok(s.impactFlash>0);assert.equal(s.impactSide,0);
  }
});
test('interrupted exposed attack emits no laser; surviving boarders advance through all three depths',()=>{
  const killed=state('Life Support');killed.boarders=[boarder(1,'exposed',.01)];tick(killed,{firing:true,aimX:145,aimY:180});run(killed,1);assert.equal(killed.lasers.length,0);assert.equal(killed.hull,5);
  const s=state('Life Support');s.boarders=[{...boarder(1,'exposed',.01),...boardingCover(0,0)}];
  tick(s);assert.equal(s.lasers.length,1);assert.equal(s.hull,5);run(s,1.6);assert.equal(s.boarders[0].depth,1);
  run(s,.65+BOARDING_TUNING.Medium.attackTime+1.6);assert.equal(s.boarders[0].depth,2);
  assert.ok(BOARDING_DEPTHS[2].scale>BOARDING_DEPTHS[0].scale);assert.ok(BOARDING_DEPTHS[2].laserTime<BOARDING_DEPTHS[0].laserTime);
});
test('first-person opening has no boarders for two seconds and never exceeds two active enemies',()=>{
  const s=createBoarding('Life Support');run(s,1.95);assert.equal(s.boarders.length,0);run(s,.1);assert.equal(s.boarders.length,1);
  for(let i=0;i<500&&!s.finished;i++){tick(s);assert.ok(s.boarders.length<=2);}
});

test('warning craft can be destroyed before movement, including a warning expiry inside a swept mine step',()=>{
  for(const warning of [.6,.025]) {
    const s=state('Bomber');s.pods=[{...pod(1,240,230,-500),warningRemaining:warning}];
    s.mines=[{id:4,x:240,y:230,armIn:0,expiresIn:4,blastRadius:58}];tick(s);
    assert.equal(s.pods.length,0);assert.equal(s.intercepted,1);assert.equal(s.breaches,0);assert.equal(s.hull,3);
  }
});

test('Life Support uses one slot per side, caps at two in every band, and reuses freed slots',()=>{
  for(const total of [5,10,15,16])for(const naturalOne of [false,true]) {
    const cfg={total,naturalOne},s=createBoarding('Life Support');
    for(let i=0;i<400;i++) {
      s.hull=5;tick(s,{},.05,cfg);
      assert.ok(s.boarders.length<=2);assert.ok(s.boarders.every(b=>b.slot===0||b.slot===1));
      assert.equal(new Set(s.boarders.map(b=>b.slot)).size,s.boarders.length);
    }
    assert.equal(s.boarders.length,2);
    for(const side of [0,1]) {
      const survivor=s.boarders.find(b=>b.slot!==side)!;
      s.boarders=s.boarders.filter(b=>b.slot!==side);s.spawnIn=0;tick(s,{},.05,cfg);
      assert.equal(s.boarders.length,2);assert.ok(s.boarders.some(b=>b.id===survivor.id));
      const replacement=s.boarders.find(b=>b.slot===side)!;assert.equal(replacement.depth,0);assert.equal(replacement.phase,'warning');
    }
  }
});
