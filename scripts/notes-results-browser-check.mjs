import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { startPractice, notesMode, configureMultiplayerNotes } from './notes-setup-helpers.mjs';

const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[engine].launch();
const host = await hostBuild();
try {
  for (const [width,height] of [[320,667],[360,640],[390,844],[600,800],[768,1024],[844,390],[1280,800]]) {
    for (const answered of [false,true]) {
      const page = await browser.newPage({ viewport: {width,height}, reducedMotion: 'reduce' });
      await page.goto(new URL('/notes/',host.url).href);
      await page.evaluate(() => document.fonts.ready);
      await startPractice(page);
      if (answered) await page.locator('.answer-natural:visible').first().click();
      await page.getByRole('button',{name:'Finish',exact:true}).click();
      await page.waitForFunction(() => !document.querySelector('.play-stage'));
      const compact = width <= 760 || width <= 900 && height <= 500;
      const inspect = async () => page.evaluate(() => {
        const result = document.querySelector('.practice-results');
        const outside = [...result.querySelectorAll('h2,button,strong,summary,.result-uno,.result-treats,#recommendation,.practice-result-details[open] > p')]
          .filter(node => { const r = node.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth+1 || r.top < -1 || r.bottom > innerHeight+1); })
          .map(node => node.textContent || node.className);
        return { outside, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
      });
      let layout = await inspect();
      assert.ok(layout.width <= width,`${width}: horizontal overflow`);
      if (compact) {
        assert.ok(layout.height <= height,`${width}×${height}: results scroll (${layout.height})`);
        assert.deepEqual(layout.outside,[],`${width}: results remain visible`);
      }
      assert.equal(await page.locator('.practice-results .practice-result-score-hint').textContent(),'Points × Accuracy');
      const score = await page.locator('.practice-results .practice-result-stats .scoreboard-value').boundingBox();
      const hint = await page.locator('.practice-results .practice-result-score-hint').boundingBox();
      assert.ok(hint.y >= score.y + score.height - 1,'Formula sits under the score');
      await page.getByText('Session details',{exact:true}).click();
      layout = await inspect();
      if (compact) {
        assert.ok(layout.height <= height,`${width}: opening details does not scroll results`);
        assert.deepEqual(layout.outside,[],`${width}: session details remain visible`);
      }
      await page.getByText('Session details',{exact:true}).click();
      await page.getByRole('button',{name:'Edit setup',exact:true}).click();
      await page.getByRole('button',{name:'Start Practice',exact:true}).waitFor();
      await page.close();
    }
    console.log(`${engine}: ${width}×${height} empty and answered results fit; details and setup navigation work.`);
  }
  for (const [width,height] of [[320,667],[390,844],[844,390],[1280,800]]) {
    for (const mode of ['Challenge','Goal','Multi Player']) {
      const page = await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      await page.goto(new URL('/notes/',host.url).href);
      await page.evaluate(()=>document.fonts.ready);
      const button = name=>page.getByRole('button',{name,exact:true});
      await notesMode(page,mode === 'Goal' ? 'Challenge' : mode);
      if (mode === 'Multi Player') {
        for (let i=1;i<(width===320 ? 8 : 3);i++) {
          await button('Add player').click();
          await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
        }
        await configureMultiplayerNotes(page);
        await button('Start round').click();await button('Continue to round').click();await button('End round').click();
      } else {
        if(mode==='Goal') await button('Goal').click();
        await button('Start Challenge').click();await button('Finish').click();
      }
      await page.waitForFunction(()=>!document.querySelector('.play-stage'));
      const inspect=async()=>page.evaluate(()=>{
        const visible=node=>node.getClientRects().length && !node.closest('[hidden]') && (!node.closest('details:not([open])') || node.matches('summary'));
        const screen=[...document.querySelectorAll('.session-results')].find(visible);
        const outside=[...screen.querySelectorAll('h2,h3,button,strong,dd,summary,.result-uno,.result-treats,.result-message')].filter(visible).filter(node=>{
          const r=node.getBoundingClientRect();return r.left < -1 || r.top < -1 || r.right > innerWidth+1 || r.bottom > innerHeight+1;
        }).map(node=>node.textContent || node.className);
        return {outside,height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth};
      });
      const check=async()=>{
        const layout=await inspect();assert.ok(layout.width<=width,`${mode} ${width}: horizontal overflow`);
        if(width<900) {assert.ok(layout.height<=height,`${mode} ${width}: page scrolls (${layout.height})`);assert.deepEqual(layout.outside,[],`${mode} ${width}: visible results fit`);}
      };
      await check();
      if(mode === 'Multi Player' && width<900) {
        const cards=page.locator('.multiplayer-result-row');
        const count=await cards.count();assert.equal(count,width===320 ? 8 : 3);
        for(let i=1;i<count;i++) {await page.getByRole('navigation',{name:'Player results'}).getByRole('button',{name:'Next',exact:true}).click();await check();}
        assert.equal(await page.locator('.result-navigation [role="status"]').textContent(),`${count} of ${count}`);
        await page.getByRole('navigation',{name:'Player results'}).getByRole('button',{name:'Previous',exact:true}).click();await check();
      } else if(mode !== 'Multi Player') {
        assert.equal(await page.locator('#challenge-result .practice-result-score-hint').textContent(),mode==='Goal' ? 'Time to goal' : 'Points × Accuracy');
        await page.getByText('Round details',{exact:true}).click();await check();
      }
      await page.close();console.log(`${engine}: ${width}×${height} ${mode} results fit.`);
    }
  }
} finally { await browser.close(); await host.close(); }
