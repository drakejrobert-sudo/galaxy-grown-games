// Focused Vite QA for PR #74 carrier phase/cycle boundaries, using isolated synthetic states.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const base = process.env.BASE_URL || 'http://127.0.0.1:5187/galaxy-grown-games/';
const out = process.env.QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'boarding-cycle-'));
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [], results = [];
  try {
    for (const width of [1440,390,320]) {
      const context = await browser.newContext({viewport:{width,height:width<600?844:1100},...(width<600?{isMobile:true,hasTouch:true}:{})});
      const page = await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
      for (const role of ['Gunner','Bomber']) {
        await page.goto(base+'?situation=boarding-party');
        await page.evaluate(async base=>{
          const {FlightScene}=await import(new URL('src/game/runtime.ts',base).href);
          window.qaRules=await import(new URL('src/game/rules.ts',base).href);
          const begin=FlightScene.prototype.begin;
          FlightScene.prototype.begin=function(...args){begin.apply(this,args);window.qaScene=this;};
        },base);
        await page.locator('#role').selectOption(role);await page.locator('#total').fill('10');await page.locator('#start').click();
        await page.locator('canvas').waitFor();await page.waitForTimeout(150);
        if(await page.locator('#resume').isVisible())await page.locator('#resume').click();
        assert.match(await page.locator('#mode-label').innerText(),/BOARDING PARTY/);
        for (const boundary of [12,24]) {
          const result=await page.evaluate(({role,boundary})=>{
            const q=qaScene,s=qaRules.createBoarding(role);q.activeFlight=false;q.boarding=s;
            s.elapsed=boundary-.01;s.spawnIn=1000;
            const cycle=boundary/12-1,startX=cycle?360:240,stage=cycle%2?120:360;
            Object.assign(s.carrier,{cycle,startX,targetX:200,x:startX+(stage-startX)*2.99/3,y:500});
            q.readBoardingFrame=()=>({first:{x:0,y:0,firing:false},continued:{x:0,y:0,firing:false}});
            q.activeFlight=true;q.timingPrimed=true;q.game.loop.rawDelta=1000/60;q.update(0,1000/60);q.activeFlight=false;
            return {elapsed:s.elapsed,x:s.carrier.x,startX:s.carrier.startX,cycle:s.carrier.cycle,hull:s.hull,stage};
          },{role,boundary});
          assert.ok(Math.abs(result.x-result.stage)<1e-7);assert.ok(Math.abs(result.startX-result.stage)<1e-7);
          assert.equal(result.cycle,boundary/12);assert.equal(result.hull,3);
          results.push({width,role,boundary,...result});
        }
        await page.screenshot({path:path.join(out,`${role}-${width}.png`),fullPage:true});
        if(role==='Bomber') {
          const result=await page.evaluate(()=>{
            const q=qaScene,s=qaRules.createBoarding('Bomber');q.boarding=s;s.elapsed=11.99;s.spawnIn=1000;
            Object.assign(s.carrier,{cycle:0,startX:240,targetX:200,x:359.6,y:500});
            s.mines=[{id:90,x:360,y:544,armIn:0,expiresIn:2,blastRadius:58}];
            q.activeFlight=true;q.timingPrimed=true;q.game.loop.rawDelta=50;q.update(0,50);q.activeFlight=false;
            return {damage:s.carrierDamage,hp:s.carrier.hp,explosions:s.explosions.length};
          });assert.deepEqual(result,{damage:1,hp:4,explosions:1});
        }
        await page.locator('#pause').click();const snapshot=await page.evaluate(()=>JSON.stringify(qaScene.boarding));
        await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>JSON.stringify(qaScene.boarding)),snapshot);
        await page.locator('#resume').click();assert.equal(await page.locator('#pause-overlay').isVisible(),false);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await page.locator('vite-error-overlay').count(),0);
      }
      await context.close();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'boundaries.json'),JSON.stringify(results,null,2));
    console.log(`PASS: first two cycle boundaries, single mine damage, pause/resume at desktop/390/320; ${out}`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
