type Surface = 'Home' | 'Games' | 'Flight Deck' | 'Galaxy Map' | 'Tanks' | 'Rooms' | 'Shop';

export const isSitesBuild = import.meta.env?.MODE === 'sites';

export function surfaceNavigation(current: Surface, sites = isSitesBuild): string {
  const links: [Surface, string][] = [['Home', './'], ['Games', './#/games'], ['Galaxy Map', '#/map']];
  if (sites) links.push(['Rooms', '#/rooms'], ['Shop', '#/shop']);

  const inGame = current === 'Flight Deck' || current === 'Tanks';

  return `<nav class="surface-nav" aria-label="App sections">${links.map(([name, href]) =>
    `<a href="${href}"${name === current ? ' aria-current="page"' : name === 'Games' && inGame ? ' aria-current="true"' : ''}>${name}</a>`).join('')}</nav>`;
}
