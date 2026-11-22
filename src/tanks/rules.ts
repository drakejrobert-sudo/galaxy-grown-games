import { battlefieldTerrain, carvePlanet, planetGravity, planetSurface, WIDTH, HEIGHT, type Battlefield, type Planet } from './terrain';

export { WIDTH, HEIGHT };
export const TANK_WIDTH = 24;
export const DRIVE = TANK_WIDTH * 2;
export const STEP = 1 / 120;
export const BLAST_LIFE = .36;
const PLANET_SHOT_STEPS = 12 / STEP;
export const DEFAULT_ELEVATION = 45;
export const DEFAULT_POWER = 55;
export type Ammo = 'standard' | 'heavy' | 'starburst';
export interface Aim { direction: 1 | -1; angle: number; power: number; ammo: Ammo }
export interface Tank {
  name: string; hull: number; planet?: number;
  // Horizontal coordinate on ground maps, clockwise terrain sample on a planet.
  x: number;
  angle: number; power: number;
}
interface Shell { x: number; y: number; vx: number; vy: number; split: boolean }
interface Blast { x: number; y: number; radius: number; life: number }
export interface Match {
  battlefield: Battlefield; terrain: number[]; planets: Planet[]; tanks: Tank[]; order: number[]; turn: number; dm: number;
  drive: number; heavy: number; starburst: number; phase: 'aim' | 'shot' | 'over';
  shells: Shell[]; blasts: Blast[]; damage: number[]; ammo: Ammo; impacts: number; report: string; shotSteps: number;
}
export function createMatch(names: string[], dm: number, seed: number, battlefield: Battlefield = 'hillside'): Match {
  if (names.length < 2 || names.length > 8 || !Number.isInteger(dm) || !names[dm] ||
      names.some(name => !name.trim())) throw new Error('Choose 2–8 named tanks and a DM.');
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const {terrain, planets, spawns} = battlefieldTerrain(battlefield, names.length, random);
  const tanks = names.map((name, i) => ({
    name: name.trim(), hull: 3, ...spawns[i], angle: DEFAULT_ELEVATION, power: DEFAULT_POWER,
  }));
  const order = tanks.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {battlefield, terrain, planets, tanks, dm, order, turn: 0, drive: DRIVE, heavy: 2, starburst: 1,
    phase: 'aim', shells: [], blasts: [], damage: tanks.map(() => 0), ammo: 'standard', impacts: 0, report: '', shotSteps: 0};
}
export function active(m: Match) { return m.order[m.turn]; }
export function ground(m: Match, x: number) {
  return m.terrain[Math.max(0, Math.min(WIDTH - 1, Math.round(x)))];
}
export function nextSurvivor(m: Match) {
  let next = m.turn;
  do { next = (next + 1) % m.order.length; } while (next !== m.turn && m.tanks[m.order[next]].hull <= 0);
  return next;
}
export function tankSurface(m: Match, tank: Tank, x = tank.x) {
  return tank.planet === undefined
    ? {x, y: ground(m, x), nx: 0, ny: -1}
    : planetSurface(m.planets[tank.planet], x);
}

function tankCenter(m: Match, tank: Tank) {
  const {x, y, nx, ny} = tankSurface(m, tank);
  return {x: x + nx * 6, y: y + ny * 6};
}

export function defaultDirection(m: Match, tank: Tank): Aim['direction'] {
  const {x, y, nx, ny} = tankSurface(m, tank);
  return (WIDTH / 2 - x) * -ny + (HEIGHT / 2 - y) * nx > 0 ? 1 : -1;
}

export function drive(m: Match, direction: 1 | -1) {
  if (m.phase !== 'aim') return;
  const tank = m.tanks[active(m)];
  const planet = tank.planet === undefined ? undefined : m.planets[tank.planet];
  for (let step = 0; step < 6 && m.drive > 0; step++) {
    const length = planet?.surface.length ?? WIDTH;
    const x = planet ? (tank.x + direction + length) % length : tank.x + direction;
    if (!planet && (x < TANK_WIDTH / 2 || x >= WIDTH - TANK_WIDTH / 2)) break;
    const from = tankSurface(m, tank), to = tankSurface(m, tank, x);
    if (Math.hypot(from.x - to.x, from.y - to.y) > Math.hypot(1, 1.4) ||
        m.tanks.some(other => {
          if (other === tank || !other.hull || other.planet !== tank.planet) return false;
          const distance = Math.abs(other.x - x);
          if (!planet) return distance < TANK_WIDTH;
          const neighbor = tankSurface(m, other);
          return Math.min(distance, length - distance) < TANK_WIDTH ||
            Math.hypot(neighbor.x - to.x, neighbor.y - to.y) < TANK_WIDTH;
        })) break;
    tank.x = x;
    m.drive--;
  }
}

