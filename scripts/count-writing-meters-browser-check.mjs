import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { meterFixtures } from '../src/apps/count-writing/fixtures.ts';
import { passageGrid } from '../src/apps/count-writing/passage.ts';
import { hostBuild } from './test-host.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const output = `dist/validation/count-meters-${engine}`;
await mkdir(output, { recursive: true });
const host = await hostBuild(), browser = await ({ chromium, firefox })[engine].launch();
const report = { engine, passed: false, checks: [], physicalDeviceChecks: 'not performed' };
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, hasTouch: true });
  await context.addInitScript(() => { let seed = 67; Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  const bars = page.locator('.passage-measure'), slots = page.locator('.count-slot'), anchors = page.locator('.duration-anchor');
  const button = name => page.getByRole('button', { name, exact: true });
  const settings = async () => { await page.getByRole('link', { name: 'Settings', exact: true }).click(); await page.locator('#settings-view').waitFor({ state: 'visible' }); };
  const practice = async () => { await page.getByRole('link', { name: 'Back to Uno234', exact: true }).click(); await page.locator('#practice-view').waitFor({ state: 'visible' }); };
  const snapshot = () => bars.evaluateAll(nodes => nodes.map(node => ({ score: node.querySelector('.notation').outerHTML, symbols: [...node.querySelectorAll('.count-slot')].map(n => n.textContent), lines: [...node.querySelectorAll('.duration-line:not(.draft-line)')].map(n => [n.style.cssText, n.dataset.incoming, n.dataset.outgoing]), rests: [...node.querySelectorAll('.rest-group')].map(n => [n.dataset.start, n.dataset.end]) })));
  async function solve(source) {
    const grid = passageGrid(source);
    for (const [p, slot] of grid.slots.entries()) if (slot.attack || slot.onCount || slot.dottedInternal) await slots.nth(p).press(slot.symbol);
    const external = await page.getByLabel('Passage line start', { exact: true }).count();
    for (const sound of grid.sustained) {
      const end = grid.available.filter(p => p >= sound.start && p <= sound.end).at(-1);
      if (external) {
        await page.getByLabel('Passage line start', { exact: true }).selectOption(String(sound.start));
        await page.getByLabel('Passage line end', { exact: true }).selectOption(String(end));
        await button('Save duration line').tap();
      } else { await anchors.nth(sound.start).tap(); await anchors.nth(end).tap(); }
    }
    for (const sound of grid.sounding.filter(s => s.rest)) {
      const end = grid.slots.flatMap((s, p) => p >= sound.start && p <= sound.end && (s.attack || s.onCount || s.dottedInternal) ? [p] : []).at(-1);
      await slots.nth(sound.start).focus();
      await page.keyboard.down('Shift'); await page.keyboard.press('('); await page.keyboard.up('Shift');
      for (const _ of grid.available.filter(p => p > sound.start && p <= end)) await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.down('Shift'); await page.keyboard.press(')'); await page.keyboard.up('Shift');
    }
  }
  async function check() {
    await button('Check').tap();
    assert.ok((await page.locator('.dimension').evaluateAll(nodes => nodes.map(n => n.className))).every(c => c === 'dimension correct'), (await page.locator('.feedback').allTextContents()).join(' '));
  }
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const f of meterFixtures) {
      await page.goto(new URL(`/prototypes/count-writing/?fixture=${f.id}`, host.url).href);
      const compound = f.measures[0].meter[1] === 8;
      assert.equal(await page.getByLabel('Dotted-quarter internal &', { exact: true }).isDisabled(), compound);
      if (f.id === 'six-eighths') {
        const beams = await bars.locator('[data-beam]').evaluateAll(nodes => nodes.map(n => Number(n.parentElement.dataset.start)));
        assert.deepEqual(beams, [0,1,3,4], 'two three-eighth beams, no beam crosses counts 3/4');
        await slots.nth(4).tap(); assert.equal(await page.locator('.draft-line').count(), 0, 'touch popover scrolling must not start a duration line'); await button('Enter count 5').tap(); await button('Enter count 6').tap();
        assert.deepEqual((await slots.allTextContents()).slice(4), ['5','6']); await button('Clear').tap();
      }
      await solve(f.measures); const saved = await snapshot(); await check(); await button('Retry').tap(); assert.deepEqual(await snapshot(), saved);
      if (f.id === 'six-wrap' || f.id === 'six-bar-tie') {
        assert.equal(await bars.nth(0).locator('.passage-duration[data-outgoing="true"]').count(), 1);
        assert.equal(await bars.nth(1).locator('.passage-duration[data-incoming="true"]').count(), 1);
        const lineAnswer = await snapshot();
        await button('Edit passage line 2: measure 1, count 4 to measure 2, count 3').first().tap();
        await page.getByLabel('Passage line end', { exact: true }).selectOption('9');
        await page.keyboard.press('Escape'); assert.equal(await page.locator('.draft-line').count(), 0); assert.deepEqual(await snapshot(), lineAnswer, 'cancellation restores a cross-bar 6/8 line');
        await page.screenshot({ path: `${output}/${f.id}-original-${width}.png`, fullPage: true });
        await page.setViewportSize({ width: 320, height: 1000 }); await check();
        await slots.nth(5).focus(); await page.keyboard.press('ArrowRight');
        assert.equal(await slots.nth(6).evaluate(n => n === document.activeElement), true);
        await page.keyboard.press('Shift+Tab'); assert.equal(await slots.nth(5).evaluate(n => n === document.activeElement), true);
        await page.setViewportSize({ width, height: 1000 });
      }
      if (f.id === 'six-rest-first') {
        await button('Edit rest parentheses at measure 1, count 1').tap();
        await page.keyboard.press('Shift+ArrowLeft'); await page.keyboard.press('Escape'); assert.deepEqual(await snapshot(), saved);
        await settings(); await page.getByLabel('Duration-line placement', { exact: true }).selectOption('above'); await practice();
        assert.deepEqual(await slots.allTextContents(), ['1','2','3','4','5','6']); await check();
      }
      const response = (await snapshot()).map(({ score, ...answer }) => answer), writtenFeedback = await page.locator('.write-response').innerText();
      const exerciseId = await page.locator('.passage').getAttribute('data-exercise-id');
      const music = () => bars.locator('g[data-event]').evaluateAll(nodes => nodes.map(n => [n.dataset.value, n.dataset.start, n.dataset.duration, n.dataset.kind, n.dataset.dots, n.dataset.tieNext]));
      const score = await music();
      for (const mode of ['tap', 'both', 'write']) {
        await page.getByLabel('Mode', { exact: true }).selectOption(mode);
        assert.equal(await page.locator('.passage').getAttribute('data-exercise-id'), exerciseId);
        assert.deepEqual(await music(), score, 'all modes retain the same musical notation');
        assert.deepEqual((await snapshot()).map(({ score, ...answer }) => answer), response, 'all modes retain the saved response');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (mode === 'tap') {
          assert.equal(await page.locator('.write-response').isVisible(), false);
          assert.equal(await page.locator('.answer-area').first().isVisible(), false);
        }
      }
      assert.equal(await page.locator('.write-response').innerText(), writtenFeedback, 'return restores count feedback');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `${output}/${f.id}-${width}.png`, fullPage: true });
    }
    report.checks.push(`Fixed meter fixtures and interactions passed at ${width}px`);
    console.log(`${engine}: meter fixture checks passed at ${width}px.`);
    for (const meter of ['2/4','3/4','4/4','6/8']) for (const ties of [false, true]) for (const syncopation of [false, true]) for (const length of [1,2,3,4]) {
      await settings(); const saved = await snapshot();
      for (const choice of await page.locator('[data-meter]').all()) await choice.setChecked(await choice.getAttribute('data-meter') === meter);
      await page.getByLabel('Exercise length', { exact: true }).selectOption(String(length));
      for (const ingredient of await page.locator('[data-ingredient]').all()) await ingredient.uncheck();
      for (const id of ['quarter','eighth','dotted-quarter','quarter-rest','eighth-rest', ...(meter === '6/8' ? ['dotted-quarter-rest'] : [])]) await page.locator(`[data-ingredient="${id}"]`).check();
      await page.locator('[data-setting="ties"]').setChecked(ties); await page.locator('[data-setting="syncopation"]').setChecked(syncopation);
      assert.deepEqual(await snapshot(), saved, 'pending settings preserve notation and answer');
      await button('New Exercise').tap(); await page.locator('#practice-view').waitFor({ state: 'visible' }); assert.equal(await bars.count(), length);
      const source = await bars.evaluateAll((nodes, meter) => nodes.map(node => ({ meter: meter.split('/').map(Number), events: [...node.querySelectorAll('g[data-start]')].map(mark => [mark.dataset.value, { ...(mark.dataset.kind === 'rest' ? { rest: true } : {}), ...(Number(mark.dataset.dots) ? { dots: Number(mark.dataset.dots) } : {}), ...(mark.dataset.tieNext === 'true' ? { tieNext: true } : {}) }]) })), meter);
      assert.equal(await slots.count(), length * (meter === '2/4' ? 4 : meter === '4/4' ? 8 : 6));
      if (meter !== '6/8') { await settings(); await page.getByLabel('Dotted-quarter internal &', { exact: true }).selectOption('required'); await practice(); }
      await solve(source); const answer = await snapshot(); await check(); await button('Retry').tap(); assert.deepEqual(await snapshot(), answer);
      await button('Next exercise').tap(); assert.ok((await slots.allTextContents()).every(s => s === '·'));
    }
  }
  report.checks.push('Explicit meter fixtures; 123/456 beams; touch 5/6; all meters/lengths/pattern modes at 1280/320; pending settings, Check/Retry/Next, saved rest cancellation, wraps and navigation');
  assert.deepEqual(errors, []); report.passed = true;
  console.log(`${engine}: Count Writing meter checks passed.`);
} finally { await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n'); await browser.close(); await host.close(); }
