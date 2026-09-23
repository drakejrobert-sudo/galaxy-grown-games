/** Repeatable, deliberately synthetic score samples. Run: node --import tsx scripts/calibrate-scores.ts */
import {
  DURATION, HEIGHT, WIDTH, createFlight, stepFlight, scoreFor,
  createGunner, stepGunner, gunnerScoreFor,
  createBomber, stepBomber, bomberScoreFor,
  createLifeSupport, stepLifeSupport, lifeSupportScoreFor,
  createSpaceBattlePilot, stepSpaceBattlePilot, spaceBattlePilotScoreFor,
  createSpaceBattleBomber, stepSpaceBattleBomber, spaceBattleBomberScoreFor,
  type FlightConfig, type ScoreMode, type LifeSupportRoute,
} from '../src/game/rules.ts';

type Profile = 'passive' | 'routine' | 'engaged';
const modes: ScoreMode[] = ['asteroid-pilot', 'asteroid-gunner', 'asteroid-bomber',
  'asteroid-life-support', 'space-pilot', 'space-bomber'];
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
      { x: 0, y: 0, placing: profile === 'engaged' || (profile === 'routine' && Math.floor(s.elapsed * 2) % 2 === 0) },
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
  const s = createSpaceBattleBomber();
  while (!s.finished) {
    const target = profile === 'engaged'
      ? [...s.enemies].filter(e => e.y < s.y).sort((a, b) => b.y - a.y)[0] : undefined;
    stepSpaceBattleBomber(s, config, {
      x: 0, y: 0, aimX: target?.x ?? s.x, aimY: target?.y ?? 50,
      firing: profile === 'engaged', placing: profile !== 'passive',
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
