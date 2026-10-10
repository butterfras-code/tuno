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
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  const slots = page.locator('.count-slot');
  const control = name => page.getByRole('button', { name, exact: true });
  const fixture = page.getByLabel('Review fixture', { exact: true });
  const dimensions = async () => page.locator('.dimension').evaluateAll(nodes => nodes.map(n => n.className.split(' ').at(-1)));
  const enter = async (tick, symbol) => { await slots.nth(tick).click(); await page.keyboard.press(symbol); };
  const addLine = async (start, end) => { await slots.nth(start).tap(); await control('Start duration line').tap(); await slots.nth(end).tap(); };
  const check = async () => { await control('Check').click(); return dimensions(); };
  const solutions = [
    { id: 'half', starts: [0,4,6,7], lengths: [4,2,1,1], symbols: ['1','','2','','3','','4','&'], spans: [[0,3]] },
    { id: 'dotted-quarter', starts: [0,3,4], lengths: [3,1,4], symbols: ['1','','2','&','3','','4',''], spans: [[0,2],[4,7]] },
    { id: 'rest', starts: [0,2,4,5,6], lengths: [2,2,1,1,2], symbols: ['1','','2','','3','&','4',''], spans: [] },
    { id: 'dotted-half', starts: [0,6], lengths: [6,2], symbols: ['1','','2','','3','','4',''], spans: [[0,5]] },
  ];
  for (const solution of solutions) {
    await fixture.selectOption(solution.id);
    assert.equal(await slots.filter({ hasText: '·' }).count(), 8, 'fixture switch must clear answers');
    const geometry = await page.locator('.notation g').evaluateAll(nodes => nodes.map(n => ({ start: Number(n.dataset.start), duration: Number(n.dataset.duration) })));
    assert.deepEqual(geometry.map(e => e.start), solution.starts);
    assert.deepEqual(geometry.map(e => e.duration), solution.lengths);
    const alignment = await page.evaluate(() => {
      const svg = document.querySelector('.notation').getBoundingClientRect();
      return [...document.querySelectorAll('.notation g')].map(g => {
        const tick = Number(g.dataset.start), r = document.querySelectorAll('.count-slot')[tick].getBoundingClientRect();
        return Math.abs(r.x + r.width / 2 - (svg.x + (16 + tick * 11) / 100 * svg.width));
      });
    });
    assert.ok(alignment.every(delta => delta < 1));
    for (let tick = 0; tick < 8; tick++) if (solution.symbols[tick]) await enter(tick, solution.symbols[tick]);
    for (const span of solution.spans) await addLine(...span);
    if (solution.id === 'rest') { await slots.nth(2).click(); await page.keyboard.press('('); }
    const before = await slots.allTextContents();
    assert.deepEqual(await check(), [solution.id === 'dotted-quarter' ? 'provisional' : 'correct', 'correct', 'correct']);
    assert.deepEqual(await slots.allTextContents(), before);
    await page.screenshot({ path: `${output}/${solution.id}.png`, fullPage: true });
    await enter(0, '4');
    assert.match(await page.locator('.feedback').innerText(), /Answer edited/);
    assert.deepEqual(await check(), ['revise','correct','correct']);
    await enter(0, '1');
    await slots.nth(0).click(); await control('( ) Rest').tap();
    assert.equal((await check())[2], 'revise');
    await control('( ) Rest').tap();
    if (solution.spans.length) await control('Remove line 1').click();
    else await addLine(0, 2);
    assert.equal((await check())[1], 'revise');
    report.checks.push(`${solution.id}: positions, duration, alignment, entry, answer preservation, independent correction`);
  }
  await fixture.selectOption('dotted-quarter');
  for (const [tick, symbol] of ['1','','2','&','3','','4',''].entries()) if (symbol) await enter(tick, symbol);
  const convention = page.getByLabel('Dotted-quarter counting convention', { exact: true });
  await convention.selectOption('required'); assert.equal((await check())[0], 'revise');
  await enter(1, '&'); assert.equal((await check())[0], 'correct');
  await convention.selectOption('optional'); assert.equal((await check())[0], 'correct');
  await enter(1, 'Delete'); assert.equal((await check())[0], 'correct');
  report.checks.push('teacher-dependent required/optional dotted-quarter rules');
  await fixture.selectOption('half');
  await slots.nth(0).click(); await page.keyboard.press('1'); await page.keyboard.press('ArrowRight');
  assert.equal(await slots.nth(1).evaluate(n => n === document.activeElement), true);
  await page.keyboard.press('e'); await page.keyboard.press('a'); assert.equal(await slots.nth(1).innerText(), 'a');
  await page.keyboard.press('Backspace'); assert.equal(await slots.nth(1).innerText(), '·');
  await page.keyboard.press('End'); assert.equal(await slots.nth(7).evaluate(n => n === document.activeElement), true);
  await page.keyboard.press('Home'); assert.equal(await slots.nth(0).evaluate(n => n === document.activeElement), true);
  await page.keyboard.press('Tab'); assert.equal(await slots.nth(1).evaluate(n => n === document.activeElement), true);
  await control('2').tap(); assert.equal(await slots.nth(1).innerText(), '2');
  await control('Erase').tap(); assert.equal(await slots.nth(1).innerText(), '·');
  await addLine(0, 3);
  assert.equal(await slots.nth(0).evaluate(n => n.classList.contains('sustained')), false);
  assert.equal(await slots.nth(2).evaluate(n => n.classList.contains('sustained')), true);
  await control('Shorten line 1').tap();
  assert.equal(await page.getByRole('slider', { name: 'Line 1 end', exact: true }).getAttribute('aria-valuenow'), '2');
  await control('Lengthen line 1').tap();
  await control('Set line 1 end').tap(); await slots.nth(2).tap();
  assert.equal(await page.getByRole('slider', { name: 'Line 1 end', exact: true }).getAttribute('aria-valuenow'), '2');
  await control('Lengthen line 1').tap();
  const end = page.getByRole('slider', { name: 'Line 1 end', exact: true });
  await end.focus(); await page.keyboard.press('ArrowLeft'); assert.equal(await end.getAttribute('aria-valuenow'), '2');
  const box = await end.boundingBox(), target = await slots.nth(3).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(target.x + target.width / 2, box.y + box.height / 2, { steps: 8 }); await page.mouse.up();
  assert.equal(await end.getAttribute('aria-valuenow'), '3');
  if (engine === 'chromium') {
    const cdp = await context.newCDPSession(page);
    const touchBox = await end.boundingBox(), touchTarget = await slots.nth(2).boundingBox();
    const y = touchBox.y + touchBox.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchBox.x + touchBox.width / 2, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchTarget.x + touchTarget.width / 2, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await end.getAttribute('aria-valuenow'), '2');
    await cdp.detach();
    report.checks.push('synthetic touch drag of duration endpoint');
  }
  await page.getByLabel('Line 1 end position', { exact: true }).selectOption('2');
  assert.equal(await end.getAttribute('aria-valuenow'), '2');
  assert.equal(await page.getByLabel('Line 1 end position', { exact: true }).evaluate(n => n === document.activeElement), true);
  await slots.nth(2).click(); await control('Start duration line').click(); await slots.nth(4).focus(); await page.keyboard.press('Escape');
  assert.equal(await control('Start duration line').count(), 1);
  await control('Reset answer').click(); assert.equal(await slots.filter({ hasText: '·' }).count(), 8);
  assert.equal(await slots.nth(0).evaluate(n => n === document.activeElement), true);
  assert.equal(await page.getByRole('slider').count(), 0);
  report.checks.push('keyboard entry/replacement/deletion/navigation; touch keypad; drag/key/select span editing; cancellation; reset focus');
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await fixture.selectOption('half');
    await addLine(0, 3);
    await control('Shorten line 1').tap();
    await control('Set line 1 end').tap(); await slots.nth(3).tap();
    assert.equal(await page.getByRole('slider', { name: 'Line 1 end', exact: true }).getAttribute('aria-valuenow'), '3');
    await page.screenshot({ path: `${output}/line-touch-${width}.png`, fullPage: true });
    await fixture.selectOption('rest');
    for (const [tick, symbol] of ['1','','2','','3','&','4',''].entries()) if (symbol) {
      await slots.nth(tick).tap(); await control(symbol).tap();
    }
    await slots.nth(2).tap(); await control('( ) Rest').tap();
    await slots.nth(0).click(); await page.keyboard.press('End');
    const layout = await page.evaluate(() => {
      const focus = document.activeElement.getBoundingClientRect(), scroll = document.querySelector('.score-scroll').getBoundingClientRect();
      const svg = document.querySelector('.notation').getBoundingClientRect();
      return { documentWidth: document.documentElement.scrollWidth, width: innerWidth, visible: focus.left >= scroll.left + 3 && focus.right <= scroll.right - 3,
        alignment: [...document.querySelectorAll('.notation g')].map(g => {
          const tick = Number(g.dataset.start), r = document.querySelectorAll('.count-slot')[tick].getBoundingClientRect();
          return Math.abs(r.x + r.width / 2 - (svg.x + (16 + tick * 11) / 100 * svg.width));
        }), outline: getComputedStyle(document.activeElement).outlineStyle };
    });
    assert.ok(layout.documentWidth <= width + 1, 'page must not overflow horizontally');
    assert.ok(layout.visible, 'last slot must scroll into view');
    assert.ok(layout.alignment.every(delta => delta < 1));
    assert.equal(layout.outline, 'solid');
    await page.keyboard.press('Home');
    assert.equal(await page.locator('.score-scroll').evaluate(n => n.scrollLeft), 0, 'Home must also restore the time signature');
    await page.screenshot({ path: `${output}/width-${width}.png`, fullPage: true });
    report.checks.push(`${width}px: aligned scroll region, no page overflow, keyboard focus visible`);
  }
  // Settings must preserve work, apply supported choices, and keep future controls inert.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await fixture.selectOption('dotted-quarter');
  await enter(0, '1');
  await check();
  const nav = page.getByRole('navigation', { name: 'Rhythm pages' });
  await nav.getByRole('link', { name: 'Settings', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/#settings');
  const settings = page.getByRole('region', { name: 'Rhythm settings', exact: true });
  await settings.waitFor({ state: 'visible' });
  assert.equal(await settings.isVisible(), true);
  assert.equal(await page.getByRole('heading', { name: 'Rhythm settings', exact: true }).evaluate(n => n === document.activeElement), true);
  assert.equal(await page.getByLabel('Editable measure', { exact: true }).isVisible(), false);
  await page.getByLabel('Dotted-quarter internal &', { exact: true }).selectOption('required');
  await nav.getByRole('link', { name: 'Count Writing', exact: true }).click();
  assert.equal(await slots.nth(0).innerText(), '1');
  assert.match(await page.locator('.feedback').innerText(), /Answer edited/);
  assert.equal(await convention.inputValue(), 'required');
  // Editor changes synchronize back into Settings.
  await convention.selectOption('optional');
  await nav.getByRole('link', { name: 'Settings', exact: true }).click();
  await settings.waitFor({ state: 'visible' });
  assert.equal(await page.getByLabel('Dotted-quarter internal &', { exact: true }).inputValue(), 'optional');
  assert.equal(await page.getByLabel('Practice exercise', { exact: true }).inputValue(), 'dotted-quarter');
  await page.getByLabel('Practice exercise', { exact: true }).selectOption('rest');
  await page.getByRole('link', { name: 'Back to Count Writing', exact: true }).click();
  assert.equal(await fixture.inputValue(), 'rest');
  assert.equal(await slots.filter({ hasText: '·' }).count(), 8);
  await page.goBack();
  await settings.waitFor({ state: 'visible' });
  assert.equal(await settings.isVisible(), true);
  await control('Expand all groups').click();
  assert.equal(await settings.locator('details[open]').count(), 9);
  const futureControls = settings.locator('.setting-row input, .setting-row button, .setting-row select');
  assert.ok(await futureControls.count() > 0);
  assert.ok(await futureControls.evaluateAll(nodes => nodes.every(n => n.disabled)), 'future controls must not accept configuration');
  for (const label of ['Starting vocabulary', 'Progression goal vocabulary', 'Allowed meters', 'Rhythm Walk session format']) {
    assert.equal(await settings.getByRole('group', { name: label, exact: true }).isVisible(), true);
  }
  assert.equal(await settings.getByRole('checkbox', { name: '4/4', exact: true }).isChecked(), true);
  assert.equal(await settings.getByRole('checkbox', { name: 'Allow meter changes within an exercise', exact: true }).isChecked(), false);
  assert.equal(await settings.getByRole('checkbox', { name: 'Guided review after performance', exact: true }).isChecked(), true);
  assert.equal(await settings.getByRole('checkbox', { name: 'Live correctness feedback', exact: true }).isChecked(), false);
  assert.equal(await settings.locator('[data-setting="starting-vocabulary"] input:checked').count(), 0);
  assert.equal(await settings.locator('[data-setting="goal-vocabulary"] input:checked').count(), 0);
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'expanded settings must fit viewport');
    await page.screenshot({ path: `${output}/settings-expanded-${width}.png`, fullPage: true });
  }
  await control('Collapse all groups').click();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: `${output}/settings-375.png`, fullPage: true });
  await page.reload();
  await page.waitForURL('**/#settings');
  assert.equal(await settings.isVisible(), true, 'settings deep link survives reload');
  assert.equal(await page.getByLabel('Practice exercise', { exact: true }).inputValue(), 'half');
  assert.equal(await page.getByLabel('Dotted-quarter internal &', { exact: true }).inputValue(), 'review');
  await page.getByRole('link', { name: 'Skip to content', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await settings.isVisible(), true, 'skip link must not switch to practice');
  report.checks.push('Settings: keyboard navigation, answer preservation, shared convention, fixture reset, history/deep link, disabled future options and responsive layout');
  assert.deepEqual(errors, []);
  report.passed = true;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ ...report, errors }, null, 2));
  await browser.close(); await host?.close();
}
console.log(`${engine}: Count Writing browser checks passed (${url}).`);
