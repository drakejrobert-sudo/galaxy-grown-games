import { readArchive } from '../galaxy/storage';
import { roomCourse, roomPreviewKey, type RoomCoursePreview } from '../galaxy/room-course';
import { roomRequest } from './client';
import { connected, maxCourseStops, type GuestRoutePlanner, type HostRoutePlanner, type RoomMap } from './map-types';

type RunAction = (action: () => Promise<string>) => void;
type Draft = { revision: string; stops: string[]; id: string; scroll: number };

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

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function schematic(map: RoomMap, stops: string[], choose: (id: string) => void) {
  const image = svg('svg', { viewBox: '0 0 900 500', 'aria-hidden': 'true' });
  const positions = new Map(map.stops.map(stop => [stop.id, stop]));
  for (const [from, to] of map.links) {
    const a = positions.get(from)!;
    const b = positions.get(to)!;
    const plotted = stops.slice(1).some((id, i) => id === from && stops[i] === to || id === to && stops[i] === from);
    image.append(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: plotted ? 'course-leg' : 'available-leg' }));
  }
  for (const stop of map.stops) {
    const marker = svg('g', { class: stops.includes(stop.id) ? 'course-stop selected-stop' : 'course-stop' });
    const title = svg('title', {});
    title.textContent = stop.name;
    const label = svg('text', { x: stop.x > 690 ? stop.x - 28 : stop.x + 28, y: stop.y + 5,
      'text-anchor': stop.x > 690 ? 'end' : 'start' });
    label.textContent = stop.name;
    marker.append(title, svg('circle', { cx: stop.x, cy: stop.y, r: 32 }), label);
    if (stop.id !== stops.at(-1) && stops.length < maxCourseStops && connected(map.links, stops.at(-1)!, stop.id)) {
      marker.classList.add('next-stop');
      marker.onclick = () => choose(stop.id);
    }
    image.append(marker);
  }
  return image;
}

function stopNames(map: RoomMap, stops: string[]): string {
  return stops.map(id => map.stops.find(stop => stop.id === id)?.name ?? 'Unknown stop').join(' → ');
}

export function guestRoutePanel(roomId: string, seatId: string, planner: GuestRoutePlanner, draft: Draft,
  run: RunAction, refresh: () => Promise<void>) {
  const { map, proposals } = planner;
  const panel = node('section');
  panel.className = 'room-route-panel';
  const id = 'route-' + seatId;
  const heading = node('h4', 'Propose a route');
  heading.id = id;
  heading.tabIndex = -1;
  panel.setAttribute('aria-labelledby', id);
  const board = node('div');
  board.className = 'room-route-board';
  board.tabIndex = 0;
  board.id = id + '-board';
  board.setAttribute('aria-label', 'Shared map. Scroll sideways to see the entire map.');
  const editor = node('div');
  const course = node('p');
  course.setAttribute('role', 'status');
  const choices = node('div');
  choices.className = 'room-route-choices';
  const actions = node('div');
  actions.className = 'room-route-choices';
  const undo = button('Undo last stop', id + '-undo', () => {
    draft.stops.pop();
    draft.id = crypto.randomUUID();
    draw(undo.id);
  });
  const submit = button('Send proposal', id + '-send', () => run(async () => {
    await roomRequest('/' + roomId + '/proposals', 'POST', { id: draft.id, revision: map.revision, stops: draft.stops });
    draft.stops = [map.start];
    draft.id = crypto.randomUUID();
    draw(heading.id);
    await refresh();
    return 'Proposal sent to the DM.';
  }));
  submit.className = 'primary';

  function choose(stop: string, focusId?: string) {
    draft.stops.push(stop);
    draft.id = crypto.randomUUID();
    draw(focusId);
  }
  function draw(focusId?: string) {
    const names = stopNames(map, draft.stops);
    course.textContent = draft.stops.length === 1 ? 'Start at ' + names : names;
    board.replaceChildren(schematic(map, draft.stops, choose));
    choices.replaceChildren();
    if (draft.stops.length < maxCourseStops) {
      for (const [index, stop] of map.stops.entries()) {
        if (!connected(map.links, draft.stops.at(-1)!, stop.id)) continue;
        const controlId = id + '-stop-' + index;
        choices.append(button('Add ' + stop.name, controlId, () => choose(stop.id, controlId)));
      }
    }
    undo.disabled = submit.disabled = draft.stops.length < 2;
    board.scrollLeft = draft.scroll;
    if (focusId) (document.getElementById(focusId) ?? (submit.disabled ? heading : submit)).focus({ preventScroll: true });
  }
  board.onscroll = () => { draft.scroll = board.scrollLeft; };
  actions.append(undo, submit);
  editor.append(course, choices, actions);
  panel.append(heading, node('p', 'Tap a connected stop on the map or use the stop buttons to build your course.'), board, editor);
  draw();
  requestAnimationFrame(() => { if (board.isConnected) board.scrollLeft = draft.scroll; });
  if (proposals.length) {
    const list = node('ul');
    for (const proposal of proposals) list.append(node('li', stopNames(map, proposal.stops) + ' · ' + proposal.status));
    panel.append(node('h4', 'Your proposals'), list);
  }
  return panel;
}

export function newRouteDraft(map: RoomMap): Draft {
  return { revision: map.revision, stops: [map.start], id: crypto.randomUUID(), scroll: 0 };
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
