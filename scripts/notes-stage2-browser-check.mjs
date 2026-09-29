import { notesMode, openData, setToggle, setPacing } from './notes-setup-helpers.mjs';
import { choosePreset, setEndpoint, setModifiers, setKey, useRange, customTab, saveCustom } from './notes-setup-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { hostBuild } from './test-host.mjs';
const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({chromium,firefox})[name].launch(); const host = await hostBuild();
const results = []; const errors = [];
const upload = async (page,data) => { await openData(page); return page.locator('#import-backup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))}); };
const expandData = openData;
async function custom(page, {clef='treble',low='F4',high='F#4',key='G',policy='key-only'} = {}) {
  await choosePreset(page,'custom');
  await setEndpoint(page,'Lowest note',low); await setEndpoint(page,'Highest note',high);
  await setKey(page,key);
  await setModifiers(page,['key']);
}
try {
  await mkdir('dist/validation',{recursive:true});
  const context = await browser.newContext(); const page = await context.newPage(); page.on('pageerror',e => errors.push(e.message));
  await page.goto(new URL('/notes/', host.url).href); await page.evaluate(() => localStorage.setItem('tuno-preferences','preserve'));
  await custom(page); assert.match(await page.locator('#preset-summary').textContent(),/F♯4/);
  await useRange(page); await setPacing(page,'Click/Tap'); await setToggle(page,'meet-notes',false); await page.getByRole('button',{name:'Start Practice',exact:true}).first().click();
  assert.equal(await page.locator('.key-accidental:visible').count(),1); assert.equal(await page.locator('.note-accidental:visible').count(),0);
  assert.ok(!(await page.locator('.staff').getAttribute('aria-label')).includes('F♯'));
  assert.equal(await page.locator('.answer').count(),18);
  assert.equal(await page.getByRole('button',{name:'F',exact:true}).first().getAttribute('aria-disabled'),'false');
  await page.keyboard.down('ArrowUp'); await page.keyboard.press('f'); await page.keyboard.up('ArrowUp'); assert.match(await page.locator('#practice-counts').textContent(),/1 correct \/ 1 attempts/);
  await page.getByRole('button',{name:'Continue',exact:true}).first().click();
  await page.getByRole('button',{name:'F♯',exact:true}).first().focus(); await page.keyboard.press('Enter'); assert.match(await page.locator('#practice-counts').textContent(),/2 correct \/ 2 attempts/);
  await page.getByRole('button',{name:'Continue',exact:true}).first().click();
  assert.equal(await page.getByRole('button',{name:'F♭',exact:true}).count(),0); assert.match(await page.locator('#practice-counts').textContent(),/2 attempts/);
  await page.getByRole('button',{name:'Finish',exact:true}).first().click(); await page.getByRole('button',{name:'Home',exact:true}).first().click();
  await setKey(page,'F'); assert.match(await page.locator('#preset-summary').textContent(),/F4–F4/);
  await setEndpoint(page,'Lowest note','C4'); await setEndpoint(page,'Highest note','C4');
  assert.equal(await page.getByRole('button',{name:'Use range',exact:true}).isEnabled(),true);
  await customTab(page,'Options'); await page.getByRole('group',{name:'Staff content',exact:true}).getByRole('button',{name:'Spaces',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Use range',exact:true}).isDisabled(),true); assert.match(await page.locator('#preset-summary').textContent(),/No notes match/);
  await customTab(page,'Options'); await page.getByRole('group',{name:'Staff content',exact:true}).getByRole('button',{name:'Both',exact:true}).click();
  await saveCustom(page,'Middle C');
  results.push('Custom live spelling/key preview, empty-pool rejection, saved Custom, fixed spelling targets, answerable out-of-pool spellings, explicit sharp keyboard answer and focused Enter submission');
  await expandData(page); await page.getByRole('button',{name:'Add profile',exact:true}).first().click(); await page.getByLabel('Profile name',{exact:true}).fill('<Student>'); await page.getByLabel('Profile name',{exact:true}).press('Enter');
  await setToggle(page,'meet-notes',false); await page.getByRole('button',{name:'Start Practice',exact:true}).first().click();
  for(let i=0;i<20;i++) { await page.getByRole('button',{name:'C',exact:true}).first().click(); if(i<19) await page.getByRole('button',{name:'Continue',exact:true}).first().click(); }
  await page.getByRole('button',{name:'Finish',exact:true}).first().click(); await page.getByRole('button',{name:'Home',exact:true}).first().click();
  assert.match(await page.locator('#profile-history').textContent(),/1 recent sessions · 20 correct/);
  await page.reload(); await expandData(page); assert.match(await page.locator('#profile option:checked').textContent(),/<Student>/); assert.match(await page.locator('#profile-history').textContent(),/20 correct/);
  assert.equal(await page.locator('student').count(),0); assert.equal(await page.getByRole('button',{name:'Start Practice',exact:true}).first().isVisible(),false);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button',{name:'Export backup',exact:true}).first().click(); const download = await downloadPromise; const backup = await readFile(await download.path(),'utf8');
  await upload(page,'{'); assert.equal(await page.getByRole('button',{name:'Replace tuNotes data',exact:true}).first().isVisible(),false);
  const future = {...JSON.parse(backup),schemaVersion:99}; await upload(page,future); await page.waitForFunction(() => document.querySelector('#import-preview').textContent.includes('newer'));
  assert.match(await page.locator('#profile-history').textContent(),/20 correct/);
  await upload(page,backup); await page.getByRole('button',{name:'Replace tuNotes data',exact:true}).first().waitFor();
  assert.match(await page.locator('#import-preview').textContent(),/1 profiles, 2 custom presets, 1 results/);
  await page.getByRole('button',{name:'Replace tuNotes data',exact:true}).first().click();
  await setToggle(page,'remember-progress',false); await setToggle(page,'meet-notes',false); await page.getByRole('button',{name:'Start Practice',exact:true}).first().click(); await page.getByRole('button',{name:'C',exact:true}).first().click(); await page.getByRole('button',{name:'Finish',exact:true}).first().click(); await page.getByRole('button',{name:'Home',exact:true}).first().click(); await setToggle(page,'remember-progress',true);
  assert.match(await page.locator('#profile-history').textContent(),/1 recent sessions · 20 correct/);
  assert.equal(await page.evaluate(() => localStorage.getItem('tuno-preferences')),'preserve');
  results.push('Profile names render as text; progress/configuration survive reload into setup; export, previewed replacement, malformed/future-schema rejection, Guest isolation and tUno preferences preserved');
  for(const width of [360,768,1280]) { await page.setViewportSize({width,height:900}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true); await page.screenshot({path:`dist/validation/notes-stage2-${name}-${width}.png`,fullPage:true}); }
  await page.setViewportSize({width:640,height:900}); await page.evaluate(() => { document.documentElement.style.zoom='2'; }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true); await page.evaluate(() => { document.documentElement.style.zoom=''; });
  const portable = await browser.newContext({offline:true}); const file = await portable.newPage(); file.on('pageerror',e => errors.push(e.message)); const requests=[]; file.on('request',r => {if(/^https?:/.test(r.url())) requests.push(r.url());});
  await file.goto(pathToFileURL(resolve('dist/portable/tunotes.html')).href); await expandData(file); await upload(file,backup); await file.getByRole('button',{name:'Replace tuNotes data',exact:true}).first().click(); assert.match(await file.locator('#profile-history').textContent(),/20 correct/); assert.deepEqual(requests,[]);
  const portableDownload = file.waitForEvent('download'); await file.getByRole('button',{name:'Export backup',exact:true}).first().click(); const portableBackup = await readFile(await (await portableDownload).path(),'utf8'); await upload(page,portableBackup); await page.getByRole('button',{name:'Replace tuNotes data',exact:true}).first().click();
  page.once('dialog',d => d.accept()); await page.getByRole('button',{name:'Delete selected profile',exact:true}).first().click(); assert.equal(await page.locator('#profile option').count(),1);
  page.once('dialog',d => d.accept()); await page.getByRole('button',{name:'Delete all tuNotes data',exact:true}).first().click(); assert.equal(await page.locator('#preset').getAttribute('value'),'treble-lines-and-spaces'); assert.equal(await page.evaluate(() => localStorage.getItem('tuno-preferences')),'preserve');
  results.push('Hosted ↔ cold-offline portable JSON backup round trip, confirmed profile/all-data deletion and 360/768/1280 setup layouts');
  for (const mode of ['denied','corrupt','quota']) {
    const ctx = await browser.newContext(); await ctx.addInitScript(mode => {
      if(mode==='denied') Object.defineProperty(window,'localStorage',{get(){throw new Error('denied');}});
      if(mode==='corrupt') localStorage.setItem('tunotes:data:v1','corrupt');
      if(mode==='quota') Storage.prototype.setItem=function(){throw new Error('quota');};
    },mode);
    const p = await ctx.newPage(); p.on('pageerror',e => errors.push(e.message)); await p.goto(new URL('/notes/', host.url).href); await expandData(p);
    await p.getByRole('button',{name:'Add profile',exact:true}).first().click(); await p.getByLabel('Profile name',{exact:true}).fill('Memory'); await p.getByLabel('Profile name',{exact:true}).press('Enter'); assert.match(await p.locator('#storage-status').textContent(),/memory/i);
    await setToggle(p,'meet-notes',false); await p.getByRole('button',{name:'Start Practice',exact:true}).first().click(); await p.getByRole('button',{name:'A',exact:true}).first().click(); await p.getByRole('button',{name:'Finish',exact:true}).first().click(); await p.getByRole('button',{name:'Home',exact:true}).first().click();
    await upload(p,backup); await p.getByRole('button',{name:'Replace tuNotes data',exact:true}).first().waitFor(); assert.match(await p.locator('#import-preview').textContent(),/memory-only/); await p.getByRole('button',{name:'Replace tuNotes data',exact:true}).first().click(); await ctx.close();
  }
  results.push('Denied/corrupt/quota storage allows play and explicit memory-only import');
  const fixtureCode = await build({stdin:{contents:`import { renderStaff } from './src/apps/tunotes/ui/staff.ts'; import { keyNames,keySignature,parsePitch } from './src/apps/tunotes/domain/notation.ts'; for(const clef of ['treble','bass','alto','tenor']) for(const key of keyNames) { const section=document.createElement('section'); const h=document.createElement('h3'); h.textContent=clef+' '+key; section.append(h,renderStaff(parsePitch('C4'),clef,keySignature(key))); document.body.append(section); } for(const [pitch,clef,key] of [['F4','treble','G'],['F#4','treble','C'],['Gb4','treble','C'],['B#3','treble','C#'],['Cb4','bass','Cb'],['C7','treble','C']]) { const s=document.createElement('section'); const h=document.createElement('h3'); h.textContent=pitch+' '+clef+' '+key; s.append(h,renderStaff(parsePitch(pitch),clef,keySignature(key))); document.body.append(s); }`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'});
  const fixture = await browser.newPage({viewport:{width:1400,height:1000}}); await fixture.setContent('<style>body{display:grid;grid-template-columns:repeat(4,1fr);font:16px sans-serif}svg{width:100%;height:180px}h3{margin:8px}</style>'); await fixture.addScriptTag({content:fixtureCode.outputFiles[0].text});
  assert.equal(await fixture.locator('svg').count(),66); assert.equal(await fixture.locator('.key-accidental').count(),239); await fixture.screenshot({path:`dist/validation/notes-stage2-${name}-notation.png`,fullPage:true});
  results.push('66 notation review fixtures: every clef/key, natural cancellation, explicit sharp/flat, B-sharp/C-flat octave identities and flute C7 ledger extent');
  assert.deepEqual(errors,[]);
  const release=JSON.parse(await readFile('dist/release.json','utf8')); await writeFile(`dist/validation/notes-stage2-${name}.json`,JSON.stringify({build:release.apps.tunotes.build,browser:browser.version(),results},null,2)); console.log(results.join('\n'));
} finally { await browser.close(); await host.close(); }
