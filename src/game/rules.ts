export type Difficulty = 'Hard' | 'Medium' | 'Easy' | 'Very Easy';
export type Role = 'Pilot' | 'Gunner' | 'Bomber' | 'Life Support';
export type Situation = 'Asteroid Field' | 'Space Battle';
export interface FlightConfig { total: number; naturalOne: boolean }
export type ScoreMode = 'asteroid-pilot' | 'asteroid-gunner' | 'asteroid-bomber' |
  'asteroid-life-support' | 'space-pilot' | 'space-bomber';
export type ResultBand = 'Setback' | 'Mixed' | 'Success' | 'Exceptional';
export const SCORING_VERSION = '0.2';
/** Provisional pooled 10th/90th percentile simulation anchors; see docs/scoring-calibration.md. */
export const SCORE_ANCHORS: Record<ScoreMode, { low: number; high: number }> = {
  'asteroid-pilot': { low: 66, high: 700 },
  'asteroid-gunner': { low: 25, high: 7200 },
  'asteroid-bomber': { low: 71, high: 3060 },
  'asteroid-life-support': { low: 150, high: 7800 },
  'space-pilot': { low: 63, high: 332 },
  'space-bomber': { low: 64, high: 5800 },
};
export interface RatedResult { rating: number; band: ResultBand; capped: boolean }
/** Check total and Natural 1 already affect gameplay; neither is reapplied here. */
export function rateScore(mode: ScoreMode, rawPoints: number, failed: boolean): RatedResult {
  const { low, high } = SCORE_ANCHORS[mode];
  if (!Number.isFinite(rawPoints) || high <= low) throw new Error('Invalid scoring input or anchors.');
  const rating = Math.max(0, Math.min(100, Math.round((rawPoints - low) * 100 / (high - low))));
  const earnedBand: ResultBand = rating < 25 ? 'Setback' : rating < 50 ? 'Mixed'
    : rating < 75 ? 'Success' : 'Exceptional';
  const capped = failed && earnedBand === 'Exceptional';
  return { rating, band: capped ? 'Success' : earnedBand, capped };
}
export function ratingReportText(mode: ScoreMode, rawPoints: number, failed: boolean): string {
  const { rating, band, capped } = rateScore(mode, rawPoints, failed);
  return `Rating: ${rating}/100 • Advisory band: ${band}${capped ? ' (capped at Success after system failure)' : ''} • Provisional v${SCORING_VERSION}`;
}
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
    ratingReportText('asteroid-pilot', scoreFor(s), s.hull <= 0),
    s.hull > 0 ? 'Course complete' : 'Hull depleted',
    'GM determines campaign outcome.' ].join('\n');
}

export interface GunnerTuning {
  speed: number;
  spawnEvery: number;
  fireEvery: number;
  armoredChance: number;
  drift: number;
}

// Initial playtest values, not GM-approved balance.
export const GUNNER_TUNING: Record<Difficulty, GunnerTuning> = {
  Hard: { speed: 190, spawnEvery: 0.55, fireEvery: 0.42, armoredChance: 0.30, drift: 0.42 },
  Medium: { speed: 160, spawnEvery: 0.72, fireEvery: 0.36, armoredChance: 0.18, drift: 0.34 },
  Easy: { speed: 135, spawnEvery: 0.90, fireEvery: 0.32, armoredChance: 0.10, drift: 0.26 },
  'Very Easy': { speed: 110, spawnEvery: 1.10, fireEvery: 0.28, armoredChance: 0, drift: 0.18 },
};
export const GUNNER_DEFENSE_LINE = HEIGHT - 68;
export const OVERHEAT_MULTIPLIER = 2;

export interface GunnerAsteroid extends Asteroid {
  hp: number;
  maxHp: number;
  id: number;
}
export interface GunnerInput {
  aimX?: number;
  aimY?: number;
  firing: boolean;
}
export interface GunnerState {
  crosshairX: number;
  crosshairY: number;
  elapsed: number;
  hull: number;
  impacts: number;
  destroyed: number;
  shots: number;
  cooldown: number;
  spawnIn: number;
  asteroids: GunnerAsteroid[];
  finished: boolean;
  nextId: number;
  beamTime: number;
  beamX: number;
  beamY: number;
  impactFlash: number;
}

export function createGunner(): GunnerState {
  return {
    crosshairX: WIDTH / 2, crosshairY: HEIGHT / 2, elapsed: 0, hull: 3,
    impacts: 0, destroyed: 0, shots: 0, cooldown: 0, spawnIn: 0.7,
    asteroids: [], finished: false, nextId: 1, beamTime: 0,
    beamX: WIDTH / 2, beamY: HEIGHT / 2, impactFlash: 0,
  };
}

export function gunnerFireEvery(config: FlightConfig): number {
  const normal = GUNNER_TUNING[difficultyFor(config.total)].fireEvery;
  return normal * (config.naturalOne ? OVERHEAT_MULTIPLIER : 1);
}

