import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeMap, advance, blankMap, deleteMap, demoCampaign, endJourney, insertEncounter, libraryLocked, resolveEncounter, scheduleEncounter, startJourney, switchMap, type Archive } from '../src/galaxy/model.ts';
import { exportCampaign, importCampaigns, parseArchive, readArchive, STORAGE_KEY, validateArchive, writeArchive } from '../src/galaxy/storage.ts';

function linked() {
  const c = demoCampaign();
  const detail = structuredClone(activeMap(c));
  detail.id = 'detail'; detail.name = 'Inner sector';
  c.maps.push(detail);
  activeMap(c).destinations[0].detailMapId = detail.id;
  return c;
}
const wrap = (c = linked()): Archive => ({ version: 2, selected: c.id, campaigns: [c] });
function legacy(c = demoCampaign()) {
  const m = activeMap(c);
  const { id: _id, name: _name, description: _description, decoration: _decoration, ...state } = m;
  return { version: 1, selected: c.id, campaigns: [{ id: c.id, name: c.name, encounters: c.encounters, tables: c.tables, ...state }] };
}

test('v1 migration preserves paused journey, library, schedules and log without modifying source bytes', () => {
  const c = demoCampaign();
  startJourney(c, ['haven','cinder']); scheduleEncounter(c,0,1,'rocks'); advance(c,()=>.99);
  const raw = JSON.stringify(legacy(c));
  let stored = raw;
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
  const migrated = readArchive(storage)!;
  assert.equal(stored,raw);
  assert.equal(migrated.version,2);
  assert.equal(migrated.campaigns[0].maps.length,1);
  for (const key of ['destinations','routes','journey','location','schedules','log'] as const) assert.deepEqual(activeMap(migrated.campaigns[0])[key],activeMap(c)[key]);
  assert.deepEqual(migrated.campaigns[0].encounters,c.encounters);
  assert.deepEqual(migrated.campaigns[0].tables,c.tables);
  writeArchive(storage,migrated);
  assert.equal(JSON.parse(stored).version,2);
  assert.deepEqual(parseArchive(exportCampaign(migrated.campaigns[0])),migrated);
});

test('v1 empty and completed campaigns migrate; malformed legacy saves fail without rewriting storage', () => {
  const c = demoCampaign(); startJourney(c,['haven','cinder']); advance(c,()=>.99); advance(c,()=>.99);
  assert.equal(activeMap(validateArchive(legacy(c)).campaigns[0]).journey!.arrived,true);
  const malformed = legacy(c); malformed.campaigns[0].routes[0].to = 'missing';
  let writes = 0;
  assert.throws(()=>readArchive({getItem:()=>JSON.stringify(malformed),setItem:()=>{writes++;}}));
  assert.equal(writes,0);
  const blank = demoCampaign(); activeMap(blank).destinations=[];activeMap(blank).routes=[];
  assert.equal(activeMap(validateArchive(legacy(blank)).campaigns[0]).location,null);
});

test('browsing away from a paused encounter preserves travel and all per-map progress', () => {
  const c = linked(), overview = activeMap(c);
  startJourney(c,['haven','cinder']);scheduleEncounter(c,0,1,'rocks');advance(c,()=>.99);
  const snapshot = structuredClone(overview);
  switchMap(c,'detail');
  assert.deepEqual(overview,snapshot); assert.equal(activeMap(c).journey,null); assert.equal(libraryLocked(c),true);
  startJourney(c,['cinder','echo']); insertEncounter(c,'boarding');
  const detailSnapshot = structuredClone(activeMap(c));
  switchMap(c,overview.id); assert.deepEqual(activeMap(c),snapshot);
  resolveEncounter(c,''); advance(c,()=>.99); assert.equal(activeMap(c).journey!.arrived,true);
  assert.deepEqual(c.maps[1],detailSnapshot);
  switchMap(c,'detail'); resolveEncounter(c,''); endJourney(c); assert.equal(libraryLocked(c),false);
  assert.throws(()=>switchMap(c,'missing'));
});

