export type Difficulty = 'Hard' | 'Medium' | 'Easy' | 'Very Easy';
export type Role = 'Pilot' | 'Gunner' | 'Bomber';
export type Situation = 'Asteroid Field' | 'Space Battle';
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
    `Hull: ${s.hull}/3 • Ship impacts: ${s.impacts}`,
    s.hull > 0 ? 'Field cleared' : 'Hull depleted',
    'Prototype scoring v0.1 — GM determines campaign outcome.',
  ].join('\n');
}

export interface BomberTuning {
  speed: number;
  spawnEvery: number;
  pilotSpeed: number;
  drift: number;
}

// Initial playtest values, not GM-approved balance.
export const BOMBER_TUNING: Record<Difficulty, BomberTuning> = {
  Hard: { speed: 200, spawnEvery: 0.58, pilotSpeed: 225, drift: 0.58 },
  Medium: { speed: 170, spawnEvery: 0.74, pilotSpeed: 225, drift: 0.48 },
  Easy: { speed: 140, spawnEvery: 0.92, pilotSpeed: 225, drift: 0.38 },
  'Very Easy': { speed: 115, spawnEvery: 1.12, pilotSpeed: 225, drift: 0.28 },
};
export const BOMBER_BLAST_RADIUS = 66;
export const BOMBER_IMPAIRMENT_SCALE = Math.SQRT1_2;
export const BOMBER_MINE_COOLDOWN = 0.65;
export const BOMBER_MINE_ARM_TIME = 0.25;
export const BOMBER_MINE_LIFETIME = 5;
export const BOMBER_PLAYER_RADIUS = 13;

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
  x: number;
  y: number;
  placing: boolean;
}
export interface BomberState {
  x: number;
  y: number;
  elapsed: number;
  hull: number;
  impacts: number;
  destroyed: number;
  minesPlaced: number;
  cooldown: number;
  spawnIn: number;
  asteroids: BomberAsteroid[];
  mines: Mine[];
  explosions: Explosion[];
  finished: boolean;
  nextId: number;
  impactFlash: number;
}

export function bomberBlastRadius(config: FlightConfig): number {
  return BOMBER_BLAST_RADIUS * (config.naturalOne ? BOMBER_IMPAIRMENT_SCALE : 1);
}

export function createBomber(): BomberState {
  return {
    x: WIDTH / 2, y: 105, elapsed: 0, hull: 3, impacts: 0, destroyed: 0,
    minesPlaced: 0, cooldown: 0, spawnIn: 0.8, asteroids: [], mines: [],
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
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.impactFlash = Math.max(0, s.impactFlash - dt);
  for (const explosion of s.explosions) explosion.remaining -= dt;
  s.explosions = s.explosions.filter(explosion => explosion.remaining > 0);

  const magnitude = Math.max(1, Math.hypot(input.x, input.y));
  s.x = Math.max(18, Math.min(WIDTH - 18, s.x + input.x / magnitude * tuning.pilotSpeed * dt));
  s.y = Math.max(42, Math.min(HEIGHT * 0.42, s.y + input.y / magnitude * tuning.pilotSpeed * dt));

  if (input.placing && s.cooldown <= 0) {
    s.mines.push({
      id: s.nextId++, x: s.x, y: s.y + 34, blastRadius: bomberBlastRadius(config),
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
    Math.hypot(asteroid.x - s.x, asteroid.y - s.y) < asteroid.radius + BOMBER_PLAYER_RADIUS
    || asteroid.y + asteroid.radius < -10);
  if (impacts.length) {
    s.impacts += impacts.length;
    s.hull = Math.max(0, s.hull - impacts.length);
    s.impactFlash = 0.18;
    const impactedIds = new Set(impacts.map(asteroid => asteroid.id));
    s.asteroids = s.asteroids.filter(asteroid => !impactedIds.has(asteroid.id));
  }
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
    `Hull: ${s.hull}/3 • Asteroid impacts: ${s.impacts}`,
    s.hull > 0 ? 'Field cleared' : 'Hull depleted',
    'Prototype scoring v0.1 — GM determines campaign outcome.',
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
    `Fuel: ${s.fuel.toFixed(1)}s • Hits: ${s.hits} • Hull: ${s.hull}/3`,
    outcome,
    'Prototype scoring v0.1 — GM determines campaign outcome.',
  ].join('\n');
}
