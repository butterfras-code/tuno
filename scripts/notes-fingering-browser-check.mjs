import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { build } from 'esbuild';
import { hostBuild } from './test-host.mjs';
import { viewportProfiles } from './viewport-profiles.mjs';
import { choosePreset, startPractice, notesMode } from './notes-setup-helpers.mjs';

const strings = ['violin','viola','cello','double-bass'];
const layoutInstruments = ['horn-f','trumpet-bb','tuba','euphonium',...strings];
const selectedLayouts = process.env.TUNO_FINGERING_INSTRUMENTS?.split(',') ?? layoutInstruments;
assert.ok(selectedLayouts.every(instrument => layoutInstruments.includes(instrument)), 'Unknown fingering layout instrument');
const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({chromium,firefox})[name].launch();
const host = await hostBuild();
const errors = [];
const instrumentPill = page => page.getByRole('button', {name:/^Choose instrument/});
const selectInstrument = async (page, value) => {
  await instrumentPill(page).click();
  const picker=page.getByRole('dialog',{name:'Choose instrument',exact:true});
  await picker.locator(`[data-instrument="${value}"]`).click();
};
const chooseMethod = async (page, value) => {
  if (value==='names') {
    await page.getByRole('group', {name:'Answer method',exact:true}).getByRole('button', {name:'Note Names',exact:true}).click();
    return;
  }
  if (value==='keyboard') return selectInstrument(page,'piano');
  await instrumentPill(page).click();
  const picker=page.getByRole('dialog',{name:'Choose instrument',exact:true});
  const current=await picker.locator('[aria-pressed="true"]').getAttribute('data-instrument');
  await picker.locator(`[data-instrument="${current==='piano' ? 'trumpet-bb' : current}"]`).click();
};
async function withAdjustment(page, action) {
  const opened = await page.getByRole('button',{name:'Adjust Input',exact:true}).isVisible();
  if (opened) await page.getByRole('button',{name:'Adjust Input',exact:true}).click();
  await action();
  if (opened) await page.getByRole('button',{name:'Done',exact:true}).click();
}
async function adjustmentClick(page, name) {
  await withAdjustment(page, () => page.getByRole('button',{name,exact:typeof name === 'string'}).click());
}
// Exercise real rendered targets: spacing may compress to fit, never overlap.
async function checkHand(page, context) {
  const geometry = await page.locator('.fingering-panel').evaluate(panel => {
    const root = panel.querySelector('.fingering-input');
    const rect = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; };
    return { scale: Number(getComputedStyle(root).getPropertyValue('--hand-scale') || 1), vertical: !!root.closest('.play-stage--grip'), flipped: root.dataset.flipped === 'true',
      controls: [...panel.querySelectorAll('button')].filter(el => el.checkVisibility() && !(el.classList.contains('fingering-valve') && panel.querySelector('.fingering-resize-outline:not([hidden])'))).map(el => ({...rect(el),label:el.getAttribute('aria-label') || el.textContent, finger:el.classList.contains('fingering-valve')})),
      fingers: [...root.querySelectorAll('.fingering-valve')].map(rect) };
  });
  const { controls, fingers, vertical, flipped, scale } = geometry;
  for (const [i,a] of controls.entries()) {
    assert.ok(!a.finger || a.w >= 47 && a.h >= 47 && Math.abs(a.w - 64 * scale) < 0.75, `${context}: touch target ${JSON.stringify(a)}`);
    for (const b of controls.slice(i+1)) {
      const overlapX = Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
      const overlapY = Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
      assert.ok(overlapX < 0.75 || overlapY < 0.75, `${context}: overlapping controls ${JSON.stringify({a,b})}`);
    }
  }
  const axis = vertical ? 'y' : 'x', cross = vertical ? 'x' : 'y';
  const distance = Math.abs(fingers[1][axis]-fingers[0][axis]);
  assert.ok(distance <= 100.75 * scale, `${context}: spacing must stay bounded, got ${distance}`);
  if (await page.locator('.fingering-trigger').count()) {
    const [one,two,,thumb] = fingers;
    assert.ok((thumb[axis]-one[axis])*(two[axis]-one[axis]) < 0, `${context}: trigger follows valve 1`);
    assert.ok(Math.abs(thumb[cross]-one[cross]) > 1, `${context}: thumb offset is preserved`);
    // The left-hand 3–2–1 reference has the thumb below and left of valve 1.
    // This sign must survive Move, rotation, and Flip; reversing just one axis
    // silently changes the layout into a right hand.
    const handedness = (two.x-one.x)*(thumb.y-one.y) - (two.y-one.y)*(thumb.x-one.x);
    assert.ok(handedness < 0, `${context}: horn retains left-hand geometry`);
    assert.ok(Math.hypot(thumb.x-one.x,thumb.y-one.y) <= 129 * scale, `${context}: thumb reach stays bounded`);
    if (vertical && flipped) assert.ok(thumb.y > one.y && one.y > two.y && thumb.x < one.x, `${context}: flipped left-hand thumb is below and left of valve 1`);
    assert.equal(await page.locator('.fingering-trigger kbd').textContent(),'V');
    assert.equal(await page.locator('.fingering-trigger kbd').isVisible(),true);
    assert.equal(await page.locator('.fingering-trigger').getAttribute('aria-keyshortcuts'),'V');
  }
  return {distance, target:fingers[0].w};
}
async function checkSpacings(page, context) {
  const root = page.locator('.fingering-input');
  const position = await page.locator('.note-entry').getAttribute('data-grip-position');
  const flipped = await root.getAttribute('data-flipped');
  const sizes = {};
  for (let i=0; i<3; i++) {
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const preset = await root.getAttribute('data-spacing');
    sizes[preset] = await checkHand(page, `${context} ${preset} flipped=${flipped}`);
    await adjustmentClick(page, /^Spacing:/);
    assert.equal(await page.locator('.note-entry').getAttribute('data-grip-position'),position);
    assert.equal(await root.getAttribute('data-flipped'),flipped);
  }
  assert.ok(sizes.compact.distance <= sizes.regular.distance+0.1 && sizes.regular.distance <= sizes.wide.distance+0.1);
  assert.ok(Math.abs(sizes.compact.target-sizes.wide.target) < 0.1,'Spacing keeps target sizes fixed');
}
async function checkResize(page, context) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const root = page.locator('.fingering-input');
  const before = await root.locator('.fingering-valve').first().boundingBox();
  assert.equal(await page.getByRole('button',{name:'Flip finger order',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:/^Spacing:/}).count(),0);
  const counts = await page.locator('#practice-counts').textContent();
  const panelBefore = await page.locator('.note-entry').boundingBox();
  const staffBefore = await page.locator('.staff-panel').boundingBox();
  await page.getByRole('button', {name:'Adjust Input',exact:true}).click();
  assert.ok(await page.getByRole('button',{name:'Flip finger order',exact:true}).isVisible());
  assert.ok(await page.getByRole('button',{name:/^Spacing:/}).isVisible());
  const handle = page.getByRole('slider', {name:'Finger arrangement size'});
  if (context === 'horn-f classroom left') {
    const grip = await handle.boundingBox();
    await page.mouse.move(grip.x + grip.width/2, grip.y + grip.height/2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width/2 + 40, grip.y + grip.height/2 + 40, {steps:8});
    await page.mouse.up(); await page.waitForTimeout(100);
    assert.ok(Number(await page.locator('.note-entry').getAttribute('data-hand-scale')) > 1, 'Dragging enlarges the arrangement');
    assert.equal(await page.evaluate(()=>localStorage.getItem('tunotes:finger-scale:horn-f:landscape')), await page.locator('.note-entry').getAttribute('data-hand-scale'), 'Drag completion saves size');
  }
  await handle.press('End');
  await page.waitForTimeout(100);
  await checkHand(page, `${context} fill`);
  assert.deepEqual(await page.locator('.note-entry').boundingBox(), panelBefore, `${context}: resize must not grow the panel`);
  assert.deepEqual(await page.locator('.staff-panel').boundingBox(), staffBefore, `${context}: resize must not take staff space`);
  const navigationLabels = await page.locator('.focus-navigation > button').evaluateAll(buttons => buttons.map(button => {
    const range = document.createRange(); range.selectNodeContents(button);
    const r = range.getBoundingClientRect(); return {left:r.left, right:r.right, top:r.top, bottom:r.bottom};
  }));
  for (const [index, a] of navigationLabels.entries()) for (const b of navigationLabels.slice(index+1)) {
    assert.ok(Math.min(a.right,b.right)-Math.max(a.left,b.left) < 1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top) < 1, `${context}: resizing must not overlap navigation labels`);
  }

  assert.equal(await root.locator('.fingering-valve:enabled').count(), 0, 'Resize disables playing');
  await page.keyboard.press('e'); await page.keyboard.press('Space');
  assert.equal(await root.getAttribute('data-code'), '00000|00000');
  assert.equal(await page.locator('#practice-counts').textContent(), counts);
  const area = await root.boundingBox();
  for (const button of await root.locator('.fingering-valve').all()) {
    const r = await button.boundingBox();
    assert.ok(r.x >= area.x-1 && r.y >= area.y-1 && r.x+r.width <= area.x+area.width+1 && r.y+r.height <= area.y+area.height+1, `${context}: resized control stays inside its area`);
  }
  await page.screenshot({path:`dist/validation/resize-${context.replaceAll(' ','-')}-${name}.png`});
  const large = await root.locator('.fingering-valve').first().boundingBox();
  assert.ok(large.width >= before.width-1, `${context}: fill never shrinks the hand`);
  await handle.press('Home'); await page.waitForTimeout(100);
  const placement = page.getByRole('group', {name:'Finger arrangement position',exact:true});
  const initial = await root.locator('.fingering-valve').first().boundingBox();
  // Drag to the upper-left edges with real pointer capture, then restore the center.
  const moveHandle = await root.locator('.fingering-position-handle').boundingBox();
  await page.mouse.move(moveHandle.x + moveHandle.width/2, moveHandle.y + moveHandle.height/2);
  await page.mouse.down(); await page.mouse.move(area.x + 1, area.y + 1, {steps:3}); await page.mouse.up();
  await page.waitForTimeout(50);
  const moved = await root.locator('.fingering-valve').first().boundingBox();
  assert.ok(moved.x <= initial.x+1 && moved.y <= initial.y+1, `${context}: drag repositions toward the edge`);
  const all = await root.locator('.fingering-valve').evaluateAll(buttons => buttons.map(button => {
    const r=button.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};
  }));
  assert.ok(Math.abs(Math.min(...all.map(r=>r.x))-area.x) < 1 && Math.abs(Math.min(...all.map(r=>r.y))-area.y) < 1, `${context}: controls can reach the input edges`);
  assert.ok(all.every(r=>r.x>=area.x-1 && r.y>=area.y-1 && r.right<=area.x+area.width+1 && r.bottom<=area.y+area.height+1));
  await page.screenshot({path:`dist/validation/position-${context.replaceAll(' ','-')}-${name}.png`});
  await placement.press('Home'); await page.waitForTimeout(50);
  assert.deepEqual(await root.locator('.fingering-valve').first().boundingBox(),initial, `${context}: Home centers the hand`);
  await page.getByRole('button', {name:'Done',exact:true}).click();
  await handle.waitFor({state:'hidden'});
  assert.equal(await handle.count(), 0, 'Handle is hidden outside resize mode');
  assert.ok(await root.locator('.fingering-valve:enabled').count());
  await checkHand(page, `${context} reset size`);
}
async function checkLayouts(page) {
  await choosePreset(page,'trumpet-bb-starter'); await startPractice(page);
  await chooseMethod(page,'fingering');
  assert.equal(await page.getByRole('button',{name:/^Valve [123]$/}).count(),3);
  const selector = page.getByRole('group', {name:'Answer method',exact:true});
  assert.deepEqual(await selector.getByRole('button').allTextContents(), ['Note Names','B♭ Trumpet']);
  assert.equal(await instrumentPill(page).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.input-workspace .interaction-body .fingering-panel:visible').count(),1);
  await instrumentPill(page).click();
  assert.equal(await page.getByRole('dialog',{name:'Choose instrument',exact:true}).isVisible(),true);
  assert.equal(await instrumentPill(page).getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog',{name:'Choose instrument',exact:true}).count(),0);
  assert.equal(await instrumentPill(page).textContent(),'B♭ Trumpet');
  await instrumentPill(page).blur();

  await mkdir('dist/validation',{recursive:true});
  for (const width of [1280,360]) {
    await page.setViewportSize({width,height:800});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const buttons = await page.locator('.fingering-valve:visible').evaluateAll(bs=>bs.map(b=>({w:b.clientWidth,h:b.clientHeight})));
    assert.ok(buttons.every(b=>b.w>=44 && b.h>=44));
    await page.screenshot({path:`dist/validation/notes-fingering-${name}-${width}.png`});
    await instrumentPill(page).click();
    const menu = page.getByRole('dialog',{name:'Choose instrument',exact:true});
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0);
    await page.screenshot({path:`dist/validation/notes-instrument-picker-${name}-${width}.png`});
    await page.mouse.click(2,2);
    assert.equal(await menu.count(),0);
    await instrumentPill(page).blur();
  }
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.keyboard.down('j'); await page.waitForTimeout(410);
  assert.match(await page.locator('#practice-counts').textContent(), /1 attempts/);
  await page.waitForTimeout(500);
  assert.match(await page.locator('#practice-counts').textContent(), /1 attempts/);
  await chooseMethod(page,'names');
  await page.keyboard.up('j');
  assert.equal(await page.locator('.answer:visible').count(),18);
  await page.keyboard.press('c');
  assert.match(await page.locator('#practice-counts').textContent(), /2 attempts/);

  // Exercise real preset selection and responsive staff/input composition.
  for (const id of ['horn-f-starter','tuba-starter','euphonium-starter','flute-starter']) {
    const presetPage=await browser.newPage({viewport:{width:360,height:800}});
    presetPage.on('pageerror',e=>errors.push(e.message));
    await presetPage.goto(new URL('/notes/',host.url).href);
    await choosePreset(presetPage,id); await startPractice(presetPage);
    const select=presetPage.getByRole('group',{name:'Answer method',exact:true});
    await chooseMethod(presetPage,id==='flute-starter' ? 'keyboard' : 'fingering');
    if (id==='tuba-starter' || id==='euphonium-starter') {
      await selectInstrument(presetPage,id.replace('-starter','-4'));
      assert.equal(await presetPage.locator('.fingering-valve:visible').count(),4);
    }
    if (id==='horn-f-starter') assert.equal(await presetPage.locator('.fingering-valve:visible').count(),4);
    if (id==='flute-starter') {
      assert.equal(await presetPage.locator('.instrument-picker button').count(),11);
      assert.equal(await presetPage.locator('.piano-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      assert.equal(await presetPage.locator('.piano-key--white:visible').count(),8);
      await presetPage.getByRole('button',{name:/^Answer C[0-9]$/,exact:false}).first().click();
      assert.match(await presetPage.locator('#practice-counts').textContent(),/1 attempts/);
    }
    assert.ok(await presetPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const finish=await presetPage.getByRole('button',{name:'Finish',exact:true}).boundingBox();
    await presetPage.screenshot({path:`dist/validation/notes-layout-${id}-${name}.png`,fullPage:true});
    assert.ok(finish && finish.y+finish.height<=800,`${id}: Finish must remain onscreen ${JSON.stringify(finish)}`);
    await presetPage.screenshot({path:`dist/validation/notes-input-${id}-${name}.png`,fullPage:true});
    await presetPage.close();
  }

  // Phones rotate into an edge-mounted valve column, mirrored for the horn.
  for (const instrument of selectedLayouts) {
    const left = instrument==='horn-f';
    const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844}});
    const phone=await context.newPage(); phone.on('pageerror',e=>errors.push(e.message));
    await phone.goto(new URL('/notes/',host.url).href);
    await choosePreset(phone,`${instrument}-starter`); await startPractice(phone);
    await chooseMethod(phone,'fingering');
    if (['tuba','euphonium'].includes(instrument)) await selectInstrument(phone,`${instrument}-4`);
    for (const viewport of [{width:844,height:390},{width:667,height:375}]) {
      await phone.setViewportSize(viewport);
      await phone.waitForFunction(()=>document.querySelector('.play-stage--grip'));
      await phone.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const valves=await phone.locator('.fingering-valve:not(.fingering-trigger)').evaluateAll(bs=>bs.map(b=>{
        const r=b.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};
      }));
      const staff=await phone.locator('.practice-play > .staff-panel').boundingBox();
      const panel=await phone.locator('.interaction-body').boundingBox();
      const entry=await phone.locator('.note-entry').boundingBox();
      assert.ok(entry.y<=8 && entry.y+entry.height>=viewport.height-8,`Hand column spans the app viewport: ${JSON.stringify({entry,viewport})}`);
      const header=await phone.locator('.app-header').boundingBox();
      assert.ok(left ? header.x>=entry.x+entry.width : header.x+header.width<=entry.x,'Header moves beside the hand column');
      assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Landscape has no horizontal overflow');
      for (const [i,v] of valves.entries()) {
        assert.ok(v.x>=0 && v.y>=0 && v.x+v.w<=viewport.width && v.y+v.h<=viewport.height,JSON.stringify(v));
        assert.ok(v.y>=panel.y && v.y+v.h<=panel.y+panel.height,'Valves stay within the panel');
        assert.ok(v.w>=40 && v.h>=40, 'Valve targets remain usable after fitting the stage');
        if(i) assert.ok((strings.includes(instrument) || instrument==='horn-f' ? v.y>valves[i-1].y : v.y<valves[i-1].y) && Math.abs(v.x-valves[0].x)<1,'Finger order follows the instrument default');
        assert.ok(left ? v.x+v.w<staff.x : v.x>staff.x+staff.width,'Valves sit on the instrument hand side');
      }
      if(instrument==='horn-f') {
        const trigger=await phone.locator('.fingering-trigger').boundingBox();
        assert.ok(trigger.x>valves[0].x && trigger.y<valves[0].y && trigger.x+trigger.width<staff.x);
      }
      await phone.screenshot({path:`dist/validation/notes-grip-${instrument}-${viewport.width}-${name}.png`});
    }
    if(name==='chromium') {
      const cdp=await context.newCDPSession(phone), points=[];
      for(const n of [1,2]) {
        const r=await phone.getByRole('button',{name:`${strings.includes(instrument) ? 'Finger' : 'Valve'} ${n}`,exact:true}).boundingBox();
        points.push({x:r.x+r.width/2,y:r.y+r.height/2,id:n});
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
      assert.equal(await phone.locator('.fingering-valve[aria-pressed="true"]').count(),2);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await phone.locator('.fingering-input').getAttribute('data-code'),'00000|00000');
      await cdp.detach();
    }
    await phone.setViewportSize({width:390,height:844});
    await phone.waitForFunction(()=>!document.querySelector('.play-stage--grip'));
    await phone.setViewportSize({width:844,height:390});
    await phone.waitForFunction(()=>document.querySelector('.play-stage--grip'));
    await chooseMethod(phone,'names');
    await phone.waitForFunction(()=>!document.querySelector('.play-stage--grip'));
    await context.close();
  }

  for (const instrument of selectedLayouts) for (const profile of viewportProfiles) {
    const context=await browser.newContext({viewport:profile.viewport,hasTouch:profile.hasTouch});
    const screen=await context.newPage();
    await screen.goto(new URL('/notes/',host.url).href);
    await choosePreset(screen,`${instrument}-starter`);
    await screen.screenshot({path:`dist/validation/${instrument}-${profile.id}-setup-${name}.png`,fullPage:true});
    await startPractice(screen); await chooseMethod(screen,'fingering');
    if (['tuba','euphonium'].includes(instrument)) await selectInstrument(screen,`${instrument}-4`);
    console.log(`Checking ${instrument} ${profile.id}`);
    // Compact layout tools work in every position without submitting an answer.
    const move = screen.getByRole('button', {name:/^Move Panel:/});
    const flip = screen.locator('.fingering-flip');
    const originalPosition = await screen.locator('.note-entry').getAttribute('data-grip-position');
    for (let step = 0; step < 3; step++) {
      await move.click();
      await screen.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const position = await screen.locator('.note-entry').getAttribute('data-grip-position');
      await withAdjustment(screen, async () => { await flip.focus(); await screen.keyboard.press('Space'); });
      assert.equal(await flip.getAttribute('aria-pressed'),'true');
      assert.match(await screen.locator('#practice-counts').textContent(), /0 attempts/);
      await screen.screenshot({path:`dist/validation/grip-controls-${instrument}-${profile.id}-${position}-${name}.png`});
      await checkSpacings(screen,`${instrument} ${profile.id} ${position}`);
      const bounds = await screen.locator('.fingering-panel').boundingBox();
      for (const control of await screen.locator('.fingering-panel button:visible').all()) {
        const r = await control.boundingBox();
        assert.ok(r && r.x >= 0 && r.y >= 0 && r.x+r.width <= profile.viewport.width+1 && r.y+r.height <= profile.viewport.height+1,
          `${instrument} ${profile.id} ${position}: control offscreen ${JSON.stringify(r)}`);
        assert.ok(r.x >= bounds.x-1 && r.y >= bounds.y-1 && r.x+r.width <= bounds.x+bounds.width+1 && r.y+r.height <= bounds.y+bounds.height+1,
          `${instrument} ${profile.id} ${position}: control outside panel ${JSON.stringify({r,bounds})}`);
      }
      assert.ok(await screen.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${instrument} ${profile.id} ${position}: overflow ${JSON.stringify(await screen.locator('body *').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+1}).map(e=>({tag:e.tagName,cls:e.className,x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width})).slice(0,12)))}`);
      await adjustmentClick(screen, 'Flip finger order');
      await checkSpacings(screen,`${instrument} ${profile.id} ${position}`);
      if (['horn-f','violin'].includes(instrument)) await checkResize(screen, `${instrument} ${profile.id} ${position}`);
    }
    assert.equal(await screen.locator('.note-entry').getAttribute('data-grip-position'),originalPosition);
    await checkResize(screen, `${instrument} ${profile.id}`);
    if (instrument === 'horn-f' && profile.id === 'classroom') {
      await adjustmentClick(screen, 'Flip finger order');
      await adjustmentClick(screen, /^Spacing:/);
      await screen.getByRole('button',{name:'Adjust Input',exact:true}).click();
      await screen.getByRole('slider',{name:'Finger arrangement size'}).press('ArrowDown');
      await screen.getByRole('group',{name:'Finger arrangement position',exact:true}).press('ArrowLeft');
      await screen.getByRole('button',{name:'Done',exact:true}).click();
      await screen.reload(); await choosePreset(screen,'horn-f-starter'); await startPractice(screen); await chooseMethod(screen,'fingering');
      assert.equal(Number(await screen.locator('.note-entry').getAttribute('data-hand-scale')),0.9,'Size survives reload');
      assert.deepEqual(await screen.evaluate(()=>JSON.parse(localStorage.getItem('tunotes:finger-position:horn-f:landscape'))),{x:0.45,y:0.5});
      await screen.getByRole('button',{name:'Adjust Input',exact:true}).click();
      await screen.getByRole('group',{name:'Finger arrangement position',exact:true}).press('ArrowLeft');
      assert.deepEqual(await screen.evaluate(()=>JSON.parse(localStorage.getItem('tunotes:finger-position:horn-f:landscape'))),{x:0.4,y:0.5},'Position reloads before the next adjustment');
      await screen.getByRole('button',{name:'Done',exact:true}).click();
      assert.equal(await flip.getAttribute('aria-pressed'),'true','Saved flip survives reload');
      assert.equal(await screen.locator('.fingering-input').getAttribute('data-spacing'),'wide','Spacing survives reload');
      await screen.setViewportSize({width:1080,height:1920});
      await screen.waitForTimeout(100);
      assert.equal(await screen.locator('.fingering-input').getAttribute('data-spacing'),'wide','Spacing survives orientation change');
      assert.equal(Number(await screen.locator('.note-entry').getAttribute('data-hand-scale')),1,'New orientation has its own size');
      await screen.setViewportSize(profile.viewport);
      await screen.waitForTimeout(100);
      await adjustmentClick(screen, /^Spacing:/);
      await adjustmentClick(screen, /^Spacing:/);
      assert.equal(await screen.locator('.note-entry').getAttribute('data-grip-position'),originalPosition,'Saved position survives reload');
      assert.equal(Number(await screen.locator('.note-entry').getAttribute('data-hand-scale')),0.9,'Returning to the orientation restores size');
      await screen.getByRole('button',{name:'Adjust Input',exact:true}).click();
      await screen.getByRole('slider',{name:'Finger arrangement size'}).press('Home');
      await screen.getByRole('group',{name:'Finger arrangement position',exact:true}).press('ArrowLeft');
      assert.equal(await screen.evaluate(()=>JSON.parse(localStorage.getItem('tunotes:finger-position:horn-f:landscape')).x),0.35000000000000003,'Position survives rotation');
      await screen.getByRole('group',{name:'Finger arrangement position',exact:true}).press('Home');
      await screen.getByRole('button',{name:'Done',exact:true}).click();
      await adjustmentClick(screen, 'Flip finger order');
    }
    await flip.blur();
    const keys=instrument==='horn-f' ? ['e','w','v'] : strings.includes(instrument) ? ['f','d'] : ['j','k'];
    for(const key of keys) await screen.keyboard.down(key);
    assert.equal(await screen.locator('.fingering-input').getAttribute('data-code'),instrument==='horn-f' ? '00111|00000' : strings.includes(instrument) ? '00110|00000' : '00000|01100');
    await screen.waitForTimeout(410);
    for(const key of keys) await screen.keyboard.up(key);
    assert.ok(await screen.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await screen.screenshot({path:`dist/validation/${instrument}-${profile.id}-input-${name}.png`,fullPage:true});
    await instrumentPill(screen).click();
    const menu=await screen.getByRole('dialog',{name:'Choose instrument',exact:true}).boundingBox();
    assert.ok(menu.x>=0 && menu.y>=0 && menu.x+menu.width<=profile.viewport.width && menu.y+menu.height<=profile.viewport.height);
    await screen.screenshot({path:`dist/validation/${instrument}-${profile.id}-menu-${name}.png`,fullPage:true});
    await screen.keyboard.press('Escape');
    await screen.getByRole('button',{name:'Finish',exact:true}).click();
    await screen.screenshot({path:`dist/validation/${instrument}-${profile.id}-results-${name}.png`,fullPage:true});
    if (instrument === 'horn-f') {
      await notesMode(screen,'Challenge');
      await screen.getByRole('button',{name:'Start Challenge',exact:true}).click();
      await screen.clock.install();
      await screen.getByRole('button',{name:'Ready',exact:true}).click();
      await screen.clock.runFor(3100);
      await chooseMethod(screen,'fingering');
      for (let step = 0; step < 3; step++) {
        await move.click(); await screen.clock.runFor(100);
        const position = await screen.locator('.note-entry').getAttribute('data-grip-position');
        await screen.screenshot({path:`dist/validation/grip-challenge-${profile.id}-${position}-${name}.png`});
        const scene = await screen.locator('.challenge-scene').boundingBox();
        const finish = await screen.getByRole('button',{name:'Finish',exact:true}).boundingBox();
        assert.ok(scene.width >= 100 && scene.height >= 80,`Challenge notation needs room: ${profile.id} ${position} ${JSON.stringify(scene)}`);
        assert.ok(finish.y + finish.height <= profile.viewport.height + 1, `Challenge Finish offscreen: ${profile.id} ${position} ${JSON.stringify(finish)}`);
      }
      await screen.getByRole('button',{name:'Finish',exact:true}).click();
    }
    await context.close();
  }

}

try {
  const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(new URL('/notes/',host.url).href);
  await mkdir('dist/validation',{recursive:true});
  if (!process.env.TUNO_FINGERING_FIXTURE_ONLY) await checkLayouts(page);

  // Deterministic fixture uses the production entry surface and scoring engine.
  // Fixed pitches expose repeated-card, held-state, and correct-only edge cases.
  const fixture = await build({stdin:{contents:`
    import { noteEntry } from './src/apps/tunotes/ui/note-entry.ts';
    import { parsePitch, chromatic } from './src/apps/tunotes/domain/notation.ts';
    import { Practice } from './src/apps/tunotes/engine/practice.ts';
    import { normalizePreset } from './src/apps/tunotes/domain/presets.ts';
    const preset = normalizePreset({id:'fixture',name:'E4',instrument:'trumpet-bb',clef:'treble',range:['E4','E4'],content:'lines-and-spaces'});
    let session;
    const entry = noteEntry((answer,token)=>{
      if (!session.answer(token,answer)) return;
      entry.respond(session,{treat:false,text:''}); render();
    },{fingering:true,currentPitch:()=>session?.pitch,guidance:()=>false,showKeySignature:()=>false,disableGuidance:()=>{}});
    function render(){entry.update(session.preset,session.token,session.state!=='running');}
    window.fixture = {entry, changingFingerings(){
      const run = new Practice({...preset,pool:['C4','G4','E5','D4'].map(parsePitch)},false,()=>0,()=>.999,
        {continueAfter:'instant',inputFingering:()=>entry.inputFingering});
      const primary = () => entry.inputFingering.pitches[chromatic(run.pitch)][0];
      for(let i=0;i<20;i++) {
        const previous=primary(); run.answer(run.token,{kind:'fingering',code:previous}); run.advance(run.token);
        if(primary()===previous) throw new Error('Repeated primary fingering');
      }
    }, get session(){return session;}, sequence(first='E4',next='C4',instrument='trumpet-bb'){
      entry.reset(); session = new Practice({...preset,instrument,range:[next,first],pool:[parsePitch(next),parsePitch(first)]},false,()=>performance.now(),()=>0.999,{continueAfter:'instant'}); render();
    }, start(pitch='E4',pace='instant',instrument='trumpet-bb'){
      entry.reset(); session = new Practice({...preset,instrument,pool:[parsePitch(pitch)]},false,()=>performance.now(),Math.random,{continueAfter:pace}); render();
    }};
    document.body.replaceChildren(entry.node,entry.status);
    document.addEventListener('keydown',e=>{if(!e.target.closest('select')) entry.heldKeydown(e);});
    document.addEventListener('keyup',e=>entry.heldKeyup(e));
    window.addEventListener('blur',entry.reset);
    window.fixture.start();
  `,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife'});
  await page.addScriptTag({content:fixture.outputFiles[0].text});
  await chooseMethod(page,'fingering');
  await page.evaluate(()=>window.fixture.changingFingerings());
  const start = async (pitch='E4',pace='instant') => { await page.evaluate(([p,s])=>window.fixture.start(p,s),[pitch,pace]); };
  const attempts = () => page.evaluate(()=>window.fixture.session.attempts);
  const correct = () => page.evaluate(()=>window.fixture.session.correct);
  const code = () => page.locator('.fingering-input').getAttribute('data-code');
  const settle = () => page.waitForTimeout(410);
  // A held answer can intentionally release into the next primary-open card.
  await page.evaluate(()=>window.fixture.sequence());
  await page.keyboard.down('j'); await page.keyboard.down('k'); await settle();
  assert.equal(await correct(),1);
  await page.keyboard.up('j'); await page.waitForTimeout(50); await page.keyboard.up('k');
  await settle(); assert.equal(await correct(),2); assert.equal(await attempts(),2);
  await settle(); assert.equal(await attempts(),2);
  // Violin release-to-open uses D4/A4/E5 as primary open strings.
  for (const [first,next] of [['E4','D4'],['B4','A4'],['F#5','E5']]) {
    await page.evaluate(([first,next])=>window.fixture.sequence(first,next,'violin'),[first,next]);
    await chooseMethod(page,'fingering');
    await page.keyboard.down('f'); await settle(); assert.equal(await correct(),1,first);
    await page.keyboard.up('f'); await settle(); assert.equal(await correct(),2,next);
    await settle(); assert.equal(await attempts(),2,'Remaining open does not submit again');
  }
  await page.evaluate(()=>window.fixture.sequence());
  await chooseMethod(page,'fingering');
  // Real pointer release works too; pointer cancellation and layout reset do not.
  for (const action of ['release','cancel','move']) {
    await page.evaluate(()=>window.fixture.sequence());
    const valve=page.getByRole('button',{name:'Valve 3',exact:true});
    await valve.evaluate(el=>el.addEventListener('pointerdown',event=>{ window.fixture.pointerId=event.pointerId; },{once:true}));
    await valve.hover(); await page.mouse.down(); await settle(); assert.equal(await correct(),1);
    if (action==='cancel') await valve.dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>window.fixture.pointerId)});
    if (action==='move') await page.getByRole('button',{name:/^Move Panel:/}).dispatchEvent('pointerdown');
    await page.mouse.up(); await settle();
    assert.equal(await attempts(),action==='release' ? 2 : 1,action);
  }
  await start();
  // Layout actions during the settling window cancel held state and grading.
  for (const label of [/^Move Panel:/, 'Adjust Input']) {
    await page.keyboard.down('j');
    await page.getByRole('button',{name:label}).dispatchEvent('pointerdown');
    await settle(); assert.equal(await attempts(),0); assert.equal(await code(),'00000|00000');
    await page.keyboard.up('j');
  }
  const spacingControl = page.getByRole('button',{name:/^Spacing:/});
  const priorSpacing = await page.locator('.fingering-input').getAttribute('data-spacing');
  await withAdjustment(page, async () => { await spacingControl.focus(); await page.keyboard.press('Space'); });
  assert.notEqual(await page.locator('.fingering-input').getAttribute('data-spacing'),priorSpacing);
  await settle(); assert.equal(await attempts(),0,'Space on Spacing must not submit Open');
  await page.locator('.fingering-spacing').blur();
  await page.keyboard.down('j'); await page.waitForTimeout(90); await page.keyboard.down('k');
  assert.equal(await code(),'00000|01100'); assert.equal(await attempts(),0);
  await settle(); assert.equal(await correct(),1);
  await page.keyboard.down('k'); await settle(); assert.equal(await attempts(),1);
  assert.equal(await code(),'00000|01100');
  // A new intentional change can answer the repeated E without releasing all valves.
  await page.keyboard.down('l'); await page.keyboard.up('j'); await page.keyboard.up('k');
  await settle(); assert.equal(await correct(),2); assert.equal(await code(),'00000|00010');
  await page.keyboard.up('l'); await settle(); assert.equal(await attempts(),2);
  // Open answers are explicit, including repeated open notes.
  await start('C4');
  await selectInstrument(page,'trumpet-bb');
  await page.keyboard.press('Space');
  assert.equal(await correct(),1);
  assert.equal(await instrumentPill(page).getAttribute('aria-expanded'),'false');
  await start('C4'); await settle(); assert.equal(await attempts(),0);
  await page.getByRole('button',{name:'Open (Space)',exact:true}).click();
  assert.equal(await correct(),1); await settle(); assert.equal(await attempts(),1);
  await page.getByRole('button',{name:'Open (Space)',exact:true}).click(); assert.equal(await correct(),2);
  await page.getByRole('button',{name:'Valve 1',exact:true}).focus();
  await page.keyboard.down('Space'); assert.equal(await correct(),3);
  assert.equal(await code(),'00000|00000');
  await page.keyboard.down('Space'); await settle(); assert.equal(await attempts(),3);
  await page.keyboard.up('Space'); assert.equal(await attempts(),3);
  await page.keyboard.press('Space'); assert.equal(await correct(),4);
  await page.getByRole('button',{name:'Open (Space)',exact:true}).focus();
  await page.keyboard.press('Space'); assert.equal(await correct(),5);
  // Wrong settled combination retains existing correct-only feedback and score.
  await start('E4','correct'); await page.keyboard.down('j'); await settle();
  assert.equal(await attempts(),1); assert.equal(await correct(),0);
  assert.match(await page.locator('.answer-feedback-announcement').textContent(),/Try again/);
  await page.keyboard.up('j');
  // Cancellation and focus loss cancel pending submissions, not just visual state.
  await start(); await page.keyboard.down('j');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur'))); await settle();
  assert.equal(await attempts(),0); assert.equal(await code(),'00000|00000'); await page.keyboard.up('j');
  await page.keyboard.down('j'); await chooseMethod(page,'names');
  await chooseMethod(page,'fingering');
  await page.keyboard.down('j'); await settle(); assert.equal(await attempts(),0);
  await page.keyboard.up('j');
  // Native mouse pointer capture and cancellation.
  const valve = page.getByRole('button',{name:'Valve 1',exact:true});
  await valve.evaluate(b=>b.addEventListener('pointerdown',e=>b.dataset.testPointer=String(e.pointerId)));
  const bounds = await valve.boundingBox();
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2); await page.mouse.down();
  await valve.dispatchEvent('pointercancel',{pointerId:Number(await valve.getAttribute('data-test-pointer'))}); await settle();
  assert.equal(await attempts(),0); assert.equal(await code(),'00000|00000'); await page.mouse.up();
  // Real simultaneous touchscreen contacts, including partial release.
  if (name === 'chromium') {
    await page.setViewportSize({width:360,height:740});
    const cdp = await page.context().newCDPSession(page);
    const point = async (n,id) => { const b=await page.getByRole('button',{name:'Valve '+n,exact:true}).boundingBox(); return {x:b.x+b.width/2,y:b.y+b.height/2,id}; };
    const a=await point(1,10), b=await point(2,11);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
    await page.waitForTimeout(70);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});
    assert.equal(await code(),'00000|01100'); await settle(); assert.equal(await correct(),1);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[a]});
    assert.equal(await code(),'00000|00100');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await settle(); assert.equal(await attempts(),1); assert.equal(await code(),'00000|00000');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await cdp.detach();
  }
  // Horn trigger is an independent held thumb bit; F and B-flat sides share written pitch.
  await page.evaluate(()=>window.fixture.start('C4','instant','horn-f'));
  await chooseMethod(page,'fingering');
  assert.equal(await page.locator('.fingering-valve').count(),4);
  await page.keyboard.down('v'); assert.equal(await code(),'00001|00000');
  await settle(); assert.equal(await correct(),1);
  assert.match(await page.locator('.horn-side').textContent(),/B♭ side/);
  await settle(); assert.equal(await attempts(),1);
  await page.keyboard.up('v'); await settle(); assert.equal(await attempts(),2); assert.equal(await correct(),2);
  await page.getByRole('button',{name:'Open (Space)',exact:true}).click(); assert.equal(await correct(),3);
  await page.screenshot({path:`dist/validation/notes-horn-${name}.png`});
  assert.equal(await page.locator('.fingering-input').evaluate(root=>getComputedStyle(root).touchAction),'none','Gaps in the fingering surface also block pinch/pan');
  for (const type of ['touchstart','touchmove','gesturestart','gesturechange']) {
    const canceled = await page.evaluate(type=>{
      const inside = new Event(type,{bubbles:true,cancelable:true});
      const outside = new Event(type,{bubbles:true,cancelable:true});
      document.querySelector('.fingering-input').dispatchEvent(inside);
      document.body.dispatchEvent(outside);
      return {inside:inside.defaultPrevented,outside:outside.defaultPrevented};
    },type);
    assert.deepEqual(canceled,{inside:true,outside:false},`${type}: gesture guard stays within the fingering surface`);
  }
  if (name === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    for (const viewport of [{width:1366,height:650},{width:360,height:740}]) for (let preset = 0; preset < 3; preset++) {
      await page.setViewportSize(viewport);
      await page.evaluate(()=>window.fixture.start('D4','correct','horn-f'));
      const points = [];
      for (const [id,label] of ['Valve 1','Valve 2','Thumb trigger — B♭ side'].entries()) {
        const r = await page.getByRole('button',{name:label,exact:true}).boundingBox();
        points.push({x:r.x+r.width/2,y:r.y+r.height/2,id:id+1});
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[2]]});
      await page.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[2],points[0]]});
      await page.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
      assert.equal(await code(),'00111|00000');
      await settle(); assert.equal(await correct(),1,'Held valves and trigger still evaluate automatically');
      const initialScale = await page.evaluate(()=>visualViewport.scale);
      const moved = points.map((point,index)=>({...point,x:point.x+(index===2 ? -10 : 10),y:point.y+(index===2 ? 10 : -10)}));
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:moved});
      await page.waitForTimeout(80);
      assert.equal(await code(),'00111|00000','Pinch-like finger movement must retain T+1+2');
      assert.equal(await page.evaluate(()=>visualViewport.scale),initialScale,'Playing fingers must not zoom the page');
      const gap = await page.locator('.fingering-input').evaluate(root=>{
        const r=root.getBoundingClientRect(),x=r.left+2,y=r.top+2;
        return {x,y,isGap:document.elementFromPoint(x,y)===root};
      });
      assert.ok(gap.isGap,'Extra contact starts on the surface between targets');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[...moved,{x:gap.x,y:gap.y,id:4}]});
      assert.equal(await code(),'00111|00000','A contact in the gap does not release or add a valve');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[...moved,{x:gap.x+1,y:gap.y+1,id:4}]});
      await page.waitForTimeout(80);
      assert.equal(await code(),'00111|00000','A moving gap contact cannot steal held fingers');
      assert.equal(await page.evaluate(()=>visualViewport.scale),initialScale);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:gap.x+1,y:gap.y+1,id:4}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[points[0]]});
      assert.equal(await code(),'00101|00000','Partial release retains valve 2 and trigger');
      await page.keyboard.down('v'); await page.keyboard.up('v');
      assert.equal(await code(),'00101|00000','Keyboard release cannot release a held thumb touch');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await code(),'00000|00000');
      await adjustmentClick(page, /^Spacing:/);
    }
    await cdp.detach();
  }
  for (const [label,key] of [['Valve 1','E'],['Valve 2','W'],['Valve 3','Q'],['Thumb trigger — B♭ side','V']]) {
    const control = page.getByRole('button',{name:label,exact:true});
    assert.equal(await control.locator('kbd').textContent(),key,`${label}: visible shortcut matches the mirrored keyboard`);
    assert.equal(await control.getAttribute('aria-keyshortcuts'),key);
  }
  assert.equal(await page.locator('.fingering-help').textContent(), 'Hold fingers for best experience');
  // All horn key chords reach the held state, regardless of trigger press order or Flip.
  for (const triggerFirst of [true,false]) {
    await adjustmentClick(page, 'Flip finger order');
    for (let bits=0;bits<8;bits++) {
      await page.evaluate(()=>window.fixture.start('C4','correct','horn-f'));
      const valves=['e','w','q'].filter((_,i)=>bits & (1<<i));
      const keys=triggerFirst ? ['v',...valves] : [...valves,'v'];
      for (const key of keys) await page.keyboard.down(key);
      const expected='0'+[2,1,0].map(i=>bits & (1<<i) ? '1' : '0').join('')+'1|00000';
      assert.equal(await code(),expected,keys.join('+'));
      for (const key of [...keys].reverse()) await page.keyboard.up(key);
      assert.equal(await code(),'00000|00000');
    }
  }
  for (const [pitch,keys] of [['D4',['v','e','w']],['Db4',['v','w','q']],['C3',['v','e','q']]]) {
    await page.evaluate(p=>window.fixture.start(p,'instant','horn-f'),pitch);
    for (const key of keys) await page.keyboard.down(key);
    await settle(); assert.equal(await correct(),1,pitch+': '+keys.join('+'));
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
  }
  for (const [instrument,pitch] of [['euphonium','Bb2'],['tuba','Bb1']]) {
    await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,pitch]);
    assert.equal(await page.locator('.fingering-valve').count(),3);
    await page.getByRole('button',{name:'Open (Space)',exact:true}).click(); assert.equal(await correct(),1);
  }
  // Four-valve setups retain standard alternatives and safely switch while held.
  for (const [instrument,pitch,combined] of [['euphonium','F2','E2'],['tuba','F1','E1']]) {
    await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,pitch]);
    const valves={selectOption: value=>selectInstrument(page,value),blur:()=>instrumentPill(page).blur()};
    await valves.selectOption(`${instrument}-4`); await valves.blur();
    assert.equal(await page.locator('.fingering-valve').count(),4);
    await page.keyboard.down(';'); assert.equal(await code(),'00000|00001');
    await settle(); assert.equal(await correct(),1);
    await page.keyboard.down(';'); await settle(); assert.equal(await attempts(),1);
    await valves.selectOption(`${instrument}-3`); await page.keyboard.up(';'); await settle();
    assert.equal(await code(),'00000|00000'); assert.equal(await attempts(),1);
    await valves.selectOption(`${instrument}-4`); await valves.blur();
    await page.keyboard.down(';'); await valves.selectOption(`${instrument}-3`); await settle();
    assert.equal(await attempts(),1); await page.keyboard.up(';');
    await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,combined]);
    await valves.selectOption(`${instrument}-4`); await valves.blur();
    await page.keyboard.down('k'); await page.waitForTimeout(70); await page.keyboard.down(';');
    assert.equal(await code(),'00000|00101'); await settle(); assert.equal(await correct(),1);
    await page.keyboard.up('k'); await page.keyboard.up(';');
    // Real simultaneous touchscreen contacts on valves 2 and 4.
    if (name === 'chromium') {
      await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,combined]);
      const cdp=await page.context().newCDPSession(page);
      const points=[];
      for (const n of [2,4]) {
        const b=await page.getByRole('button',{name:`${strings.includes(instrument) ? 'Finger' : 'Valve'} ${n}`,exact:true}).boundingBox();
        points.push({x:b.x+b.width/2,y:b.y+b.height/2,id:n});
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
      assert.equal(await code(),'00000|00101'); await settle(); assert.equal(await correct(),1);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await code(),'00000|00000'); await cdp.detach();
    }
    await valves.selectOption(`${instrument}-3`);
  }
  // String answers share held-state timing, explicit Open and persistence grading.
  for(const [instrument,pitch,keys,openPitch] of [
    ['violin','F#4',['f','d'],'D4'], ['viola','F#4',['f','d'],'D4'],
    ['cello','F#3',['f','s'],'D3'], ['double-bass','F#3',['f','a'],'D3'],
  ]) {
    await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,pitch]);
    await chooseMethod(page,'fingering');
    assert.equal(await page.getByRole('button',{name:/^Finger [1-4]$/}).count(),4);
    await page.keyboard.down(keys[0]); await page.waitForTimeout(70); await page.keyboard.down(keys[1]);
    await settle(); assert.equal(await correct(),1);
    await settle(); assert.equal(await attempts(),1,'Held fingers do not answer the repeated note');
    await page.keyboard.up(keys[1]); await page.keyboard.down(keys[1]); await settle();
    assert.equal(await correct(),2);
    await chooseMethod(page,'names');
    for(const key of keys) await page.keyboard.up(key);
    await settle(); assert.equal(await attempts(),2);
    await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,openPitch]);
    await chooseMethod(page,'fingering');
    await settle(); assert.equal(await attempts(),0);
    await page.keyboard.press('Space'); assert.equal(await correct(),1);
    await page.getByRole('button',{name:'Open (Space)',exact:true}).click(); assert.equal(await correct(),2);
  }
  // The shared piano submits once per physical press, including a repeated target.
  await start('C4'); await chooseMethod(page,'keyboard');
  const c4=page.getByRole('button',{name:'Answer C4',exact:true});
  await c4.click(); assert.equal(await correct(),1); assert.equal(await attempts(),1);
  await c4.focus(); await page.keyboard.down('Enter'); assert.equal(await correct(),2);
  await page.keyboard.down('Enter'); await settle(); assert.equal(await attempts(),2);
  await page.keyboard.up('Enter');
  await page.keyboard.press('Space'); assert.equal(await correct(),3);
  await page.getByRole('button',{name:'Answer C5',exact:true}).click();
  assert.equal(await attempts(),4); assert.equal(await correct(),4);
  await page.getByRole('button',{name:'Answer D4',exact:true}).click();
  assert.equal(await correct(),4);
  assert.equal(await page.getByRole('checkbox',{name:'Match octave',exact:true}).count(),0);
  assert.equal(await page.locator('.keyboard-help, .keyboard-answers select').count(),0);
  assert.ok(await page.locator('.piano-key').evaluateAll(keys=>keys.every(key=>!key.textContent)));
  await start('Db4'); await page.getByRole('button',{name:'Answer C♯4',exact:true}).click(); assert.equal(await correct(),1);
  for (const width of [1280,360]) {
    await page.setViewportSize({width,height:800});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`dist/validation/notes-keyboard-${name}-${width}.png`});
  }
  await chooseMethod(page,'fingering'); await page.keyboard.down('j');
  await chooseMethod(page,'keyboard'); await page.keyboard.up('j'); await settle(); assert.equal(await attempts(),1);
  await start('C4');
  await selectInstrument(page,'horn-f');
  await page.keyboard.down('v'); await settle(); assert.equal(await correct(),1);
  assert.equal(await page.evaluate(()=>window.fixture.session.last.answer.instrument),'horn-f');
  await selectInstrument(page,'trumpet-bb');
  assert.equal(await code(),'00000|00000');
  await page.keyboard.up('v'); await settle(); assert.equal(await attempts(),1);
  // Failed writes retain the chosen session spacing, even if an older value is readable.
  await selectInstrument(page,'horn-f');
  const originalViewport = page.viewportSize();
  await page.evaluate(() => {
    const key = 'tunotes:finger-spacing:horn-f';
    localStorage.setItem(key,document.querySelector('.fingering-input').dataset.spacing);
    const write = Storage.prototype.setItem;
    window.fixture.restoreStorage = () => { Storage.prototype.setItem = write; };
    Storage.prototype.setItem = function(key,value) {
      if (key.startsWith('tunotes:finger-spacing:') || key.startsWith('tunotes:finger-scale:') || key.startsWith('tunotes:finger-position:')) throw new DOMException('Fixture storage denial','QuotaExceededError');
      return write.call(this,key,value);
    };
  });
  try {
    await adjustmentClick(page, /^Spacing:/);
    const selected = await page.locator('.fingering-input').getAttribute('data-spacing');
    await page.getByRole('button',{name:'Adjust Input',exact:true}).click();
    await page.getByRole('slider',{name:'Finger arrangement size'}).press('ArrowDown');
    const selectedSize = await page.locator('.note-entry').getAttribute('data-hand-scale');
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.setViewportSize({width:800,height:360});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.fingering-input').getAttribute('data-spacing'),selected,'Session spacing survives failed storage writes and rotation');
    await page.setViewportSize(originalViewport);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.fingering-input').getAttribute('data-spacing'),selected);
    assert.equal(await page.locator('.note-entry').getAttribute('data-hand-scale'),selectedSize,'Session size survives failed writes and rotation');
  } finally { await page.evaluate(()=>window.fixture.restoreStorage()); }
  assert.deepEqual(errors,[]);
  console.log(`${name}: fingering keyboard, touch, scoring, repeated notes, open, cancellation, and method switching passed`);
} finally { await browser.close(); await host.close(); }
