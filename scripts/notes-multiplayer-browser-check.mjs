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
  await page.locator('.multiplayer-view').getByLabel('Duration (seconds)').fill('15');
  if(format==='pairs') await page.getByRole('group',{name:'Play format'}).getByRole('button',{name:'Split Screen'}).click();
  await button(page,'Start round').click(); assert.equal(await page.locator('.multiplayer-round').isVisible(),true);
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

  await open(page,url);await addPlayers(page,3);
  assert.equal(await button(page,'Coming Soon').isDisabled(),true);
  await page.getByLabel('Player 3 name').fill('Ready');
  await page.getByLabel('Player 3 name').press('Enter');
  assert.equal(await button(page,'Edit Player 3').textContent(),'Ready');
  assert.equal(await page.getByLabel('Player 3 name').evaluate(input=>input===document.activeElement),false);
  await page.getByLabel('Player 3 name').fill('Player 3');
  await page.getByLabel('Player 3 name').press('Enter');
  assert.equal(await button(page,'Move Player 3 right').count(),0);
  await button(page,'Edit Player 1').click();
  assert.equal(await button(page,'Move Player 1 left').count(),0);
  await button(page,'Edit Player 2').click();
  await page.getByLabel('Player 2 name').fill('Player 1');
  assert.equal(await button(page,'Edit Player 2').textContent(),'Player 2');
  await button(page,'Edit Player 3').click();
  assert.equal(await button(page,'Edit Player 2').textContent(),'Player 1');
  await button(page,'Move Player 3 left').click();
  assert.equal(await button(page,'Edit Player 2').textContent(),'Player 3');
  await button(page,'Edit Player 2').click();
  await button(page,'Move Player 2 right').click();
  assert.equal(await button(page,'Edit Player 3').textContent(),'Player 3');
  const selected=page.locator('.multiplayer-slot.selected');
  assert.equal(await selected.getByRole('button').count(),2);
  assert.equal(await selected.getByRole('button').nth(1).textContent(),'Player 3');
  await button(page,'Previous player').click();
  assert.equal(await page.locator('.multiplayer-editor > h4').textContent(),'Player 2 settings');
  await button(page,'Next player').click();
  assert.equal(await page.locator('.multiplayer-editor > h4').textContent(),'Player 3 settings');
  const remove=button(page,'Remove player'),card=page.locator('.multiplayer-editor');
  const removeBox=await remove.boundingBox(),cardBox=await card.boundingBox(),previousBox=await button(page,'Previous player').boundingBox();
  assert.ok(removeBox.x+removeBox.width>cardBox.x+cardBox.width-32);
  assert.ok(previousBox.x<removeBox.x && Math.abs(previousBox.y-removeBox.y)<2);
  assert.equal(await remove.evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(143, 63, 72)');
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-setup.png`,fullPage:true});
  await page.setViewportSize({width:360,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const phonePrevious=await button(page,'Previous player').boundingBox(),phoneRemove=await remove.boundingBox();
  assert.ok(Math.abs(phonePrevious.y-phoneRemove.y)<2);
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
  await page.locator('.multiplayer-recovery').waitFor({state:'visible'});
  assert.equal(await page.locator('.multiplayer-recovery').isVisible(),true);
  assert.equal(await button(page,'Resume Split Screen').isDisabled(),true);
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-phone-recovery.png`,fullPage:true});
  await button(page,'Restart as turns').click();assert.match(await page.locator('.multiplayer-round h2').textContent(),/Turn 1 of 3/);
  await page.setViewportSize({width:360,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-phone-turn.png`,fullPage:true});
  await page.setViewportSize({width:768,height:900});await page.screenshot({path:`dist/validation/notes-multiplayer-${name}-${label}-tablet-turn.png`,fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await button(page,'End round').click();assert.equal(await page.locator('.multiplayer-result-row').count(),3);
  await open(page,url);await addPlayers(page,2);
  await button(page,'Edit Player 2').click();
  await page.locator('#multi-preset').click();
  const dialog=page.locator('.preset-dialog:visible');
  await button(dialog,'Clef').click();await button(dialog,'Bass').click();await dialog.locator('[data-preset-id="bass-lines-and-spaces"]').click();
  await button(page,'Adapt Range for Player 2').click();
  assert.match(await page.locator('.multiplayer-editor').innerText(),/Bass — Lines \+ Spaces/);
  assert.equal(await button(page,'Adapt Range for Player 2').getAttribute('aria-pressed'),'true');
  await button(page,'Edit Player 1').click();
  assert.equal(await button(page,'Adapt Range for Player 1').getAttribute('aria-pressed'),'false');
  await start(page,'pairs');await button(page,'Ready').click();await page.clock.runFor(3050);
  assert.match(await page.locator('.multiplayer-panel').nth(0).locator('.staff-panel .staff').getAttribute('aria-label'),/treble/i);
  assert.match(await page.locator('.multiplayer-panel').nth(1).locator('.staff-panel .staff').getAttribute('aria-label'),/bass/i);
  await button(page,'End round').click();
  await open(page,url);await addPlayers(page,2);await page.setViewportSize({width:760,height:900});
  await page.getByRole('group',{name:'Play format'}).getByRole('button',{name:'Split Screen'}).click();
  assert.equal(await button(page,'Start round').isDisabled(),true);
  await page.getByRole('group',{name:'Play format'}).getByRole('button',{name:'Turns'}).click();
  assert.equal(await button(page,'Start round').isDisabled(),false);
  await page.setViewportSize({width:1280,height:900});
  await button(page,'Options').click();
  await page.locator('.local-data > summary').click();
  await page.getByLabel('Profile name').fill('Bass Player');
  await button(page,'Create profile').click();
  await page.getByLabel('Default preset').selectOption('bass-lines-and-spaces');
  await button(page,'Challenge').click();
  assert.match(await page.locator('#preset').textContent(),/Bass — Lines \+ Spaces/);
  await button(page,'Multi Player').click();
  await page.getByLabel('Player 2 saved profile').selectOption({label:'Bass Player'});
  assert.match(await page.locator('#multi-preset').textContent(),/Bass — Lines \+ Spaces/);
  assert.deepEqual(errors,[]);evidence.push(`${label}: shared visibility pause, resize recovery, explicit turns restart and phone/tablet layout`);
  evidence.push(`${label}: separate preset/adaptive choices, profile defaults and small-screen pair start guard`);
}
try {
  await mkdir('dist/validation',{recursive:true});
  const page=await browser.newPage();await run(page,host.url+'notes/','hosted');await page.close();
  const file=join(temporary,'moved notes.html');await copyFile('dist/portable/tunotes.html',file);
  const offline=await browser.newContext({offline:true});await run(await offline.newPage(),pathToFileURL(file).href,'portable-offline');await offline.close();
  await writeFile(`dist/validation/notes-multiplayer-${name}.json`,JSON.stringify({browser:name,evidence},null,2));console.log(evidence.join('\n'));
} finally {await browser.close();await host.close();await rm(temporary,{recursive:true,force:true});}
