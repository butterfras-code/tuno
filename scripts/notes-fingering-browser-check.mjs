import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { build } from 'esbuild';
import { hostBuild } from './test-host.mjs';
import { choosePreset, startPractice } from './notes-setup-helpers.mjs';

const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({chromium,firefox})[name].launch();
const host = await hostBuild();
const errors = [];
try {
  const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(new URL('/notes/',host.url).href);
  await choosePreset(page,'trumpet-bb-starter'); await startPractice(page);
  await page.getByLabel('Answer method',{exact:true}).selectOption('fingering');
  assert.equal(await page.getByRole('button',{name:/^Valve [123]$/}).count(),3);
  await mkdir('dist/validation',{recursive:true});
  for (const width of [1280,360]) {
    await page.setViewportSize({width,height:800});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const buttons = await page.locator('.fingering-valve:visible').evaluateAll(bs=>bs.map(b=>({w:b.clientWidth,h:b.clientHeight})));
    assert.ok(buttons.every(b=>b.w>=44 && b.h>=44));
    await page.screenshot({path:`dist/validation/notes-fingering-${name}-${width}.png`});
  }
  await page.setViewportSize({width:1280,height:800});
  await page.keyboard.down('j'); await page.waitForTimeout(260);
  assert.match(await page.locator('#practice-counts').textContent(), /1 attempts/);
  await page.waitForTimeout(500);
  assert.match(await page.locator('#practice-counts').textContent(), /1 attempts/);
  await page.getByLabel('Answer method',{exact:true}).selectOption('names');
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
    const select=presetPage.getByLabel('Answer method',{exact:true});
    await select.selectOption(id==='flute-starter' ? 'keyboard' : 'fingering');
    if (id==='tuba-starter' || id==='euphonium-starter') {
      await presetPage.getByLabel('Valve configuration',{exact:true}).selectOption('4');
      assert.equal(await presetPage.locator('.fingering-valve:visible').count(),4);
    }
    if (id==='horn-f-starter') assert.equal(await presetPage.locator('.fingering-valve:visible').count(),4);
    if (id==='flute-starter') {
      assert.equal(await select.locator('option[value="fingering"]').evaluate(o=>o.disabled),true);
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

  // Deterministic fixture uses the production entry surface and scoring engine.
  // Fixed pitches expose repeated-card, held-state, and correct-only edge cases.
  const fixture = await build({stdin:{contents:`
    import { noteEntry } from './src/apps/tunotes/ui/note-entry.ts';
    import { parsePitch } from './src/apps/tunotes/domain/notation.ts';
    import { Practice } from './src/apps/tunotes/engine/practice.ts';
    import { normalizePreset } from './src/apps/tunotes/domain/presets.ts';
    const preset = normalizePreset({id:'fixture',name:'E4',instrument:'trumpet-bb',clef:'treble',range:['E4','E4'],content:'lines-and-spaces'});
    let session;
    const entry = noteEntry((answer,token)=>{
      if (!session.answer(token,answer)) return;
      entry.respond(session,{treat:false,text:''}); render();
    },{fingering:true,guidance:()=>false,showKeySignature:()=>false,disableGuidance:()=>{}});
    function render(){entry.update(session.preset,session.token,session.state!=='running');}
    window.fixture = {entry, get session(){return session;}, start(pitch='E4',pace='instant',instrument='trumpet-bb'){
      entry.reset(); session = new Practice({...preset,instrument,pool:[parsePitch(pitch)]},false,()=>performance.now(),Math.random,{continueAfter:pace}); render();
    }};
    document.body.replaceChildren(entry.node,entry.status);
    document.addEventListener('keydown',e=>{if(!e.target.closest('select')) entry.heldKeydown(e);});
    document.addEventListener('keyup',e=>entry.heldKeyup(e));
    window.addEventListener('blur',entry.reset);
    window.fixture.start();
  `,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife'});
  await page.addScriptTag({content:fixture.outputFiles[0].text});
  const method = page.getByLabel('Answer method',{exact:true});
  await method.selectOption('fingering'); await method.blur();
  const start = async (pitch='E4',pace='instant') => { await page.evaluate(([p,s])=>window.fixture.start(p,s),[pitch,pace]); };
  const attempts = () => page.evaluate(()=>window.fixture.session.attempts);
  const correct = () => page.evaluate(()=>window.fixture.session.correct);
  const mask = () => page.locator('.fingering-input').getAttribute('data-mask');
  const settle = () => page.waitForTimeout(260);
  await page.keyboard.down('j'); await page.waitForTimeout(90); await page.keyboard.down('k');
  assert.equal(await mask(),'00001100'); assert.equal(await attempts(),0);
  await settle(); assert.equal(await correct(),1);
  await page.keyboard.down('k'); await settle(); assert.equal(await attempts(),1);
  assert.equal(await mask(),'00001100');
  // A new intentional change can answer the repeated E without releasing all valves.
  await page.keyboard.down('l'); await page.keyboard.up('j'); await page.keyboard.up('k');
  await settle(); assert.equal(await correct(),2); assert.equal(await mask(),'00000010');
  await page.keyboard.up('l'); await settle(); assert.equal(await attempts(),2);
  // Open answers are explicit, including repeated open notes.
  await start('C4'); await settle(); assert.equal(await attempts(),0);
  await page.getByRole('button',{name:'Open (Space)',exact:true}).click();
  assert.equal(await correct(),1); await settle(); assert.equal(await attempts(),1);
  await page.getByRole('button',{name:'Open (Space)',exact:true}).click(); assert.equal(await correct(),2);
  await page.getByRole('button',{name:'Valve 1',exact:true}).focus();
  await page.keyboard.down('Space'); assert.equal(await correct(),3);
  assert.equal(await mask(),'00000000');
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
  assert.equal(await attempts(),0); assert.equal(await mask(),'00000000'); await page.keyboard.up('j');
  await page.keyboard.down('j'); await method.selectOption('names');
  await method.selectOption('fingering'); await method.blur();
  await page.keyboard.down('j'); await settle(); assert.equal(await attempts(),0);
  await page.keyboard.up('j');
  // Native mouse pointer capture and cancellation.
  const valve = page.getByRole('button',{name:'Valve 1',exact:true});
  await valve.evaluate(b=>b.addEventListener('pointerdown',e=>b.dataset.testPointer=String(e.pointerId)));
  const bounds = await valve.boundingBox();
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2); await page.mouse.down();
  await valve.dispatchEvent('pointercancel',{pointerId:Number(await valve.getAttribute('data-test-pointer'))}); await settle();
  assert.equal(await attempts(),0); assert.equal(await mask(),'00000000'); await page.mouse.up();
  // Real simultaneous touchscreen contacts, including partial release.
  if (name === 'chromium') {
    await page.setViewportSize({width:360,height:740});
    const cdp = await page.context().newCDPSession(page);
    const point = async (n,id) => { const b=await page.getByRole('button',{name:'Valve '+n,exact:true}).boundingBox(); return {x:b.x+b.width/2,y:b.y+b.height/2,id}; };
    const a=await point(1,10), b=await point(2,11);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
    await page.waitForTimeout(70);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});
    assert.equal(await mask(),'00001100'); await settle(); assert.equal(await correct(),1);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[a]});
    assert.equal(await mask(),'00000100');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await settle(); assert.equal(await attempts(),1); assert.equal(await mask(),'00000000');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await cdp.detach();
  }
  // Horn trigger is an independent held thumb bit; F and B-flat sides share written pitch.
  await page.evaluate(()=>window.fixture.start('C4','instant','horn-f'));
  await method.selectOption('fingering'); await method.blur();
  assert.equal(await page.locator('.fingering-valve').count(),4);
  await page.keyboard.down('n'); assert.equal(await mask(),'00010000');
  await settle(); assert.equal(await correct(),1);
  assert.match(await page.locator('.horn-side').textContent(),/B♭ side/);
  await settle(); assert.equal(await attempts(),1);
  await page.keyboard.up('n'); await settle(); assert.equal(await attempts(),1);
  await page.getByRole('button',{name:'Open (Space)',exact:true}).click(); assert.equal(await correct(),2);
  await page.screenshot({path:`dist/validation/notes-horn-${name}.png`});
  for (const [instrument,pitch] of [['euphonium','Bb2'],['tuba','Bb1']]) {
    await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,pitch]);
    assert.equal(await page.locator('.fingering-valve').count(),3);
    await page.getByRole('button',{name:'Open (Space)',exact:true}).click(); assert.equal(await correct(),1);
  }
  // Four-valve setups retain standard alternatives and safely switch while held.
  for (const [instrument,pitch,combined] of [['euphonium','F2','E2'],['tuba','F1','E1']]) {
    await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,pitch]);
    const valves=page.getByLabel('Valve configuration',{exact:true});
    await valves.selectOption('4'); await valves.blur();
    assert.equal(await page.locator('.fingering-valve').count(),4);
    await page.keyboard.down(';'); assert.equal(await mask(),'00000001');
    await settle(); assert.equal(await correct(),1);
    await page.keyboard.down(';'); await settle(); assert.equal(await attempts(),1);
    await valves.selectOption('3'); await page.keyboard.up(';'); await settle();
    assert.equal(await mask(),'00000000'); assert.equal(await attempts(),1);
    await valves.selectOption('4'); await valves.blur();
    await page.keyboard.down(';'); await valves.selectOption('3'); await settle();
    assert.equal(await attempts(),1); await page.keyboard.up(';');
    await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,combined]);
    await valves.selectOption('4'); await valves.blur();
    await page.keyboard.down('k'); await page.waitForTimeout(70); await page.keyboard.down(';');
    assert.equal(await mask(),'00000101'); await settle(); assert.equal(await correct(),1);
    await page.keyboard.up('k'); await page.keyboard.up(';');
    // Real simultaneous touchscreen contacts on valves 2 and 4.
    if (name === 'chromium') {
      await page.evaluate(([i,p])=>window.fixture.start(p,'instant',i),[instrument,combined]);
      const cdp=await page.context().newCDPSession(page);
      const points=[];
      for (const n of [2,4]) {
        const b=await page.getByRole('button',{name:`Valve ${n}`,exact:true}).boundingBox();
        points.push({x:b.x+b.width/2,y:b.y+b.height/2,id:n});
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
      assert.equal(await mask(),'00000101'); await settle(); assert.equal(await correct(),1);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await mask(),'00000000'); await cdp.detach();
    }
    await valves.selectOption('3');
  }
  // The shared piano submits once per physical press, including a repeated target.
  await start('C4'); await method.selectOption('keyboard'); await method.blur();
  const c4=page.getByRole('button',{name:'Answer C4',exact:true});
  await c4.click(); assert.equal(await correct(),1); assert.equal(await attempts(),1);
  await c4.focus(); await page.keyboard.down('Enter'); assert.equal(await correct(),2);
  await page.keyboard.down('Enter'); await settle(); assert.equal(await attempts(),2);
  await page.keyboard.up('Enter');
  await page.keyboard.press('Space'); assert.equal(await correct(),3);
  await page.getByRole('button',{name:'+ Octave',exact:true}).click();
  await page.getByRole('button',{name:'Answer C5',exact:true}).click();
  assert.equal(await attempts(),4); assert.equal(await correct(),4);
  await page.getByRole('button',{name:'Answer D5',exact:true}).click();
  assert.equal(await correct(),4);
  await page.getByRole('checkbox',{name:'Match octave',exact:true}).check();
  await page.getByRole('button',{name:'Answer C5',exact:true}).click();
  assert.equal(await correct(),4); assert.equal(await attempts(),6);
  await page.getByRole('button',{name:'− Octave',exact:true}).click();
  await c4.click(); assert.equal(await correct(),5);
  await page.getByRole('checkbox',{name:'Match octave',exact:true}).uncheck();
  await start('Db4'); await page.getByRole('button',{name:'Answer C♯4',exact:true}).click(); assert.equal(await correct(),1);
  for (const width of [1280,360]) {
    await page.setViewportSize({width,height:800});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`dist/validation/notes-keyboard-${name}-${width}.png`});
  }
  await method.selectOption('fingering'); await page.keyboard.down('j');
  await method.selectOption('keyboard'); await page.keyboard.up('j'); await settle(); assert.equal(await attempts(),1);
  assert.deepEqual(errors,[]);
  console.log(`${name}: fingering keyboard, touch, scoring, repeated notes, open, cancellation, and method switching passed`);
} finally { await browser.close(); await host.close(); }
