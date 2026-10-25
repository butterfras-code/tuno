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
   const setup=page.locator('.activity-setup:visible');
   const toolbar=await setup.locator('.activity-setup-toolbar').boundingBox();
   const actionBox=await action.boundingBox();
   assert.ok(Math.abs(actionBox.x+actionBox.width-toolbar.x-toolbar.width)<1,'start aligns with toolbar right edge');
   const setupBox=await setup.boundingBox();
   assert.ok(Math.abs(setupBox.width-toolbar.width)<1,'toolbar uses full setup width');
   if(mode==='Multi Player') {
    const full=setup.locator('.multiplayer-setup-fullscreen');
    if(await full.isVisible()) {
     const fullBox=await full.boundingBox(), preview=await setup.locator('.preset-preview-scene').boundingBox();
     assert.ok(fullBox.y+fullBox.height<=preview.y,'fullscreen appears above note preview');
    }
   }
   if(mode!=='Practice') {
    const duration=page.getByRole('spinbutton',{name:'Duration (seconds)',exact:true});
    await duration.fill('14');await action.click();
    assert.equal(await duration.evaluate(n=>n===document.activeElement),true);
    await duration.fill('60');
    const modes=page.getByRole('group',{name:mode==='Challenge'?'Challenge Mode':'Multi Player Mode',exact:true});
    assert.equal(await modes.getByRole('button',{name:'Correct Only',exact:true}).isDisabled(),true);
    assert.equal(await modes.getByText('Coming soon',{exact:true}).isVisible(),true);
    assert.equal(await page.getByRole('tab',{name:'Multi Player Settings',exact:true}).count(),0);
    assert.equal(await modes.locator('.challenge-mode-card').filter({has:page.getByRole('button',{name:'Timed',exact:true})}).getByRole('spinbutton',{name:'Duration (seconds)',exact:true}).count(),1);
    assert.equal(await modes.locator('.challenge-mode-card').filter({has:page.getByRole('button',{name:'Goal',exact:true})}).getByRole('spinbutton',{name:'Correct notes',exact:true}).count(),1);
    assert.equal(await page.getByLabel('Timeout (seconds)').count(),0);
    const section=page.getByRole('region',{name:mode==='Challenge'?'Challenge Mode':'Multi Player Mode',exact:true});
    assert.equal(await section.locator('.challenge-rule-summary, details').count(),0);
    for(const card of await modes.locator('.challenge-mode-card').all()) {
     assert.ok((await card.boundingBox()).height < 90,'mode card stays compact');
     assert.equal(await card.locator('input').evaluate(n=>getComputedStyle(n).borderBottomStyle),'solid');
    }
    await modes.getByRole('spinbutton',{name:'Correct notes',exact:true}).fill('12');
    assert.equal(await page.getByRole('spinbutton',{name:'Correct notes',exact:true}).isVisible(),true);
    assert.equal(await modes.getByRole('button',{name:'Goal',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await modes.getByRole('button',{name:'Timed',exact:true}).getAttribute('aria-pressed'),'false');
    await modes.getByRole('button',{name:'Timed',exact:true}).click();
   }
   if(mode==='Multi Player') {
    const modeTab=page.getByRole('tab',{name:'Multi Player Mode',exact:true});
    const styleTab=page.getByRole('tab',{name:'Play Style',exact:true});
    await modeTab.focus();await page.keyboard.press('ArrowRight');
    assert.equal(await styleTab.getAttribute('aria-selected'),'true');
    const styles=page.getByRole('group',{name:'Play Style',exact:true});
    await styles.getByRole('button',{name:'Pass and Play',exact:true}).click();
    await styleTab.focus();await page.keyboard.press('Home');
    assert.equal(await modeTab.getAttribute('aria-selected'),'true');
    await page.getByRole('spinbutton',{name:'Duration (seconds)',exact:true}).fill('14');
    await styleTab.click();await action.click();
    assert.equal(await modeTab.getAttribute('aria-selected'),'true');
    assert.equal(await page.getByRole('spinbutton',{name:'Duration (seconds)',exact:true}).evaluate(n=>n===document.activeElement),true);
    await page.getByRole('spinbutton',{name:'Duration (seconds)',exact:true}).fill('60');
    await styleTab.click();
    assert.equal(await styles.getByRole('button',{name:'Pass and Play',exact:true}).getAttribute('aria-pressed'),'true');
    await modeTab.click();
   }
   await openCustom(page);assert.equal(await rangeDialog(page).getByRole('slider',{name:'Lowest note',exact:true}).isVisible(),true);await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.getByRole('button',{name:'Add player',exact:true}).click();await page.getByLabel('Player 2 name').fill('Cancelled');await page.keyboard.press('Escape');assert.equal(await page.locator('.multiplayer-player-tab').count(),1);
  await page.getByRole('button',{name:'Add player',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Edit Player 2',exact:true}).click();await page.getByLabel('Player 2 name').fill('A'.repeat(40));await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
  assert.equal(await page.locator('#multiplayer-notes-tab').getAttribute('aria-label'),`Choose Notes — ${'A'.repeat(40)}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const direction=width>760?'up':'left';assert.equal(await page.getByRole('button',{name:`Move Player 2 ${direction}`,exact:true}).isVisible(),true);
  await page.getByRole('button',{name:'Remove Player 1',exact:true}).click();assert.equal(await page.locator('.multiplayer-player-tab').count(),1);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(`${engine}: shared mode setup, validation focus, modal editing and roster layouts passed.`);
} finally {await browser.close();await host.close();}
