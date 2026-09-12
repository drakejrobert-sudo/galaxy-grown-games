import Phaser from 'phaser';
import { createFlight, stepFlight, WIDTH, HEIGHT, type FlightConfig, type FlightState } from './rules';
export class FlightScene extends Phaser.Scene {
  flight = createFlight();
  activeFlight = false;
  config: FlightConfig = { total: 10, naturalOne: false };
  private graphics!: Phaser.GameObjects.Graphics;
  readInput: (x: number, y: number) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  onStep: (state: FlightState) => void = () => {};
  onReady: () => void = () => {};
  create() {
    this.graphics = this.add.graphics();
    this.paint();
    this.onReady();
  }
  begin(config: FlightConfig) { this.config = config; this.flight = createFlight(); this.activeFlight = true; }
  update(_time: number, delta: number) {
    if (!this.graphics) return;
    if (this.activeFlight) {
      stepFlight(this.flight, this.config, this.readInput(this.flight.x, this.flight.y), delta / 1000);
      if (this.flight.finished) this.activeFlight = false;
      this.onStep(this.flight);
    }
    this.paint();
  }
  private paint() {
    const g = this.graphics, s = this.flight;
    g.clear(); g.fillStyle(0x101528); g.fillRect(0, 0, WIDTH, HEIGHT);
    // Quiet layered nebulae keep the hazards readable on small screens.
    for (let i = 8; i > 0; i--) {
      g.fillStyle(0x47366b, 0.025); g.fillEllipse(90, 180, i * 60, i * 90);
      g.fillStyle(0x16546b, 0.025); g.fillEllipse(420, 430, i * 55, i * 70);
    }
    g.fillStyle(0x26364f); g.fillCircle(385, 100, 43);
    g.fillStyle(0x172338); g.fillCircle(397, 94, 38);
    g.lineStyle(1, 0x60839d, 0.25); g.strokeCircle(385, 100, 45);
    for (let i = 0; i < 100; i++) {
      const x = (i * 137.5) % WIDTH, y = ((i * 79.3) + s.elapsed * (12 + i % 3 * 8)) % HEIGHT;
      g.fillStyle(i % 3 ? 0x607999 : 0xc8e5ff, 0.8); g.fillCircle(x, y, i % 3 ? 1 : 1.6);
    }
    g.lineStyle(1, 0x344563); g.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);
    for (const a of s.asteroids) {
      g.lineStyle(a.radius * 0.65, 0x95b6d0, 0.07);
      g.lineBetween(a.x, a.y, a.x - (a.vx ?? 0) * 0.18, a.y - a.speed * 0.18);
      g.fillStyle(0x897c88); g.lineStyle(2, 0xc5b4ad);
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5 + (a.rotation ?? 0), r = a.radius * (i % 2 ? 0.85 : 1);
        const x = a.x + Math.cos(angle) * r, y = a.y + Math.sin(angle) * r;
        if (!i) g.moveTo(x,y); else g.lineTo(x,y);
      }
      g.closePath(); g.fillPath(); g.strokePath();
      for (let i = 0; i < 3; i++) {
        const angle = i * 2.1 + (a.rotation ?? 0);
        const x = a.x + Math.cos(angle) * a.radius * 0.42;
        const y = a.y + Math.sin(angle) * a.radius * 0.42;
        g.fillStyle(0x514b60); g.fillCircle(x, y, a.radius * (0.17 + i * 0.025));
        g.lineStyle(1, 0xb0a0a2, 0.7); g.strokeCircle(x - 1, y - 1, a.radius * (0.17 + i * 0.025));
      }
      g.lineStyle(1, 0xd6c7b9, 0.6);
      g.lineBetween(a.x - a.radius * 0.6, a.y - a.radius * 0.4, a.x - a.radius * 0.2, a.y - a.radius * 0.7);
    }
    if (s.invulnerable) {
      g.lineStyle(2, 0x8feaff, 0.5); g.strokeCircle(s.x, s.y, 26);
    }
    if (s.invulnerable && Math.floor(s.elapsed * 10) % 2 === 0) return;
    const flame = this.config.naturalOne ? 0xffac64 : 0x71e4f5;
    const pulse = 5 + Math.sin(s.elapsed * 40) * 3;
    for (const dx of [-8, 8]) {
      g.fillStyle(flame, 0.12); g.fillEllipse(s.x + dx, s.y + 22, 15, 30 + pulse);
      g.fillStyle(flame); g.fillTriangle(s.x + dx - 3, s.y + 10, s.x + dx + 3, s.y + 10, s.x + dx, s.y + 25 + pulse);
      g.fillStyle(0xf4fbff); g.fillTriangle(s.x + dx - 1.5, s.y + 11, s.x + dx + 1.5, s.y + 11, s.x + dx, s.y + 21);
    }
    g.fillStyle(0x687c9c); g.lineStyle(1, 0xa8c5df);
    g.fillTriangle(s.x, s.y - 9, s.x - 17, s.y + 14, s.x + 17, s.y + 14);
    g.strokeTriangle(s.x, s.y - 9, s.x - 17, s.y + 14, s.x + 17, s.y + 14);
    g.fillStyle(0xdde7ee); g.fillTriangle(s.x, s.y - 19, s.x - 8, s.y + 12, s.x + 8, s.y + 12);
    g.fillStyle(0x7e94b5); g.fillTriangle(s.x, s.y - 19, s.x, s.y + 12, s.x + 8, s.y + 12);
    g.fillStyle(0x62dcec); g.fillEllipse(s.x, s.y - 3, 7, 13);
    g.lineStyle(1, 0xe8ffff); g.lineBetween(s.x - 1, s.y - 8, s.x - 2, s.y - 2);
    g.fillStyle(0xff9a9f); g.fillCircle(s.x - 13, s.y + 11, 1.5);
    g.fillStyle(0x8cffe0); g.fillCircle(s.x + 13, s.y + 11, 1.5);
  }
}
