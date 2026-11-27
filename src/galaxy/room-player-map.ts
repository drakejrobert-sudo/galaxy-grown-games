import '../style.css';
import './galaxy.css';
import { surfaceNavigation } from '../site-navigation';
import { roomRequest } from '../rooms/client';
import { connected, maxCourseStops, type RoomMap } from '../rooms/map-types';
import type { JoinedRoom, RoomList } from '../rooms/types';
import { bindChartArt, chartBackdrop, chartStop, escapeMarkup as escape } from './chart';

interface Draft {
  id: string;
  revision: string;
  stops: string[];
  scroll: number;
}

const roomLabel = (room: JoinedRoom) => 'Room ' + room.id.slice(0, 8).toUpperCase();
const courseText = (map: RoomMap, stops: string[]) =>
  stops.map(id => map.stops.find(stop => stop.id === id)?.name ?? 'Unknown stop').join(' → ');

export function showRoomMap(initial: JoinedRoom[], requestedRoom?: string) {
  document.title = 'Galaxy Grown · Shared Map';
  const root = document.querySelector<HTMLElement>('#app')!;
  root.innerHTML = `<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a></header>${surfaceNavigation('Galaxy Map')}
    <main class="galaxy-main shared-map"><h1 id="shared-map-title" tabindex="-1">Shared Galaxy Map</h1>
      <p id="shared-map-status" role="status"></p><div id="shared-map-content"></div></main>`;
  const content = root.querySelector<HTMLElement>('#shared-map-content')!;
  const status = root.querySelector<HTMLElement>('#shared-map-status')!;
  const failedArt = new Set<string>();
  let rooms: JoinedRoom[] = [];
  let roomId = requestedRoom ?? initial[0]?.id ?? '';
  let snapshot = '';
  let draft: Draft | undefined;
  let artKey = '';
  let artUrl = '';
  let artRequest = 0;
  let loadingArt = false;
  let artworkFailed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let refreshing = false;
  let submitting = false;
  let suspended = false;

  function schedule() {
    clearTimeout(timer);
    if (!document.hidden && !suspended && !refreshing && !submitting && activeRoom()) {
      timer = setTimeout(() => void refresh(), 5_000);
    }
  }

  function activeRoom() {
    return rooms.find(room => room.id === roomId && room.expiresAt > Date.now());
  }

  function releaseArtwork() {
    if (artUrl) URL.revokeObjectURL(artUrl);
    artUrl = '';
  }

  function updateArtwork(room?: JoinedRoom) {
    const revision = room?.planner?.map.artworkRevision;
    const key = revision && room ? room.id + '/' + revision : '';
    if (key === artKey) return;
    artKey = key;
    loadingArt = Boolean(key);
    artworkFailed = false;
    const request = ++artRequest;
    releaseArtwork();
    if (!key || !room) return;
    void (async () => {
      try {
        const result = await fetch('/api/rooms/' + room.id + '/map/artwork?revision=' + revision, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!result.ok || !/^image\/(png|jpeg|webp)$/.test(result.headers.get('Content-Type') ?? '')) {
          throw Error('Artwork unavailable');
        }
        const data = await result.blob();
        if (request !== artRequest) return;
        artUrl = URL.createObjectURL(data);
      } catch {
        if (request === artRequest) artworkFailed = true;
      } finally {
        if (request === artRequest) {
          loadingArt = false;
          render();
        }
      }
    })();
  }

  function applyRooms(joined: JoinedRoom[]) {
    rooms = joined;
    if (!roomId) roomId = rooms[0]?.id ?? '';
    const room = activeRoom();
    const key = JSON.stringify([room, rooms.map(({ id }) => id)]);
    if (key === snapshot) return;
    snapshot = key;
    clearTimeout(expiry);
    if (room) expiry = setTimeout(() => {
      draft = undefined;
      updateArtwork();
      render();
      status.textContent = 'This room has expired.';
    }, Math.max(0, room.expiresAt - Date.now()));
    const map = room?.planner?.map;
    if (!map) draft = undefined;
    else if (draft?.revision !== map.revision) {
      if (draft) status.textContent = 'The DM updated the shared course options. Please submit a new route.';
      draft = { id: crypto.randomUUID(), revision: map.revision, stops: [map.start], scroll: 0 };
    }
    updateArtwork(room);
    render();
  }

  async function refresh() {
    if (refreshing || suspended || document.hidden) return;
    refreshing = true;
    try {
      const result = await roomRequest<RoomList>();
      applyRooms(result.joined);
    } catch (cause) {
      status.textContent = cause instanceof Error ? cause.message : 'Could not refresh the shared map.';
      if (!activeRoom()) render();
    } finally {
      refreshing = false;
      schedule();
    }
  }

  function picker() {
    if (rooms.length < 2 && activeRoom()) return '<p>' + roomLabel(activeRoom()!) + '</p>';
    if (!rooms.length) return '';
    const items = rooms.filter(room => room.expiresAt > Date.now()).map(room =>
      `<option value="${escape(room.id)}"${room.id === roomId ? ' selected' : ''}>${roomLabel(room)} · ${escape(room.seat.name)}</option>`);
    if (!items.length) return '';
    return `<label>Room map<select id="shared-room-picker">${activeRoom() ? '' : '<option value="">Choose an active room</option>'}${items.join('')}</select></label>`;
  }

  function render() {
    const focus = content.contains(document.activeElement) ? document.activeElement?.id : '';
    const room = activeRoom();
    if (!room?.planner || !draft) {
      content.innerHTML = picker() + (room ? '<p>Waiting for the DM to share a map.</p>'
        : '<p>This room is unavailable. <a href="#/rooms">Go to Rooms</a> to join an active room.</p>');
      bindPicker();
      return;
    }
    const { map, proposals } = room.planner;
    const stops = draft.stops;
    const points = new Map(map.stops.map(stop => [stop.id, stop]));
    const origin = points.get(map.start)!;
    const canAdd = (id: string) => !submitting && stops.length < maxCourseStops && connected(map.links, stops.at(-1)!, id);
    const links = map.links.map(([from, to]) => {
      const a = points.get(from)!, b = points.get(to)!;
      const plotted = stops.slice(1).some((id, i) => id === from && stops[i] === to || id === to && stops[i] === from);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${plotted ? 'plotted' : 'connection'}"/>`;
    }).join('');
    content.innerHTML = `${picker()}<div class="map-layout">
      <section class="map-board"><div class="map-canvas" id="shared-map-scroll" tabindex="0" aria-label="Shared map. Scroll sideways to see the full map.">
        <svg id="sector" viewBox="0 0 900 500" role="group" aria-label="Shared stops and connections" class="${artUrl ? 'illustrated-map' : ''}">
          ${chartBackdrop(artUrl, failedArt)}${links}
          ${map.stops.map((point, i) => chartStop(point, {
            illustrated: Boolean(artUrl), failed: failedArt, selected: stops.includes(point.id),
            actionable: canAdd(point.id), elementId: 'shared-marker-' + i, current: point.id === map.start,
            label: canAdd(point.id) ? 'Add ' + point.name : point.name + (point.id === map.start ? ' · Starting stop' : ''),
          })).join('')}
          <circle cx="${origin.x}" cy="${origin.y}" r="32" class="ship-marker"/>
        </svg>
      </div><p class="map-legend">○ Starting stop · Gold outline: available next stop</p>
      ${loadingArt ? '<p class="help">Loading shared background…</p>' : ''}
      ${artworkFailed ? '<p class="help">The shared background could not be loaded.</p>' : ''}
      </section>
      <aside class="panel"><h2 id="shared-course-title" tabindex="-1">Propose a route</h2>
        <p id="shared-course" aria-live="polite">${stops.length === 1 ? 'Start at ' : ''}${escape(courseText(map, stops))}</p>
        <div class="destination-list" aria-label="Connected stops">${map.stops.map((stop, i) =>
          canAdd(stop.id) ? `<button id="shared-add-${i}" data-add="${escape(stop.id)}">Add ${escape(stop.name)}</button>` : '').join('')}</div>
        <div class="map-actions"><button id="shared-undo" ${stops.length < 2 || submitting ? 'disabled' : ''}>Undo last stop</button>
          <button id="shared-send" class="primary" ${stops.length < 2 || submitting ? 'disabled' : ''}>Send proposal</button></div>
        ${proposals.length ? `<h3>Your proposals</h3><ul>${proposals.map(proposal =>
          `<li>${escape(courseText(map, proposal.stops))} · ${escape(proposal.status)}</li>`).join('')}</ul>` : ''}
      </aside></div>`;
    bindPicker();
    bindChartArt(content, failedArt);
    content.querySelector('#map-background')?.addEventListener('error', () => {
      releaseArtwork();
      artworkFailed = true;
      render();
    });
    const board = content.querySelector<HTMLElement>('#shared-map-scroll')!;
    board.scrollLeft = draft.scroll;
    board.onscroll = () => { if (draft && board.isConnected) draft.scroll = board.scrollLeft; };
    const choose = (id: string) => {
      if (!draft || !canAdd(id)) return;
      draft.stops.push(id);
      draft.id = crypto.randomUUID();
      render();
    };
    content.querySelectorAll<HTMLElement | SVGElement>('[data-destination]:not([aria-disabled]), [data-add]').forEach(control => {
      const id = control.dataset.add ?? control.dataset.destination!;
      control.addEventListener('click', () => choose(id));
      if (control instanceof SVGElement) control.addEventListener('keydown', (event: Event) => {
        const key = (event as KeyboardEvent).key;
        if (key === 'Enter' || key === ' ') {
          event.preventDefault();
          choose(id);
        }
      });
    });
    content.querySelector('#shared-undo')?.addEventListener('click', () => {
      draft!.stops.pop();
      draft!.id = crypto.randomUUID();
      render();
    });
    content.querySelector('#shared-send')?.addEventListener('click', () => void submit(room, draft!));
    if (focus) {
      const target = document.getElementById(focus);
      const usable = target && !target.matches(':disabled,[aria-disabled="true"]');
      (usable ? target : content.querySelector<HTMLElement>('#shared-course-title'))?.focus({ preventScroll: true });
    }
  }

  function bindPicker() {
    content.querySelector<HTMLSelectElement>('#shared-room-picker')?.addEventListener('change', event => {
      const selection = (event.target as HTMLSelectElement).value;
      if (selection) location.hash = '#/map/room/' + selection;
    });
  }

  async function submit(room: JoinedRoom, attempted: Draft) {
    if (submitting) return;
    submitting = true;
    render();
    try {
      await roomRequest('/' + room.id + '/proposals', 'POST', {
        id: attempted.id, revision: attempted.revision, stops: attempted.stops,
      });
      if (draft === attempted) {
        draft.stops = [room.planner!.map.start];
        draft.id = crypto.randomUUID();
      }
      status.textContent = 'Proposal sent to the DM.';
    } catch (cause) {
      status.textContent = cause instanceof Error ? cause.message : 'The proposal could not be sent.';
    } finally {
      submitting = false;
      render();
      await refresh();
    }
  }

  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) void refresh();
  });
  window.addEventListener('online', () => void refresh());
  window.addEventListener('pagehide', event => {
    suspended = true;
    clearTimeout(timer);
    if (!event.persisted) {
      clearTimeout(expiry);
      artRequest++;
      releaseArtwork();
    }
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      suspended = false;
      void refresh();
    }
  });

  applyRooms(initial);
  schedule();
  if (!activeRoom()) void refresh();
}
