export type Difficulty = 'Hard' | 'Medium' | 'Easy' | 'Very Easy';
export type Role = 'Pilot' | 'Gunner' | 'Bomber' | 'Life Support';
export type Situation = 'Asteroid Field' | 'Space Battle';
export interface FlightConfig { total: number; naturalOne: boolean }
export type ScoreMode = 'asteroid-pilot' | 'asteroid-gunner' | 'asteroid-bomber' |
  'asteroid-life-support' | 'space-pilot' | 'space-bomber' | 'space-life-support' | 'space-gunner';
export type ResultBand = 'Setback' | 'Mixed' | 'Success' | 'Exceptional';
export const SCORING_VERSION = '0.5';
/** Provisional mode anchors. Space Battle values include owner playtest adjustments; see docs/scoring-calibration.md. */
export const SCORE_ANCHORS: Record<ScoreMode, { low: number; high: number }> = {
  'asteroid-pilot': { low: 66, high: 700 },
  'asteroid-gunner': { low: 25, high: 7200 },
  'asteroid-bomber': { low: 71, high: 3060 },
  'asteroid-life-support': { low: 150, high: 7800 },
  'space-pilot': { low: 63, high: 1000 },
  'space-bomber': { low: 64, high: 3300 },
  'space-life-support': { low: 130, high: 1350 },
  'space-gunner': { low: 37, high: 5000 },
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

export const MINE_DROP_OFFSET = 34;
export function mineDropPosition(ship: { x: number; y: number }) {
  return { x: ship.x, y: ship.y + MINE_DROP_OFFSET };
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
  pursuerSpawnEvery: number;
}

// Initial playtest values, not GM-approved balance.
export const SPACE_BATTLE_BOMBER_TUNING: Record<Difficulty, SpaceBattleBomberTuning> = {
  Hard: { enemySpeed: 180, pursuerSpawnEvery: 1.05 },
  Medium: { enemySpeed: 155, pursuerSpawnEvery: 1.28 },
  Easy: { enemySpeed: 130, pursuerSpawnEvery: 1.55 },
  'Very Easy': { enemySpeed: 105, pursuerSpawnEvery: 1.90 },
};
export const SPACE_BOMBER_MINE_COOLDOWN = 0.85;
export const SPACE_BOMBER_MINE_ARM_TIME = 0.2;
export const SPACE_BOMBER_LAUNCH_DISTANCE = 100;
export const SPACE_BOMBER_AIM_SPEED = 120 * Math.PI / 180;
export const SPACE_BOMBER_PASS_TIME = 0.3;
export const SPACE_BOMBER_MINE_LIFETIME = 4.5;
export const SPACE_BOMBER_BLAST_RADIUS = 58;
export const SPACE_BOMBER_PLAYER_RADIUS = 13;
export const SPACE_BOMBER_COLLISION_GRACE = 1.25;

export interface SpaceBomberEnemy {
  id: number; x: number; y: number; radius: number; speed: number;
  warningRemaining: number;
}
/** One frame's mine press, consumed even if the weapon is cooling down. */
export interface SpaceBattleBomberInput {
  placing: boolean;
  aim?: { x: number; y: number };
  launch?: { x: number; y: number };
  turn?: number;
  straight?: boolean;
}
export interface SpaceBomberMine extends Mine {
  flight?: { x: number; y: number; targetX: number; targetY: number; remaining: number };
}
export interface SpaceBomberPass extends SpaceBomberEnemy { remaining: number; side: -1 | 1 }
export function spaceBomberLanding(ship: { x: number; y: number; aimAngle: number }) {
  const rack = mineDropPosition(ship);
  const angle = Math.max(0, Math.min(Math.PI, ship.aimAngle));
  return { x: rack.x + Math.cos(angle) * SPACE_BOMBER_LAUNCH_DISTANCE,
    y: rack.y + Math.sin(angle) * SPACE_BOMBER_LAUNCH_DISTANCE };
}
function aftAngle(point: { x: number; y: number }, ship: { x: number; y: number }): number | null {
  const rack = mineDropPosition(ship), dx = point.x - rack.x, dy = point.y - rack.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dy < 0) return null;
  return dx === 0 && dy === 0 ? Math.PI / 2 : Math.atan2(dy, dx);
}
/** First entry of a relative segment into a collision circle, including its start. */
function circleEntry(x: number, y: number, dx: number, dy: number, radius: number, strict = false): number | null {
  const c = x * x + y * y - radius * radius;
  if (strict ? c < 0 : c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (x * dx + y * dy), discriminant = b * b - 4 * a * c;
  if (strict ? discriminant <= 0 : discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && (strict ? t < 1 : t <= 1) ? t : null;
}
export interface SpaceBattleBomberState {
  x: number;
  y: number;
  aimAngle: number;
  elapsed: number;
  hull: number;
  hits: number;
  destroyed: number;
  minesPlaced: number;
  mineCooldown: number;
  invulnerable: number;
  pursuerSpawnIn: number;
  enemies: SpaceBomberEnemy[];
  mines: SpaceBomberMine[];
  passes: SpaceBomberPass[];
  explosions: Explosion[];
  nextId: number;
  impactFlash: number;
  finished: boolean;
}

/** Natural 1 affects this mode's circular mine blast target, independently of difficulty. */
export function spaceBomberBlastRadius(config: FlightConfig): number {
  return SPACE_BOMBER_BLAST_RADIUS * (config.naturalOne ? BOMBER_IMPAIRMENT_SCALE : 1);
}

export function createSpaceBattleBomber(): SpaceBattleBomberState {
  return {
    // Upper-quarter station leaves room to read pursuers and lay mines. Provisional tuning.
    x: WIDTH / 2, y: HEIGHT * 0.25, aimAngle: Math.PI / 2, elapsed: 0, hull: 3, hits: 0, destroyed: 0,
    minesPlaced: 0, mineCooldown: 0,
    invulnerable: 0, pursuerSpawnIn: 1.1,
    enemies: [], mines: [], passes: [], explosions: [], nextId: 1,
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
  if (dt <= 0) return;
  const tuning = SPACE_BATTLE_BOMBER_TUNING[difficultyFor(config.total)];
  const oldShipX = s.x, oldGrace = s.invulnerable;
  const previousMines = new Set(s.mines.map(mine => mine.id));
  s.elapsed += dt;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.mineCooldown = Math.max(0, s.mineCooldown - dt);
  s.impactFlash = Math.max(0, s.impactFlash - dt);
  for (const explosion of s.explosions) explosion.remaining -= dt;
  s.explosions = s.explosions.filter(explosion => explosion.remaining > 0);
  for (const pass of s.passes) {
    pass.x += pass.side * 180 * dt; pass.y -= pass.speed * dt; pass.remaining -= dt;
  }
  s.passes = s.passes.filter(pass => pass.remaining > 0);

  s.x = automaticShipX(s.elapsed);
  if (input.aim) s.aimAngle = aftAngle(input.aim, s) ?? s.aimAngle;
  if (input.straight) s.aimAngle = Math.PI / 2;
  else if (input.turn) s.aimAngle = Math.max(0, Math.min(Math.PI,
    s.aimAngle + Math.max(-1, Math.min(1, input.turn)) * SPACE_BOMBER_AIM_SPEED * dt));
  const releaseAngle = input.launch ? aftAngle(input.launch, s) : s.aimAngle;
  // A pointer release ahead of the rack is cancelled, not redirected or banked.
  if (input.placing && releaseAngle !== null && s.mineCooldown <= 0) {
    s.aimAngle = releaseAngle;
    const rack = mineDropPosition(s), target = spaceBomberLanding(s);
    s.mines.push({ id: s.nextId++, ...rack, blastRadius: spaceBomberBlastRadius(config),
      armIn: SPACE_BOMBER_MINE_ARM_TIME, expiresIn: SPACE_BOMBER_MINE_LIFETIME,
      flight: { ...rack, targetX: target.x, targetY: target.y, remaining: SPACE_BOMBER_MINE_ARM_TIME } });
    s.minesPlaced++; s.mineCooldown = SPACE_BOMBER_MINE_COOLDOWN;
  }

  // Preserve each entity's exact within-step path, including a fractional spawn.
  const paths = new Map<number, { y: number; start: number; end: number }>();
  const advanceEnemy = (enemy: SpaceBomberEnemy, start: number) => {
    const y = enemy.y;
    const crossing = y < s.y ? start : enemy.speed > 0 ? start + (y - s.y) / enemy.speed : Infinity;
    paths.set(enemy.id, { y, start, end: Math.min(dt, crossing) });
    enemy.y -= enemy.speed * (dt - start);
    enemy.warningRemaining = Math.max(0, enemy.warningRemaining - (dt - start));
  };
  for (const enemy of s.enemies) advanceEnemy(enemy, 0);
  s.pursuerSpawnIn -= dt;
  while (s.pursuerSpawnIn <= 0) {
    const radius = 16, speed = tuning.enemySpeed * (0.88 + random() * 0.24);
    const age = -s.pursuerSpawnIn, spawnY = HEIGHT + radius + 4;
    const interceptTime = s.elapsed - age + (spawnY - s.y) / speed;
    const enemy = { id: s.nextId++, x: automaticShipX(interceptTime),
      y: spawnY, radius, speed, warningRemaining: 0.8 };
    s.enemies.push(enemy); advanceEnemy(enemy, dt - age);
    s.pursuerSpawnIn += tuning.pursuerSpawnEvery;
  }
  const enemyY = (enemy: SpaceBomberEnemy, time: number) => {
    const path = paths.get(enemy.id)!;
    return path.y - enemy.speed * (time - path.start);
  };
  const contacts: { time: number; mine: SpaceBomberMine; enemy: SpaceBomberEnemy }[] = [];
  for (const mine of s.mines) {
    // New launches occur at the end of this step; their flight/arming clock starts next step.
    if (!previousMines.has(mine.id)) continue;
    const armsAt = mine.armIn <= dt + 1e-9 ? Math.min(dt, Math.max(0, mine.armIn)) : mine.armIn;
    const expiresAt = mine.expiresIn;
    if (mine.flight) {
      const flight = mine.flight;
      flight.remaining = Math.max(0, flight.remaining - dt);
      const progress = 1 - flight.remaining / SPACE_BOMBER_MINE_ARM_TIME;
      mine.x = flight.x + (flight.targetX - flight.x) * progress;
      mine.y = flight.y + (flight.targetY - flight.y) * progress;
      if (flight.remaining <= 1e-9) { mine.x = flight.targetX; mine.y = flight.targetY; delete mine.flight; }
    }
    mine.armIn = Math.max(0, armsAt - dt); mine.expiresIn -= dt;
    if (armsAt > dt || mine.flight) continue;
    // Once armed the mine is stationary. Sweep only its live, armed interval.
    for (const enemy of s.enemies) {
      const path = paths.get(enemy.id)!;
      if (path.y < s.y) continue;
      const start = Math.max(armsAt, path.start), end = Math.min(dt, expiresAt, path.end);
      if (start > end || start >= expiresAt) continue;
      const y0 = enemyY(enemy, start), y1 = enemyY(enemy, end);
      const entry = circleEntry(enemy.x - mine.x, y0 - mine.y, 0, y1 - y0, enemy.radius + 8);
      if (entry === null) continue;
      const time = start + entry * (end - start);
      if (time < expiresAt) contacts.push({ time, mine, enemy });
    }
  }
  contacts.sort((a, b) => a.time - b.time || a.mine.id - b.mine.id || a.enemy.id - b.enemy.id);
  const destroyedIds = new Set<number>(), detonatedMines = new Set<number>();
  for (const { time, mine, enemy } of contacts) {
    if (detonatedMines.has(mine.id) || destroyedIds.has(enemy.id)) continue;
    detonatedMines.add(mine.id);
    s.explosions.push({ x: mine.x, y: mine.y, radius: mine.blastRadius, remaining: 0.28 - (dt - time) });
    for (const candidate of s.enemies) {
      const path = paths.get(candidate.id)!;
      if (path.y >= s.y && time >= path.start && time <= path.end &&
        Math.hypot(candidate.x - mine.x, enemyY(candidate, time) - mine.y) <= mine.blastRadius) {
        destroyedIds.add(candidate.id);
      }
    }
  }
  s.destroyed += destroyedIds.size;
  s.mines = s.mines.filter(mine => mine.expiresIn > 0 && !detonatedMines.has(mine.id));
  // Mine defense has priority over ship damage, as in the existing Bomber rules.
  const colliding: { enemy: SpaceBomberEnemy; time: number }[] = [];
  for (const enemy of s.enemies) {
    if (destroyedIds.has(enemy.id)) continue;
    const path = paths.get(enemy.id)!;
    if (path.y < s.y || path.end < path.start) continue;
    const shipAt = (time: number) => oldShipX + (s.x - oldShipX) * time / dt;
    const y0 = enemyY(enemy, path.start), y1 = enemyY(enemy, path.end);
    const x0 = enemy.x - shipAt(path.start), x1 = enemy.x - shipAt(path.end);
    const entry = circleEntry(x0, y0 - s.y, x1 - x0, y1 - y0,
      enemy.radius + SPACE_BOMBER_PLAYER_RADIUS, true);
    if (entry !== null) colliding.push({ enemy, time: path.start + entry * (path.end - path.start) });
  }
  colliding.sort((a, b) => a.time - b.time || a.enemy.id - b.enemy.id);
  const damaging = colliding.find(contact => contact.time >= oldGrace);
  if (damaging) {
    s.hits++; s.hull = Math.max(0, s.hull - 1);
    s.invulnerable = SPACE_BOMBER_COLLISION_GRACE - (dt - damaging.time); s.impactFlash = 0.18;
  }
  const collidedIds = new Set(colliding.map(contact => contact.enemy.id));
  s.enemies = s.enemies.filter(enemy => {
    if (destroyedIds.has(enemy.id) || collidedIds.has(enemy.id)) return false;
    if (enemy.y <= s.y) {
      const path = paths.get(enemy.id)!, remainingStep = dt - path.end;
      const side = enemy.x < WIDTH / 2 ? -1 : 1;
      s.passes.push({ ...enemy, x: enemy.x + side * 180 * remainingStep,
        remaining: SPACE_BOMBER_PASS_TIME - remainingStep, side });
      return false;
    }
    return true;
  });
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
    `Mines: ${s.minesPlaced} • Hull: ${s.hull}/3 • Hits: ${s.hits}`,
    s.hull > 0 ? 'Bombing run complete' : 'Hull depleted',
    'GM determines campaign outcome.',
  ].join('\n');
}

// Space Battle / Life Support uses a fixed ship interior. All values are provisional playtest tuning.
export const SPACE_LIFE_PLATFORMS = [
  { x1: 0, x2: WIDTH, y: 520 },
  { x1: 38, x2: 254, y: 410 },
  { x1: 226, x2: 442, y: 300 },
  { x1: 38, x2: 254, y: 190 },
] as const;
export const SPACE_LIFE_MAX_INTEGRITY = 5;
export const SPACE_LIFE_REPAIR_SECONDS = 1.5;
export const SPACE_LIFE_TUNING: Record<Difficulty, { spawnEvery: number; fireLifetime: number; sparkEvery: number; sparkSpeed: number }> = {
  'Very Easy': { spawnEvery: 5.2, fireLifetime: 11, sparkEvery: 3.2, sparkSpeed: 105 },
  Easy: { spawnEvery: 4.5, fireLifetime: 10, sparkEvery: 2.8, sparkSpeed: 125 },
  Medium: { spawnEvery: 3.8, fireLifetime: 9, sparkEvery: 2.4, sparkSpeed: 145 },
  Hard: { spawnEvery: 3.2, fireLifetime: 8, sparkEvery: 2, sparkSpeed: 165 },
};
export type SpaceLifeInput = { x: number; jump: boolean };
export type SpaceLifeFire = { id: number; x: number; y: number; kind: 'ordinary' | 'electrical'; remaining: number; arming?: number; sparkIn?: number; repairProgress?: number };
export type SpaceLifeIcon = { id: number; x: number; y: number; kind: 'heart' | 'overload'; remaining: number };
export type SpaceLifeSpark = { id: number; x: number; y: number; vx: number; remaining: number };
export const SPACE_LIFE_SPARK_RADIUS = 4;
export const SPACE_LIFE_SPARK_WARNING = 0.8;
export const SPACE_LIFE_FIRE_WARNING = 0.6;
export interface SpaceLifeState {
  x: number; y: number; vy: number; grounded: boolean; elapsed: number; integrity: number;
  ordinaryCleared: number; electricalRepaired: number; overloadHits: number; heartsCollected: number;
  firesExpired: number; fireIn: number; iconIn: number; iconIndex: number; nextId: number;
  repairFlashes: { x: number; y: number; remaining: number }[];
  fires: SpaceLifeFire[]; icons: SpaceLifeIcon[]; sparks: SpaceLifeSpark[];
  sparkHits: number; fireContactHits: number; invulnerable: number; finished: boolean;
}
const SPACE_LIFE_FIRE_SITES = [
  { x: 85, y: 520 }, { x: 395, y: 520 },
  { x: 95, y: 410 }, { x: 205, y: 410 },
  { x: 275, y: 300 }, { x: 385, y: 300 },
  { x: 95, y: 190 }, { x: 205, y: 190 },
];
export function createSpaceLifeSupport(): SpaceLifeState {
  return { x: 150, y: 520, vy: 0, grounded: true, elapsed: 0, integrity: SPACE_LIFE_MAX_INTEGRITY,
    ordinaryCleared: 0, electricalRepaired: 0, overloadHits: 0, heartsCollected: 0,
    firesExpired: 0, fireIn: 1.5, iconIn: 0.8, iconIndex: 0, nextId: 1,
    repairFlashes: [], fires: [], icons: [], sparks: [], sparkHits: 0, fireContactHits: 0, invulnerable: 0, finished: false };
}
function spaceLifeSparkContact(x0: number, y0: number, x1: number, y1: number): boolean {
  const r = SPACE_LIFE_SPARK_RADIUS;
  const rectangle = (left: number, top: number, right: number, bottom: number) => {
    let enter = 0, leave = 1;
    for (const [origin, delta, low, high] of [[x0, x1 - x0, left, right], [y0, y1 - y0, top, bottom]]) {
      if (delta === 0) { if (origin < low || origin > high) return false; }
      else {
        const a = (low - origin) / delta, b = (high - origin) / delta;
        enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
        if (enter > leave) return false;
      }
    }
    return true;
  };
  if (rectangle(-10 - r, -27, 10 + r, 0) || rectangle(-10, -27 - r, 10, r)) return true;
  const dx = x1 - x0, dy = y1 - y0, length2 = dx * dx + dy * dy;
  for (const x of [-10, 10]) for (const y of [-27, 0]) {
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / length2));
    if ((x0 + t * dx - x) ** 2 + (y0 + t * dy - y) ** 2 <= r * r) return true;
  }
  return false;
}

