import '../style.css';
import './rooms.css';
import { surfaceNavigation } from '../site-navigation';
import { roomRequest as api } from './client';
import { encounters, stations, type HostedRoom, type JoinedRoom, type RoomList, type Seat } from './types';

document.title = 'Galaxy Grown · Rooms';
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a></header>
${surfaceNavigation('Rooms')}
<main class="crew-rooms">
  <div class="room-heading"><h1>Rooms</h1><button type="button" id="refresh-rooms">Refresh rooms</button></div>
  <p id="room-status" role="status">Loading rooms…</p>
  <p id="room-error" role="alert"></p>
  <a id="room-sign-in" href="/signin-with-chatgpt?return_to=%2F%23%2Frooms" target="_top" hidden>DM sign in</a>
  <div class="room-grid" id="room-content" hidden>
    <section class="panel" id="host-rooms" aria-labelledby="host-heading" hidden>
      <div class="room-heading"><h2 id="host-heading">DM rooms</h2><button type="button" id="create-room">Create room</button></div>
      <div class="room-stack" id="hosted-rooms"></div>
    </section>
    <div class="room-stack" id="player-rooms">
      <form class="panel" id="join-room">
        <h2>Join a room</h2>
        <p class="room-help">Your seat stays with this browser while the room is open.</p>
        <label>Room code <input name="code" type="text" placeholder="8 characters" autocapitalize="characters" spellcheck="false" autocomplete="off" maxlength="8" required></label>
        <label>Display name <input name="name" type="text" maxlength="32" autocomplete="nickname" required></label>
        <button class="primary">Join room</button>
      </form>
      <section class="panel" id="joined-panel" aria-labelledby="joined-heading">
        <h2 id="joined-heading">Your seats</h2>
        <div class="room-stack" id="joined-rooms"></div>
      </section>
    </div>
  </div>
