import { notesMode, openData, setToggle, setPacing } from './notes-setup-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostBuild } from './test-host.mjs';
import { choosePreset, setEndpoint, setModifiers, setKey, customTab, endpointTab } from './notes-setup-helpers.mjs';
const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({chromium,firefox})[name].launch();
const host = await hostBuild();
const errors = [], results = [];
const group = (page,name) => page.getByRole('group',{name,exact:true});
const start = page => page.getByRole('button',{name:'Start Practice',exact:true}).first();
const apply = page => page.getByRole('button',{name:'Use range',exact:true});
async function run(page,mode) {
  page.on('pageerror',e => errors.push(e.message)); page.setDefaultTimeout(10000);
  await page.locator('#preset').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('dialog').isVisible(),true);
  await page.getByRole('dialog').getByRole('button',{name:'Instrument',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'B♭ Trumpet',exact:true}).click();
  assert.match(await page.getByRole('dialog').locator('.picker-trail').textContent(),/Instrument › B♭ Trumpet/);
  await page.getByRole('dialog').getByRole('button',{name:'← Back',exact:true}).click();
  assert.match(await page.locator('#preset-step-title').textContent(),/instrument/);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#preset:focus').count(),1);
  await choosePreset(page,'bass-spaces'); assert.equal(await page.locator('#preset').getAttribute('value'),'bass-spaces');
  await choosePreset(page,'custom');
  assert.equal(await page.getByRole('tab',{name:'Range',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await start(page).isVisible(),false);
  assert.equal(await page.getByLabel('Lowest note clef',{exact:true}).isVisible(),true);
  const presetName = page.getByLabel('Custom preset name',{exact:true});
  assert.equal(await presetName.inputValue(),'E4–F5 Both in C major');
  assert.deepEqual(await page.getByLabel('Major key',{exact:true}).locator('option').evaluateAll(options => options.map(o => o.value)),['C','F','Bb','Eb','Ab','Db','Gb','G','D','A','E','B','F#']);
  const low = page.locator('[role=slider][aria-label="Lowest note"]');
  await low.focus(); const value = Number(await low.getAttribute('aria-valuenow')); await page.keyboard.press('ArrowUp'); assert.equal(Number(await low.getAttribute('aria-valuenow')),value+1);
  await setEndpoint(page,'Lowest note','D4'); await setEndpoint(page,'Highest note','G4');
  // Tap a specific position in SVG coordinates; validates screen-to-staff conversion.
  await endpointTab(page,'Lowest note'); await low.scrollIntoViewIfNeeded();
  let point = await low.locator('svg').evaluate(svg => { const p = new DOMPoint(280,140).matrixTransform(svg.getScreenCTM()); return {x:p.x,y:p.y}; });
  await page.mouse.click(point.x,point.y); assert.match(await low.getAttribute('aria-valuetext'),/E4/);
  // Drag the notehead by two diatonic positions.
  point = await low.locator('svg').evaluate(svg => { const m=svg.getScreenCTM(),p=new DOMPoint(230,140).matrixTransform(m); return {x:p.x,y:p.y,delta:20*m.d}; });
  await page.mouse.move(point.x,point.y); await page.mouse.down(); await page.mouse.move(point.x,point.y-point.delta,{steps:4}); await page.mouse.up(); assert.match(await low.getAttribute('aria-valuetext'),/G4/);
  await low.focus(); await page.keyboard.press('PageUp');
  assert.match(await low.getAttribute('aria-valuetext'),/G4/); assert.equal(await apply(page).isEnabled(),true);
  assert.match(await page.locator('.configurator-notice').textContent(),/stopped at G4/);
  const high = page.locator('[role=slider][aria-label="Highest note"]');
  await high.focus(); await page.keyboard.press('PageDown'); assert.match(await high.getAttribute('aria-valuetext'),/G4/);
  await group(page,'Lowest note accidental').getByRole('button',{name:'Sharp',exact:true}).click();
  assert.match(await low.getAttribute('aria-valuetext'),/^G4,/); // G-sharp cannot exceed natural G.
  await group(page,'Highest note accidental').getByRole('button',{name:'Flat',exact:true}).click();
  assert.match(await high.getAttribute('aria-valuetext'),/^G4,/); // G-flat cannot fall below natural G.
  // A pointer tap below the lower bound must clamp too.
  await endpointTab(page,'Highest note'); await high.scrollIntoViewIfNeeded();
  const crossing = await high.locator('svg').evaluate(svg => { const p = new DOMPoint(280,160).matrixTransform(svg.getScreenCTM()); return {x:p.x,y:p.y}; });
  await page.mouse.click(crossing.x,crossing.y); assert.match(await high.getAttribute('aria-valuetext'),/^G4,/);

  await setEndpoint(page,'Lowest note','F4'); await setEndpoint(page,'Highest note','G4'); await setKey(page,'G');
  await setModifiers(page,['key','natural']); assert.match(await page.locator('#preset-summary').textContent(),/F♯4–G4.*naturals/);
  assert.equal(await presetName.inputValue(),'F4–G4 Both in G major + ♮');
  await page.getByRole('button',{name:'Save as preset…',exact:true}).click();
  await presetName.fill('My reading warmup');
  await setModifiers(page,['flat','natural','sharp']); assert.equal(await presetName.inputValue(),'My reading warmup');
  await presetName.fill(''); assert.equal(await presetName.inputValue(),'F4–G4 Both + ♭ ♮ ♯');

  await page.getByRole('button',{name:'Back to editing',exact:true}).click();
  await setModifiers(page,[]); assert.equal(await apply(page).isDisabled(),true); assert.match(await page.locator('#preset-summary').textContent(),/additional spelling/);
  await setKey(page,'F'); assert.equal(await group(page,'Key signature').getByRole('button',{name:'On',exact:true}).getAttribute('aria-pressed'),'true');
  await customTab(page,'Range');
  // Clefs start linked. A second endpoint change must be acknowledged.
  await page.getByLabel('Lowest note clef',{exact:true}).selectOption('bass');
  assert.match(await high.getAttribute('aria-valuetext'),/bass clef/);
  page.once('dialog',d => d.dismiss()); await page.getByLabel('Highest note clef',{exact:true}).selectOption('alto');
  assert.match(await high.getAttribute('aria-valuetext'),/bass clef/);
  page.once('dialog',d => d.accept()); await page.getByLabel('Highest note clef',{exact:true}).selectOption('alto');
  assert.match(await high.getAttribute('aria-valuetext'),/alto clef/);
  page.once('dialog',d => d.accept()); await page.getByLabel('Highest note clef',{exact:true}).selectOption('tenor');
  assert.match(await high.getAttribute('aria-valuetext'),/tenor clef/);
  page.once('dialog',d => d.accept()); await page.getByLabel('Highest note clef',{exact:true}).selectOption('treble');
  assert.match(await high.getAttribute('aria-valuetext'),/^G4, treble clef/);
  await customTab(page,'Clefs'); assert.equal(await group(page,'Available clefs').getByRole('button',{name:'Treble',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await group(page,'Available clefs').getByRole('button',{name:'Bass',exact:true}).getAttribute('aria-pressed'),'true');
  await group(page,'Available clefs').getByRole('button',{name:'Treble',exact:true}).click(); await group(page,'Available clefs').getByRole('button',{name:'Bass',exact:true}).click();
  assert.match(await page.locator('.configurator-notice').textContent(),/at least one/);
  await group(page,'Available clefs').getByRole('button',{name:'Treble',exact:true}).click();
  await setEndpoint(page,'Lowest note','C2'); await setEndpoint(page,'Highest note','C6'); await setModifiers(page,['natural']);
  assert.match(await page.locator('.ledger-description').textContent(),/ledger/);
  await page.getByRole('button',{name:'Save as preset…',exact:true}).click();
  await page.getByLabel('Custom preset name').fill('Two clefs'); await page.getByRole('button',{name:'Save preset',exact:true}).click();
  assert.match(await page.locator('#preset').textContent(),/Two clefs/);
  await page.reload();
  if (mode === 'hosted') assert.match(await page.locator('#preset').textContent(),/Two clefs/);
  assert.equal(await page.locator('.custom-editor').isVisible(),false);
  await setPacing(page,'Click/Tap'); await start(page).click();
  const seen = new Set();
  for(let i=0;i<29;i++) { seen.add((await page.locator('.staff').getAttribute('aria-label')).split(' ')[0]); await page.getByRole('button',{name:'C',exact:true}).first().click(); if(i<28) await page.getByRole('button',{name:'Continue',exact:true}).click(); }
  assert.deepEqual([...seen].sort(),['bass','treble']);
  await page.getByRole('button',{name:'Finish',exact:true}).click(); await page.getByRole('button',{name:'Edit setup',exact:true}).click();
  for (const width of [360,768,1280]) {
    await page.setViewportSize({width,height:900});
    await customTab(page,'Range');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    await page.screenshot({path:`dist/validation/notes-configurator-${name}-${mode}-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.locator('#preset').click(); const rect = await page.getByRole('dialog').boundingBox(); assert.ok(rect.x>=0 && rect.x+rect.width<=width && rect.height<=884);
    await page.screenshot({path:`dist/validation/notes-picker-${name}-${mode}-${width}.png`}); await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:640,height:900}); await page.evaluate(() => {document.documentElement.style.zoom='2';}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true); await page.locator('#preset').click(); await page.getByRole('dialog').getByRole('button',{name:'Instrument',exact:true}).click(); const zoomRect = await page.getByRole('dialog').boundingBox(); assert.ok(zoomRect.x >= 0 && zoomRect.x+zoomRect.width <= 641 && zoomRect.y+zoomRect.height <= 901); await page.keyboard.press('Escape'); await page.evaluate(() => {document.documentElement.style.zoom='';});
  // Click the actual glyph when extreme ledgers shrink/center the SVG content.
  await setEndpoint(page,'Highest note','B8'); await endpointTab(page,'Highest note'); await high.scrollIntoViewIfNeeded();
  const glyph = await high.locator('svg').evaluate(svg => { const p = new DOMPoint(65,100).matrixTransform(svg.getScreenCTM()); return {x:p.x,y:p.y}; });
  await page.mouse.click(glyph.x,glyph.y);
  assert.equal(await page.getByLabel('Highest note clef',{exact:true}).evaluate(node => node === document.activeElement),true);
  await page.getByLabel('Highest note clef',{exact:true}).selectOption('bass'); assert.match(await high.getAttribute('aria-valuetext'),/^B8, bass clef/);
  results.push(`${mode}: wizard/back/Escape/focus, ordered keys, keyboard/tap/drag range, clamped keyboard/pointer/accidental bounds, generated/overridden names, empty settings, additive modifiers, linked and mixed clefs with Cancel/OK, explicit clefs, ledger description, save/reload, mixed-clef practice, 360/768/1280 layouts and zoom`);
}
try {
  await mkdir('dist/validation',{recursive:true});
  const page = await browser.newPage(); await page.goto(new URL('/notes/', host.url).href); await run(page,'hosted');
  const context = await browser.newContext({offline:true}); const file = await context.newPage(); const requests=[]; file.on('request',r => {if(/^https?:/.test(r.url())) requests.push(r.url());});
  await file.goto(pathToFileURL(resolve('dist/portable/tunotes.html')).href); await run(file,'portable'); assert.deepEqual(requests,[]);
  if (name === 'chromium') {
    const touchContext = await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
    const touch = await touchContext.newPage(); await touch.goto(new URL('/notes/', host.url).href); await choosePreset(touch,'custom');
    const slider = touch.getByRole('slider',{name:'Lowest note',exact:true}); await slider.scrollIntoViewIfNeeded();
    const p = await slider.locator('svg').evaluate(svg => { const m=svg.getScreenCTM(),p=new DOMPoint(230,140).matrixTransform(m); return {x:p.x,y:p.y,delta:20*m.d}; });
    const cdp=await touchContext.newCDPSession(touch);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y-p.delta}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); assert.match(await slider.getAttribute('aria-valuetext'),/G4/);
    await touch.getByRole('group',{name:'Lowest note accidental',exact:true}).getByRole('button',{name:'Sharp',exact:true}).tap(); assert.match(await slider.getAttribute('aria-valuetext'),/G♯4/);
    await touchContext.close(); results.push('Chromium touch emulation: graphical note drag and endpoint accidental tap');
  }
  assert.deepEqual(errors,[]);
  const release=JSON.parse(await readFile('dist/release.json','utf8')); await writeFile(`dist/validation/notes-configurator-${name}.json`,JSON.stringify({build:release.apps.tunotes.build,browser:browser.version(),results},null,2)); console.log(results.join('\n'));
} finally { await browser.close(); await host.close(); }
