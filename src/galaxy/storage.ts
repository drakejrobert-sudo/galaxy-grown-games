import type { Archive, Campaign } from './model';
export const STORAGE_KEY = 'galaxy-grown-map-v1';
function check(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
const text = (v: unknown) => typeof v === 'string' && v.length <= 20000;
const id = (v: unknown) => text(v) && !!v && (v as string).length <= 100;
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
function list(v: unknown): asserts v is Record<string, any>[] { check(Array.isArray(v) && v.length <= 10000 && v.every(x => x && typeof x === 'object' && !Array.isArray(x)), 'Invalid list.'); }
function unique(items: { id: string }[]) { check(items.every(x => id(x.id)) && new Set(items.map(x => x.id)).size === items.length, 'IDs must be present and unique.'); }
export function validateArchive(value: unknown): Archive {
  check(value && typeof value === 'object', 'Invalid archive.');
  const a = value as Archive;
  check(a.version === 1, 'Unsupported save version.'); list(a.campaigns); check(a.campaigns.length > 0, 'Archive must contain a campaign.'); unique(a.campaigns);
  check(a.campaigns.some(c => c.id === a.selected), 'Selected campaign is missing.');
  for (const c of a.campaigns) {
    check(text(c.name) && c.name.trim(), 'Campaign needs a name.');
    for (const items of [c.destinations, c.routes, c.encounters, c.tables, c.schedules]) { list(items); unique(items); }
    const hasDestination = (s: unknown) => c.destinations.some(d => d.id === s);
    const hasEncounter = (s: unknown) => c.encounters.some(e => e.id === s);
    for (const d of c.destinations) check(text(d.name) && d.name.trim() && text(d.description) && ['planet','ship','station','point'].includes(d.type) && typeof d.x === 'number' && Number.isFinite(d.x) && d.x >= 40 && d.x <= 860 && typeof d.y === 'number' && Number.isFinite(d.y) && d.y >= 50 && d.y <= 450, 'Invalid destination. Coordinates: X 40–860, Y 50–450.');
    for (const e of c.encounters) check(text(e.title) && e.title.trim() && text(e.prompt) && text(e.notes) && ['narrative','VTT','minigame'].includes(e.type) && ['asteroid-field','space-battle'].includes(e.situation), 'Invalid encounter.');
    for (const t of c.tables) { check(text(t.name) && t.name.trim(), 'Table needs a name.'); list(t.entries); check(new Set(t.entries.map(e => e.encounter)).size === t.entries.length, 'Duplicate table entry.'); for (const e of t.entries) check(hasEncounter(e.encounter) && integer(e.weight, 1, 1000000), 'Invalid table entry or weight.'); }
    const pairs = new Set<string>();
    for (const r of c.routes) {
      check(hasDestination(r.from) && hasDestination(r.to) && r.from !== r.to && integer(r.steps, 1, 1000) && ['Low','Medium','High'].includes(r.risk) && text(r.table), 'Invalid route.');
      // Missing tables are allowed and shown as warnings, never rolled.
      const pair = [r.from, r.to].sort().join('|'); check(!pairs.has(pair), 'Duplicate connection.'); pairs.add(pair);
    }
    check(c.location === null || hasDestination(c.location), 'Invalid current destination.');
    check(Array.isArray(c.log) && c.log.length <= 100000 && c.log.every(text), 'Invalid event log.');
    const j = c.journey;
    if (j !== null) {
      check(j && Array.isArray(j.stops) && j.stops.length >= 2 && j.stops.length <= 1000 && j.stops.every(hasDestination), 'Invalid journey stops.');
      const routes = j.stops.slice(1).map((s, i) => c.routes.find(r => r.from === j.stops[i] && r.to === s || r.to === j.stops[i] && r.from === s));
      check(routes.every(Boolean), 'Journey contains disconnected stops.');
      check(integer(j.leg, 0, routes.length - 1) && integer(j.step, 0, routes[j.leg]!.steps) && typeof j.arrived === 'boolean' && (j.active === null || hasEncounter(j.active)), 'Invalid journey progress.');
      check(!j.arrived || j.leg === routes.length - 1 && j.step === routes[j.leg]!.steps && j.active === null, 'Invalid arrival state.');
      check(j.step !== routes[j.leg]!.steps || j.arrived || j.active !== null, 'Unresolved travel boundary.');
      const expectedLocation = j.arrived ? j.stops.at(-1) : j.step === 0 ? j.stops[j.leg] : null;
      check(c.location === expectedLocation, 'Journey location does not match progress.');
      const positions = new Set<string>();
      for (const s of c.schedules) {
        check(integer(s.leg, 0, routes.length - 1) && integer(s.step, 1, routes[s.leg]!.steps) && hasEncounter(s.encounter) && typeof s.consumed === 'boolean', 'Invalid scheduled encounter.');
        const key = `${s.leg}:${s.step}`; check(!positions.has(key), 'Duplicate scheduled step.'); positions.add(key);
        check(s.consumed === (s.leg < j.leg || s.leg === j.leg && s.step <= j.step), 'Invalid schedule progress.');
      }
    } else check(c.schedules.length === 0, 'Schedules require a journey.');
  }
  return structuredClone(a);
}
export function parseArchive(raw: string) { check(raw.length <= 10000000, 'Save is too large (10 MB maximum).'); return validateArchive(JSON.parse(raw)); }
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function readArchive(storage: StorageLike): Archive | null { const raw = storage.getItem(STORAGE_KEY); return raw === null ? null : parseArchive(raw); }
export function writeArchive(storage: StorageLike, archive: Archive) { storage.setItem(STORAGE_KEY, JSON.stringify(validateArchive(archive))); }
export function exportCampaign(c: Campaign): string { return JSON.stringify(validateArchive({ version: 1, selected: c.id, campaigns: [c] }), null, 2); }
