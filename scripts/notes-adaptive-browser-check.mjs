import { notesMode, openData, setToggle, setPacing } from './notes-setup-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir, readFile, writeFile, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostBuild } from './test-host.mjs';
import { choosePreset } from './notes-setup-helpers.mjs';
import { presets, fingerprint } from '../src/apps/tunotes/domain/presets.ts';
import { pitchLabel } from '../src/apps/tunotes/domain/notation.ts';
import { emptySnapshot } from '../src/apps/tunotes/persistence/store.ts';
const name=process.env.TUNO_BROWSER||'chromium', browser=await ({chromium,firefox})[name].launch();
const host=await hostBuild(), temporary=await mkdtemp(join(tmpdir(),'tunotes phase3 '));
const results=[],errors=[];
const button=(page,name)=>page.getByRole('button',{name,exact:true}).first();
const readData=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('tunotes:data:v1')));
async function previewLabels(page) {
  const previous=button(page,'Previous'),next=button(page,'Next');
  while(await previous.isVisible() && await previous.isEnabled()) await previous.click();
  const labels=[];
  do {
    assert.equal(await page.locator('.preview-staff').count(),1);
    assert.equal(await page.locator('.preview-staff .notehead').count(),1);
    assert.equal(await page.locator('figure.preview-note').count(),0);
    labels.push(...await page.locator('.preview-note-label').allTextContents());
    if(!await next.isVisible() || !await next.isEnabled()) break;
    await next.click();
  } while(true);
  while(await previous.isVisible() && await previous.isEnabled()) await previous.click();
  return labels;
}
async function run(page,url,mode) {
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message)); await page.goto(url);
  await page.clock.install();
  assert.equal((await page.locator('#adaptive').getAttribute('aria-pressed') === 'true'),false);
  assert.equal((await page.locator('#meet-notes').getAttribute('aria-pressed') === 'true'),true);
  await openData(page);
  await button(page,'Add profile').click(); await page.getByLabel('Profile name',{exact:true}).fill('Reader'); await page.getByLabel('Profile name',{exact:true}).press('Enter');
  await setToggle(page,'adaptive',true); await setPacing(page,'Click/Tap');
  await button(page,'Start Practice').click();
  assert.equal(await page.locator('.note-preview').isVisible(),true);
  assert.equal(await button(page,'Start Practice').isDisabled(),true);
  assert.equal(await button(page,'Skip').isVisible(),true);
  assert.equal(await button(page,'Replay').isVisible(),false);
  assert.equal(await page.locator('.preview-staff .notehead').count(),1);
  assert.equal(await page.locator('.note-preview .uno-tail').evaluate(n=>getComputedStyle(n).animationName),'none');
  const frames=await page.locator('.preview-toy').evaluate(n=>n.getAnimations()[0].effect.getKeyframes().map(f=>f.transform));
  assert.match(frames[0],/^translate\([0-9]/); assert.match(frames[2],/^translate\(-/);
  assert.match(frames[4],/^translate\(0/); assert.match(frames.at(-1),/^translate\([0-9]/);
  assert.match(frames[3],/-105px/);
  await page.clock.runFor(750);
  assert.equal(await page.locator('.preview-note.revealed').count(),1);
  assert.equal(await page.locator('.preview-note-label').textContent(),'E');
  assert.equal(await page.locator('.preview-note-status').textContent(),'1 of 9');
  await page.clock.runFor(1500);
  assert.equal(await page.locator('.preview-note-label').textContent(),'F');
  await page.keyboard.press('a'); await page.clock.runFor(15000);
  assert.equal(await page.locator('.note-preview .uno-tail').evaluate(n=>getComputedStyle(n).animationName),'uno-wag');
  assert.equal(await button(page,'Start Practice').isEnabled(),true);
  assert.equal(await button(page,'Skip').isVisible(),false);
  assert.equal(await button(page,'Replay').isVisible(),true);
  assert.equal(await page.locator('.note-preview .uno').getAttribute('data-pose'),'happy');
  assert.equal((await previewLabels(page)).length,9);
  assert.equal(await page.locator('.preview-staff').count(),1);
  assert.equal(await page.locator('#practice-counts').isVisible(),false);
  let data=await readData(page);assert.deepEqual(data.profiles[0].contexts,[]);assert.deepEqual(data.profiles[0].results,[]);
  for(const width of [360,768,1280]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const staff=await page.locator('.preview-staff').boundingBox(), dog=await page.locator('.note-preview .uno').boundingBox(), head=await page.locator('.preview-staff .notehead').boundingBox();
    assert.ok(dog.x >= staff.x+staff.width); assert.ok(Math.abs(head.x+head.width/2-staff.x-staff.width/2)<1);
    const previous=await button(page,'Previous').boundingBox(), next=await button(page,'Next').boundingBox();
    assert.equal(previous.y,next.y);
    await page.screenshot({path:`dist/validation/notes-adaptive-${name}-${mode}-${width}.png`,fullPage:true});
  }
  await page.evaluate(()=>{document.documentElement.style.zoom='2';});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>{document.documentElement.style.zoom='';});
  await button(page,'Replay').click();
  assert.equal(await page.locator('.note-preview .uno-tail').evaluate(n=>getComputedStyle(n).animationName),'none');
  await page.clock.runFor(3000);
  assert.equal(await button(page,'Skip').isVisible(),true);
  await button(page,'Skip').click();
  await page.clock.runFor(100);
  await page.keyboard.press('a');
  await button(page,'Finish').click();
  data=await readData(page);
  const first=data.profiles[0].results[0];assert.equal(first.attempts,1);assert.ok(first.activeMs<1000);
  assert.deepEqual(first.preview,{shown:true,skipped:true,completed:true});
  await page.clock.runFor(20000); assert.equal(await page.locator('.note-preview').count(),0);
  assert.match(await page.locator('#result-summary').textContent(),/1 attempts/);
  await button(page,'Edit setup').click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await choosePreset(page,'trombone-two-octaves'); await setToggle(page,'meet-notes',true);
  await button(page,'Start Practice').click();
  const labels=await previewLabels(page); assert.equal(labels.length,15);
  assert.equal(labels[0],'E♭'); assert.equal(labels.at(-1),'E♭');
  assert.equal(await page.locator('.preview-note-status').textContent(),'1 of 15');
  assert.equal(await page.locator('.preview-navigation').evaluate(n=>n.parentElement.className),'preview-staff-viewport');
  assert.equal(await page.locator('.note-preview').evaluate(n=>n.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
  await button(page,'Replay').click();await button(page,'Start Practice').click();
  assert.equal(await page.locator('.practice-stage .staff').count(),1);
  assert.equal(await page.locator('.preview-note').count(),0);
  await page.keyboard.down('ArrowDown');await page.keyboard.press('b');await page.keyboard.up('ArrowDown');await button(page,'Finish').click();
  data=await readData(page);assert.deepEqual(data.profiles[0].results.at(-1).preview,{shown:true,skipped:false,completed:true});
  await button(page,'Edit setup').click();await setToggle(page,'meet-notes',false);
  await page.reload();assert.equal((await page.locator('#meet-notes').getAttribute('aria-pressed') === 'true'),false);assert.equal((await page.locator('#adaptive').getAttribute('aria-pressed') === 'true'),true);
  await openData(page);await button(page,'Add profile').click();await page.getByLabel('Profile name',{exact:true}).fill('Second');await page.getByLabel('Profile name',{exact:true}).press('Enter');
  assert.equal((await page.locator('#adaptive').getAttribute('aria-pressed') === 'true'),false);assert.equal((await page.locator('#meet-notes').getAttribute('aria-pressed') === 'true'),false);
  await setToggle(page,'remember-progress',false);await setToggle(page,'meet-notes',true);await page.reload();
  assert.equal((await page.locator('#meet-notes').getAttribute('aria-pressed') === 'true'),false); // Guest choice was memory-only.
  await setToggle(page,'adaptive',true); await setToggle(page,'meet-notes',false);
  await openData(page); page.once('dialog',dialog=>dialog.accept());
  await button(page,'Delete all tuNotes data').click();
  assert.equal((await page.locator('#adaptive').getAttribute('aria-pressed') === 'true'),false);assert.equal((await page.locator('#meet-notes').getAttribute('aria-pressed') === 'true'),true);
  results.push(`${mode}: preview completion/catch, Replay/Skip, no automatic play or observations, keyboard isolation, exposure and timing, 360/768/1280 and 200% zoom, reduced motion, one centered note, right-side Uno, edge wrap, tail waiting until catch, altered labels/review, profile preferences and Guest memory passed`);
}
async function expansion(page) {
  page.setDefaultTimeout(10000);
  const p=presets.find(p=>p.id==='keyboards-starter');
  const data=emptySnapshot();data.configuration={remember:true,profileId:'learner',presetId:p.id,selfPaced:true};
  const notes=Object.fromEntries(p.pool.map(pitch=>[pitchLabel(pitch),Array.from({length:5},()=>({pitch,answer:{letter:pitch.letter,accidental:pitch.accidental},correct:true,responseMs:500000,activity:'practice',preset:p.id}))]));
  data.profiles=[{id:'learner',name:'Learner',adaptive:true,preview:false,defaultPresetId:p.id,results:[],contexts:[{fingerprint:fingerprint(p,true),version:1,updated:1,notes,learning:{algorithmVersion:1,expansionCount:0}}]}];
  await page.addInitScript(data=>localStorage.setItem('tunotes:data:v1',JSON.stringify(data)),data);await page.goto(new URL('/notes/', host.url).href);
  await page.clock.install(); await button(page,'Start Practice').click();
  const before=await page.locator('.answer').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
  const expected=async()=>{
    const label=await page.locator('.staff').getAttribute('aria-label');
    if(label.includes('below')) return label.includes('2 half')?'c':'d';
    const positions=['first line','first space','second line','second space','third line','third space','fourth line','fourth space','fifth line'];
    return 'efgabcdef'[positions.findIndex(v=>label.includes(v))];
  };
  for(let i=0;i<20;i++) {await page.keyboard.press(await expected());if(i<19)await button(page,'Continue').click();}
  assert.equal(await page.locator('#expansion-announcement').textContent(),'New Note! Uno added a lower B!');
  assert.equal(await page.locator('.answer-added').count(),1);
  assert.equal(await page.locator('.answer-added').getAttribute('data-letter'),'B');
  const after=await page.locator('.answer').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
  // The announcement may move the answer block vertically, but every target keeps its relative geometry.
  assert.equal(after.length,before.length);
  after.forEach((n,i)=> {
    assert.ok(Math.abs(n.x-before[i].x)<0.01,'Answer target keeps its horizontal position');
    assert.ok(Math.abs((n.y-after[0].y)-(before[i].y-before[0].y))<0.01,'Answer target keeps its relative row position');
  });
  await button(page,'Finish').click(); await button(page,'Edit setup').click();await setToggle(page,'meet-notes',true);
  await page.emulateMedia({reducedMotion:'reduce'});await button(page,'Start Practice').click();
  const restored=await previewLabels(page); assert.equal(restored.length,6);assert.equal(restored[0],'B');
  await button(page,'Start Practice').click();await button(page,'Finish').click();await button(page,'Edit setup').click();await setToggle(page,'adaptive',false);await button(page,'Start Practice').click();
  assert.equal((await previewLabels(page)).length,5);
  results.push('Seeded mastered profile: 20-answer gate at arbitrarily slow recorded latencies, lower expansion announcement, in-place B activation, restored preview growth and adaptive-off original pool passed');
}
try {
  await mkdir('dist/validation',{recursive:true});
  const hosted=await browser.newPage();await run(hosted,new URL('/notes/', host.url).href,'hosted');await hosted.close();
  const file=join(temporary,'moved notes.html');await copyFile('dist/portable/tunotes.html',file);
  const offline=await browser.newContext({offline:true});const portable=await offline.newPage();await run(portable,pathToFileURL(file).href,'portable-offline');await offline.close();
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await expansion(page);await page.close();
  assert.deepEqual(errors,[]);
  const release=JSON.parse(await readFile('dist/release.json','utf8'));
  await writeFile(`dist/validation/notes-adaptive-${name}.json`,JSON.stringify({build:release.apps.tunotes.build,browser:browser.version(),results},null,2));console.log(results.join('\n'));
} finally {await browser.close();await host.close();await rm(temporary,{recursive:true,force:true});}
