export interface SharedStop {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface SharedMap {
  start: string;
  stops: SharedStop[];
  links: [string, string][];
}

export interface RoomMap extends SharedMap {
  revision: string;
}

export interface MapSource {
  campaignId: string;
  mapId: string;
}

export type ProposalStatus = 'pending' | 'accepted' | 'declined';

export interface RouteProposal {
  id: string;
  stops: string[];
  status: ProposalStatus;
}

export interface GuestRoutePlanner {
  map: RoomMap;
  proposals: RouteProposal[];
}

export interface HostRoutePlanner {
  map: RoomMap;
  source: MapSource;
  proposals: (RouteProposal & { player: string; seatId: string })[];
}

export const maxCourseStops = 25;
export const mapKey = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= 100 && !/[\u0000-\u001f\u007f]/.test(value);

export function connected(links: SharedMap['links'], from: string, to: string): boolean {
  return links.some(([a, b]) => a === from && b === to || a === to && b === from);
}

export function readSharedMap(value: unknown): SharedMap | null {
  if (!value || typeof value !== 'object') return null;
  const { start, stops, links } = value as Partial<SharedMap>;
  if (!mapKey(start) || !Array.isArray(stops) || stops.length < 2 || stops.length > 100
    || !Array.isArray(links) || links.length < 1 || links.length > 250) return null;

  const stopIds = new Set<string>();
  const safeStops: SharedStop[] = [];
  for (const stop of stops) {
    if (!stop || !mapKey(stop.id) || stopIds.has(stop.id) || !mapKey(stop.name) || !stop.name.trim()
      || !Number.isFinite(stop.x) || stop.x < 40 || stop.x > 860
      || !Number.isFinite(stop.y) || stop.y < 50 || stop.y > 450) return null;
    stopIds.add(stop.id);
    safeStops.push({ id: stop.id, name: stop.name, x: stop.x, y: stop.y });
  }
  const safeLinks: SharedMap['links'] = [];
  for (const link of links) {
    if (!Array.isArray(link) || link.length !== 2) return null;
    const [a, b] = link;
    if (!stopIds.has(a) || !stopIds.has(b) || a === b || connected(safeLinks, a, b)) return null;
    safeLinks.push([a, b]);
  }
  if (!stopIds.has(start) || !safeLinks.some(link => link.includes(start))) return null;
  return { start, stops: safeStops, links: safeLinks };
}

export function validSharedCourse(map: SharedMap, stops: string[]): boolean {
  return stops.length >= 2 && stops.length <= maxCourseStops && stops[0] === map.start
    && stops.slice(1).every((stop, index) => connected(map.links, stops[index], stop));
}
