// Run against Vite with an existing Playwright installation (see README).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.BASE_URL || 'http://127.0.0.1:5187/galaxy-grown-games/';
const output = process.env.QA_OUTPUT;
const situations = ['Asteroid Field', 'Space Battle', 'Boarding Party'];
const roles = ['Pilot', 'Gunner', 'Bomber', 'Life Support'];

async function start(page, situation, role) {
  await page.locator('#situation').selectOption({ label: situation });
  await page.locator('#role').selectOption({ label: role });
  await page.locator('#total').fill('10');
  await page.locator('#start').click();
  await page.locator('#canvas canvas').waitFor();
  if (await page.locator('#resume').isVisible()) await page.locator('#resume').click();
}

async function verifyLayout(page, label) {
  const geometry = await page.evaluate(() => {
    const selectors = ['.hud', '#pause', '#canvas canvas', '#fire-action', '#action', '#route-controls', '#platform-controls'];
    const visible = selectors.map(selector => [selector, document.querySelector(selector)])
      .filter(([, element]) => element.getClientRects().length)
      .map(([selector, element]) => [selector, element.getBoundingClientRect().toJSON()]);
    return {
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      visible,
    };
  });
  assert.equal(geometry.overflow, false, label);
  for (const [selector, box] of geometry.visible) {
    assert.ok(box.left >= -1 && box.top >= -1 && box.right <= geometry.width + 1 && box.bottom <= geometry.height + 1,
      `${label} ${selector} ${JSON.stringify(box)}`);
    if (selector === '#canvas canvas') assert.ok(Math.abs(box.width * 7 / 6 - box.height) <= 2, label);
  }
}

async function verifyTouchPair(page, first, second) {
  const client = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    const pointers = new Set();
    const capture = event => { if (event.pointerType === 'touch') pointers.add(event.pointerId); };
    document.addEventListener('pointerdown', capture);
    window.finishTouchCheck = () => {
      document.removeEventListener('pointerdown', capture);
      return pointers.size;
    };
  });
  const points = await Promise.all([first, second].map(async (selector, id) => {
    const { x, y, width, height } = await page.locator(selector).boundingBox();
    return { id, x: x + width / 2, y: y + height / 2 };
  }));
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await page.waitForTimeout(180);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.evaluate(() => window.finishTouchCheck()), 2);
  await client.detach();
}

(async () => {
  if (output) fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [width, height] of [[320, 568], [390, 740], [740, 390], [1280, 900]]) {
      const touch = width < 1000;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(base);
      for (const situation of situations) for (const role of roles) {
        const label = `${width}x${height} ${situation} / ${role}`;
        await start(page, situation, role);
        await verifyLayout(page, label);
        if (width === 320 && situation === 'Space Battle' && role === 'Gunner') {
          await verifyTouchPair(page, '#canvas canvas', '#fire-action');
        }
        if (width === 320 && situation === 'Space Battle' && role === 'Life Support') {
          await verifyTouchPair(page, '#move-right', '#jump');
        }
        if (output) await page.screenshot({ path: path.join(output, label.replaceAll(/[^a-z0-9]+/gi, '-') + '.png') });
        await page.locator('#pause').click();
        await page.locator('#resume').waitFor();
        assert.ok((await page.locator('#play-help').innerText()).length > 20, label);
        const time = await page.locator('#time').innerText();
        await page.waitForTimeout(120);
        assert.equal(await page.locator('#time').innerText(), time, label);
        await page.locator('#resume').click();
        await verifyLayout(page, label);
        await page.locator('#pause').click();
        await page.locator('#abandon').click();
        assert.equal(await page.locator('.surface-nav').isVisible(), true, label);
      }
      assert.deepEqual(errors, [], `${width}x${height}`);
      await context.close();
      console.log(`12 stations passed at ${width}x${height}`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
