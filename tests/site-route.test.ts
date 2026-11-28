import assert from 'node:assert/strict';
import test from 'node:test';
import { siteRoute } from '../src/site-route';

const assignment = '?room=11111111-1111-1111-1111-111111111111&seat=22222222-2222-2222-2222-222222222222';

test('plain and campaign player links open the intended entry surface in both builds', () => {
  for (const sites of [false, true]) {
    assert.equal(siteRoute('', '', sites), 'home');
    assert.equal(siteRoute('', '?utm_source=campaign', sites), 'home');
    assert.equal(siteRoute('', '?situation=boarding-party', sites), 'flight');
    assert.equal(siteRoute('', assignment, sites), sites ? 'flight' : 'home');
    assert.equal(siteRoute('', '?room=invalid&seat=invalid', sites), 'home');
  }
});

test('explicit section links take precedence over old query parameters', () => {
  for (const sites of [false, true]) {
    assert.equal(siteRoute('#/flight', '', sites), 'flight');
    assert.equal(siteRoute('#/games', assignment, sites), 'games');
    assert.equal(siteRoute('#/games/casino-coolio', assignment, sites), 'casino-coolio');
    assert.equal(siteRoute('#/tanks', '?situation=space-battle', sites), 'tanks');
    assert.equal(siteRoute('#/map', '', sites), 'map');
    assert.equal(siteRoute('#/rooms', assignment, sites), sites ? 'rooms' : 'home');
    assert.equal(siteRoute('#/map/room/demo', '', sites), sites ? 'map' : 'home');
    assert.equal(siteRoute('#/shop/room/demo', '', sites), sites ? 'shop' : 'home');
  }
});
