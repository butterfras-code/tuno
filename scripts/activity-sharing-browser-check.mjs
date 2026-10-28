import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import {mkdir} from 'node:fs/promises';
import { choosePreset, openCustom, setEndpoint, useRange } from './notes-setup-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { activityUrl, readActivityLink } from '../src/shared/sharing/activity-link.ts';
import { notesAdapter, captureRange } from '../src/apps/tunotes/sharing.ts';
import { defaultPreset, normalizePreset, presets } from '../src/apps/tunotes/domain/presets.ts';
import { defaultTimed } from '../src/apps/tunotes/engine/challenge.ts';
import { toolAdapter, captureTools } from '../src/practice/sharing.ts';
import { createPracticeStore } from '../src/practice/state.ts';
import { rhythmAdapter, captureRhythm } from '../src/apps/rhythm-walk/sharing.ts';
import { Activity, defaultPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { score, note } from '../src/music/measure.ts';
import { emptySnapshot } from '../src/apps/tunotes/persistence/store.ts';

const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({chromium,firefox})[engine].launch(); const host = await hostBuild(); const errors=[];
const sizes=[];
const artifacts=`dist/validation/activity-sharing-${engine}`;await mkdir(artifacts,{recursive:true});
const localNotes=emptySnapshot();
localNotes.profiles=[{id:'local-student',name:'Private student',results:[],contexts:[],defaultPresetId:defaultPreset.id,adaptive:true}];
Object.assign(localNotes.configuration,{remember:true,profileId:'local-student'});
async function share(page,adapter) {
  await page.getByRole('button',{name:'Share activity',exact:true}).focus();
  await page.getByRole('button',{name:'Share activity',exact:true}).press('Enter');
  const dialog=page.getByRole('dialog',{name:'Share activity',exact:true});
  await page.waitForFunction(() => document.querySelector('.activity-share-dialog textarea')?.value);
  const url=await dialog.locator('textarea[aria-label="Activity link"]').inputValue();
  const loaded=await readActivityLink(url,adapter); assert.equal(loaded.kind,'loaded');
  await dialog.locator('.activity-share-qr').waitFor({state:'visible'});
  if (!await page.evaluate(() => typeof window.jsQR === 'function')) await page.addScriptTag({path:require.resolve('jsqr')});
  const decoded = await dialog.locator('.activity-share-qr').evaluate(async img => {
    await img.decode();
    const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    return window.jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height)?.data;
  });
  assert.equal(decoded,url,'QR scans to the exact activity link');
  const download = dialog.getByRole('link',{name:'Download QR code'});
  assert.equal(await download.getAttribute('href'),await dialog.locator('.activity-share-qr').getAttribute('src'));
  const downloaded = page.waitForEvent('download'); await download.click();
  assert.equal((await downloaded).suggestedFilename(),`${adapter.app}-activity-qr.png`);
  assert.ok(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'no dialog horizontal overflow');
  await page.screenshot({path:`${artifacts}/share-dialog-${adapter.app}-${page.viewportSize().width}.png`});

  await dialog.getByRole('button',{name:'Copy link',exact:true}).click();
  await page.waitForFunction(() => /Link copied|Copy the selected/.test(document.querySelector('.activity-share-dialog [role="status"]')?.textContent));
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  return loaded.value;
}
async function open(adapter,value,width=390) {
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.addInitScript(({notes,rhythm}) => {
    if (!localStorage.getItem('tunotes:data:v1')) localStorage.setItem('tunotes:data:v1',notes);
    if (!localStorage.getItem('tuno.rhythm-walk.preferences.v1')) localStorage.setItem('tuno.rhythm-walk.preferences.v1',rhythm);
    if (!localStorage.getItem('tuno.preferences.v1')) localStorage.setItem('tuno.preferences.v1',JSON.stringify({tempo:77,toneVolume:12,clickVolume:23}));
  },{notes:JSON.stringify(localNotes),rhythm:JSON.stringify(defaultPreferences())});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const url=await activityUrl(host.url,adapter,value);sizes.push(url.length);
  await page.goto(url);await page.locator('.shared-activity-notice').waitFor();
  assert.match(await page.locator('.shared-activity-notice').textContent(),/Shared activity/);
  assert.deepEqual(await share(page,adapter),adapter.validate(value));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),'no horizontal page overflow');
  await page.screenshot({path:`${artifacts}/${adapter.app}-${value.mode ?? value.focus ?? value.preferences?.mode}-${width}.png`});
  return {page,context,url};
}
try {
  // Capture actual chooser output before testing recipient round trips.
  const teacher=await browser.newPage({viewport:{width:390,height:900}});teacher.on('pageerror',e=>errors.push(e.message));
  await teacher.goto(new URL('/notes/',host.url).href);
  await teacher.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedActivity=value;}}}));
  await choosePreset(teacher,'bass-lines-and-spaces',true);
  const adaptive=await share(teacher,notesAdapter);assert.ok(await teacher.evaluate(()=>window.copiedActivity?.includes('activity=')));
  await teacher.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('blocked');}}}));assert.equal(adaptive.ranges[0].adaptive,true);assert.ok(adaptive.ranges[0].expansionPools.length);
  await openCustom(teacher);await setEndpoint(teacher,'Lowest note','C3');await setEndpoint(teacher,'Highest note','G5');await useRange(teacher);
  const unsaved=await share(teacher,notesAdapter);assert.equal(unsaved.ranges[0].source.id,'custom-shared');
  const received=await open(notesAdapter,unsaved);await received.context.close();
  // A rendering failure must not take away the usable activity link or leave a stale QR.
  await teacher.evaluate(() => { window.savedToDataURL=HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL=()=>{throw new Error('Canvas unavailable');}; });
  await teacher.getByRole('button',{name:'Share activity',exact:true}).click();
  await teacher.getByText('A QR code could not be created for this activity. Use Copy link instead.',{exact:true}).waitFor();
  assert.equal(await teacher.locator('.activity-share-qr').isVisible(),false);
  assert.equal(await teacher.getByRole('link',{name:'Download QR code'}).count(),0);
  await teacher.getByRole('button',{name:'Copy link',exact:true}).click();
  await teacher.getByRole('textbox',{name:'Activity link'}).waitFor();
  await teacher.getByRole('button',{name:'Close',exact:true}).click();
  await teacher.evaluate(() => { HTMLCanvasElement.prototype.toDataURL=window.savedToDataURL; });
  await share(teacher,notesAdapter);
  await teacher.close();
  // Exercise the chooser's explicit grouping order, which differs from sorted IDs.
  const rhythmTeacher=await browser.newPage({viewport:{width:390,height:900}});
  rhythmTeacher.on('pageerror',e=>errors.push(e.message));
  await rhythmTeacher.goto(new URL('/rhythm/',host.url).href);
  for (const [label,id,scope] of [
    ['Uno4','uno-4'],['Uno5','uno-5'],
    ['UIL I','uil-1','percussion'],['UIL II','uil-2','general'],['UIL II','uil-2','percussion'],['UIL III','uil-3','percussion'],
    ['UIL IV','uil-4','general'],['UIL IV','uil-4','percussion'],
  ]) {
    await rhythmTeacher.getByRole('button',{name:'Choose rhythms',exact:true}).click();
    const chooser=rhythmTeacher.getByRole('dialog',{name:'Choose rhythms',exact:true});
    await chooser.getByRole('tab',{name:scope?'UIL Sight Reading':'Uno’s Choice',exact:true}).click();
    if (scope) await chooser.getByRole('combobox',{name:'UIL instrument scope',exact:true}).selectOption(scope);
    await chooser.getByRole('button',{name:label,exact:true}).click();
    await chooser.getByRole('button',{name:'Use preset',exact:true}).click();
    assert.ok((await rhythmTeacher.locator('.exercise-summary').textContent()).includes(`Current exercise: ${label}`));
    assert.ok(!(await rhythmTeacher.locator('.exercise-summary').textContent()).includes('Pending settings'));
    const teacherMusic=() => rhythmTeacher.locator('.passage g[data-event]').evaluateAll(nodes => nodes.map(n => [n.dataset.value,n.dataset.kind,n.dataset.dots,n.dataset.start,n.dataset.duration,n.dataset.tieNext,n.dataset.tupletGroup]));
    const teacherScore=await teacherMusic();
    const teacherExerciseId=await rhythmTeacher.locator('.passage').getAttribute('data-exercise-id');
    const value=await share(rhythmTeacher,rhythmAdapter);
    assert.deepEqual(await teacherMusic(),teacherScore,'sharing preserves the teacher score');
    assert.equal(await rhythmTeacher.locator('.passage').getAttribute('data-exercise-id'),teacherExerciseId);
    assert.equal(value.preferences.generation.teachingPreset.id,id);
    assert.equal(value.preferences.generation.teachingPreset.scope,scope);
    assert.equal(value.preferences.generation.teachingPreset.customized,false);
    const received=await open(rhythmAdapter,value);
    assert.ok((await received.page.locator('.shared-activity-notice').textContent()).includes(label));
    await received.page.getByRole('button',{name:'Choose rhythms',exact:true}).click();
    const recipientChooser=received.page.getByRole('dialog',{name:'Choose rhythms',exact:true});
    assert.equal(await recipientChooser.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
    if (scope) assert.equal(await recipientChooser.getByRole('combobox',{name:'UIL instrument scope',exact:true}).inputValue(),scope);
    await recipientChooser.getByRole('button',{name:'Cancel',exact:true}).click();
    await received.page.getByRole('button',{name:'Next Exercise',exact:true}).click();
    const continued=await share(received.page,rhythmAdapter);
    assert.deepEqual(continued.preferences.generation,value.preferences.generation,'student continues with the assigned preset');
    assert.deepEqual(await received.page.evaluate(() => JSON.parse(localStorage.getItem('tuno.rhythm-walk.preferences.v1')).generation),defaultPreferences().generation,'assignment does not overwrite student defaults');
    await received.context.close();
  }
  await rhythmTeacher.close();
  for(const focus of ['tuner','tone','metronome']) {
    const store=createPracticeStore();store.dispatch({type:'focus',value:focus});store.dispatch({type:'tempo',value:123});
    const {page,context}=await open(toolAdapter,captureTools(store));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tuno.preferences.v1')).tempo),77);
    if (focus === 'tuner') {
      await page.locator('.practice-navigation a[href="/tone/"]').click();
      assert.equal(new URL(page.url()).searchParams.has('activity'),false,'new tool route cannot retain a mismatched assignment');
      assert.equal((await share(page,toolAdapter)).tempo,123,'temporary settings survive in-app navigation');
      await page.reload();
      assert.equal((await share(page,toolAdapter)).tempo,77,'ordinary route restores saved settings');
    }
    await context.close();
  }
  const range=captureRange(defaultPreset,false,true);
  for (const mode of ['practice','challenge']) {
    const value={mode,ranges:[range],pace:'correct',intro:false,rules:{...defaultTimed,seconds:45},format:'turns'};
    const {page,context}=await open(notesAdapter,value);
    await page.getByRole('button',{name:mode==='practice'?'Start Practice':'Start Challenge',exact:true}).click();
    await page.locator('.practice-view[data-screen="playing"]').waitFor();
    assert.equal((await share(page,notesAdapter)).mode,mode);
    await page.getByRole('navigation',{name:'tuNotes modes'}).getByRole('button',{name:'Options',exact:true}).click();
    assert.equal((await share(page,notesAdapter)).mode,mode,'Options retains its activity context');
    await page.getByRole('navigation',{name:'tuNotes modes'}).getByRole('button',{name:mode==='practice'?'Practice':'Challenge',exact:true}).click();
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('tunotes:data:v1'))).configuration.showKeySignature,undefined);
    if (mode === 'practice') {
      await page.getByRole('button',{name:'Resume',exact:true}).click();
      await page.keyboard.press('A');
      await page.getByRole('button',{name:'Finish',exact:true}).click();
      const stored=JSON.parse(await page.evaluate(() => localStorage.getItem('tunotes:data:v1')));
      assert.ok(stored.profiles[0].results.length,'local built-in progress persists');
      assert.equal(stored.profiles[0].adaptive,true,'assignment does not replace saved adaptation');
      assert.equal((await share(page,notesAdapter)).mode,'practice','results share a fresh activity');
      await page.reload();await page.getByRole('button',{name:'Start Practice',exact:true}).waitFor();
      assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('tunotes:data:v1'))).profiles[0].results.length,stored.profiles[0].results.length);
    }
    await context.close();
  }
  const custom=normalizePreset({...defaultPreset,id:'custom-private',name:'Unsaved',range:['C4','G5'],exactRange:true,accidentals:'both'});
  const {page:customPage,context:customContext}=await open(notesAdapter,{mode:'practice',ranges:[captureRange(custom,false,true)],pace:'instant',intro:false,rules:defaultTimed,format:'turns'});
  await customPage.getByRole('button',{name:'Start Practice',exact:true}).click();await customPage.locator('.practice-view[data-screen="playing"]').waitFor();
  await customPage.keyboard.press('A');await customPage.getByRole('button',{name:'Finish',exact:true}).click();
  assert.deepEqual(JSON.parse(await customPage.evaluate(() => localStorage.getItem('tunotes:data:v1'))).customPresets,[]);
  await customContext.close();
  for(const format of ['turns','pairs','head-to-head']) {
    const value={mode:'multiplayer',ranges:[range,captureRange(presets.find(p=>p.clef==='bass'),false,true)],pace:'instant',intro:false,rules:defaultTimed,format};
    const {page,context}=await open(notesAdapter,value,format==='head-to-head'?1440:390);
    await page.getByRole('button',{name:'Start round',exact:true}).click();
    await page.locator('.multiplayer-round:not([hidden])').waitFor();
    assert.equal(await page.getByRole('dialog',{name:'Choose a play style'}).isVisible(),false);
    assert.deepEqual(await share(page,notesAdapter),notesAdapter.validate(value));
    await context.close();
  }
  const passage=score([{meter:[4,4],notes:[note('half'),note('quarter',{kind:'rest'}),note('eighth'),note('eighth')]}]);
  for(const mode of ['write','tap']) {
    const preferences=defaultPreferences();preferences.mode=mode;
    const value=captureRhythm(new Activity(preferences,passage));const {page,context}=await open(rhythmAdapter,value);
    await page.getByRole('button',{name:mode==='write'?'Perform':'Counts',exact:true}).click();
    const reshared=await share(page,rhythmAdapter);assert.deepEqual(reshared.score,passage);
    assert.equal(reshared.preferences.mode,mode==='write'?'tap':'write');
    await page.getByRole('link',{name:'Settings',exact:true}).click();
    await page.locator('[data-subdivision-style="none"]').check();
    assert.equal(await page.getByRole('button',{name:'Share activity',exact:true}).count(),0);
    await page.getByRole('button',{name:'Share settings',exact:true}).click();
    const settingsDialog=page.getByRole('dialog',{name:'Share settings',exact:true});
    await page.waitForFunction(()=>document.querySelector('.activity-share-url')?.value);
    const settingsUrl=new URL(await settingsDialog.locator('textarea').inputValue());
    assert.equal(settingsUrl.searchParams.get('counting.longNotes'),'false');
    assert.equal(settingsUrl.searchParams.has('activity'),false,'settings links omit the shared score');
    await settingsDialog.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('link',{name:'Practice',exact:true}).click();
    await page.getByRole('button',{name:'Share activity',exact:true}).waitFor();
    const pending=await share(page,rhythmAdapter);assert.deepEqual(pending.preferences.counting,value.preferences.counting,'shares captured counting preferences');
    assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('tuno.rhythm-walk.preferences.v1'))).mode,'write');
    await context.close();
  }
  for(const route of ['/tune/','/notes/','/rhythm/']) {
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL(route+'?activity=1z.broken',host.url).href);
    await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Share activity',exact:true}).count(),0);
    await page.getByRole('link',{name:'Open app normally'}).click();await page.getByRole('button',{name:'Share activity',exact:true}).waitFor();await page.close();
  }
  for (const [adapter,value] of [
    [toolAdapter,captureTools(createPracticeStore())],
    [notesAdapter,{mode:'practice',ranges:[range],pace:'instant',intro:false,rules:defaultTimed,format:'turns'}],
    [rhythmAdapter,captureRhythm(new Activity(defaultPreferences(),passage))],
  ]) {
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(await activityUrl(host.url,adapter,value));await page.locator('.shared-activity-notice').waitFor();
    await share(page,adapter);await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log(`${engine}: all tools, solo modes, custom range, multiplayer formats, both rhythm panels, session isolation, malformed links and mobile layout passed. URL lengths ${Math.min(...sizes)}–${Math.max(...sizes)}.`);
} finally {await browser.close();await host.close();}
