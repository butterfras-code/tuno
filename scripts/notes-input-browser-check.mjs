import { notesMode, openData, setToggle, setPacing } from './notes-setup-helpers.mjs';
import { choosePreset, setEndpoint, setModifiers } from './notes-setup-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[name].launch();
const host = await hostBuild();
const results = [], errors = [];
const button = (page, letter, accidental = 0) => page.locator(`.answer[data-letter="${letter}"][data-accidental="${accidental}"]`).first();
const center = async locator => { await locator.scrollIntoViewIfNeeded(); const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
const count = async (page, n) => assert.match(await page.locator('#practice-counts').textContent(), new RegExp(`/ ${n} attempts`));
try {
  await mkdir('dist/validation', { recursive: true });
  const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(new URL('/notes/', host.url).href);
  await choosePreset(page,'flute-starter');
  await setPacing(page,'Click/Tap'); await setToggle(page,'meet-notes',false); await page.getByRole('button', { name: 'Start Practice', exact: true }).first().click();
  assert.equal(await page.locator('.answer').count(), 18);
  assert.equal(await page.locator('#answer-accidental').count(), 0);
  assert.equal(await button(page, 'B', -1).evaluate(b => b.classList.contains('answer-default')), true);
  assert.equal(await button(page, 'B').getAttribute('aria-disabled'), 'false');
  assert.equal(await page.locator('.answer[aria-disabled="false"]').count(), 18);
  // Held modifiers illuminate their whole row, including muted unavailable targets.
  for (const [arrow, accidental] of [['ArrowDown', -1], ['ArrowUp', 1], ['ArrowRight', 0]]) {
    await page.keyboard.down(arrow);
    assert.equal(await page.locator('.keycap-held').getAttribute('data-accidental'), String(accidental));
    const cap = await page.locator('.keycap-held').boundingBox();
    const target = await page.locator(`.answer[data-accidental="${accidental}"]`).first().boundingBox();
    assert.ok(cap.x + cap.width < target.x);
    assert.ok(Math.abs(cap.y + cap.height / 2 - target.y - target.height / 2) < 1);
    assert.deepEqual(await page.locator('.answer-modifier').evaluateAll(bs => [...new Set(bs.map(b => b.dataset.accidental))]), [String(accidental)]);
    assert.equal(await page.locator('.answer-modifier').count(), await page.locator(`.answer[data-accidental="${accidental}"]`).count());
    await page.keyboard.up(arrow);
    assert.equal(await page.locator('.keycap-held').count(), 0);
    assert.equal(await page.locator('.answer-modifier').count(), 0);
  }
  await page.keyboard.down('ArrowDown');
  const glow = await button(page, 'B', -1).evaluate(b => ({ shadow: getComputedStyle(b).boxShadow, opacity: getComputedStyle(b).opacity }));
  const mutedGlow = await button(page, 'D', -1).evaluate(b => ({ shadow: getComputedStyle(b).boxShadow, opacity: getComputedStyle(b).opacity }));
  assert.notEqual(glow.shadow, 'none'); assert.notEqual(mutedGlow.shadow, 'none');
  assert.ok(Number(mutedGlow.opacity) < Number(glow.opacity));
  await page.locator('.answer-input').screenshot({path:`dist/validation/notes-input-${name}-flat-held.png`});
  await page.keyboard.down('ArrowUp'); assert.equal(await page.locator('.answer-modifier').count(), 0);
  await page.keyboard.up('ArrowUp'); assert.equal(await page.locator('.answer-modifier.answer-flat').count(), 5);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal(await page.locator('.answer-modifier').count(), 0); await page.keyboard.up('ArrowDown');
  await page.keyboard.down('ArrowDown'); await page.getByRole('button', {name:'Pause', exact:true}).click();
  assert.equal(await page.locator('.answer-modifier').count(), 0);
  await page.keyboard.up('ArrowDown'); await page.getByRole('button', {name:'Resume', exact:true}).click();
  results.push('Held arrow highlights the matching row; unavailable keys have muted glow; release, conflicting arrows, blur and pause clear the highlight');
  await button(page, 'B').click(); await count(page,1);
  assert.match(await page.locator('#practice-counts').textContent(),/0 correct.*Streak 0/);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.keyboard.press('b'); await count(page,2);
  assert.match(await page.locator('#practice-counts').textContent(),/0 correct.*Streak 0/);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.keyboard.down('ArrowDown'); await page.keyboard.press('b'); await page.keyboard.up('ArrowDown'); await count(page,3);
  const positions = await page.locator('.answer:visible').evaluateAll(bs => bs.map(b => { const r=b.getBoundingClientRect(); return [r.x+scrollX,r.y+scrollY,r.width,r.height]; }));
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  assert.deepEqual(await page.locator('.answer:visible').evaluateAll(bs => bs.map(b => { const r=b.getBoundingClientRect(); return [r.x+scrollX,r.y+scrollY,r.width,r.height]; })), positions);
  // Dragging between notes cancels; only a direct click submits.
  let from = await center(button(page, 'B')), to = await center(button(page, 'B', -1));
  await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.mouse.move(to.x,to.y,{steps:4});
  assert.equal(await page.locator('.answer-preview').textContent(), 'Tap a note to answer.');
  assert.equal(await page.locator('.answer-pending').count(), 0);
  await page.mouse.up(); await count(page,3);
  await button(page,'B',-1).click(); await count(page,4);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  from = await center(button(page,'B',-1));
  await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.mouse.move(1,1); await page.mouse.up(); await count(page,4);
  await page.mouse.move(from.x,from.y); await page.mouse.down();
  await page.getByRole('button', { name: 'Pause', exact: true }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'Resume', exact: true }).first().dispatchEvent('click');
  await page.mouse.up(); await count(page,4);
  const starts=page.locator('.answer[data-letter="F"][data-accidental="0"]');
  assert.equal(await starts.count(),2);
  await starts.last().click(); await count(page,5);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await starts.first().click(); await count(page,6);
  results.push('Tonic-to-tonic targets with half-key offsets; F-major B-flat default; out-of-pool natural counts as a miss; positions stable across prompts; mouse drag between notes cancels; outside release and pause cancel');
  await page.getByRole('button', { name: 'Finish', exact: true }).first().click(); await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  await choosePreset(page,'custom');
  await setEndpoint(page,'Lowest note','Db4'); await setEndpoint(page,'Highest note','G4'); await page.getByLabel('Major key',{exact:true}).selectOption('C'); await setModifiers(page,['key','flat','natural','sharp']);
  await openData(page); await page.getByRole('button',{name:'Add profile',exact:true}).first().click(); await page.getByLabel('Profile name',{exact:true}).fill('Input fixture'); await page.getByLabel('Profile name',{exact:true}).press('Enter');
  await setToggle(page,'meet-notes',false); await page.getByRole('button', { name: 'Start Practice', exact: true }).first().click();
  const submitted=[];
  let n=0;
  const next = () => page.getByRole('button',{name:'Continue',exact:true}).first().click();
  for (const [arrow,shift,accidental] of [['ArrowUp',false,1],['ArrowDown',false,-1],['ArrowRight',false,0],['ArrowRight',true,0]]) {
    await page.keyboard.down(arrow); if(shift) await page.keyboard.down('Shift');
    await page.keyboard.down('d'); await count(page,++n); submitted.push('D'+accidental);
    await next(); await page.keyboard.down('d'); await count(page,n);
    await page.keyboard.up('d'); if(shift) await page.keyboard.up('Shift'); await page.keyboard.up(arrow);
    // The focused exact spelling also works independent of key defaults.
    await button(page,'D',accidental).focus(); await page.keyboard.press('Space'); await count(page,++n); submitted.push('D'+accidental); await next();
  }
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowDown'); await page.keyboard.press('d'); await count(page,n); await page.keyboard.up('ArrowDown'); await page.keyboard.up('ArrowUp');
  // Keyboard submission cancels a pending pointer; its later release cannot answer the next card.
  from = await center(button(page,'D')); to = await center(button(page,'D',1));
  await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.keyboard.press('g'); await count(page,++n); submitted.push('G0'); await next();
  await page.mouse.move(to.x,to.y); await page.mouse.up(); await count(page,n);
  for(const width of [360,768,1280]) {
    await page.setViewportSize({width,height:950});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    assert.ok(await page.locator('.answer:visible').evaluateAll(bs => bs.every(b => { const r=b.getBoundingClientRect(); return r.width>=44 && r.height>=44; })));
    await page.screenshot({path:`dist/validation/notes-input-${name}-${width}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'Finish',exact:true}).first().click();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('tunotes:data:v1')).profiles[0].contexts.flatMap(c=>Object.values(c.notes).flat()).map(o=>o.answer.letter+o.answer.accidental).sort()),submitted.sort());
  results.push('Arrow sharp/flat/natural shortcuts; held letter rejection; focused exact spelling; conflicting arrows ignored; pointer token invalidated by keyboard answer; 44px targets at 360/768/1280');
  // Isolated adapter fixture tests exact submitted spellings and the future pool-update hook.
  const compiled = await build({stdin:{contents:`import {answerControls} from './src/apps/tunotes/ui/answers.ts'; import {normalizePreset} from './src/apps/tunotes/domain/presets.ts'; import {keySignature} from './src/apps/tunotes/domain/notation.ts';
    window.received=[]; window.control=answerControls((a,t)=>window.received.push({a,t})); document.body.append(window.control.node);
    window.setPool=(policy='key-only',key='F',range=['B4','B4'])=>window.control.update(normalizePreset({id:'fixture',name:'Fixture',clef:'treble',range,content:'lines-and-spaces',accidentals:policy,key:keySignature(key)}),{session:1,prompt:1},false); window.setPool();`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'});
  const fixture=await browser.newPage(); fixture.on('pageerror',e=>errors.push(e.message));
  await fixture.goto(new URL('/notes/', host.url).href); await fixture.evaluate(() => { document.body.replaceChildren(); });
  await fixture.addScriptTag({content:compiled.outputFiles[0].text});
  await fixture.evaluate(() => { window.control.letter('B'); window.control.letter('B',-1); });
  assert.deepEqual(await fixture.evaluate(()=>window.received.map(r=>r.a)),[{letter:'B',accidental:0},{letter:'B',accidental:-1}]);
  await fixture.evaluate(()=>window.setPool('both'));
  assert.equal(await fixture.locator('.answer-added').count(),1);
  await fixture.evaluate(()=>{window.control.letter('B',0);window.control.letter('B',1);});
  assert.deepEqual(await fixture.evaluate(()=>window.received.map(r=>r.a)),[{letter:'B',accidental:0},{letter:'B',accidental:-1},{letter:'B',accidental:0}]);
  await fixture.evaluate(()=>{window.setPool('key-only','C',['C4','B4']); document.querySelectorAll('.answer-added').forEach(b=>b.classList.remove('answer-added')); window.setPool('key-only','C',['C3','B5']);});
  assert.equal(await fixture.locator('.answer-added').count(),0); // New octaves do not reactivate existing spellings.
  await fixture.evaluate(()=>{window.setPool('key-only','F',['B4','B4']);window.setPool('both');});
  await fixture.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await fixture.locator('.answer-added').first().evaluate(b=>getComputedStyle(b).animationName),'none');
  await fixture.evaluate(()=>{window.control.update({id:'x',name:'x',key:{tonic:{letter:'F',accidental:0},fifths:-1,mode:'major'},pool:[{letter:'B',accidental:-1,octave:4}]},{session:2,prompt:1},false);window.setPool('key-only','F',['B4','B5']);});
  // New session/pool starts do not animate targets as adaptive additions.
  assert.equal(await fixture.locator('.answer-added').count(),0);
  results.push('Shared adapter submits exact spelling; enabling additional spellings animates in place; new session does not animate; reduced motion disables activation animation');
  if(name==='chromium') {
    const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844}}); const touch=await context.newPage(); touch.on('pageerror',e=>errors.push(e.message));
    await touch.goto(new URL('/notes/', host.url).href); await choosePreset(touch,'flute-starter'); await setPacing(touch,'Click/Tap'); await setToggle(touch,'meet-notes',false); await touch.getByRole('button',{name:'Start Practice',exact:true}).first().tap();
    await button(touch,'B',-1).tap(); await count(touch,1);
    await touch.getByRole('button',{name:'Continue',exact:true}).first().tap();
    await touch.waitForFunction(() => document.querySelector('.answer[data-letter="B"][data-accidental="-1"]').getAttribute('aria-disabled') === 'false',null,{timeout:3000});
    await touch.getByRole('button',{name:'Finish',exact:true}).first().tap(); await touch.getByRole('button',{name:'Home',exact:true}).first().tap();
    await setPacing(touch,'Delay'); await setToggle(touch,'meet-notes',false); await touch.getByRole('button',{name:'Start Practice',exact:true}).first().tap();
    from=await center(button(touch,'B')); to=await center(button(touch,'B',-1));
    const cdp=await context.newCDPSession(touch);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to.x,y:to.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await count(touch,0);
    await button(touch,'B',-1).tap(); await count(touch,1);
    await touch.waitForFunction(() => document.querySelector('.answer[data-letter="B"][data-accidental="-1"]').getAttribute('aria-disabled') === 'false',null,{timeout:3000});
    from=await center(button(touch,'B',-1));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); await count(touch,1);
    await button(touch,'B',-1).tap(); await count(touch,2);
    await context.close(); results.push('Chromium touch emulation: self-paced direct answer/Continue; drag between notes cancels; direct tap with automatic feedback, pointer cancellation, subsequent direct tap, no duplicate synthetic click');
  }
  for (const [preset,tonic,accidental] of [['keyboards-starter','C',0],['trombone-starter','B',-1],['alto-sax-starter','G',0]]) {
    const preview=await browser.newPage({viewport:{width:1000,height:950}});
    await preview.goto(new URL('/notes/', host.url).href); await choosePreset(preview,preset);
    await setToggle(preview,'meet-notes',false); await preview.getByRole('button',{name:'Start Practice',exact:true}).click();
    const endpoints=preview.locator(`.answer[data-letter="${tonic}"][data-accidental="${accidental}"]`);
    assert.equal(await endpoints.count(),2);
    const first=await endpoints.first().boundingBox(),last=await endpoints.last().boundingBox();
    assert.ok(Math.abs(last.x-first.x-first.width*7)<1);
    const c=await button(preview,'C').boundingBox(),d=await button(preview,'D').boundingBox(),cs=await button(preview,'C',1).boundingBox(),df=await button(preview,'D',-1).boundingBox();
    assert.ok(Math.abs(cs.x-(c.x+d.x)/2)<1); assert.ok(Math.abs(cs.x-df.x)<1);
    await preview.screenshot({path:`dist/validation/notes-input-${name}-${preset}.png`,fullPage:true});
    await preview.close();
  }
  results.push('C, B-flat and G tonic-to-tonic layouts; duplicate tonic accepts answers; rendered sharp/flat half-key alignment and octave width');
  assert.deepEqual(errors,[]);
  const release=JSON.parse(await readFile('dist/release.json','utf8'));
  await writeFile(`dist/validation/notes-input-${name}.json`,JSON.stringify({build:release.apps.tunotes.build,browser:browser.version(),results},null,2));
  console.log(results.join('\n'));
} finally { await browser.close(); await host.close(); }
