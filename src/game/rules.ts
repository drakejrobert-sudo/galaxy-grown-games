export type Difficulty = 'Hard' | 'Medium' | 'Easy' | 'Very Easy';
export interface FlightConfig { total: number; naturalOne: boolean }
export const WIDTH = 480;
export const HEIGHT = 560;
export const DURATION = 60;
export const PILOT_RADIUS = 12;
export const SIDE_WARNING_SECONDS = 1.1;
// Initial playtest values, not GM-approved balance.
export const ENGINE_MULTIPLIER = 0.6;
export const TUNING: Record<Difficulty, { speed: number; spawnEvery: number; pilotSpeed: number; sideChance: number; drift: number }> = {
  Hard: { speed: 235, spawnEvery: 0.28, pilotSpeed: 220, sideChance: 0.45, drift: 0.85 },
  Medium: { speed: 190, spawnEvery: 0.40, pilotSpeed: 235, sideChance: 0.32, drift: 0.65 },
  Easy: { speed: 150, spawnEvery: 0.56, pilotSpeed: 250, sideChance: 0.20, drift: 0.45 },
  'Very Easy': { speed: 115, spawnEvery: 0.74, pilotSpeed: 260, sideChance: 0.10, drift: 0.25 },
};
export function parseTotal(value: string): number | null {
  if (!/^[+-]?\d+$/.test(value.trim())) return null;
  const total = Number(value);
  return Number.isSafeInteger(total) ? total : null;
}
export function difficultyFor(total: number): Difficulty {
  if (!Number.isSafeInteger(total)) throw new Error('Enter a whole-number check total.');
  return total <= 5 ? 'Hard' : total <= 10 ? 'Medium' : total <= 15 ? 'Easy' : 'Very Easy';
}
export function flightSpeed(config: FlightConfig): number {
  return TUNING[difficultyFor(config.total)].pilotSpeed * (config.naturalOne ? ENGINE_MULTIPLIER : 1);
}
export interface Asteroid {
  x: number; y: number; radius: number; speed: number; vx?: number;
  rotation?: number; spin?: number; side?: 'left' | 'right';
}
export interface FlightState {
  x: number; y: number; elapsed: number; hull: number; hits: number;
  invulnerable: number; spawnIn: number; asteroids: Asteroid[]; finished: boolean;
}
export function createFlight(): FlightState {
  return { x: WIDTH / 2, y: HEIGHT - 85, elapsed: 0, hull: 3, hits: 0,
    invulnerable: 0, spawnIn: 0.5, asteroids: [], finished: false };
}
export function stepFlight(s: FlightState, config: FlightConfig, input: { x: number; y: number }, dt: number, random: () => number = Math.random): void {
  if (s.finished) return;
  dt = Math.min(Math.max(dt, 0), 0.05, DURATION - s.elapsed);
  const tuning = TUNING[difficultyFor(config.total)];
  s.elapsed += dt;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  const magnitude = Math.max(1, Math.hypot(input.x, input.y));
  s.x = Math.max(18, Math.min(WIDTH - 18, s.x + input.x / magnitude * flightSpeed(config) * dt));
  s.y = Math.max(22, Math.min(HEIGHT - 22, s.y + input.y / magnitude * flightSpeed(config) * dt));
  s.spawnIn -= dt;
  while (s.spawnIn <= 0) {
    const radius = 15 + random() * 16;
    const speed = tuning.speed * (0.8 + random() * 0.4);
    const side = random() < tuning.sideChance;
    const left = random() < 0.5;
    const topX = radius + random() * (WIDTH - radius * 2);
    const y = side ? 35 + random() * (HEIGHT - 150) : -40;
    const vx = side ? (left ? 1 : -1) * speed * 0.85 : (WIDTH / 2 - topX) / (WIDTH / 2) * speed * tuning.drift;
    // Side rocks wait off-screen for a fixed warning window; top rocks fan inward.
    const x = side
      ? (left ? -radius - Math.abs(vx) * SIDE_WARNING_SECONDS : WIDTH + radius + Math.abs(vx) * SIDE_WARNING_SECONDS)
      : topX;
    s.asteroids.push({ x, y, radius, speed: side ? speed * 0.35 : speed, vx,
      rotation: random() * Math.PI * 2, spin: (random() - 0.5) * 1.5,
      side: side ? (left ? 'left' : 'right') : undefined });
    s.spawnIn += tuning.spawnEvery;
  }
  for (const a of s.asteroids) {
    a.y += a.speed * dt;
    a.x += (a.vx ?? 0) * dt;
    a.rotation = (a.rotation ?? 0) + (a.spin ?? 0) * dt;
    if (!s.invulnerable && Math.hypot(a.x - s.x, a.y - s.y) < a.radius + PILOT_RADIUS) {
      s.hits++; s.hull--; s.invulnerable = 1.25;
    }
  }
  s.asteroids = s.asteroids.filter(a => a.y < HEIGHT + 50 && (
    a.side === 'left' ? a.x < WIDTH + a.radius + 20
      : a.side === 'right' ? a.x > -a.radius - 20
        : a.x > -60 && a.x < WIDTH + 60
  ));
  s.finished = s.hull <= 0 || s.elapsed >= DURATION;
}
export function scoreFor(s: FlightState): number {
  return Math.round(s.elapsed * 10) + s.hull * 100;
}
export function resultText(config: FlightConfig, s: FlightState): string {
  return [ 'Galaxy Grown — Asteroid Field / Pilot',
    `Check total: ${config.total} • Difficulty: ${difficultyFor(config.total)}`,
    `Natural 1: ${config.naturalOne ? 'Yes — overloaded engine (60% movement speed)' : 'No'}`,
    `Score: ${scoreFor(s)} • Time: ${s.elapsed.toFixed(1)}s • Hits: ${s.hits} • Hull: ${s.hull}/3`,
    s.hull > 0 ? 'Course complete' : 'Hull depleted',
    'Prototype scoring v0.1 — GM determines campaign outcome.' ].join('\n');
}
