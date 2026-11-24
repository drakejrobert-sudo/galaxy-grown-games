import '../style.css';
import './rooms.css';
import { surfaceNavigation } from '../site-navigation';
import { stations, type HostedRoom, type JoinedRoom, type RoomList } from './types';

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

async function api<Result>(path = '', method = 'GET', body?: object): Promise<Result> {
  const response = await fetch('/api/rooms' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as Result;
  if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('Rooms could not be loaded. Try again.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
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

function joinedCard({ id, expiresAt, seat }: JoinedRoom): HTMLElement {
  const card = element('article');
  const heading = element('h3', roomTitle(id));
  heading.id = 'joined-' + id;
  heading.tabIndex = -1;
  const assignment = element('p', seat.station ?? 'Awaiting assignment');
  assignment.className = 'seat-assignment';
  card.append(heading, element('p', seat.name), assignment, expires(expiresAt));
  card.className = 'room-card';
  return card;
}

function hostCard(room: HostedRoom): HTMLElement {
  const card = element('article');
  card.className = 'room-card';
  const heading = element('h3', roomTitle(room.id));
  const code = element('input');
  code.type = 'text';
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
  if (!room.seats.length) card.append(element('p', 'Waiting for players to join.'));
  for (const seat of room.seats) {
    const form = element('form');
    form.className = 'station-assignment';
    const label = element('label', seat.name);
    const station = element('select');
    station.setAttribute('aria-label', 'Station for ' + seat.name);
    station.add(new Option('Awaiting assignment', ''));
    for (const name of stations) station.add(new Option(name, name));
    station.value = seat.station ?? '';
    station.id = 'seat-' + seat.id;
    label.htmlFor = station.id;
    const save = element('button', 'Save station');
    save.id = 'save-' + seat.id;
    form.append(label, station, save);
    form.onsubmit = (event) => {
      event.preventDefault();
      void run(async () => {
        await api(`/${room.id}/seats/${seat.id}`, 'PUT', { station: station.value || null });
        await loadRooms(save.id);
        return 'Station saved.';
      });
    };
    card.append(form);
  }

  const close = element('button', 'Close room');
  close.type = 'button';
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
  const rooms = await api<RoomList>();
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
  if (focusId) document.getElementById(focusId)?.focus();
}

async function run(action: () => Promise<string>, fallbackFocus?: HTMLElement): Promise<void> {
  if (busy) return;
  busy = true;
  content.setAttribute('aria-busy', 'true');
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.crew-rooms button'));
  for (const button of buttons) button.disabled = true;
  alert.textContent = '';
  status.textContent = 'Working…';
  try {
    status.textContent = await action();
  } catch (cause) {
    status.textContent = '';
    alert.textContent = cause instanceof Error ? cause.message : 'Something went wrong. Try again.';
  } finally {
    for (const button of buttons) button.disabled = false;
    if (fallbackFocus && document.activeElement === document.body) fallbackFocus.focus();
    content.removeAttribute('aria-busy');
    busy = false;
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
    await loadRooms('joined-' + room.id);
    joinForm.reset();
    return 'You have a seat.';
  });
};

void run(async () => {
  await loadRooms();
  return '';
});
