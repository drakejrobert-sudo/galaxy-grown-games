import Phaser from 'phaser';
import { WIDTH, HEIGHT, active, defaultDirection, muzzle, tankSurface, BLAST_LIFE, STEP, step, type Ammo, type Match, type Aim, type Tank } from './rules';
import { planetSurface, type Planet } from './terrain';

export const COLORS = [0x63ecbc, 0xffb86d, 0x82bfff, 0xf591c7, 0xffdd78, 0xbf9aff, 0x92e6ed, 0xec966f];
const PLANET_COLORS = [
  {rim: 0xeaa286, crust: 0x8f564d, mantle: 0x573440},
  {rim: 0xb9c5f9, crust: 0x676399, mantle: 0x39375d},
  {rim: 0x8ed7c6, crust: 0x4c8b88, mantle: 0x29495b},
];
const PAYLOADS = {
  standard: {color: 0x73e6ff, core: 0xe6ffff, trail: 17, width: 3, length: 7},
  heavy: {color: 0xffa34f, core: 0xffedc3, trail: 24, width: 5, length: 9},
  starburst: {color: 0xef86ff, core: 0xffedff, trail: 21, width: 4, length: 7},
} satisfies Record<Ammo, {color: number; core: number; trail: number; width: number; length: number}>;

type Ink = Phaser.GameObjects.Graphics;
type Point = {x: number; y: number};
type Offset = readonly [side: number, up: number];

function shape(g: Ink, color: number, position: (side: number, up: number) => Point, vertices: Offset[], alpha = 1) {
  const points = vertices.map(([side, up]) => position(side, up));
  g.fillStyle(color, alpha).fillPoints(points, true);
}

function paintSky(g: Ink, planetBattle: boolean, moon: boolean) {
  g.fillGradientStyle(0x080e23, 0x121b35, 0x2d3451, 0x242a48, 1);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  let seed = 431;
  const starCoordinate = (size: number) => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296 * size;
  };
  for (let i = 0; i < 106; i++) {
    g.fillStyle(i % 7 ? 0xc8e3ff : 0xffdeb1, .28 + (i % 5) / 9);
    g.fillCircle(starCoordinate(WIDTH), starCoordinate(HEIGHT), i % 11 ? 1 : 1.7);
  }
  if (planetBattle) return;
  g.fillStyle(moon ? 0x525a97 : 0xa3717e).fillCircle(637, 86, moon ? 39 : 29);
  g.lineStyle(3, 0xdcbb91, .7).lineBetween(594, 104, 680, 67);
  for (let layer = 0; layer < 2; layer++) {
    g.fillStyle(layer ? 0x3e405a : 0x30334e);
    g.beginPath();
    g.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 5) {
      g.lineTo(x, 216 + layer * 29 + 17 * Math.sin(x / 61 + layer) + 12 * Math.cos(x / 39 + layer));
    }
    g.lineTo(WIDTH, HEIGHT);
    g.closePath();
    g.fillPath();
  }
}

