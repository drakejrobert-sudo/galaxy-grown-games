// Separate entry surfaces keep map viewing independent of flight input and Phaser.
import { siteRoute } from './site-route';
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

switch (siteRoute(hash, window.location.search, sites)) {
  case 'map':
    openMap().catch(showLoadError);
    break;
  case 'games':
    import('./games/view').catch(showLoadError);
    break;
  case 'casino-coolio':
    import('./slots/view').catch(showLoadError);
    break;
  case 'tanks':
    import('./tanks/view').catch(showLoadError);
    break;
  case 'shop':
    import('./shops/player').then(module => module.openShop(hash.slice('#/shop/room/'.length))).catch(showLoadError);
    break;
  case 'rooms':
    import('./rooms/view').catch(showLoadError);
    break;
  case 'flight':
    import('./main').catch(showLoadError);
    break;
  case 'home':
    import('./home/view').catch(showLoadError);
    break;
}
function showLoadError(error: unknown) {
  console.error(error);
  document.querySelector('#app')!.textContent = 'The app could not load. Reload to try again.';
}
