// Separate entry surfaces keep map viewing independent of flight input and Phaser.
import { roomRequest } from './rooms/client';
import { roomIdPattern, type RoomList } from './rooms/types';

window.addEventListener('hashchange', () => window.location.reload());
const hash = window.location.hash;
const sites = import.meta.env.MODE === 'sites';

async function openMap() {
  if (sites) {
    const requestedRoom = hash.startsWith('#/map/room/') ? hash.slice('#/map/room/'.length) : undefined;
    if (requestedRoom && !roomIdPattern.test(requestedRoom)) {
      (await import('./galaxy/room-player-map')).showRoomMap([], requestedRoom);
      return;
    }
    document.querySelector('#app')!.textContent = 'Opening Galaxy Map…';
    const list = await roomRequest<RoomList>().catch(() => null);
    if (requestedRoom || (list && !list.canHost && list.joined.length)) {
      (await import('./galaxy/room-player-map')).showRoomMap(list?.joined ?? [], requestedRoom);
      return;
    }
    (await import('./galaxy/view')).showGalaxyMap(list);
    return;
  }
  (await import('./galaxy/view')).showGalaxyMap(null);
}

if (hash === '#/map' || (sites && hash.startsWith('#/map/room/'))) {
  openMap().catch(showLoadError);
} else if (hash === '#/games') {
  import('./games/view').catch(showLoadError);
} else if (hash === '#/tanks') {
  import('./tanks/view').catch(showLoadError);
} else if (sites && (hash === '#/shop' || hash.startsWith('#/shop/room/'))) {
  import('./shops/player').then(module => module.openShop(hash.slice('#/shop/room/'.length))).catch(showLoadError);
} else if (sites && hash === '#/rooms') {
  import('./rooms/view').catch(showLoadError);
} else {
  import('./main').catch(showLoadError);
}
function showLoadError(error: unknown) {
  console.error(error);
  document.querySelector('#app')!.textContent = 'The app could not load. Reload to try again.';
}