export function stepGunner(
  s: GunnerState,
  config: FlightConfig,
  input: GunnerInput,
  dt: number,
  random: () => number = Math.random,
): void {
  if (s.finished) return;
  dt = Math.min(Math.max(dt, 0), 0.05, DURATION - s.elapsed);
  const tuning = GUNNER_TUNING[difficultyFor(config.total)];
  s.elapsed += dt;
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.beamTime = Math.max(0, s.beamTime - dt);
  s.impactFlash = Math.max(0, s.impactFlash - dt);

  if (input.aimX !== undefined && input.aimY !== undefined) {
    s.crosshairX = Math.max(12, Math.min(WIDTH - 12, input.aimX));
    s.crosshairY = Math.max(18, Math.min(GUNNER_DEFENSE_LINE - 8, input.aimY));
  }

  if (input.firing && s.cooldown <= 0) {
    s.shots++;
    s.cooldown = gunnerFireEvery(config);
    s.beamTime = 0.09;
    s.beamX = s.crosshairX;
    s.beamY = s.crosshairY;
    let target: GunnerAsteroid | undefined;
    let targetDistance = Infinity;
    for (const asteroid of s.asteroids) {
      const distance = Math.hypot(asteroid.x - s.crosshairX, asteroid.y - s.crosshairY);
      if (distance <= asteroid.radius + 7 && distance < targetDistance) {
        target = asteroid;
        targetDistance = distance;
      }
    }
    if (target) {
      target.hp--;
      if (target.hp <= 0) {
        s.asteroids = s.asteroids.filter(asteroid => asteroid.id !== target!.id);
        s.destroyed++;
      }
    }
  }

  s.spawnIn -= dt;
  while (s.spawnIn <= 0) {
    const radius = 15 + random() * 12;
    const speed = tuning.speed * (0.85 + random() * 0.3);
    const x = radius + random() * (WIDTH - radius * 2);
    const armored = random() < tuning.armoredChance;
    const vx = (random() - 0.5) * speed * tuning.drift;
    s.asteroids.push({
      id: s.nextId++, x, y: -radius - 4, radius, speed, vx,
      hp: armored ? 2 : 1, maxHp: armored ? 2 : 1,
      rotation: random() * Math.PI * 2, spin: (random() - 0.5) * 1.5,
    });
    s.spawnIn += tuning.spawnEvery;
  }

  for (const asteroid of s.asteroids) {
    asteroid.y += asteroid.speed * dt;
    asteroid.x += (asteroid.vx ?? 0) * dt;
    asteroid.rotation = (asteroid.rotation ?? 0) + (asteroid.spin ?? 0) * dt;
    if (asteroid.x < asteroid.radius || asteroid.x > WIDTH - asteroid.radius) {
      asteroid.x = Math.max(asteroid.radius, Math.min(WIDTH - asteroid.radius, asteroid.x));
      asteroid.vx = -(asteroid.vx ?? 0);
    }
  }
  const impacts = s.asteroids.filter(asteroid => asteroid.y + asteroid.radius >= GUNNER_DEFENSE_LINE);
  if (impacts.length) {
    s.impacts += impacts.length;
    s.hull = Math.max(0, s.hull - impacts.length);
    s.impactFlash = 0.18;
    const impacted = new Set(impacts.map(asteroid => asteroid.id));
    s.asteroids = s.asteroids.filter(asteroid => !impacted.has(asteroid.id));
  }
  s.finished = s.hull <= 0 || s.elapsed >= DURATION;
}

export function gunnerScoreFor(s: GunnerState): number {
  return s.destroyed * 100 + Math.round(s.elapsed * 5) + s.hull * 100;
}

export function gunnerResultText(config: FlightConfig, s: GunnerState): string {
  return [
    'Galaxy Grown — Asteroid Field / Gunner',
    `Check total: ${config.total} • Difficulty: ${difficultyFor(config.total)}`,
    `Natural 1: ${config.naturalOne ? 'Yes — overheated gun (half normal fire rate)' : 'No'}`,
    `Score: ${gunnerScoreFor(s)} • Time: ${s.elapsed.toFixed(1)}s • Destroyed: ${s.destroyed} • Shots: ${s.shots}`,
    ratingReportText('asteroid-gunner', gunnerScoreFor(s), s.hull <= 0),
    `Hull: ${s.hull}/3 • Ship impacts: ${s.impacts}`,
    s.hull > 0 ? 'Field cleared' : 'Hull depleted',
    'GM determines campaign outcome.',
  ].join('\n');
}

export interface BomberTuning {
  speed: number;
  spawnEvery: number;
  drift: number;
}

// Initial playtest values, not GM-approved balance.
export const BOMBER_TUNING: Record<Difficulty, BomberTuning> = {
  Hard: { speed: 200, spawnEvery: 0.58, drift: 0.58 },
  Medium: { speed: 170, spawnEvery: 0.74, drift: 0.48 },
  Easy: { speed: 140, spawnEvery: 0.92, drift: 0.38 },
  'Very Easy': { speed: 115, spawnEvery: 1.12, drift: 0.28 },
};
export const BOMBER_BLAST_RADIUS = 66;
export const BOMBER_IMPAIRMENT_SCALE = Math.SQRT1_2;
export const BOMBER_MINE_COOLDOWN = 0.65;
export const BOMBER_MINE_ARM_TIME = 0.25;
export const BOMBER_MINE_LIFETIME = 5;
export const BOMBER_PLAYER_RADIUS = 13;
export const BOMBER_COLLISION_GRACE = 1.25;

export interface BomberAsteroid extends Asteroid { id: number }
export interface Mine {
  id: number;
  x: number;
  y: number;
  blastRadius: number;
  armIn: number;
  expiresIn: number;
}
export interface Explosion {
  x: number;
  y: number;
  radius: number;
  remaining: number;
}
export interface BomberInput {
  /** Keyboard reticle direction, never ship steering. */
  x: number;
  y: number;
  aimX?: number;
  aimY?: number;
  placing: boolean;
}
export interface BomberState {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  elapsed: number;
  hull: number;
  impacts: number;
  destroyed: number;
  minesPlaced: number;
  invulnerable: number;
  cooldown: number;
  spawnIn: number;
  asteroids: BomberAsteroid[];
  mines: Mine[];
  explosions: Explosion[];
  finished: boolean;
  nextId: number;
  impactFlash: number;
}

