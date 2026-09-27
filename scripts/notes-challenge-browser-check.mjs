import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir, mkdtemp, copyFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostBuild } from './test-host.mjs';
import { notesMode } from './notes-setup-helpers.mjs';
const name=process.env.TUNO_BROWSER || 'chromium';
const browser=await ({chromium,firefox})[name].launch(), host=await hostBuild();
const temporary=await mkdtemp(join(tmpdir(),'notes-challenge-'));
const evidence=[];
const button=(p,name)=>p.getByRole('button',{name,exact:true});
async function run(page,url,label) {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(url);
  await notesMode(page,'Challenge');
  assert.equal(await page.locator('.challenge-settings').isVisible(),true);
  assert.equal(await button(page,'Show Intro').isVisible(),false);
  await page.getByLabel('Duration (seconds)').fill('14');await button(page,'Start Challenge').click();assert.match(await page.getByRole('alert').textContent(),/15 to 300/);
  await page.getByLabel('Duration (seconds)').fill('15');await button(page,'Start Challenge').click();
  assert.match(await page.locator('#challenge-status').textContent(),/Ready/);
  await page.keyboard.press('a');assert.match(await page.locator('#practice-counts').textContent(),/0 attempts/);
  assert.equal(await page.locator('.staff-panel').isVisible(),false);
  await button(page,'Ready').click();await page.clock.runFor(1050);assert.match(await page.locator('#challenge-status').textContent(),/Starting in 2/);
  await page.keyboard.press('a');assert.match(await page.locator('#practice-counts').textContent(),/0 attempts/);
  await page.clock.runFor(2100);assert.equal(await page.locator('.staff-panel').isVisible(),true);
  // Read the rendered staff position, never a production answer/debug attribute.
  const answer=async()=>{
    const transform=await page.locator('.staff-panel .notehead').getAttribute('transform');
    const y=Number(/translate\([^ ]+ ([^)]+)\)/.exec(transform)[1]);
    const position=Math.round((140-y)/10);return 'CDEFGAB'[(4*7+2+position)%7].toLowerCase();
  };
  await page.keyboard.press(await answer());assert.match(await page.locator('#practice-counts').textContent(),/1 correct \/ 1 attempts/);
  assert.match(await page.locator('#challenge-status').textContent(),/Score 1.00/);
  await page.clock.runFor(15000);
  assert.match(await page.locator('#challenge-result').textContent(),/Rank 1 · Qualified · Score 1.00/);
  await button(page,'Retry').click();assert.match(await page.locator('#practice-counts').textContent(),/0 attempts/);
  await button(page,'Ready').click();await page.clock.runFor(18050);assert.match(await page.locator('#challenge-result').textContent(),/Unranked · Score 0.00/);
  await button(page,'Edit setup').click();await button(page,'Target').click();await page.getByLabel('Correct-note target').fill('1');await page.getByLabel('Timeout (seconds)').fill('15');
  await button(page,'Start Challenge').click();await button(page,'Ready').click();await page.clock.runFor(3050);await page.keyboard.press(await answer());
  assert.match(await page.locator('#challenge-result').textContent(),/Rank 1 · Qualified · Time/);
  assert.match(await page.locator('#result-summary').textContent(),/1 correct \/ 1 attempts/);
  await button(page,'Retry').click();await button(page,'Ready').click();await page.clock.runFor(3050);
  // Visibility loss pauses with explicit Resume, and completion stays unranked.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.match(await page.locator('#challenge-status').textContent(),/Paused/);await page.clock.runFor(20000);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});});
  await button(page,'Resume').click();await page.keyboard.press(await answer());assert.match(await page.locator('#challenge-result').textContent(),/Unranked.*Interrupted run/);
  await button(page,'Retry').click();await button(page,'Ready').click();await page.clock.runFor(18050);assert.match(await page.locator('#challenge-result').textContent(),/Unranked.*0\/1 correct.*Nice practice/);
  await button(page,'Retry').click();await button(page,'Ready').click();await page.clock.runFor(3050);await button(page,'Finish').click();assert.match(await page.locator('#challenge-result').textContent(),/Unranked.*ended early/);
  await button(page,'Edit setup').click();
  for(const width of [360,768,1280]) {await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`dist/validation/notes-challenge-${name}-${label}-${width}.png`,fullPage:true});}
  await notesMode(page,'Practice');assert.equal(await button(page,'Start Practice').isVisible(),true);assert.equal(await page.locator('.challenge-settings').isVisible(),false);
  assert.deepEqual(errors,[]);evidence.push(`${label}: rules validation, Ready/countdown gating, timed score, zero attempts, Target completion/timeout, visibility pause, partial run, retry, navigation and responsive layout passed`);
}
try {
  await mkdir('dist/validation',{recursive:true});
  const page=await browser.newPage();await run(page,host.url+'notes/','hosted');await page.close();
  const file=join(temporary,'moved notes.html');await copyFile('dist/portable/tunotes.html',file);
  const offline=await browser.newContext({offline:true});await run(await offline.newPage(),pathToFileURL(file).href,'portable-offline');await offline.close();
  await writeFile(`dist/validation/notes-challenge-${name}.json`,JSON.stringify({browser:name,evidence},null,2));console.log(evidence.join('\n'));
} finally {await browser.close();await host.close();await rm(temporary,{recursive:true,force:true});}
