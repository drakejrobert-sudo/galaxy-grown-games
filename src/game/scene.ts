import Phaser from 'phaser';
import {
  createSpaceGunner, stepSpaceGunner, SPACE_GUNNER_DEFENSE_LINE, type SpaceGunnerInput, type SpaceGunnerState, type SpaceGunnerAttacker,
  createBomber, createFlight, createGunner, createLifeSupport, createSpaceBattleBomber, createSpaceBattlePilot, stepBomber,
  stepFlight, stepGunner, stepLifeSupport, stepSpaceBattleBomber, stepSpaceBattlePilot, WIDTH, HEIGHT,
  spaceBomberLanding, mineDropPosition, automaticShipX, bomberBlastRadius, spaceBomberBlastRadius, BOMBER_MINE_COOLDOWN, BOMBER_MINE_LIFETIME, GUNNER_DEFENSE_LINE, type Asteroid, type FlightConfig, type FlightState,
  type BomberInput, type BomberState, type GunnerInput, type GunnerState, type Role, type Situation,
  LIFE_SUPPORT_SWITCH_Y, type LifeSupportInput, type LifeSupportPacket, type LifeSupportRoute,
  type LifeSupportState, type SpaceBattleBomberInput, type SpaceBattleBomberState,
  type SpaceBattlePilotState, type EnemyShip, type EnemyShot, type FuelCell, type SpaceBomberEnemy,
  SPACE_BOMBER_MINE_COOLDOWN, SPACE_BOMBER_MINE_LIFETIME,
  createSpaceLifeSupport, stepSpaceLifeSupport, SPACE_LIFE_PLATFORMS, SPACE_LIFE_SPARK_WARNING, SPACE_LIFE_REPAIR_SECONDS,
  type SpaceLifeInput, type SpaceLifeState, type Mine, type Explosion,
} from './rules';

export class FlightScene extends Phaser.Scene {
  flight = createFlight();
  gunner = createGunner();
  spaceGunner = createSpaceGunner();
  bomber = createBomber();
  lifeSupport = createLifeSupport();
  spacePilot = createSpaceBattlePilot();
  spaceBomber = createSpaceBattleBomber();
  spaceLife = createSpaceLifeSupport();
  activeFlight = false;
  role: Role = 'Pilot';
  situation: Situation = 'Asteroid Field';
  config: FlightConfig = { total: 10, naturalOne: false };
  private graphics!: Phaser.GameObjects.Graphics;
  // Read the live preference without adding listeners or an independent animation clock.
  private reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  private decorativeTime(elapsed: number) {
    return this.reducedMotion?.matches ? 0 : elapsed;
  }
  readInput: (x: number, y: number) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  readSpaceGunnerInput: () => SpaceGunnerInput = () => ({ x: 0, y: 0, firing: false });
  readGunnerInput: () => GunnerInput = () => ({ firing: false });
  readBomberInput: () => BomberInput = () => ({ x: 0, y: 0, placing: false });
  readLifeSupportInput: () => LifeSupportInput = () => ({ route: 'Shields' });
  readSpaceBomberInput: () => SpaceBattleBomberInput = () => ({ placing: false });
  readSpaceLifeInput: () => SpaceLifeInput = () => ({ x: 0, jump: false });
  onFlightStep: (state: FlightState) => void = () => {};
  onSpaceGunnerStep: (state: SpaceGunnerState) => void = () => {};
  onGunnerStep: (state: GunnerState) => void = () => {};
  onBomberStep: (state: BomberState) => void = () => {};
  onLifeSupportStep: (state: LifeSupportState) => void = () => {};
  onSpacePilotStep: (state: SpaceBattlePilotState) => void = () => {};
  onSpaceBomberStep: (state: SpaceBattleBomberState) => void = () => {};
  onSpaceLifeStep: (state: SpaceLifeState) => void = () => {};
  onReady: () => void = () => {};

  create() {
    this.graphics = this.add.graphics();
    this.paint();
    this.onReady();
  }

  begin(config: FlightConfig, situation: Situation = 'Asteroid Field', role: Role = 'Pilot') {
    this.config = config;
    this.situation = situation;
    this.role = role;
    this.flight = createFlight();
    this.gunner = createGunner();
    this.spaceGunner = createSpaceGunner();
    this.bomber = createBomber();
    this.lifeSupport = createLifeSupport();
    this.spacePilot = createSpaceBattlePilot();
    this.spaceBomber = createSpaceBattleBomber();
    this.spaceLife = createSpaceLifeSupport();
    this.activeFlight = true;
  }

  update(_time: number, delta: number) {
    if (!this.graphics) return;
    if (this.activeFlight) {
      if (this.situation === 'Space Battle') {
        if (this.role === 'Life Support') {
          stepSpaceLifeSupport(this.spaceLife, this.config, this.readSpaceLifeInput(), delta / 1000);
          if (this.spaceLife.finished) this.activeFlight = false;
          this.onSpaceLifeStep(this.spaceLife);
        } else if (this.role === 'Gunner') {
          stepSpaceGunner(this.spaceGunner, this.config, this.readSpaceGunnerInput(), delta / 1000);
          if (this.spaceGunner.finished) this.activeFlight = false;
          this.onSpaceGunnerStep(this.spaceGunner);
        } else if (this.role === 'Bomber') {
          stepSpaceBattleBomber(this.spaceBomber, this.config,
            this.readSpaceBomberInput(), delta / 1000);
          if (this.spaceBomber.finished) this.activeFlight = false;
          this.onSpaceBomberStep(this.spaceBomber);
        } else {
          stepSpaceBattlePilot(this.spacePilot, this.config, this.readInput(this.spacePilot.x, this.spacePilot.y), delta / 1000);
          if (this.spacePilot.finished) this.activeFlight = false;
          this.onSpacePilotStep(this.spacePilot);
        }
      } else if (this.role === 'Pilot') {
        stepFlight(this.flight, this.config, this.readInput(this.flight.x, this.flight.y), delta / 1000);
        if (this.flight.finished) this.activeFlight = false;
        this.onFlightStep(this.flight);
      } else if (this.role === 'Gunner') {
        stepGunner(this.gunner, this.config, this.readGunnerInput(), delta / 1000);
        if (this.gunner.finished) this.activeFlight = false;
        this.onGunnerStep(this.gunner);
      } else if (this.role === 'Bomber') {
        stepBomber(this.bomber, this.config, this.readBomberInput(), delta / 1000);
        if (this.bomber.finished) this.activeFlight = false;
        this.onBomberStep(this.bomber);
      } else {
        stepLifeSupport(this.lifeSupport, this.config, this.readLifeSupportInput(), delta / 1000);
        if (this.lifeSupport.finished) this.activeFlight = false;
        this.onLifeSupportStep(this.lifeSupport);
      }
    }
    this.paint();
  }

  private paint() {
    const g = this.graphics;
    g.clear();
    const elapsed = this.situation === 'Space Battle'
      ? this.role === 'Life Support' ? this.spaceLife.elapsed : this.role === 'Bomber' ? this.spaceBomber.elapsed : this.role === 'Gunner' ? this.spaceGunner.elapsed : this.spacePilot.elapsed
      : this.role === 'Pilot' ? this.flight.elapsed
        : this.role === 'Gunner' ? this.gunner.elapsed
          : this.role === 'Bomber' ? this.bomber.elapsed : this.lifeSupport.elapsed;
    this.paintBackground(g, this.role === 'Pilot' || this.role === 'Bomber' ? this.decorativeTime(elapsed) : elapsed);
    if (this.situation === 'Space Battle') {
      if (this.role === 'Life Support') this.paintSpaceLifeMode(g);
      else if (this.role === 'Gunner') this.paintSpaceGunnerMode(g);
      else if (this.role === 'Bomber') this.paintSpaceBattleBomberMode(g);
      else this.paintSpaceBattlePilotMode(g);
    }
    else if (this.role === 'Pilot') this.paintPilotMode(g);
    else if (this.role === 'Gunner') this.paintGunnerMode(g);
    else if (this.role === 'Bomber') this.paintBomberMode(g);
    else this.paintLifeSupportMode(g);
    this.paintFrame(g);
  }

  private paintFrame(g: Phaser.GameObjects.Graphics) {
    // Shared edge hardware stays outside the action and makes each station feel related.
    for (const x of [8, WIDTH - 8]) {
      const inward = x < WIDTH / 2 ? 1 : -1;
      for (const y of [8, HEIGHT - 8]) {
        const vertical = y < HEIGHT / 2 ? 1 : -1;
        g.lineStyle(2, 0x8facc7, 0.75);
        g.lineBetween(x, y, x + inward * 22, y);
        g.lineBetween(x, y, x, y + vertical * 22);
        g.fillStyle(0x79e1ce, 0.85); g.fillCircle(x + inward * 5, y + vertical * 5, 1.5);
      }
    }
  }