/** A predictable flight course independent of targeting, difficulty, or impairment.
 * Scrolling scenery supplies forward travel; a broad sweep makes autopilot visible.
 * Provisional playtest values: 120px amplitude and an 8-second full cycle.
 */
export function automaticShipX(elapsed: number): number {
  return WIDTH / 2 + Math.sin(elapsed * Math.PI / 4) * 120;
}

export const BOMBER_AIM_SPEED = 225;
export const MINE_DROP_OFFSET = 34;
export function mineDropPosition(ship: { x: number; y: number }) {
  return { x: ship.x, y: ship.y + MINE_DROP_OFFSET };
}
function aimBomber(
  s: { aimX: number; aimY: number },
  input: BomberInput,
  dt: number,
  minY: number,
): void {
  const magnitude = Math.max(1, Math.hypot(input.x, input.y));
  s.aimX = Math.max(18, Math.min(WIDTH - 18,
    input.aimX ?? s.aimX + input.x / magnitude * BOMBER_AIM_SPEED * dt));
  s.aimY = Math.max(minY, Math.min(HEIGHT - 18,
    input.aimY ?? s.aimY + input.y / magnitude * BOMBER_AIM_SPEED * dt));
}

export function bomberBlastRadius(config: FlightConfig): number {
  return BOMBER_BLAST_RADIUS * (config.naturalOne ? BOMBER_IMPAIRMENT_SCALE : 1);
}

export function createBomber(): BomberState {
  return {
    x: WIDTH / 2, y: 105, aimX: WIDTH / 2, aimY: 105 + MINE_DROP_OFFSET, elapsed: 0, hull: 3, impacts: 0, destroyed: 0,
    minesPlaced: 0, invulnerable: 0, cooldown: 0, spawnIn: 0.8, asteroids: [], mines: [],
    explosions: [], finished: false, nextId: 1, impactFlash: 0,
  };
}

export function stepBomber(
  s: BomberState,
  config: FlightConfig,
  input: BomberInput,
  dt: number,
  random: () => number = Math.random,
): void {
  if (s.finished) return;
  dt = Math.min(Math.max(dt, 0), 0.05, DURATION - s.elapsed);
  const tuning = BOMBER_TUNING[difficultyFor(config.total)];
  s.elapsed += dt;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.impactFlash = Math.max(0, s.impactFlash - dt);
  for (const explosion of s.explosions) explosion.remaining -= dt;
  s.explosions = s.explosions.filter(explosion => explosion.remaining > 0);

  s.x = automaticShipX(s.elapsed);
  const drop = mineDropPosition(s);
  s.aimX = drop.x; s.aimY = drop.y;

  if (input.placing && s.cooldown <= 0) {
    s.mines.push({
      id: s.nextId++, ...mineDropPosition(s), blastRadius: bomberBlastRadius(config),
      armIn: BOMBER_MINE_ARM_TIME, expiresIn: BOMBER_MINE_LIFETIME,
    });
    s.minesPlaced++;
    s.cooldown = BOMBER_MINE_COOLDOWN;
  }

  s.spawnIn -= dt;
  while (s.spawnIn <= 0) {
    const radius = 14 + random() * 12;
    const x = radius + random() * (WIDTH - radius * 2);
    const speed = tuning.speed * (0.85 + random() * 0.3);
    const vx = (s.x - x) / WIDTH * speed * tuning.drift;
    s.asteroids.push({
      id: s.nextId++, x, y: HEIGHT + radius + 4, radius, speed, vx,
      rotation: random() * Math.PI * 2, spin: (random() - 0.5) * 1.5,
    });
    s.spawnIn += tuning.spawnEvery;
  }

  for (const asteroid of s.asteroids) {
    asteroid.x += (asteroid.vx ?? 0) * dt;
    asteroid.y -= asteroid.speed * dt;
    asteroid.rotation = (asteroid.rotation ?? 0) + (asteroid.spin ?? 0) * dt;
    if (asteroid.x < asteroid.radius || asteroid.x > WIDTH - asteroid.radius) {
      asteroid.x = Math.max(asteroid.radius, Math.min(WIDTH - asteroid.radius, asteroid.x));
      asteroid.vx = -(asteroid.vx ?? 0);
    }
  }
  for (const mine of s.mines) {
    mine.armIn -= dt;
    mine.expiresIn -= dt;
  }

  const detonatedMineIds = new Set<number>();
  for (const mine of s.mines) {
    if (mine.armIn > 0 || mine.expiresIn <= 0) continue;
    if (s.asteroids.some(asteroid => Math.hypot(asteroid.x - mine.x, asteroid.y - mine.y) <= asteroid.radius + 8)) {
      detonatedMineIds.add(mine.id);
      s.explosions.push({ x: mine.x, y: mine.y, radius: mine.blastRadius, remaining: 0.28 });
    }
  }
  if (detonatedMineIds.size) {
    const explosions = s.mines.filter(mine => detonatedMineIds.has(mine.id));
    const destroyedIds = new Set(s.asteroids
      .filter(asteroid => explosions.some(mine => Math.hypot(asteroid.x - mine.x, asteroid.y - mine.y) <= mine.blastRadius))
      .map(asteroid => asteroid.id));
    s.destroyed += destroyedIds.size;
    s.asteroids = s.asteroids.filter(asteroid => !destroyedIds.has(asteroid.id));
  }
  s.mines = s.mines.filter(mine => mine.expiresIn > 0 && !detonatedMineIds.has(mine.id));

  const impacts = s.asteroids.filter(asteroid =>
    Math.hypot(asteroid.x - s.x, asteroid.y - s.y) < asteroid.radius + BOMBER_PLAYER_RADIUS);
  if (impacts.length) {
    if (s.invulnerable <= 0) {
      s.impacts++;
      s.hull = Math.max(0, s.hull - 1);
      s.invulnerable = BOMBER_COLLISION_GRACE;
      s.impactFlash = 0.18;
    }
    const impactedIds = new Set(impacts.map(asteroid => asteroid.id));
    s.asteroids = s.asteroids.filter(asteroid => !impactedIds.has(asteroid.id));
  }
  // Escaping asteroids are safe misses, not ship impacts or scoring events.
  s.asteroids = s.asteroids.filter(asteroid => asteroid.y + asteroid.radius >= -10);
  s.finished = s.hull <= 0 || s.elapsed >= DURATION;
}