export function stepSpaceLifeSupport(
  s: SpaceLifeState, config: FlightConfig, input: SpaceLifeInput, dt: number,
  random: () => number = Math.random,
): void {
  if (s.finished) return;
  dt = Math.min(Math.max(dt, 0), 0.05, DURATION - s.elapsed);
  if (dt <= 0) return;
  for (const flash of s.repairFlashes) flash.remaining -= dt;
  s.repairFlashes = s.repairFlashes.filter(flash => flash.remaining > 0);
  const previousX = s.x, previousFeet = s.y;
  const existingSparks = new Set(s.sparks.map(spark => spark.id));
  const tuning = SPACE_LIFE_TUNING[difficultyFor(config.total)];
  s.elapsed += dt;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.x = Math.max(16, Math.min(WIDTH - 16, s.x + Math.max(-1, Math.min(1, input.x)) * 220 * dt));
  if (input.jump && s.grounded) { s.vy = -540; s.grounded = false; }
  const previousY = s.y;
  s.vy += 1080 * dt;
  const nextY = s.y + s.vy * dt;
  s.grounded = false;
  s.y = nextY;
  if (s.vy >= 0) {
    for (const platform of SPACE_LIFE_PLATFORMS) {
      if (previousY <= platform.y && nextY >= platform.y && s.x >= platform.x1 + 10 && s.x <= platform.x2 - 10) {
        if (!s.grounded || platform.y < s.y) { s.y = platform.y; s.vy = 0; s.grounded = true; }
      }
    }
  }

  // A stomp must descend onto an ordinary flame; touching its side cannot clear it.
  for (const fire of s.fires) {
    if (fire.kind === 'ordinary' && previousY <= fire.y - 8 && nextY >= fire.y - 8 &&
      nextY > previousY && Math.abs(s.x - fire.x) <= 19) {
      fire.remaining = 0; s.ordinaryCleared++;
    }
  }
  if (s.grounded) {
    const panel = s.fires.filter(fire => fire.kind === 'electrical' && fire.remaining > 0 &&
      fire.y === s.y && Math.abs(fire.x - s.x) <= 35)
      .sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x) || a.id - b.id)[0];
    if (panel) {
      // Expiry keeps running; a repair must finish before (or exactly at) its deadline.
      const progress = panel.repairProgress ?? 0;
      const needed = SPACE_LIFE_REPAIR_SECONDS - progress;
      panel.repairProgress = Math.min(SPACE_LIFE_REPAIR_SECONDS, progress + Math.min(dt, panel.remaining));
      if (needed <= Math.min(dt, panel.remaining) + 1e-9) {
        panel.remaining = 0; s.electricalRepaired++;
        s.repairFlashes.push({ x: panel.x, y: panel.y, remaining: 0.4 });
      }
    }
  }
  s.fires = s.fires.filter(fire => fire.remaining > 0);

  s.fireIn -= dt;
  while (s.fireIn <= 0) {
    const first = Math.floor(random() * SPACE_LIFE_FIRE_SITES.length);
    const site = Array.from({ length: SPACE_LIFE_FIRE_SITES.length }, (_, i) => SPACE_LIFE_FIRE_SITES[(first + i) % SPACE_LIFE_FIRE_SITES.length])
      .find(candidate => !s.fires.some(fire => fire.x === candidate.x && fire.y === candidate.y));
    if (site) s.fires.push({ id: s.nextId++, ...site,
      kind: random() < 0.4 ? 'electrical' : 'ordinary', remaining: tuning.fireLifetime,
      arming: SPACE_LIFE_FIRE_WARNING + dt, sparkIn: 1 + dt, repairProgress: 0 });
    s.fireIn += tuning.spawnEvery;
  }
  for (const fire of s.fires) {
    fire.remaining -= dt;
    fire.arming = Math.max(0, (fire.arming ?? 0) - dt);
    if (fire.arming < 1e-9) fire.arming = 0;
    if (fire.remaining <= 0) { s.firesExpired++; s.integrity = Math.max(0, s.integrity - 1); }
  }
  s.fires = s.fires.filter(fire => fire.remaining > 0);
  if (s.integrity <= 0) { s.finished = true; return; }

  // Containment/repair and expiry resolve before contact hazards. Repair cancels a due burst.
  for (const fire of s.fires) {
    if (fire.kind === 'electrical') {
      fire.sparkIn = (fire.sparkIn ?? 1) - dt;
      while (fire.sparkIn <= 1e-9) {
        for (const direction of [-1, 1]) s.sparks.push({ id: s.nextId++,
          x: fire.x + direction * 18, y: fire.y - 14,
          vx: direction * tuning.sparkSpeed, remaining: 4 });
        fire.sparkIn += tuning.sparkEvery;
      }
    }
  }
  const contactDamage = (kind: 'fire' | 'spark' | 'overload') => {
    if (s.invulnerable > 0) return;
    s.integrity = Math.max(0, s.integrity - 1); s.invulnerable = 1.25;
    if (kind === 'fire') s.fireContactHits++;
    else if (kind === 'spark') s.sparkHits++;
    else s.overloadHits++;
    if (s.integrity <= 0) s.finished = true;
  };
  for (const fire of s.fires) {
    if (fire.kind === 'ordinary' && (fire.arming ?? 0) <= 0 &&
      // A descending approach is safe until it reaches the existing stomp plane.
      !(nextY > previousY && previousY <= fire.y - 8 && Math.abs(s.x - fire.x) <= 19) &&
      Math.abs(s.x - fire.x) <= 22 && s.y >= fire.y - 22 && s.y - 27 <= fire.y) {
      contactDamage('fire');
      if (s.finished) return;
    }
  }
  // Relative motion sweeps a circular spark against the crew body, including moving crew.
  for (const spark of s.sparks) {
    const oldX = spark.x;
    const wasPresent = existingSparks.has(spark.id);
    const travelDt = wasPresent ? Math.min(dt, spark.remaining) : 0;
    spark.x += spark.vx * travelDt;
    spark.remaining -= travelDt;
    const crewX = wasPresent ? previousX + (s.x - previousX) * travelDt / dt : s.x;
    const crewFeet = wasPresent ? previousFeet + (s.y - previousFeet) * travelDt / dt : s.y;
    if (spaceLifeSparkContact(oldX - (wasPresent ? previousX : s.x),
      spark.y - (wasPresent ? previousFeet : s.y), spark.x - crewX, spark.y - crewFeet)) {
      spark.remaining = 0; contactDamage('spark');
      if (s.finished) return;
    }
  }
  s.sparks = s.sparks.filter(spark => spark.remaining > 0 &&
    spark.x >= -SPACE_LIFE_SPARK_RADIUS && spark.x <= WIDTH + SPACE_LIFE_SPARK_RADIUS);

  s.iconIn -= dt;
  while (s.iconIn <= 0) {
    const kind = lifeSupportPacketKind(s.iconIndex++, config.naturalOne);
    if (kind !== 'power') {
      const site = SPACE_LIFE_FIRE_SITES[Math.floor(random() * SPACE_LIFE_FIRE_SITES.length)];
      s.icons.push({ id: s.nextId++, x: site.x, y: site.y - 19, kind, remaining: 8 });
    }
    s.iconIn += 5;
  }
  for (const icon of s.icons) {
    icon.remaining -= dt;
    if (Math.abs(s.x - icon.x) <= 19 && Math.abs(s.y - icon.y) <= 28) {
      if (icon.kind === 'heart') {
        s.heartsCollected++; s.integrity = Math.min(SPACE_LIFE_MAX_INTEGRITY, s.integrity + 1);
      } else if (s.invulnerable <= 0) {
        contactDamage('overload');
        if (s.finished) return;
      }
      icon.remaining = 0;
    }
  }
  s.icons = s.icons.filter(icon => icon.remaining > 0);
  s.finished = s.integrity <= 0 || s.elapsed >= DURATION;
}
export function spaceLifeScoreFor(s: SpaceLifeState): number {
  return s.ordinaryCleared * 100 + s.electricalRepaired * 150 + Math.round(s.elapsed * 5) + s.integrity * 100;
}
export function spaceLifeResultText(config: FlightConfig, s: SpaceLifeState): string {
  const points = spaceLifeScoreFor(s);
  return [
    'Galaxy Grown — Space Battle / Life Support',
    `Check total: ${config.total} • Difficulty: ${difficultyFor(config.total)}`,
    `Natural 1: ${config.naturalOne ? 'Yes — one heart and two overload icons per 12 opportunities' : 'No — two hearts and one overload icon per 12 opportunities'}`,
    `Score: ${points} • Time: ${s.elapsed.toFixed(1)}s • Fires stomped: ${s.ordinaryCleared} • Electrical repairs: ${s.electricalRepaired}`,
    ratingReportText('space-life-support', points, s.integrity <= 0),
    `Integrity: ${s.integrity}/${SPACE_LIFE_MAX_INTEGRITY} • Uncontained fires: ${s.firesExpired} • Hearts: ${s.heartsCollected} • Overload hits: ${s.overloadHits} • Spark hits: ${s.sparkHits} • Fire contact hits: ${s.fireContactHits}`,
    s.integrity > 0 ? 'Systems stabilized' : 'Systems failed',
    'GM determines campaign outcome.',
  ].join('\n');
}