  private paintBackground(g: Phaser.GameObjects.Graphics, elapsed: number) {
    g.fillStyle(0x101528); g.fillRect(0, 0, WIDTH, HEIGHT);
    for (let i = 8; i > 0; i--) {
      g.fillStyle(0x47366b, 0.025); g.fillEllipse(90, 180, i * 60, i * 90);
      g.fillStyle(0x16546b, 0.025); g.fillEllipse(420, 430, i * 55, i * 70);
    }
    g.fillStyle(0x26364f); g.fillCircle(385, 100, 43);
    g.fillStyle(0x172338); g.fillCircle(397, 94, 38);
    g.lineStyle(1, 0x60839d, 0.25); g.strokeCircle(385, 100, 45);
    const automaticFlight = this.role === 'Bomber' || this.role === 'Gunner';
    for (let i = 0; i < 100; i++) {
      const x = (i * 137.5) % WIDTH;
      const speed = automaticFlight ? 110 + i % 3 * 45 : 12 + i % 3 * 8;
      const y = ((i * 79.3) + elapsed * speed) % HEIGHT;
      if (automaticFlight && i % 3 === 0) {
        g.lineStyle(1, 0x8ab9dc, 0.25); g.lineBetween(x, y, x, y - 9);
      }
      g.fillStyle(i % 3 ? 0x607999 : 0xc8e5ff, 0.8); g.fillCircle(x, y, i % 3 ? 1 : 1.6);
    }
    g.lineStyle(1, 0x344563); g.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);
  }

  private paintAsteroid(g: Phaser.GameObjects.Graphics, asteroid: Asteroid, armored = false, damaged = false, travelDirection = 1) {
    g.lineStyle(asteroid.radius * 0.65, armored ? 0xc0785b : 0x95b6d0, 0.07);
    g.lineBetween(asteroid.x, asteroid.y, asteroid.x - (asteroid.vx ?? 0) * 0.18, asteroid.y - asteroid.speed * travelDirection * 0.18);
    g.fillStyle(armored ? 0x8e685f : 0x897c88);
    g.lineStyle(armored ? 3 : 2, damaged ? 0xffbc74 : armored ? 0xe6a87d : 0xc5b4ad);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5 + (asteroid.rotation ?? 0);
      const radius = asteroid.radius * (i % 2 ? 0.85 : 1);
      const x = asteroid.x + Math.cos(angle) * radius;
      const y = asteroid.y + Math.sin(angle) * radius;
      if (!i) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fillPath(); g.strokePath();
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.1 + (asteroid.rotation ?? 0);
      const x = asteroid.x + Math.cos(angle) * asteroid.radius * 0.42;
      const y = asteroid.y + Math.sin(angle) * asteroid.radius * 0.42;
      g.fillStyle(0x514b60); g.fillCircle(x, y, asteroid.radius * (0.17 + i * 0.025));
      g.lineStyle(1, 0xb0a0a2, 0.7); g.strokeCircle(x - 1, y - 1, asteroid.radius * (0.17 + i * 0.025));
    }
    if (this.role === 'Pilot' || this.role === 'Bomber') {
      // Surface facets remain inside the existing rock outline; no new armor meaning.
      const r = asteroid.radius;
      g.fillStyle(0xc5b4ad, 0.19);
      g.fillTriangle(asteroid.x - r * .75, asteroid.y - r * .3,
        asteroid.x - r * .15, asteroid.y - r * .72, asteroid.x + r * .25, asteroid.y - r * .18);
      g.fillStyle(0x302d45, 0.28);
      g.fillTriangle(asteroid.x + r * .7, asteroid.y - r * .2,
        asteroid.x + r * .6, asteroid.y + r * .6, asteroid.x - r * .2, asteroid.y + r * .55);
      g.lineStyle(1, 0x38364c, .65);
      g.lineBetween(asteroid.x + r * .3, asteroid.y - r * .55, asteroid.x + r * .15, asteroid.y - r * .1);
      g.lineBetween(asteroid.x + r * .15, asteroid.y - r * .1, asteroid.x + r * .45, asteroid.y + r * .2);
    }
    g.lineStyle(1, 0xd6c7b9, 0.6);
    g.lineBetween(asteroid.x - asteroid.radius * 0.6, asteroid.y - asteroid.radius * 0.4,
      asteroid.x - asteroid.radius * 0.2, asteroid.y - asteroid.radius * 0.7);
  }

  private paintPilotMode(g: Phaser.GameObjects.Graphics) {
    const s = this.flight;
    for (const asteroid of s.asteroids) {
      const waitingAtLeft = asteroid.side === 'left' && asteroid.x + asteroid.radius < 0;
      const waitingAtRight = asteroid.side === 'right' && asteroid.x - asteroid.radius > WIDTH;
      if (waitingAtLeft || waitingAtRight) {
        const warningX = waitingAtLeft ? 12 : WIDTH - 12;
        const direction = waitingAtLeft ? 1 : -1;
        const warningY = Math.max(18, Math.min(HEIGHT - 18, asteroid.y));
        const pulse = 0.75 + Math.sin(this.decorativeTime(s.elapsed) * 16) * 0.15;
        g.fillStyle(0x101528, .95);
        g.fillRoundedRect(waitingAtLeft ? 6 : WIDTH - 31, warningY - 19, 25, 38, 4);
        g.lineStyle(1, 0xffc66d, .65);
        g.strokeRoundedRect(waitingAtLeft ? 6 : WIDTH - 31, warningY - 19, 25, 38, 4);
        g.fillStyle(0xffc66d, pulse);
        g.fillTriangle(warningX, warningY, warningX + direction * 14, warningY - 9,
          warningX + direction * 14, warningY + 9);
        g.lineStyle(2, 0xffe1a3, pulse);
        g.lineBetween(warningX, warningY - 14, warningX, warningY + 14);
      }
      this.paintAsteroid(g, asteroid);
    }
    if (s.invulnerable) this.paintProtection(g, s.x, s.y, 26, s.elapsed);
    if (s.invulnerable && !this.reducedMotion?.matches && Math.floor(s.elapsed * 10) % 2 === 0) return;
    this.paintPlayerShip(g, s.x, s.y, s.elapsed);
  }

  private paintPlayerShip(g: Phaser.GameObjects.Graphics, x: number, y: number, elapsed: number, impairedEngine = this.config.naturalOne) {
    const flame = impairedEngine ? 0xffac64 : 0x71e4f5;
    const detailed = this.role === 'Pilot' || this.role === 'Bomber';
    const time = detailed ? this.decorativeTime(elapsed) : elapsed;
    const pulse = 5 + Math.sin(time * 40) * 3;
    for (const dx of [-8, 8]) {
      g.fillStyle(flame, 0.12); g.fillEllipse(x + dx, y + 22, 15, 30 + pulse);
      g.fillStyle(flame); g.fillTriangle(x + dx - 3, y + 10, x + dx + 3, y + 10, x + dx, y + 25 + pulse);
      g.fillStyle(0xf4fbff); g.fillTriangle(x + dx - 1.5, y + 11, x + dx + 1.5, y + 11, x + dx, y + 21);
    }
    g.fillStyle(0x687c9c); g.lineStyle(1, 0xa8c5df);
    g.fillTriangle(x, y - 9, x - 17, y + 14, x + 17, y + 14);
    g.strokeTriangle(x, y - 9, x - 17, y + 14, x + 17, y + 14);
    g.fillStyle(0xdde7ee); g.fillTriangle(x, y - 19, x - 8, y + 12, x + 8, y + 12);
    g.fillStyle(0x7e94b5); g.fillTriangle(x, y - 19, x, y + 12, x + 8, y + 12);
    g.fillStyle(0x62dcec); g.fillEllipse(x, y - 3, 7, 13);
    g.lineStyle(1, 0xe8ffff); g.lineBetween(x - 1, y - 8, x - 2, y - 2);
    g.fillStyle(0xff9a9f); g.fillCircle(x - 13, y + 11, 1.5);
    g.fillStyle(0x8cffe0); g.fillCircle(x + 13, y + 11, 1.5);
    if (detailed) {
      // Inset wing plating, vented engine housings and cockpit bezel.
      for (const side of [-1, 1]) {
        g.fillStyle(0x33465f); g.lineStyle(1, 0xa8c5df, .8);
        g.fillRoundedRect(x + side * 9 - 3, y + 5, 6, 11, 2);
        g.strokeRoundedRect(x + side * 9 - 3, y + 5, 6, 11, 2);
        for (let vent = 0; vent < 3; vent++) {
          g.lineStyle(1, 0x101528); g.lineBetween(x + side * 9 - 2, y + 8 + vent * 2, x + side * 9 + 2, y + 8 + vent * 2);
        }
        g.lineStyle(1, 0xdde7ee, .7);
        g.lineBetween(x + side * 6, y + 1, x + side * 13, y + 10);
        g.fillStyle(0x79e1ce, .75); g.fillCircle(x + side * 5, y + 7, 1);
      }
      g.lineStyle(1, 0x20344c); g.strokeEllipse(x, y - 3, 9, 15);
      g.fillStyle(0xc5ffff, .8); g.fillEllipse(x - 1, y - 6, 2, 5);
      g.lineStyle(1, 0x526984); g.lineBetween(x, y - 17, x, y - 12);
    }
  }

  private paintSpaceBattlePilotMode(g: Phaser.GameObjects.Graphics) {
    const s = this.spacePilot;
    if (s.impactFlash) { g.fillStyle(0xff715b, 0.14); g.fillRect(9, 9, WIDTH - 18, HEIGHT - 18); }
    for (const cell of s.fuelCells) this.paintFuelCell(g, cell, s.elapsed);
    for (const enemy of s.enemies) this.paintEnemyShip(g, enemy, s.elapsed);
    for (const shot of s.shots) this.paintEnemyShot(g, shot, s.elapsed);
    if (s.invulnerable) this.paintProtection(g, s.x, s.y, 26, s.elapsed);
    if (!s.invulnerable || this.reducedMotion?.matches || Math.floor(s.elapsed * 10) % 2 !== 0) this.paintPlayerShip(g, s.x, s.y, s.elapsed);
  }

  private paintSpaceBattleBomberMode(g: Phaser.GameObjects.Graphics) {
    const s = this.spaceBomber;
    const rack = mineDropPosition(s), landing = spaceBomberLanding(s);
    g.lineStyle(2, 0xffca83, .65); g.lineBetween(rack.x, rack.y, landing.x, landing.y);
    this.paintWeaponTarget(g, landing.x, landing.y, spaceBomberBlastRadius(this.config), 0xffca83, s.mineCooldown <= 0);
    if (s.impactFlash) { g.fillStyle(0xff715b, 0.14); g.fillRect(9, 9, WIDTH - 18, HEIGHT - 18); }
    for (const explosion of s.explosions) this.paintMineExplosion(g, explosion);
    for (const mine of s.mines) this.paintMine(g, mine, s.elapsed, SPACE_BOMBER_MINE_LIFETIME, !!mine.flight);
    for (const enemy of s.enemies) {
      this.paintEnemyShip(g, enemy, s.elapsed, -1);
      this.paintBomberApproachMarker(g, enemy);
    }
    for (const pass of s.passes) {
      // Cool fading outlines distinguish harmless peel-away ships from active red pursuers.
      g.lineStyle(2, 0x79e1ce, pass.remaining / .3);
      g.strokeTriangle(pass.x, pass.y - 18, pass.x - 20, pass.y + 12, pass.x + 20, pass.y + 12);
    }
    if (s.invulnerable) this.paintProtection(g, s.x, s.y, 30, s.elapsed);
    if (!s.invulnerable || this.reducedMotion?.matches || Math.floor(s.elapsed * 10) % 2 !== 0) {
      this.paintPlayerShip(g, s.x, s.y, s.elapsed, false);
      // Amber aft racks show mine readiness.
      for (const dx of [-15, 15]) {
        g.fillStyle(0x31435f); g.lineStyle(1, 0xa9bbcf); g.fillRoundedRect(s.x + dx - 3, s.y - 12, 6, 13, 2);
        g.strokeRoundedRect(s.x + dx - 3, s.y - 12, 6, 13, 2);
        g.fillStyle(0x33435e); g.lineStyle(1, 0xa9bbcf, .8);
        g.fillRoundedRect(s.x + dx - 4, s.y + 5, 8, 13, 2);
        g.strokeRoundedRect(s.x + dx - 4, s.y + 5, 8, 13, 2);
        g.fillStyle(s.mineCooldown <= 0 ? 0xffca83 : 0x665a76); g.fillCircle(s.x + dx, s.y + 12, 2);
      }
    }
    if (s.mineCooldown > 0) {
      g.lineStyle(2, 0xffca83, 0.75); g.beginPath();
      g.arc(s.x, s.y, 29, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - s.mineCooldown / SPACE_BOMBER_MINE_COOLDOWN)); g.strokePath();
    }
  }

  private paintBomberApproachMarker(g: Phaser.GameObjects.Graphics, enemy: SpaceBomberEnemy) {
    if (enemy.warningRemaining <= 0) return;
    const y = HEIGHT - 16;
    g.fillStyle(0x101528, .9); g.fillRoundedRect(enemy.x - 10, y - 10, 20, 20, 4);
    g.lineStyle(2, 0xffbd6b, .9); g.strokeRoundedRect(enemy.x - 10, y - 10, 20, 20, 4);
    g.fillStyle(0xffbd6b); g.fillTriangle(enemy.x, y - 6, enemy.x - 6, y + 4, enemy.x + 6, y + 4);
  }

  private paintFuelCell(g: Phaser.GameObjects.Graphics, cell: FuelCell, elapsed: number) {
    const x = cell.x;
    const time = this.decorativeTime(elapsed);
    const y = cell.y;
    const pulse = 0.72 + Math.sin(time * 8 + cell.id) * 0.18;
    g.fillStyle(0x79e1ce, 0.06); g.fillCircle(x, y, cell.radius + 12);
    g.fillStyle(0x79e1ce, 0.12); g.fillCircle(x, y, cell.radius + 7);
    g.lineStyle(1, 0x9cffe9, pulse * 0.55); g.strokeCircle(x, y, cell.radius + 5);

    // Dark docking brackets separate the collectible from bright trails without moving its center.
    g.lineStyle(3, 0x101528, .95); g.strokeCircle(x, y, cell.radius + 5);
    g.lineStyle(2, 0x79e1ce, .9);
    for (const side of [-1, 1]) {
      g.lineBetween(x + side * 17, y - 9, x + side * 17, y + 9);
      g.lineBetween(x + side * 17, y - 9, x + side * 13, y - 9);
      g.lineBetween(x + side * 17, y + 9, x + side * 13, y + 9);
    }
    // Side fins and metal end caps give the pickup a readable canister silhouette.
    g.fillStyle(0x43627a); g.lineStyle(1, 0xa7c7d7, 0.8);
    g.fillTriangle(x - 7, y - 7, x - 12, y - 3, x - 7, y + 1);
    g.strokeTriangle(x - 7, y - 7, x - 12, y - 3, x - 7, y + 1);
    g.fillTriangle(x + 7, y - 7, x + 12, y - 3, x + 7, y + 1);
    g.strokeTriangle(x + 7, y - 7, x + 12, y - 3, x + 7, y + 1);
    g.fillStyle(0x293b52);
    g.fillRoundedRect(x - 8, y - 12, 16, 24, 4);
    g.lineStyle(2, 0xb9d9e3, 0.95); g.strokeRoundedRect(x - 8, y - 12, 16, 24, 4);
    g.fillStyle(0x6f8797); g.fillRoundedRect(x - 9, y - 12, 18, 5, 2);
    g.fillRoundedRect(x - 9, y + 7, 18, 5, 2);
    g.lineStyle(1, 0xe5f8ff, 0.8);
    g.lineBetween(x - 6, y - 8, x + 6, y - 8);
    g.lineBetween(x - 6, y + 8, x + 6, y + 8);

    // The bright central gauge stays distinct from coral enemy hazards.
    g.fillStyle(0x102f3c); g.fillRoundedRect(x - 5, y - 6, 10, 12, 2);
    g.fillStyle(0x79e1ce, pulse); g.fillRoundedRect(x - 3, y - 4, 6, 8, 1);
    g.fillStyle(0xdffff6, 0.9); g.fillRect(x - 2, y - 3, 2, 5);
    g.fillTriangle(x, y - 1, x + 3, y - 1, x, y + 4);
    g.fillStyle(0xffffff, pulse); g.fillCircle(x - 2, y - 3, 1);
  }

  private paintEnemyShip(g: Phaser.GameObjects.Graphics, enemy: Pick<EnemyShip, 'id' | 'x' | 'y'>, elapsed: number, direction: 1 | -1 = 1) {
    const x = enemy.x;
    const y = enemy.y;
    const fy = (offset: number) => y + offset * direction;
    const enginePulse = 3 + Math.sin(this.decorativeTime(elapsed) * 28 + enemy.id) * 2;

    // Mirror the craft and its exhaust when a Bomber pursuer travels upward.
    for (const dx of [-8, 8]) {
      g.fillStyle(0xff596f, 0.10); g.fillEllipse(x + dx, fy(-19), 11, 24 + enginePulse);
      g.fillStyle(0xff6575, 0.8); g.fillTriangle(x + dx - 3, fy(-10), x + dx + 3, fy(-10), x + dx, fy(-20 - enginePulse));
      g.fillStyle(0xffd0a8, 0.95); g.fillTriangle(x + dx - 1.5, fy(-10), x + dx + 1.5, fy(-10), x + dx, fy(-16 - enginePulse));
    }
    g.fillStyle(0xff6575, 0.07); g.fillEllipse(x, y, 54, 42);

    // Swept wings, armored centerline, and panel seams create a compact fighter.
    g.fillStyle(0x4b3049); g.lineStyle(2, 0xe36f7f, 0.9);
    g.beginPath();
    g.moveTo(x, fy(18));
    g.lineTo(x - 8, fy(5));
    g.lineTo(x - 22, fy(9));
    g.lineTo(x - 16, fy(-10));
    g.lineTo(x - 6, fy(-7));
    g.lineTo(x, fy(-15));
    g.lineTo(x + 6, fy(-7));
    g.lineTo(x + 16, fy(-10));
    g.lineTo(x + 22, fy(9));
    g.lineTo(x + 8, fy(5));
    g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0x7a4658); g.fillTriangle(x, fy(15), x - 7, fy(-7), x + 7, fy(-7));
    g.lineStyle(1, 0xffa2a9, 0.65);
    g.lineBetween(x - 17, fy(6), x - 7, fy(1));
    g.lineBetween(x + 17, fy(6), x + 7, fy(1));
    g.lineBetween(x, fy(13), x, fy(3));
    g.fillStyle(0x201d34); g.lineStyle(1, 0xffd2b2, 0.9);
    g.fillEllipse(x, fy(-1), 8, 13); g.strokeEllipse(x, fy(-1), 8, 13);
    g.fillStyle(0xffa85f, 0.9); g.fillEllipse(x, fy(1), 4, 7);
    g.fillStyle(0xff6575); g.fillCircle(x - 17, fy(7), 1.8); g.fillCircle(x + 17, fy(7), 1.8);
    g.fillStyle(0xffd66f, 0.9); g.fillCircle(x, fy(13), 1.5);
    for (const side of [-1, 1]) {
      g.fillStyle(0x302739); g.lineStyle(1, 0xe36f7f, .8);
      g.fillRoundedRect(x + side * 13 - 3, y - 6, 6, 9, 2);
      g.strokeRoundedRect(x + side * 13 - 3, y - 6, 6, 9, 2);
      g.lineStyle(1, 0xffb4ba, .6);
      g.lineBetween(x + side * 10, fy(-6), x + side * 15, fy(-4));
      g.fillStyle(0xffd2b2, .6); g.fillCircle(x + side * 18, fy(4), 1);
    }
    g.lineStyle(1, 0xffd2b2, .8); g.lineBetween(x - 1, fy(-4), x - 1, fy(1));
  }

  private paintEnemyShot(g: Phaser.GameObjects.Graphics, shot: EnemyShot, elapsed: number) {
    const speed = Math.max(1, Math.hypot(shot.vx, shot.vy));
    const ux = shot.vx / speed;
    const uy = shot.vy / speed;
    const px = -uy;
    const py = ux;
    const pulse = 0.82 + Math.sin(this.decorativeTime(elapsed) * 32 + shot.x * 0.03) * 0.12;
    const tailX = shot.x - ux * 20;
    const tailY = shot.y - uy * 20;
    g.fillStyle(0x101528, .85); g.fillCircle(shot.x, shot.y, 8);
    g.lineStyle(10, 0xff294d, 0.08); g.lineBetween(tailX, tailY, shot.x, shot.y);
    g.lineStyle(5, 0xff4968, 0.22); g.lineBetween(tailX + ux * 5, tailY + uy * 5, shot.x, shot.y);
    g.lineStyle(2, 0xffc7b8, pulse); g.lineBetween(tailX + ux * 8, tailY + uy * 8, shot.x + ux * 4, shot.y + uy * 4);
    g.fillStyle(0xff6f83, pulse); g.lineStyle(1, 0xffe5d1, 0.95);
    g.beginPath();
    g.moveTo(shot.x + ux * 7, shot.y + uy * 7);
    g.lineTo(shot.x + px * 4, shot.y + py * 4);
    g.lineTo(shot.x - ux * 6, shot.y - uy * 6);
    g.lineTo(shot.x - px * 4, shot.y - py * 4);
    g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0xffffff, 0.95); g.fillCircle(shot.x + ux * 2, shot.y + uy * 2, 1.8);
  }

  private paintGunnerMode(g: Phaser.GameObjects.Graphics) {
    const s = this.gunner;
    g.fillStyle(s.impactFlash ? 0xff715b : 0x79e1ce, s.impactFlash ? 0.18 : 0.08);
    g.fillRect(9, GUNNER_DEFENSE_LINE, WIDTH - 18, HEIGHT - GUNNER_DEFENSE_LINE - 9);
    g.lineStyle(2, s.impactFlash ? 0xff9b83 : 0x79e1ce, 0.65);
    g.lineBetween(10, GUNNER_DEFENSE_LINE, WIDTH - 10, GUNNER_DEFENSE_LINE);
    for (const asteroid of s.asteroids) {
      this.paintAsteroid(g, asteroid, asteroid.maxHp > 1, asteroid.hp < asteroid.maxHp);
      if (asteroid.maxHp > 1) {
        g.fillStyle(asteroid.hp > 1 ? 0xffc270 : 0xff715b);
        for (let hp = 0; hp < asteroid.hp; hp++) g.fillCircle(asteroid.x - 4 + hp * 8, asteroid.y - asteroid.radius - 7, 2.5);
      }
    }
    this.paintGunnerTurret(g, s);
  }

  private paintSpaceGunnerMode(g: Phaser.GameObjects.Graphics) {
    const s = this.spaceGunner;
    g.fillStyle(s.impactFlash ? 0xff715b : 0x79e1ce, s.impactFlash ? 0.2 : 0.08);
    g.fillRect(9, SPACE_GUNNER_DEFENSE_LINE, WIDTH - 18, HEIGHT - SPACE_GUNNER_DEFENSE_LINE - 9);
    g.lineStyle(s.grace > 0 ? 4 : 2, s.grace > 0 ? 0x79d9ff : 0x79e1ce, 0.85);
    g.lineBetween(10, SPACE_GUNNER_DEFENSE_LINE, WIDTH - 10, SPACE_GUNNER_DEFENSE_LINE);
    for (const attacker of s.attackers) this.paintSpaceGunnerAttacker(g, attacker, s.elapsed);
    for (const p of s.projectiles) {
      // Keep the original diamond footprint; the faint trail is decoration, not a target.
      g.lineStyle(9, 0xff637d, 0.08); g.lineBetween(p.x, p.y - 30, p.x, p.y - 8);
      g.lineStyle(3, 0xff829c, 0.5); g.lineBetween(p.x, p.y - 25, p.x, p.y - 8);
      g.lineStyle(1, 0xffe5d1, 0.7); g.lineBetween(p.x, p.y - 17, p.x, p.y - 8);
      g.fillStyle(0xff637d); g.lineStyle(2, 0xffe5d1);
      g.beginPath(); g.moveTo(p.x, p.y + 10); g.lineTo(p.x - 9, p.y);
      g.lineTo(p.x, p.y - 10); g.lineTo(p.x + 9, p.y); g.closePath();
      g.fillPath(); g.strokePath();
      g.fillStyle(0xffb2be); g.fillTriangle(p.x, p.y - 6, p.x - 4, p.y, p.x, p.y + 6);
      g.fillStyle(0xffffff); g.fillCircle(p.x, p.y, 2);
    }
    if (s.grace > 0) {
      g.lineStyle(3, 0x79d9ff, 0.7); g.strokeCircle(automaticShipX(s.elapsed), HEIGHT - 44, 40);
    }
    this.paintGunnerTurret(g, s);
  }

  private paintSpaceGunnerAttacker(g: Phaser.GameObjects.Graphics, a: SpaceGunnerAttacker, elapsed: number) {
    const armored = a.maxHp > 1;
    const edge = armored ? 0xffca83 : 0xff829c;
    const time = this.decorativeTime(elapsed);
    g.save(); g.translateCanvas(a.x, a.y);
    for (const side of [-1, 1]) {
      const x = side * 10;
      const flame = 6 + Math.sin(time * 18 + a.id) * 2;
      g.fillStyle(0xff637d, 0.1); g.fillEllipse(x, -19, 8, 15);
      g.fillStyle(0xff829c, 0.8); g.fillTriangle(x - 2, -14, x + 2, -14, x, -20 - flame);
      g.fillStyle(0xffe5d1); g.fillTriangle(x - 1, -14, x + 1, -14, x, -20);
    }
    // Swept wings, inset fuselage and metallic bevels stay within the old silhouette's scale.
    g.fillStyle(armored ? 0x584351 : 0x40334d); g.lineStyle(2, edge);
    g.beginPath(); g.moveTo(0, 20); g.lineTo(-7, 7); g.lineTo(-18, 2);
    g.lineTo(-17, -16); g.lineTo(-7, -10); g.lineTo(0, -14);
    g.lineTo(7, -10); g.lineTo(17, -16); g.lineTo(18, 2); g.lineTo(7, 7);
    g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0x755064); g.fillTriangle(0, 18, -7, -7, 7, -7);
    g.lineStyle(1, 0xffb9c3, 0.7); g.lineBetween(-14, -12, -14, 0); g.lineBetween(14, -12, 14, 0);
    g.lineStyle(1, 0x1c2037); g.lineBetween(-8, -4, -15, -4); g.lineBetween(8, -4, 15, -4);
    g.fillStyle(0x172539); g.lineStyle(1, 0x9fb9ee);
    g.fillRoundedRect(-4, -6, 8, 13, 3); g.strokeRoundedRect(-4, -6, 8, 13, 3);
    g.fillStyle(0x9fb9ee, 0.75); g.fillRect(-2, -4, 2, 7);
    if (armored) {
      g.fillStyle(0x9b7757); g.lineStyle(1, 0xffca83, 0.85);
      for (const side of [-1, 1]) {
        g.fillRoundedRect(side * 13 - 5, -11, 10, 13, 2);
        g.strokeRoundedRect(side * 13 - 5, -11, 10, 13, 2);
        g.lineStyle(1, 0x514257); g.lineBetween(side * 13 - 3, -6, side * 13 + 3, -6);
        g.lineStyle(1, 0xffca83, 0.85);
      }
      if (a.hp < a.maxHp) {
        g.lineStyle(2, 0x24243b); g.lineBetween(-15, -10, -10, -5); g.lineBetween(-10, -5, -15, 0);
      }
      // All armor pips describe actual remaining HP, including a partially damaged ship.
      for (let hp = 0; hp < a.hp; hp++) {
        g.fillStyle(0x101528); g.fillCircle(-4 + hp * 8, -27, 4.5);
        g.fillStyle(0xffca83); g.fillCircle(-4 + hp * 8, -27, 3);
      }
    }
    g.fillStyle(edge); g.fillCircle(-15, 1, 1.5); g.fillCircle(15, 1, 1.5);
    if (!a.fired && a.y >= 140) {
      // Keep the same warning gate and position; backing separates it from the ship and stars.
      g.fillStyle(0x101528, 0.9); g.fillCircle(0, 22, 9);
      g.lineStyle(2, 0xffca83, 0.95); g.strokeCircle(0, 22, 7);
      g.lineBetween(0, 32, 0, 50); g.lineBetween(-4, 46, 0, 50); g.lineBetween(4, 46, 0, 50);
    }
    g.restore();
  }

  private paintGunnerTurret(g: Phaser.GameObjects.Graphics, s: GunnerState | SpaceGunnerState) {
    const turretX = automaticShipX(s.elapsed), turretY = HEIGHT - 44;
    // A larger armored weapon deck, exposed engines and service lights.
    g.save(); g.translateCanvas(turretX, turretY); g.scaleCanvas(1.65, 1.25);
    this.paintPlayerShip(g, 0, 0, s.elapsed, false); g.restore();
    for (const side of [-1, 1]) {
      const x = turretX + side * 32;
      g.fillStyle(0x26384f); g.lineStyle(1, 0x91b7d5, 0.9);
      g.fillRoundedRect(x - 7, turretY - 11, 14, 31, 4);
      g.strokeRoundedRect(x - 7, turretY - 11, 14, 31, 4);
      for (let vent = 0; vent < 3; vent++) {
        g.lineStyle(2, 0x101b30); g.lineBetween(x - 4, turretY + vent * 5, x + 4, turretY + vent * 5);
      }
      g.fillStyle(0x79e1ce, 0.8); g.fillCircle(x, turretY - 6, 2);
      const flame = 12 + Math.sin(s.elapsed * 35) * 4;
      g.fillStyle(0x71e4f5, 0.22); g.fillTriangle(x - 6, turretY + 20, x + 6, turretY + 20, x, turretY + 20 + flame);
      g.fillStyle(0xe4ffff); g.fillTriangle(x - 2, turretY + 20, x + 2, turretY + 20, x, turretY + 27);
    }
    const angle = Math.atan2(s.crosshairY - turretY, s.crosshairX - turretX);
    const muzzleX = turretX + Math.cos(angle) * 30;
    const muzzleY = turretY + Math.sin(angle) * 30;
    if (s.beamTime > 0) {
      g.lineStyle(8, 0x79e1ce, 0.10); g.lineBetween(muzzleX, muzzleY, s.beamX, s.beamY);
      g.lineStyle(2, 0xd9fff6, 0.9); g.lineBetween(muzzleX, muzzleY, s.beamX, s.beamY);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(s.beamX, s.beamY, 5);
    }
    g.fillStyle(0x26364f); g.lineStyle(2, 0x8facc7);
    g.fillCircle(turretX, turretY, 17); g.strokeCircle(turretX, turretY, 17);
    g.lineStyle(1, 0x506b88); g.strokeCircle(turretX, turretY, 12);
    // Twin barrels rotate with the aim, with visible recoil and cooling bands.
    const recoil = s.beamTime > 0 ? 3 : 0;
    const color = this.config.naturalOne ? 0xffac64 : 0x91b7d5;
    for (const side of [-1, 1]) {
      const ox = -Math.sin(angle) * side * 5, oy = Math.cos(angle) * side * 5;
      g.lineStyle(5, color);
      g.lineBetween(turretX + ox, turretY + oy,
        turretX + ox + Math.cos(angle) * (30 - recoil), turretY + oy + Math.sin(angle) * (30 - recoil));
      for (const length of [14, 20]) {
        const x = turretX + ox + Math.cos(angle) * length;
        const y = turretY + oy + Math.sin(angle) * length;
        g.lineStyle(2, 0x354c65);
        g.lineBetween(x - Math.sin(angle) * 3, y + Math.cos(angle) * 3,
          x + Math.sin(angle) * 3, y - Math.cos(angle) * 3);
      }
    }
    if (s.beamTime > 0) {
      g.fillStyle(0xd9fff6, 0.7); g.fillCircle(muzzleX, muzzleY, 6);
      g.lineStyle(2, 0xffca83, 0.8);
      for (let spark = 0; spark < 6; spark++) {
        const direction = spark * Math.PI / 3 + s.elapsed;
        g.lineBetween(s.beamX + Math.cos(direction) * 8, s.beamY + Math.sin(direction) * 8,
          s.beamX + Math.cos(direction) * 16, s.beamY + Math.sin(direction) * 16);
      }
    }
    g.fillStyle(s.cooldown <= 0 ? 0x79e1ce : 0xffac64); g.fillCircle(turretX, turretY, 5);
    const ready = s.cooldown <= 0;
    const pulse = ready ? 1 : 0.45;
    g.lineStyle(2, ready ? 0x79e1ce : 0xbba6ff, pulse);
    g.strokeCircle(s.crosshairX, s.crosshairY, 16);
    g.lineBetween(s.crosshairX - 24, s.crosshairY, s.crosshairX - 8, s.crosshairY);
    g.lineBetween(s.crosshairX + 8, s.crosshairY, s.crosshairX + 24, s.crosshairY);
    g.lineBetween(s.crosshairX, s.crosshairY - 24, s.crosshairX, s.crosshairY - 8);
    g.lineBetween(s.crosshairX, s.crosshairY + 8, s.crosshairX, s.crosshairY + 24);
    g.fillStyle(ready ? 0x79e1ce : 0xbba6ff, pulse); g.fillCircle(s.crosshairX, s.crosshairY, 2.5);
  }

  private paintProtection(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, elapsed: number) {
    const pulse = .6 + Math.sin(this.decorativeTime(elapsed) * 12) * .1;
    g.lineStyle(2, 0x8feaff, pulse); g.strokeCircle(x, y, radius);
    g.lineStyle(1, 0xc5ffff, .4); g.strokeCircle(x, y, radius - 3);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2 + Math.PI / 4;
      g.lineStyle(3, 0x79e1ce, .8); g.beginPath();
      g.arc(x, y, radius, angle - .14, angle + .14); g.strokePath();
    }
  }

  private paintMine(g: Phaser.GameObjects.Graphics, mine: Mine, elapsed: number, lifetime: number, impactLive = false) {
    const armed = mine.armIn <= 0 || impactLive;
    const color = armed ? 0xffca83 : 0xbba6ff;
    const pulse = .7 + Math.sin(this.decorativeTime(elapsed) * 12 + mine.id) * .12;
    // Outer circle is the actual blast radius; the lifetime dial is separate hardware.
    g.fillStyle(color, armed ? .035 : .02); g.fillCircle(mine.x, mine.y, mine.blastRadius);
    g.lineStyle(1, color, armed ? .35 : .2); g.strokeCircle(mine.x, mine.y, mine.blastRadius);
    g.fillStyle(0x101528, .9); g.fillCircle(mine.x, mine.y, 11);
    g.fillStyle(0x33435e); g.lineStyle(2, color, .9);
    g.fillCircle(mine.x, mine.y, 9); g.strokeCircle(mine.x, mine.y, 9);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      g.lineStyle(3, 0x526984); g.lineBetween(mine.x + dx * 8, mine.y + dy * 8, mine.x + dx * 13, mine.y + dy * 13);
      g.fillStyle(color, .9); g.fillCircle(mine.x + dx * 13, mine.y + dy * 13, 1.5);
    }
    g.lineStyle(2, 0x405571, .65); g.strokeCircle(mine.x, mine.y, 18);
    g.lineStyle(2, color, .9); g.beginPath();
    g.arc(mine.x, mine.y, 18, -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, mine.expiresIn / lifetime))); g.strokePath();
    g.fillStyle(color, pulse);
    if (armed) g.fillCircle(mine.x, mine.y, 3);
    else { g.lineStyle(2, color, .95); g.strokeCircle(mine.x, mine.y, 3); }
  }

  private paintMineExplosion(g: Phaser.GameObjects.Graphics, explosion: Explosion) {
    const progress = Math.max(0, Math.min(1, explosion.remaining / .28));
    const r = explosion.radius;
    g.fillStyle(0xffb866, .06 + progress * .1); g.fillCircle(explosion.x, explosion.y, r);
    // Keep the damage boundary exact, with shock rings and bounded fragments inside it.
    g.lineStyle(3, 0xffca83, progress * .8); g.strokeCircle(explosion.x, explosion.y, r);
    g.lineStyle(2, 0xfff1b3, progress * .75); g.strokeCircle(explosion.x, explosion.y, r * (.35 + (1 - progress) * .6));
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const inner = r * (.2 + (1 - progress) * .45);
      const outer = Math.min(r, inner + 8);
      g.lineStyle(2, i % 2 ? 0xffca83 : 0xffffff, progress * .8);
      g.lineBetween(explosion.x + Math.cos(angle) * inner, explosion.y + Math.sin(angle) * inner,
        explosion.x + Math.cos(angle) * outer, explosion.y + Math.sin(angle) * outer);
    }
  }

  private paintWeaponTarget(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number, ready: boolean) {
    g.lineStyle(1, color, ready ? 0.45 : 0.2); g.strokeCircle(x, y, radius);
    g.lineStyle(2, color, ready ? 0.9 : 0.4);
    g.lineBetween(x - 10, y, x + 10, y);
    g.lineBetween(x, y - 10, x, y + 10);
  }

  private paintBomberMode(g: Phaser.GameObjects.Graphics) {
    const s = this.bomber;
    const drop = mineDropPosition(s);
    this.paintWeaponTarget(g, drop.x, drop.y, bomberBlastRadius(this.config), 0xffca83, s.cooldown <= 0);
    if (s.impactFlash) { g.fillStyle(0xff715b, 0.14); g.fillRect(9, 9, WIDTH - 18, HEIGHT - 18); }
    for (const explosion of s.explosions) this.paintMineExplosion(g, explosion);
    for (const mine of s.mines) this.paintMine(g, mine, s.elapsed, BOMBER_MINE_LIFETIME);
    for (const asteroid of s.asteroids) this.paintAsteroid(g, asteroid, false, false, -1);
    g.lineStyle(1, 0x79e1ce, 0.18); g.lineBetween(12, s.y + 34, WIDTH - 12, s.y + 34);
    this.paintPlayerShip(g, s.x, s.y, s.elapsed, false);
    // Twin mine racks give this station a distinct silhouette using the shared ship art.
    for (const dx of [-18, 18]) {
      g.fillStyle(0x33435e); g.lineStyle(1, 0xa9bbcf);
      g.fillRoundedRect(s.x + dx - 4, s.y + 3, 8, 15, 3);
      g.strokeRoundedRect(s.x + dx - 4, s.y + 3, 8, 15, 3);
      g.lineStyle(1, 0x101528);
      for (let rail = 0; rail < 3; rail++) g.lineBetween(s.x + dx - 2, s.y + 5 + rail * 3, s.x + dx + 2, s.y + 5 + rail * 3);
      g.fillStyle(s.cooldown <= 0 ? 0xffca83 : 0xbba6ff);
      g.fillCircle(s.x + dx, s.y + 12, 2);
    }
    if (s.invulnerable > 0) this.paintProtection(g, s.x, s.y, 32, s.elapsed);
    if (s.cooldown > 0) {
      const readyFraction = 1 - s.cooldown / BOMBER_MINE_COOLDOWN;
      g.lineStyle(3, 0xbba6ff, 0.8);
      g.beginPath(); g.arc(s.x, s.y, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * readyFraction); g.strokePath();
    }
  }

  private lifeSupportRouteX(route: LifeSupportRoute): number {
    return route === 'Thrusters' ? 92 : route === 'Shields' ? WIDTH / 2 : WIDTH - 92;
  }

  private lifeSupportRouteColor(route: LifeSupportRoute): number {
    return route === 'Thrusters' ? 0xffb866 : route === 'Shields' ? 0x79e1ce : 0xbba6ff;
  }

  private paintLifeSupportPanel(g: Phaser.GameObjects.Graphics, elapsed: number) {
    // A recessed ship console replaces the generic star field without reducing contrast around packets.
    g.fillStyle(0x0b1324, 0.94); g.fillRoundedRect(15, 14, WIDTH - 30, HEIGHT - 28, 22);
    g.lineStyle(3, 0x344866, 0.9); g.strokeRoundedRect(15, 14, WIDTH - 30, HEIGHT - 28, 22);
    g.lineStyle(1, 0x7991b0, 0.32); g.strokeRoundedRect(22, 21, WIDTH - 44, HEIGHT - 42, 17);

    // Structural seams, braces, and rivets make the bay read as machinery rather than open space.
    for (const y of [118, 224, 330, 446]) {
      g.lineStyle(1, 0x334762, 0.35); g.lineBetween(27, y, WIDTH - 27, y);
      g.fillStyle(0x68809e, 0.6); g.fillCircle(29, y, 2); g.fillCircle(WIDTH - 29, y, 2);
    }
    for (const x of [38, WIDTH - 38]) {
      g.lineStyle(8, 0x17243a, 0.96); g.lineBetween(x, 48, x, 432);
      g.lineStyle(2, 0x526984, 0.7); g.lineBetween(x, 48, x, 432);
      for (let y = 70; y < 430; y += 54) {
        g.fillStyle(0x263955); g.fillRoundedRect(x - 10, y - 4, 20, 8, 3);
        g.fillStyle(0x91a8bf, 0.65); g.fillCircle(x - 6, y, 1.5); g.fillCircle(x + 6, y, 1.5);
      }
    }

    // Intake manifold and its animated diagnostic lights.
    g.fillStyle(0x1b2942); g.lineStyle(2, 0x607895, 0.85);
    g.fillRoundedRect(WIDTH / 2 - 74, 25, 148, 43, 10);
    g.strokeRoundedRect(WIDTH / 2 - 74, 25, 148, 43, 10);
    g.fillStyle(0x0d1728); g.fillRoundedRect(WIDTH / 2 - 48, 36, 96, 21, 5);
    for (let i = 0; i < 5; i++) {
      const active = i === Math.floor(elapsed * 4) % 5;
      g.fillStyle(active ? 0x79e1ce : 0x405571, active ? 0.95 : 0.65);
      g.fillCircle(WIDTH / 2 - 32 + i * 16, 46, active ? 3.2 : 2.4);
    }
  }

  private paintLifeSupportSymbol(
    g: Phaser.GameObjects.Graphics,
    packet: Pick<LifeSupportPacket, 'kind' | 'target'>,
    x: number,
    y: number,
    scale = 1,
  ) {
    const color = packet.kind === 'heart' ? 0x79e1ce
      : packet.kind === 'overload' ? 0xff8f6b : this.lifeSupportRouteColor(packet.target);
    g.fillStyle(color, 0.95); g.lineStyle(2, 0xf4f7ff, 0.82);
    if (packet.kind === 'heart') {
      g.fillCircle(x - 5 * scale, y - 3 * scale, 7 * scale);
      g.fillCircle(x + 5 * scale, y - 3 * scale, 7 * scale);
      g.fillTriangle(x - 11 * scale, y, x + 11 * scale, y, x, y + 13 * scale);
      return;
    }
    if (packet.kind === 'overload') {
      g.fillTriangle(x - 4 * scale, y - 14 * scale, x + 7 * scale, y - 3 * scale, x - 1 * scale, y - 3 * scale);
      g.fillTriangle(x + 4 * scale, y + 14 * scale, x - 7 * scale, y + 3 * scale, x + 1 * scale, y + 3 * scale);
      return;
    }
    if (packet.target === 'Thrusters') {
      g.fillTriangle(x, y - 13 * scale, x - 10 * scale, y + 11 * scale, x + 10 * scale, y + 11 * scale);
      g.fillStyle(0xfff0bc); g.fillTriangle(x, y - 5 * scale, x - 4 * scale, y + 8 * scale, x + 4 * scale, y + 8 * scale);
    } else if (packet.target === 'Shields') {
      g.fillCircle(x, y, 12 * scale); g.fillStyle(0x14253b); g.fillCircle(x, y, 6 * scale);
    } else {
      g.fillCircle(x, y, 11 * scale); g.fillStyle(0x14253b); g.fillCircle(x, y, 5 * scale);
      g.lineStyle(3 * scale, color); g.lineBetween(x - 15 * scale, y, x + 15 * scale, y);
      g.lineBetween(x, y - 15 * scale, x, y + 15 * scale);
    }
  }

  private paintSpaceLifeMode(g: Phaser.GameObjects.Graphics) {
    const s = this.spaceLife;
    const time = this.decorativeTime(s.elapsed);
    this.paintSpaceLifeInterior(g);
    for (const fire of s.fires) {
      const color = fire.kind === 'electrical' ? 0x89dfff : 0xffa35e;
      const pulse = 0.75 + Math.sin(time * 13 + fire.id) * 0.12;
      g.fillStyle(color, 0.09); g.fillCircle(fire.x, fire.y - 14, 25);
      if (fire.kind === 'ordinary') {
        g.fillStyle(0x2b2638); g.fillEllipse(fire.x, fire.y - 1, 29, 7);
        g.fillStyle(0xff6c52, pulse);
        g.fillTriangle(fire.x - 13, fire.y, fire.x + 13, fire.y, fire.x - 2, fire.y - 30);
        g.fillTriangle(fire.x - 12, fire.y - 2, fire.x + 1, fire.y - 2, fire.x - 8, fire.y - 23);
        g.fillStyle(0xffa35e); g.fillTriangle(fire.x - 8, fire.y, fire.x + 9, fire.y, fire.x + 5, fire.y - 25);
        g.fillStyle(0xffe7a3); g.fillTriangle(fire.x - 4, fire.y, fire.x + 5, fire.y, fire.x, fire.y - 16);
        for (let ember = 0; ember < 2; ember++) {
          const rise = (time * 18 + fire.id * 3 + ember * 14) % 25;
          g.fillStyle(0xffca83, (1 - rise / 25) * 0.6);
          g.fillCircle(fire.x - 5 + ember * 10, fire.y - 24 - rise, 1);
        }
      } else {
        g.fillStyle(0x152a40); g.lineStyle(2, color, pulse);
        g.fillRoundedRect(fire.x - 14, fire.y - 27, 28, 27, 4);
        g.strokeRoundedRect(fire.x - 14, fire.y - 27, 28, 27, 4);
        g.fillStyle(0x3a536c); g.fillRect(fire.x - 10, fire.y - 23, 20, 4);
        for (const side of [-1, 1]) {
          g.fillStyle(0x9bbbd1); g.fillCircle(fire.x + side * 10, fire.y - 4, 1.5);
        }
        g.lineStyle(3, 0xe4faff, pulse);
        g.lineBetween(fire.x - 4, fire.y - 23, fire.x + 5, fire.y - 16);
        g.lineBetween(fire.x + 5, fire.y - 16, fire.x - 3, fire.y - 8);
        g.lineStyle(1, color, 0.7);
        g.lineBetween(fire.x - 18, fire.y - 17, fire.x - 22, fire.y - 20);
        g.lineBetween(fire.x + 18, fire.y - 12, fire.x + 22, fire.y - 16);
      }
      const warning = fire.kind === 'electrical' ? (fire.sparkIn ?? 1) <= SPACE_LIFE_SPARK_WARNING + 1e-9 : (fire.arming ?? 0) > 0;
      if (warning) {
        g.lineStyle(2, 0xffdf91, 1);
        g.strokeRoundedRect(fire.x - 17, fire.y - 30, 34, 32, 4);
        for (const side of fire.kind === 'electrical' ? [-1, 1] : []) {
          g.lineBetween(fire.x + side * 20, fire.y - 14, fire.x + side * 30, fire.y - 14);
          g.lineBetween(fire.x + side * 30, fire.y - 14, fire.x + side * 25, fire.y - 19);
          g.lineBetween(fire.x + side * 30, fire.y - 14, fire.x + side * 25, fire.y - 9);
        }
      }
      if (fire.kind === 'electrical') {
        const progress = Math.min(1, (fire.repairProgress ?? 0) / SPACE_LIFE_REPAIR_SECONDS);
        g.fillStyle(0x101528); g.fillRoundedRect(fire.x - 21, fire.y - 42, 42, 8, 3);
        g.fillStyle(0x79e1ce); g.fillRect(fire.x - 19, fire.y - 40, 38 * progress, 4);
        g.lineStyle(1, 0x89dfff, .8); g.strokeRoundedRect(fire.x - 21, fire.y - 42, 42, 8, 3);
      }
      g.lineStyle(2, color, Math.max(0.2, fire.remaining / SPACE_LIFE_PLATFORMS.length / 3));
      g.lineBetween(fire.x - 14, fire.y + 5, fire.x + 14, fire.y + 5);
    }
    for (const flash of s.repairFlashes) {
      g.lineStyle(3, 0x79e1ce, flash.remaining / 0.4);
      g.strokeCircle(flash.x, flash.y - 14, 18 + (1 - flash.remaining / 0.4) * 12);
      g.lineBetween(flash.x - 6, flash.y - 14, flash.x - 1, flash.y - 9);
      g.lineBetween(flash.x - 1, flash.y - 9, flash.x + 9, flash.y - 21);
    }
    for (const icon of s.icons) {
      const color = icon.kind === 'heart' ? 0x79e1ce : 0xff8f6b;
      g.fillStyle(color, 0.09); g.fillCircle(icon.x, icon.y, 20);
      g.fillStyle(0x15283a); g.lineStyle(1, color, 0.6);
      g.fillRoundedRect(icon.x - 13, icon.y - 15, 26, 30, 6);
      g.strokeRoundedRect(icon.x - 13, icon.y - 15, 26, 30, 6);
      for (const dx of [-9, 9]) {
        g.fillStyle(0x9bbbd1, 0.7); g.fillCircle(icon.x + dx, icon.y + 11, 1);
      }
      this.paintLifeSupportSymbol(g, { kind: icon.kind, target: 'Shields' }, icon.x, icon.y, 0.72);
    }
    for (const spark of s.sparks) {
      const direction = Math.sign(spark.vx);
      g.lineStyle(6, 0x89dfff, 0.24); g.lineBetween(spark.x - direction * 15, spark.y, spark.x, spark.y);
      g.lineStyle(2, 0x89dfff, 0.95); g.lineBetween(spark.x - direction * 10, spark.y, spark.x, spark.y);
      g.fillStyle(0x091827); g.fillCircle(spark.x, spark.y, 5.5);
      g.fillStyle(0xe4faff); g.fillCircle(spark.x, spark.y, 4);
      g.lineStyle(1, 0x89dfff); g.strokeCircle(spark.x, spark.y, 4);
    }
    this.paintSpaceLifeCrew(g, s);
    if (s.invulnerable > 0) {
      g.lineStyle(2, 0x8feaff, 0.55 + Math.sin(time * 18) * 0.15);
      g.strokeCircle(s.x, s.y - 14, 21);
    }
  }

  private paintSpaceLifeInterior(g: Phaser.GameObjects.Graphics) {
    // Quiet structural layers behind the action; no decorative geometry changes a platform.
    g.fillStyle(0x101a2b); g.fillRect(10, 10, WIDTH - 20, HEIGHT - 20);
    for (let bay = 0; bay < 3; bay++) {
      const x = 28 + bay * 148;
      g.fillStyle(0x172338); g.lineStyle(1, 0x344761, 0.7);
      g.fillRoundedRect(x, 44, 124, 454, 8); g.strokeRoundedRect(x, 44, 124, 454, 8);
      g.fillStyle(0x0c1728); g.fillRoundedRect(x + 8, 58, 108, 77, 6);
      g.lineStyle(1, 0x415873, 0.6); g.strokeRoundedRect(x + 8, 58, 108, 77, 6);
      for (let vent = 0; vent < 5; vent++) {
        g.lineStyle(2, 0x293d55); g.lineBetween(x + 23, 78 + vent * 9, x + 101, 78 + vent * 9);
      }
      for (let deck = 0; deck < 3; deck++) {
        const y = 218 + deck * 96;
        g.lineStyle(1, 0x2d4059, 0.8); g.strokeRect(x + 15, y, 94, 51);
        g.fillStyle(0x23364e); g.fillRect(x + 20, y + 6, 84, 4);
        g.fillStyle(0xbba6ff, 0.25); g.fillRect(x + 22, y + 17, 2, 17);
        g.lineStyle(1, 0x30455e, 0.6); g.lineBetween(x + 33, y + 37, x + 91, y + 37);
      }
    }
    for (const x of [18, WIDTH - 18]) {
      g.lineStyle(7, 0x22364d); g.lineBetween(x, 30, x, HEIGHT - 30);
      g.lineStyle(1, 0x66819b, 0.45); g.lineBetween(x - 2, 30, x - 2, HEIGHT - 30);
      for (let y = 45; y < HEIGHT - 25; y += 78) {
        g.fillStyle(0x40536e); g.fillRect(x - 5, y, 10, 5);
        g.fillStyle(0x9bbbd1, 0.5); g.fillCircle(x, y + 2, 1);
      }
    }
    g.fillStyle(0x263951); g.lineStyle(1, 0x6b819b, 0.5);
    g.fillRoundedRect(34, 18, WIDTH - 68, 16, 4); g.strokeRoundedRect(34, 18, WIDTH - 68, 16, 4);
    for (let x = 50; x < WIDTH - 40; x += 46) {
      g.fillStyle(0x79e1ce, 0.35); g.fillRect(x, 24, 20, 3);
    }
    for (const platform of SPACE_LIFE_PLATFORMS) {
      const width = platform.x2 - platform.x1;
      g.fillStyle(0x081323, 0.5); g.fillRect(platform.x1 + 3, platform.y + 12, width - 6, 6);
      g.lineStyle(4, 0x2c4059, 0.8);
      for (const x of [platform.x1 + 12, platform.x2 - 12]) g.lineBetween(x, platform.y + 12, x, platform.y + 28);
      g.fillStyle(0x263951); g.fillRoundedRect(platform.x1, platform.y, width, 12, 3);
      g.fillStyle(0x40546c); g.fillRect(platform.x1 + 2, platform.y + 3, width - 4, 3);
      g.fillStyle(0x79e1ce, 0.75); g.fillRect(platform.x1 + 2, platform.y, width - 4, 2);
      g.lineStyle(1, 0x0b192b, 0.8);
      for (let x = platform.x1 + 15; x < platform.x2 - 5; x += 35) {
        g.lineBetween(x, platform.y + 7, x + 8, platform.y + 7);
        g.fillStyle(0x9bbbd1, 0.55); g.fillCircle(x - 4, platform.y + 8, 1);
      }
    }
  }

  private paintSpaceLifeCrew(g: Phaser.GameObjects.Graphics, s: SpaceLifeState) {
    const tucked = !s.grounded;
    // Boots, backpack and helmet remain inside the existing 22px-wide crew footprint.
    g.fillStyle(0x273b54); g.lineStyle(1, 0x91abc4);
    g.fillRoundedRect(s.x - 10, s.y - 21, 20, 16, 3); g.strokeRoundedRect(s.x - 10, s.y - 21, 20, 16, 3);
    for (const side of [-1, 1]) {
      const x = s.x + side * 5;
      const bootY = s.y - (tucked ? 7 : 3);
      g.lineStyle(5, 0x9cbfe1); g.lineBetween(x, s.y - 10, x + (tucked ? side * 2 : 0), bootY);
      g.fillStyle(0x405b77); g.fillRoundedRect(x - 3, bootY - 1, 7, 3, 1);
    }
    g.fillStyle(0x9cbfe1); g.lineStyle(1, 0xe8f8ff);
    g.fillRoundedRect(s.x - 7, s.y - 19, 14, 12, 3); g.strokeRoundedRect(s.x - 7, s.y - 19, 14, 12, 3);
    g.fillStyle(0x263e56); g.fillRect(s.x - 4, s.y - 16, 8, 5);
    g.fillStyle(0x79e1ce); g.fillRect(s.x - 2, s.y - 15, 4, 2);
    g.fillStyle(0x405b77); g.fillRect(s.x - 6, s.y - 8, 12, 2);
    g.fillStyle(0x9cbfe1); g.lineStyle(1, 0xe8f8ff);
    g.fillRoundedRect(s.x - 9, s.y - 28, 18, 13, 6); g.strokeRoundedRect(s.x - 9, s.y - 28, 18, 13, 6);
    g.fillStyle(0x172f45); g.fillRoundedRect(s.x - 7, s.y - 25, 14, 7, 3);
    g.fillStyle(0x89dfff, 0.65); g.fillRoundedRect(s.x - 5, s.y - 24, 8, 2, 1);
    g.fillStyle(0xf4ffff, 0.8); g.fillCircle(s.x - 4, s.y - 24, 1);
  }

  private paintLifeSupportMode(g: Phaser.GameObjects.Graphics) {
    const s = this.lifeSupport;
    const feedbackColor = s.lastResult === 'correct' ? 0x79e1ce : 0xff715b;
    this.paintLifeSupportPanel(g, s.elapsed);

    // Packet conduit: layered walls, regular braces, and a moving scanner pulse.
    g.fillStyle(0x111d31, 0.99); g.fillRoundedRect(WIDTH / 2 - 55, 76, 110, LIFE_SUPPORT_SWITCH_Y - 88, 18);
    g.lineStyle(2, 0x516686, 0.85); g.strokeRoundedRect(WIDTH / 2 - 55, 76, 110, LIFE_SUPPORT_SWITCH_Y - 88, 18);
    g.lineStyle(7, 0x263852, 0.95); g.lineBetween(WIDTH / 2, 80, WIDTH / 2, LIFE_SUPPORT_SWITCH_Y);
    g.lineStyle(1, 0x83a3c4, 0.52); g.lineBetween(WIDTH / 2 - 11, 83, WIDTH / 2 - 11, LIFE_SUPPORT_SWITCH_Y);
    g.lineBetween(WIDTH / 2 + 11, 83, WIDTH / 2 + 11, LIFE_SUPPORT_SWITCH_Y);
    for (let y = 98; y < LIFE_SUPPORT_SWITCH_Y - 18; y += 42) {
      g.fillStyle(0x293c58); g.fillRoundedRect(WIDTH / 2 - 48, y, 96, 5, 2);
      g.fillStyle(0x7188a4, 0.6); g.fillCircle(WIDTH / 2 - 42, y + 2.5, 1.5); g.fillCircle(WIDTH / 2 + 42, y + 2.5, 1.5);
    }
    const scannerY = 88 + (s.elapsed * 72) % Math.max(1, LIFE_SUPPORT_SWITCH_Y - 110);
    g.lineStyle(7, 0x79e1ce, 0.06); g.lineBetween(WIDTH / 2 - 43, scannerY, WIDTH / 2 + 43, scannerY);
    g.lineStyle(1, 0xbafff2, 0.5); g.lineBetween(WIDTH / 2 - 40, scannerY, WIDTH / 2 + 40, scannerY);

    const routes: LifeSupportRoute[] = ['Thrusters', 'Shields', 'Guns'];
    for (const [routeIndex, route] of routes.entries()) {
      const x = this.lifeSupportRouteX(route);
      const selected = route === s.selectedRoute;
      const color = this.lifeSupportRouteColor(route);
      g.lineStyle(15, 0x192840, 0.98);
      g.lineBetween(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, x, 472);
      g.lineStyle(selected ? 7 : 3, color, selected ? 0.88 : 0.28);
      g.lineBetween(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, x, 472);

      if (selected) {
        const flow = (s.elapsed * 1.15 + routeIndex * 0.19) % 1;
        const flowX = WIDTH / 2 + (x - WIDTH / 2) * flow;
        const flowY = LIFE_SUPPORT_SWITCH_Y + (472 - LIFE_SUPPORT_SWITCH_Y) * flow;
        g.fillStyle(color, 0.18); g.fillCircle(flowX, flowY, 9);
        g.fillStyle(0xf6ffff, 0.9); g.fillCircle(flowX, flowY, 2.5);
      }

      // Each destination is a small illuminated subsystem bay with a status rail and hardware.
      g.fillStyle(0x111d30, 0.98); g.fillRoundedRect(x - 52, 458, 104, 82, 14);
      g.fillStyle(color, selected ? 0.14 : 0.045); g.fillRoundedRect(x - 46, 464, 92, 70, 10);
      g.lineStyle(selected ? 3 : 1, color, selected ? 0.95 : 0.55); g.strokeRoundedRect(x - 52, 458, 104, 82, 14);
      g.fillStyle(color, selected ? 0.9 : 0.35); g.fillRoundedRect(x - 31, 469, 62, 4, 2);
      for (const dx of [-43, 43]) for (const dy of [10, 71]) {
        g.fillStyle(0x7890a9, 0.72); g.fillCircle(x + dx, 458 + dy, 2);
      }
      this.paintLifeSupportSymbol(g, { kind: 'power', target: route }, x, 501, 0.92);
      g.lineStyle(1, color, 0.35); g.lineBetween(x - 23, 526, x + 23, 526);
      for (const dx of [-14, 0, 14]) {
        g.fillStyle(dx === 0 && selected ? color : 0x435873, selected ? 0.8 : 0.45); g.fillCircle(x + dx, 531, 1.8);
      }
    }

    // Rotary switch with three detents and a bright mechanical selector arm.
    g.fillStyle(0x0d1728, 0.95); g.lineStyle(2, 0x526a88, 0.8);
    g.fillCircle(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, 34); g.strokeCircle(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, 34);
    for (const route of routes) {
      const routeAngle = Math.atan2(472 - LIFE_SUPPORT_SWITCH_Y, this.lifeSupportRouteX(route) - WIDTH / 2);
      g.fillStyle(this.lifeSupportRouteColor(route), route === s.selectedRoute ? 0.95 : 0.35);
      g.fillCircle(WIDTH / 2 + Math.cos(routeAngle) * 27, LIFE_SUPPORT_SWITCH_Y + Math.sin(routeAngle) * 27, 3.5);
    }
    g.fillStyle(0x22314d); g.lineStyle(3, 0xc8d9ef, 0.9);
    g.fillCircle(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, 19); g.strokeCircle(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, 19);
    const selectedX = this.lifeSupportRouteX(s.selectedRoute);
    const angle = Math.atan2(472 - LIFE_SUPPORT_SWITCH_Y, selectedX - WIDTH / 2);
    g.lineStyle(11, 0x111c2d, 0.95);
    g.lineBetween(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, WIDTH / 2 + Math.cos(angle) * 38, LIFE_SUPPORT_SWITCH_Y + Math.sin(angle) * 38);
    g.lineStyle(6, this.lifeSupportRouteColor(s.selectedRoute), 0.98);
    g.lineBetween(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, WIDTH / 2 + Math.cos(angle) * 38, LIFE_SUPPORT_SWITCH_Y + Math.sin(angle) * 38);
    g.fillStyle(0xeaf7ff); g.fillCircle(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, 5);

    for (const packet of s.packets) {
      const pulse = 0.75 + Math.sin(s.elapsed * 10 + packet.id) * 0.12;
      const packetColor = packet.kind === 'overload' ? 0xff8f6b : this.lifeSupportRouteColor(packet.target);
      for (let trail = 3; trail > 0; trail--) {
        g.fillStyle(packetColor, 0.035 * (4 - trail)); g.fillCircle(packet.x, packet.y - trail * 11, 5 + trail);
      }
      g.fillStyle(packetColor, 0.07); g.fillCircle(packet.x, packet.y, 31);
      g.fillStyle(0x1d2942, 0.98); g.lineStyle(2, this.lifeSupportRouteColor(packet.target), pulse);
      g.fillCircle(packet.x, packet.y, 22); g.strokeCircle(packet.x, packet.y, 22);
      for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        g.fillStyle(0x91a8c1, 0.8);
        g.fillRoundedRect(packet.x + Math.cos(rotation) * 22 - 3, packet.y + Math.sin(rotation) * 22 - 2, 6, 4, 1);
      }
      this.paintLifeSupportSymbol(g, packet, packet.x, packet.y, 0.75);
    }

    if (s.feedbackTime > 0) {
      g.fillStyle(feedbackColor, 0.06 + s.feedbackTime * 0.26); g.fillRect(16, 15, WIDTH - 32, HEIGHT - 30);
      g.lineStyle(5, feedbackColor, 0.35 + s.feedbackTime * 0.4); g.strokeRoundedRect(17, 16, WIDTH - 34, HEIGHT - 32, 20);
    }
  }
}
