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

  // Deterministic fixture uses the production entry surface and scoring engine.
  // Fixed pitches expose repeated-card, held-state, and correct-only edge cases.
  const fixture = await build({stdin:{contents:`
    import { noteEntry } from './src/apps/tunotes/ui/note-entry.ts';
    import { Practice } from './src/apps/tunotes/engine/practice.ts';
    import { normalizePreset } from './src/apps/tunotes/domain/presets.ts';
    const preset = normalizePreset({id:'fixture',name:'E4',instrument:'trumpet-bb',clef:'treble',range:['E4','E4'],content:'lines-and-spaces'});
    let session;
    const entry = noteEntry((answer,token)=>{
      if (!session.answer(token,answer)) return;
      entry.respond(session,{treat:false,text:''}); render();
    },{fingering:true,guidance:()=>false,showKeySignature:()=>false,disableGuidance:()=>{}});
    function render(){entry.update(session.preset,session.token,session.state!=='running');}
    window.fixture = {entry, get session(){return session;}, start(pitch='E4',pace='instant'){
      entry.reset(); session = new Practice({...preset,pool:[{...preset.pool[0],letter:pitch[0],octave:Number(pitch[1])}]},false,()=>performance.now(),Math.random,{continueAfter:pace}); render();
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
  await page.getByRole('button',{name:'Open (0)',exact:true}).click();
  assert.equal(await correct(),1); await settle(); assert.equal(await attempts(),1);
  await page.getByRole('button',{name:'Open (0)',exact:true}).click(); assert.equal(await correct(),2);
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
  assert.deepEqual(errors,[]);
  console.log(`${name}: fingering keyboard, touch, scoring, repeated notes, open, cancellation, and method switching passed`);
} finally { await browser.close(); await host.close(); }
