import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { notesMode, openRange, rangeDialog } from './notes-setup-helpers.mjs';
const engine=process.env.TUNO_BROWSER || 'chromium';
const browser=await ({chromium,firefox})[engine].launch(),host=await hostBuild();
try {
 for(const activity of ['Practice','Challenge','Multi Player']) for(const [width,height] of [[320,667],[768,1024],[1366,768],[844,390]]) {
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('/notes/',host.url).href);await notesMode(page,activity);
  const summary=page.locator('.preset-summary:visible'),initial=await summary.textContent();
  await openRange(page);const dialog=rangeDialog(page);
  await dialog.getByRole('button',{name:'Clef',exact:true}).click();await dialog.getByRole('button',{name:'Bass',exact:true}).click();
  assert.ok(await dialog.locator('.range-picker-presets svg').count()>0);
  const r=await dialog.boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1);
  await dialog.locator('[data-preset-id="bass-spaces"]').click();await page.keyboard.press('Escape');assert.equal(await summary.textContent(),initial,'unaccepted choice does not mutate setup');
  await openRange(page);await dialog.getByRole('button',{name:'Clef',exact:true}).click();await dialog.getByRole('button',{name:'Bass',exact:true}).click();
  await dialog.locator('[data-preset-id="bass-spaces"]').click();await dialog.getByRole('button',{name:'Keep this range',exact:true}).click();
  assert.match(await summary.textContent(),/Spaces.*Bass clef/);assert.equal(await page.locator('.preset-preview:visible .notehead').count(),2);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(`${engine}: illustrated preset cards, modal bounds, cancel/accept and overview in all activities passed.`);
} finally {await browser.close();await host.close();}
