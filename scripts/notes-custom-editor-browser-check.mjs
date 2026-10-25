import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { openCustom, rangeDialog, setEndpoint, setKey, setModifiers, saveCustom, useRange, openRange } from './notes-setup-helpers.mjs';
const engine=process.env.TUNO_BROWSER || 'chromium';
const browser=await ({chromium,firefox})[engine].launch(),host=await hostBuild();
try {
 for(const [width,height] of [[320,667],[390,844],[768,1024],[1366,768],[844,390]]) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/notes/',host.url).href);const initial=await page.locator('#preset-summary').textContent();
  await openCustom(page);await setEndpoint(page,'Lowest note','D4');await setEndpoint(page,'Highest note','G5');await setKey(page,'G');await setModifiers(page,['key','flat']);
  assert.equal(await rangeDialog(page).getByRole('button',{name:'Accept',exact:true}).isEnabled(),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#preset-summary').textContent(),initial,'cancel preserves current range');
  await openCustom(page);await setEndpoint(page,'Lowest note','D4');await setEndpoint(page,'Highest note','G5');await setKey(page,'G');await setModifiers(page,['key','flat']);
  await saveCustom(page,'Reader range');assert.match(await page.locator('#preset-summary').textContent(),/G Major.*D4–G5.*flats/);
  await page.reload();await openCustom(page);
  assert.match(await rangeDialog(page).getByRole('slider',{name:'Lowest note',exact:true}).getAttribute('aria-valuetext'),/D4/);
  assert.equal(await rangeDialog(page).getByRole('group',{name:'Additional spellings',exact:true}).getByRole('button',{name:'Flat',exact:true}).getAttribute('aria-pressed'),'true');
  await useRange(page);await openRange(page);await rangeDialog(page).getByRole('button',{name:'My Presets',exact:true}).click();
  assert.equal(await rangeDialog(page).getByRole('button',{name:/Reader range/}).count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(`${engine}: Custom draft cancellation, named saving, reload, retained settings and small-screen editing passed.`);
} finally {await browser.close();await host.close();}
