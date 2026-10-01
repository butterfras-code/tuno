import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir, mkdtemp, copyFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostBuild } from './test-host.mjs';

const name=process.env.TUNO_BROWSER || 'chromium';
const browser=await ({chromium,firefox})[name].launch(),host=await hostBuild();
const temporary=await mkdtemp(join(tmpdir(),'notes-multiplayer-'));
const evidence=[];
const button=(scope,label)=>scope.getByRole('button',{name:label,exact:true});
async function open(page,url) { await page.goto(url); await button(page,'Multi Player').click(); }
async function addPlayers(page,size) {
  for(let i=1;i<size;i++) {
    await button(page,'Add player').click();
    assert.equal(await page.getByLabel(`Player ${i+1} name`).evaluate(input=>input===document.activeElement),true);
    await button(page.getByRole('dialog'),'Save').click();
  }
  assert.equal(await page.locator('.multiplayer-player-tab').count(),size);
}
async function answerLetter(panel) {
  const transform=await panel.locator('.staff-panel .notehead').getAttribute('transform');
  const y=Number(/translate\([^ ]+ ([^)]+)\)/.exec(transform)[1]);
  const position=Math.round((140-y)/10);
  return 'CDEFGAB'[(4*7+2+position)%7];
}
async function start(page,format='turns') {
  await page.getByRole('tab',{name:'Multi Player Settings',exact:true}).click();
  await page.locator('.multiplayer-view').getByLabel('Duration (seconds)').fill('15');
  await page.getByRole('group',{name:'Play format'}).getByRole('button',{name:format==='pairs'?'Split Screen':format==='turns'?'Turns':'Head to Head'}).click();
  await button(page,'Start round').click(); await page.clock.runFor(50); assert.equal(await page.locator('.multiplayer-round').isVisible(),true);
}
async function readyAndExpire(page) { await button(page,'Ready').click(); await page.clock.fastForward(18100); }
async function run(page,url,label) {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.setViewportSize({width:1280,height:900});
  for(let size=1;size<=8;size++) {
    await open(page,url); await addPlayers(page,size); await start(page);
    for(let turn=0;turn<size;turn++) {
      assert.equal(await page.locator('.multiplayer-panel').count(),1);
      assert.match(await page.locator('.multiplayer-round h2').textContent(),new RegExp(`Turn ${turn+1} of ${size}`));
      await readyAndExpire(page);
    }
    assert.equal(await page.locator('.multiplayer-result-row').count(),size);
    assert.equal(await page.locator('.multiplayer-result-row').filter({hasText:'unranked'}).count(),size);
  }
  evidence.push(`${label}: all 1–8 turn rosters completed once in order`);

  for(let size=1;size<=8;size++) {
    await open(page,url);await addPlayers(page,size);await start(page,'pairs');
    const heats=Math.ceil(size/2);
    for(let heat=0;heat<heats;heat++) {
      assert.match(await page.locator('.multiplayer-round h2').textContent(),new RegExp(`Heat ${heat+1} of ${heats}`));
      assert.equal(await page.locator('.multiplayer-panel').count(),Math.min(2,size-heat*2));
      await readyAndExpire(page);
    }
    assert.equal(await page.locator('.multiplayer-result-row').count(),size);
  }
  evidence.push(`${label}: all 1–8 paired rosters completed once, including odd final solo heats`);

  await open(page,url);await addPlayers(page,2);await page.setViewportSize({width:1280,height:800});await start(page,'head-to-head');
  const head=page.locator('.multiplayer-round--head-to-head');
  assert.equal(await head.count(),1);
  const headPanels=head.locator('.multiplayer-panel');
  assert.equal(await headPanels.count(),2);
  const seats=await head.locator('.multiplayer-seat').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width,height:box.height};}));
  assert.equal(seats.length,2);assert.ok(Math.abs(seats[0].width-seats[1].width)<2);
  assert.ok(Math.abs(seats[0].x+seats[0].width-seats[1].x)<3);
  for(let i=0;i<2;i++) {
    const panel=await headPanels.nth(i).boundingBox();
    assert.ok(Math.abs(panel.x-seats[i].x)<3 && Math.abs(panel.y-seats[i].y)<3);
    assert.ok(Math.abs(panel.width-seats[i].width)<3 && Math.abs(panel.height-seats[i].height)<3);
  }
  await button(page,'Ready').click();await page.clock.runFor(3050);
  for(let i=0;i<2;i++) {
    const target=headPanels.nth(i).locator('.answer-natural').first();
    const box=await target.boundingBox();
    assert.ok(box.x>seats[i].x && box.x+box.width<seats[i].x+seats[i].width);
    await target.click();
    assert.match(await headPanels.nth(i).locator('.muted').first().textContent(),/1 attempts/);
  }
  if(await button(page,'Enter fullscreen').isVisible()) {
    await button(page,'Enter fullscreen').click();
    await button(page,'Exit fullscreen').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>document.fullscreenElement===document.documentElement),true);
    await button(page,'Exit fullscreen').click();
    await button(page,'Enter fullscreen').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>document.fullscreenElement),null);
    await button(page,'Resume').waitFor({state:'visible'});
    await button(page,'Resume').click();
  }
  await page.setViewportSize({width:600,height:960});
  await page.evaluate(()=>window.dispatchEvent(new Event('orientationchange')));
  await page.clock.runFor(250);
  assert.equal(await head.locator('.multiplayer-fit-warning').isVisible(),false);
  const portraitSeats=await head.locator('.multiplayer-seat').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width,height:box.height};}));
  assert.ok(Math.abs(portraitSeats[0].y+portraitSeats[0].height-portraitSeats[1].y)<3);
  for(let i=0;i<2;i++) {
    const panel=await headPanels.nth(i).boundingBox();
    assert.ok(Math.abs(panel.x-portraitSeats[i].x)<3 && Math.abs(panel.y-portraitSeats[i].y)<3);
    assert.ok(Math.abs(panel.width-portraitSeats[i].width)<3 && Math.abs(panel.height-portraitSeats[i].height)<3);
    assert.equal(await headPanels.nth(i).evaluate(node=>node.scrollHeight<=node.clientHeight+1),true);
    await headPanels.nth(i).locator('.answer-natural').first().click();
    assert.match(await headPanels.nth(i).locator('.muted').first().textContent(),/2 attempts/);
  }
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-head-to-head-portrait.png`});
  await page.setViewportSize({width:1280,height:800});
  await page.clock.runFor(250);
  assert.equal(await head.locator('.multiplayer-fit-warning').isVisible(),false);
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-head-to-head.png`});
  await button(page,'End round').click();
  await open(page,url);await addPlayers(page,3);await page.setViewportSize({width:960,height:550});
  await page.getByRole('tab',{name:'Multi Player Settings',exact:true}).click();
  await page.getByRole('group',{name:'Play format'}).getByRole('button',{name:'Head to Head'}).click();
  assert.equal(await button(page,'Start round').isDisabled(),false);
  if(await button(page,'Enter fullscreen').isVisible()) {
    await button(page,'Enter fullscreen').click();
    await button(page,'Exit fullscreen').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>document.fullscreenElement===document.documentElement),true);
    await button(page,'Exit fullscreen').click();
    await button(page,'Enter fullscreen').waitFor({state:'visible'});
  }
  await page.setViewportSize({width:960,height:600});await start(page,'head-to-head');
  assert.equal(await page.locator('.multiplayer-panel').count(),2);
  await button(page,'Ready').click();await page.clock.runFor(3050);
  for(const panel of await page.locator('.multiplayer-panel').all()) {
    assert.equal(await panel.evaluate(node=>node.scrollHeight<=node.clientHeight+1),true);
    await panel.locator('.answer-natural').first().click();
    assert.match(await panel.locator('.muted').first().textContent(),/1 attempts/);
  }
  await page.clock.fastForward(15050);
  assert.equal(await page.locator('.multiplayer-panel').count(),1);
  await readyAndExpire(page);
  assert.equal(await page.locator('.multiplayer-result-row').count(),3);
  await open(page,url);await addPlayers(page,2);await page.setViewportSize({width:600,height:960});await start(page,'head-to-head');
  await button(page,'Ready').click();await page.clock.runFor(3050);
  for(const panel of await page.locator('.multiplayer-panel').all()) {
    assert.equal(await panel.evaluate(node=>node.scrollHeight<=node.clientHeight+1),true);
    await panel.locator('.answer-natural').first().click();
    assert.match(await panel.locator('.muted').first().textContent(),/1 attempts/);
  }
  await button(page,'End round').click();
  await open(page,url);await addPlayers(page,2);await page.setViewportSize({width:390,height:844});await start(page,'head-to-head');
  assert.equal(await page.locator('.multiplayer-panel').count(),2);
  await button(page,'Ready').click();await page.clock.runFor(3050);
  for(const panel of await page.locator('.multiplayer-panel').all()) {
    await panel.locator('.answer-natural').first().click();
    assert.match(await panel.locator('.muted').first().textContent(),/1 attempts/);
  }
  await button(page,'End round').click();
  evidence.push(`${label}: head-to-head panels face the short ends in either viewport orientation, fit tablet answers, remain available on small phones, and run an odd solo heat`);
  await page.setViewportSize({width:1280,height:900});

  await open(page,url);await addPlayers(page,3);
  assert.equal(await button(page,'Coming Soon').count(),0);
  await button(page,'Edit Player 3').click();
  await page.getByLabel('Player 3 name').fill('Ready');
  await page.getByLabel('Player 3 name').press('Enter');
  assert.equal(await button(page,'Select Player 3').textContent(),'Ready');
  assert.equal(await page.getByRole('dialog').count(),0);
  await button(page,'Edit Player 3').click();
  await page.getByLabel('Player 3 name').fill('Player 3');
  await page.getByLabel('Player 3 name').press('Enter');
  assert.equal(await button(page,'Move Player 3 down').count(),0);
  await button(page,'Select Player 1').click();
  assert.equal(await button(page,'Move Player 1 up').count(),0);
  await button(page,'Select Player 2').click();
  await button(page,'Edit Player 2').click();
  await page.getByLabel('Player 2 name').fill('Player 1');
  assert.equal(await button(page,'Select Player 2').textContent(),'Player 2');
  await button(page.getByRole('dialog'),'Save').click();
  await button(page,'Select Player 3').click();
  assert.equal(await button(page,'Select Player 2').textContent(),'Player 1');
  await button(page,'Move Player 3 up').click();
  assert.equal(await button(page,'Select Player 2').textContent(),'Player 3');
  await button(page,'Select Player 2').click();
  await button(page,'Move Player 2 down').click();
  assert.equal(await button(page,'Select Player 3').textContent(),'Player 3');
  const selected=page.locator('.multiplayer-slot.selected');
  assert.equal(await selected.getByRole('button').count(),4);
  assert.equal(await selected.getByRole('button').nth(1).textContent(),'Player 3');
  await button(page,'Select Player 2').click();
  assert.equal(await page.locator('#multiplayer-notes-tab').textContent(),"Player 1's Notes");
  await button(page,'Select Player 3').click();
  assert.equal(await page.locator('#multiplayer-notes-tab').textContent(),"Player 3's Notes");
  const remove=button(page,'Remove Player 3');
  assert.equal(await page.locator('.multiplayer-editor .multiplayer-player-controls').count(),0);
  assert.equal(await remove.locator('svg').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(143, 63, 72)');
  const removeBox=await remove.boundingBox();
  assert.ok(removeBox.width >= 43.99 && removeBox.height >= 43.99,`44px touch target (allowing subpixel rounding): ${JSON.stringify(removeBox)}`);
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-setup.png`,fullPage:true});
  await page.setViewportSize({width:360,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-phone-setup.png`,fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await start(page,'pairs');
  assert.equal(await page.locator('.multiplayer-panel').count(),2);
  await button(page,'Ready').click();await page.clock.runFor(3050);
  const panels=page.locator('.multiplayer-panel');
  await page.keyboard.press('KeyQ');
  assert.match(await panels.nth(0).locator('.muted').first().textContent(),/1 attempts/);
  assert.match(await panels.nth(1).locator('.muted').first().textContent(),/0 attempts/);
  await page.keyboard.down('KeyQ');await page.clock.runFor(900);await page.keyboard.press('KeyQ');await page.keyboard.up('KeyQ');
  assert.match(await panels.nth(0).locator('.muted').first().textContent(),/1 attempts/);
  await page.keyboard.press('KeyZ');assert.match(await panels.nth(1).locator('.muted').first().textContent(),/1 attempts/);
  await page.clock.runFor(900);
  await page.evaluate(()=>{const input=document.createElement('input');input.id='entry-probe';document.body.append(input);input.focus();});
  await page.keyboard.press('KeyQ');
  assert.match(await panels.nth(0).locator('.muted').first().textContent(),/1 attempts/);
  await page.locator('#entry-probe').evaluate(n=>n.remove());
  if(name==='chromium') {
    const cdp=await page.context().newCDPSession(page);
    const targets=await Promise.all([0,1].map(async i=>{const box=await panels.nth(i).locator('.answer-natural').first().boundingBox();return {x:box.x+box.width/2,y:box.y+box.height/2,id:i+1};}));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:targets});
    assert.match(await panels.nth(0).locator('.muted').first().textContent(),/1 attempts/);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.match(await panels.nth(0).locator('.muted').first().textContent(),/2 attempts/);
    assert.match(await panels.nth(1).locator('.muted').first().textContent(),/2 attempts/);
    await cdp.detach();
  }
  await page.clock.runFor(900);
  const beforeLeft=Number((await panels.nth(0).locator('.muted').first().textContent()).match(/(\d+) attempts/)[1]);
  const beforeRight=Number((await panels.nth(1).locator('.muted').first().textContent()).match(/(\d+) attempts/)[1]);
  await page.keyboard.down('Digit3');
  assert.ok(await panels.nth(0).locator('.answer-sharp.answer-modifier').count()>0);
  assert.equal(await panels.nth(1).locator('.answer-modifier').count(),0);
  await page.keyboard.press('KeyQ');await page.keyboard.up('Digit3');
  await page.keyboard.down('Digit8');
  assert.ok(await panels.nth(1).locator('.answer-flat.answer-modifier').count()>0);
  assert.equal(await panels.nth(0).locator('.answer-modifier').count(),0);
  await page.keyboard.press('KeyZ');await page.keyboard.up('Digit8');
  assert.match(await panels.nth(0).locator('.muted').first().textContent(),new RegExp(`${beforeLeft+1} attempts`));
  assert.match(await panels.nth(1).locator('.muted').first().textContent(),new RegExp(`${beforeRight+1} attempts`));
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-pair.png`});
  await page.clock.fastForward(16000);
  await page.locator('.multiplayer-round h2').getByText('Heat 2 of 2').waitFor({state:'visible'});
  assert.match(await page.locator('.multiplayer-round h2').textContent(),/Heat 2 of 2/);
  assert.equal(await page.locator('.multiplayer-panel').count(),1);
  await readyAndExpire(page);
  assert.equal(await page.locator('.multiplayer-result-row').count(),3);
  assert.match(await page.locator('.multiplayer-result').innerText(),/Player 1 · Seat/);
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-results.png`,fullPage:true});
  await page.setViewportSize({width:360,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-phone-results.png`,fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await button(page,'Retry').click();assert.match(await page.locator('.multiplayer-round h2').textContent(),/Heat 1 of 2/);
  assert.match(await page.locator('.multiplayer-panel').first().locator('.muted').first().textContent(),/0 attempts/);
  await button(page,'End round').click();await button(page,'Edit setup').click();

  await button(page,'Target').click();await page.locator('.multiplayer-view').getByLabel('Correct-note target').fill('1');await page.locator('.multiplayer-view').getByLabel('Timeout (seconds)').fill('15');
  await button(page,'Start round').click();await button(page,'Ready').click();await page.clock.runFor(3050);
  const first=page.locator('.multiplayer-panel').nth(0),second=page.locator('.multiplayer-panel').nth(1);
  const left='QWERTYU',right='ZXCVBNM',letters='ABCDEFG';
  await page.keyboard.press(`Key${left[letters.indexOf(await answerLetter(first))]}`);
  assert.equal(await first.getAttribute('data-phase'),'finished');assert.equal(await second.getAttribute('data-phase'),'playing');
  assert.match(await second.locator('.muted').first().textContent(),/0 attempts/);
  await page.keyboard.press(`Key${right[letters.indexOf(await answerLetter(second))]}`);
  assert.match(await page.locator('.multiplayer-round h2').textContent(),/Heat 2 of 2/);
  await button(page,'Ready').click();await page.clock.runFor(3050);
  await page.keyboard.press(`Key${left[letters.indexOf(await answerLetter(page.locator('.multiplayer-panel')))]}`);
  assert.equal(await page.locator('.multiplayer-result-row').count(),3);
  assert.match(await page.locator('.multiplayer-result').innerText(),/#1/);
  evidence.push(`${label}: pairs, odd heat, lane-isolated keyboard/finish, held keys, focused text, ties, duplicate names, retry${name==='chromium' ? ', concurrent touch pointers' : ''}`);

  await button(page,'Edit setup').click();await button(page,'Timed').click();
  await button(page,'Start round').click();await button(page,'Ready').click();await page.clock.runFor(3050);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('.multiplayer-panel[data-phase="paused"]').count(),2);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});});
  await button(page,'Resume').click();
  await page.setViewportSize({width:760,height:900});
  await page.locator('.multiplayer-fit-warning').waitFor({state:'visible'});
  assert.equal(await page.locator('.multiplayer-fit-warning').isVisible(),true);
  assert.equal(await button(page,'Pause').isVisible(),true);
  assert.equal(await page.locator('.multiplayer-panel[data-phase="paused"]').count(),0);
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-phone-recovery.png`,fullPage:true});
  await button(page,'Switch to Turns').click();assert.match(await page.locator('.multiplayer-round h2').textContent(),/Turn 1 of 3/);
  await page.setViewportSize({width:360,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-phone-turn.png`,fullPage:true});
  await page.setViewportSize({width:768,height:900});await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-tablet-turn.png`,fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await button(page,'End round').click();assert.equal(await page.locator('.multiplayer-result-row').count(),3);
  await open(page,url);await addPlayers(page,2);
  await button(page,'Select Player 2').click();
  await page.locator('#multi-preset').click();
  const dialog=page.locator('.preset-dialog:visible');
  await button(dialog,'Clef').click();await button(dialog,'Bass').click();await dialog.locator('[data-preset-id="bass-lines-and-spaces"]').click();await button(dialog,'Use preset').click();
  assert.equal(await page.locator('.multiplayer-editor').getByRole('button',{name:'Adapt Range',exact:true}).count(),0);
  await page.getByRole('tab',{name:'Multi Player Settings',exact:true}).click();
  await button(page,'Adapt Range').click();
  assert.match(await page.locator('.multiplayer-setup .practice-setup-summary').textContent(),/Adapt Range on/);
  await page.getByRole('tab',{name:/Notes$/}).click();
  assert.match(await page.locator('.multiplayer-editor').innerText(),/Bass — Lines \+ Spaces/);
  await button(page,'Select Player 1').click();
  await page.getByRole('tab',{name:'Multi Player Settings',exact:true}).click();
  assert.equal(await button(page,'Adapt Range').getAttribute('aria-pressed'),'true');
  await button(page,'Add player').click();
  await button(page.getByRole('dialog'),'Save').click();
  assert.equal(await page.locator('.multiplayer-player-tab').count(),3);
  await page.getByRole('tab',{name:'Multi Player Settings',exact:true}).click();
  assert.equal(await button(page,'Adapt Range').getAttribute('aria-pressed'),'true');
  await start(page,'pairs');await button(page,'Ready').click();await page.clock.runFor(3050);
  assert.match(await page.locator('.multiplayer-panel').nth(0).locator('.staff-panel .staff').getAttribute('aria-label'),/treble/i);
  assert.match(await page.locator('.multiplayer-panel').nth(1).locator('.staff-panel .staff').getAttribute('aria-label'),/bass/i);
  await button(page,'End round').click();
  await open(page,url);await addPlayers(page,2);await page.setViewportSize({width:760,height:900});
  await page.getByRole('tab',{name:'Multi Player Settings',exact:true}).click();
  await page.getByRole('group',{name:'Play format'}).getByRole('button',{name:'Split Screen'}).click();
  assert.equal(await button(page,'Start round').isDisabled(),false);
  assert.match(await page.locator('.multiplayer-round-setup').textContent(),/may work better with Turns/);
  await page.getByRole('group',{name:'Play format'}).getByRole('button',{name:'Turns'}).click();
  assert.equal(await button(page,'Start round').isDisabled(),false);
  await page.setViewportSize({width:1280,height:900});
  await button(page,'Options').click();
  await page.locator('.local-data > summary').click();
  await button(page,'Add profile').click();
  await page.getByLabel('Profile name').fill('Bass Player');
  await page.getByLabel('Profile name').press('Enter');
  await page.locator('#profile-preset').click();
  const profileDialog=page.locator('.preset-dialog:visible');
  await button(profileDialog,'Clef').click(); await button(profileDialog,'Bass').click();
  await profileDialog.locator('[data-preset-id="bass-lines-and-spaces"]').click();
  assert.equal(await page.locator('.profile-save-status').textContent(),'Changes saved.');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tunotes:data:v1')).profiles.find(p=>p.name==='Bass Player').defaultPresetId),'bass-lines-and-spaces');
  await button(page,'Challenge').click();
  assert.match(await page.locator('#notes-challenge .preset-name').textContent(),/Bass — Lines \+ Spaces/);
  await button(page,'Multi Player').click();
  await page.getByRole('tab',{name:/Notes$/,exact:false}).click();
  await button(page,'Edit Player 2').click();
  await page.getByLabel('Player 2 saved profile').selectOption({label:'Bass Player'});
  await button(page.getByRole('dialog'),'Save').click();
  assert.match(await page.locator('.multiplayer-editor .preset-name').textContent(),/Bass — Lines \+ Spaces/);
  assert.deepEqual(errors,[]);evidence.push(`${label}: shared visibility pause, nonblocking resize advice, explicit turns restart and phone/tablet layout`);
  evidence.push(`${label}: separate presets, global adaptation across roster changes, profile defaults and nonblocking small-screen pair advice`);
}
try {
  await mkdir('dist/validation',{recursive:true});
  const page=await browser.newPage();await run(page,new URL('/notes/', host.url).href,'hosted');await page.close();
  const file=join(temporary,'moved notes.html');await copyFile('dist/portable/tunotes.html',file);
  const offline=await browser.newContext({offline:true});await run(await offline.newPage(),pathToFileURL(file).href,'portable-offline');await offline.close();
  await writeFile(`dist/validation/notes-multiplayer-${name}.json`,JSON.stringify({browser:name,evidence},null,2));console.log(evidence.join('\n'));
} finally {await browser.close();await host.close();await rm(temporary,{recursive:true,force:true});}
