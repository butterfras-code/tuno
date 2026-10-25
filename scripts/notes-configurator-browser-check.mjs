import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { openCustom, rangeDialog, setEndpoint, setKey, setModifiers, useRange } from './notes-setup-helpers.mjs';
const engine=process.env.TUNO_BROWSER || 'chromium';
const browser=await ({chromium,firefox})[engine].launch(),host=await hostBuild();
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('/notes/',host.url).href);
 await openCustom(page);const dialog=rangeDialog(page),accept=dialog.getByRole('button',{name:'Accept',exact:true});
 const content=dialog.getByRole('group',{name:'Staff content',exact:true});
 for(const name of ['Lines','Spaces']) await content.getByRole('button',{name,exact:true}).click();
 assert.equal(await accept.isDisabled(),true);assert.match(await dialog.locator('.visual-range-actions').textContent(),/Turn on Lines or Spaces/);
 await content.getByRole('button',{name:'Lines',exact:true}).click();await setEndpoint(page,'Lowest note','C4');await setEndpoint(page,'Highest note','C4');
 assert.equal(await accept.isEnabled(),true);
 await content.getByRole('button',{name:'Lines',exact:true}).click();await content.getByRole('button',{name:'Spaces',exact:true}).click();
 assert.equal(await accept.isDisabled(),true,'empty pool cannot be accepted or saved');assert.equal(await dialog.getByRole('button',{name:'Save Preset',exact:true}).isDisabled(),true);
 await content.getByRole('button',{name:'Lines',exact:true}).click();
 const clefs=dialog.getByRole('group',{name:'Practice clefs',exact:true});await clefs.getByRole('button',{name:'Treble',exact:true}).click();
 assert.equal(await accept.isDisabled(),true);await clefs.getByRole('button',{name:'Bass',exact:true}).click();assert.equal(await accept.isEnabled(),true);
 await setEndpoint(page,'Highest note','G5');await setKey(page,'Bb');await setModifiers(page,['key','sharp','flat','natural']);
 await useRange(page);assert.match(await page.locator('#preset-summary').textContent(),/B♭ Major.*Bass clef/);
 await openCustom(page);assert.equal(await clefs.getByRole('button',{name:'Bass',exact:true}).getAttribute('aria-pressed'),'true');
 await dialog.getByRole('group',{name:'Key signature',exact:true}).getByRole('button',{name:'No Key',exact:true}).click();
 assert.equal(await dialog.getByRole('group',{name:'Accidentals',exact:true}).isVisible(),false);
 await useRange(page);assert.match(await page.locator('#preset-summary').textContent(),/No key signature/);
 assert.deepEqual(errors,[]);console.log(`${engine}: content/clef validation, single-note ranges, spelling modifiers and keyless conversion passed.`);
} finally {await browser.close();await host.close();}
