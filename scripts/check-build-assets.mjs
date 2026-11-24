import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const [directory, base] = process.argv.slice(2);
if (!directory || !base?.startsWith('/') || !base.endsWith('/')) {
  throw new Error('Usage: node scripts/check-build-assets.mjs <directory> <base>');
}

const origin = 'https://artifact.invalid';
const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
// Vite emits quoted src/href attributes on entry scripts and asset links.
const references = [
  ...html.matchAll(/<(?:script|link)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi),
];

let checked = 0;
for (const [, reference] of references) {
  const url = new URL(reference, origin);
  if (url.origin !== origin) continue;
  if (!reference.startsWith(base) || reference.startsWith('//') ||
      !url.pathname.startsWith(base) ||
      (base === '/' && url.pathname.startsWith('/galaxy-grown-games/'))) {
    throw new Error(`Expected ${reference} to use the ${base} base`);
  }

  const filename = resolve(directory, '.' + decodeURIComponent('/' + url.pathname.slice(base.length)));
  if (!statSync(filename, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing build asset ${reference} in ${directory}`);
  }
  checked++;
}

if (checked === 0) throw new Error(`No local entry assets found in ${directory}/index.html`);
console.log(`Verified ${checked} entry asset(s) at ${base} in ${directory}`);
