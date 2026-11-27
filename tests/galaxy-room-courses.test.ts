import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeMap, blankMap, demoCampaign, startJourney, type Archive } from '../src/galaxy/model';
import { copyPreset, installPreset, loadPreset } from '../src/galaxy/preset';
import { openRoomCourse, roomCourse } from '../src/galaxy/room-course';
import { shareSchematic } from '../src/galaxy/room-sharing';
import { exportCampaign } from '../src/galaxy/storage';

test('proposal previews select the source map and stay editable without changing travel', () => {
  const campaign = demoCampaign();
  const map = activeMap(campaign);
  const source = { campaignId: campaign.id, mapId: map.id };
  const link = map.routes[0];
  const stops = [link.from, link.to];
  const schematic = shareSchematic(map, link.from, stops, [link.id]);
  const preview = { source, map: { ...schematic, revision: crypto.randomUUID() }, stops };
  const otherMap = blankMap('Another chart');
  campaign.maps.push(otherMap);
  campaign.activeMap = otherMap.id;
  const other = demoCampaign();
  const archive: Archive = { version: 2, selected: other.id, campaigns: [campaign, other] };
  const plotted = openRoomCourse(archive, preview);
  plotted.pop();
  assert.deepEqual(preview.stops, stops);
  assert.equal(archive.selected, campaign.id);
  assert.equal(campaign.activeMap, map.id);
  assert.equal(map.location, null);
  assert.equal(map.journey, null);
  assert.deepEqual(map.log, []);
  map.destinations.find(stop => stop.id === link.to)!.x += 1;
  assert.throws(() => roomCourse(archive, preview), /map has changed/);
  map.location = link.to;
  assert.throws(() => roomCourse(archive, preview), /current destination/);
  startJourney(campaign, [...stops].reverse());
  assert.throws(() => roomCourse(archive, preview), /End the current journey/);
});

test('sharing projects only requested navigable stops and explicit connections', () => {
  const campaign = demoCampaign();
  const map = activeMap(campaign);
  const [first, second] = map.routes;
  const stops = [first.from, first.to, second.from, second.to];
  map.description = 'Hidden description';
  map.destinations[0].description = 'Hidden location detail';
  const shared = shareSchematic(map, first.from, stops, [first.id]);
  assert.deepEqual(shared.links, [[first.from, first.to]]);
  assert.equal(shared.stops.length, new Set(stops).size);
  assert.doesNotMatch(JSON.stringify(shared), /Hidden|description|table|risk|backgroundImage/);
  assert.throws(() => shareSchematic(map, first.from, stops, []), /connected stop/);
});

test('private presets preserve artwork and linked maps while party copies have independent journeys', () => {
  const campaign = demoCampaign();
  const map = activeMap(campaign);
  const detail = blankMap('Detail');
  campaign.maps.push(detail);
  map.destinations[0].detailMapId = detail.id;
  map.backgroundImage = 'data:image/png;base64,iVBORw0KGgo=';
  const route = map.routes[0];
  startJourney(campaign, [route.from, route.to]);
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } };
  installPreset(storage, exportCampaign(campaign));
  assert.throws(() => installPreset(storage, '{}'));
  const preset = loadPreset(storage)!;
  const first = copyPreset(preset, 'First crew');
  const second = copyPreset(preset, 'Second crew');
  assert.notEqual(first.id, second.id);
  assert.equal(activeMap(first).backgroundImage, map.backgroundImage);
  assert.equal(activeMap(first).destinations[0].detailMapId, detail.id);
  startJourney(first, [route.from, route.to]);
  activeMap(first).destinations[0].name = 'Edited';
  assert.equal(activeMap(second).journey, null);
  assert.equal(activeMap(second).destinations[0].name, map.destinations[0].name);
  assert.equal(activeMap(loadPreset(storage)!).destinations[0].name, map.destinations[0].name);
});