export function muzzle(m: Match, aim: Aim, tank = m.tanks[active(m)]) {
  const {x, y, nx, ny} = tankSurface(m, tank);
  const radians = aim.angle * Math.PI / 180;
  const tangent = Math.cos(radians) * aim.direction, outward = Math.sin(radians);
  const dx = -ny * tangent + nx * outward, dy = nx * tangent + ny * outward;
  return { x: x + nx * 10 + dx * 18, y: y + ny * 10 + dy * 18, dx, dy };
}
export function fire(m: Match, aim: Aim) {
  if (m.phase !== 'aim') return;
  const shooter = active(m);
  if (aim.ammo !== 'standard') {
    if (shooter !== m.dm || m[aim.ammo] <= 0) return;
    m[aim.ammo]--;
  }
  const {x,y,dx,dy} = muzzle(m, aim);
  const speed = 75 + aim.power * 3.6;
  m.shells = [{ x, y, vx: dx * speed, vy: dy * speed, split: aim.ammo === 'starburst' }];
  const tank = m.tanks[shooter];
  tank.angle = aim.angle;
  tank.power = aim.power;
  m.shotSteps = 0;
  m.ammo = aim.ammo;
  m.impacts = 0;
  m.damage.fill(0);
  m.phase = 'shot';
}
function explode(m: Match, x: number, y: number) {
  const radius = m.ammo === 'heavy' ? 45 : m.ammo === 'starburst' ? 23 : 29;
  m.blasts.push({x, y, radius, life: BLAST_LIFE});
  m.impacts++;
  for (const [i, tank] of m.tanks.entries()) {
    if (!tank.hull) continue;
    const center = tankCenter(m, tank);
    const distance = Math.hypot(center.x - x, center.y - y);
    const damage = Math.min(tank.hull, distance <= 13 ? 2 : distance <= radius ? 1 : 0);
    tank.hull -= damage;
    m.damage[i] += damage;
  }
  if (m.planets.length) {
    for (const planet of m.planets) carvePlanet(planet, x, y, radius);
    return;
  }
  for (let i = Math.max(0, Math.ceil(x - radius)); i <= Math.min(WIDTH - 1, Math.floor(x + radius)); i++) {
    const bottom = y + Math.sqrt(Math.max(0, radius ** 2 - (i - x) ** 2)) * .75;
    m.terrain[i] = Math.min(HEIGHT - 8, Math.max(m.terrain[i], bottom));
  }
}
export function step(m: Match) {
  if (m.phase !== 'shot') return;
  m.blasts = m.blasts.filter(b => (b.life -= STEP) > 0);
  const remaining: Shell[] = [];
  const planetary = m.planets.length > 0;
  const launchPlanet = m.planets[m.tanks[active(m)].planet ?? -1];
  const timedOut = planetary && ++m.shotSteps >= PLANET_SHOT_STEPS;
  for (const s of m.shells) {
    if (planetary) {
      if (timedOut) continue;
      const gravity = planetGravity(m.planets, s.x, s.y);
      s.vx += gravity.x * STEP;
      s.vy += gravity.y * STEP;
    } else {
      s.vy += (m.battlefield === 'moon' ? 105 : 190) * STEP;
    }
    s.x += s.vx * STEP;
    s.y += s.vy * STEP;
    if (s.x < 0 || s.x >= WIDTH || (planetary && (s.y < 0 || s.y >= HEIGHT))) continue;
    const hitGround = planetary ? m.planets.some(planet => {
      const dx = s.x - planet.x, dy = s.y - planet.y;
      const distance = Math.hypot(dx, dy);
      if (distance > planet.radius) return false;
      const sample = Math.atan2(dy, dx) * planet.surface.length / (2 * Math.PI);
      return distance <= planetSurface(planet, sample).radius;
    }) : s.y >= ground(m, s.x);
    if (hitGround || m.tanks.some(tank => {
      if (!tank.hull) return false;
      const center = tankCenter(m, tank);
      return Math.hypot(center.x - s.x, center.y - s.y) <= 10;
    })) {
      explode(m, s.x, s.y);
      continue;
    }
    const radialX = launchPlanet ? s.x - launchPlanet.x : 0;
    const radialY = launchPlanet ? s.y - launchPlanet.y : -1;
    if (s.split && s.vx * radialX + s.vy * radialY <= 0) {
      const length = Math.hypot(radialX, radialY);
      for (const spread of [-42, 0, 42]) remaining.push({
        ...s, vx: s.vx - spread * radialY / length, vy: s.vy + spread * radialX / length, split: false,
      });
    } else remaining.push(s);
  }
  m.shells = remaining;
  if (remaining.length || m.blasts.length) return;
  const hits = m.damage.flatMap((n,i) => n ? [m.tanks[i].name + ' −' + n + ' hull'] : []);
  const miss = timedOut ? 'Shot timed out.' : 'Shot went wide.';
  m.report = hits.join(' · ') || (m.impacts ? 'Ground hit. No hull damage.' : miss);
  if (m.tanks.filter(t => t.hull > 0).length <= 1) {
    m.phase = 'over';
  } else {
    m.turn = nextSurvivor(m);
    m.drive = DRIVE;
    m.phase = 'aim';
  }
}
