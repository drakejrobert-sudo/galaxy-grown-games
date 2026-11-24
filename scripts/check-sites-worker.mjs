import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import worker from '../dist/server/index.js';

const hosting = JSON.parse(readFileSync(new URL('../dist/.openai/hosting.json', import.meta.url), 'utf8'));
assert.ok(hosting.project_id);
assert.equal(hosting.d1, 'DB');
assert.equal(hosting.r2, 'BUCKET');
assert.equal(hosting.static, undefined);
assert.ok(readdirSync(new URL('../dist/.openai/drizzle', import.meta.url)).some((name) => name.endsWith('.sql')));

const request = (path, options) => worker.fetch(new Request('https://artifact.invalid' + path, options), {});
const page = await request('/');
assert.equal(page.status, 200);
assert.match(page.headers.get('content-type'), /^text\/html/);
const index = await page.text();
const urls = [...index.matchAll(/<(?:script|link)\b[^>]*?\s(?:src|href)="(\/[^"]+)"/gi)].map((match) => match[1]);
assert.ok(urls.length > 0);
for (const path of urls) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  assert.ok((await response.arrayBuffer()).byteLength > 0, path);
}
assert.equal((await request('/art/asteroid.webp')).headers.get('content-type'), 'image/webp');
assert.equal((await request('/assets/missing.js')).status, 404);
assert.equal(await (await request('/', { method: 'HEAD' })).text(), '');
const rooms = await worker.fetch(new Request('https://artifact.invalid/api/rooms'), {
  DB: { prepare() { throw new Error('A new guest should not query D1'); } },
});
assert.equal(rooms.status, 200);
assert.match(rooms.headers.get('set-cookie'), /^__Host-gg_room_guest=[a-f0-9]{64};/);
assert.deepEqual(await rooms.json(), { canHost: false, hosted: [], joined: [] });
assert.equal((await worker.fetch(new Request('https://artifact.invalid/api/rooms', {
  method: 'POST', headers: { Origin: 'https://artifact.invalid' },
}), { DB: {} })).status, 403);

assert.equal((await request('/api/campaigns')).status, 401);
assert.equal((await worker.fetch(new Request('https://artifact.invalid/api/campaigns', {
  headers: { 'oai-authenticated-user-id': 'fictional-account', 'oai-authenticated-user-email': 'dm@example.invalid' },
}), { ROOM_DM_EMAIL: 'dm@example.invalid' })).status, 503);
assert.equal((await worker.fetch(new Request('https://artifact.invalid/api/campaigns', {
  headers: { 'oai-authenticated-user-id': 'other-account', 'oai-authenticated-user-email': 'other@example.invalid' },
}), { ROOM_DM_EMAIL: 'dm@example.invalid' })).status, 403);

const size = gzipSync(readFileSync(new URL('../dist/server/index.js', import.meta.url))).length;
assert.ok(size < 3_000_000, `Worker bundle is ${size} bytes compressed, near or above the 3 MB budget`);
console.log(`Verified Worker entry assets, guest session setup and DM authorization and D1 migration. Compressed Worker: ${size} bytes.`);
