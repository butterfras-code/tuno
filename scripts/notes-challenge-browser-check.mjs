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
  assert.equal(await page.locator('.challenge-scene').isVisible(),true);
  assert.equal(await page.locator('.challenge-notation').isVisible(),false);
  assert.equal(await page.locator('.challenge-backdrop .staff').isVisible(),true);
  const bounds=()=>page.locator('.challenge-scene').evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height};});
  const frame=await bounds();
  const stableFrame=async()=>{const box=await bounds();for(const key of ['x','y','width','height']) assert.ok(Math.abs(box[key]-frame[key])<1,`Stable scene ${key}: ${box[key]} vs ${frame[key]}`);};
  const save=async(state)=>{await page.screenshot({path:`dist/validation/notes-challenge-${name}-${label}-${state}.png`,fullPage:true});};
  await save('ready');
  await button(page,'Ready').click();await page.clock.runFor(1050);assert.equal(await page.locator('.challenge-cue').textContent(),'2');
  assert.equal(await page.locator('.challenge-dog .uno').getAttribute('data-pose'),'wag');
  assert.equal(await page.locator('.challenge-dog .uno').evaluate(n=>getComputedStyle(n.querySelector('.uno-tail')).animationName),'uno-wag');
  const dog=await page.locator('.challenge-dog').boundingBox();assert.ok(Math.abs(dog.x+dog.width/2-frame.x-frame.width/2)<1);
  await stableFrame();await save('countdown');
  await page.keyboard.press('a');assert.match(await page.locator('#practice-counts').textContent(),/0 attempts/);
  await page.clock.runFor(2100);assert.equal(await page.locator('.staff-panel').isVisible(),true);
  // Read the rendered staff position, never a production answer/debug attribute.
  const answer=async()=>{
    const transform=await page.locator('.staff-panel .notehead').getAttribute('transform');
    const y=Number(/translate\([^ ]+ ([^)]+)\)/.exec(transform)[1]);
    const position=Math.round((140-y)/10);return 'CDEFGAB'[(4*7+2+position)%7].toLowerCase();
  };
  await page.keyboard.press(await answer());assert.match(await page.locator('#practice-counts').textContent(),/1 correct \/ 1 attempts/);
  assert.match(await page.locator('#challenge-stats').textContent(),/1 correct/);await stableFrame();await save('playing');
  await page.clock.runFor(15000);
  assert.equal(await page.locator('.scoreboard-value strong').textContent(),'1.00');
  assert.equal(await page.locator('#challenge-correct').textContent(),'1');assert.equal(await page.locator('#challenge-accuracy').textContent(),'100%');
  assert.equal(await page.locator('.round-details').evaluate(n=>n.open),false);
  assert.equal(await page.getByText('Qualified',{exact:true}).isVisible(),false);
  assert.doesNotMatch(await page.locator('#challenge-result').innerText(),/Rank 1|Player 1|Qualified|Active time/);
  await save('scoreboard');await stableFrame();
  await button(page,'Play again').click();assert.match(await page.locator('#practice-counts').textContent(),/0 attempts/);
  await button(page,'Ready').click();await page.clock.runFor(18050);assert.equal(await page.locator('.scoreboard-value strong').textContent(),'0.00');assert.match(await page.locator('.round-details').textContent(),/Unranked/);
  await button(page,'Change setup').click();await button(page,'Target').click();await page.getByLabel('Correct-note target').fill('1');await page.getByLabel('Timeout (seconds)').fill('15');
  await button(page,'Start Challenge').click();await button(page,'Ready').click();await page.clock.runFor(3050);await page.keyboard.press(await answer());
  assert.equal(await page.locator('.scoreboard-value span').textContent(),'seconds');assert.match(await page.locator('.round-details').textContent(),/Qualified/);
  assert.equal(await page.locator('#challenge-correct').textContent(),'1');
  await button(page,'Play again').click();await button(page,'Ready').click();await page.clock.runFor(3050);
  // Visibility loss pauses with explicit Resume, and completion stays unranked.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.match(await page.locator('#challenge-status').textContent(),/Paused/);assert.equal(await page.locator('.challenge-scene').isVisible(),true);await save('paused');await page.clock.runFor(20000);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});});
  await button(page,'Resume').click();await page.keyboard.press(await answer());assert.match(await page.locator('#challenge-result').textContent(),/pause[\s\S]*Unranked.*Interrupted/);
  await button(page,'Play again').click();await button(page,'Ready').click();await page.clock.runFor(18050);assert.match(await page.locator('#challenge-result').textContent(),/Nice practice.*0 of 1[\s\S]*Unranked/);
  await button(page,'Play again').click();await button(page,'Ready').click();await page.clock.runFor(3050);await button(page,'Finish').click();assert.match(await page.locator('#challenge-result').textContent(),/ended this round early[\s\S]*Unranked/);
  await button(page,'Change setup').click();await button(page,'Timed').click();await page.getByLabel('Duration (seconds)').fill('60');
  await button(page,'Start Challenge').click();await button(page,'Ready').click();await page.clock.runFor(3050);
  await page.evaluate(()=>{
    window.treatCatches=0;
    const dog=document.querySelector('.challenge-dog .uno');
    window.treatObserver=new MutationObserver(records=>{for(const record of records) if(record.attributeName==='data-pose' && dog.dataset.pose==='catch' && record.oldValue!=='catch')window.treatCatches++;});
    window.treatObserver.observe(dog,{attributes:true,attributeOldValue:true,attributeFilter:['data-pose']});
  });
  for(let i=0;i<61;i++){await page.keyboard.press(await answer());await page.clock.runFor(300);}
  assert.equal(await page.evaluate(()=>window.treatCatches),8);
  assert.equal(await page.locator('#challenge-treat-progress').textContent(),'7 more for a treat');
  const right=await answer();await page.keyboard.press(right==='a'?'b':'a');
  assert.equal(await page.locator('#challenge-treat-progress').textContent(),'6 more for a treat');
  assert.equal(await page.evaluate(()=>window.treatCatches),8);
  await page.evaluate(()=>window.treatObserver.disconnect());
  await page.clock.fastForward(60000);
  assert.equal(await page.locator('.scoreboard-value strong').textContent(),'60.02');
  assert.equal(await page.locator('#challenge-correct').textContent(),'61');assert.equal(await page.locator('#challenge-accuracy').textContent(),'98%');
  for(const width of [360,768,1280]) {await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`dist/validation/notes-challenge-${name}-${label}-${width}.png`,fullPage:true});
    await page.locator('.round-details summary').click();assert.equal(await page.getByText('Qualified',{exact:true}).isVisible(),true);await page.locator('.round-details summary').click();}
  await button(page,'Change setup').click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await button(page,'Start Challenge').click();await button(page,'Ready').click();
  assert.equal(await page.locator('.challenge-dog .uno-tail').evaluate(n=>getComputedStyle(n).animationName),'none');
  await page.clock.runFor(3100);await button(page,'Finish').click();await button(page,'Change setup').click();
  await page.emulateMedia({reducedMotion:'no-preference'});
  await notesMode(page,'Practice');assert.equal(await button(page,'Start Practice').isVisible(),true);assert.equal(await page.locator('.challenge-settings').isVisible(),false);
  assert.deepEqual(errors,[]);evidence.push(`${label}: rules validation, Ready/countdown gating, timed score, zero attempts, Target completion/timeout, visibility pause, partial run, retry, navigation, stable note area, centered wagging count-in, compact scoreboard/details, eight treats in a 61-correct run, mistake relief, reduced motion and responsive layout passed`);
}
try {
  await mkdir('dist/validation',{recursive:true});
  const page=await browser.newPage();await run(page,host.url+'notes/','hosted');await page.close();
  const file=join(temporary,'moved notes.html');await copyFile('dist/portable/tunotes.html',file);
  const offline=await browser.newContext({offline:true});await run(await offline.newPage(),pathToFileURL(file).href,'portable-offline');await offline.close();
  await writeFile(`dist/validation/notes-challenge-${name}.json`,JSON.stringify({browser:name,evidence},null,2));console.log(evidence.join('\n'));
} finally {await browser.close();await host.close();await rm(temporary,{recursive:true,force:true});}
