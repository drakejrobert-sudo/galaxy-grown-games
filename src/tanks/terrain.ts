export const WIDTH = 800;
export const HEIGHT = 400;

export const BATTLEFIELDS = {
  hillside: 'Hillside',
  moon: 'Moon Basin',
  planets: 'Planet Skirmish',
} as const;
export type Battlefield = keyof typeof BATTLEFIELDS;

export interface Planet {
  x: number;
  y: number;
  radius: number;
  surface: number[];
}

const FULL_CIRCLE = Math.PI * 2;

export function battlefieldTerrain(battlefield: Battlefield, count: number, random: () => number) {
  if (battlefield === 'planets') {
    const planets: Planet[] = [
      {x: 150, y: 228, radius: 66}, {x: 408, y: 113, radius: 52}, {x: 639, y: 244, radius: 72},
    ].map(planet => ({...planet, surface: Array<number>(Math.round(FULL_CIRCLE * planet.radius)).fill(planet.radius)}));
    const seats = [[0, -36], [2, 155], [1, 100], [0, 35], [2, -130], [1, 148], [0, -109], [2, 88]];
    const spawns = seats.slice(0, count).map(([planet, angle]) => {
      const length = planets[planet].surface.length;
      return {planet, x: (Math.round(angle / 360 * length) + length) % length};
    });
    return {terrain: [], planets, spawns};
  }
  const phase = random() * FULL_CIRCLE, second = random() * FULL_CIRCLE;
  const terrain = Array.from({length: WIDTH}, (_, x) => {
    if (battlefield === 'hillside') return 278 + 29 * Math.sin(x / 125 + phase) + 15 * Math.cos(x / 57 + second);
    const basin = Math.max(0, 1 - ((x - 400) / 270) ** 2);
    const crater = Math.max(0, 1 - ((x - 210) / 58) ** 2);
    return 249 + 61 * basin ** 2 + 24 * crater ** 2 + 6 * Math.cos(x / 36 + phase);
  });
  const spawns = Array.from({length: count}, (_, i) => ({x: Math.round(54 + i * (WIDTH - 108) / (count - 1))}));
  return {terrain, planets: [], spawns};
}

export function planetSurface(planet: Planet, sample: number) {
  const length = planet.surface.length;
  const index = (sample % length + length) % length;
  const lower = Math.floor(index), fraction = index - lower;
  const radius = planet.surface[lower] * (1 - fraction) + planet.surface[(lower + 1) % length] * fraction;
  const angle = index * FULL_CIRCLE / length;
  const nx = Math.cos(angle), ny = Math.sin(angle);
  return {x: planet.x + nx * radius, y: planet.y + ny * radius, nx, ny, radius};
}

export function planetGravity(planets: Planet[], x: number, y: number) {
  let gx = 0, gy = 0;
  for (const planet of planets) {
    const dx = planet.x - x, dy = planet.y - y;
    const distance = Math.max(planet.radius * .6, Math.hypot(dx, dy));
    const pull = 260 * planet.radius ** 2 / distance ** 3;
    gx += dx * pull;
    gy += dy * pull;
  }
  return {x: gx, y: gy};
}

export function carvePlanet(planet: Planet, x: number, y: number, blast: number) {
  const dx = x - planet.x, dy = y - planet.y;
  if (Math.hypot(dx, dy) > planet.radius + blast) return;
  const length = planet.surface.length;
  for (let i = 0; i < length; i++) {
    const angle = i * FULL_CIRCLE / length;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const across = dx * Math.sin(angle) - dy * Math.cos(angle);
    if (along <= 0 || Math.abs(across) >= blast) continue;
    const inward = along - .75 * Math.sqrt(blast ** 2 - across ** 2);
    planet.surface[i] = Math.max(planet.radius * .48, Math.min(planet.surface[i], inward));
  }
}