export function bomberScoreFor(s: BomberState): number {
  return s.destroyed * 100 + Math.round(s.elapsed * 5) + s.hull * 100;
}

export function bomberResultText(config: FlightConfig, s: BomberState): string {
  return [
    'Galaxy Grown — Asteroid Field / Bomber',
    `Check total: ${config.total} • Difficulty: ${difficultyFor(config.total)}`,
    `Natural 1: ${config.naturalOne ? 'Yes — mine blast target has half normal area' : 'No'}`,
    `Score: ${bomberScoreFor(s)} • Time: ${s.elapsed.toFixed(1)}s • Destroyed: ${s.destroyed} • Mines: ${s.minesPlaced}`,
    ratingReportText('asteroid-bomber', bomberScoreFor(s), s.hull <= 0),
    `Hull: ${s.hull}/3 • Asteroid impacts: ${s.impacts}`,
    s.hull > 0 ? 'Field cleared' : 'Hull depleted',
    'GM determines campaign outcome.',
  ].join('\n');
}

export type LifeSupportRoute = 'Thrusters' | 'Shields' | 'Guns';
export type LifeSupportPacketKind = 'power' | 'heart' | 'overload';
export interface LifeSupportTuning { speed: number; spawnEvery: number }

// Initial playtest values, not GM-approved balance.
export const LIFE_SUPPORT_TUNING: Record<Difficulty, LifeSupportTuning> = {
  Hard: { speed: 142, spawnEvery: 0.72 },
  Medium: { speed: 126, spawnEvery: 0.88 },
  Easy: { speed: 110, spawnEvery: 1.06 },
  'Very Easy': { speed: 96, spawnEvery: 1.28 },
};
export const LIFE_SUPPORT_ROUTES: readonly LifeSupportRoute[] = ['Thrusters', 'Shields', 'Guns'];
export const LIFE_SUPPORT_SWITCH_Y = 405;
export const LIFE_SUPPORT_MAX_INTEGRITY = 5;
export const LIFE_SUPPORT_PACKET_CYCLE = 12;

export interface LifeSupportPacket {
  id: number;
  x: number;
  y: number;
  speed: number;
  target: LifeSupportRoute;
  kind: LifeSupportPacketKind;
}
export interface LifeSupportInput { route: LifeSupportRoute }
export interface LifeSupportState {
  elapsed: number;
  integrity: number;
  routed: number;
  mistakes: number;
  heartsRouted: number;
  overloadsRouted: number;
  spawnIn: number;
  spawnIndex: number;
  nextId: number;
  selectedRoute: LifeSupportRoute;
  packets: LifeSupportPacket[];
  finished: boolean;
  lastResult: 'correct' | 'incorrect' | null;
  feedbackTime: number;
}

/**
 * Every complete 12-packet cycle has an exact, deterministic special-packet mix.
 * Standard: two hearts and one overload. Natural 1: one heart and two overloads.
 */
export function lifeSupportPacketKind(spawnIndex: number, naturalOne: boolean): LifeSupportPacketKind {
  const slot = ((spawnIndex % LIFE_SUPPORT_PACKET_CYCLE) + LIFE_SUPPORT_PACKET_CYCLE) % LIFE_SUPPORT_PACKET_CYCLE + 1;
  if (naturalOne) {
    if (slot === 11) return 'heart';
    if (slot === 4 || slot === 8) return 'overload';
  } else {
    if (slot === 5 || slot === 11) return 'heart';
    if (slot === 8) return 'overload';
  }
  return 'power';
}

export function createLifeSupport(): LifeSupportState {
  return {
    elapsed: 0, integrity: LIFE_SUPPORT_MAX_INTEGRITY, routed: 0, mistakes: 0,
    heartsRouted: 0, overloadsRouted: 0, spawnIn: 0.7, spawnIndex: 0,
    nextId: 1, selectedRoute: 'Shields', packets: [], finished: false,
    lastResult: null, feedbackTime: 0,
  };
}

