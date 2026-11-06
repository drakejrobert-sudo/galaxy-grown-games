export type Risk = 'Low' | 'Medium' | 'High';
export type Situation = 'asteroid-field' | 'space-battle' | 'boarding-party';
export interface Destination { id: string; name: string; type: 'planet' | 'ship' | 'station' | 'point' | 'system' | 'star'; navigable?: boolean; detailMapId?: string; x: number; y: number; description: string }
export interface Route { id: string; from: string; to: string; steps: number; risk: Risk; table: string; provisional?: boolean }
export interface Encounter { id: string; title: string; prompt: string; notes: string; type: 'narrative' | 'VTT' | 'minigame'; situation: Situation }
export interface EncounterTable { id: string; name: string; entries: { encounter: string; weight: number }[] }
export interface Schedule { id: string; leg: number; step: number; encounter: string; consumed: boolean }
export interface Journey { stops: string[]; leg: number; step: number; active: string | null; arrived: boolean }
export interface SectorMap { id: string; name: string; description: string; decoration: 'none' | 'orbits'; backgroundImage?: string; destinations: Destination[]; routes: Route[]; schedules: Schedule[]; journey: Journey | null; location: string | null; log: string[] }
export interface Campaign { id: string; name: string; maps: SectorMap[]; activeMap: string; encounters: Encounter[]; tables: EncounterTable[] }
export interface Archive { version: 2; selected: string; campaigns: Campaign[] }
export function activeMap(c: Campaign): SectorMap {
  const map = c.maps.find(m => m.id === c.activeMap);
  if (!map) throw Error('Selected map is missing.');
  return map;
}
export function blankMap(name: string): SectorMap {
  return { id: uid(), name, description: '', decoration: 'none', destinations: [], routes: [], schedules: [], journey: null, location: null, log: [] };
}
export function switchMap(c: Campaign, mapId: string) {
  if (!c.maps.some(m => m.id === mapId)) throw Error('Choose an existing map.');
  c.activeMap = mapId;
}
export function deleteMap(c: Campaign, mapId: string) {
  const map = c.maps.find(m => m.id === mapId);
  if (!map) throw Error('Choose an existing map.');
  if (c.maps.length === 1) throw Error('Keep at least one map in the campaign.');
  if (c.maps.some(m => m.destinations.some(d => d.detailMapId === mapId))) throw Error('Remove destination links to this map before deleting it.');
  if (map.journey && !map.journey.arrived) throw Error('End this map’s journey before deleting it.');
  c.maps = c.maps.filter(m => m.id !== mapId);
  if (c.activeMap === mapId) c.activeMap = c.maps[0].id;
}
export function libraryLocked(c: Campaign) { return c.maps.some(m => m.journey && !m.journey.arrived); }

