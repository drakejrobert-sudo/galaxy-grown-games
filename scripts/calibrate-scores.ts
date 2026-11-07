/** Repeatable, deliberately synthetic score samples. Run: node --import tsx scripts/calibrate-scores.ts */
import {
  createBoarding, stepBoarding, boardingScoreFor, boardingAirlockTargetActive, BOARDING_AIRLOCK_TARGETS, BOARDING_TUNING, difficultyFor,
  createSpaceGunner, stepSpaceGunner, spaceGunnerScoreFor, SPACE_GUNNER_DEFENSE_LINE,
  DURATION, HEIGHT, WIDTH, createFlight, stepFlight, scoreFor,
  createGunner, stepGunner, gunnerScoreFor,
  createBomber, stepBomber, bomberScoreFor,
  createLifeSupport, stepLifeSupport, lifeSupportScoreFor,
  createSpaceBattlePilot, stepSpaceBattlePilot, spaceBattlePilotScoreFor,
  createSpaceBattleBomber, stepSpaceBattleBomber, spaceBattleBomberScoreFor,
  SPACE_BOMBER_LAUNCH_DISTANCE, mineDropPosition,
  createSpaceLifeSupport, stepSpaceLifeSupport, spaceLifeScoreFor,
  type FlightConfig, type ScoreMode, type LifeSupportRoute,
} from '../src/game/rules.ts';

type Profile = 'passive' | 'routine' | 'engaged';
const modes: ScoreMode[] = ['asteroid-pilot', 'asteroid-gunner', 'asteroid-bomber',
  'asteroid-life-support', 'space-pilot', 'space-bomber', 'space-life-support', 'space-gunner', 'boarding-pilot', 'boarding-gunner', 'boarding-bomber', 'boarding-life-support'];