export function stepLifeSupport(
  s: LifeSupportState,
  config: FlightConfig,
  input: LifeSupportInput,
  dt: number,
  random: () => number = Math.random,
): void {
  if (s.finished) return;
  dt = Math.min(Math.max(dt, 0), 0.05, DURATION - s.elapsed);
  const tuning = LIFE_SUPPORT_TUNING[difficultyFor(config.total)];
  s.elapsed += dt;
  s.feedbackTime = Math.max(0, s.feedbackTime - dt);
  s.selectedRoute = input.route;
  s.spawnIn -= dt;

  while (s.spawnIn <= 0) {
    const kind = lifeSupportPacketKind(s.spawnIndex, config.naturalOne);
    const target = kind === 'heart' ? 'Shields'
      : kind === 'overload' ? 'Guns'
        : LIFE_SUPPORT_ROUTES[Math.min(2, Math.floor(random() * LIFE_SUPPORT_ROUTES.length))];
    s.packets.push({
      id: s.nextId++, x: WIDTH / 2, y: 42, speed: tuning.speed * (0.94 + random() * 0.12),
      target, kind,
    });
    s.spawnIndex++;
    s.spawnIn += tuning.spawnEvery;
  }

  for (const packet of s.packets) packet.y += packet.speed * dt;
  const arriving = s.packets.filter(packet => packet.y >= LIFE_SUPPORT_SWITCH_Y);
  for (const packet of arriving) {
    if (packet.target === s.selectedRoute) {
      s.routed++;
      if (packet.kind === 'heart') {
        s.heartsRouted++;
        s.integrity = Math.min(LIFE_SUPPORT_MAX_INTEGRITY, s.integrity + 1);
      } else if (packet.kind === 'overload') {
        s.overloadsRouted++;
      }
      s.lastResult = 'correct';
    } else {
      s.mistakes++;
      s.integrity = Math.max(0, s.integrity - (packet.kind === 'overload' ? 2 : 1));
      s.lastResult = 'incorrect';
    }
    s.feedbackTime = 0.22;
  }
  if (arriving.length) {
    const ids = new Set(arriving.map(packet => packet.id));
    s.packets = s.packets.filter(packet => !ids.has(packet.id));
  }
  s.finished = s.integrity <= 0 || s.elapsed >= DURATION;
}

export function lifeSupportScoreFor(s: LifeSupportState): number {
  return s.routed * 100 + (s.heartsRouted + s.overloadsRouted) * 50 + s.integrity * 100;
}

export function lifeSupportResultText(config: FlightConfig, s: LifeSupportState): string {
  return [
    'Galaxy Grown — Asteroid Field / Life Support',
    `Check total: ${config.total} • Difficulty: ${difficultyFor(config.total)}`,
    `Natural 1: ${config.naturalOne ? 'Yes — one heart and two overloads per 12 packets' : 'No — two hearts and one overload per 12 packets'}`,
    `Score: ${lifeSupportScoreFor(s)} • Time: ${s.elapsed.toFixed(1)}s • Correct routes: ${s.routed} • Mistakes: ${s.mistakes}`,
    ratingReportText('asteroid-life-support', lifeSupportScoreFor(s), s.integrity <= 0),
    `Integrity: ${s.integrity}/${LIFE_SUPPORT_MAX_INTEGRITY} • Hearts: ${s.heartsRouted} • Overloads cleared: ${s.overloadsRouted}`,
    s.integrity > 0 ? 'Systems stabilized' : 'Systems failed',
    'GM determines campaign outcome.',
  ].join('\n');
}

export interface SpaceBattleTuning {
  enemySpeed: number;
  enemySpawnEvery: number;
  enemyFireEvery: number;
  shotSpeed: number;
  fuelSpawnEvery: number;
  pilotSpeed: number;
}

// Initial playtest values, not GM-approved balance.
export const SPACE_BATTLE_TUNING: Record<Difficulty, SpaceBattleTuning> = {
  Hard: { enemySpeed: 145, enemySpawnEvery: 1.15, enemyFireEvery: 1.00, shotSpeed: 230, fuelSpawnEvery: 3.8, pilotSpeed: 210 },
  Medium: { enemySpeed: 125, enemySpawnEvery: 1.45, enemyFireEvery: 1.25, shotSpeed: 205, fuelSpawnEvery: 3.4, pilotSpeed: 225 },
  Easy: { enemySpeed: 105, enemySpawnEvery: 1.80, enemyFireEvery: 1.50, shotSpeed: 180, fuelSpawnEvery: 3.0, pilotSpeed: 240 },
  'Very Easy': { enemySpeed: 85, enemySpawnEvery: 2.20, enemyFireEvery: 1.80, shotSpeed: 155, fuelSpawnEvery: 2.6, pilotSpeed: 255 },
};
export const SPACE_BATTLE_STARTING_FUEL = 18;
export const SPACE_BATTLE_MAX_FUEL = 30;
export const FUEL_PICKUP_VALUE = 8;

export interface EnemyShip {
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  vx: number;
  shotIn: number;
}
export interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}
export interface FuelCell {
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  value: number;
}
export type SpaceBattleEndReason = 'time' | 'hull' | 'fuel' | null;
export interface SpaceBattlePilotState {
  x: number;
  y: number;
  elapsed: number;
  hull: number;
  hits: number;
  invulnerable: number;
  fuel: number;
  fuelCollected: number;
  enemySpawnIn: number;
  fuelSpawnIn: number;
  enemies: EnemyShip[];
  shots: EnemyShot[];
  fuelCells: FuelCell[];
  nextId: number;
  finished: boolean;
  endReason: SpaceBattleEndReason;
  impactFlash: number;
}

export function createSpaceBattlePilot(): SpaceBattlePilotState {
  return {
    x: WIDTH / 2, y: HEIGHT - 85, elapsed: 0, hull: 3, hits: 0,
    invulnerable: 0, fuel: SPACE_BATTLE_STARTING_FUEL, fuelCollected: 0,
    enemySpawnIn: 0.8, fuelSpawnIn: 2.2, enemies: [], shots: [], fuelCells: [],
    nextId: 1, finished: false, endReason: null, impactFlash: 0,
  };
}

export function spaceBattlePilotSpeed(config: FlightConfig): number {
  return SPACE_BATTLE_TUNING[difficultyFor(config.total)].pilotSpeed * (config.naturalOne ? ENGINE_MULTIPLIER : 1);
}

