import { isSitesBuild, surfaceNavigation } from '../site-navigation';
import '../style.css';
import './home.css';

document.title = 'Galaxy Grown · Home';
document.querySelector<HTMLElement>('#app')!.innerHTML = `
<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a></header>
${surfaceNavigation('Home')}
<main class="home">
  <h1>Galaxy Grown</h1>
  <div class="home-actions">
    ${isSitesBuild ? `
    <a class="home-action home-action-primary" href="./#/rooms" aria-labelledby="home-rooms-title" aria-describedby="home-rooms-hint">
      <strong id="home-rooms-title">Join a Room</strong>
      <span id="home-rooms-hint">Enter the room code your DM shared.</span>
    </a>` : ''}
    <a class="home-action${isSitesBuild ? '' : ' home-action-primary'}" href="./#/games" aria-labelledby="home-games-title" aria-describedby="home-games-hint">
      <strong id="home-games-title">Browse Games</strong>
      <span id="home-games-hint">Find Flight Deck, Hillside Tanks, and upcoming casino games.</span>
    </a>
    <a class="home-action" href="./#/map" aria-labelledby="home-map-title" aria-describedby="home-map-hint">
      <strong id="home-map-title">Open Galaxy Map</strong>
      <span id="home-map-hint">View the galaxy and plot your next course.</span>
    </a>
  </div>
</main>`;
