import assert from 'node:assert/strict';
import { hostBuild } from './test-host.mjs';
import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { openRange, openCustom, saveCustom, rangeDialog, notesMode, startPractice, configureMultiplayerNotes, openData } from './notes-setup-helpers.mjs';
const browser=await ({chromium,firefox})[process.env.TUNO_BROWSER || 'chromium'].launch(), host=await hostBuild();
await mkdir(`dist/validation/mobile-layout-${process.env.TUNO_BROWSER || 'chromium'}`,{recursive:true});
const findings=[], errors=[];
const b=(p,name)=>p.getByRole('button',{name,exact:true});
async function inspect(page,label) {
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 const result=await page.evaluate(()=>{
  const root=[...document.querySelectorAll('dialog[open]')].at(-1) || document.documentElement;
  const visible=n=>n.getClientRects().length&&!n.closest('[hidden]');
  const problems=[];
  for(const n of root.querySelectorAll('button,strong,h2,h3,h4,label,input,select')) {
   if(!visible(n))continue;
   const r=n.getBoundingClientRect();
   if(r.width<3||r.height<3)continue;
   // Rosters/keyboards scroll intentionally; ellipsis is explicit truncation.
   // Inputs scroll their value; label scrollWidth may include a child's focus outline.
   if(n.closest('.multiplayer-roster,.answer-scroll') || getComputedStyle(n).textOverflow==='ellipsis')continue;
   if(r.right>innerWidth+1||r.left< -1||(!n.matches('input,select,label')&&n.scrollWidth>n.clientWidth+2))problems.push({text:(n.getAttribute('aria-label')||n.textContent).slice(0,80),class:n.className,left:Math.round(r.left),right:Math.round(r.right),width:n.clientWidth,scroll:n.scrollWidth});
  }
  const full=document.querySelector('.notes-fullscreen:not([hidden])'), wordmark=document.querySelector('.wordmark');
  if(full&&wordmark&&getComputedStyle(wordmark.closest('.brand')).display!=='none'){const a=full.getBoundingClientRect(),b=wordmark.getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)problems.push({text:'Fullscreen overlaps wordmark'});}
  return {pageOverflow:document.documentElement.scrollWidth>innerWidth+1,dialogOverflow:root.tagName==='DIALOG'&&root.scrollWidth>root.clientWidth+1,problems};
 });
 if(result.pageOverflow||result.dialogOverflow||result.problems.length)findings.push({label,...result});
 if(process.env.TUNO_SCREENSHOTS || result.problems.length) await page.screenshot({path:`dist/validation/mobile-layout-${process.env.TUNO_BROWSER || 'chromium'}/${label}.png`,fullPage:true});
}
try{
for(const [width,height] of [[320,667],[360,800],[390,844],[600,800],[768,1024],[844,390]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:true});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(new URL('/notes/',host.url).href);
 const check=name=>inspect(page,`${width}-${name}`);
 await check('practice');await openRange(page);await check('chooser');
 await b(rangeDialog(page),'Clef').click();await check('clefs');await b(rangeDialog(page),'Treble').click();await check('presets');
 await b(page,'Close range selection').click();await openCustom(page);await check('custom');
 await rangeDialog(page).getByRole('group',{name:'Key signature'}).getByRole('button',{name:'Key',exact:true}).click();await check('key');
 await b(page,'Close key selection').click();await b(rangeDialog(page),'Save Preset').click();await check('save');await b(page.getByRole('dialog',{name:'Save Preset',exact:true}),'Cancel').click();
 await saveCustom(page,'W'.repeat(80));await openRange(page);await check('chooser-saved');
 await b(rangeDialog(page),'My Presets').click();await check('my-presets');await b(page,'Close range selection').click();
 await openRange(page);await b(rangeDialog(page),'Band instruments').click();await check('band');await b(rangeDialog(page),'Flute').click();await check('flute');await rangeDialog(page).locator('[data-preset-id="flute-starter"]').click();await check('adaptive');await b(page,'Close range selection').click();
 await notesMode(page,'Challenge');await check('challenge');await b(page,'Start Challenge').click();await check('challenge-ready');await b(page,'Ready').click();await page.waitForTimeout(3200);await b(page,'Finish').click();await check('challenge-results');
 await notesMode(page,'Practice');await startPractice(page);await check('practice-playing');await b(page,'Finish').click();await check('practice-results');
 await notesMode(page,'Multi Player');await check('multiplayer');await b(page,'Add player').click();await page.getByRole('dialog').getByRole('textbox').fill('W'.repeat(40));await check('player-editor');await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();await check('multiplayer-two');
 await page.getByRole('tab',{name:'Play Style',exact:true}).click();await check('styles');await configureMultiplayerNotes(page);await b(page,'Start round').click();await check('style-dialog');await b(page,'Cancel').click();
 await openRange(page);await check('chooser-players');await b(rangeDialog(page),'Copy from player').click();await check('copy-player');await b(page,'Close range selection').click();
 await b(page,'Start round').click();await b(page,'Continue to round').click();await b(page,'End round').click();await check('multiplayer-results');
 await openData(page);await check('options-data');await b(page,'Add profile').click();await page.getByLabel('Profile name',{exact:true}).fill('Mobile reader');await check('profile');
 await page.locator('.profile-card .preset-picker > button').click();await check('profile-presets');await b(page.locator('dialog[open]'),'Close').click();
 const toggles=await page.locator('.display-settings > .setting,.keyboard-guidance-settings > .setting').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,input:n.querySelector('input').getBoundingClientRect().width})));
 assert.ok(toggles.every(n=>n.height>=44&&n.input>=24),'option labels remain usable touch targets');
 if(width===360) {
  await notesMode(page,'Practice');await b(page,'Edit setup').click();await openRange(page);
  await b(rangeDialog(page),'Clef').click();
  for(const clef of ['Treble','Bass','Alto','Tenor']) {await b(rangeDialog(page),clef).click();await check(`clef-${clef}`);await b(rangeDialog(page),'Back to clefs').click();}
  await b(page,'Back to range options').click();await b(rangeDialog(page),'Band instruments').click();
  for(const ensemble of ['Band','Orchestra']) {
   await b(rangeDialog(page),ensemble).click();
   const names=await rangeDialog(page).locator('.range-picker-instruments button').allTextContents();
   for(const [index,name] of names.entries()) {await b(rangeDialog(page),name).click();await check(`${ensemble}-${index}`);await b(rangeDialog(page),'Back to instruments').click();}
  }
  await b(page,'Close range selection').click();
 }
 await page.close();console.log(width,'audited');
}
}finally{await browser.close();await host.close();await writeFile(`dist/validation/mobile-layout-${process.env.TUNO_BROWSER || 'chromium'}/findings.json`,JSON.stringify(findings,null,2));}
assert.deepEqual(errors,[],'mobile interactions must not throw');
assert.deepEqual(findings,[],'mobile controls and chooser text must fit horizontally');
console.log('tuNotes mobile setup, chooser, options and result layouts passed.');
