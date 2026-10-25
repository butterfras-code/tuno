import { startPractice, readyForAnswer } from './notes-setup-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
import { openCustom, setToggle, choosePreset } from './notes-setup-helpers.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[engine].launch();
const host = await hostBuild();
await mkdir('dist/validation', { recursive: true });
try {
  for (const [width,height] of [[360,800],[390,844],[768,1024],[1024,768],[1366,768],[844,390]]) {
    const page = await browser.newPage({ viewport: {width,height}, hasTouch: true, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/notes/',host.url).href);
    await page.evaluate(() => document.fonts.ready);
    const check = async (state) => {
      await page.screenshot({path:`dist/validation/practice-${engine}-${width}-${state}.png`,fullPage:true});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,`${width} ${state}: horizontal page overflow`);
      assert.equal(await page.locator('.suite-footer').isVisible(), !['intro','playing','paused'].includes(state), `${width} ${state}: footer visibility`);
      // Setup and results scroll naturally to the shared suite information;
      // live practice must still fit without page scrolling.
      if (height >= 768 && ['intro','playing','paused'].includes(state)) assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight),true,`${width} ${state}: page should fit`);
    };
    await check('setup');
    await page.getByRole('button',{name:'Start Practice',exact:true}).click();
    await page.waitForSelector('.note-preview');
    await check('intro');
    await startPractice(page);
    await check('playing');
    const staff = await page.locator('.staff-panel').boundingBox();
    const finish = await page.getByRole('button',{name:'Finish',exact:true}).boundingBox();
    if (height >= 768) {
      const panel = await page.locator('#notes-practice').boundingBox();
      assert.ok(staff.y >= 0 && finish.y + finish.height <= Math.min(height,panel.y+panel.height),`${width}: staff and session controls fit`);
    }
    const targets = await page.locator('.answer:visible').evaluateAll(nodes => nodes.map(node => { const b=node.getBoundingClientRect();return {width:b.width,height:b.height,left:b.left,right:b.right}; }));
    for (const target of targets) {
      assert.ok(target.width >= 43.9 && target.height >= 44,`${width}: touch target ${JSON.stringify(target)}`);
      assert.ok(target.left >= 0 && target.right <= width,`${width}: answer clipped`);
    }
    await page.getByRole('button',{name:'A',exact:true}).first().tap();
    assert.match(await page.locator('#practice-counts').textContent(),/1 attempts/);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await check('paused');
    await page.getByRole('button',{name:'Resume',exact:true}).click();
    await page.getByRole('button',{name:'Finish',exact:true}).click();
    await check('results');
    await page.getByRole('button',{name:'Edit setup',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Choose Notes',exact:true}).evaluate(node => node === document.activeElement),true);
    // All spellings must remain reachable in the phone's letter-column layout,
    // including tonic spellings which repeat at octave endpoints.
    if (width === 360) {
      for (const id of ['flute-starter','trombone-starter']) {
        await choosePreset(page,id);
        await startPractice(page);
        const all = await page.locator('.answer').allTextContents();
        const visible = await page.locator('.answer:visible').allTextContents();
        assert.deepEqual([...new Set(visible)].sort(),[...new Set(all)].sort());
        assert.equal(new Set(visible).size,visible.length);
        await page.getByRole('button',{name:'Finish',exact:true}).click();
        await page.getByRole('button',{name:'Edit setup',exact:true}).click();
      }
      const rangeSummary = await page.locator('#preset-summary').textContent();
      await openCustom(page);
      assert.equal(await page.locator('#preset-summary').textContent(),rangeSummary);
      assert.equal(await page.getByRole('slider',{name:'Lowest note',exact:true}).isVisible(),true);
      await page.getByRole('button',{name:'Save Preset',exact:true}).click();
      await page.getByLabel('Preset name',{exact:true}).fill('Phone range');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    }
    assert.deepEqual(errors,[]); await page.close();
  }
  console.log(`${engine}: Practice setup, introduction, touch play, pause, results and custom editing fit target devices.`);
} finally { await browser.close(); await host.close(); }
