import Phaser from 'phaser';
import {
  createBomber, createFlight, createGunner, createLifeSupport, createSpaceBattleBomber, createSpaceBattlePilot, stepBomber,
  stepFlight, stepGunner, stepLifeSupport, stepSpaceBattleBomber, stepSpaceBattlePilot, WIDTH, HEIGHT,
  mineDropPosition, automaticShipX, bomberBlastRadius, spaceBomberBlastRadius, BOMBER_MINE_COOLDOWN, BOMBER_MINE_LIFETIME, GUNNER_DEFENSE_LINE, type Asteroid, type FlightConfig, type FlightState,
  type BomberInput, type BomberState, type GunnerInput, type GunnerState, type Role, type Situation,
  LIFE_SUPPORT_SWITCH_Y, type LifeSupportInput, type LifeSupportPacket, type LifeSupportRoute,
  type LifeSupportState, type SpaceBattleBomberInput, type SpaceBattleBomberState,
  type SpaceBattlePilotState, type EnemyShip, type EnemyShot, type FuelCell, type SpaceBomberEnemy,
  SPACE_BOMBER_MINE_COOLDOWN, SPACE_BOMBER_MINE_LIFETIME, SPACE_BOMBER_MISSILE_COOLDOWN,
} from './rules';

export class FlightScene extends Phaser.Scene {
  flight = createFlight();
  gunner = createGunner();
  bomber = createBomber();
  lifeSupport = createLifeSupport();
  spacePilot = createSpaceBattlePilot();
  spaceBomber = createSpaceBattleBomber();
  activeFlight = false;
  role: Role = 'Pilot';
  situation: Situation = 'Asteroid Field';
  config: FlightConfig = { total: 10, naturalOne: false };
  private graphics!: Phaser.GameObjects.Graphics;
  readInput: (x: number, y: number) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  readGunnerInput: () => GunnerInput = () => ({ firing: false });
  readBomberInput: () => BomberInput = () => ({ x: 0, y: 0, placing: false });
  readLifeSupportInput: () => LifeSupportInput = () => ({ route: 'Shields' });
  readSpaceBomberInput: () => SpaceBattleBomberInput = () => ({ x: 0, y: 0, firing: false, placing: false });
  onFlightStep: (state: FlightState) => void = () => {};
  onGunnerStep: (state: GunnerState) => void = () => {};
  onBomberStep: (state: BomberState) => void = () => {};
  onLifeSupportStep: (state: LifeSupportState) => void = () => {};
  onSpacePilotStep: (state: SpaceBattlePilotState) => void = () => {};
  onSpaceBomberStep: (state: SpaceBattleBomberState) => void = () => {};
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
    this.bomber = createBomber();
    this.lifeSupport = createLifeSupport();
    this.spacePilot = createSpaceBattlePilot();
    this.spaceBomber = createSpaceBattleBomber();
    this.activeFlight = true;
  }

  update(_time: number, delta: number) {
    if (!this.graphics) return;
    if (this.activeFlight) {
      if (this.situation === 'Space Battle') {
        if (this.role === 'Bomber') {
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
      ? this.role === 'Bomber' ? this.spaceBomber.elapsed : this.spacePilot.elapsed
      : this.role === 'Pilot' ? this.flight.elapsed
        : this.role === 'Gunner' ? this.gunner.elapsed
          : this.role === 'Bomber' ? this.bomber.elapsed : this.lifeSupport.elapsed;
    this.paintBackground(g, elapsed);
    if (this.situation === 'Space Battle') {
      if (this.role === 'Bomber') this.paintSpaceBattleBomberMode(g);
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
        const pulse = 0.55 + Math.sin(s.elapsed * 16) * 0.2;
        g.fillStyle(0xffc66d, pulse);
        g.fillTriangle(warningX, warningY, warningX + direction * 14, warningY - 9,
          warningX + direction * 14, warningY + 9);
        g.lineStyle(2, 0xffe1a3, pulse);
        g.lineBetween(warningX, warningY - 14, warningX, warningY + 14);
      }
      this.paintAsteroid(g, asteroid);
    }
    if (s.invulnerable) { g.lineStyle(2, 0x8feaff, 0.5); g.strokeCircle(s.x, s.y, 26); }
    if (s.invulnerable && Math.floor(s.elapsed * 10) % 2 === 0) return;
    this.paintPlayerShip(g, s.x, s.y, s.elapsed);
  }

  private paintPlayerShip(g: Phaser.GameObjects.Graphics, x: number, y: number, elapsed: number, impairedEngine = this.config.naturalOne) {
    const flame = impairedEngine ? 0xffac64 : 0x71e4f5;
    const pulse = 5 + Math.sin(elapsed * 40) * 3;
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
  }

  private paintSpaceBattlePilotMode(g: Phaser.GameObjects.Graphics) {
    const s = this.spacePilot;
    if (s.impactFlash) { g.fillStyle(0xff715b, 0.14); g.fillRect(9, 9, WIDTH - 18, HEIGHT - 18); }
    for (const cell of s.fuelCells) this.paintFuelCell(g, cell, s.elapsed);
    for (const enemy of s.enemies) this.paintEnemyShip(g, enemy, s.elapsed);
    for (const shot of s.shots) this.paintEnemyShot(g, shot, s.elapsed);
    if (s.invulnerable) { g.lineStyle(2, 0x8feaff, 0.55); g.strokeCircle(s.x, s.y, 26); }
    if (!s.invulnerable || Math.floor(s.elapsed * 10) % 2 !== 0) this.paintPlayerShip(g, s.x, s.y, s.elapsed);
  }

  private paintSpaceBattleBomberMode(g: Phaser.GameObjects.Graphics) {
    const s = this.spaceBomber;
    this.paintWeaponTarget(g, s.aimX, Math.min(s.y - 34, s.aimY), 14, 0x79e1ce, s.missileCooldown <= 0);
    const drop = mineDropPosition(s);
    this.paintWeaponTarget(g, drop.x, drop.y, spaceBomberBlastRadius(this.config), 0xffca83, s.mineCooldown <= 0);
    if (s.impactFlash) { g.fillStyle(0xff715b, 0.14); g.fillRect(9, 9, WIDTH - 18, HEIGHT - 18); }
    for (const explosion of s.explosions) {
      const progress = explosion.remaining / 0.28;
      g.fillStyle(0xffb866, 0.08 + progress * 0.12); g.fillCircle(explosion.x, explosion.y, explosion.radius);
      g.lineStyle(4, 0xffd995, 0.2 + progress * 0.5); g.strokeCircle(explosion.x, explosion.y, explosion.radius);
      g.lineStyle(2, 0xffffff, progress * 0.75); g.strokeCircle(explosion.x, explosion.y, explosion.radius * (0.4 + (1 - progress) * 0.45));
    }
    for (const mine of s.mines) {
      const armed = mine.armIn <= 0;
      const pulse = 0.55 + Math.sin(s.elapsed * 12 + mine.id) * 0.2;
      g.fillStyle(armed ? 0xffbb6d : 0xbba6ff, armed ? 0.035 : 0.02); g.fillCircle(mine.x, mine.y, mine.blastRadius);
      g.lineStyle(1, armed ? 0xffca83 : 0xbba6ff, armed ? pulse * 0.42 : 0.2); g.strokeCircle(mine.x, mine.y, mine.blastRadius);
      g.fillStyle(0x27344e); g.lineStyle(2, armed ? 0xffbc6f : 0xbba6ff, 0.95);
      g.fillCircle(mine.x, mine.y, 9); g.strokeCircle(mine.x, mine.y, 9);
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + s.elapsed;
        g.lineBetween(mine.x + Math.cos(angle) * 7, mine.y + Math.sin(angle) * 7,
          mine.x + Math.cos(angle) * 14, mine.y + Math.sin(angle) * 14);
      }
      g.lineStyle(2, armed ? 0xffca83 : 0xbba6ff, 0.75);
      g.beginPath(); g.arc(mine.x, mine.y, 17, -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.max(0, mine.expiresIn / SPACE_BOMBER_MINE_LIFETIME)); g.strokePath();
    }
    for (const enemy of s.enemies) {
      this.paintEnemyShip(g, enemy, s.elapsed, enemy.approach === 'forward' ? 1 : -1);
      this.paintBomberApproachMarker(g, enemy);
    }
    for (const missile of s.missiles) {
      g.save(); g.translateCanvas(missile.x, missile.y);
      g.rotateCanvas(Math.atan2(missile.vy, missile.vx) + Math.PI / 2);
      g.lineStyle(10, 0x79e1ce, 0.08); g.lineBetween(0, 22, 0, 0);
      g.lineStyle(3, 0xa8fff1, 0.9); g.lineBetween(0, 14, 0, -4);
      g.fillStyle(0xf4ffff); g.fillTriangle(0, -8, -4, 3, 4, 3);
      g.restore();
    }
    if (s.invulnerable) { g.lineStyle(2, 0x8feaff, 0.55); g.strokeCircle(s.x, s.y, 30); }
    if (!s.invulnerable || Math.floor(s.elapsed * 10) % 2 !== 0) {
      this.paintPlayerShip(g, s.x, s.y, s.elapsed, false);
      // Cyan nose launchers and amber aft racks keep both weapon states readable.
      for (const dx of [-15, 15]) {
        g.fillStyle(0x31435f); g.lineStyle(1, 0xa9bbcf); g.fillRoundedRect(s.x + dx - 3, s.y - 12, 6, 13, 2);
        g.strokeRoundedRect(s.x + dx - 3, s.y - 12, 6, 13, 2);
        g.fillStyle(s.missileCooldown <= 0 ? 0x79e1ce : 0x526982); g.fillCircle(s.x + dx, s.y - 10, 2);
        g.fillStyle(s.mineCooldown <= 0 ? 0xffca83 : 0x665a76); g.fillCircle(s.x + dx, s.y + 12, 2);
      }
    }
    if (s.missileCooldown > 0) {
      g.lineStyle(2, 0x79e1ce, 0.75); g.beginPath();
      g.arc(s.x, s.y, 25, -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * (1 - s.missileCooldown / SPACE_BOMBER_MISSILE_COOLDOWN)); g.strokePath();
    }
    if (s.mineCooldown > 0) {
      g.lineStyle(2, 0xffca83, 0.75); g.beginPath();
      g.arc(s.x, s.y, 29, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - s.mineCooldown / SPACE_BOMBER_MINE_COOLDOWN)); g.strokePath();
    }
  }

  private paintBomberApproachMarker(g: Phaser.GameObjects.Graphics, enemy: SpaceBomberEnemy) {
    const direction = enemy.approach === 'forward' ? 1 : -1;
    const y = enemy.y + direction * 25;
    const color = enemy.approach === 'forward' ? 0xff7c8c : 0xffbd6b;
    g.fillStyle(color, 0.75);
    g.fillTriangle(enemy.x, y + direction * 5, enemy.x - 5, y - direction * 3, enemy.x + 5, y - direction * 3);
  }

  private paintFuelCell(g: Phaser.GameObjects.Graphics, cell: FuelCell, elapsed: number) {
    const x = cell.x;
    const y = cell.y + Math.sin(elapsed * 5 + cell.id) * 1.5;
    const pulse = 0.72 + Math.sin(elapsed * 8 + cell.id) * 0.18;
    g.fillStyle(0x79e1ce, 0.06); g.fillCircle(x, y, cell.radius + 12);
    g.fillStyle(0x79e1ce, 0.12); g.fillCircle(x, y, cell.radius + 7);
    g.lineStyle(1, 0x9cffe9, pulse * 0.55); g.strokeCircle(x, y, cell.radius + 5);

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

  private paintEnemyShip(g: Phaser.GameObjects.Graphics, enemy: EnemyShip, elapsed: number, direction: 1 | -1 = 1) {
    const x = enemy.x;
    const y = enemy.y;
    const fy = (offset: number) => y + offset * direction;
    const enginePulse = 3 + Math.sin(elapsed * 28 + enemy.id) * 2;

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
  }

  private paintEnemyShot(g: Phaser.GameObjects.Graphics, shot: EnemyShot, elapsed: number) {
    const speed = Math.max(1, Math.hypot(shot.vx, shot.vy));
    const ux = shot.vx / speed;
    const uy = shot.vy / speed;
    const px = -uy;
    const py = ux;
    const pulse = 0.82 + Math.sin(elapsed * 32 + shot.x * 0.03) * 0.12;
    const tailX = shot.x - ux * 20;
    const tailY = shot.y - uy * 20;
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
    for (const explosion of s.explosions) {
      const progress = explosion.remaining / 0.28;
      g.fillStyle(0xffb866, 0.08 + progress * 0.12); g.fillCircle(explosion.x, explosion.y, explosion.radius);
      g.lineStyle(5, 0xffd995, 0.18 + progress * 0.45); g.strokeCircle(explosion.x, explosion.y, explosion.radius * (1.05 - progress * 0.12));
      g.lineStyle(2, 0xffffff, progress * 0.8); g.strokeCircle(explosion.x, explosion.y, explosion.radius * (0.45 + (1 - progress) * 0.4));
    }
    for (const mine of s.mines) {
      const armed = mine.armIn <= 0;
      const pulse = 0.55 + Math.sin(s.elapsed * 12 + mine.id) * 0.2;
      g.fillStyle(armed ? 0xffbb6d : 0xbba6ff, armed ? 0.035 : 0.02);
      g.fillCircle(mine.x, mine.y, mine.blastRadius);
      g.lineStyle(1, armed ? 0xffca83 : 0xbba6ff, armed ? pulse * 0.35 : 0.18);
      g.strokeCircle(mine.x, mine.y, mine.blastRadius);
      g.fillStyle(0x27344e); g.lineStyle(2, armed ? 0xffbc6f : 0xbba6ff, 0.9);
      g.fillCircle(mine.x, mine.y, 9); g.strokeCircle(mine.x, mine.y, 9);
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + s.elapsed * 0.7;
        g.lineBetween(mine.x + Math.cos(angle) * 7, mine.y + Math.sin(angle) * 7,
          mine.x + Math.cos(angle) * 14, mine.y + Math.sin(angle) * 14);
      }
      // A shrinking lifetime dial distinguishes an expiring mine from a newly armed one.
      g.lineStyle(2, armed ? 0xffca83 : 0xbba6ff, 0.75);
      g.beginPath();
      g.arc(mine.x, mine.y, 18, -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.max(0, mine.expiresIn / BOMBER_MINE_LIFETIME));
      g.strokePath();
      g.fillStyle(armed ? 0xfff1b3 : 0xbba6ff, pulse); g.fillCircle(mine.x, mine.y, 3);
    }
    for (const asteroid of s.asteroids) this.paintAsteroid(g, asteroid, false, false, -1);
    g.lineStyle(1, 0x79e1ce, 0.18); g.lineBetween(12, s.y + 34, WIDTH - 12, s.y + 34);
    this.paintPlayerShip(g, s.x, s.y, s.elapsed, false);
    // Twin mine racks give this station a distinct silhouette using the shared ship art.
    for (const dx of [-18, 18]) {
      g.fillStyle(0x33435e); g.lineStyle(1, 0xa9bbcf);
      g.fillRoundedRect(s.x + dx - 4, s.y + 3, 8, 15, 3);
      g.strokeRoundedRect(s.x + dx - 4, s.y + 3, 8, 15, 3);
      g.fillStyle(s.cooldown <= 0 ? 0xffca83 : 0xbba6ff);
      g.fillCircle(s.x + dx, s.y + 12, 2);
    }
    if (s.invulnerable > 0) {
      g.lineStyle(2, 0x8feaff, 0.55 + Math.sin(s.elapsed * 18) * 0.2);
      g.strokeCircle(s.x, s.y, 32);
    }
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