test('reference markers are inspectable but cannot be stops, route endpoints or party locations', () => {
  const c = linked(), m = activeMap(c);
  m.destinations[0].navigable=false;m.destinations[0].type='star';
  assert.throws(()=>startJourney(c,['haven','cinder']));
  assert.throws(()=>validateArchive(wrap(c)),/Invalid route/);
  m.routes=m.routes.filter(r=>r.from!=='haven'&&r.to!=='haven');
  validateArchive(wrap(c));
  m.location='haven';assert.throws(()=>validateArchive(wrap(c)),/current destination/);
});

test('invalid map links, active selection, duplicate maps and non-boolean flags are rejected', () => {
  for(const mutate of [
    (a:Archive)=>a.campaigns[0].activeMap='missing',
    (a:Archive)=>a.campaigns[0].maps.push(a.campaigns[0].maps[0]),
    (a:Archive)=>a.campaigns[0].maps[0].destinations[0].detailMapId='missing',
    (a:Archive)=>a.campaigns[0].maps[0].destinations[0].detailMapId=a.campaigns[0].maps[0].id,
    (a:Archive)=>(a.campaigns[0].maps[0].destinations[0] as any).navigable='false',
    (a:Archive)=>(a.campaigns[0].maps[0].routes[0] as any).provisional='true',
  ]) {const a=wrap();mutate(a);assert.throws(()=>validateArchive(a));}
});

test('map deletion guards links, active journeys and the final map', () => {
  const c = linked(), root=activeMap(c);
  assert.throws(()=>deleteMap(c,'detail'),/links/);
  delete root.destinations[0].detailMapId;
  switchMap(c,'detail');startJourney(c,['haven','cinder']);
  assert.throws(()=>deleteMap(c,'detail'),/journey/);
  endJourney(c); deleteMap(c,'detail');assert.equal(c.activeMap,root.id);
  assert.throws(()=>deleteMap(c,root.id),/at least one/);
});

test('whole-campaign exports and repeated imports retain links and active view with independent copies', () => {
  const c=linked();switchMap(c,'detail');startJourney(c,['haven','cinder']);insertEncounter(c,'rocks');
  const a=wrap(c), raw=exportCampaign(c), incoming=parseArchive(raw);
  const imported=importCampaigns(a,incoming), twice=importCampaigns(imported,incoming);
  assert.equal(a.campaigns.length,1);assert.equal(incoming.campaigns[0].id,c.id);
  assert.equal(twice.campaigns.length,3);assert.equal(new Set(twice.campaigns.map(x=>x.id)).size,3);
  assert.equal(twice.campaigns[2].activeMap,'detail');
  assert.equal(twice.campaigns[2].maps[0].destinations[0].detailMapId,'detail');
  resolveEncounter(twice.campaigns[2],'only this copy');assert.equal(activeMap(twice.campaigns[0]).journey!.active,'rocks');
  assert.equal(activeMap(twice.campaigns[1]).journey!.active,'rocks');
  assert.deepEqual(parseArchive(raw),a);
});

test('shared encounter references are validated even on inactive maps', () => {
  const c=linked();switchMap(c,'detail');startJourney(c,['haven','cinder']);insertEncounter(c,'rocks');
  switchMap(c,c.maps[0].id); c.encounters=c.encounters.filter(e=>e.id!=='rocks');
  c.tables=[];
  assert.throws(()=>validateArchive(wrap(c)),/journey progress/);
});

test('new maps begin without locations and remain independent after saving active selection', () => {
  const c=linked(), empty=blankMap('Uncharted');c.maps.push(empty);switchMap(c,empty.id);
  let bytes='';writeArchive({getItem:()=>null,setItem:(key,value)=>{assert.equal(key,STORAGE_KEY);bytes=value;}},wrap(c));
  const restored=parseArchive(bytes).campaigns[0];assert.equal(restored.activeMap,empty.id);assert.equal(activeMap(restored).location,null);
  activeMap(restored).description='Independent copy';assert.equal(empty.description,'');
});