export function stepSpaceBattlePilot(
  s: SpaceBattlePilotState,
  config: FlightConfig,
  input: { x: number; y: number },
  dt: number,
  random: () => number = Math.random,
): void {
  if (s.finished) return;
  dt = Math.min(Math.max(dt, 0), 0.05, DURATION - s.elapsed);
  const tuning = SPACE_BATTLE_TUNING[difficultyFor(config.total)];
  s.elapsed += dt;
  s.fuel = Math.max(0, s.fuel - dt);
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.impactFlash = Math.max(0, s.impactFlash - dt);

  const magnitude = Math.max(1, Math.hypot(input.x, input.y));
  s.x = Math.max(18, Math.min(WIDTH - 18, s.x + input.x / magnitude * spaceBattlePilotSpeed(config) * dt));
  s.y = Math.max(22, Math.min(HEIGHT - 22, s.y + input.y / magnitude * spaceBattlePilotSpeed(config) * dt));

  s.enemySpawnIn -= dt;
  while (s.enemySpawnIn <= 0) {
    const radius = 16;
    s.enemies.push({
      id: s.nextId++, x: radius + random() * (WIDTH - radius * 2), y: -radius - 4,
      radius, speed: tuning.enemySpeed * (0.88 + random() * 0.24),
      vx: (random() - 0.5) * 42,
      shotIn: tuning.enemyFireEvery * (0.65 + random() * 0.7),
    });
    s.enemySpawnIn += tuning.enemySpawnEvery;
  }

  s.fuelSpawnIn -= dt;
  while (s.fuelSpawnIn <= 0) {
    const radius = 11;
    s.fuelCells.push({
      id: s.nextId++, x: radius + random() * (WIDTH - radius * 2), y: -radius - 4,
      radius, speed: 82 + random() * 24, value: FUEL_PICKUP_VALUE,
    });
    s.fuelSpawnIn += tuning.fuelSpawnEvery;
  }

  for (const enemy of s.enemies) {
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.speed * dt;
    if (enemy.x < enemy.radius || enemy.x > WIDTH - enemy.radius) {
      enemy.x = Math.max(enemy.radius, Math.min(WIDTH - enemy.radius, enemy.x));
      enemy.vx *= -1;
    }
    enemy.shotIn -= dt;
    while (enemy.shotIn <= 0 && enemy.y < HEIGHT - 80) {
      const dx = s.x - enemy.x;
      const dy = s.y - enemy.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      s.shots.push({ x: enemy.x, y: enemy.y + enemy.radius, vx: dx / length * tuning.shotSpeed, vy: dy / length * tuning.shotSpeed, radius: 5 });
      enemy.shotIn += tuning.enemyFireEvery;
    }
  }
  for (const shot of s.shots) { shot.x += shot.vx * dt; shot.y += shot.vy * dt; }
  for (const cell of s.fuelCells) cell.y += cell.speed * dt;

  const collected = s.fuelCells.filter(cell => Math.hypot(cell.x - s.x, cell.y - s.y) < cell.radius + PILOT_RADIUS);
  if (collected.length) {
    s.fuelCollected += collected.length;
    s.fuel = Math.min(SPACE_BATTLE_MAX_FUEL, s.fuel + collected.reduce((sum, cell) => sum + cell.value, 0));
    const ids = new Set(collected.map(cell => cell.id));
    s.fuelCells = s.fuelCells.filter(cell => !ids.has(cell.id));
  }

  const collidingEnemies = s.enemies.filter(enemy => Math.hypot(enemy.x - s.x, enemy.y - s.y) < enemy.radius + PILOT_RADIUS);
  const collidingShots = s.shots.filter(shot => Math.hypot(shot.x - s.x, shot.y - s.y) < shot.radius + PILOT_RADIUS);
  if ((collidingEnemies.length || collidingShots.length) && !s.invulnerable) {
    s.hits++;
    s.hull--;
    s.invulnerable = 1.25;
    s.impactFlash = 0.18;
  }
  if (collidingEnemies.length) {
    const ids = new Set(collidingEnemies.map(enemy => enemy.id));
    s.enemies = s.enemies.filter(enemy => !ids.has(enemy.id));
  }
  if (collidingShots.length) {
    const collided = new Set(collidingShots);
    s.shots = s.shots.filter(shot => !collided.has(shot));
  }

  s.enemies = s.enemies.filter(enemy => enemy.y - enemy.radius < HEIGHT + 20);
  s.shots = s.shots.filter(shot => shot.y < HEIGHT + 20 && shot.y > -20 && shot.x > -20 && shot.x < WIDTH + 20);
  s.fuelCells = s.fuelCells.filter(cell => cell.y - cell.radius < HEIGHT + 20);

  if (s.hull <= 0) { s.finished = true; s.endReason = 'hull'; }
  else if (s.fuel <= 0) { s.finished = true; s.endReason = 'fuel'; }
  else if (s.elapsed >= DURATION) { s.finished = true; s.endReason = 'time'; }
}

export function spaceBattlePilotScoreFor(s: SpaceBattlePilotState): number {
  return Math.round(s.elapsed * 10) + s.hull * 100 + s.fuelCollected * 50;
}

