import type { MapSource, RoomMap, RouteProposal } from '../rooms/map-types';
import { validSharedCourse } from '../rooms/map-types';
import { switchMap, validateCourse, type Archive } from './model';

export const roomPreviewKey = 'galaxy-grown-room-course';

export interface RoomCoursePreview {
  source: MapSource;
  map: RoomMap;
  stops: RouteProposal['stops'];
}

export function roomCourse(archive: Archive | null, { source, map, stops }: RoomCoursePreview) {
  const campaign = archive?.campaigns.find(item => item.id === source.campaignId);
  const sector = campaign?.maps.find(item => item.id === source.mapId);
  if (!campaign || !sector) throw Error('Open the working campaign and map that shared this course.');
  if (!validSharedCourse(map, stops)) throw Error('This proposal is no longer valid on the shared map.');
  const target = { ...campaign, activeMap: sector.id };
  validateCourse(target, stops);
  if (stops.some(id => {
    const shared = map.stops.find(stop => stop.id === id);
    const local = sector.destinations.find(stop => stop.id === id);
    return !shared || !local || shared.name !== local.name || shared.x !== local.x || shared.y !== local.y;
  })) {
    throw Error('The map has changed since it was shared. Share the updated map and ask for a new proposal.');
  }
  return { campaign, stops };
}

export function openRoomCourse(archive: Archive, preview: RoomCoursePreview): string[] {
  const { campaign, stops } = roomCourse(archive, preview);
  switchMap(campaign, preview.source.mapId);
  archive.selected = campaign.id;
  return [...stops];
}
