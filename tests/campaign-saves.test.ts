import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignApi } from '../src/campaigns/api.ts';
import { campaignEnvironment } from './fixtures/campaign-database.ts';
import { demoCampaign, activeMap, startJourney, advance } from '../src/galaxy/model.ts';
import { exportCampaign, importCampaigns, parseArchive } from '../src/galaxy/storage.ts';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const origin = 'https://fictional.invalid';
function setup() {
  const h = campaignEnvironment();
  const call = async (path = '', method = 'GET', body?: unknown, user = 'fictional-dm-a', now = 1_000_000, requestOrigin = origin) => campaignApi(new Request(origin + '/api/campaigns' + path, {
    method, headers: { ...(user ? {'oai-authenticated-user-id':user} : {}), Origin: requestOrigin, 'Content-Type':'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), h.env, now);
  const account = async (user = 'fictional-dm-a') => (await (await call('', 'GET', undefined, user)).json()).account as string;
  const payload = async (name = 'Fictional sector') => {
    const c = demoCampaign(name); activeMap(c).backgroundImage = png;
    return { id: crypto.randomUUID(), operationId: crypto.randomUUID(), revision: 0, account: await account(), archive: parseArchive(exportCampaign(c)) };
  };
  return { ...h, call, account, payload };
}

test('private save reconstructs artwork, paused travel, linked maps and portable independent imports', async () => {
  const h = setup(), p = await h.payload();
  const c = p.archive.campaigns[0]; startJourney(c, ['haven','cinder']); advance(c,()=>0);
  const response = await h.call('', 'POST', p); assert.equal(response.status, 201);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const result = await (await h.call('/'+p.id)).json();
  assert.deepEqual(result.archive, p.archive);
  assert.equal(h.objects.size, 1);
  const chunks = h.database.prepare('SELECT content FROM campaign_chunks').all() as {content:string}[];
  assert.ok(chunks.every(row=>!row.content.includes('data:image/')));
  const local = parseArchive(exportCampaign(demoCampaign('Existing local')));
  const imported = importCampaigns(local, result.archive);
  assert.equal(imported.campaigns.length, 2); assert.notEqual(imported.selected, c.id);
  assert.deepEqual(imported.campaigns[1].maps, c.maps);
  assert.deepEqual(parseArchive(JSON.stringify(result.archive)), result.archive);
});

test('anonymous, cross-account, cross-origin and arbitrary artwork paths cannot access private content', async () => {
  const h=setup(), p=await h.payload(); await h.call('', 'POST', p);
  assert.equal((await h.call('', 'GET', undefined, '')).status,401);
  for (const method of ['GET','PUT','DELETE']) assert.equal((await h.call('/'+p.id, method, method==='GET'?undefined:p, 'fictional-dm-b')).status,404);
  assert.deepEqual((await (await h.call('', 'GET', undefined,'fictional-dm-b')).json()).saves,[]);
  assert.equal((await h.call('', 'POST',p,'fictional-dm-a',1_000_000,'https://other.invalid')).status,403);
  assert.equal((await h.call('', 'POST',p,'fictional-dm-b')).status,409);
  assert.equal((await h.call('/'+p.id+'/art/some-key')).status,404);
  assert.equal((await h.call('/'+p.id+'/export', 'GET',undefined,'fictional-dm-b')).status,404);
});

test('lost responses retry once; stale and concurrent updates never overwrite the winner', async () => {
  const h=setup(), p=await h.payload(); await h.call('', 'POST',p);
  assert.equal((await h.call('', 'POST',p)).status,200);
  const update={...p, revision:1,operationId:crypto.randomUUID()}; update.archive=structuredClone(p.archive);update.archive.campaigns[0].name='Device one';
  const other={...update,operationId:crypto.randomUUID(),archive:structuredClone(update.archive)};other.archive.campaigns[0].name='Device two';
  const results=await Promise.all([h.call('/'+p.id,'PUT',update),h.call('/'+p.id,'PUT',other)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await (await h.call('/'+p.id)).json()).save.revision,2);
  assert.equal(h.database.prepare('SELECT count(*) AS n FROM campaign_saves').get()!.n,1);
  const changed={...p,archive:structuredClone(p.archive)}; changed.archive.campaigns[0].name='Changed retry';
  assert.equal((await h.call('','POST',changed)).status,409);
});

test('interrupted art upload and database publication retain the complete previous revision', async () => {
  const h=setup(),p=await h.payload();await h.call('','POST',p);
  const update={...p,revision:1,operationId:crypto.randomUUID(),archive:structuredClone(p.archive)};update.archive.campaigns[0].name='Interrupted';
  const original=h.env.BUCKET.put;h.env.BUCKET.put=async()=>{throw Error('offline');};
  assert.equal((await h.call('/'+p.id,'PUT',update)).status,503);
  assert.deepEqual((await (await h.call('/'+p.id)).json()).archive,p.archive);
  h.env.BUCKET.put=original;
  const batch=h.env.DB.batch;let calls=0;h.env.DB.batch=async statements=>{ if(++calls===2)throw Error('database unavailable');return batch(statements);};
  assert.equal((await h.call('/'+p.id,'PUT',update)).status,503);
  assert.deepEqual((await (await h.call('/'+p.id)).json()).archive,p.archive);
  h.env.DB.batch=batch;
  assert.equal((await h.call('/'+p.id,'PUT',update)).status,200);
  assert.equal((await (await h.call('/'+p.id)).json()).save.revision,2);
});

test('missing and corrupt art fail complete restore without a partial archive', async()=>{
  const h=setup(),p=await h.payload(); await h.call('','POST',p);
  const [key,bytes]=[...h.objects][0];h.objects.delete(key);
  assert.equal((await h.call('/'+p.id)).status,503);
  assert.equal((await h.call('/'+p.id+'/export')).status,503);
  h.objects.set(key,new Uint8Array([1,2,3]));assert.equal((await h.call('/'+p.id)).status,503);
  h.objects.set(key,bytes);assert.equal((await h.call('/'+p.id)).status,200);
});

test('deletion is revision guarded and expired staging is reclaimed without touching another owner',async()=>{
  const h=setup(),p=await h.payload();await h.call('','POST',p);
  const del={revision:0,account:p.account};assert.equal((await h.call('/'+p.id,'DELETE',del)).status,409);
  del.revision=1;assert.equal((await h.call('/'+p.id,'DELETE',del)).status,200);
  assert.equal((await h.call('/'+p.id)).status,404);
  assert.equal((await h.call('','POST',p)).status,404);
  const q=await h.payload();q.account=await h.account('fictional-dm-b');await h.call('','POST',q,'fictional-dm-b');
  const next=await h.payload(); await h.call('','POST',next,'fictional-dm-a',1_000_000+86_400_001);
  assert.equal(h.database.prepare('SELECT count(*) AS n FROM campaign_operations WHERE id=?').get(p.operationId)!.n,0);
  assert.deepEqual((await (await h.call('/'+q.id,'GET',undefined,'fictional-dm-b')).json()).archive,q.archive);
});

test('validation, quotas and UTF-8 chunks preserve existing local and cloud archives',async()=>{
  const h=setup(),p=await h.payload();
  const bad=structuredClone(p);bad.archive.campaigns[0].maps[0].backgroundImage='https://private.invalid/file';
  assert.equal((await h.call('','POST',bad)).status,400);
  const large=structuredClone(p);large.archive.campaigns[0].maps[0].log=Array(600).fill('a'.repeat(20000));
  assert.equal((await h.call('','POST',large)).status,400);
  p.archive.campaigns[0].maps[0].log=Array(20).fill('🪐'.repeat(9999));
  assert.equal((await h.call('','POST',p)).status,201);
  assert.deepEqual((await (await h.call('/'+p.id)).json()).archive,p.archive);
  for(let i=1;i<20;i++) {const q=await h.payload();assert.equal((await h.call('','POST',q)).status,201);}
  const overflow=await h.payload();assert.equal((await h.call('','POST',overflow)).status,409);
  assert.equal(h.database.prepare('SELECT count(*) AS n FROM campaign_saves WHERE deleted_at IS NULL').get()!.n,20);
});

test('legacy v1 imports and artwork key order round-trip without changing the local archive contract',async()=>{
  const h=setup(),p=await h.payload(),c=p.archive.campaigns[0],m=c.maps[0];
  const legacy={version:1,selected:c.id,campaigns:[{...c,...m,id:c.id,name:c.name}]};
  const data={...p,archive:legacy};assert.equal((await h.call('','POST',data)).status,201);
  const restored=await (await h.call('/'+p.id)).json();assert.equal(restored.archive.version,2);
  assert.equal(restored.archive.campaigns[0].maps[0].id,'legacy-sector');
  const q=await h.payload();q.archive.campaigns[0].maps[0]={backgroundImage:png,...q.archive.campaigns[0].maps[0]};
  assert.equal((await h.call('','POST',q)).status,201);assert.equal((await h.call('/'+q.id)).status,200);
});

test('an abandoned upload expires and 40-operation daily quota is enforced atomically',async()=>{
  const h=setup(),p=await h.payload();
  const put=h.env.BUCKET.put;h.env.BUCKET.put=async()=>{throw Error('interrupted');};
  assert.equal((await h.call('','POST',p)).status,503);h.env.BUCKET.put=put;
  assert.equal((await h.call('','POST',p,'fictional-dm-a',1_000_000+86_400_001)).status,410); // expired empty save is tombstoned
  const q=await h.payload();assert.equal((await h.call('','POST',q)).status,201);
  for(let i=1;i<40;i++) assert.equal((await h.call('/'+q.id,'PUT',{...q,revision:i,operationId:crypto.randomUUID()})).status,200);
  assert.equal((await h.call('/'+q.id,'PUT',{...q,revision:40,operationId:crypto.randomUUID()})).status,429);
  assert.equal((await (await h.call('/'+q.id)).json()).save.revision,40);
});

test('rate-limited new copies do not consume invisible save slots after the daily quota resets', async () => {
  const h = setup(), p = await h.payload();
  assert.equal((await h.call('', 'POST', p)).status, 201);
  for (let revision = 1; revision < 40; revision++) {
    assert.equal((await h.call('/' + p.id, 'PUT', { ...p, revision, operationId: crypto.randomUUID() })).status, 200);
  }
  const rejectedAt = 1_000_000 + 23 * 60 * 60 * 1000;
  for (let attempt = 0; attempt < 19; attempt++) {
    const copy = await h.payload('Rejected new copy');
    assert.equal((await h.call('', 'POST', copy, 'fictional-dm-a', rejectedAt)).status, 429);
  }
  assert.equal(h.database.prepare('SELECT count(*) AS n FROM campaign_saves WHERE deleted_at IS NULL').get()!.n, 1);
  assert.equal((await (await h.call()).json()).saves.length, 1);
  assert.deepEqual((await (await h.call('/' + p.id)).json()).archive, p.archive);
  const next = await h.payload('After quota reset');
  assert.equal((await h.call('', 'POST', next, 'fictional-dm-a', 1_000_000 + 86_400_001)).status, 201);
});

test('rate-limit cleanup preserves an interrupted operation and its retry', async () => {
  const h = setup(), pending = await h.payload('Interrupted copy');
  const put = h.env.BUCKET.put;
  h.env.BUCKET.put = async () => { throw Error('Interrupted artwork upload'); };
  assert.equal((await h.call('', 'POST', pending)).status, 503);
  h.env.BUCKET.put = put;
  const complete = await h.payload('Complete copy');
  assert.equal((await h.call('', 'POST', complete)).status, 201);
  for (let revision = 1; revision < 39; revision++) {
    assert.equal((await h.call('/' + complete.id, 'PUT', { ...complete, revision, operationId: crypto.randomUUID() })).status, 200);
  }
  assert.equal((await h.call('', 'POST', { ...pending, operationId: crypto.randomUUID() })).status, 429);
  assert.equal(h.database.prepare('SELECT count(*) AS n FROM campaign_saves WHERE id=?').get(pending.id)!.n, 1);
  assert.equal((await h.call('', 'POST', pending)).status, 201);
  assert.deepEqual((await (await h.call('/' + pending.id)).json()).archive, pending.archive);
});
