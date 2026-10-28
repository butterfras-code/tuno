// Historical before/after layout audit. See browser-checks.mjs for current replacements.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
const before = process.argv.includes('--before');
const output = `${process.env.TUNO_UI_ARTIFACTS || '/tmp/tuno-ui-refinements'}/${before ? 'before' : 'after'}`;
await mkdir(output,{recursive:true});
const host = await hostBuild(), browser = await chromium.launch();
try {
 for (const [width,height] of [[360,800],[390,844],[768,1024],[1024,768],[1366,768],[1920,1080]]) {
  const page = await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  const shot = async name => { await page.screenshot({path:`${output}/${width}-${name}.png`,fullPage:true}); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${name} overflow`); };
  await page.goto(new URL('/notes/',host.url).href);
  await page.getByRole('tab',{name:'Practice settings',exact:true}).click(); await shot('notes-settings');
  await page.getByRole('button',{name:'Start Practice',exact:true}).click();
  if (await page.locator('.note-preview').isVisible()) await page.getByRole('button',{name:'Start Practice',exact:true}).click();
  await page.waitForTimeout(150); await shot('notes-playing');
  if (!before) {
   const ghosts = await page.locator('.answer-unavailable:visible').evaluateAll(nodes => nodes.map(node => { const s=getComputedStyle(node); return {background:s.backgroundColor, border:s.borderTopColor, disabled:node.getAttribute('aria-disabled')}; }));
   assert.ok(ghosts.length);
   for (const ghost of ghosts) { assert.equal(ghost.background,'rgba(0, 0, 0, 0)'); assert.equal(ghost.border,'rgba(0, 0, 0, 0)'); assert.equal(ghost.disabled,'false'); }
   const geometry = () => page.locator('.answer:visible').evaluateAll(nodes => nodes.map(n=>{const b=n.getBoundingClientRect();return [b.x,b.y,b.width,b.height]}));
   const positions = await geometry();
   await page.getByRole('button',{name:'C♯',exact:true}).first().click();
   assert.deepEqual(await geometry(),positions,'Answer map remains stable after a guess');
   if (width >= 1024) assert.ok((await page.locator('.practice-companion .uno').boundingBox()).width >= 210,'Uno fills his reserved region');
  }
  await page.goto(new URL('/prototypes/rhythm-walk/',host.url).href); await shot('rhythm-setup');
  await page.getByRole('button',{name:'New exercise',exact:true}).first().click(); await shot('rhythm-input');
  if (!before) {
   assert.equal(await page.locator('#practice-view').getAttribute('data-phase'),'input');
   const check = await page.getByRole('button',{name:'Check',exact:true}).boundingBox();
   const palette = await page.locator('.count-palette-host').boundingBox();
   assert.ok(check.y >= palette.y && check.y <= palette.y+palette.height+20,'Check stays beside palette');
   assert.ok(Math.abs(check.x-palette.x)<20,'Check is not stranded on the far side');
   const beforeEntry = await page.locator('.plan-token-palette button').first().boundingBox();
   await page.locator('.plan-token-palette button').first().click();
   assert.deepEqual(await page.locator('.plan-token-palette button').first().boundingBox(),beforeEntry);
   assert.equal(await page.locator('#practice-view').getAttribute('data-phase'),'input');
  }
  await page.getByRole('button',{name:'Check',exact:true}).click(); await shot('rhythm-review');
  if (!before) assert.equal(await page.locator('#practice-view').getAttribute('data-phase'),'review');
  await page.getByRole('button',{name:'Perform',exact:true}).click(); await shot('rhythm-pad');
  if (!before) {
   const pad = await page.getByRole('button',{name:'Performance pad',exact:true}).boundingBox(), stop = await page.getByRole('button',{name:'Stop',exact:true}).boundingBox();
   assert.ok(stop.y>=pad.y+pad.height,'Session controls outside pad');
   await page.getByRole('button',{name:'Calibrate',exact:true}).click();
   await page.getByRole('button',{name:'Close timing setup',exact:true}).click();
   assert.equal(await page.locator('.pad-action').textContent(),'Tap to start');
   await page.getByRole('link',{name:'Settings',exact:true}).click();
   assert.equal(await page.getByText('Future options',{exact:true}).count(),0);
   await shot('rhythm-settings');
   // CSS zoom exercises enlarged text/controls; true browser zoom also changes
   // the CSS viewport, covered separately by the narrow viewport matrix.
   if (width >= 1024) {
   await page.evaluate(()=>document.documentElement.style.zoom='2');
   await shot('rhythm-settings-200percent');
   await page.getByRole('button',{name:'New exercise',exact:true}).click();
   await shot('rhythm-200percent');
   }
  }
  await page.close();
 }
 console.log(`${before?'Before':'After'}: six viewport screenshots captured without horizontal overflow.`);
} finally { await browser.close(); await host.close(); }
