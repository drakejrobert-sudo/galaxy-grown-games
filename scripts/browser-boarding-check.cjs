// Vite engineering QA. PLAYWRIGHT_MODULE may point to an existing installation.
// Isolated browser contexts only; temporary fixtures and screenshots never enter real GM saves.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const base = process.env.BASE_URL || 'http://127.0.0.1:5187/galaxy-grown-games/';
const out = process.env.QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'boarding-qa-'));
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [], checks = [];
  try {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1100 }, ...(width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
      for (const role of ['Pilot', 'Gunner', 'Bomber', 'Life Support']) {
        await page.goto(base + '?situation=boarding-party');
        assert.equal(await page.locator('#situation').inputValue(), 'Boarding Party');
        // Expose only this isolated test scene without adding a production debugging API.
        await page.evaluate(async url => {
          const { FlightScene } = await import(url);
          const begin = FlightScene.prototype.begin;
          FlightScene.prototype.begin = function (...args) { begin.apply(this, args); window.qaScene = this; };
        }, new URL('src/game/runtime.ts', base).href);
        await page.locator('#role').selectOption(role);
        await page.locator('#total').fill('10');
        await page.locator('#natural-one').uncheck();
        await page.locator('#start').click();
        await page.locator('canvas').waitFor();
        await page.waitForTimeout(350);
        if (await page.locator('#resume').isVisible()) await page.locator('#resume').click();
        assert.match(await page.locator('#mode-label').innerText(), /BOARDING PARTY/);
        assert.equal(await page.locator('#vent-controls').isVisible(), role === 'Life Support');
        await page.locator('#canvas').focus();
        const before = await page.evaluate(() => ({ x: qaScene.boarding.x, aim: qaScene.boarding.crosshairX }));
        if (role === 'Pilot' || role === 'Gunner' || role === 'Life Support') {
          await page.keyboard.down('ArrowRight'); await page.waitForTimeout(160); await page.keyboard.up('ArrowRight');
          const after = await page.evaluate(() => ({ x: qaScene.boarding.x, aim: qaScene.boarding.crosshairX }));
          assert.ok(role === 'Pilot' ? after.x > before.x : after.aim > before.aim);
        }
        if (role === 'Bomber') {
          await page.locator('#action').click();
          await page.waitForTimeout(90);
          assert.equal(await page.evaluate(() => qaScene.boarding.minesPlaced), 1);
        }
        if (role === 'Gunner' || role === 'Life Support') {
          const box = await page.locator('canvas').boundingBox();
          const shots = await page.evaluate(() => qaScene.boarding.shots);
          if (width < 600) {
            await page.touchscreen.tap(box.x+box.width*.3, box.y+box.height*.6);
            await page.waitForTimeout(60);
            assert.equal(await page.evaluate(() => qaScene.boarding.shots), shots, 'touch aim alone never fires');
            await page.locator('#fire-action').tap();
          } else await page.mouse.click(box.x+box.width*.3, box.y+box.height*.6);
          await page.waitForTimeout(90);
          assert.ok(await page.evaluate(n => qaScene.boarding.shots > n, shots));
        }
        if (role === 'Life Support') {
          await page.locator('#vent-left').click();
          await page.waitForTimeout(80);
          assert.ok(await page.evaluate(() => qaScene.boarding.airlocks[0].cooldown > 7));
          assert.equal(await page.evaluate(() => qaScene.boarding.airlocks[1].cooldown), 0);
          await page.keyboard.press('KeyE'); await page.waitForTimeout(80);
          assert.ok(await page.evaluate(() => qaScene.boarding.airlocks[1].cooldown > 7));
        }
        await page.locator('#pause').click();
        const paused = await page.evaluate(() => JSON.stringify(qaScene.boarding));
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => JSON.stringify(qaScene.boarding)), paused);
        for (const w of [615, 633, width]) {
          await page.setViewportSize({ width: w, height: 1100 });
          assert.ok((await page.locator('canvas').boundingBox()).width > 0);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await page.locator('#resume').click();
        // Readable-threat screenshot fixture, separate from the live input checks above.
        await page.evaluate(role => {
          const scene=qaScene,s=scene.boarding;scene.activeFlight=false;
          s.elapsed=role==='Life Support'?3:4;s.grace=0;s.carrier.x=240;s.carrier.targetX=240;s.carrier.y=250;s.carrier.cycle=0;
          s.pods=[{id:100,kind:'probe',hp:1,maxHp:1,warningRemaining:0,hitFlash:0,x:140,y:340,vx:45,vy:-100,radius:12},{id:101,kind:'shuttle',hp:1,maxHp:2,warningRemaining:.4,hitFlash:.1,x:310,y:420,vx:-55,vy:-80,radius:18}];
          s.boarders=[{id:102,x:200,y:193,slot:0,depth:0,phase:'exposed',remaining:.4},{id:103,x:415,y:372,slot:3,depth:1,phase:'relocating',remaining:.8},{id:104,x:310,y:288,slot:1,depth:1,phase:'warning',remaining:.4},{id:105,x:125,y:422,slot:2,depth:2,phase:'exposed',remaining:.9}];s.lasers=role==='Life Support'?[{id:106,x:200,y:193,side:0,duration:.9,remaining:.45}]:[];
          s.airlocks[0].warning=.4;s.airlocks[1].cooldown=9;s.airlocks[1].warning=null;scene.onBoardingStep(s);scene.paint();
        }, role);
        await page.screenshot({ path: path.join(out, `${role}-${width}.png`), fullPage: true });
        // Finish using a synthetic end-boundary fixture, verify the actual report UI and retry.
        await page.evaluate(() => { const s=qaScene.boarding;s.elapsed=59.98;s.pods=[];s.boarders=[];s.lasers=[];s.carrier.hp=0;s.disabled=true;s.spawnIn=100;qaScene.activeFlight=true; });
        await page.locator('#results:not([hidden])').waitFor();
        assert.match(await page.locator('#summary').inputValue(), /Boarding Party/);
        assert.match(await page.locator('#summary').inputValue(), /Natural 1: No/);
        assert.match(await page.locator('#summary').inputValue(), /GM determines campaign outcome/);
        await page.locator('#again').click(); await page.locator('#natural-one').check(); await page.locator('#start').click();
        assert.equal(await page.evaluate(() => qaScene.boarding.elapsed), 0);
        assert.equal(await page.evaluate(() => qaScene.boarding.aimDistance), 100);
        assert.equal(await page.locator('vite-error-overlay').count(), 0);
        checks.push({ width, role, liveControls: true, screenshotAndEndFixture: true });
      }
      await page.goto(base + '#/map');
      await page.locator('#destination-picker summary').click();
      for (const id of ['haven','cinder']) { await page.locator(`.destination-list [data-destination=${id}]`).click(); await page.locator('#add-stop').click(); }
      await page.locator('#confirm-course').click(); await page.locator('#toggle-prep').click();
      await page.locator('#schedule [name=encounter]').selectOption('repel-boarders');
      await page.locator('#schedule [name=step]').fill('1'); await page.locator('#schedule button').click();
      await page.locator('#toggle-prep').click(); await page.locator('#advance').click();
      assert.match(await page.locator('#encounter-title').innerText(), /Boarding Party/);
      const challenge = new URL(await page.locator('#challenge-link').inputValue());
      assert.equal(challenge.search,'?situation=boarding-party'); assert.equal(challenge.hash,'');
      await page.reload(); assert.match(await page.locator('#encounter-title').innerText(), /Boarding Party/);
      await page.locator('#resolve button').click();
      assert.equal(await page.locator('#encounter-title').count(),0);
      assert.ok(await page.evaluate(() => {const a=JSON.parse(localStorage.getItem('galaxy-grown-map-v1'));return a.version===2 && a.campaigns[0].maps[0].journey.step===1;}));
      await context.close();
    }
    // Decode final shipped assets and verify alpha survived WebP preparation.
    const assetContext=await browser.newContext(),assetPage=await assetContext.newPage();await assetPage.goto(base);
    const assets=await assetPage.evaluate(async base=>{
      const results=[];for(const name of ['carrier','probe','shuttle','corridor','boarder','rifle']) {
        const im=new Image();im.src=new URL('art/boarding-'+name+'.webp',base).href;await im.decode();
        const canvas=document.createElement('canvas');canvas.width=im.width;canvas.height=im.height;const g=canvas.getContext('2d');g.drawImage(im,0,0);
        const data=g.getImageData(0,0,im.width,im.height).data;let transparent=0,opaque=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;if(data[i]>240)opaque++;}
        results.push({name,width:im.width,height:im.height,transparent,opaque});
      }return results;
    },base);
    for(const a of assets){assert.ok(a.width>0&&a.height>0&&a.opaque>0);if(a.name!=='corridor')assert.ok(a.transparent>0,a.name+' retains alpha');}
    await assetContext.close();
    // Missing Boarding art must leave the first-person controls, warnings and rules usable.
    const fallbackContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const fallbackPage=await fallbackContext.newPage();
    fallbackPage.on('pageerror',e=>errors.push(e.message));await fallbackPage.route('**/art/boarding-*.webp',route=>route.abort());
    await fallbackPage.goto(base+'?situation=boarding-party');
    await fallbackPage.evaluate(async url=>{const{FlightScene}=await import(url);const begin=FlightScene.prototype.begin;FlightScene.prototype.begin=function(...args){begin.apply(this,args);window.qaScene=this;};},new URL('src/game/runtime.ts',base).href);
    await fallbackPage.locator('#role').selectOption('Life Support');await fallbackPage.locator('#total').fill('10');await fallbackPage.locator('#start').click();await fallbackPage.locator('canvas').waitFor();
    await fallbackPage.waitForTimeout(250);if(await fallbackPage.locator('#resume').isVisible())await fallbackPage.locator('#resume').click();
    await fallbackPage.evaluate(()=>{const s=qaScene.boarding;qaScene.activeFlight=false;s.boarders=[{id:900,x:310,y:288,slot:1,depth:1,phase:'exposed',remaining:.4}];s.lasers=[{id:901,x:200,y:193,side:0,duration:.9,remaining:.4}];qaScene.onBoardingStep(s);qaScene.paint();});
    await fallbackPage.screenshot({path:path.join(out,'Life Support-fallback-390.png'),fullPage:true});
    assert.ok(await fallbackPage.locator('#fire-action').isVisible());assert.ok(await fallbackPage.locator('#vent-controls').isVisible());
    await fallbackPage.evaluate(()=>{const s=qaScene.boarding;qaScene.activeFlight=true;qaScene.readBoardingFrame=()=>({first:{x:0,y:0,firing:true,aimX:310,aimY:288},continued:{x:0,y:0,firing:false}});qaScene.advanceFrame(50);});
    assert.equal(await fallbackPage.evaluate(()=>qaScene.boarding.shotBoarders),1);
    await fallbackContext.close();
    fs.writeFileSync(path.join(out,'assets.json'),JSON.stringify(assets,null,2));
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log(`PASS: Boarding Party live controls, pause/resize, fixture rendering/results/retry at desktop/390/320; ${out}`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
