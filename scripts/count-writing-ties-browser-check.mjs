import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { passageGrid } from '../src/apps/count-writing/passage.ts';
import { hostBuild } from './test-host.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const output = `dist/validation/count-ties-${engine}`;
await mkdir(output, { recursive: true });
const host = await hostBuild(), browser = await ({ chromium, firefox })[engine].launch();
const report = { engine, passed: false, checks: [], physicalDeviceChecks: 'not performed' };
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, hasTouch: true });
  await context.addInitScript(() => { let seed = 53; Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  const goto = id => page.goto(new URL(`/prototypes/count-writing/?fixture=${id}`, host.url).href);
  const bars = page.locator('.passage-measure'), slots = page.locator('.count-slot'), anchors = page.locator('.duration-anchor');
  const button = name => page.getByRole('button', { name, exact: true });
  const settings = async () => { await page.getByRole('link', { name: 'Settings', exact: true }).click(); await page.locator('#settings-view').waitFor({ state: 'visible' }); };
  const practice = async () => { await page.getByRole('link', { name: 'Back to Uno234', exact: true }).click(); await page.locator('#practice-view').waitFor({ state: 'visible' }); };
  const snapshot = () => bars.evaluateAll(nodes => nodes.map(node => ({ notation: node.querySelector('.notation').outerHTML, symbols: [...node.querySelectorAll('.count-slot')].map(n => n.textContent), lines: [...node.querySelectorAll('.duration-line:not(.draft-line)')].map(n => [n.style.cssText, n.dataset.incoming, n.dataset.outgoing]), rests: [...node.querySelectorAll('.rest-group')].map(n => [n.dataset.start, n.dataset.end]) })));
  const setRule = async () => { await settings(); await page.getByLabel('Dotted-quarter internal &', { exact: true }).selectOption('required'); await practice(); };
  const add = async (start, end) => { await page.getByLabel('Passage line start', { exact: true }).selectOption(String(start)); await page.getByLabel('Passage line end', { exact: true }).selectOption(String(end)); await button('Save duration line').tap(); };
  const fixtures = [
    ['tie-within-beat', [0,2,4,6], [[0,1],[4,6]]],
    ['tie-across-beat', [0,2,4,6], [[0,2],[4,6]]],
    ['tie-dotted', [0,1,2,3,4,6], [[0,2],[4,6]]],
    ['syncopation', [0,1,2,3,4,6], [[1,2],[4,6]]],
    ['tie-chain', [0,2,4,6], [[0,2],[4,6]]],
    ['tie-offbeat', [0,1,2,3,4,6], [[1,3],[4,6]]],
    ['tie-across-bar', [0,2,4,6,8,10,12,14], [[0,2],[6,8],[10,12]]],
    ['tie-wrap', [0,2,4,6,8,10,12,14], [[0,2],[6,8],[10,12]]],
    ['tie-rests', [0,2,4,6], [[2,3]]],
  ];
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [id, counts, lines] of fixtures) {
      await goto(id); await setRule();
      if (id !== 'syncopation') assert.ok(await page.locator('[data-tie]').count() > 0);
      for (const position of counts) await slots.nth(position).press(position % 2 ? '&' : String(position % 8 / 2 + 1));
      for (const [start, end] of lines) { if (id === 'syncopation') { await anchors.nth(start).tap(); await anchors.nth(end).tap(); } else await add(start, end); }
      if (id === 'tie-rests') for (const position of [0,4]) { await slots.nth(position).focus(); await page.keyboard.press('('); await page.keyboard.press('Enter'); }
      const before = await snapshot(); await button('Check').tap(); assert.deepEqual(await snapshot(), before, `${id}: Check keeps answers`);
      assert.ok((await page.locator('.dimension').evaluateAll(nodes => nodes.map(n => n.className))).every(name => name === 'dimension correct'), await page.locator('.feedback').allTextContents());
      await button('Retry').tap(); assert.deepEqual(await snapshot(), before);
      if (id === 'tie-wrap') {
        const geometry = await bars.evaluateAll(nodes => nodes.map(n => { const b = n.getBoundingClientRect(); return { y: b.y, x: b.x }; }));
        assert.ok(geometry[1].y > geometry[0].y, 'fixture explicitly wraps systems');
        assert.equal(await page.locator('.passage-ties [data-tie="outgoing"][data-measure="1"]').count(), 1);
        assert.equal(await page.locator('.passage-ties [data-tie="incoming"][data-measure="2"]').count(), 1);
        assert.equal(await bars.nth(0).locator('.passage-duration[data-outgoing="true"]').count(), 1);
        assert.equal(await bars.nth(1).locator('.passage-duration[data-incoming="true"]').count(), 1);
        await page.setViewportSize({ width: 320, height: 1000 });
        const stacked = true;
        assert.equal(await page.locator('.passage-ties [data-tie="across-bar"]').count(), stacked ? 0 : 1, 'automatic systems preserve the correct tie join');
        assert.equal(await page.locator('.passage-ties [data-tie="incoming"], .passage-ties [data-tie="outgoing"]').count(), stacked ? 2 : 0, 'narrow systems retain broken tie hooks');
        await button('Check').tap();
        assert.ok((await page.locator('.dimension').evaluateAll(nodes => nodes.map(n => n.className))).every(name => name === 'dimension correct'), 'changing visual systems does not change grading');
        await page.setViewportSize({ width, height: 1000 });
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${id}: no page overflow at ${width}`);
      await page.screenshot({ path: `${output}/${id}-${width}.png`, fullPage: true });
    }
  }
  report.checks.push('All focused tied fixtures graded correctly on desktop and 320px; wrapped arcs/lines and wrap-independent grading; Check/Retry preservation');
  await goto('tie-rests');
  await slots.nth(0).focus();
  await page.keyboard.down('Shift'); await page.keyboard.press('('); await page.keyboard.up('Shift');
  await page.keyboard.down('Shift'); await page.keyboard.press(')'); await page.keyboard.up('Shift');
  assert.equal(await page.locator('.rest-group[data-start="0"][data-end="0"]').count(), 1, 'physical Shift used for closing parentheses preserves the open rest');
  await page.getByRole('button', { name: 'Edit rest parentheses at measure 1, beat 1', exact: true }).click();
  await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
  assert.equal(await page.locator('.draft-line').count(), 0, 'Shift+arrow continues editing the rest rather than starting a duration line');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.rest-group[data-start="0"][data-end="0"]').count(), 1, 'cancelling a shifted rest edit restores its saved pair');
  assert.equal(await page.locator('.passage-duration').count(), 0, 'rest entry never commits a duration line');
  report.checks.push('Physical Shift+parenthesis closes rests in tied exercises; shifted rest navigation and cancellation preserve saved groups');
  await goto('tie-wrap'); await setRule();
  // Two-touch placement crosses a wrapped barline, and endpoint cancellation retains the saved line.
  await anchors.nth(6).tap(); await anchors.nth(8).tap();
  const saved = await snapshot();
  await button('Edit passage line 1: measure 1, beat 4 to measure 2, beat 1 offbeat').first().tap();
  await page.getByLabel('Passage line end', { exact: true }).selectOption('10');
  await page.keyboard.press('Escape'); assert.deepEqual(await snapshot(), saved);
  await button('Edit passage line 1: measure 1, beat 4 to measure 2, beat 1 offbeat').first().tap();
  await settings(); await practice(); assert.deepEqual(await snapshot(), saved, 'view change cancels draft');
  await button('Clear').tap();
  await slots.nth(6).focus(); await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight');
  assert.equal(await slots.nth(8).evaluate(n => n === document.activeElement), true);
  await page.keyboard.up('Shift');
  assert.equal(await bars.nth(0).locator('.passage-duration[data-outgoing="true"]').count(), 1);
  assert.equal(await bars.nth(1).locator('.passage-duration[data-incoming="true"]').count(), 1);
  const keyboardSaved = await snapshot();
  await slots.nth(8).focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await slots.nth(6).evaluate(n => n === document.activeElement), true);
  assert.deepEqual(await snapshot(), keyboardSaved, 'Shift+Tab navigates without changing a saved line');
  await slots.nth(8).focus(); await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape'); await page.keyboard.up('Shift');
  assert.deepEqual(await snapshot(), keyboardSaved, 'keyboard cancellation restores full cross-measure span');
  await button('Edit passage line 1: measure 1, beat 4 to measure 2, beat 1 offbeat').first().tap();
  await page.getByLabel('Passage line end', { exact: true }).selectOption('10'); await button('Save duration line').tap();
  await slots.nth(6).press('4'); await slots.nth(8).press('4'); await button('Check').tap();
  assert.match(await page.locator('.feedback').allTextContents().then(v => v.join(' ')), /Incorrect sustained continuation count.*Incorrectly extended|Incorrectly extended.*Incorrect sustained continuation count/s);
  report.checks.push('Touch and Shift+arrow entry cross measure/system boundaries; Escape and navigation restore saved endpoints; targeted continuation/extended-line feedback');
  async function solveGenerated() {
    const source = await bars.evaluateAll(nodes => nodes.map(node => ({ meter: [4,4], events: [...node.querySelectorAll('g[data-start]')].map(mark => [mark.dataset.value, { ...(mark.dataset.kind === 'rest' ? { rest: true } : {}), ...(Number(mark.dataset.dots) ? { dots: Number(mark.dataset.dots) } : {}), ...(mark.dataset.tieNext === 'true' ? { tieNext: true } : {}) }]) })));
    const grid = passageGrid(source);
    for (const [position, slot] of grid.slots.entries()) if (slot.attack || slot.onCount || slot.dottedInternal) {
      await slots.nth(position).focus(); await page.keyboard.press(slot.symbol);
    }
    const external = await page.getByLabel('Passage line start', { exact: true }).count();
    for (const sound of grid.sustained) {
      const end = grid.available.filter(p => p >= sound.start && p <= sound.end).at(-1);
      if (external) await add(sound.start, end);
      else { await anchors.nth(sound.start).tap(); await anchors.nth(end).tap(); }
    }
    for (const sound of grid.sounding.filter(s => s.rest)) {
      const required = grid.slots.flatMap((s, p) => p >= sound.start && p <= sound.end && (s.attack || s.onCount || s.dottedInternal) ? [p] : []);
      const end = required.at(-1);
      await slots.nth(sound.start).focus(); await page.keyboard.press('(');
      for (const _ of grid.available.filter(p => p > sound.start && p <= end)) await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
    }
  }
  for (const width of [1280,320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const ties of [false, true]) for (const sync of [false, true]) for (const length of [1,2,3,4]) {
    await settings();
    await page.locator('[data-setting="ties"]').setChecked(ties);
    await page.locator('[data-setting="syncopation"]').setChecked(sync);
    await page.getByLabel('Exercise length', { exact: true }).selectOption(String(length));
    const before = await snapshot(); await practice(); assert.deepEqual(await snapshot(), before);
    await button('Next exercise').tap(); assert.equal(await bars.count(), length);
    assert.equal(await page.locator('.dimension').count(), 0);
    if (!ties) assert.equal(await page.locator('[data-tie]').count(), 0);
    await solveGenerated(); const solved = await snapshot();
    await button('Check').tap(); assert.equal(await page.locator('.dimension').count(), length * 3);
    assert.ok((await page.locator('.dimension').evaluateAll(nodes => nodes.map(n => n.className))).every(name => name === 'dimension correct'), await page.locator('.feedback').allTextContents());
    assert.deepEqual(await snapshot(), solved);
    await button('Retry').tap(); assert.deepEqual(await snapshot(), solved);
    await button('Next exercise').tap(); assert.equal(await bars.count(), length);
    assert.ok((await slots.allTextContents()).every(s => s === '·'));
  }
  }
  report.checks.push('Independent ties/syncopation controls, lengths 1–4, pending settings preserve answers; Next/Check/Retry continue working');
  for (const width of [1280,320]) {
    await page.setViewportSize({ width, height: 1000 });
    await settings();
    assert.match(await page.locator('#settings-view').innerText(), /Preferences are saved automatically in this browser/);
    const previous = await snapshot();
    await page.getByLabel('Exercise length', { exact: true }).selectOption('3');
    await page.locator('[data-setting="ties"]').uncheck(); await page.locator('[data-setting="syncopation"]').uncheck();
    for (const ingredient of await page.locator('[data-ingredient]').all()) await ingredient.uncheck();
    assert.equal(await button('New Exercise').isDisabled(), true);
    assert.deepEqual(await snapshot(), previous, 'invalid pending settings keep the current exercise');
    await page.locator('[data-ingredient="quarter"]').check();
    assert.equal(await button('New Exercise').isDisabled(), false);
    await button('New Exercise').tap(); await page.locator('#practice-view').waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).hash, '#practice');
    assert.equal(await bars.count(), 3);
    assert.ok((await slots.allTextContents()).every(s => s === '·'));
    assert.deepEqual(await bars.locator('g[data-start]').evaluateAll(nodes => [...new Set(nodes.map(n => n.dataset.value))]), ['Q']);
    assert.equal(await slots.nth(0).evaluate(n => n === document.activeElement), true);
    await page.screenshot({ path: `${output}/settings-new-exercise-${width}.png`, fullPage: true });
    await settings(); await page.screenshot({ path: `${output}/settings-action-${width}.png`, fullPage: true });
    await practice();
  }
  report.checks.push('Settings autosave note and New Exercise action: invalid settings preserve the answer; valid settings generate the selected ingredients/length, return to practice and focus the first count at desktop and mobile widths');
  await page.evaluate(() => localStorage.removeItem('tuno.rhythm-walk.preferences.v1')); await page.reload(); await settings();
  assert.equal(await page.locator('[data-setting="ties"]').isChecked(), false);
  assert.equal(await page.locator('[data-setting="syncopation"]').isChecked(), false);
  assert.equal(await page.getByLabel('Exercise length', { exact: true }).inputValue(), '2');
  assert.deepEqual(errors, []); report.passed = true;
  console.log(`${engine}: Count Writing ties and syncopation checks passed.`);
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close(); await host.close();
}
