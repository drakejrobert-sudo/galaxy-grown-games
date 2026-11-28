import { surfaceNavigation } from '../site-navigation';
import { renderGameCatalog } from './catalog';
import '../style.css';
import './games.css';

document.title = 'Galaxy Grown · Games';
document.querySelector<HTMLElement>('#app')!.innerHTML = `
<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a></header>
${surfaceNavigation('Games')}
<main class="games-directory">
  <h1>Games</h1>
  <div class="game-categories">${renderGameCatalog()}</div>
</main>`;
