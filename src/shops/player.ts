import '../style.css';
import { surfaceNavigation } from '../site-navigation';
import { roomRequest } from '../rooms/client';
import type { JoinedRoom, RoomList } from '../rooms/types';
import { storefront } from './view';

export function openShop(preferredRoom: string) {
  document.title = 'Galaxy Grown · Shop';
  const root = document.querySelector<HTMLElement>('#app')!;
  root.innerHTML = `
    <header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a></header>
    ${surfaceNavigation('Shop')}
    <main class="player-shop"><h1>Shop</h1>
      <label hidden>Room shop<select></select></label>
      <p role="status">Checking for open shops…</p>
      <button type="button" hidden>Retry</button>
      <div class="shop-display"></div>
    </main>`;
  const label = root.querySelector('label')!;
  const select = root.querySelector('select')!;
  const status = root.querySelector<HTMLElement>('[role=status]')!;
  const retry = root.querySelector('button')!;
  const display = root.querySelector('.shop-display')!;
  let joined: JoinedRoom[] = [];
  let selected = preferredRoom;
  let previous = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  let suspended = false;

  function render() {
    const open = joined.filter(room => room.shop);
    const current = open.find(room => room.id === selected) ?? open[0];
    if (current) selected = current.id;
    label.hidden = open.length < 2;
    select.replaceChildren(...open.map(room => new Option(room.shop!.name + ' · Room ' + room.id.slice(0, 8).toUpperCase(), room.id)));
    select.value = selected;
    if (current?.shop) display.replaceChildren(storefront(current.shop));
    else {
      display.innerHTML = '<section class="shop-shutters"><h2>The shoppe is currently closed!</h2></section>';
      if (!joined.length) {
        const link = document.createElement('a');
        link.href = '#/rooms';
        link.textContent = 'Join a Room';
        display.append(link);
      }
    }
  }

  async function refresh() {
    clearTimeout(timer);
    if (pending || suspended || document.hidden) return;
    pending = true;
    try {
      const rooms = await roomRequest<RoomList>();
      joined = rooms.joined;
      const snapshot = JSON.stringify(joined);
      if (snapshot !== previous) render();
      previous = snapshot;
      status.textContent = '';
      retry.hidden = true;
    } catch {
      previous = '';
      display.replaceChildren();
      label.hidden = true;
      status.textContent = 'Could not reach Rooms to check the shop.';
      retry.hidden = false;
    } finally {
      pending = false;
      if (joined.length && !document.hidden && !suspended) timer = setTimeout(refresh, 5000);
    }
  }
  select.onchange = () => { selected = select.value; render(); };
  retry.onclick = refresh;
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else void refresh(); });
  window.addEventListener('online', refresh);
  window.addEventListener('pagehide', () => { suspended = true; clearTimeout(timer); });
  window.addEventListener('pageshow', () => { suspended = false; void refresh(); });
  void refresh();
}