</main>`;

function byId<ElementType extends HTMLElement>(id: string): ElementType {
  return document.getElementById(id) as ElementType;
}

function element<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, text?: string): HTMLElementTagNameMap[Tag] {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  return item;
}

const status = byId('room-status');
const alert = byId('room-error');
const content = byId('room-content');
const signIn = byId('room-sign-in');
const hosted = byId('host-rooms');
const hostList = byId('hosted-rooms');
const playerList = byId('joined-rooms');
const seatPanel = byId('joined-panel');
const joinForm = byId<HTMLFormElement>('join-room');
const refresh = byId<HTMLButtonElement>('refresh-rooms');
const create = byId<HTMLButtonElement>('create-room');
let busy = false;

let roomsRequest: Promise<RoomList> | undefined;
let suspended = false;
let hasActiveRooms = false;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let refreshOnIdle = false;
let lastRooms = '';

function stopPolling() {
  clearTimeout(pollTimer);
  pollTimer = undefined;
}

function schedulePoll() {
  stopPolling();
  if (suspended || document.hidden || !hasActiveRooms) return;
  pollTimer = setTimeout(() => void refreshInBackground(), 5000);
}

async function refreshInBackground() {
  stopPolling();
  if (suspended || document.hidden) return;
  if (busy || roomsRequest) {
    refreshOnIdle = true;
    return;
  }
  try {
    await loadRooms();
    if (!busy) alert.textContent = '';
  } catch (cause) {
    if (!busy) alert.textContent = cause instanceof Error ? cause.message : 'Rooms could not be refreshed.';
  } finally {
    resumePolling();
  }
}

function resumePolling() {
  if (refreshOnIdle) {
    refreshOnIdle = false;
    void refreshInBackground();
  } else {
    schedulePoll();
  }
}

function expires(at: number): HTMLTimeElement {
  const date = new Date(at);
  const time = element('time', 'Expires ' + new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date));
  time.dateTime = date.toISOString();
  return time;
}

function roomTitle(id: string): string {
  return 'Room ' + id.slice(0, 8).toUpperCase();
}

function seatStatus(seat: Seat, situation: HostedRoom['situation']) {
  if (seat.report) return 'Finished';
  if (seat.startedAt !== null) return 'Playing';
  if (!seat.station) return 'Awaiting assignment';
  return situation ? 'Ready' : 'Awaiting encounter';
}

function joinedCard({ id, expiresAt, situation, seat }: JoinedRoom): HTMLElement {
  const card = element('article');
  const heading = element('h3', roomTitle(id));
  heading.id = 'joined-' + seat.id;
  heading.tabIndex = -1;
  const assignment = element('p', [situation, seat.station, seatStatus(seat, situation)].filter(Boolean).join(' · '));
  assignment.className = 'seat-assignment';
  card.append(heading, element('p', seat.name), assignment, expires(expiresAt));
  if (situation && seat.station) {
    const link = element('a', seat.report ? 'View submitted report'
      : seat.startedAt === null ? 'Play assigned station' : 'Reopen assigned station');
    link.className = 'room-flight-link';
    link.id = 'flight-' + seat.id;
    link.href = './?' + new URLSearchParams({ room: id, seat: seat.id }).toString();
    card.append(link);
  }
  card.className = 'room-card';
  return card;
}

function choiceForm(id: string, name: string, placeholder: string, options: readonly string[],
  current: string | null, buttonText: string, locked: boolean, onSave: (value: string) => Promise<string>): HTMLElement {
  if (locked) return element('p', name + ' · ' + current);
  const form = element('form');
  form.className = 'station-assignment';
  const label = element('label', name);
  label.htmlFor = id;
  const select = element('select');
  select.id = id;
  select.dataset.savedValue = current ?? '';
  select.add(new Option(placeholder, ''));
  for (const option of options) select.add(new Option(option, option));
  select.value = current ?? '';
  const save = element('button', buttonText);
  save.id = 'save-' + id;
  form.append(label, select, save);
  form.onsubmit = (event) => {
    event.preventDefault();
    const value = select.value;
    void run(async () => {
      const message = await onSave(value);
      select.dataset.savedValue = value;
      await loadRooms(save.id);
      return message;
    });
  };
  return form;
}

function hostCard(room: HostedRoom): HTMLElement {
  const card = element('article');
  card.className = 'room-card';
  const heading = element('h3', roomTitle(room.id));
  const code = element('input');
  code.type = 'text';
  code.id = 'code-' + room.id;
  code.value = room.code;
  code.readOnly = true;
  code.setAttribute('aria-label', 'Room code ' + room.code);
  const copy = element('button', 'Copy code');
  copy.id = 'copy-' + room.id;
  copy.type = 'button';
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      status.textContent = 'Room code copied.';
    } catch {
      code.focus();
      code.select();
      status.textContent = 'Room code selected. Copy it to share.';
    }
  };

  const header = element('div');
  header.className = 'room-code';
  header.append(code, copy);
  card.append(heading, header, expires(room.expiresAt));
  card.append(choiceForm('encounter-' + room.id, 'Encounter', 'Choose an encounter', encounters,
    room.situation, 'Save encounter', room.seats.some((seat) => seat.startedAt !== null), async (situation) => {
      await api('/' + room.id + '/encounter', 'PUT', { situation });
      return 'Encounter saved.';
    }));
  if (!room.seats.length) card.append(element('p', 'Waiting for players to join.'));
  for (const seat of room.seats) {
    const row = element('section');
    row.className = 'room-seat';
    const path = `/${room.id}/seats/${seat.id}`;
    row.append(
      choiceForm('seat-' + seat.id, seat.name, 'Awaiting assignment', stations, seat.station, 'Save station',
        seat.startedAt !== null, async (station) => {
          await api(path, 'PUT', { station: station || null });
          return 'Station saved.';
        }),
      element('p', seatStatus(seat, room.situation)),
    );
    if (seat.report) {
      const details = element('details');
      details.id = 'report-' + seat.id;
      const summary = element('summary', `Score report · ${seat.report.rating}/100`);
      summary.id = 'summary-' + seat.id;
      details.append(summary, element('pre', seat.report.text));
      row.append(details);
    }
    card.append(row);
  }

  const close = element('button', 'Close room');
  close.type = 'button';
  close.id = 'close-' + room.id;
  close.className = 'close-room';
  close.onclick = () => {
    if (!window.confirm('Close ' + roomTitle(room.id) + '? Players will lose access to their seats.')) return;
    void run(async () => {
      await api('/' + room.id + '/close', 'POST');
      await loadRooms();
      return 'Room closed.';
    }, create);
  };
  card.append(close);
  return card;
}

async function loadRooms(focusId?: string): Promise<void> {
  roomsRequest = api<RoomList>();
  let rooms: RoomList;
  try {
    rooms = await roomsRequest;
  } finally {
    roomsRequest = undefined;
  }
  hasActiveRooms = Boolean(rooms.joined.length || rooms.hosted.length);
  const snapshot = JSON.stringify(rooms);
  if (snapshot === lastRooms) {
    if (focusId) document.getElementById(focusId)?.focus();
    return;
  }
  lastRooms = snapshot;
  const active = document.activeElement;
  const previousFocus = active && (hostList.contains(active) || playerList.contains(active)) ? active.id : '';
  const drafts = Array.from(hostList.querySelectorAll<HTMLSelectElement>('select'))
    .filter((select) => select.value !== select.dataset.savedValue)
    .map(({ id, value }) => ({ id, value }));
  const openReports = Array.from(hostList.querySelectorAll<HTMLDetailsElement>('details[open]'), ({ id }) => id);

  playerList.replaceChildren(...rooms.joined.map(joinedCard));
  if (rooms.joined.length) {
    if (seatPanel.previousElementSibling) joinForm.before(seatPanel);
  } else {
    playerList.append(element('p', 'You have no active seats.'));
    if (seatPanel.nextElementSibling) joinForm.after(seatPanel);
  }
  hostList.replaceChildren(...rooms.hosted.map(hostCard));
  if (!rooms.hosted.length) hostList.append(element('p', 'You have no active rooms.'));
  hosted.hidden = !rooms.canHost;
  signIn.hidden = rooms.canHost;
  content.hidden = false;
  for (const { id, value } of drafts) {
    const select = byId<HTMLSelectElement>(id);
    if (select) select.value = value;
  }
  for (const id of openReports) {
    const details = byId<HTMLDetailsElement>(id);
    if (details) details.open = true;
  }
  if (focusId || previousFocus) (document.getElementById(focusId || previousFocus) ?? refresh).focus();
}

async function run(action: () => Promise<string>, fallbackFocus?: HTMLElement): Promise<void> {
  if (busy) return;
  stopPolling();
  busy = true;
  content.setAttribute('aria-busy', 'true');
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.crew-rooms button'));
  for (const button of buttons) button.disabled = true;
  alert.textContent = '';
  status.textContent = 'Working…';
  try {
    if (roomsRequest) {
      try { await roomsRequest; } catch { /* A user action can recover a failed refresh. */ }
    }
    status.textContent = await action();
  } catch (cause) {
    status.textContent = '';
    alert.textContent = cause instanceof Error ? cause.message : 'Something went wrong. Try again.';
  } finally {
    for (const button of buttons) button.disabled = false;
    if (fallbackFocus && document.activeElement === document.body) fallbackFocus.focus();
    content.removeAttribute('aria-busy');
    busy = false;
    resumePolling();
  }
}

refresh.onclick = () => void run(async () => {
  await loadRooms();
  return 'Rooms refreshed.';
}, refresh);

create.onclick = () => void run(async () => {
  const room = await api<HostedRoom>('', 'POST');
  await loadRooms('copy-' + room.id);
  return 'Room created.';
}, create);

joinForm.onsubmit = (event) => {
  event.preventDefault();
  const form = new FormData(joinForm);
  void run(async () => {
    const room = await api<JoinedRoom>('/join', 'POST', { code: form.get('code'), name: form.get('name') });
    await loadRooms('joined-' + room.seat.id);
    joinForm.reset();
    return 'You have a seat.';
  });
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPolling();
  else void refreshInBackground();
});
window.addEventListener('online', () => void refreshInBackground());
window.addEventListener('pagehide', () => {
  suspended = true;
  stopPolling();
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  suspended = false;
  void refreshInBackground();
});

void run(async () => {
  await loadRooms();
  return '';
});
