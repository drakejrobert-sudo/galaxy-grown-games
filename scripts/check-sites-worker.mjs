import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import worker from '../dist/server/index.js';

const hosting = JSON.parse(readFileSync(new URL('../dist/.openai/hosting.json', import.meta.url), 'utf8'));
assert.ok(hosting.project_id);
assert.equal(hosting.d1, 'DB');
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
assert.equal((await request('/api/rooms')).status, 401);

const size = gzipSync(readFileSync(new URL('../dist/server/index.js', import.meta.url))).length;
assert.ok(size < 3_000_000, `Worker bundle is ${size} bytes compressed, near or above the 3 MB budget`);
console.log(`Verified Worker entry assets, Rooms authentication and D1 migration. Compressed Worker: ${size} bytes.`);
