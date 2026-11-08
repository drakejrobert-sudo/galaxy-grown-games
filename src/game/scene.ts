import Phaser from 'phaser';
import type { InputFrame } from './input';
import {
  createBoardingPilot, stepBoardingPilot, boardingPilotAttackPosition, BOARDING_PILOT_FORWARD_SPEED, type BoardingPilotState,
  createBoarding, stepBoarding, BOARDING_INTERIOR_SLOTS, BOARDING_DEPTHS, boardingCover, boardingBoarderPose, boardingAirlockTargetActive, BOARDING_AIRLOCK_TARGETS, BOARDING_EJECTION_TIME, BOARDING_VENT_WARNING, BOARDING_VENT_RECHARGE, difficultyFor, BOARDING_LINE, BOARDING_CYCLE, BOARDING_WARNING, BOARDING_CARRIER_RADIUS, boardingTurretPose, boardingTurretBreachSoon, BOARDING_MINE_LIFETIME, BOARDING_BLAST_RADIUS, type BoardingState, type BoardingInput,
  createSpaceGunner, stepSpaceGunner, SPACE_GUNNER_DEFENSE_LINE, type SpaceGunnerInput, type SpaceGunnerState, type SpaceGunnerAttacker,
  gunnerTargetAt, gunnerFireEvery, GUNNER_SHOT_FEEDBACK_SECONDS, type GunnerShotFeedback,
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
  boarding = createBoarding('Gunner');
  boardingPilot = createBoardingPilot({ total: 10, naturalOne: false });
  onBoardingPilotStep: (state: BoardingPilotState) => void = () => {};
  readBoardingFrame: () => InputFrame<BoardingInput> = () => ({ first: {x:0,y:0,firing:false}, continued: {x:0,y:0,firing:false} });
  onBoardingStep: (state: BoardingState) => void = () => {};
  flight = createFlight();
  gunner = createGunner();
  spaceGunner = createSpaceGunner();
  bomber = createBomber();
  lifeSupport = createLifeSupport();
  spacePilot = createSpaceBattlePilot();
  spaceBomber = createSpaceBattleBomber();
  spaceLife = createSpaceLifeSupport();
  private artPool: Phaser.GameObjects.Image[] = [];
  private artUsed = 0;
  private interiorLayers: Phaser.GameObjects.Graphics[] = [];
  private interiorUsed = 0;
  private graphicsLayer(depth: number) {
    const layer = this.interiorLayers[this.interiorUsed] ?? this.add.graphics();
    this.interiorLayers[this.interiorUsed++] = layer;
    layer.setDepth(depth).setVisible(true);
    return layer;
  }
  private interiorDepth(y: number) { return -1.9 + y / 600; }

  private doorMasks: { shape: Phaser.GameObjects.Graphics; mask: Phaser.Display.Masks.GeometryMask }[] = [];
  private airlockOutline(side: number) {
    // Fits the recessed leaf surfaces in the corridor texture, in logical canvas coordinates.
    return [[12,114],[22,101],[76,141],[90,179],[90,350],[21,395],[12,366]]
      .map(([x,y]) => ({ x: side ? WIDTH - x : x, y }));
  }

  private paintAirlockPanels(side: number, opening: number) {
    if (!this.hasArt('boarding-corridor')) return false;
    let clip = this.doorMasks[side];
    if (!clip) {
      const shape = this.add.graphics().setVisible(false);
      shape.fillStyle(0xffffff).fillPoints(this.airlockOutline(side), true);
      clip = this.doorMasks[side] = { shape, mask: shape.createGeometryMask() };
    }
    const minX = side ? 390 : 12, maxX = side ? 468 : 90, seam = (minX + maxX) / 2;
    for (const half of [0,1]) {
      const slide = (half ? 1 : -1) * 45 * opening;
      this.drawArt('boarding-corridor', WIDTH / 2 + slide, HEIGHT / 2, WIDTH, HEIGHT, 0, 1, false, -1.94);
      const panel = this.artPool[this.artUsed - 1];
      const textureWidth = panel.frame?.realWidth ?? 640, textureHeight = panel.frame?.realHeight ?? 800;
      const x = half ? seam : minX, width = half ? maxX - seam : seam - minX;
      panel.setCrop(x / WIDTH * textureWidth, 100 / HEIGHT * textureHeight,
        width / WIDTH * textureWidth, 296 / HEIGHT * textureHeight).setMask(clip.mask);
    }
    return true;
  }

  private paintCargo(x: number, y: number, scale: number) {
    const g = this.graphicsLayer(this.interiorDepth(y + 1));
    // Two weight-bearing cases: smaller top case sits flush on the wider base.
    g.fillStyle(0x00070d, .5);
    g.fillEllipse(x, y + 83 * scale, 98 * scale, 15 * scale);
    for (const [width, top, height] of [[80, 44, 36], [64, 14, 30]]) {
      const left = x - width * scale / 2, right = x + width * scale / 2;
      const t = y + top * scale, bottom = t + height * scale, bevel = 8 * scale;
      const skew = x < WIDTH / 2 ? bevel : -bevel, side = x < WIDTH / 2 ? right : left;
      g.fillStyle(0x23303a); g.fillRect(left, t, width * scale, height * scale);
      g.fillStyle(0x586975); g.fillTriangle(left, t, left + skew, t - bevel, right + skew, t - bevel);
      g.fillTriangle(left, t, right + skew, t - bevel, right, t);
      g.fillStyle(0x17232c); g.fillTriangle(side, t, side + skew, t - bevel, side + skew, bottom - bevel);
      g.fillTriangle(side, t, side + skew, bottom - bevel, side, bottom);
      g.lineStyle(Math.max(1, 1.5 * scale), 0x8c9ba1, .8); g.strokeRect(left, t, width * scale, height * scale);
      g.lineStyle(3 * scale, 0x111c25); g.lineBetween(left + 8 * scale, t + 7 * scale, right - 8 * scale, t + 7 * scale);
      g.lineStyle(2 * scale, 0x61717b); g.lineBetween(left + 8 * scale, bottom - 6 * scale, right - 8 * scale, bottom - 6 * scale);
      for (const edge of [left + 9 * scale, right - 13 * scale]) {
        g.fillStyle(0x927e58); g.fillRect(edge, t + 1, 4 * scale, height * scale - 2);
        g.fillStyle(0xc0b494); g.fillRect(edge - scale, t + 12 * scale, 6 * scale, 4 * scale);
      }
      g.fillStyle(0xb7c4c3); g.fillRect(x - 8 * scale, t + 15 * scale, 16 * scale, 7 * scale);
      g.lineStyle(scale, 0x31434c); g.lineBetween(x - 6 * scale, t + 18 * scale, x + 5 * scale, t + 18 * scale);
    }
  }
  private labelPool: Phaser.GameObjects.Text[] = [];
  private labelsUsed = 0;

  preload() {
    // Only the game runtime requests these assets; setup remains lightweight.
    for (const name of ['space', 'interior', 'player', 'enemy', 'asteroid', 'boarding-carrier', 'boarding-probe', 'boarding-shuttle', 'boarding-corridor', 'boarding-boarder', 'boarding-rifle',
      'boarding-turret-canopy', 'boarding-turret-carrier', 'boarding-turret-probe', 'boarding-turret-shuttle']) {
      this.load.image(`illustrated-${name}`, new URL(`art/${name}.webp`, document.baseURI).href);
    }
  }

  private hasArt(name: string) { return this.textures?.exists(`illustrated-${name}`) ?? false; }

  private drawArt(name: string, x: number, y: number, width: number, height: number, rotation = 0, alpha = 1, background = false, depth = background ? -3 : -1) {
    if (!this.hasArt(name)) return false;
    const image = this.artPool[this.artUsed] ?? this.add.image(0, 0, `illustrated-${name}`);
    this.artPool[this.artUsed++] = image;
    // Images move between pooled roles; never retain a previous door crop or mask.
    image.setCrop?.(); image.clearMask?.();
    image.setTexture(`illustrated-${name}`).setPosition(x, y).setDisplaySize(width, height)
      .setRotation(rotation).setAlpha(alpha).setDepth(depth).setVisible(true);
    return true;
  }

  private drawLabel(text: string, x: number, y: number, size = 12, color = '#e7edf9') {
    if (typeof this.add.text !== 'function') return; // Graphics-only test/fallback harnesses.
    const label = this.labelPool[this.labelsUsed] ?? this.add.text(0,0,'',{ fontFamily:'Arial, sans-serif',fontSize:size,fontStyle:'bold',color,backgroundColor:'#101528',padding:{x:3,y:2} });
    this.labelPool[this.labelsUsed++] = label;
    label.setText(text).setPosition(x,y).setOrigin(.5).setFontSize(size).setColor(color).setDepth(2).setVisible(true);
  }

  private playing = false;
  private timingPrimed = false;
  get activeFlight() { return this.playing; }
  set activeFlight(value: boolean) {
    if (value !== this.playing) this.timingPrimed = false;
    this.playing = value;
  }
  onTimingInterruption: () => void = () => {};
  role: Role = 'Pilot';
  situation: Situation = 'Asteroid Field';
  config: FlightConfig = { total: 10, naturalOne: false };
  private graphics!: Phaser.GameObjects.Graphics;
  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  // Read the live preference without adding listeners or an independent animation clock.
  private reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  private decorativeTime(elapsed: number) {
    return this.reducedMotion?.matches ? 0 : elapsed;
  }
  readInput: (x: number, y: number) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  readSpaceGunnerFrame: () => InputFrame<SpaceGunnerInput> = () => ({ first: { x: 0, y: 0, firing: false }, continued: { x: 0, y: 0, firing: false } });
  readGunnerFrame: () => InputFrame<GunnerInput> = () => ({ first: { firing: false }, continued: { firing: false } });
  readBomberFrame: () => InputFrame<BomberInput> = () => ({ first: { placing: false }, continued: { placing: false } });
  readLifeSupportInput: () => LifeSupportInput = () => ({ route: 'Shields' });
  readSpaceBomberFrame: () => InputFrame<SpaceBattleBomberInput> = () => ({ first: { placing: false }, continued: { placing: false } });
  readSpaceLifeFrame: () => InputFrame<SpaceLifeInput> = () => ({ first: { x: 0, jump: false }, continued: { x: 0, jump: false } });
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
    this.backgroundGraphics = this.add.graphics();
    this.backgroundGraphics.setDepth(-2);
    this.graphics = this.add.graphics();
    this.paint();
    this.onReady();
  }

  begin(config: FlightConfig, situation: Situation = 'Asteroid Field', role: Role = 'Pilot') {
    this.config = config;
    this.situation = situation;
    this.role = role;
    if (situation === 'Boarding Party' && role === 'Pilot') this.boardingPilot = createBoardingPilot(config);
    else if (situation === 'Boarding Party' && role !== 'Pilot') this.boarding = createBoarding(role);
    this.flight = createFlight();
    this.gunner = createGunner();
    this.spaceGunner = createSpaceGunner();
    this.bomber = createBomber();
    this.lifeSupport = createLifeSupport();
    this.spacePilot = createSpaceBattlePilot();
    this.spaceBomber = createSpaceBattleBomber();
    this.spaceLife = createSpaceLifeSupport();
    this.timingPrimed = false;
    this.activeFlight = true;
  }

  update(_time: number, _delta: number) {
    if (!this.graphics) return;
    if (this.activeFlight) {
      // Phaser's delivered delta is smoothed/clamped; simulation needs active wall time.
      const milliseconds = this.game.loop.rawDelta;
      if (!this.timingPrimed) {
        this.timingPrimed = true;
      } else if (Number.isFinite(milliseconds) && milliseconds > 0) {
        if (milliseconds > 250) {
          this.activeFlight = false;
          this.onTimingInterruption();
        } else {
          this.advanceFrame(milliseconds);
        }
      }
    }
    this.paint();
  }

  private advanceFrame(milliseconds: number) {
    if (this.situation === 'Boarding Party' && this.role === 'Pilot') {
      const s = this.boardingPilot;
      for (let offset = 0; offset < milliseconds && !s.endReason; offset += 50) {
        stepBoardingPilot(s, this.config, this.readInput(s.x, s.y), Math.min(50, milliseconds - offset) / 1000);
      }
      if (s.endReason) this.activeFlight = false;
      this.onBoardingPilotStep(s);
      return;
    }
    if (this.situation === 'Boarding Party') {
      if (this.boarding.finished) { this.activeFlight = false; return; }
      const frame = this.readBoardingFrame();
      for (let i = 0; i < Math.ceil(milliseconds / 50); i++) {
        const input = i === 0 ? frame.first : frame.continued;
        stepBoarding(this.boarding, this.config, input,
          Math.min(50, milliseconds - i * 50) / 1000);
        if (this.boarding.finished) { this.activeFlight = false; break; }
      }
      this.onBoardingStep(this.boarding); return;
    }
    const space = this.situation === 'Space Battle';
    const state = space
      ? this.role === 'Pilot' ? this.spacePilot : this.role === 'Gunner' ? this.spaceGunner
        : this.role === 'Bomber' ? this.spaceBomber : this.spaceLife
      : this.role === 'Pilot' ? this.flight : this.role === 'Gunner' ? this.gunner
        : this.role === 'Bomber' ? this.bomber : this.lifeSupport;
    if (state.finished) { this.activeFlight = false; return; }
    // Snapshot destructive reads once. Pilot's direction read is pure and position-dependent.
    const frame = this.role === 'Gunner' ? space ? this.readSpaceGunnerFrame() : this.readGunnerFrame()
      : this.role === 'Bomber' ? space ? this.readSpaceBomberFrame() : this.readBomberFrame()
        : space && this.role === 'Life Support' ? this.readSpaceLifeFrame() : null;
    const route = !space && this.role === 'Life Support' ? this.readLifeSupportInput() : null;
    const count = Math.ceil(milliseconds / 50);
    for (let index = 0; index < count; index++) {
      const seconds = Math.min(50, milliseconds - index * 50) / 1000;
      const input = index === 0 ? frame?.first : frame?.continued;
      if (space) {
        if (this.role === 'Life Support') stepSpaceLifeSupport(this.spaceLife, this.config, input as SpaceLifeInput, seconds);
        else if (this.role === 'Gunner') stepSpaceGunner(this.spaceGunner, this.config, input as SpaceGunnerInput, seconds);
        else if (this.role === 'Bomber') stepSpaceBattleBomber(this.spaceBomber, this.config, input as SpaceBattleBomberInput, seconds);
        else stepSpaceBattlePilot(this.spacePilot, this.config, this.readInput(this.spacePilot.x, this.spacePilot.y), seconds);
      } else if (this.role === 'Pilot') stepFlight(this.flight, this.config, this.readInput(this.flight.x, this.flight.y), seconds);
      else if (this.role === 'Gunner') stepGunner(this.gunner, this.config, input as GunnerInput, seconds);
      else if (this.role === 'Bomber') stepBomber(this.bomber, this.config, input as BomberInput, seconds);
      else stepLifeSupport(this.lifeSupport, this.config, route!, seconds);
      if (state.finished) { this.activeFlight = false; break; }
    }
    if (space) {
      if (this.role === 'Life Support') this.onSpaceLifeStep(this.spaceLife);
      else if (this.role === 'Gunner') this.onSpaceGunnerStep(this.spaceGunner);
      else if (this.role === 'Bomber') this.onSpaceBomberStep(this.spaceBomber);
      else this.onSpacePilotStep(this.spacePilot);
    } else if (this.role === 'Pilot') this.onFlightStep(this.flight);
    else if (this.role === 'Gunner') this.onGunnerStep(this.gunner);
    else if (this.role === 'Bomber') this.onBomberStep(this.bomber);
    else this.onLifeSupportStep(this.lifeSupport);
  }

  private paint() {
    const g = this.graphics;
    g.clear();
    this.backgroundGraphics.clear();
    this.artUsed = 0;
    this.labelsUsed = 0;
    for (const layer of this.interiorLayers) layer.clear().setVisible(false);
    this.interiorUsed = 0;
    const cockpit = this.situation === 'Boarding Party' && this.role === 'Pilot';
    const elapsed = cockpit ? this.boardingPilot.elapsed : this.situation === 'Boarding Party' ? this.boarding.elapsed : this.situation === 'Space Battle'
      ? this.role === 'Life Support' ? this.spaceLife.elapsed : this.role === 'Bomber' ? this.spaceBomber.elapsed : this.role === 'Gunner' ? this.spaceGunner.elapsed : this.spacePilot.elapsed
      : this.role === 'Pilot' ? this.flight.elapsed
        : this.role === 'Gunner' ? this.gunner.elapsed
          : this.role === 'Bomber' ? this.bomber.elapsed : this.lifeSupport.elapsed;
    this.paintBackground(this.backgroundGraphics, this.role === 'Pilot' || this.role === 'Bomber' || (this.situation === 'Boarding Party' && this.role === 'Gunner') || (this.situation === 'Asteroid Field' && (this.role === 'Gunner' || this.role === 'Life Support')) ? this.decorativeTime(elapsed) : elapsed);
    if (cockpit) this.paintBoardingPilot(g);
    else if (this.situation === 'Boarding Party' && this.role === 'Gunner') this.paintBoardingTurret();
    else if (this.situation === 'Boarding Party') this.paintBoardingMode(g);
    else if (this.situation === 'Space Battle') {
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
    for (let i = this.artUsed; i < this.artPool.length; i++) this.artPool[i].setVisible(false);
    for (let i = this.labelsUsed; i < this.labelPool.length; i++) this.labelPool[i].setVisible(false);
  }

  private paintBoardingPilot(g: Phaser.GameObjects.Graphics) {
    const s = this.boardingPilot;
    const cx = WIDTH / 2, cy = HEIGHT / 2;
    const projectPoint = (point: { x: number; y: number; z: number }) => {
      const scale = 260 / (140 + Math.max(0, point.z));
      return { x: cx + (point.x - s.x) * scale, y: cy + (point.y - s.y) * scale, scale };
    };
    const project = (obj: { x: number; y: number; time: number; radius: number }) => {
      const point = projectPoint({ ...obj, z: (obj.time - s.elapsed) * BOARDING_PILOT_FORWARD_SPEED });
      return { ...point, r: obj.radius * point.scale };
    };
    const next = s.rings.find(ring => ring.kind === 'required');
    // Debris stays in the course state until its swept collision window ends.
    const objects = [...s.rings, ...s.debris].filter(obj => obj.time <= s.elapsed + 7)
      .sort((a, b) => b.time - a.time);
    for (const obj of objects) {
      const { x, y, r, scale } = project(obj);
      if (obj.kind === 'asteroid') {
        const rotation = this.decorativeTime(s.elapsed) * .27 + obj.time;
        if (!this.drawArt('asteroid', x, y, 2 * r, 2 * r, rotation)) {
          const points = [.91, .8, .96, .78, .97, .9, .8].map((size, i) => ({
            x: x + Math.cos(rotation + i * Math.PI * 2 / 7) * r * size,
            y: y + Math.sin(rotation + i * Math.PI * 2 / 7) * r * size,
          }));
          g.fillStyle(0x4d3344); g.fillPoints(points, true);
        }
        g.lineStyle(Math.max(1, 1.4 * scale), 0xffaa87, .8); g.strokeCircle(x, y, r);
      } else if (obj.kind === 'junk') {
        const angle = obj.time + this.decorativeTime(s.elapsed) * (obj.shape === 'antenna' ? .7 : .18);
        const wreckage = obj.shape === 'rib'
          ? [[-.82, -.43], [.78, -.65], [.48, -.08], [-.1, -.1], [-.46, .76], [-.78, .52]]
          : obj.shape === 'antenna'
            ? [[-.92, -.12], [-.23, -.13], [.05, -.8], [.22, -.74], [.14, -.1], [.8, .2], [.6, .53], [-.89, .12]]
            : [[-.72, -.52], [.49, -.72], [.84, -.15], [.32, .14], [.58, .53], [-.45, .7]];
        const panels = wreckage.map(([dx, dy]) => ({
          x: x + r * (dx * Math.cos(angle) - dy * Math.sin(angle)),
          y: y + r * (dx * Math.sin(angle) + dy * Math.cos(angle)),
        }));
        g.fillStyle(0x4f5963); g.fillPoints(panels, true);
        g.lineStyle(Math.max(1, 1.6 * scale), 0xc6a48e); g.strokePoints(panels, true);
        g.lineBetween(panels[0].x, panels[0].y, panels[3].x, panels[3].y);
        g.lineStyle(Math.max(1, 1.4 * scale), 0xffaa87, .8); g.strokeCircle(x, y, r);
      } else {
        const color = obj.kind === 'required' ? 0x85f7e0 : obj.kind === 'bonus' ? 0xffcd78 : 0xa3bdff;
        const alpha = obj.kind === 'required' && obj !== next ? .52 : 1;
        const rim = Math.max(2.5, 10 * scale);
        g.lineStyle(rim, 0x1e2a37, alpha); g.strokeCircle(x, y, r + rim / 2);
        g.lineStyle(rim * .35, 0x81929a, alpha); g.strokeCircle(x, y, r + rim * .75);
        g.lineStyle(Math.max(1.5, 2.4 * scale), color, alpha); g.strokeCircle(x, y, r);
        const tilt = 'tilt' in obj ? obj.tilt ?? 0 : 0;
        for (let i = 0; i < 6; i++) {
          const angle = tilt + i * Math.PI / 3;
          const inner = r + rim * .25, outer = r + rim * (tilt && i % 2 ? 1.25 : .9);
          g.lineStyle(Math.max(1, 2.5 * scale), i % 2 ? 0x9aabae : color, alpha);
          g.lineBetween(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner,
            x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        }
        if (obj.kind === 'required') {
          for (const side of [-1, 1]) g.lineBetween(x + side * r, y, x + side * (r + 5 * scale), y);
        } else if (obj.kind === 'bonus') {
          const mark = Math.max(4, 7 * scale);
          const rejoin = s.rings.find(ring => ring.kind === 'required' && ring.time > obj.time);
          if (rejoin) {
            const target = project(rejoin);
            const angle = Math.atan2(target.y - y, target.x - x);
            for (let i = 0; i < 3; i++) {
              const distance = r + rim + (i + 1) * mark;
              g.fillStyle(color, .75 - i * .18);
              g.fillCircle(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, Math.max(1.3, mark * .25));
            }
          }
          g.lineStyle(Math.max(1.5, 2.4 * scale), color, alpha);
          g.strokePoints([{x, y: y - r - 2 * mark}, {x: x + mark, y: y - r - mark},
            {x, y: y - r}, {x: x - mark, y: y - r - mark}], true);
        } else {
          const mark = Math.max(4, 7 * scale);
          g.lineBetween(x - mark, y - r - mark, x + mark, y - r - mark);
          g.lineBetween(x, y - r - 2 * mark, x, y - r);
        }
      }
    }

    const attack = s.attack;
    const incoming = attack && projectPoint(boardingPilotAttackPosition(attack, s.elapsed));
    if (attack && incoming && s.elapsed >= attack.launchAt) {
      const { x, y, scale } = incoming;
      const radius = attack.radius * scale;
      if (attack.kind === 'missile') {
        const tail = projectPoint(boardingPilotAttackPosition(attack, s.elapsed - .14));
        g.lineStyle(radius, 0xff803e, .45); g.lineBetween(x, y, tail.x, tail.y);
        g.lineStyle(radius * .33, 0xffd79f); g.lineBetween(x, y, tail.x, tail.y);
        g.fillStyle(0xffe0b3); g.fillCircle(x, y, radius * .55);
      } else {
        if (!this.drawArt('boarding-probe', x, y, radius * 2, radius * 2, attack.offsetX > 0 ? -.45 : .45)) {
          g.fillStyle(0x62576d);
          g.fillPoints([{ x, y: y - radius }, { x: x + radius, y }, { x, y: y + radius }, { x: x - radius, y }], true);
        }
        g.fillStyle(0xc898ff);
        for (const side of [-1, 1]) g.fillCircle(x + side * radius * .55, y - radius * .3, radius * .18);
      }
      g.lineStyle(1.5, 0xff967d, .8); g.strokeCircle(x, y, radius);
    }

    // Keep the canopy outside the reticle and the scoring plane.
    g.fillStyle(0x0e192c);
    g.fillPoints([{x: 0, y: 0}, {x: 90, y: 0}, {x: 26, y: 86}, {x: 0, y: 226}], true);
    g.fillPoints([{x: WIDTH, y: 0}, {x: WIDTH - 90, y: 0}, {x: WIDTH - 26, y: 86}, {x: WIDTH, y: 226}], true);
    g.fillPoints([{x: 0, y: 482}, {x: 87, y: 519}, {x: 393, y: 519}, {x: WIDTH, y: 482},
      {x: WIDTH, y: HEIGHT}, {x: 0, y: HEIGHT}], true);
    g.fillStyle(0x223444);
    g.fillPoints([{x: 0, y: 487}, {x: 87, y: 521}, {x: 393, y: 521}, {x: WIDTH, y: 487},
      {x: WIDTH, y: 506}, {x: 397, y: 529}, {x: 83, y: 529}, {x: 0, y: 506}], true);
    g.lineStyle(5, 0x263d4e);
    g.lineBetween(20, 0, 3, 105); g.lineBetween(WIDTH - 20, 0, WIDTH - 3, 105);
    g.lineStyle(3, 0x507b93);
    g.lineBetween(89, 0, 26, 86); g.lineBetween(WIDTH - 89, 0, WIDTH - 26, 86);
    g.lineBetween(0, 482, 87, 519); g.lineBetween(393, 519, WIDTH, 482);
    g.lineBetween(87, 519, 393, 519);
    g.fillStyle(0x071321); g.fillRoundedRect(72, 526, 336, 25, 5);
    for (const side of [-1, 1]) {
      const panelX = cx + side * 185;
      for (let i = 0; i < 3; i++) {
        g.fillStyle(i < s.hull ? 0x70d8c7 : 0x344957);
        g.fillRect(panelX - 14 + i * 10, 533, 6, 4);
      }
    }
    this.drawLabel(`RINGS ${s.cleared}/15     HULL ${s.hull}/3`, cx, 539, 14, '#c3e3ec');

    g.lineStyle(2, 0xe8fafb, .9);
    for (const side of [-1, 1]) {
      g.lineBetween(cx + side * 7, cy, cx + side * 17, cy);
      g.lineBetween(cx, cy + side * 7, cx, cy + side * 13);
    }
    if (next) {
      const point = project(next);
      const dx = point.x - cx, dy = point.y - cy;
      const edge = Math.max(Math.abs(dx) / 200, Math.abs(dy) / 190);
      if (edge > 1) {
        const angle = Math.atan2(dy, dx), x = cx + dx / edge, y = cy + dy / edge;
        const tip = { x: x + Math.cos(angle) * 10, y: y + Math.sin(angle) * 10 };
        const left = { x: x + Math.cos(angle + 2.4) * 9, y: y + Math.sin(angle + 2.4) * 9 };
        const right = { x: x + Math.cos(angle - 2.4) * 9, y: y + Math.sin(angle - 2.4) * 9 };
        g.fillStyle(0x85f7e0); g.fillPoints([tip, left, right], true);
      }
    }
    if (attack && incoming) {
      const x = Math.max(48, Math.min(WIDTH - 48, incoming.x));
      const markerGap = s.elapsed >= attack.launchAt ? attack.radius * incoming.scale + 14 : 0;
      const markerY = incoming.y + (incoming.y < 125 ? markerGap : -markerGap);
      const y = Math.max(95, Math.min(HEIGHT - 115, markerY));
      const angle = Math.atan2(incoming.y - cy, incoming.x - cx);
      const tip = { x: x + Math.cos(angle) * 9, y: y + Math.sin(angle) * 9 };
      const left = { x: x + Math.cos(angle + 2.4) * 8, y: y + Math.sin(angle + 2.4) * 8 };
      const right = { x: x + Math.cos(angle - 2.4) * 8, y: y + Math.sin(angle - 2.4) * 8 };
      g.fillStyle(0x281720, .96); g.fillCircle(x, y, 12);
      g.fillStyle(0xff967d); g.fillPoints([tip, left, right], true);
      this.drawLabel(`INCOMING ${attack.kind.toUpperCase()}`, cx, 72, 15, '#ffb39f');
    }
    if (s.feedback && s.feedback.until > s.elapsed) {
      const color = s.feedback.danger ? '#ffb39f' : '#a6f7e5';
      g.fillStyle(0x0a172a, .9); g.fillRoundedRect(147, 450, 186, 28, 5);
      this.drawLabel(s.feedback.text, cx, 464, 15, color);
    }
  }

  private paintBoardingTurret() {
    const s = this.boarding;
    const cx = WIDTH / 2;
    const ready = s.cooldown <= 0;
    const lamp = ready ? 0x9cebdc : 0xffc080;
    const glass = this.graphicsLayer(1.1);
    const hud = this.graphicsLayer(1.5);

    const canopy = this.drawArt('boarding-turret-canopy', cx, HEIGHT / 2, WIDTH, HEIGHT, 0, 1, false, 1);
    const muzzleY = canopy ? 428 : 449;
    if (!canopy) {
      const frame = this.graphicsLayer(1);
      frame.fillStyle(0x101822);
      frame.fillPoints([{x: 0, y: 0}, {x: WIDTH, y: 0}, {x: WIDTH, y: 58},
        {x: 423, y: 41}, {x: 57, y: 41}, {x: 0, y: 58}], true);
      frame.fillRect(0, 0, 9, HEIGHT);
      frame.fillRect(WIDTH - 9, 0, 9, HEIGHT);
      frame.fillPoints([{x: 0, y: 440}, {x: 78, y: 462}, {x: 402, y: 462}, {x: WIDTH, y: 440},
        {x: WIDTH, y: HEIGHT}, {x: 0, y: HEIGHT}], true);
      frame.lineStyle(3, 0x66747f);
      frame.lineBetween(57, 41, 423, 41);
      frame.lineBetween(0, 440, 78, 462);
      frame.lineBetween(402, 462, WIDTH, 440);
      frame.fillStyle(0x27343c);
      frame.fillRoundedRect(67, 481, 346, 62, 12);
      for (const x of [139, 341]) {
        frame.fillStyle(0x0c1119);
        frame.fillRoundedRect(x - 14, 470, 28, 54, 8);
        frame.fillStyle(0x48515a);
        frame.fillRoundedRect(x - 21, 480, 42, 30, 10);
      }
    }

    // Reflected light stays in the corners, outside the useful part of the window.
    glass.fillStyle(0xa1c5db, .08);
    for (const x of [0, WIDTH]) {
      const inward = x === 0 ? 1 : -1;
      glass.fillPoints([{x, y: 51}, {x: x + 91 * inward, y: 51},
        {x: x + 55 * inward, y: 68}, {x, y: 105}], true);
      glass.lineStyle(2, 0xd0e1e7, .19);
      glass.lineBetween(x + 14 * inward, 68, x + 48 * inward, 56);
      glass.lineBetween(x + 10 * inward, 361, x + 10 * inward, 421);
    }
    if (s.impactFlash > 0) {
      glass.lineStyle(8, 0xff6862, Math.min(.75, s.impactFlash * 3));
      glass.strokeRect(12, 55, WIDTH - 24, 374);
    }

    const carrier = s.carrier;
    const targets = [
      ...s.pods.map(pod => ({ world: pod, pod })),
      ...(carrier.hp > 0 ? [{ world: carrier, pod: null }] : []),
    ].sort((a, b) => b.world.y - a.world.y);
    for (const { world, pod } of targets) {
      const { x, y, scale, aimRadius: r } = boardingTurretPose(world, pod?.radius ?? BOARDING_CARRIER_RADIUS);
      const kind = pod?.kind ?? 'carrier';
      const shuttle = kind === 'shuttle';
      const warning = !!pod && pod.warningRemaining > 0;
      const imminent = !!pod && boardingTurretBreachSoon(pod);
      const color = imminent ? 0xff786e : warning ? 0xffc080 : shuttle ? 0xffb6b2 : pod ? 0xffd5a0 : 0xf8aa92;
      const width = (pod ? shuttle ? 37 : 25 : 81) * scale;
      const height = (pod ? (shuttle ? 17 : 26) : 32) * scale;
      // A nearer sprite covers a distant one, including when either uses its procedural fallback.
      const depth = -1 - world.y / 1000;
      if (!this.drawArt('boarding-turret-' + kind, x, y, width, height, 0, 1, false, depth)) {
        const craft = this.graphicsLayer(depth);
        const w = width / 2, h = height / 2;
        craft.fillStyle(0x66727b);
        craft.fillPoints([{x: x - w, y: y + h * .48}, {x: x - w * .75, y: y - h * .62},
          {x: x - w * .24, y: y - h}, {x: x + w * .24, y: y - h},
          {x: x + w * .75, y: y - h * .62}, {x: x + w, y: y + h * .48},
          {x: x + w * .55, y: y + h}, {x: x - w * .55, y: y + h}], true);
        craft.fillStyle(0x2a3848);
        craft.fillRoundedRect(x - w * .68, y - h * .31, w * 1.36, h * .63, 2);
        craft.fillStyle(color);
        if (pod && !shuttle) craft.fillCircle(x, y, 3 * scale);
        else for (const side of [-1, 1]) craft.fillCircle(x + side * w * .55, y + h * .16, 2.5 * scale);
      }

      const hit = (pod?.hitFlash ?? 0) > 0;
      hud.lineStyle(warning || imminent || hit ? 2.5 : 1.25, hit ? 0xffffff : color, warning || imminent ? .95 : .58);
      hud.strokeCircle(x, y, r);
      if (warning || imminent)
        this.drawLabel(warning ? 'LAUNCH' : 'BREACH', Math.max(30, Math.min(WIDTH - 30, x)), y + r + 10,
          12, warning ? '#ffcc90' : '#ff9a90');
      if (shuttle && pod) for (let i = 0; i < pod.maxHp; i++) {
        hud.fillStyle(i < pod.hp ? 0xffbcaa : 0x413039);
        hud.fillRect(x - 9 + i * 10, y - r - 6, 8, 3);
      }
    }

    // A small physical sight anchors the laser to the turret below the window.
    if (!canopy) {
      hud.fillStyle(0x152029);
      hud.fillPoints([{x: cx - 24, y: 487}, {x: cx - 11, y: muzzleY}, {x: cx + 11, y: muzzleY},
        {x: cx + 24, y: 487}], true);
      hud.lineStyle(2, 0x687b82);
      hud.lineBetween(cx - 24, 487, cx - 11, muzzleY);
      hud.lineBetween(cx + 24, 487, cx + 11, muzzleY);
      hud.fillStyle(lamp);
      hud.fillRect(cx - 7, muzzleY + 8, 14, 3);
    }

    if (s.beamTime > 0) {
      if (!this.reducedMotion?.matches) {
        hud.lineStyle(7, 0x81decf, .25);
        hud.lineBetween(cx, muzzleY, s.beamX, s.beamY);
      }
      hud.lineStyle(2, 0xbdfff2, .9);
      hud.lineBetween(cx, muzzleY, s.beamX, s.beamY);
    }
    if (s.hitFlash > 0) {
      const { hitX: x, hitY: y } = s;
      hud.lineStyle(2, 0xffffff);
      for (const side of [-1, 1]) {
        hud.lineBetween(x + side * 6, y - 6, x + side * 12, y - 12);
        hud.lineBetween(x + side * 6, y + 6, x + side * 12, y + 12);
      }
    }

    hud.fillStyle(0x071119, .95);
    hud.fillRoundedRect(16, 520, WIDTH - 32, 25, 5);
    this.drawLabel(carrier.hp > 0 ? 'CARRIER ' + carrier.hp + '/' + carrier.maxHp : 'CARRIER DISABLED', 94, 532, 14, '#ffb39f');
    this.drawLabel(ready ? 'READY' : 'COOLING', cx, 532, 14, ready ? '#a6f7e5' : '#ffca83');
    this.drawLabel('BREACHES ' + s.breaches, WIDTH - 89, 532, 14, s.impactFlash > 0 ? '#ffb39f' : '#c3e3ec');
    this.paintWeaponTarget(this.graphicsLayer(3), s.crosshairX, s.crosshairY, 14, lamp, true);
  }

  private paintBoardingMode(g: Phaser.GameObjects.Graphics) {
    const s = this.boarding;
    if (s.role === 'Life Support') {
      if (s.elapsed < 5) {
        g.fillStyle(0x0a1425, .8); g.fillRoundedRect(12, 14, 456, 52, 6);
        this.drawLabel('HOLD THE CORRIDOR', 240, 28, 15, '#79e1ce');
        this.drawLabel('Shoot raised rifles • Shoot glowing door targets', 240, 51, 11);
      }
      const doors = this.graphicsLayer(-1.95);
      for (const i of [0,1]) {
        const lock = s.airlocks[i], active = boardingAirlockTargetActive(s, i), target = BOARDING_AIRLOCK_TARGETS[i];
        const opening = lock.warning !== null ? (1 - lock.warning / BOARDING_VENT_WARNING) ** 2
          : lock.openRemaining > 0 ? Math.min(1, lock.openRemaining / .12) : 0;
        const outline = this.airlockOutline(i);
        doors.fillStyle(0x03080d); doors.fillPoints(outline, true);
        if (!this.paintAirlockPanels(i, opening)) {
          // Perspective fallback with a widening central opening, never a luminous flat rectangle.
          const shell = this.graphicsLayer(-1.94), outer = i ? 468 : 12, inner = i ? 390 : 90;
          const point = (u: number, v: number) => ({x: outer + (inner - outer) * u,
            y: (114 + 65 * u) * (1 - v) + (395 - 45 * u) * v});
          for (const [from,to] of [[0,(1-opening)/2],[1-(1-opening)/2,1]]) {
            shell.fillStyle(i ? 0x423a31 : 0x4a3b2b);
            shell.fillPoints([point(from,0),point(to,0),point(to,1),point(from,1)],true);
            shell.lineStyle(1,0x8c785a,.45);
            shell.strokePoints([point(from,0),point(to,0),point(to,1),point(from,1)],true);
          }
        }
        if (lock.openRemaining > 0) {
          const fx = this.graphicsLayer(-.55), phase = this.decorativeTime(s.elapsed), endX = i ? 430 : 50;
          for (let n = 0; n < 7; n++) {
            const t = ((phase * 2 + n / 7) % 1), startX = i ? 355 : 125, startY = 235 + n * 17;
            const x = startX + (endX - startX) * t, y = startY + (285 - startY) * t;
            fx.lineStyle(1 + t, 0xb9d9d3, .15 + .4 * t);
            fx.lineBetween(x, y, x + (i ? -15 : 15), y + (startY - 285) * .08);
          }
        }
        const color = lock.warning !== null ? 0xffca83 : active ? 0x79ffe1 : 0x52606a;
        // An inset wall control, with readiness light and a quiet segmented recharge gauge.
        g.fillStyle(0x0d161d, .9); g.fillCircle(target.x, target.y, 26);
        g.lineStyle(2, 0x6e7779, .7); g.strokeCircle(target.x, target.y, 25);
        g.fillStyle(color, active ? .3 : .08); g.fillCircle(target.x, target.y, 20);
        g.lineStyle(active || lock.warning !== null ? 3 : 1, color, active ? 1 : .6);
        g.strokeCircle(target.x, target.y, active ? target.radius : 18);
        g.lineBetween(target.x - 8, target.y, target.x + 8, target.y);
        g.lineBetween(target.x, target.y - 8, target.x, target.y + 8);
        const recharge = BOARDING_VENT_RECHARGE * (this.config.naturalOne ? 2 : 1);
        for (let segment = 0; segment < 8; segment++) {
          g.fillStyle(segment / 8 < 1 - lock.cooldown / recharge ? 0x7bada5 : 0x293638, .85);
          g.fillRect(target.x - 23 + segment * 6, target.y + 31, 4, 3);
        }
      }
      for (let depth = 0; depth < 3; depth++) for (const slot of BOARDING_INTERIOR_SLOTS) {
        const c = boardingCover(slot, depth);
        this.paintCargo(c.x, c.y, BOARDING_DEPTHS[depth].scale);
      }
      // Draw far figures first. Rule-owned depth determines scale and target size.
      for (const b of [...s.boarders].sort((a, b) => a.depth - b.depth || a.y - b.y || a.id - b.id)) {
        const scale = boardingBoarderPose(b).scale, exposed = b.phase === 'exposed';
        const height = 126 * scale, width = 53 * scale, offset = 9 * scale;
        const enemyGraphics = this.graphicsLayer(this.interiorDepth(b.y));
        if (b.phase === 'warning') {
          // A ducked helmet peeks above the stack; no hidden body can leak below its base.
          enemyGraphics.fillStyle(0x684d58);
          enemyGraphics.fillCircle(b.x, b.y + 2 * scale, 9 * scale);
          enemyGraphics.fillStyle(0xd7a45c);
          enemyGraphics.fillRect(b.x - 5 * scale, b.y - scale, 10 * scale, 2 * scale);
        } else if (!this.drawArt('boarding-boarder', b.x, b.y + offset, width, height, 0, 1, false, this.interiorDepth(b.y))) {
          enemyGraphics.fillStyle(0x925f69);
          enemyGraphics.fillCircle(b.x, b.y + offset - 34 * scale, 10 * scale);
          enemyGraphics.fillRoundedRect(b.x - 16 * scale, b.y + offset - 21 * scale, 32 * scale, 50 * scale, 5);
          enemyGraphics.lineStyle(4, 0xffaa7a);
          enemyGraphics.lineBetween(b.x, b.y + offset - 12 * scale, b.x + 18 * scale, b.y + offset - 12 * scale);
        }
        if (exposed) {
          const imminent = b.remaining < .5;
          g.fillStyle(imminent ? 0xff596f : 0xffca83, .85);
          g.fillCircle(b.x + 7 * scale, b.y - 5 * scale, imminent ? 5 : 3);
          if (imminent) {
            g.lineStyle(1, 0xff596f, .35);
            g.lineBetween(b.x + 7 * scale, b.y - 5 * scale, 240, 540);
          }
        }
        const radius = BOARDING_DEPTHS[b.depth].radius;
        if (exposed) {
          g.lineStyle(1, 0xffca83, .7);
          g.strokeCircle(b.x, b.y, radius);
        }
      }
      for (const e of s.ejections) {
        const t = 1 - e.remaining / BOARDING_EJECTION_TIME, endX = e.side ? 430 : 50;
        const x = e.x + (endX - e.x) * t, y = e.y + (285 - e.y) * t;
        const scale = e.scale * (1 - .85 * t), alpha = 1 - t;
        if (!this.drawArt('boarding-boarder', x, y, 53 * scale, 126 * scale, this.reducedMotion?.matches ? 0 : (e.side ? 1 : -1) * t, alpha, false, -.5)) {
          const fx = this.graphicsLayer(-.5);
          fx.fillStyle(0x925f69, alpha); fx.fillCircle(x, y - 20 * scale, 10 * scale);
          fx.fillRoundedRect(x - 15 * scale, y - 12 * scale, 30 * scale, 45 * scale, 4);
        }
      }
      if (!this.drawArt('boarding-rifle', 370, 510, 220, 147, 0, 1, false, .5)) {
        g.fillStyle(0x3f4b63);
        g.fillRoundedRect(315, 465, 130, 90, 12);
        g.lineStyle(16, 0x9faec1);
        g.lineBetween(350, 485, 290, 440);
      }
      for (const laser of s.lasers) {
        const t = 1 - Math.max(0, laser.remaining) / laser.duration;
        const x = laser.x + (240 - laser.x) * t, y = laser.y + (540 - laser.y) * t;
        const dx = 240 - laser.x, dy = 540 - laser.y, length = Math.max(1, Math.hypot(dx, dy)), trail = 16 + 30 * t;
        g.lineStyle(10 + 8 * t, 0xff475f, .15);
        g.lineBetween(x, y, x - dx / length * trail, y - dy / length * trail);
        g.lineStyle(3 + 3 * t, 0xff6b75, 1);
        g.lineBetween(x, y, x - dx / length * trail, y - dy / length * trail);
        g.fillStyle(0xffe0d2);
        g.fillCircle(x, y, 3 + 3 * t);
      }
      if (s.impactFlash > 0) {
        g.fillStyle(0xff465d, s.impactFlash * .7);
        g.fillRect(s.impactSide ? WIDTH - 55 : 0, 90, 55, 420);
      }
    }
    else {
      g.lineStyle(2, 0xffbd6b, .7);
      g.lineBetween(16, BOARDING_LINE, 464, BOARDING_LINE);
      for (const x of [24, 456])
        g.strokeTriangle(x, BOARDING_LINE - 7, x - 5, BOARDING_LINE + 4, x + 5, BOARDING_LINE + 4);
      const c = s.carrier, phase = s.elapsed % BOARDING_CYCLE;
      if (c.hp > 0) {
        if (phase < BOARDING_WARNING) {
          g.lineStyle(2, 0xffca83, .8);
          g.lineBetween(c.startX, 500, c.targetX, 250);
          g.strokeTriangle(c.targetX, 215, c.targetX - 12, 240, c.targetX + 12, 240);
        }
        // Carrier hull silhouette and health bar reflect its actual collision radius.
        const dx = phase < 6 ? c.targetX - c.startX : c.startX - c.targetX;
        const rotation = phase < BOARDING_WARNING ? 0 : phase < 6 ? Math.atan2(-250, dx) + Math.PI / 2 : phase < 9 ? Math.atan2(250, dx) + Math.PI / 2 : (s.carrier.cycle % 2 ? -Math.PI / 2 : Math.PI / 2);
        if (!this.drawArt('boarding-carrier', c.x, c.y, 50, 72, rotation)) {
          g.fillStyle(0x68485f);
          g.fillRoundedRect(c.x - 34, c.y - 30, 68, 60, 12);
          g.lineStyle(2, 0xff9781);
          g.lineBetween(c.x, c.y - 30, c.x, c.y + 20);
        }
        g.lineStyle(3, 0xff9781);
        g.strokeCircle(c.x, c.y, BOARDING_CARRIER_RADIUS);
        g.fillStyle(0x20283e);
        g.fillRect(c.x - 36, c.y + 43, 72, 6);
        g.fillStyle(0xff9781);
        g.fillRect(c.x - 36, c.y + 43, 72 * c.hp / c.maxHp, 6);
        for (const dx of [-23, 23]) {
          g.fillStyle(0xffca83);
          g.fillTriangle(c.x + dx, c.y - 42, c.x + dx - 8, c.y - 23, c.x + dx + 8, c.y - 23);
        }
      }
      for (const p of s.pods) {
        const rotation = Math.atan2(p.vy, p.vx) + Math.PI / 2, shuttle = p.kind === 'shuttle';
        if (!this.drawArt(shuttle ? 'boarding-shuttle' : 'boarding-probe', p.x, p.y, shuttle ? 34 : 16, shuttle ? 32 : 24, rotation)) {
          g.fillStyle(shuttle ? 0xcf8098 : 0xffbd6b);
          g.fillTriangle(p.x, p.y - p.radius, p.x - p.radius, p.y + p.radius, p.x + p.radius, p.y + p.radius);
        }
        g.lineStyle(2, shuttle ? 0xe795ac : 0xffca83, .6);
        g.lineBetween(p.x, p.y, p.x - p.vx * .12, p.y - p.vy * .12);
        if (p.warningRemaining > 0) {
          g.lineStyle(2, 0xffca83, .9);
          g.strokeCircle(p.x, p.y, p.radius + 5);
          this.drawLabel('LAUNCH', p.x, p.y + p.radius + 13, 10, '#ffca83');
        }
        if (shuttle)
          for (let i = 0; i < p.maxHp; i++) {
            g.fillStyle(i < p.hp ? 0xffb6a0 : 0x45344e);
            g.fillRect(p.x - 7 + i * 8, p.y - p.radius - 9, 5, 4);
          }
        if (p.hitFlash > 0) {
          g.lineStyle(3, 0xffffff, .9);
          g.strokeCircle(p.x, p.y, p.radius + 2);
        }
      }
      for (const m of s.mines)
        this.paintMine(g, m, s.elapsed, BOARDING_MINE_LIFETIME, !!m.flight);
      for (const e of s.explosions)
        this.paintMineExplosion(g, e);
      if (s.role === 'Bomber') {
        const rack = mineDropPosition(s), target = spaceBomberLanding(s);
        g.lineStyle(2, 0xffca83, .7);
        g.lineBetween(rack.x, rack.y, target.x, target.y);
        this.paintWeaponTarget(g, target.x, target.y, BOARDING_BLAST_RADIUS * (this.config.naturalOne ? Math.SQRT1_2 : 1), 0xffca83, s.cooldown <= 0);
        g.fillStyle(s.cooldown <= 0 ? 0xffca83 : 0x68758e);
        g.fillRoundedRect(rack.x - 10, rack.y - 4, 20, 8, 3);
      }
      this.paintPlayerShip(g, s.x, s.y, s.elapsed, false);
    }
    if (s.hitFlash > 0) {
      g.lineStyle(2, 0xffffff);
      for (const sign of [-1, 1]) {
        g.lineBetween(s.hitX + sign * 6, s.hitY + sign * 6, s.hitX + sign * 12, s.hitY + sign * 12);
        g.lineBetween(s.hitX + sign * 6, s.hitY - sign * 6, s.hitX + sign * 12, s.hitY - sign * 12);
      }
    }
    if (s.grace > 0) {
      g.lineStyle(4, 0x79e1ce, .7);
      g.strokeRect(12, 12, 456, 536);
    }
    if (s.role === 'Life Support') {
      if (s.beamTime > 0) {
        g.lineStyle(3, 0x79e1ce, .85);
        g.lineBetween(285, 445, s.beamX, s.beamY);
      }
      this.paintWeaponTarget(g, s.crosshairX, s.crosshairY, 14, 0x79e1ce, s.cooldown <= 0);
    }
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
    if(this.situation==='Boarding Party'&&this.role==='Life Support') {
      if(this.drawArt('boarding-corridor',240,280,480,560,0,1,true))return;
      g.fillStyle(0x101b2a);g.fillRect(0,0,480,560);
      g.lineStyle(3,0x506c85);for(const [x,y] of [[0,0],[480,0],[0,560],[480,560],[120,560],[360,560]])g.lineBetween(240,140,x,y);
      g.lineStyle(2,0x7296a5);g.strokeRect(195,100,90,120);return;
    }

    const illustrated = this.drawArt(this.role === 'Life Support' ? 'interior' : 'space', WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0, 1, true);
    if (!illustrated) {
      g.fillStyle(0x101528); g.fillRect(0, 0, WIDTH, HEIGHT);
      for (let i = 8; i > 0; i--) {
        g.fillStyle(0x47366b, 0.025); g.fillEllipse(90, 180, i * 60, i * 90);
        g.fillStyle(0x16546b, 0.025); g.fillEllipse(420, 430, i * 55, i * 70);
      }
      g.fillStyle(0x26364f); g.fillCircle(385, 100, 43);
      g.fillStyle(0x172338); g.fillCircle(397, 94, 38);
      g.lineStyle(1, 0x60839d, 0.25); g.strokeCircle(385, 100, 45);
    }
    const automaticFlight = this.role === 'Bomber' || this.role === 'Gunner';
    for (let i = 0; i < (illustrated ? (this.role === 'Life Support' ? 0 : 35) : 100); i++) {
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
    if (this.drawArt('asteroid', asteroid.x, asteroid.y, asteroid.radius * 2, asteroid.radius * 2, asteroid.rotation ?? 0)) {
      // Armor/damage overlays below describe actual HP; art never supplies hit geometry.
      if (armored || damaged) {
        g.lineStyle(armored ? 2 : 1, damaged ? 0xffbc74 : 0xe6a87d, .9);
        g.strokeCircle(asteroid.x, asteroid.y, asteroid.radius);
      }
      return;
    }
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
    if (this.role === 'Pilot' || this.role === 'Bomber' || (this.situation === 'Asteroid Field' && this.role === 'Gunner')) {
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

  private paintPlayerShip(g: Phaser.GameObjects.Graphics, x: number, y: number, elapsed: number, impairedEngine = this.config.naturalOne, drawHull = true) {
    const flame = impairedEngine ? 0xffac64 : 0x71e4f5;
    const detailed = this.role === 'Pilot' || this.role === 'Bomber';
    const time = detailed ? this.decorativeTime(elapsed) : elapsed;
    const pulse = 5 + Math.sin(time * 40) * 3;
    for (const dx of [-8, 8]) {
      g.fillStyle(flame, 0.12); g.fillEllipse(x + dx, y + 22, 15, 30 + pulse);
      g.fillStyle(flame); g.fillTriangle(x + dx - 3, y + 10, x + dx + 3, y + 10, x + dx, y + 25 + pulse);
      g.fillStyle(0xf4fbff); g.fillTriangle(x + dx - 1.5, y + 11, x + dx + 1.5, y + 11, x + dx, y + 21);
    }
    if (!drawHull || this.drawArt('player', x, y - 2, 34, 38)) return;
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

    if (this.drawArt('enemy', x, y + direction * 1.5, 44, 33, direction === -1 ? Math.PI : 0)) return;
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
        const r = asteroid.radius;
        // Inset armor follows the rock, with exposed seams after the first hit.
        for (const side of [-1, 1]) {
          g.lineStyle(3, asteroid.hp > 1 ? 0xffca83 : 0xa0775c, .9);
          g.beginPath(); g.arc(asteroid.x, asteroid.y, r * .72,
            (asteroid.rotation ?? 0) + side * Math.PI / 2 - .45,
            (asteroid.rotation ?? 0) + side * Math.PI / 2 + .45); g.strokePath();
        }
        if (asteroid.hp < asteroid.maxHp) {
          g.lineStyle(2, 0x24243b); g.lineBetween(asteroid.x - r * .35, asteroid.y - r * .6, asteroid.x + r * .1, asteroid.y);
          g.lineBetween(asteroid.x + r * .1, asteroid.y, asteroid.x - r * .25, asteroid.y + r * .5);
        }
        for (let hp = 0; hp < asteroid.maxHp; hp++) {
          const x = asteroid.x + (hp - (asteroid.maxHp - 1) / 2) * 9, y = asteroid.y - r - 7;
          g.fillStyle(0x101528, .95); g.fillCircle(x, y, 4);
          g.lineStyle(1, 0xffca83, .8); g.strokeCircle(x, y, 3);
          if (hp < asteroid.hp) { g.fillStyle(0xffca83); g.fillCircle(x, y, 2); }
        }
      }
    }
    const target = gunnerTargetAt(s.asteroids, s.crosshairX, s.crosshairY);
    if (target) {
      const r = target.radius + 4, length = 7;
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        const x = target.x + dx * r, y = target.y + dy * r;
        for (const [width, color] of [[4, 0x101528], [1.5, 0x79e1ce]]) {
          g.lineStyle(width, color, .95);
          g.lineBetween(x, y, x - dx * length, y); g.lineBetween(x, y, x, y - dy * length);
        }
      }
    }
    if (s.shotFeedback) this.paintGunnerShotFeedback(g, s.shotFeedback);

    this.paintGunnerTurret(g, s);
  }

  private paintGunnerShotFeedback(g: Phaser.GameObjects.Graphics, feedback: GunnerShotFeedback) {
    const alpha = Math.min(1, feedback.remaining / GUNNER_SHOT_FEEDBACK_SECONDS);
    const progress = this.reducedMotion?.matches ? .35 : 1 - alpha;
    const { x, y } = feedback;
    if (feedback.outcome === 'miss') {
      g.lineStyle(1, 0xbba6ff, alpha * .7); g.strokeCircle(x, y, 5 + progress * 7);
      return;
    }
    const destroyed = feedback.outcome === 'destroyed';
    const distance = destroyed ? feedback.radius * (.35 + progress * .65) : 7 + progress * 10;
    g.lineStyle(2, destroyed ? 0xd9fff6 : 0xffca83, alpha);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + progress * .35;
      const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance;
      if (destroyed) {
        g.fillStyle(i % 2 ? 0xc5b4ad : 0xffca83, alpha * .85);
        g.fillTriangle(px, py - 3, px - 3, py + 2, px + 3, py + 2);
      } else {
        g.lineBetween(px, py, px + Math.cos(angle) * 5, py + Math.sin(angle) * 5);
      }
    }
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
    const illustrated = this.drawArt('enemy', a.x, a.y + 2, 36, 36);
    if (!illustrated) {
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
    }
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
    const asteroidMode = this.situation === 'Asteroid Field';
    const time = asteroidMode ? this.decorativeTime(s.elapsed) : s.elapsed;
    const turretX = automaticShipX(s.elapsed), turretY = HEIGHT - 44;
    // A larger armored weapon deck, exposed engines and service lights.
    g.save(); g.translateCanvas(turretX, turretY); g.scaleCanvas(1.65, 1.25);
    // Sprite position follows flight time even when decorative motion is reduced.
    const illustrated = this.drawArt('player', turretX, turretY - 2 * 1.25, 34 * 1.65, 38 * 1.25);
    this.paintPlayerShip(g, 0, 0, time, false, !illustrated); g.restore();
    for (const side of [-1, 1]) {
      const x = turretX + side * 32;
      g.fillStyle(0x26384f); g.lineStyle(1, 0x91b7d5, 0.9);
      g.fillRoundedRect(x - 7, turretY - 11, 14, 31, 4);
      g.strokeRoundedRect(x - 7, turretY - 11, 14, 31, 4);
      for (let vent = 0; vent < 3; vent++) {
        g.lineStyle(2, 0x101b30); g.lineBetween(x - 4, turretY + vent * 5, x + 4, turretY + vent * 5);
      }
      g.fillStyle(0x79e1ce, 0.8); g.fillCircle(x, turretY - 6, 2);
      const flame = 12 + Math.sin(time * 35) * 4;
      g.fillStyle(0x71e4f5, 0.22); g.fillTriangle(x - 6, turretY + 20, x + 6, turretY + 20, x, turretY + 20 + flame);
      g.fillStyle(0xe4ffff); g.fillTriangle(x - 2, turretY + 20, x + 2, turretY + 20, x, turretY + 27);
    }
    const angle = Math.atan2(s.crosshairY - turretY, s.crosshairX - turretX);
    const muzzleX = turretX + Math.cos(angle) * 30;
    const muzzleY = turretY + Math.sin(angle) * 30;
    if (s.beamTime > 0) {
      g.lineStyle(8, 0x79e1ce, 0.10); g.lineBetween(muzzleX, muzzleY, s.beamX, s.beamY);
      g.lineStyle(2, 0xd9fff6, 0.9); g.lineBetween(muzzleX, muzzleY, s.beamX, s.beamY);
      if (!asteroidMode) { g.fillStyle(0xffffff, 0.9); g.fillCircle(s.beamX, s.beamY, 5); }
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
      for (let spark = 0; !asteroidMode && spark < 6; spark++) {
        const direction = spark * Math.PI / 3 + s.elapsed;
        g.lineBetween(s.beamX + Math.cos(direction) * 8, s.beamY + Math.sin(direction) * 8,
          s.beamX + Math.cos(direction) * 16, s.beamY + Math.sin(direction) * 16);
      }
    }
    g.fillStyle(s.cooldown <= 0 ? 0x79e1ce : 0xffac64); g.fillCircle(turretX, turretY, 5);
    if (asteroidMode) {
      this.paintAsteroidGunnerReticle(g, s);
      return;
    }
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

  private paintAsteroidGunnerReticle(g: Phaser.GameObjects.Graphics, s: GunnerState | SpaceGunnerState) {
    const ready = s.cooldown <= 0;
    const color = ready ? 0x79e1ce : 0xbba6ff;
    const fraction = Math.max(0, Math.min(1, 1 - s.cooldown / gunnerFireEvery(this.config)));
    const x = s.crosshairX, y = s.crosshairY;
    // Stroke backing preserves the open center and keeps small targets visible.
    g.lineStyle(5, 0x101528, .95); g.strokeCircle(x, y, 16);
    g.lineStyle(2, color, ready ? .95 : .45); g.strokeCircle(x, y, 16);
    for (const [width, tint] of [[5, 0x101528], [2, color]]) {
      g.lineStyle(width, tint, .95);
      g.lineBetween(x - 23, y, x - 10, y); g.lineBetween(x + 10, y, x + 23, y);
      g.lineBetween(x, y - 23, x, y - 10); g.lineBetween(x, y + 10, x, y + 23);
    }
    // Lower semicircle fits even at the minimum aim Y; progress remains essential in reduced motion.
    g.lineStyle(4, 0x101528, .9); g.beginPath(); g.arc(x, y, 21, 0, Math.PI); g.strokePath();
    if (fraction > 0) {
      g.lineStyle(2, color, .95); g.beginPath(); g.arc(x, y, 21, 0, Math.PI * fraction); g.strokePath();
    }
    if (ready) {
      g.lineStyle(2, color, .95); g.lineBetween(x - 3, y + 27, x + 3, y + 27);
    }
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
    const rack = mineDropPosition(s), landing = spaceBomberLanding(s);
    g.lineStyle(2, 0xffca83, .65); g.lineBetween(rack.x, rack.y, landing.x, landing.y);
    this.paintWeaponTarget(g, landing.x, landing.y, bomberBlastRadius(this.config), 0xffca83, s.cooldown <= 0);
    if (s.impactFlash) { g.fillStyle(0xff715b, 0.14); g.fillRect(9, 9, WIDTH - 18, HEIGHT - 18); }
    for (const explosion of s.explosions) this.paintMineExplosion(g, explosion);
    for (const mine of s.mines) this.paintMine(g, mine, s.elapsed, BOMBER_MINE_LIFETIME, !!mine.flight);
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
    g.fillStyle(0x0b1324, this.hasArt('interior') ? 0.3 : 0.94); g.fillRoundedRect(15, 14, WIDTH - 30, HEIGHT - 28, 22);
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
    if (!this.hasArt('interior')) {
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
    const feedbackColor = s.routingFeedback?.correct ? 0x79e1ce : 0xff715b;
    const time = this.decorativeTime(s.elapsed);
    this.paintLifeSupportPanel(g, time);

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
    const scannerY = 88 + (time * 72) % Math.max(1, LIFE_SUPPORT_SWITCH_Y - 110);
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
        g.lineStyle(2, 0xf0fff9, 0.9);
        g.lineBetween(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, x, 472);
        const flow = (time * 1.15 + routeIndex * 0.19) % 1;
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
      if (selected) {
        g.lineStyle(2, 0xf0fff9, 0.95); g.strokeRoundedRect(x - 48, 462, 96, 74, 8);
        g.fillStyle(0xf0fff9); g.fillTriangle(x - 6, 449, x + 6, 449, x, 456);
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
      const { x, y } = packet;
      const color = packet.kind === 'heart' ? 0x79e1ce
        : packet.kind === 'overload' ? 0xff8f6b : this.lifeSupportRouteColor(packet.target);
      const pulse = 0.88 + Math.sin(time * 10 + packet.id) * 0.06;
      g.fillStyle(color, 0.07); g.fillCircle(x, y, 27);
      g.fillStyle(0x0c1729, 0.99); g.lineStyle(2, color, pulse);
      if (packet.kind === 'heart') {
        g.fillRoundedRect(x - 22, y - 22, 44, 44, 15);
        g.strokeRoundedRect(x - 22, y - 22, 44, 44, 15);
      } else if (packet.kind === 'overload') {
        // Four beveled corners distinguish overloads even without color.
        g.fillPoints([{x:x-13,y:y-22},{x:x+13,y:y-22},{x:x+22,y:y-13},
          {x:x+22,y:y+13},{x:x+13,y:y+22},{x:x-13,y:y+22},
          {x:x-22,y:y+13},{x:x-22,y:y-13}], true);
        g.strokePoints([{x:x-13,y:y-22},{x:x+13,y:y-22},{x:x+22,y:y-13},
          {x:x+22,y:y+13},{x:x+13,y:y+22},{x:x-13,y:y+22},
          {x:x-22,y:y+13},{x:x-22,y:y-13}], true);
      } else {
        g.fillRoundedRect(x - 22, y - 22, 44, 44, 5);
        g.strokeRoundedRect(x - 22, y - 22, 44, 44, 5);
      }
      this.paintLifeSupportSymbol(g, packet, x, y, 1);
    }

    if (s.feedbackTime > 0 && s.routingFeedback) {
      const x = this.lifeSupportRouteX(s.routingFeedback.selectedRoute);
      const alpha = Math.min(1, s.feedbackTime / 0.22);
      g.lineStyle(3, feedbackColor, alpha);
      g.strokeCircle(WIDTH / 2, LIFE_SUPPORT_SWITCH_Y, 38);
      g.strokeRoundedRect(x - 52, 458, 104, 82, 14);
      // Check/cross marks communicate the outcome without relying on color.
      g.lineStyle(3, feedbackColor, alpha);
      if (s.routingFeedback.correct) {
        g.lineBetween(x - 7, 482, x - 2, 487); g.lineBetween(x - 2, 487, x + 8, 478);
      } else {
        g.lineBetween(x - 6, 479, x + 6, 487); g.lineBetween(x + 6, 479, x - 6, 487);
      }
    }
  }
}
