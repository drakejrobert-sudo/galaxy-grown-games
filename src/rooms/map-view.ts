import { readArchive } from '../galaxy/storage';
import { roomCourse, roomPreviewKey, type RoomCoursePreview } from '../galaxy/room-course';
import { roomRequest } from './client';
import type { HostRoutePlanner, RoomMap } from './map-types';

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

export type SharedProposal = HostRoutePlanner['proposals'][number];
export type ReviewDecision = 'accepted' | 'declined';
export type ReviewRoute = (proposal: SharedProposal, status: ReviewDecision) => void;

export function decideRoomRoute(roomId: string, planner: HostRoutePlanner, proposal: SharedProposal, status: ReviewDecision) {
  return roomRequest(`/${roomId}/proposals/${proposal.id}`, 'PUT', {
    revision: planner.map.revision, seatId: proposal.seatId, status,
  });
}

export function proposalEntries(roomId: string, planner: HostRoutePlanner, review: ReviewRoute, busy = false): HTMLElement[] {
  if (!planner.proposals.length) return [node('p', 'Waiting for route proposals.')];
  return planner.proposals.map(proposal => {
    const entry = node('div');
    entry.className = 'room-route-proposal';
    entry.append(node('p', proposal.player + ' · ' + stopNames(planner.map, proposal.stops) + ' · ' + proposal.status));
    const id = 'proposal-' + roomId + '-' + proposal.seatId + '-' + proposal.id;
    if (proposal.status !== 'declined') {
      const label = proposal.status === 'pending' ? 'Accept and preview' : 'Open course preview';
      const accept = button(label, id + '-preview', () => review(proposal, 'accepted'));
      accept.disabled = busy;
      entry.append(accept);
    }
    if (proposal.status === 'pending') {
      const decline = button('Decline', id + '-decline', () => review(proposal, 'declined'));
      decline.disabled = busy;
      entry.append(decline);
    }
    return entry;
  });
}

export function hostRoutePanel(roomId: string, planner: HostRoutePlanner | undefined,
  run: RunAction, refresh: () => Promise<void>) {
  const panel = node('section');
  panel.className = 'room-route-panel';
  const share = node('a', 'Share a map from GM preparation');
  share.href = './#/map';
  panel.append(node('h4', 'Route proposals'), share);
  if (!planner) return panel;
  panel.append(...proposalEntries(roomId, planner, (proposal, decision) => run(async () => {
    if (decision === 'declined') {
      await decideRoomRoute(roomId, planner, proposal, decision);
      await refresh();
      return 'Proposal declined.';
    }

    const preview: RoomCoursePreview = { source: planner.source, map: planner.map, stops: proposal.stops };
    roomCourse(readArchive(localStorage), preview);
    await decideRoomRoute(roomId, planner, proposal, decision);
    sessionStorage.setItem(roomPreviewKey, JSON.stringify(preview));
    location.assign('./#/map');
    return 'Course accepted.';
  })));
  return panel;
}
