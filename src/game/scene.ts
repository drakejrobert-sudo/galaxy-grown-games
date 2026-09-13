import Phaser from 'phaser';
import {
  createFlight, createGunner, createSpaceBattlePilot, stepFlight, stepGunner,
  stepSpaceBattlePilot, WIDTH, HEIGHT,
  GUNNER_DEFENSE_LINE, type Asteroid, type FlightConfig, type FlightState,
  type GunnerInput, type GunnerState, type Role, type Situation,
  type SpaceBattlePilotState, type EnemyShip, type EnemyShot, type FuelCell,
} from './rules';

export class FlightScene extends Phaser.Scene {
  flight = createFlight();
  gunner = createGunner();
  spacePilot = createSpaceBattlePilot();
  activeFlight = false;
  role: Role = 'Pilot';
  situation: Situation = 'Asteroid Field';
  config: FlightConfig = { total: 10, naturalOne: false };
  private graphics!: Phaser.GameObjects.Graphics;
  readInput: (x: number, y: number) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  readGunnerInput: () => GunnerInput = () => ({ firing: false });
  onFlightStep: (state: FlightState) => void = () => {};
  onGunnerStep: (state: GunnerState) => void = () => {};
  onSpacePilotStep: (state: SpaceBattlePilotState) => void = () => {};
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
    this.spacePilot = createSpaceBattlePilot();
    this.activeFlight = true;
  }

  update(_time: number, delta: number) {
    if (!this.graphics) return;
    if (this.activeFlight) {
      if (this.situation === 'Space Battle') {
        stepSpaceBattlePilot(this.spacePilot, this.config, this.readInput(this.spacePilot.x, this.spacePilot.y), delta / 1000);
        if (this.spacePilot.finished) this.activeFlight = false;
        this.onSpacePilotStep(this.spacePilot);
      } else if (this.role === 'Pilot') {
        stepFlight(this.flight, this.config, this.readInput(this.flight.x, this.flight.y), delta / 1000);
        if (this.flight.finished) this.activeFlight = false;
        this.onFlightStep(this.flight);
      } else {
        stepGunner(this.gunner, this.config, this.readGunnerInput(), delta / 1000);
        if (this.gunner.finished) this.activeFlight = false;
        this.onGunnerStep(this.gunner);
      }
    }
    this.paint();
  }

  private paint() {
    const g = this.graphics;
    g.clear();
    const elapsed = this.situation === 'Space Battle'
      ? this.spacePilot.elapsed
      : this.role === 'Pilot' ? this.flight.elapsed : this.gunner.elapsed;
    this.paintBackground(g, elapsed);
    if (this.situation === 'Space Battle') this.paintSpaceBattlePilotMode(g);
    else if (this.role === 'Pilot') this.paintPilotMode(g);
    else this.paintGunnerMode(g);
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
    for (let i = 0; i < 100; i++) {
      const x = (i * 137.5) % WIDTH;
      const y = ((i * 79.3) + elapsed * (12 + i % 3 * 8)) % HEIGHT;
      g.fillStyle(i % 3 ? 0x607999 : 0xc8e5ff, 0.8); g.fillCircle(x, y, i % 3 ? 1 : 1.6);
    }
    g.lineStyle(1, 0x344563); g.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);
  }

  private paintAsteroid(g: Phaser.GameObjects.Graphics, asteroid: Asteroid, armored = false, damaged = false) {
    g.lineStyle(asteroid.radius * 0.65, armored ? 0xc0785b : 0x95b6d0, 0.07);
    g.lineBetween(asteroid.x, asteroid.y, asteroid.x - (asteroid.vx ?? 0) * 0.18, asteroid.y - asteroid.speed * 0.18);
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

  private paintPlayerShip(g: Phaser.GameObjects.Graphics, x: number, y: number, elapsed: number) {
    const flame = this.config.naturalOne ? 0xffac64 : 0x71e4f5;
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

  private paintEnemyShip(g: Phaser.GameObjects.Graphics, enemy: EnemyShip, elapsed: number) {
    const x = enemy.x;
    const y = enemy.y;
    const enginePulse = 3 + Math.sin(elapsed * 28 + enemy.id) * 2;

    // Enemy craft fly downward, so their twin exhaust plumes stream upward.
    for (const dx of [-8, 8]) {
      g.fillStyle(0xff596f, 0.10); g.fillEllipse(x + dx, y - 19, 11, 24 + enginePulse);
      g.fillStyle(0xff6575, 0.8); g.fillTriangle(x + dx - 3, y - 10, x + dx + 3, y - 10, x + dx, y - 20 - enginePulse);
      g.fillStyle(0xffd0a8, 0.95); g.fillTriangle(x + dx - 1.5, y - 10, x + dx + 1.5, y - 10, x + dx, y - 16 - enginePulse);
    }
    g.fillStyle(0xff6575, 0.07); g.fillEllipse(x, y, 54, 42);

    // Swept wings, armored centerline, and panel seams create a compact fighter.
    g.fillStyle(0x4b3049); g.lineStyle(2, 0xe36f7f, 0.9);
    g.beginPath();
    g.moveTo(x, y + 18);
    g.lineTo(x - 8, y + 5);
    g.lineTo(x - 22, y + 9);
    g.lineTo(x - 16, y - 10);
    g.lineTo(x - 6, y - 7);
    g.lineTo(x, y - 15);
    g.lineTo(x + 6, y - 7);
    g.lineTo(x + 16, y - 10);
    g.lineTo(x + 22, y + 9);
    g.lineTo(x + 8, y + 5);
    g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0x7a4658); g.fillTriangle(x, y + 15, x - 7, y - 7, x + 7, y - 7);
    g.lineStyle(1, 0xffa2a9, 0.65);
    g.lineBetween(x - 17, y + 6, x - 7, y + 1);
    g.lineBetween(x + 17, y + 6, x + 7, y + 1);
    g.lineBetween(x, y + 13, x, y + 3);
    g.fillStyle(0x201d34); g.lineStyle(1, 0xffd2b2, 0.9);
    g.fillEllipse(x, y - 1, 8, 13); g.strokeEllipse(x, y - 1, 8, 13);
    g.fillStyle(0xffa85f, 0.9); g.fillEllipse(x, y + 1, 4, 7);
    g.fillStyle(0xff6575); g.fillCircle(x - 17, y + 7, 1.8); g.fillCircle(x + 17, y + 7, 1.8);
    g.fillStyle(0xffd66f, 0.9); g.fillCircle(x, y + 13, 1.5);
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
    const turretX = WIDTH / 2, turretY = HEIGHT - 30;
    if (s.beamTime > 0) {
      g.lineStyle(8, 0x79e1ce, 0.10); g.lineBetween(turretX, turretY, s.beamX, s.beamY);
      g.lineStyle(2, 0xd9fff6, 0.9); g.lineBetween(turretX, turretY, s.beamX, s.beamY);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(s.beamX, s.beamY, 5);
    }
    const angle = Math.atan2(s.crosshairY - turretY, s.crosshairX - turretX);
    g.fillStyle(0x31435f); g.lineStyle(2, 0x8facc7);
    g.fillRoundedRect(turretX - 30, turretY - 13, 60, 28, 8); g.strokeRoundedRect(turretX - 30, turretY - 13, 60, 28, 8);
    g.lineStyle(9, this.config.naturalOne ? 0xe29a62 : 0x91b7d5);
    g.lineBetween(turretX, turretY - 5, turretX + Math.cos(angle) * 27, turretY - 5 + Math.sin(angle) * 27);
    g.fillStyle(this.config.naturalOne ? 0xffac64 : 0x71e4f5); g.fillCircle(turretX, turretY - 4, 7);
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
}