const totals = [5, 10, 15, 16]; // One representative total for each established difficulty band.
const profiles: Profile[] = ['passive', 'routine', 'engaged'];
const step = 0.05;
const seedsPerCombination = 12;

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}
function direction(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length < 5 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
}
function pilotDirection(s: { x: number; y: number }, hazards: { x: number; y: number }[],
  profile: Profile, elapsed: number) {
  if (profile === 'passive') return { x: 0, y: 0 };
  if (profile === 'routine') return direction(s, { x: WIDTH / 2 + Math.sin(elapsed / 3) * 120, y: HEIGHT - 85 });
  const nearby = hazards.filter(h => Math.abs(h.y - s.y) < 125 && Math.abs(h.x - s.x) < 100)
    .sort((a, b) => Math.abs(a.y - s.y) - Math.abs(b.y - s.y))[0];
  const targetX = nearby ? Math.max(22, Math.min(WIDTH - 22, s.x + (s.x < nearby.x ? -100 : 100))) : WIDTH / 2;
  return direction(s, { x: targetX, y: HEIGHT - 85 });
}
function run(mode: ScoreMode, config: FlightConfig, profile: Profile, seed: number): number {
  const random = seeded(seed);
  if (mode.startsWith('boarding-')) {
    const role = mode === 'boarding-pilot' ? 'Pilot' : mode === 'boarding-gunner' ? 'Gunner' : mode === 'boarding-bomber' ? 'Bomber' : 'Life Support';
    const s = createBoarding(role);
    while (!s.finished) {
      const active = profile !== 'passive';
      const urgent = [...s.pods].sort((a,b)=>a.y-b.y || a.id-b.id)[0];
      const control = role === 'Life Support' && profile === 'engaged' ? BOARDING_AIRLOCK_TARGETS.find((_, side) => boardingAirlockTargetActive(s, side)) : undefined;
      const target = control ?? (role === 'Life Support' ? s.boarders.filter(b=>b.phase==='exposed').sort((a,b)=>a.remaining-b.remaining || a.id-b.id)[0]
        : profile === 'engaged' && urgent && urgent.y < 300 ? urgent : s.carrier.hp > 0 ? s.carrier : urgent);
      const rack = mineDropPosition(s);
      const mineTarget = profile === 'engaged' ? [...s.pods, ...(s.carrier.hp>0?[s.carrier]:[])]
        .filter(p=>p.y>=rack.y && Math.hypot(p.x-rack.x,p.y-rack.y)<=100)
        .sort((a,b)=>a.y-b.y)[0] : undefined;
      // Engaged sweeps at a steady pace; routine's sine path slows near the edges.
      const targetX = profile === 'engaged' ? 40+Math.abs((s.elapsed*190)%800-400)
        : 240+Math.sin(s.elapsed/2)*150;
      let movement = active ? direction(s,{x:targetX,y:110}) : {x:0,y:0};
      if (role === 'Pilot' && profile === 'engaged') {
        const speed = BOARDING_TUNING[difficultyFor(config.total)].moveSpeed * (config.naturalOne ? .6 : 1);
        // Forecast fixed pod paths for one second; choose the least exposed of eight headings or staying still.
        const candidates = [{x:0,y:0}, ...Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)}))];
        const risk = (v: {x:number;y:number}) => {
          let cost = 0;
          for (const t of [.2,.4,.6,.8,1]) {
            const x = Math.max(22,Math.min(458,s.x+v.x*speed*t)), y = Math.max(22,Math.min(538,s.y+v.y*speed*t));
            for (const p of s.pods) cost += Math.exp(-((x-p.x-p.vx*t)**2+(y-p.y-p.vy*t)**2)/(50**2));
            cost += Math.exp(-((x-s.carrier.x)**2+(y-s.carrier.y)**2)/(85**2));
          }
          return cost + .000001*((s.x+v.x*speed-240)**2+(s.y+v.y*speed-120)**2);
        };
        movement = candidates.sort((a,b)=>risk(a)-risk(b))[0];
      }
      stepBoarding(s,config,{
        ...movement, firing:active && !!target && (profile==='engaged'||Math.floor(s.elapsed)%2===0),
        aimX:active?target?.x:undefined, aimY:active?target?.y:undefined,
        placing:active && s.cooldown<=0 && (profile==='routine'||!!mineTarget),
        ...(mineTarget?{launch:{x:mineTarget.x,y:mineTarget.y}}:{}),
      },step,random);
    }
    return boardingScoreFor(s);
  }

  if (mode === 'space-gunner') {
    const s = createSpaceGunner();
    while (!s.finished) {
      const target = profile === 'routine'
        ? [...s.attackers].filter(a => a.y > 168).sort((a, b) => b.y - a.y || a.id - b.id)[0]
        : profile === 'engaged'
          ? [...s.attackers, ...s.projectiles].sort((a, b) =>
            (SPACE_GUNNER_DEFENSE_LINE - a.y - a.radius) / a.speed -
            (SPACE_GUNNER_DEFENSE_LINE - b.y - b.radius) / b.speed || a.id - b.id)[0]
          : undefined;
      stepSpaceGunner(s, config, { x: 0, y: 0, aimX: target?.x, aimY: target?.y, firing: !!target }, step, random);
    }
    return spaceGunnerScoreFor(s);
  }
  if (mode === 'asteroid-pilot') {
    const s = createFlight();
    while (!s.finished) stepFlight(s, config, pilotDirection(s, s.asteroids, profile, s.elapsed), step, random);
    return scoreFor(s);
  }
  if (mode === 'asteroid-gunner') {
    const s = createGunner();
    while (!s.finished) {
      const target = profile === 'engaged'
        ? [...s.asteroids].sort((a, b) => b.y - a.y)[0]
        : profile === 'routine' ? s.asteroids.find(a => a.y > HEIGHT * 0.3) : undefined;
      stepGunner(s, config, { aimX: target?.x, aimY: target?.y, firing: !!target }, step, random);
    }
    return gunnerScoreFor(s);
  }
  if (mode === 'asteroid-bomber') {
    const s = createBomber();
    while (!s.finished) stepBomber(s, config,
      { placing: s.cooldown <= 0 && (profile === 'engaged' || (profile === 'routine' && Math.floor(s.elapsed * 2) % 2 === 0)) },
      step, random);
    return bomberScoreFor(s);
  }
  if (mode === 'asteroid-life-support') {
    const s = createLifeSupport();
    while (!s.finished) {
      const next = [...s.packets].sort((a, b) => b.y - a.y)[0];
      const route: LifeSupportRoute = profile === 'passive' ? 'Shields'
        : profile === 'engaged' ? next?.target ?? 'Shields'
          : next && Math.floor(s.elapsed) % 2 === 0 ? next.target : 'Shields';
      stepLifeSupport(s, config, { route }, step, random);
    }
    return lifeSupportScoreFor(s);
  }
  if (mode === 'space-pilot') {
    const s = createSpaceBattlePilot();
    while (!s.finished) {
      const fuel = [...s.fuelCells].sort((a, b) => b.y - a.y)[0];
      const target = profile === 'engaged' && fuel ? fuel
        : profile === 'routine' ? { x: WIDTH / 2 + Math.sin(s.elapsed / 3) * 120, y: HEIGHT - 85 }
          : s;
      stepSpaceBattlePilot(s, config, direction(s, target), step, random);
    }
    return spaceBattlePilotScoreFor(s);
  }
  if (mode === 'space-life-support') {
    const s = createSpaceLifeSupport();
    while (!s.finished) {
      const fire = profile === 'engaged' ? [...s.fires].sort((a, b) => a.remaining - b.remaining)[0] : undefined;
      const targetX = fire?.x ?? (profile === 'routine' ? WIDTH / 2 + Math.sin(s.elapsed * 1.4) * 155 : s.x);
      const x = profile === 'passive' ? 0 : Math.abs(targetX - s.x) < 12 ? 0 : targetX > s.x ? 1 : -1;
      const jump = profile !== 'passive' && s.grounded &&
        (profile === 'engaged' ? !!fire && (fire.y < s.y || fire.kind === 'ordinary') : Math.floor(s.elapsed * 1.4) % 2 === 0);
      stepSpaceLifeSupport(s, config, { x, jump }, step, random);
    }
    return spaceLifeScoreFor(s);
  }
  const s = createSpaceBattleBomber();
  while (!s.finished) {
    // Routine uses maximum range. Engaged selects the nearest active rear pursuer within range.
    const rack = mineDropPosition(s);
    const distance = (e: {x:number;y:number}) => Math.hypot(e.x-rack.x,e.y-rack.y);
    const target = profile === 'engaged' ? s.enemies.filter(e => e.y >= rack.y && distance(e) <= SPACE_BOMBER_LAUNCH_DISTANCE)
      .sort((a,b) => distance(a)-distance(b) || a.id-b.id)[0] : undefined;
    stepSpaceBattleBomber(s, config, {
      placing: s.mineCooldown <= 0 && (profile === 'routine' || !!target),
      ...(target ? { launch: { x:target.x, y:target.y } } : {}),
    }, step, random);
  }
  return spaceBattleBomberScoreFor(s);
}
function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}
for (const mode of modes) {
  const scores: number[] = [];
  for (const total of totals) for (const naturalOne of [false, true]) for (const profile of profiles)
    for (let seed = 1; seed <= seedsPerCombination; seed++) {
      scores.push(run(mode, { total, naturalOne }, profile, seed * 7919 + total * 101 + (naturalOne ? 1 : 0)));
    }
  scores.sort((a, b) => a - b);
  const low = percentile(scores, 0.1), high = percentile(scores, 0.9);
  if (high <= low) throw new Error(`${mode}: calibration anchors collapsed`);
  process.stdout.write(`${mode}\t${scores.length}\t${scores[0]}\t${low}\t${percentile(scores, 0.5)}\t${high}\t${scores.at(-1)}\n`);
}