export const riskChance: Record<Risk, number> = { Low: .1, Medium: .25, High: .5 };
export const uid = () => crypto.randomUUID();
export function routeBetween(c: Campaign, a: string, b: string) {
  return activeMap(c).routes.find(r => r.from === a && r.to === b || r.from === b && r.to === a);
}
export function routeFor(c: Campaign, j = activeMap(c).journey!) { return routeBetween(c, j.stops[j.leg], j.stops[j.leg + 1])!; }
export function startJourney(c: Campaign, stops: string[]) {
  const m = activeMap(c);
  if (m.journey && !m.journey.arrived) throw Error('End the current journey before plotting another course.');
  if (stops.length < 2 || stops.some(s => !m.destinations.some(d => d.id === s && d.navigable !== false)) || stops.slice(1).some((s, i) => !routeBetween(c, stops[i], s))) throw Error('Choose at least two connected stops.');
  if (m.location && stops[0] !== m.location) throw Error('Start at your current destination.');
  m.journey = { stops: [...stops], leg: 0, step: 0, active: null, arrived: false }; m.location = stops[0]; m.schedules = [];
  m.log.push('Course confirmed.');
}
function finishStep(c: Campaign) {
  const m = activeMap(c);
  const j = m.journey!;
  if (j.step < routeFor(c).steps) return;
  m.location = j.stops[j.leg + 1];
  m.log.push(`Arrived at ${m.destinations.find(d => d.id === m.location)!.name}.`);
  if (j.leg === j.stops.length - 2) j.arrived = true;
  else { j.leg++; j.step = 0; }
}
export function weightedEncounter(table: EncounterTable | undefined, random: () => number): string | null {
  if (!table?.entries.length) return null;
  let ticket = random() * table.entries.reduce((n, e) => n + e.weight, 0);
  for (const entry of table.entries) { ticket -= entry.weight; if (ticket < 0) return entry.encounter; }
  return table.entries.at(-1)!.encounter;
}
export function advance(c: Campaign, random = Math.random) {
  const m = activeMap(c);
  const j = m.journey;
  if (!j || j.arrived || j.active) throw Error('Travel cannot advance now.');
  const route = routeFor(c); j.step++; m.location = null;
  const scheduled = m.schedules.find(s => s.leg === j.leg && s.step === j.step && !s.consumed);
  if (scheduled) { scheduled.consumed = true; j.active = scheduled.encounter; }
  else if (random() < riskChance[route.risk]) j.active = weightedEncounter(c.tables.find(t => t.id === route.table), random);
  m.log.push(`Leg ${j.leg + 1}, step ${j.step}: ${j.active ? c.encounters.find(e => e.id === j.active)!.title : 'clear passage'}.`);
  if (!j.active) finishStep(c);
}
export function insertEncounter(c: Campaign, id: string) {
  const m = activeMap(c);
  if (!m.journey || m.journey.arrived || m.journey.active || !c.encounters.some(e => e.id === id)) throw Error('Cannot insert this encounter now.');
  m.journey.active = id; m.log.push(`Encounter inserted: ${c.encounters.find(e => e.id === id)!.title}.`);
}
export function resolveEncounter(c: Campaign, note: string) {
  const m = activeMap(c);
  if (!m.journey?.active) throw Error('No encounter to resolve.');
  m.log.push(`Encounter resolved${note.trim() ? ': ' + note.trim() : '.'}`); m.journey.active = null; finishStep(c);
}
export function scheduleEncounter(c: Campaign, leg: number, step: number, encounter: string) {
  const m = activeMap(c);
  const j = m.journey;
  if (!j || j.arrived || !Number.isInteger(leg) || leg < j.leg || leg >= j.stops.length - 1 || !Number.isInteger(step) || step < 1 || step > routeBetween(c, j.stops[leg], j.stops[leg + 1])!.steps || leg === j.leg && step <= j.step) throw Error('Choose a future leg and step in this course.');
  if (!c.encounters.some(e => e.id === encounter)) throw Error('Choose an encounter.');
  if (m.schedules.some(s => s.leg === leg && s.step === step)) throw Error('That travel step already has a scheduled encounter.');
  m.schedules.push({ id: uid(), leg, step, encounter, consumed: false });
}
export function endJourney(c: Campaign) {
  const m = activeMap(c);
  if (m.journey?.active || !m.location) throw Error('Resolve the encounter and reach a destination before ending travel.');
  m.journey = null; m.schedules = []; m.log.push('Journey ended at destination.');
}
export function challengeLink(base: string, situation: Situation) { const url = new URL(base); url.search = ''; url.hash = ''; url.searchParams.set('situation', situation); return url.href; }
export function blankCampaign(name: string): Campaign { const map = blankMap('Overview'); return { id: uid(), name, maps: [map], activeMap: map.id, encounters: [], tables: [] }; }
export function demoCampaign(name = 'Demo • Lantern Sector'): Campaign {
  const c = blankCampaign(name);
  const m = activeMap(c);
  m.destinations = [
    { id: 'haven', name: 'Lantern Haven', type: 'station', x: 130, y: 250, description: 'Fictional demo station. A welcoming departure point.' },
    { id: 'cinder', name: 'Cinder', type: 'planet', x: 360, y: 150, description: 'Fictional demo planet with warm copper clouds.' },
    { id: 'echo', name: 'Echo Vessel', type: 'ship', x: 610, y: 290, description: 'Fictional stationary survey ship.' },
    { id: 'veil', name: 'Silver Veil', type: 'point', x: 390, y: 400, description: 'Fictional point of interest in a luminous nebula.' },
    { id: 'blue', name: 'Blue Orchard', type: 'planet', x: 790, y: 140, description: 'Fictional distant planet.' },
  ];
  c.encounters = [
    { id: 'rocks', title: 'Drifting asteroid field', prompt: 'An asteroid field crosses the course. Prepare your crew stations; ask the GM which checks to roll.', notes: 'Demo only. Decide consequences after players report.', type: 'minigame', situation: 'asteroid-field' },
    { id: 'signal', title: 'A curious transmission', prompt: 'A repeating signal interrupts the quiet. What does the crew do?', notes: '', type: 'narrative', situation: 'asteroid-field' },
    { id: 'boarding', title: 'An unexpected rendezvous', prompt: 'A vessel requests a meeting. Travel pauses while the GM runs the encounter in Maps VTT.', notes: 'Use your already-open Maps session.', type: 'VTT', situation: 'asteroid-field' },
    { id: 'repel-boarders', title: 'Boarding Party — repel boarders', prompt: 'A pursuing carrier launches boarding pods. Prepare your stations and repel the boarding party; ask the GM which checks to roll.', notes: 'Independent station challenges. The GM decides consequences after reports.', type: 'minigame', situation: 'boarding-party' },
    { id: 'battle', title: 'Hostile approach', prompt: 'Unknown ships close in. Prepare for a Space Battle crew challenge.', notes: '', type: 'minigame', situation: 'space-battle' },
  ];
  c.tables = [{ id: 'demo-table', name: 'Demo travel encounters', entries: c.encounters.map(e => ({ encounter: e.id, weight: 1 })) }];
  m.routes = [ ['haven','cinder',2,'Low'], ['cinder','echo',3,'High'], ['haven','veil',3,'Medium'], ['veil','echo',2,'Low'], ['echo','blue',2,'Medium'] ].map(([from,to,steps,risk], i) => ({ id: `r${i}`, from: String(from), to: String(to), steps: Number(steps), risk: risk as Risk, table: 'demo-table' }));
  return c;
}
