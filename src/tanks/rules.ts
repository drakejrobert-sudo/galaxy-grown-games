export const WIDTH = 800;
export const HEIGHT = 400;
export const TANK_WIDTH = 24;
export const DRIVE = TANK_WIDTH * 2;
export const STEP = 1 / 120;
const GRAVITY = 190;
export type Ammo = 'standard' | 'heavy' | 'starburst';
export interface Aim { direction: 1 | -1; angle: number; power: number; ammo: Ammo }
export interface Tank { name: string; x: number; hull: number }
interface Shell { x: number; y: number; vx: number; vy: number; split: boolean }
interface Blast { x: number; y: number; radius: number; life: number }
export interface Match {
  terrain: number[]; tanks: Tank[]; order: number[]; turn: number; dm: number;
  drive: number; heavy: number; starburst: number; phase: 'aim' | 'shot' | 'result' | 'over';
  shells: Shell[]; blasts: Blast[]; damage: number[]; ammo: Ammo; impacts: number; report: string;
}
export function createMatch(names: string[], dm: number, seed: number): Match {
  if (names.length < 2 || names.length > 8 || !Number.isInteger(dm) || !names[dm] ||
      names.some(name => !name.trim())) throw new Error('Choose 2–8 named tanks and a DM.');
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const phase = random() * Math.PI * 2, second = random() * Math.PI * 2;
  const terrain = Array.from({length: WIDTH}, (_, x) =>
    278 + 29 * Math.sin(x / 125 + phase) + 15 * Math.cos(x / 57 + second));
  const tanks = names.map((name, i) => ({ name: name.trim(), hull: 3,
    x: Math.round(54 + i * (WIDTH - 108) / (names.length - 1)) }));
  const order = tanks.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {terrain, tanks, dm, order, turn: 0, drive: DRIVE, heavy: 2, starburst: 1,
    phase: 'aim', shells: [], blasts: [], damage: tanks.map(() => 0), ammo: 'standard', impacts: 0, report: ''};
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
export function drive(m: Match, direction: 1 | -1) {
  if (m.phase !== 'aim') return;
  const tank = m.tanks[active(m)];
  for (let step = 0; step < 6 && m.drive > 0; step++) {
    const x = tank.x + direction;
    if (x < TANK_WIDTH / 2 || x >= WIDTH - TANK_WIDTH / 2 ||
        Math.abs(ground(m, x) - ground(m, tank.x)) > 1.4 ||
        m.tanks.some(other => other !== tank && other.hull > 0 && Math.abs(other.x - x) < TANK_WIDTH)) break;
    tank.x = x;
    m.drive--;
  }
}
export function muzzle(m: Match, aim: Aim) {
  const tank = m.tanks[active(m)], radians = aim.angle * Math.PI / 180;
  const dx = Math.cos(radians) * aim.direction, dy = -Math.sin(radians);
  return { x: tank.x + dx * 18, y: ground(m, tank.x) - 10 + dy * 18, dx, dy };
}
export function fire(m: Match, aim: Aim) {
  if (m.phase !== 'aim') return;
  if (aim.ammo !== 'standard') {
    if (active(m) !== m.dm || m[aim.ammo] <= 0) return;
    m[aim.ammo]--;
  }
  const {x,y,dx,dy} = muzzle(m, aim);
  const speed = 75 + aim.power * 3.6;
  m.shells = [{ x, y, vx: dx * speed, vy: dy * speed, split: aim.ammo === 'starburst' }];
  m.ammo = aim.ammo;
  m.impacts = 0;
  m.damage.fill(0);
  m.phase = 'shot';
}
function explode(m: Match, x: number, y: number) {
  const radius = m.ammo === 'heavy' ? 45 : m.ammo === 'starburst' ? 23 : 29;
  m.blasts.push({x, y, radius, life: .36});
  m.impacts++;
  for (const [i, tank] of m.tanks.entries()) {
    if (!tank.hull) continue;
    const distance = Math.hypot(tank.x - x, ground(m, tank.x) - 6 - y);
    const damage = Math.min(tank.hull, distance <= 13 ? 2 : distance <= radius ? 1 : 0);
    tank.hull -= damage;
    m.damage[i] += damage;
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
  for (const s of m.shells) {
    s.vy += GRAVITY * STEP;
    s.x += s.vx * STEP;
    s.y += s.vy * STEP;
    if (s.x < 0 || s.x >= WIDTH) continue;
    if (s.y >= ground(m, s.x) || m.tanks.some(t => t.hull > 0 && Math.hypot(t.x - s.x, ground(m,t.x) - 6 - s.y) <= 10)) {
      explode(m, s.x, s.y);
    } else if (s.split && s.vy >= 0) {
      for (const spread of [-42, 0, 42]) remaining.push({...s, vx: s.vx + spread, split: false});
    } else remaining.push(s);
  }
  m.shells = remaining;
  if (remaining.length || m.blasts.length) return;
  const hits = m.damage.flatMap((n,i) => n ? [m.tanks[i].name + ' −' + n + ' hull'] : []);
  m.report = hits.join(' · ') || (m.impacts ? 'Ground hit. No hull damage.' : 'Shot went wide.');
  m.phase = m.tanks.filter(t => t.hull > 0).length <= 1 ? 'over' : 'result';
}
export function advance(m: Match) {
  if (m.phase !== 'result') return;
  m.turn = nextSurvivor(m);
  m.drive = DRIVE;
  m.phase = 'aim';
}