export function spaceBattlePilotResultText(config: FlightConfig, s: SpaceBattlePilotState): string {
  const outcome = s.endReason === 'time' ? 'Battle run complete' : s.endReason === 'fuel' ? 'Fuel depleted' : 'Hull depleted';
  return [
    'Galaxy Grown — Space Battle / Pilot',
    `Check total: ${config.total} • Difficulty: ${difficultyFor(config.total)}`,
    `Natural 1: ${config.naturalOne ? 'Yes — overloaded engine (60% movement speed)' : 'No'}`,
    `Score: ${spaceBattlePilotScoreFor(s)} • Time: ${s.elapsed.toFixed(1)}s • Fuel collected: ${s.fuelCollected}`,
    ratingReportText('space-pilot', spaceBattlePilotScoreFor(s), s.endReason === 'hull' || s.endReason === 'fuel' || s.hull <= 0 || s.fuel <= 0),
    `Fuel: ${s.fuel.toFixed(1)}s • Hits: ${s.hits} • Hull: ${s.hull}/3`,
    outcome,
    'GM determines campaign outcome.',
  ].join('\n');
}

export interface SpaceBattleBomberTuning {
  enemySpeed: number;
  forwardSpawnEvery: number;
  pursuerSpawnEvery: number;
}

// Initial playtest values, not GM-approved balance.
export const SPACE_BATTLE_BOMBER_TUNING: Record<Difficulty, SpaceBattleBomberTuning> = {
  Hard: { enemySpeed: 180, forwardSpawnEvery: 0.82, pursuerSpawnEvery: 1.05 },
  Medium: { enemySpeed: 155, forwardSpawnEvery: 1.00, pursuerSpawnEvery: 1.28 },
  Easy: { enemySpeed: 130, forwardSpawnEvery: 1.22, pursuerSpawnEvery: 1.55 },
  'Very Easy': { enemySpeed: 105, forwardSpawnEvery: 1.48, pursuerSpawnEvery: 1.90 },
};
export const SPACE_BOMBER_MISSILE_SPEED = 430;
export const SPACE_BOMBER_MISSILE_COOLDOWN = 0.38;
export const SPACE_BOMBER_MINE_COOLDOWN = 0.85;
export const SPACE_BOMBER_MINE_ARM_TIME = 0.2;
export const SPACE_BOMBER_MINE_LIFETIME = 4.5;
export const SPACE_BOMBER_BLAST_RADIUS = 58;
export const SPACE_BOMBER_PLAYER_RADIUS = 13;
export const SPACE_BOMBER_COLLISION_GRACE = 1.25;

export interface SpaceBomberEnemy extends EnemyShip {
  approach: 'forward' | 'pursuer';
}
export interface SpaceBomberMissile {
  vx: number;
  vy: number;
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
}
export interface SpaceBattleBomberInput extends BomberInput {
  firing: boolean;
  placing: boolean;
}
export interface SpaceBattleBomberState {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  elapsed: number;
  hull: number;
  hits: number;
  destroyed: number;
  missilesFired: number;
  minesPlaced: number;
  missileCooldown: number;
  mineCooldown: number;
  invulnerable: number;
  forwardSpawnIn: number;
  pursuerSpawnIn: number;
  enemies: SpaceBomberEnemy[];
  missiles: SpaceBomberMissile[];
  mines: Mine[];
  explosions: Explosion[];
  nextId: number;
  impactFlash: number;
  finished: boolean;
}

/** Natural 1 affects this mode's circular mine blast target, not its missiles. */
export function spaceBomberBlastRadius(config: FlightConfig): number {
  return SPACE_BOMBER_BLAST_RADIUS * (config.naturalOne ? BOMBER_IMPAIRMENT_SCALE : 1);
}

export function createSpaceBattleBomber(): SpaceBattleBomberState {
  return {
    x: WIDTH / 2, y: HEIGHT * 0.56, aimX: WIDTH / 2, aimY: 170, elapsed: 0, hull: 3, hits: 0, destroyed: 0,
    missilesFired: 0, minesPlaced: 0, missileCooldown: 0, mineCooldown: 0,
    invulnerable: 0, forwardSpawnIn: 0.65, pursuerSpawnIn: 1.1,
    enemies: [], missiles: [], mines: [], explosions: [], nextId: 1,
    impactFlash: 0, finished: false,
  };
}