function paintGround(g: Ink, match: Match) {
  const moon = match.battlefield === 'moon';
  g.fillStyle(moon ? 0x49546f : 0x674741);
  g.beginPath();
  g.moveTo(0, HEIGHT);
  match.terrain.forEach((y, x) => g.lineTo(x, y));
  g.lineTo(WIDTH, HEIGHT);
  g.closePath();
  g.fillPath();
  for (const [depth, color] of moon
    ? [[0, 0xbfcef3], [7, 0x8596bc], [24, 0x647394], [42, 0x565f7d]]
    : [[0, 0xe7ac75], [5, 0xb97e60], [17, 0x865d50], [42, 0x76524a]]) {
    g.lineStyle(depth ? 2 : 3, color);
    g.beginPath();
    for (let x = 0; x < WIDTH; x += 2) {
      const y = match.terrain[x] + depth + Math.sin(x / 30) * depth / 8;
      if (x) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.strokePath();
  }
}

function paintPlanet(g: Ink, planet: Planet, palette: typeof PLANET_COLORS[number]) {
  const edge = planet.surface.map((_, i) => planetSurface(planet, i));
  g.fillStyle(palette.rim, .08).fillCircle(planet.x, planet.y, planet.radius + 6);
  g.fillStyle(palette.crust).fillPoints(edge, true);
  g.fillStyle(palette.mantle, .76).fillPoints(edge.map((point, i) => {
    const angle = i * 2 * Math.PI / edge.length;
    const scale = .84 + .1 * Math.cos(angle - .8) + .04 * Math.cos(angle * 5);
    return {x: planet.x + (point.x - planet.x) * scale, y: planet.y + (point.y - planet.y) * scale};
  }), true);
  const {x, y, radius} = planet;
  const feature = (dx: number, dy: number, w: number, h: number, color: number, alpha: number) =>
    g.fillStyle(color, alpha).fillEllipse(x + dx * radius, y + dy * radius, w * radius, h * radius);
  feature(-.15, -.15, .47, .23, palette.rim, .22);
  feature(-.15, -.17, .39, .17, palette.crust, .85);
  feature(.23, .18, .25, .18, palette.rim, .24);
  feature(.23, .16, .19, .12, palette.crust, .85);
  feature(.16, -.23, .14, .13, palette.rim, .22);
  g.lineStyle(2, palette.rim, .88).strokePoints(edge, true);
}

function paintTank(g: Ink, match: Match, tank: Tank, aim: Aim, color: number, current: boolean) {
  const {x, y, nx, ny} = tankSurface(match, tank);
  const local = (side: number, up: number) => ({x: x - ny * side + nx * up, y: y + nx * side + ny * up});
  if (current) {
    const p = local(-17, -2), q = local(17, -2);
    g.lineStyle(2, 0xffffff, .9).lineBetween(p.x, p.y, q.x, q.y);
  }
  shape(g, 0x111b2d, local, [[-12, 0], [-12, 5], [-8, 9], [8, 9], [12, 5], [12, 0]]);
  shape(g, color, local, [[-12, 5], [-7, 11], [7, 11], [12, 5], [8, 4], [-8, 4]]);
  shape(g, 0x31455d, local, [[-6, 10], [-4, 15], [4, 15], [6, 10]]);
  for (const side of [-8, 0, 8]) {
    const light = local(side, 2);
    g.fillStyle(color, .85).fillCircle(light.x, light.y, 1.4);
  }
  const mount = local(0, 10), tip = muzzle(match, aim, tank);
  g.lineStyle(6, 0x121e34).lineBetween(mount.x, mount.y, tip.x, tip.y);
  g.lineStyle(current ? 3 : 2, color).lineBetween(mount.x, mount.y, tip.x, tip.y);
  g.fillStyle(0xe9faff).fillCircle(tip.x, tip.y, current ? 2 : 1.4);
  g.fillStyle(color).fillCircle(mount.x, mount.y, 3);
}

function paintPayload(g: Ink, shell: Match['shells'][number], ammo: Ammo) {
  const {color, core, trail, width, length} = PAYLOADS[ammo];
  const {x, y, vx, vy} = shell;
  if (y < 6) {
    g.fillStyle(color).fillTriangle(x, 2, x - 5, 11, x + 5, 11);
    return;
  }
  const speed = Math.hypot(vx, vy);
  const dx = speed ? vx / speed : 1, dy = speed ? vy / speed : 0;
  const local = (along: number, across: number) => ({x: x + dx * along - dy * across, y: y + dy * along + dx * across});
  shape(g, color, local, [[-trail, 0], [-6, -width], [2, 0], [-6, width]], .56);
  if (ammo === 'heavy') {
    shape(g, color, local, [[-7,-5], [3,-5], [length,0], [3,5], [-7,5]]);
    shape(g, core, local, [[-5,-2], [4,-2], [length,0], [4,2], [-5,2]]);
  } else if (ammo === 'starburst') {
    shape(g, color, local, [[-7,0], [-2,-2], [0,-6], [2,-2], [length,0], [2,2], [0,6], [-2,2]]);
    g.fillStyle(core).fillCircle(x, y, 2.5);
  } else {
    shape(g, core, local, [[-5,0], [0,-2.5], [length,0], [0,2.5]]);
  }
}

export function battlefield(parent: HTMLElement, match: Match, aim: Aim, paused: () => boolean, onResult: () => void) {
  class Hills extends Phaser.Scene {
    private terrain!: Ink;
    private ink!: Ink;
    private labels!: Phaser.GameObjects.Text[];
    private remainder = 0;

    create() {
      paintSky(this.add.graphics(), match.planets.length > 0, match.battlefield === 'moon');
      this.terrain = this.add.graphics();
      this.paintTerrain();
      this.ink = this.add.graphics();
      this.labels = match.tanks.map((_, i) => this.add.text(0, 0, String(i + 1), {
        fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#10212f', strokeThickness: 4,
      }).setOrigin(.5, .5));
    }

    private paintTerrain() {
      this.terrain.clear();
      if (match.planets.length) {
        match.planets.forEach((planet, i) => paintPlanet(this.terrain, planet, PLANET_COLORS[i]));
      } else {
        paintGround(this.terrain, match);
      }
    }

    update(_time: number, delta: number) {
      if (match.phase === 'shot' && !paused()) {
        const impacts = match.impacts;
        this.remainder += Math.min(delta / 1000, .1);
        while (this.remainder >= STEP && match.phase === 'shot') {
          step(match);
          this.remainder -= STEP;
        }
        if (match.impacts !== impacts) this.paintTerrain();
        if (match.phase !== 'shot') { this.remainder = 0; onResult(); }
      }
      const g = this.ink;
      g.clear();
      match.tanks.forEach((tank, i) => {
        const {x, y, nx, ny} = tankSurface(match, tank);
        const current = i === active(match) && match.phase !== 'over';
        this.labels[i].setScale(Math.max(1, WIDTH / Math.max(1, this.scale.displaySize.width) * .8))
          .setVisible(tank.hull > 0).setPosition(x + nx * 32, y + ny * 32);
        if (tank.hull) paintTank(g, match, tank, current ? aim : {
          direction: defaultDirection(match, tank), angle: tank.angle, power: tank.power, ammo: 'standard',
        }, COLORS[i], current);
      });
      for (const shell of match.shells) paintPayload(g, shell, match.ammo);
      for (const blast of match.blasts) {
        const age = 1 - blast.life / BLAST_LIFE;
        const radius = blast.radius * (.55 + .45 * age);
        const {color, core} = PAYLOADS[match.ammo];
        g.fillStyle(color, .48 * (1 - age)).fillCircle(blast.x, blast.y, radius);
        g.lineStyle(3, core, 1 - age).strokeCircle(blast.x, blast.y, radius);
      }
    }
  }
  return new Phaser.Game({type: Phaser.AUTO, parent, width: WIDTH, height: HEIGHT,
    scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH},
    audio: {noAudio: true}, scene: Hills, banner: false, backgroundColor: '#101e39'});
}
