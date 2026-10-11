import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const output = `dist/validation/count-writing-${engine}`;
await mkdir(output, { recursive: true });
const host = process.env.COUNT_WRITING_URL ? null : await hostBuild();
const url = process.env.COUNT_WRITING_URL || new URL('/prototypes/count-writing/', host.url).href;
const browser = await ({ chromium, firefox })[engine].launch();
const report = { engine, url, passed: false, physicalDeviceChecks: 'not performed', checks: [] };
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, hasTouch: true });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}fixture=half`); await page.evaluate(() => document.fonts.ready);
  const slots = page.locator('.count-slot');
  const control = name => page.getByRole('button', { name, exact: true });
  const fixture = page.getByLabel('Exercise preset', { exact: true });
  const choices = page.getByRole('dialog', { name: 'Enter a count', exact: true });
  const dimensions = () => page.locator('.dimension').evaluateAll(nodes => nodes.map(n => n.className.split(' ').at(-1)));
  const enter = async (tick, symbol) => { await slots.nth(tick).focus(); await page.keyboard.press(symbol); };
  const check = async () => { await slots.nth(0).focus(); await page.keyboard.press('Enter'); return dimensions(); };
  const end = () => page.getByRole('slider', { name: 'Line 1 end', exact: true });
  const anchors = page.locator('.duration-anchor');
  const addLine = async (start, finish) => { await anchors.nth(start).tap(); await anchors.nth(finish).tap(); };
  assert.equal(await slots.nth(0).evaluate(n=>n===document.activeElement),true,'first available input is focused on load');
  await fixture.selectOption('rest');
  assert.equal(await slots.nth(0).evaluate(n=>n===document.activeElement),true,'new rhythm focuses its first input');
  assert.equal(await slots.nth(0).getAttribute('aria-pressed'),'true');
  await page.keyboard.press('1'); assert.equal(await slots.nth(0).innerText(),'1','typing immediately after rhythm selection enters its first count');
  await fixture.selectOption('half');
  assert.equal(await slots.nth(0).evaluate(n=>n===document.activeElement),true);
  assert.equal(await slots.nth(0).innerText(),'·','new rhythm resets the answer');
  const nav = page.getByRole('navigation', { name: 'Rhythm pages' });
  const settings = async () => { await nav.getByRole('link', { name: 'Settings', exact: true }).click(); await page.getByLabel('Rhythm settings',{exact:true}).waitFor({state:'visible'}); };
  const practice = async () => { await page.getByRole('link', { name: 'Back to Uno234', exact: true }).click(); await page.getByLabel('Editable measure',{exact:true}).waitFor({state:'visible'}); };
  assert.equal(await page.getByRole('group', { name: 'Symbol keypad', exact: true }).count(), 0);
  assert.equal(await page.locator('.instructions,.line-controls,.line-edit').count(), 0);
  assert.equal(await control('Start duration line').count(), 0);
  assert.equal(await page.locator('.selection').count(), 0);
  await slots.nth(0).click();
  assert.deepEqual(await choices.getByRole('group', { name: 'Beat counts', exact: true }).locator('button').allTextContents(), ['1','2','3','4']);
  assert.deepEqual(await choices.getByRole('group', { name: 'Subdivision counts', exact: true }).locator('button').allTextContents(), ['&','e','a']);
  for (const [symbol, next] of [['1',2],['2',4],['3',6],['4',7]]) {
    await control(`Enter count ${symbol}`).click();
    const box = await slots.nth(next).boundingBox(), popup = await choices.boundingBox();
    assert.equal(await slots.nth(next).getAttribute('aria-pressed'), 'true');
    assert.ok(popup.y > box.y + box.height);
  }
  await control('Enter count &').click(); assert.equal(await choices.isVisible(), false);
  assert.deepEqual((await check()).slice(0,1), ['correct']);
  assert.match(await page.locator('.feedback').innerText(), /Your answer is kept/);
  await enter(0, '4'); assert.match(await page.locator('.feedback').innerText(), /Answer edited/);
  await slots.nth(0).click(); await page.keyboard.press('Enter');
  assert.equal((await dimensions())[0], 'revise', 'Enter on count evaluates instead of reopening popover');
  assert.equal(await choices.isVisible(), false);
  await control('Reset answer').click();
  await slots.nth(0).click(); await control('Enter count 1').focus(); await page.keyboard.press('Enter');
  assert.equal(await slots.nth(0).innerText(), '1', 'Enter on popover choice submits the symbol');
  assert.equal(await page.locator('.dimension').count(), 0, 'popover Enter does not evaluate');
  await page.keyboard.press('Escape');
  await page.locator('#page-title').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.dimension').count(), 3, 'Enter without an editing context evaluates');
  report.checks.push('Removed instruction/status/keypad/duration panel; Enter evaluates by default and preserves native popover actions');

  await control('Reset answer').click(); await slots.nth(0).focus();
  for (const [symbol,next] of [['1',2],['2',4],['3',6],['4',7],['&',7]]) {
    await page.keyboard.press(symbol); assert.equal(await slots.nth(next).evaluate(n => n === document.activeElement), true);
  }
  await slots.nth(2).focus();
  await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key:'1', repeat:true, bubbles:true, cancelable:true })));
  assert.equal(await slots.nth(2).innerText(), '2');
  await slots.nth(4).focus(); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  assert.equal(await slots.nth(2).getAttribute('aria-pressed'), 'true'); assert.equal(await slots.nth(2).innerText(), '·');
  await page.keyboard.press('Tab'); assert.equal(await slots.nth(4).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Shift+Tab'); assert.equal(await slots.nth(2).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
  assert.equal(await slots.nth(2).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('End'); await page.keyboard.press('Tab');
  assert.equal(await slots.nth(7).evaluate(n => n === document.activeElement), false);
  await settings(); await page.getByLabel('Counting system', { exact:true }).selectOption('+'); await practice();
  await control('Reset answer').click(); await slots.nth(0).focus();
  for (const symbol of ['1','2','3','4','&']) await page.keyboard.press(symbol);
  assert.equal(await slots.nth(7).innerText(), '+'); assert.equal((await check())[0], 'correct');
  await enter(7,'+'); assert.equal(await slots.nth(7).innerText(), '+');
  await settings(); await page.getByLabel('Counting system', { exact:true }).selectOption('&'); await practice();
  assert.equal(await slots.nth(7).innerText(), '&');
  report.checks.push('Keyboard auto-advance, correction, repeats, Tab/Shift+Tab/arrows and selectable offbeat aliases');

  await control('Reset answer').click(); await slots.nth(0).click();
  await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('slider').count(), 0);
  assert.equal(await slots.nth(3).isVisible(), false);
  await page.keyboard.up('Shift'); assert.equal(await end().getAttribute('aria-valuenow'), '3');
  await end().focus(); await page.keyboard.press('ArrowRight'); assert.equal(await end().getAttribute('aria-valuenow'), '5');
  await page.keyboard.press('ArrowLeft'); assert.equal(await end().getAttribute('aria-valuenow'), '3');
  await end().click(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  assert.equal(await end().getAttribute('aria-valuenow'), '5', 'Enter sets a duration endpoint during placement');
  assert.equal(await page.locator('.dimension').count(), 0);
  await end().focus(); await page.keyboard.press('Delete');
  assert.equal(await page.getByRole('slider').count(), 0, 'Delete removes a focused duration line');
  await slots.nth(0).focus(); await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape'); await page.keyboard.up('Shift'); assert.equal(await page.getByRole('slider').count(), 0);
  await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight');
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.keyboard.up('Shift'); assert.equal(await page.getByRole('slider').count(), 0);
  await addLine(0,2); assert.equal(await end().getAttribute('aria-valuenow'), '3');
  const from = await end().boundingBox(), to = await slots.nth(4).boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2); await page.mouse.down();
  await page.mouse.move(to.x+to.width/2,from.y+from.height/2,{steps:8}); await page.mouse.up();
  assert.equal(await end().getAttribute('aria-valuenow'), '5');
  report.checks.push('Duration Shift placement and cancellation, hidden endpoint implication, direct drag/arrows/Enter editing and deletion');

  await slots.nth(2).focus(); await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
  assert.equal(await page.locator('.duration-line').count(),1,'Shift from within a duration line edits it instead of creating another');
  assert.equal(await page.getByRole('slider',{name:'Line 1 start',exact:true}).getAttribute('aria-valuenow'),'0');
  assert.equal(await end().getAttribute('aria-valuenow'),'6');
  await control('Edit line 1 endpoint').click(); await slots.nth(2).focus(); await page.keyboard.press('Enter');
  assert.equal(await end().getAttribute('aria-valuenow'),'3','line body activation edits the endpoint');
  await page.getByRole('slider',{name:'Line 1 start',exact:true}).tap();
  assert.equal(await page.locator('.duration-line').count(),0,'touching the starting dot removes the line');
  await addLine(0,2); await end().tap(); await anchors.nth(4).tap();
  assert.equal(await page.locator('.duration-line').count(),1); assert.equal(await end().getAttribute('aria-valuenow'),'5');
  await page.getByRole('slider',{name:'Line 1 start',exact:true}).click();
  assert.equal(await page.locator('.duration-line').count(),0,'clicking the starting dot removes the line');
  await addLine(4,7); await addLine(0,6);
  assert.equal(await page.locator('.duration-line').count(),2);
  assert.equal(await page.getByRole('slider',{name:'Line 2 end',exact:true}).getAttribute('aria-valuenow'),'3','new line stops before an existing line');
  await slots.nth(4).focus(); await page.keyboard.down('Shift'); await page.keyboard.press('ArrowLeft'); await page.keyboard.up('Shift');
  assert.equal(await page.locator('.duration-line').count(),2,'keyboard activation on the start edits the existing line');
  await control('Reset answer').click();
  report.checks.push('One duration line per covered position; interior/body/end activation edits endpoint; start click/touch removes; Shift edits existing lines; overlapping placement is bounded');
  const solutions = [
    { id:'half', available:[0,2,4,6,7], symbols:['1','','2','','3','','4','&'], spans:[[0,2]], rests:[] },
    { id:'dotted-quarter', available:[0,1,2,3,4,6], symbols:['1','','2','&','3','','4',''], spans:[[0,2],[4,6]], rests:[] },
    { id:'rest', available:[0,2,4,5,6], symbols:['1','','2','','3','&','4',''], spans:[], rests:[[2,2]] },
    { id:'dotted-half', available:[0,2,4,6], symbols:['1','','2','','3','','4',''], spans:[[0,4]], rests:[] },
    { id:'half-rest', available:[0,2,4,6,7], symbols:['1','','2','','3','','4','&'], spans:[[0,2]], rests:[[0,2]] },
    { id:'two-rests', available:[0,2,4,6,7], symbols:['1','','2','','3','','4','&'], spans:[], rests:[[0,0],[2,2]] },
  ];
  for (const solution of solutions) {
    await fixture.selectOption(solution.id); await control('Reset answer').click();
    assert.deepEqual(await slots.evaluateAll(nodes => nodes.flatMap((n,i)=>n.hidden?[]:[i])),solution.available);
    assert.equal(await page.locator('.duration-anchor:visible').count(),solution.available.length);
    for (let i=0;i<8;i++) if(solution.symbols[i]) await enter(i,solution.symbols[i]);
    for(const span of solution.spans) await addLine(...span);
    for(const [start,finish] of solution.rests) {
      await slots.nth(start).focus(); await page.keyboard.press('(');
      for(const tick of solution.available.filter(t=>t>start&&t<=finish)) await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.dimension').count(),0,'rest-closing Enter must not evaluate');
    }
    assert.deepEqual(await check(),[solution.id==='dotted-quarter'?'provisional':'correct','correct','correct']);
    await page.screenshot({path:`${output}/${solution.id}.png`,fullPage:true});
  }
  await fixture.selectOption('half-rest'); await control('Reset answer').click();
  await slots.nth(0).click(); await page.keyboard.press('('); await page.keyboard.press('ArrowRight');
  assert.equal(await control('Close rest parentheses at measure 1, beat 2').evaluate(n=>n.classList.contains('keyboard-target')),true);
  await page.keyboard.press('Enter'); assert.equal(await page.locator('.rest-group').getAttribute('data-end'),'2');
  await control('Edit rest parentheses at measure 1, beat 1').tap(); assert.equal(await page.locator('.rest-open-group').count(),1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.rest-group').getAttribute('data-end'), '2', 'Escape restores the saved rest group');
  await control('Edit rest parentheses at measure 1, beat 1').tap();
  await settings(); await practice();
  assert.equal(await page.locator('.rest-group').getAttribute('data-end'), '2', 'view navigation cancels editing without deleting the saved pair');
  await control('Edit rest parentheses at measure 1, beat 1').tap();
  await slots.nth(0).focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await control('Remove rest parentheses at measure 1, beat 1').tap(); assert.equal(await page.locator('.rest-group').count(),0);
  await slots.nth(2).focus(); await page.keyboard.press('('); await page.keyboard.press('Enter');
  await slots.nth(0).focus(); await page.keyboard.press('('); await page.keyboard.press('ArrowRight');
  assert.equal(await slots.nth(0).getAttribute('aria-pressed'),'true','closing cannot overlap next pair');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.rest-target.rest-closing:visible').count(),0);
  report.checks.push('All six fixture solutions and independent grading; rest grouped entry/edit/removal, available endpoint targeting and overlap guards');

  await settings(); assert.equal(await page.locator('.dimension').isVisible().catch(()=>false),false);
  await page.keyboard.press('Enter'); assert.equal(await page.getByLabel('Rhythm settings',{exact:true}).isVisible(),true);
  await page.getByLabel('Exercise preset',{exact:true}).selectOption('dotted-quarter');
  await page.getByLabel('Dotted-quarter internal &',{exact:true}).selectOption('required'); await practice();
  assert.equal(await slots.nth(0).evaluate(n=>n===document.activeElement),true,'rhythm selected in Settings activates first input on return');
  for(const [i,symbol] of ['1','','2','&','3','','4',''].entries()) if(symbol) await enter(i,symbol);
  await enter(1,'&');
  assert.equal((await check())[0],'correct');
  await settings(); await page.getByLabel('Dotted-quarter internal &',{exact:true}).selectOption('optional'); await practice();
  await slots.nth(1).focus(); await page.keyboard.press('Delete');
  assert.equal((await check())[0],'correct');
  for(const width of [320,375,1280]) {
    const height = width < 400 ? 667 : 1000;
    await page.setViewportSize({width,height});
    await fixture.selectOption('half'); await control('Reset answer').click();
    await page.getByRole('button',{name:'Enter count at measure 1, beat 1',exact:true}).click();
    const pop=await choices.boundingBox(), box=await slots.nth(0).boundingBox();
    assert.ok(pop.x>=7&&pop.x+pop.width<=width-7&&pop.y>box.y+box.height&&pop.y+pop.height<=height-7);
    await control('Dismiss count choices').tap();
    await slots.nth(0).tap(); assert.equal(await choices.isVisible(),true);
    await page.keyboard.press('Escape');
    await addLine(0,2); assert.equal(await end().getAttribute('aria-valuenow'),'3');
    await settings(); await page.getByLabel('Duration-line placement',{exact:true}).selectOption('beside');
    await page.getByLabel('Sustained-count appearance',{exact:true}).selectOption('lowered'); await practice();
    assert.equal(await end().getAttribute('aria-valuenow'),'3');
    await page.screenshot({path:`${output}/minimal-${width}.png`,fullPage:true});
  }
  if(engine==='chromium') {
    await control('Reset answer').click(); await slots.nth(0).scrollIntoViewIfNeeded();
    const cdp=await context.newCDPSession(page), box=await slots.nth(0).boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});
    const target=await control('Enter count 1').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:target.x+target.width/2,y:target.y+target.height/2,id:1}]});
    assert.equal(await control('Enter count 1').evaluate(n=>n.classList.contains('slide-selected')),true);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await slots.nth(0).innerText(),'1'); await cdp.detach();
  }
  report.checks.push('Settings preserve answers; teacher convention; responsive popovers below notation, mouse/touch glyph entry and touch-slide submission');
  assert.deepEqual(errors,[]); report.passed=true;
  console.log(`${engine}: Count Writing browser checks passed (${url}).`);
} finally {
  await writeFile(`${output}/report.json`,`${JSON.stringify(report,null,2)}\n`);
  await browser.close(); await host?.close();
}
