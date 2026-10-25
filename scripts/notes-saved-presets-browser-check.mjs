import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild, prepareOfflineContext } from './test-host.mjs';
import { choosePreset, openRange, openCustom, rangeDialog, saveCustom, useRange, notesMode, startPractice } from './notes-setup-helpers.mjs';
import { emptySnapshot } from '../src/apps/tunotes/persistence/store.ts';
import { instrumentPresets } from '../src/apps/tunotes/domain/presets.ts';
const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({chromium,firefox})[engine].launch(), host = await hostBuild();
const errors=[];
try {
 for (const offline of [false,true]) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const url=new URL('/notes/',host.url).href;
  if(offline) await prepareOfflineContext(context,url);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  await openRange(page);assert.equal(await rangeDialog(page).getByRole('button',{name:'My Presets',exact:true}).isVisible(),false);
  await page.keyboard.press('Escape');await choosePreset(page,'violin-starter');
  const summary=await page.locator('#preset-summary').textContent();
  await openCustom(page);
  const notation=rangeDialog(page).getByRole('group',{name:'Accidentals',exact:true});
  assert.equal(await notation.isVisible(),true);
  assert.equal(await notation.getByRole('button',{name:'On each note',exact:true}).locator('.preset-notation-mark').textContent(),'✓');
  await notation.getByRole('button',{name:'Key Signature',exact:true}).click();
  await page.keyboard.press('Escape');
  assert.notEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('tunotes:data:v1')).configuration.showKeySignature),true,'cancel discards notation draft');
  await openCustom(page);await useRange(page);
  assert.equal(await page.locator('#preset-summary').textContent(),summary,'converting an instrument preserves its key and pitch bounds');
  await openCustom(page);await notation.getByRole('button',{name:'Key Signature',exact:true}).click();
  await rangeDialog(page).getByRole('button',{name:'Save Preset',exact:true}).click();
  const nameDialog=page.getByRole('dialog',{name:'Save Preset',exact:true});
  await nameDialog.getByLabel('Preset name').fill('  ');await nameDialog.getByRole('button',{name:'Save Preset',exact:true}).click();
  assert.match(await nameDialog.getByRole('alert').textContent(),/Enter a preset name/);
  await nameDialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await rangeDialog(page).isVisible(),true);
  await saveCustom(page,'My D major');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tunotes:data:v1')).configuration.showKeySignature),true);
  await choosePreset(page,'bass-spaces');await page.reload();
  await openRange(page);await rangeDialog(page).getByRole('button',{name:'My Presets',exact:true}).click();
  await rangeDialog(page).getByRole('button',{name:/My D major/}).click();await rangeDialog(page).getByRole('button',{name:'Keep this range',exact:true}).click();
  assert.equal(await page.locator('#preset-summary').textContent(),summary);
  await startPractice(page);assert.equal(await page.locator('.staff .key-accidental').count(),2);
  await page.getByRole('button',{name:'Finish',exact:true}).click();await page.getByRole('button',{name:'Edit setup',exact:true}).click();
  await openCustom(page);await notation.getByRole('button',{name:'On each note',exact:true}).click();await useRange(page);
  await startPractice(page);assert.equal(await page.locator('.staff .key-accidental').count(),0);
  await page.getByRole('button',{name:'Finish',exact:true}).click();await page.getByRole('button',{name:'Edit setup',exact:true}).click();
  for(const mode of ['Challenge','Multi Player']) {
   await notesMode(page,mode);await openRange(page);await rangeDialog(page).getByRole('button',{name:'My Presets',exact:true}).click();
   await rangeDialog(page).getByRole('button',{name:/My D major/}).click();await rangeDialog(page).getByRole('button',{name:'Keep this range',exact:true}).click();
   assert.match(await page.locator('.preset-summary:visible').textContent(),/D Major/);
  }
  await context.close();
 }
 // Pre-v2 saved configurations must also preserve keys on opening Custom.
 const page=await browser.newPage();const data=emptySnapshot();
 const legacy={...instrumentPresets.find(p=>p.id==='flute-starter'),id:'legacy-saved',name:'Legacy flute'};
 data.customPresets.push(legacy);data.configuration.presetId=legacy.id;
 await page.addInitScript(data=>localStorage.setItem('tunotes:data:v1',JSON.stringify(data)),data);
 await page.goto(new URL('/notes/',host.url).href);const before=await page.locator('#preset-summary').textContent();
 await openCustom(page);await useRange(page);assert.equal(await page.locator('#preset-summary').textContent(),before);
 assert.deepEqual(errors,[]);console.log(`${engine}: legacy/instrument keys, draft notation, named saves, My Presets in all modes, reload and offline persistence passed.`);
} finally {await browser.close();await host.close();}
