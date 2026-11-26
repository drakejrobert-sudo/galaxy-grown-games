import { readArchive } from '../galaxy/storage';
import { roomCourse, roomPreviewKey, type RoomCoursePreview } from '../galaxy/room-course';
import { roomRequest } from './client';
import { type HostRoutePlanner, type RoomMap } from './map-types';

type RunAction = (action: () => Promise<string>) => void;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
}

function button(text: string, id: string, click: () => void) {
  const control = node('button', text);
  control.type = 'button';
  control.id = id;
  control.onclick = click;
  return control;
}

function stopNames(map: RoomMap, stops: string[]): string {
  return stops.map(id => map.stops.find(stop => stop.id === id)?.name ?? 'Unknown stop').join(' → ');
}

export function hostRoutePanel(roomId: string, planner: HostRoutePlanner | undefined,
  run: RunAction, refresh: () => Promise<void>) {
  const panel = node('section');
  panel.className = 'room-route-panel';
  const share = node('a', 'Share a map from GM preparation');
  share.href = './#/map';
  panel.append(node('h4', 'Route proposals'), share);
  if (!planner) return panel;
  const { proposals, source, map } = planner;
  if (!proposals.length) panel.append(node('p', 'Waiting for route proposals.'));
  for (const proposal of proposals) {
    const entry = node('div');
    entry.className = 'room-route-proposal';
    entry.append(node('p', proposal.player + ' · ' + stopNames(map, proposal.stops) + ' · ' + proposal.status));
    const id = 'proposal-' + roomId + '-' + proposal.seatId + '-' + proposal.id;
    const path = '/' + roomId + '/proposals/' + proposal.id;
    const decide = (status: 'accepted' | 'declined') => roomRequest(path, 'PUT', {
      revision: map.revision, seatId: proposal.seatId, status,
    });
    if (proposal.status !== 'declined') {
      const label = proposal.status === 'pending' ? 'Accept and preview' : 'Open course preview';
      entry.append(button(label, id + '-preview', () => run(async () => {
        const preview: RoomCoursePreview = { source, map, stops: proposal.stops };
        roomCourse(readArchive(localStorage), preview);
        await decide('accepted');
        sessionStorage.setItem(roomPreviewKey, JSON.stringify(preview));
        location.assign('./#/map');
        return 'Course accepted.';
      })));
    }
    if (proposal.status === 'pending') entry.append(button('Decline', id + '-decline', () => run(async () => {
      await decide('declined');
      await refresh();
      return 'Proposal declined.';
    })));
    panel.append(entry);
  }
  return panel;
}