export function stepSpaceBattleBomber(
  s: SpaceBattleBomberState,
  config: FlightConfig,
  input: SpaceBattleBomberInput,
  dt: number,
  random: () => number = Math.random,
): void {
  if (s.finished) return;
  dt = Math.min(Math.max(dt, 0), 0.05, DURATION - s.elapsed);
  const tuning = SPACE_BATTLE_BOMBER_TUNING[difficultyFor(config.total)];
  s.elapsed += dt;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.missileCooldown = Math.max(0, s.missileCooldown - dt);
  s.mineCooldown = Math.max(0, s.mineCooldown - dt);
  s.impactFlash = Math.max(0, s.impactFlash - dt);
  for (const explosion of s.explosions) explosion.remaining -= dt;
  s.explosions = s.explosions.filter(explosion => explosion.remaining > 0);

  s.x = automaticShipX(s.elapsed);
  aimBomber(s, input, dt, 18);

  if (input.firing && s.missileCooldown <= 0) {
    const dx = s.aimX - s.x;
    const dy = Math.min(s.y - 34, s.aimY) - (s.y - 22);
    const length = Math.hypot(dx, dy);
    s.missiles.push({
      id: s.nextId++, x: s.x, y: s.y - 22, radius: 5, speed: SPACE_BOMBER_MISSILE_SPEED,
      vx: dx / length * SPACE_BOMBER_MISSILE_SPEED,
      vy: dy / length * SPACE_BOMBER_MISSILE_SPEED,
    });
    s.missilesFired++;
    s.missileCooldown = SPACE_BOMBER_MISSILE_COOLDOWN;
  }
  if (input.placing && s.mineCooldown <= 0) {
    s.mines.push({
      id: s.nextId++, ...mineDropPosition(s), blastRadius: spaceBomberBlastRadius(config),
      armIn: SPACE_BOMBER_MINE_ARM_TIME, expiresIn: SPACE_BOMBER_MINE_LIFETIME,
    });
    s.minesPlaced++;
    s.mineCooldown = SPACE_BOMBER_MINE_COOLDOWN;
  }

  const spawnEnemy = (approach: SpaceBomberEnemy['approach']) => {
    const radius = 16;
    const x = radius + random() * (WIDTH - radius * 2);
    const speed = tuning.enemySpeed * (0.88 + random() * 0.24);
    s.enemies.push({
      id: s.nextId++, x, y: approach === 'forward' ? -radius - 4 : HEIGHT + radius + 4,
      radius, speed, vx: (random() - 0.5) * 36, shotIn: Infinity, approach,
    });
  };
  s.forwardSpawnIn -= dt;
  while (s.forwardSpawnIn <= 0) { spawnEnemy('forward'); s.forwardSpawnIn += tuning.forwardSpawnEvery; }
  s.pursuerSpawnIn -= dt;
  while (s.pursuerSpawnIn <= 0) { spawnEnemy('pursuer'); s.pursuerSpawnIn += tuning.pursuerSpawnEvery; }

  for (const enemy of s.enemies) {
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.speed * dt * (enemy.approach === 'forward' ? 1 : -1);
    if (enemy.x < enemy.radius || enemy.x > WIDTH - enemy.radius) {
      enemy.x = Math.max(enemy.radius, Math.min(WIDTH - enemy.radius, enemy.x));
      enemy.vx *= -1;
    }
  }
  for (const missile of s.missiles) { missile.x += missile.vx * dt; missile.y += missile.vy * dt; }
  for (const mine of s.mines) { mine.armIn -= dt; mine.expiresIn -= dt; }

  const destroyedIds = new Set<number>();
  const usedMissiles = new Set<number>();
  for (const missile of s.missiles) {
    const enemy = s.enemies.find(candidate => !destroyedIds.has(candidate.id)
      && Math.hypot(candidate.x - missile.x, candidate.y - missile.y) <= candidate.radius + missile.radius);
    if (enemy) { destroyedIds.add(enemy.id); usedMissiles.add(missile.id); }
  }

  const detonatedMines = new Set<number>();
  for (const mine of s.mines) {
    if (mine.armIn > 0 || mine.expiresIn <= 0) continue;
    if (s.enemies.some(enemy => !destroyedIds.has(enemy.id)
      && Math.hypot(enemy.x - mine.x, enemy.y - mine.y) <= enemy.radius + 8)) {
      detonatedMines.add(mine.id);
      s.explosions.push({ x: mine.x, y: mine.y, radius: mine.blastRadius, remaining: 0.28 });
      for (const enemy of s.enemies) {
        if (Math.hypot(enemy.x - mine.x, enemy.y - mine.y) <= mine.blastRadius) destroyedIds.add(enemy.id);
      }
    }
  }
  s.destroyed += destroyedIds.size;
  s.enemies = s.enemies.filter(enemy => !destroyedIds.has(enemy.id));
  s.missiles = s.missiles.filter(missile => missile.y + missile.radius >= 0 && missile.x >= -20 && missile.x <= WIDTH + 20 && !usedMissiles.has(missile.id));
  s.mines = s.mines.filter(mine => mine.expiresIn > 0 && !detonatedMines.has(mine.id));

  const colliding = s.enemies.filter(enemy =>
    Math.hypot(enemy.x - s.x, enemy.y - s.y) < enemy.radius + SPACE_BOMBER_PLAYER_RADIUS);
  if (colliding.length) {
    if (s.invulnerable <= 0) {
      s.hits++;
      s.hull = Math.max(0, s.hull - 1);
      s.invulnerable = SPACE_BOMBER_COLLISION_GRACE;
      s.impactFlash = 0.18;
    }
    const collidedIds = new Set(colliding.map(enemy => enemy.id));
    s.enemies = s.enemies.filter(enemy => !collidedIds.has(enemy.id));
  }
  s.enemies = s.enemies.filter(enemy => enemy.approach === 'forward'
    ? enemy.y - enemy.radius < HEIGHT + 20 : enemy.y + enemy.radius > -20);
  s.finished = s.hull <= 0 || s.elapsed >= DURATION;
}

export function spaceBattleBomberScoreFor(s: SpaceBattleBomberState): number {
  return s.destroyed * 100 + Math.round(s.elapsed * 5) + s.hull * 100;
}

export function spaceBattleBomberResultText(config: FlightConfig, s: SpaceBattleBomberState): string {
  return [
    'Galaxy Grown — Space Battle / Bomber',
    `Check total: ${config.total} • Difficulty: ${difficultyFor(config.total)}`,
    `Natural 1: ${config.naturalOne ? 'Yes — mine blast target has half normal area' : 'No'}`,
    `Score: ${spaceBattleBomberScoreFor(s)} • Time: ${s.elapsed.toFixed(1)}s • Destroyed: ${s.destroyed}`,
    ratingReportText('space-bomber', spaceBattleBomberScoreFor(s), s.hull <= 0),
    `Missiles: ${s.missilesFired} • Mines: ${s.minesPlaced} • Hull: ${s.hull}/3 • Hits: ${s.hits}`,
    s.hull > 0 ? 'Bombing run complete' : 'Hull depleted',
    'GM determines campaign outcome.',
  ].join('\n');
}
