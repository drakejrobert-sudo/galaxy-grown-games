import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';

const { values } = parseArgs({ options: { outDir: { type: 'string' } } });
const client = values.outDir ? resolve(values.outDir) : mkdtempSync(join(tmpdir(), 'galaxy-sites-client-'));
if (values.outDir) {
  const [folder] = relative(resolve('dist'), client).split(sep);
  if (!folder || ['..', '.openai', 'server', 'pages'].includes(folder)) {
    throw new Error('Choose a dedicated client directory under dist, such as dist/sites.');
  }
}
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
};

try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { stdio: 'inherit' });
  await build({ mode: 'sites', base: '/', build: { outDir: client, emptyOutDir: true } });
  execFileSync(process.execPath, ['scripts/check-build-assets.mjs', client, '/'], { stdio: 'inherit' });

  const files = readdirSync(client, { withFileTypes: true, recursive: true }).filter((file) => file.isFile());
  const assets = files.map((file) => {
    const path = join(file.parentPath, file.name);
    const url = '/' + relative(client, path).split(sep).map(encodeURIComponent).join('/');
    const mime = types[extname(file.name)];
    if (!mime) throw new Error('Missing Sites asset MIME type for ' + url);
    return [url, { mime, body: readFileSync(path).toString('base64') }];
  });

  await build({
    configFile: false,
    publicDir: false,
    plugins: [{
      name: 'galaxy-sites-assets',
      resolveId: (id) => id === 'virtual:sites-assets' ? '\0' + id : undefined,
      load: (id) => id === '\0virtual:sites-assets' ? `export const assets = new Map(${JSON.stringify(assets)});` : undefined,
    }],
    ssr: { target: 'webworker' },
    build: {
      ssr: resolve('src/rooms/worker.ts'),
      outDir: 'dist/server',
      emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: 'index.js' } },
    },
  });
  cpSync('.openai/hosting.json', 'dist/.openai/hosting.json');
  rmSync('dist/.openai/drizzle', { recursive: true, force: true });
  cpSync('drizzle', 'dist/.openai/drizzle', { recursive: true });
  await import('./check-sites-worker.mjs');
} finally {
  if (!values.outDir) rmSync(client, { recursive: true, force: true });
}
