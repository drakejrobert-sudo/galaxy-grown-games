// Optional integration check: use an installed Playwright without adding a runtime dependency.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const base = process.env.BASE_URL || 'http://127.0.0.1:5187/galaxy-grown-games/';
const out = process.env.QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'galaxy-polish-'));
fs.mkdirSync(out, { recursive: true });
const map = (id, name) => ({ id, name, description: 'Synthetic engineering fixture', decoration: 'none', destinations: [
  { id: 'a', name: 'Start', type: 'planet', x: 100, y: 200, description: 'Start here', ...(id === 'regional' ? { detailMapId: 'detail' } : {}) },
  { id: 'b', name: 'Finish', type: 'station', x: 780, y: 200, description: 'Destination' },
  { id: 'ref', name: 'Reference', type: 'star', x: 460, y: 380, description: 'Not a stop', navigable: false },
], routes: [{ id: 'route', from: 'a', to: 'b', steps: 2, risk: 'Low', table: '' }], schedules: [], journey: null, location: null, log: [] });
const fixture = { version: 2, selected: 'test', campaigns: [{ id: 'test', name: 'Polish fixture', activeMap: 'regional', maps: [map('regional', 'Regional'), map('detail', 'Detail')], encounters: [{ id: 'pause', title: 'Engineering encounter', type: 'minigame', situation: 'asteroid-field', prompt: 'Public prompt', notes: 'SECRET FIXTURE NOTE' }], tables: [] }] };
(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [], measurements = [];
  try {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, ...(width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(base + '#/map');
      await page.evaluate(f => localStorage.setItem('galaxy-grown-map-v1', JSON.stringify(f)), fixture);
      await page.reload(); await page.locator('#sector').waitFor();
      const scroll = width < 600 ? 210 : 0;
      await page.locator('.map-canvas').evaluate((el, x) => el.scrollLeft = x, scroll);
      await page.locator('g[data-destination=b]').evaluate(el => el.focus({preventScroll:true})); await page.keyboard.press('Enter');
      assert.equal(await page.locator('g[data-destination=b]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-destination')), 'b');
      assert.equal(await page.locator('.map-canvas').evaluate(el => el.scrollLeft), scroll);
      await page.locator('g[data-destination=b]').press('Space');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-destination')), 'b');
      await page.locator('#destination-picker summary').click();
      await page.locator('.destination-list [data-destination=ref]').click();
      assert.equal(await page.locator('#add-stop').count(), 0);
      await page.locator('.destination-list [data-destination=a]').click();
      await page.locator('#open-detail').click();
      assert.equal(await page.locator('.map-canvas').evaluate(el => el.scrollLeft), 0);
      await page.locator('.map-canvas').evaluate(el => el.scrollLeft = 75);
      await page.getByRole('button', { name: 'Back to Regional' }).click();
      assert.equal(await page.locator('.map-canvas').evaluate(el => el.scrollLeft), scroll);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'map-title');
      for (const id of ['a', 'b']) { await page.locator(`.destination-list [data-destination=${id}]`).click(); await page.locator('#add-stop').click(); }
      await page.locator('#confirm-course').click();
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Start → Finish');
      await page.locator('#toggle-prep').click();
      await page.locator('#schedule [name=step]').fill('1'); await page.locator('#schedule button').click();
      await page.locator('#toggle-prep').click();
      assert.ok(!(await page.locator('body').innerText()).includes('SECRET FIXTURE NOTE'));
      await page.locator('#advance').click(); await page.locator('#encounter-title').waitFor();
      assert.match(await page.locator('.journey-progress').innerText(), /Paused.*Step 1 of 2/);
      const paused = await page.evaluate(() => JSON.parse(localStorage.getItem('galaxy-grown-map-v1')).campaigns[0].maps[0].journey);
      await page.locator('#map-select').selectOption('detail'); await page.locator('#map-select').selectOption('regional'); await page.reload();
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('galaxy-grown-map-v1')).campaigns[0].maps[0].journey), paused);
      await page.locator('#resolve button').click(); await page.locator('#advance').click();
      await page.getByRole('heading', { name: 'Arrived at Finish' }).waitFor();
      await page.locator('#toggle-prep').click();
      // Upload a public synthetic raster; custom artwork suppresses bundled symbols/scenery.
      const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 90; c.height = 50; const g = c.getContext('2d'); g.fillStyle = '#173047'; g.fillRect(0, 0, 90, 50); return c.toDataURL(); });
      await page.locator('#background-upload').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
      await page.locator('#map-background').waitFor(); assert.equal(await page.locator('.destination-art,.map-scenery').count(), 0);
      await page.screenshot({ path: path.join(out, `uploaded-map-${width}.png`), fullPage: true });
      await page.locator('.map-canvas').evaluate((el, x) => el.scrollLeft = x, width < 600 ? 125 : 0);
      const download = page.waitForEvent('download'); await page.locator('#export').click();
      const exported = await download; const exportPath = path.join(out, `campaign-${width}.json`); await exported.saveAs(exportPath);
      await page.locator('#import').setInputFiles(exportPath);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('galaxy-grown-map-v1')).campaigns.length === 2);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('galaxy-grown-map-v1')).campaigns.length), 2);
      const saved = await page.evaluate(() => localStorage.getItem('galaxy-grown-map-v1'));
      await page.locator('#import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
      await page.getByRole('status').filter({ hasText: 'Import failed' }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('galaxy-grown-map-v1')), saved);
      await page.locator('#remove-background').click(); await page.locator('#toggle-prep').click();
      await page.screenshot({ path: path.join(out, `map-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      // Per-campaign scroll state is independent even with matching map IDs.
      await page.locator('.map-canvas').evaluate(el => el.scrollLeft = 90);
      await page.locator('#toggle-prep').click(); await page.locator('#campaign-select').selectOption('test');
      assert.equal(await page.locator('.map-canvas').evaluate(el => el.scrollLeft), width < 600 ? 125 : 0);
      await page.locator('#remove-background').click();
      // Error event exercises the same fallback path as an unreadable local asset.
      const art = page.locator('.destination-art').first();
      await art.dispatchEvent('error');
      assert.equal(await page.locator('g[data-destination=a] .node-symbol').evaluate(el => getComputedStyle(el).visibility), 'visible');
      for (const situation of ['Asteroid Field', 'Space Battle']) for (const role of ['Pilot', 'Gunner', 'Bomber', 'Life Support']) {
        await page.goto(base); await page.locator('#situation').selectOption(situation); await page.locator('#role').selectOption(role);
        await page.locator('#total').fill('16'); await page.locator('#start').click(); await page.locator('canvas').waitFor();
        await page.waitForTimeout(400); if (await page.locator('#resume').isVisible()) await page.locator('#resume').click();
        await page.locator('#canvas').focus();
        if (role === 'Pilot' || role === 'Life Support') { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(180); await page.keyboard.up('ArrowRight'); }
        else if (role === 'Bomber') await page.locator('#action').click();
        else { const box = await page.locator('canvas').boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3); }
        if (width < 600) {
          if (role === 'Life Support') await page.locator(situation === 'Asteroid Field' ? '#route-shields' : '#jump').tap();
          else if (role === 'Bomber') await page.locator('#action').tap();
          else {
            await page.locator('canvas').scrollIntoViewIfNeeded();
            const box = await page.locator('canvas').boundingBox();
            await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 3);
            if (situation === 'Space Battle' && role === 'Gunner') await page.locator('#fire-action').tap();
          }
        }
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(out, `${situation}-${role}-${width}.png`), fullPage: true });
        if (!(await page.locator('#pause-overlay').isVisible())) await page.locator('#pause').click();
        await page.locator('#pause-overlay:not([hidden])').waitFor(); const time = await page.locator('#time').innerText(); await page.waitForTimeout(120);
        assert.equal(await page.locator('#time').innerText(), time);
        for (const resizedWidth of (role === 'Bomber' ? [615, 617] : [width === 1440 ? 390 : 700])) {
          await page.setViewportSize({ width: resizedWidth, height: 1000 });
          assert.ok((await page.locator('canvas').boundingBox()).width > 0);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('#resume').click();
        await page.locator('#pause-overlay').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await page.locator('vite-error-overlay').count(), 0);
        measurements.push({ width, situation, role, artworkBytes: await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/art/')).reduce((n, r) => n + r.encodedBodySize, 0)) });
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify(measurements, null, 2));
    console.log(`PASS: map behavior and all eight modes at desktop/390/320; artifacts: ${out}`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
