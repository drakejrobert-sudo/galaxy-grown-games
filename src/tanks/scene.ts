import Phaser from 'phaser';
import { WIDTH, HEIGHT, ground, active, muzzle, STEP, step, type Match, type Aim } from './rules';

export const COLORS = [0x63ecbc, 0xffb86d, 0x82bfff, 0xf591c7, 0xffdd78, 0xbf9aff, 0x92e6ed, 0xec966f];
export function battlefield(parent: HTMLElement, match: Match, aim: Aim, paused: () => boolean, onResult: () => void) {
  class Hills extends Phaser.Scene {
    private ink!: Phaser.GameObjects.Graphics;
    private labels!: Phaser.GameObjects.Text[];
    private remainder = 0;
    create() {
      this.ink = this.add.graphics();
      this.labels = match.tanks.map((_,i) => this.add.text(0, 0, String(i + 1), {
        fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#10212f', strokeThickness: 4
      }).setOrigin(.5,1));
    }
    update(_time: number, delta: number) {
      if (match.phase === 'shot' && !paused()) {
        this.remainder += Math.min(delta / 1000, .1);
        while (this.remainder >= STEP && match.phase === 'shot') {
          step(match);
          this.remainder -= STEP;
        }
        if (match.phase !== 'shot') { this.remainder = 0; onResult(); }
      }
      const g = this.ink;
      g.clear();
      g.fillGradientStyle(0x101e39, 0x142842, 0x476979, 0x527a80, 1);
      g.fillRect(0,0,WIDTH,HEIGHT);
      for (let i = 0; i < 80; i++) {
        g.fillStyle(0xdaf2e8, .35 + (i % 4) / 8);
        g.fillCircle((i * 137 + 67) % WIDTH, (i * 67 + 11) % 193, i % 5 ? 1 : 1.5);
      }
      g.fillStyle(0xdbc7a5); g.fillCircle(637,79,30);
      g.lineStyle(4,0xdcbb91,.8); g.lineBetween(588,99,688,59);
      for (let layer = 0; layer < 2; layer++) {
        g.fillStyle(layer ? 0x385363 : 0x314559);
        g.beginPath(); g.moveTo(0,HEIGHT);
        for (let x = 0; x <= WIDTH; x += 5) {
          g.lineTo(x, 204 + layer * 33 + 17 * Math.sin(x / 61 + layer) + 12 * Math.cos(x / 39 + layer));
        }
        g.lineTo(WIDTH,HEIGHT); g.closePath(); g.fillPath();
      }
      g.fillStyle(0x674741); g.beginPath(); g.moveTo(0, HEIGHT);
      for (let x = 0; x < WIDTH; x++) g.lineTo(x, match.terrain[x]);
      g.lineTo(WIDTH, HEIGHT); g.closePath(); g.fillPath();
      for (const [depth,color] of [[0,0xe7ac75],[5,0xb97e60],[17,0x865d50],[42,0x76524a]]) {
        g.lineStyle(depth ? 2 : 3,color); g.beginPath();
        for (let x = 0; x < WIDTH; x+=2) {
          const y = match.terrain[x] + depth + (depth ? Math.sin(x / 30) * depth / 8 : 0);
          if (x) g.lineTo(x,y); else g.moveTo(x,y);
        }
        g.strokePath();
      }
      match.tanks.forEach((t,i) => {
        const y = ground(match,t.x), current = i === active(match);
        this.labels[i].setScale(Math.max(1, WIDTH / Math.max(1, this.scale.displaySize.width) * .8))
          .setVisible(t.hull > 0).setPosition(t.x,y - 20);
        if (!t.hull) return;
        if (!current) {
          const facing = t.x < WIDTH / 2 ? 1 : -1;
          g.lineStyle(3,COLORS[i]); g.lineBetween(t.x,y-10,t.x+13*facing,y-16);
        } else {
          g.lineStyle(2,0xffffff); g.strokeEllipse(t.x,y+1,36,8);
          const barrel = muzzle(match,aim);
          g.lineStyle(4,COLORS[i]); g.lineBetween(t.x,y-10,barrel.x,barrel.y);
        }
        g.fillStyle(0x162633); g.fillRoundedRect(t.x-12,y-7,24,8,4);
        g.fillStyle(COLORS[i]); g.fillRoundedRect(t.x-10,y-12,20,7,3); g.fillCircle(t.x,y-12,5);
        g.fillStyle(0x89939a);
        for (const offset of [-7,0,7]) g.fillCircle(t.x+offset,y-3,2);
      });
      for (const s of match.shells) {
        if (s.y < 6) {
          g.fillStyle(0xffdf91); g.fillTriangle(s.x,2,s.x-5,11,s.x+5,11);
        } else {
          g.lineStyle(3,0xffc97a,.8); g.lineBetween(s.x-s.vx*.025,s.y-s.vy*.025,s.x,s.y);
          g.fillStyle(0xfff0ac); g.fillCircle(s.x,s.y,4);
        }
      }
      for (const b of match.blasts) {
        const age = 1 - b.life / .36;
        g.fillStyle(0xffca70,.5*(1-age)); g.fillCircle(b.x,b.y,b.radius*(.55+.45*age));
        g.lineStyle(3,0xffe8a5,1-age); g.strokeCircle(b.x,b.y,b.radius*(.55+.45*age));
      }
    }
  }
  return new Phaser.Game({type: Phaser.AUTO, parent, width: WIDTH, height: HEIGHT,
    scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH},
    audio: {noAudio:true}, scene: Hills, banner:false, backgroundColor:'#142842'});
}
