import assert from 'node:assert/strict';
import test from 'node:test';
import { renderGameCatalog } from '../src/games/catalog';
import { surfaceNavigation } from '../src/site-navigation';

test('Games is the single navigation entry for games on both builds', () => {
  for (const sites of [false, true]) {
    assert.match(surfaceNavigation('Home', sites), /href="\.\/" aria-current="page">Home<\/a>/);
    const gamesNav = surfaceNavigation('Games', sites);
    assert.match(gamesNav, /href="\.\/#\/games" aria-current="page">Games<\/a>/);
    assert.match(gamesNav, />Galaxy Map<\/a>/);
    assert.doesNotMatch(gamesNav, />Flight Deck<\/a>|>Tanks<\/a>/);
    assert.equal(gamesNav.includes('>Rooms</a>'), sites);
    assert.equal(gamesNav.includes('>Shop</a>'), sites);

    for (const surface of ['Flight Deck', 'Tanks'] as const) {
      assert.match(surfaceNavigation(surface, sites), /aria-current="true">Games<\/a>/);
    }
  }
});

test('Games lists the three categories, with links only for playable titles', () => {
  const catalog = renderGameCatalog();
  assert.deepEqual([...catalog.matchAll(/<h2>([^<]+)<\/h2>/g)].map(match => match[1]), [
    'Ship Encounters', 'Tanks', 'Casino Games',
  ]);
  assert.deepEqual([...catalog.matchAll(/href="([^"]+)">([^<]+)<\/a>/g)].map(match => match.slice(1)), [
    ['./#/flight', 'Flight Deck'], ['./#/tanks', 'Hillside Tanks'],
  ]);
  assert.match(catalog, /Casino Corrupt<\/span><p>Coming soon<\/p>/);
  assert.match(catalog, /Casino Coolio<\/span><p>Coming soon<\/p>/);
});
