import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { notesMode,openCustom,rangeDialog } from './notes-setup-helpers.mjs';
const engine=process.env.TUNO_BROWSER || 'chromium';
const browser=await ({chromium,firefox})[engine].launch(),host=await hostBuild();
try {
 for(const [width,height] of [[360,800],[768,1024],[1366,768]]) {
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('/notes/',host.url).href);
  for(const mode of ['Practice','Challenge','Multi Player']) {
   await notesMode(page,mode);
   const action=page.getByRole('button',{name:mode==='Multi Player'?'Start round':`Start ${mode}`,exact:true});
   assert.equal(await action.isVisible(),true);
   if(mode==='Multi Player') {
    const settings=page.getByRole('tab',{name:'Multi Player Settings',exact:true});
    const before=await action.boundingBox();await settings.click();const after=await action.boundingBox();assert.ok(Math.abs(before.y-after.y)<1);
    const duration=page.getByRole('spinbutton',{name:'Duration (seconds)',exact:true});await duration.fill('14');
    await page.getByRole('tab',{name:'Choose Notes',exact:true}).focus();await page.keyboard.press('Home');
    await action.click();assert.equal(await settings.getAttribute('aria-selected'),'true');assert.equal(await duration.evaluate(n=>n===document.activeElement),true);
    await duration.fill('60');
   }
   if(mode==='Challenge') {
    const duration=page.getByRole('spinbutton',{name:'Duration (seconds)',exact:true});
    await duration.fill('14');await action.click();
    assert.equal(await duration.evaluate(n=>n===document.activeElement),true);
    await duration.fill('60');
    const modes=page.getByRole('group',{name:'Challenge Mode',exact:true});
    await modes.getByRole('button',{name:'Goal',exact:true}).click();
    assert.equal(await page.getByLabel('Correct notes',{exact:true}).isVisible(),true);
    assert.equal(await modes.getByRole('button',{name:'Goal',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await modes.getByRole('button',{name:'Timed',exact:true}).getAttribute('aria-pressed'),'false');
    await modes.getByRole('button',{name:'Timed',exact:true}).click();
   }
   await openCustom(page);assert.equal(await rangeDialog(page).getByRole('slider',{name:'Lowest note',exact:true}).isVisible(),true);await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.getByRole('button',{name:'Add player',exact:true}).click();await page.getByLabel('Player 2 name').fill('Cancelled');await page.keyboard.press('Escape');assert.equal(await page.locator('.multiplayer-player-tab').count(),1);
  await page.getByRole('button',{name:'Add player',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Edit Player 2',exact:true}).click();await page.getByLabel('Player 2 name').fill('A'.repeat(40));await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
  assert.equal(await page.locator('#multiplayer-notes-tab').textContent(),'Choose Notes');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const direction=width>760?'up':'left';assert.equal(await page.getByRole('button',{name:`Move Player 2 ${direction}`,exact:true}).isVisible(),true);
  await page.getByRole('button',{name:'Remove Player 1',exact:true}).click();assert.equal(await page.locator('.multiplayer-player-tab').count(),1);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(`${engine}: shared mode setup, validation focus, modal editing and roster layouts passed.`);
} finally {await browser.close();await host.close();}
