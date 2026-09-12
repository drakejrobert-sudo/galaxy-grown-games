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
    for (let i = 0; i < 70; i++) {
      const x = (i * 137.5) % WIDTH, y = ((i * 79.3) + s.elapsed * (12 + i % 3 * 8)) % HEIGHT;
      g.fillStyle(i % 3 ? 0x455879 : 0xa9c5eb, 0.8); g.fillCircle(x, y, i % 3 ? 1 : 1.6);
    }
    g.lineStyle(1, 0x23314e); g.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);
    for (const a of s.asteroids) {
      g.fillStyle(0x8c7183); g.lineStyle(2, 0xdbac95);
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4, r = a.radius * (i % 2 ? 0.85 : 1);
        const x = a.x + Math.cos(angle) * r, y = a.y + Math.sin(angle) * r;
        if (!i) g.moveTo(x,y); else g.lineTo(x,y);
      }
      g.closePath(); g.fillPath(); g.strokePath();
      g.fillStyle(0x624f65); g.fillCircle(a.x - a.radius * 0.2, a.y - a.radius * 0.15, a.radius * 0.25);
    }
    if (s.invulnerable && Math.floor(s.elapsed * 10) % 2 === 0) return;
    g.fillStyle(this.config.naturalOne ? 0xffbd78 : 0x71e4d1);
    g.fillTriangle(s.x - 5, s.y + 13, s.x + 5, s.y + 13, s.x, s.y + 24);
    g.fillStyle(0xe5ebff); g.lineStyle(2, 0xa395ed);
    g.fillTriangle(s.x, s.y - 18, s.x - 15, s.y + 13, s.x + 15, s.y + 13);
    g.strokeTriangle(s.x, s.y - 18, s.x - 15, s.y + 13, s.x + 15, s.y + 13);
    g.fillStyle(0x7d70d5); g.fillTriangle(s.x, s.y - 8, s.x - 5, s.y + 5, s.x + 5, s.y + 5);
  }
}
