import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backgroundImageBytes, MAX_BACKGROUND_BYTES, normalizeBackground } from '../src/galaxy/background.ts';
import { activeMap, advance, demoCampaign, startJourney, type Archive } from '../src/galaxy/model.ts';
import { exportCampaign, importCampaigns, parseArchive, validateArchive, writeArchive } from '../src/galaxy/storage.ts';

// Small real raster fixtures, unrelated to private campaign artwork.
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const wrap=(c=demoCampaign()):Archive=>({version:2,selected:c.id,campaigns:[c]});

test('existing v2 maps without images retain schematic saves; images round-trip inside complete backups',()=>{
  const c=demoCampaign(), a=wrap(c);
  assert.deepEqual(validateArchive(a),a);
  activeMap(c).backgroundImage=png;
  assert.equal(backgroundImageBytes(png),68);
  const copy=parseArchive(exportCampaign(c));
  assert.equal(activeMap(copy.campaigns[0]).backgroundImage,png);
  const imported=importCampaigns(wrap(),copy);
  assert.equal(activeMap(imported.campaigns[1]).backgroundImage,png);
  delete activeMap(imported.campaigns[1]).backgroundImage;
  assert.equal(activeMap(copy.campaigns[0]).backgroundImage,png);
  assert.equal('backgroundImage' in activeMap(parseArchive(exportCampaign(imported.campaigns[1])).campaigns[0]),false);
});

test('raster-only embedded backgrounds reject URLs, SVG, malformed data, wrong MIME and excessive bytes',()=>{
  const oversized='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(MAX_BACKGROUND_BYTES)]).toString('base64');
  for(const image of ['https://example.com/image.png','file:///private/map.png','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,AAAA','data:image/png;base64,not-valid!',png.replace('image/png','image/jpeg'),png.slice(0,-1),oversized,{},null]){
    assert.equal(backgroundImageBytes(image),null);
    const a=wrap();(activeMap(a.campaigns[0]) as any).backgroundImage=image;
    assert.throws(()=>validateArchive(a),/Invalid background image/);
  }
});

test('invalid background save never writes over an existing campaign',()=>{
  const a=wrap();activeMap(a.campaigns[0]).backgroundImage='data:image/png;base64,AAAA';let bytes='previous save';
  assert.throws(()=>writeArchive({getItem:()=>bytes,setItem:(_k,v)=>{bytes=v;}},a));
  assert.equal(bytes,'previous save');
});

test('attaching/removing artwork preserves travel state, routes, locations and timing',()=>{
  const c=demoCampaign();startJourney(c,['haven','cinder']);advance(c,()=>.99);
  const before=structuredClone(activeMap(c));
  activeMap(c).backgroundImage=png;const restored=parseArchive(exportCampaign(c)).campaigns[0];
  delete activeMap(restored).backgroundImage;assert.deepEqual(activeMap(restored),before);
  advance(restored,()=>.99);assert.equal(activeMap(restored).journey!.arrived,true);
});

test('upload rejects unsupported, empty and over-limit files before attempting image decoding',async()=>{
  await assert.rejects(normalizeBackground(new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'})),/Choose a PNG/);
  await assert.rejects(normalizeBackground(new File([],'empty.png',{type:'image/png'})),/under 10 MB/);
  await assert.rejects(normalizeBackground(new File([new Uint8Array(10_000_001)],'huge.png',{type:'image/png'})),/under 10 MB/);
});
