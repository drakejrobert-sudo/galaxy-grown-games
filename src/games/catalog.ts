type Game = {
  title: string;
} & ({ href: string; description: string } | { href?: never });

type GameCategory = {
  title: string;
  games: readonly Game[];
};

export const gameCatalog: readonly GameCategory[] = [
  {
    title: 'Ship Encounters',
    games: [{
      title: 'Flight Deck',
      href: './#/flight',
      description: 'Take a crew station and play a solo challenge. Share your score with the GM.',
    }],
  },
  {
    title: 'Tanks',
    games: [{
      title: 'Hillside Tanks',
      href: './#/tanks',
      description: 'Play a turn-based tank match for 2–8 players on a screen shared by the GM.',
    }],
  },
  {
    title: 'Casino Games',
    games: [
      {
        title: 'Casino Corrupt — Blackjack',
        href: './#/games/casino-corrupt-blackjack',
        description: 'Play blackjack with campaign gold and share your settlement with the GM.',
      },
      {
        title: 'Casino Coolio',
        href: './#/games/casino-coolio',
        description: 'Spin the frozen reels with campaign gold and share your result with the GM.',
      },
    ],
  },
];

export function renderGameCatalog(): string {
  return gameCatalog.map(category => `
    <section class="panel">
      <h2>${category.title}</h2>
      <ul>${category.games.map(game => game.href === undefined
        ? `<li><span class="game-title">${game.title}</span><p>Coming soon</p></li>`
        : `<li><a class="game-title" href="${game.href}">${game.title}</a><p>${game.description}</p></li>`
      ).join('')}</ul>
    </section>`).join('');
}