// Space Battle Gunner values are provisional; Asteroid Gunner has separate tuning.
export const SPACE_GUNNER_DEFENSE_LINE = 492;
export const SPACE_GUNNER_AIM_SPEED = 225;
export const SPACE_GUNNER_TUNING: Record<Difficulty, {
  speed: number; spawnEvery: number; projectileSpeed: number; armoredChance: number; fireEvery: number;
}> = {
  Hard: { speed: 100, spawnEvery: 1.10, projectileSpeed: 210, armoredChance: 0.25, fireEvery: 0.42 },
  Medium: { speed: 85, spawnEvery: 1.35, projectileSpeed: 180, armoredChance: 0.15, fireEvery: 0.36 },
  Easy: { speed: 70, spawnEvery: 1.65, projectileSpeed: 150, armoredChance: 0.10, fireEvery: 0.32 },
  'Very Easy': { speed: 55, spawnEvery: 2, projectileSpeed: 120, armoredChance: 0, fireEvery: 0.28 },
};
export interface SpaceGunnerInput extends GunnerInput { x: number; y: number }
export interface SpaceGunnerAttacker {
  id: number; x: number; y: number; radius: number; speed: number;
  hp: number; maxHp: number; fired: boolean;
}
export interface SpaceGunnerProjectile {
  id: number; x: number; y: number; radius: number; speed: number;
}
export interface SpaceGunnerState {
  crosshairX: number; crosshairY: number; elapsed: number; hull: number;
  destroyed: number; intercepted: number; shots: number; impacts: number; breached: number;
  cooldown: number; spawnIn: number; grace: number; nextId: number;
  attackers: SpaceGunnerAttacker[]; projectiles: SpaceGunnerProjectile[];
  beamTime: number; beamX: number; beamY: number; impactFlash: number;
  finished: boolean; endReason: 'time' | 'hull' | null;
}
export function createSpaceGunner(): SpaceGunnerState {
  return { crosshairX: 240, crosshairY: 280, elapsed: 0, hull: 3,
    destroyed: 0, intercepted: 0, shots: 0, impacts: 0, breached: 0,
    cooldown: 0, spawnIn: 0.7, grace: 0, nextId: 1, attackers: [], projectiles: [],
    beamTime: 0, beamX: 240, beamY: 280, impactFlash: 0, finished: false, endReason: null };
}
export function spaceGunnerFireEvery(config: FlightConfig): number {
  return SPACE_GUNNER_TUNING[difficultyFor(config.total)].fireEvery * (config.naturalOne ? OVERHEAT_MULTIPLIER : 1);
}
export function stepSpaceGunner(s: SpaceGunnerState, config: FlightConfig,
  input: SpaceGunnerInput, dt: number, random: () => number = Math.random): void {
  if (s.finished) return;
  dt = Math.min(Math.max(dt, 0), 0.05, DURATION - s.elapsed);
  const tuning = SPACE_GUNNER_TUNING[difficultyFor(config.total)];
  s.elapsed += dt;
  s.cooldown = s.cooldown > 0 ? s.cooldown - dt : 0;
  s.grace = Math.max(0, s.grace - dt);
  s.beamTime = Math.max(0, s.beamTime - dt);
  s.impactFlash = Math.max(0, s.impactFlash - dt);
  if (input.aimX !== undefined && input.aimY !== undefined) {
    s.crosshairX = input.aimX; s.crosshairY = input.aimY;
  } else {
    const length = Math.max(1, Math.hypot(input.x, input.y));
    s.crosshairX += input.x / length * SPACE_GUNNER_AIM_SPEED * dt;
    s.crosshairY += input.y / length * SPACE_GUNNER_AIM_SPEED * dt;
  }
  s.crosshairX = Math.max(12, Math.min(468, s.crosshairX));
  s.crosshairY = Math.max(18, Math.min(484, s.crosshairY));
  if (input.firing && s.cooldown <= 0) {
    s.shots++; s.cooldown += spaceGunnerFireEvery(config);
    s.beamTime = 0.09; s.beamX = s.crosshairX; s.beamY = s.crosshairY;
    const candidates = [
      ...s.projectiles.map(entity => ({ entity, projectile: true })),
      ...s.attackers.map(entity => ({ entity, projectile: false })),
    ].map(candidate => ({ ...candidate,
      distance: Math.hypot(candidate.entity.x - s.crosshairX, candidate.entity.y - s.crosshairY),
    })).filter(candidate => candidate.distance <= candidate.entity.radius + 7)
      .sort((a, b) => a.distance - b.distance || Number(b.projectile) - Number(a.projectile) || a.entity.id - b.entity.id);
    const target = candidates[0];
    if (target?.projectile) {
      s.projectiles = s.projectiles.filter(p => p.id !== target.entity.id); s.intercepted++;
    } else if (target) {
      const attacker = target.entity as SpaceGunnerAttacker;
      if (--attacker.hp <= 0) { s.attackers = s.attackers.filter(a => a.id !== attacker.id); s.destroyed++; }
    }
  }
  s.cooldown = Math.max(0, s.cooldown);
  // Existing projectiles move this step; freshly emitted projectiles move next step.
  const existingProjectiles = [...s.projectiles];
  s.spawnIn -= dt;
  while (s.spawnIn <= 0) {
    const x = 20 + random() * 440;
    const hp = random() < tuning.armoredChance ? 2 : 1;
    s.attackers.push({ id: s.nextId++, x, y: -24, radius: 20, speed: tuning.speed, hp, maxHp: hp, fired: false });
    s.spawnIn += tuning.spawnEvery;
  }
  for (const a of s.attackers) {
    a.y += a.speed * dt;
    if (!a.fired && a.y >= 180) {
      a.fired = true;
      s.projectiles.push({ id: s.nextId++, x: a.x, y: a.y + 26, radius: 10, speed: tuning.projectileSpeed });
    }
  }
  for (const p of existingProjectiles) p.y += p.speed * dt;
  const crossing = (e: { y: number; radius: number }) => e.y + e.radius >= SPACE_GUNNER_DEFENSE_LINE;
  const breaches = s.attackers.filter(crossing).length + s.projectiles.filter(crossing).length;
  s.attackers = s.attackers.filter(a => !crossing(a));
  s.projectiles = s.projectiles.filter(p => !crossing(p));
  s.breached += breaches;
  if (breaches && s.grace <= 0) {
    s.hull = Math.max(0, s.hull - 1); s.impacts++; s.grace = 1.25; s.impactFlash = 0.18;
  }
  s.finished = s.hull <= 0 || s.elapsed >= DURATION;
  if (s.finished) s.endReason = s.hull <= 0 ? 'hull' : 'time';
}
export function spaceGunnerScoreFor(s: SpaceGunnerState): number {
  return s.destroyed * 100 + s.intercepted * 25 + Math.round(s.elapsed * 5) + s.hull * 100;
}
export function spaceGunnerResultText(config: FlightConfig, s: SpaceGunnerState): string {
  return [ 'Galaxy Grown — Space Battle / Gunner',
    `Check total: ${config.total} • Difficulty: ${difficultyFor(config.total)}`,
    `Natural 1: ${config.naturalOne ? 'Yes — overheated gun (half normal fire rate)' : 'No'}`,
    `Score: ${spaceGunnerScoreFor(s)} • Time: ${s.elapsed.toFixed(1)}s • Attackers destroyed: ${s.destroyed}`,
    `Projectiles intercepted: ${s.intercepted} • Shots fired: ${s.shots}`,
    ratingReportText('space-gunner', spaceGunnerScoreFor(s), s.hull <= 0),
    `Hull: ${s.hull}/3 • Damaging hits: ${s.impacts} • Breached threats: ${s.breached}`,
    s.endReason === 'hull' ? 'Hull depleted' : 'Defense complete',
    'GM determines campaign outcome.',
  ].join('\n');
}
