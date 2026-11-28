import { flightSeat } from './rooms/flight';

export function siteRoute(hash: string, search: string, sites: boolean) {
  if (hash === '#/map' || (sites && hash.startsWith('#/map/room/'))) return 'map';
  if (hash === '#/games') return 'games';
  if (hash === '#/tanks') return 'tanks';
  if (sites && (hash === '#/shop' || hash.startsWith('#/shop/room/'))) return 'shop';
  if (sites && hash === '#/rooms') return 'rooms';
  if (hash === '#/flight') return 'flight';

  if (!hash) {
    const params = new URLSearchParams(search);
    if (params.has('situation') || (sites && flightSeat(params))) return 'flight';
  }

  return 'home';
}
