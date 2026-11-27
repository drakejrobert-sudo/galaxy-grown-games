type Surface = 'Flight Deck' | 'Galaxy Map' | 'Tanks' | 'Rooms' | 'Shop';

export const isSitesBuild = import.meta.env?.MODE === 'sites';

export function surfaceNavigation(current: Surface): string {
  const links: [Surface, string][] = [['Flight Deck', './'], ['Galaxy Map', '#/map'], ['Tanks', '#/tanks']];
  if (isSitesBuild) links.push(['Rooms', '#/rooms'], ['Shop', '#/shop']);

  return `<nav class="surface-nav" aria-label="App sections">${links.map(([name, href]) =>
    `<a href="${href}"${name === current ? ' aria-current="page"' : ''}>${name}</a>`).join('')}</nav>`;
}
