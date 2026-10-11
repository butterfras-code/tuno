import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const output = `dist/validation/count-practice-${engine}`;
await mkdir(output, { recursive: true });
const host = await hostBuild();
const browser = await ({ chromium, firefox })[engine].launch();
const report = { engine, passed: false, checks: [], physicalDeviceChecks: 'not performed' };
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true });
  await context.addInitScript(() => { let seed = 53; Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/prototypes/count-writing/', host.url).href);
  const control = name => page.getByRole('button', { name, exact: true });
  const bars = page.locator('.passage-strip > section');
  const feedback = () => page.locator('.passage-feedback > .feedback');
  const settings = async () => { await page.getByRole('link', { name: 'Settings', exact: true }).click(); };
  const practice = async () => { await page.getByRole('link', { name: 'Back to Uno234', exact: true }).click(); };
  const snapshot = () => bars.evaluateAll(nodes => nodes.map(node => ({ notation: node.querySelector('.notation').outerHTML, symbols: [...node.querySelectorAll('.count-slot')].map(n => n.textContent), spans: [...node.querySelectorAll('.duration-line')].map(n => n.style.cssText), rests: [...node.querySelectorAll('.rest-group')].map(n => [n.dataset.start, n.dataset.end]) })));
  assert.equal(await page.locator('.passage .score-scroll').count(), 1, 'one scroller for the whole passage');
  assert.equal(await bars.locator('.notation text').count(), 2, 'time signature appears once at passage start');
  assert.equal(await page.locator('[data-ingredient="dotted-quarter-rest"]').isChecked(), false);
  assert.equal(await page.getByLabel('Allow unintuitive notation', { exact: true }).isChecked(), false);
  assert.equal(await bars.count(), 2, 'new session defaults to two measures');
  const initialSlot = bars.nth(0).locator('.count-slot').nth(0);
  await initialSlot.press('1');
  const before = await snapshot();
  assert.equal(await page.locator('.passage > .score-tempo input').count(), 1, 'tempo belongs to score');
  assert.equal(await page.locator('.tap-response input[type=number]').count(), 0);
  await settings();
  const metronome = page.getByLabel('Metronome during exercise', { exact: true });
  await metronome.uncheck(); await practice();
  assert.equal(await metronome.isVisible(), false, 'exercise metronome belongs to settings');
  assert.deepEqual(await snapshot(), before, 'performance preference preserves exercise and answer');
  await settings(); assert.equal(await metronome.isChecked(), false); await metronome.check(); await practice();
  await settings(); await page.getByLabel('Exercise length', { exact: true }).selectOption('4'); await practice();
  assert.deepEqual(await snapshot(), before, 'length setting preserves exercise and entered answer');
  await control('Check').click(); assert.deepEqual(await snapshot(), before, 'Check preserves answer');
  assert.match(await feedback().nth(1).innerText(), /Measure 2.*Count symbols/s);
  await control('Retry').click(); assert.deepEqual(await snapshot(), before, 'Retry preserves answer');
  await initialSlot.press('4'); await control('Check').click(); assert.match(await feedback().nth(0).innerText(), /beat 1/);
  report.checks.push('Default two bars; settings, Check and Retry preserve music and answer; feedback locates measure and beat');

  const beforePolicy = await snapshot();
  await settings();
  await page.getByLabel('Allow unintuitive notation', { exact: true }).check();
  await page.locator('[data-ingredient="dotted-quarter-rest"]').check();
  await practice(); assert.deepEqual(await snapshot(), beforePolicy, 'notation policy changes keep the current exercise and answer');
  await page.evaluate(() => { Math.random = () => .99; });
  await control('Next exercise').click();
  await page.evaluate(() => { let seed = 53; Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; });
  assert.ok(await bars.locator('g[data-kind="rest"] circle').count() > 0, 'explicit opt-in includes dotted quarter rests');
  await settings(); await page.getByLabel('Allow unintuitive notation', { exact: true }).uncheck();
  await practice(); assert.equal(await control('Next exercise').isDisabled(), false, 'incompatible dotted rests do not block generation');
  await control('Next exercise').click();
  assert.equal(await bars.locator('g[data-kind="rest"] circle').count(), 0, 'simple-meter dotted rests skipped without advanced notation');
  await settings(); await page.locator('[data-ingredient="dotted-quarter-rest"]').uncheck(); await practice();
  assert.equal(await control('Next exercise').isDisabled(), false);
  report.checks.push('Continuous staff and shared scrolling; beginner rest spelling; explicit advanced opt-in preserves current answers and validates dotted-rest choices');

  async function solve() {
    for (let index = 0; index < await bars.count(); index++) {
      const bar = bars.nth(index), slots = bar.locator('.count-slot'), anchors = bar.locator('.duration-anchor');
      const events = await bar.locator('g[data-start]').evaluateAll(nodes => nodes.map(n => ({ start: Number(n.dataset.start), duration: Number(n.dataset.duration), rest: n.dataset.kind === 'rest', dotted: !!n.querySelector('circle') })));
      const required = new Set([0, 2, 4, 6]);
      events.forEach(event => { required.add(event.start); if (event.dotted) for (let tick = event.start + 1; tick < event.start + event.duration; tick++) if (tick % 2) required.add(tick); });
      for (const tick of [...required].sort((a, b) => a - b)) await slots.nth(tick).press(tick % 2 ? '&' : String(tick / 2 + 1));
      for (const event of events) {
        const last = event.start + event.duration - 1;
        if ([0, 2, 4, 6].some(tick => tick > event.start && tick <= last)) {
          const available = await slots.evaluateAll(nodes => nodes.flatMap((n, i) => n.hidden ? [] : [i]));
          const endCount = available.filter(t => t <= last && t >= event.start).at(-1);
          await anchors.nth(event.start).tap(); await anchors.nth(endCount).tap();
        }
        if (event.rest) {
          const endCount = [...required].filter(t => t >= event.start && t <= last).sort((a, b) => a - b).at(-1);
          await slots.nth(event.start).focus(); await page.keyboard.press('(');
          while (await slots.nth(endCount).getAttribute('aria-pressed') !== 'true') await page.keyboard.press('ArrowRight');
          await page.keyboard.press('Enter');
        }
      }
    }
  }
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const length of [1, 2, 3, 4]) {
      await settings(); await page.getByLabel('Exercise length', { exact: true }).selectOption(String(length));
      await page.getByLabel('Dotted-quarter internal &', { exact: true }).selectOption('required'); await practice();
      await control('Next exercise').tap(); assert.equal(await bars.count(), length);
      assert.ok((await bars.locator('.count-slot').allTextContents()).every(text => text === '·'));
      const barBounds = await bars.evaluateAll(nodes => nodes.map(n => { const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right }; }));
      for (let index = 1; index < barBounds.length; index++) {
        if (Math.abs(barBounds[index].y - barBounds[index - 1].y) < 1) {
          assert.ok(Math.abs(barBounds[index].x - barBounds[index - 1].right) < 1, 'bars within a system are adjacent');
        } else {
          assert.ok(barBounds[index].y > barBounds[index - 1].y && Math.abs(barBounds[index].x - barBounds[0].x) < 1, 'automatic systems wrap in reading order');
        }
      }
      assert.equal(await bars.locator('.notation text').count(), 2);
      assert.equal(await page.locator('.passage-scroll').evaluate(n => n.scrollWidth <= n.clientWidth), true, `score needs no horizontal scrolling at ${width}px, ${length} measures`);
      const rests = await bars.locator('g[data-kind="rest"]').evaluateAll(nodes => nodes.map(n => ({ start: Number(n.dataset.start), duration: Number(n.dataset.duration), dotted: !!n.querySelector('circle') })));
      assert.ok(rests.every(rest => !rest.dotted && (rest.duration < 2 || rest.start % 2 === 0)), 'beginner notation keeps longer rests on beats and omits dotted rests');
      if (length > 1) {
        const first = bars.nth(0).locator('.count-slot:visible'), second = bars.nth(1).locator('.count-slot:visible');
        await first.last().focus(); await page.keyboard.press('ArrowRight'); assert.equal(await second.first().evaluate(n => n === document.activeElement), true);
        const nextBox = await second.first().boundingBox(), scoreBox = await page.locator('.passage-scroll').boundingBox();
        assert.ok(nextBox.x >= scoreBox.x - 1 && nextBox.x + nextBox.width <= scoreBox.x + scoreBox.width + 1, 'shared passage scrolling keeps the next measure count visible');
        await page.keyboard.press('Shift+Tab'); assert.equal(await first.last().evaluate(n => n === document.activeElement), true);
        await page.keyboard.press('Tab'); assert.equal(await second.first().evaluate(n => n === document.activeElement), true);
        await page.keyboard.press('Backspace'); assert.equal(await first.last().evaluate(n => n === document.activeElement), true);
        await first.last().press('&'); assert.equal(await second.first().evaluate(n => n === document.activeElement), true, 'symbol entry advances across barline');
        await control('Clear').click();
      }
      await solve(); const solved = await snapshot(); await control('Check').tap();
      assert.deepEqual(await snapshot(), solved);
      assert.ok((await page.locator('.dimension').evaluateAll(nodes => nodes.map(n => n.className))).every(name => name === 'dimension correct'), await page.locator('.feedback').allTextContents());
      await control('Retry').tap(); assert.deepEqual(await snapshot(), solved);
      await control('Check').tap();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no page overflow at ${width}, length ${length}: ${await page.evaluate(() => JSON.stringify([...document.querySelectorAll('body *')].filter(n => n.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(n).position === 'absolute').map(n => ({ tag: n.tagName, class: n.className, x: n.getBoundingClientRect().x }))))}`);
      await page.locator('.passage-scroll').evaluate(n => { n.scrollLeft = 0; });
      await page.screenshot({ path: `${output}/${width}-${length}.png`, fullPage: true });
      await control('Next exercise').tap(); assert.equal(await bars.count(), length);
      assert.equal(await page.locator('.dimension').count(), 0);
      assert.equal(await page.locator('.count-popover').count(), length, 'previous editor popovers are disposed');
    }
  }
  report.checks.push('Entire correct/retry/next loop at lengths 1–4 on desktop and 320px; keyboard/Tab/Backspace/auto-advance cross measures; touch duration lines and grouped rests');
  await settings();
  for (const ingredient of await page.locator('[data-ingredient]').all()) await ingredient.uncheck();
  assert.match(await page.locator('main').innerText(), /Select at least one/);
  await practice(); assert.equal(await control('Next exercise').isDisabled(), true);
  const unchanged = await snapshot();
  await settings(); await page.locator('.active-ingredients').getByLabel('Dotted quarter notes', { exact: true }).check();
  assert.match(await page.locator('main').innerText(), /cannot fill/);
  await page.locator('.active-ingredients').getByLabel('Half notes', { exact: true }).check();
  assert.equal(await control('New Exercise').isDisabled(), false, 'half notes fill bars while unavailable dotted quarters are skipped');
  await page.locator('.active-ingredients').getByLabel('Quarter notes', { exact: true }).check(); await page.locator('.active-ingredients').getByLabel('Eighth notes', { exact: true }).check(); await practice();
  assert.deepEqual(await snapshot(), unchanged); assert.equal(await control('Next exercise').isDisabled(), false);
  await control('Next exercise').tap();
  const generatedKinds = await bars.locator('g[data-start]').evaluateAll(nodes => nodes.map(n => [n.dataset.duration, n.dataset.kind]));
  assert.ok(generatedKinds.every(([duration, kind]) => ['1', '2', '3', '4'].includes(duration) && kind === 'note'));
  report.checks.push('Empty and impossible configurations explain and block Next; unavailable selected ingredients are skipped');
  await page.evaluate(() => localStorage.removeItem('tuno.rhythm-walk.preferences.v1')); await page.reload(); assert.equal(await bars.count(), 2);
  await settings(); await page.locator('.planned-settings > summary').click(); await control('Expand all groups').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/settings-320.png`, fullPage: true });
  // The idle pad starts the count-in; that first press/release is not an answer.
  await page.goto(new URL('/prototypes/rhythm-walk/?fixture=quarters', host.url).href);
  await page.getByLabel('Mode', { exact: true }).selectOption('tap');
  await page.setViewportSize({ width: 1366, height: 650 });
  const pad = control('Performance pad'), status = page.locator('.tap-response .status');
  const record = async () => {
    await page.locator('.timing-evidence > summary').click();
    const download = page.waitForEvent('download'); await control('Download timing evidence').click();
    const { readFile } = await import('node:fs/promises'); return JSON.parse(await readFile(await (await download).path(), 'utf8'));
  };
  assert.equal(await control('Start count-in').count(), 0);
  assert.equal(await control('Retry same exercise').count(), 0);
  assert.equal(await control('Wrap notation into systems').count(), 0);
  assert.equal(await page.locator('.count-in-display').isVisible(), false, 'idle count-in is hidden');
  await pad.focus(); await page.keyboard.down('Space');
  await status.filter({ hasText: 'Count-in' }).waitFor();
  assert.equal(await pad.locator('.count-in-display').isVisible(), true);
  assert.equal(await pad.locator('.pad-action').innerText(), 'Count In');
  await page.keyboard.up('Space');
  await control('Stop').click();
  assert.equal((await record()).events.length, 0, 'starting Space and its release never enter rhythm capture');
  assert.equal(await page.locator('.count-in-display').isVisible(), false, 'interrupted count-in is hidden');
  assert.match(await pad.innerText(), /Try again/);
  await pad.tap(); await status.filter({ hasText: 'Count-in' }).waitFor();
  await control('Stop').click();
  assert.equal((await record()).events.length, 0, 'starting touch and its release never enter rhythm capture');
  // A new press during count-in is retained separately, then the pad retries.
  await pad.focus(); await page.keyboard.press('Space'); await status.filter({ hasText: 'Count-in' }).waitFor();
  await page.locator('.count-in-beat[aria-current="true"]').first().waitFor();
  await page.keyboard.press('Space'); await control('Stop').click();
  const attempt = await record(); assert.equal(attempt.events.filter(e => e.accepted).length, 2);
  assert.ok(attempt.events.every(e => e.region === 'count-in'));
  await page.getByLabel('Tempo (quarter-note BPM)', { exact: true }).fill('180');
  await pad.tap(); await status.filter({ hasText: 'Count-in' }).waitFor();
  const countInBounds = await page.locator('.performance-surface').boundingBox();
  await status.filter({ hasText: 'Performing' }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.count-in-display').isVisible(), false, 'performing hides count-in indicators');
  assert.equal(await pad.locator('.pad-action').innerText(), 'Tap / hold');
  const inputBounds = await page.locator('.performance-surface').boundingBox();
  assert.ok(Math.abs(inputBounds.y - countInBounds.y) < 1 && Math.abs(inputBounds.height - countInBounds.height) < 1, 'pad stays in place across count-in/input states');
  await status.filter({ hasText: 'Reviewing' }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.count-in-display').isVisible(), false);
  assert.equal(await control('Download timing evidence').isVisible(), false, 'evidence download starts inside collapsed details');
  assert.match(await pad.innerText(), /Try again/);
  assert.equal((await record()).status, 'completed', 'pad-started attempt completes and offers retry');
  await page.getByLabel('Mode', { exact: true }).selectOption('write');
  await control('Practice help').click();
  assert.equal(await page.locator('#practice-help').evaluate(n => n.matches(':popover-open')), true);
  assert.match(await page.locator('#practice-help').innerText(), /Space/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#practice-help').evaluate(n => n.matches(':popover-open')), false);
  assert.equal(await control('Clear').evaluate(n => n.closest('[data-measure]').dataset.measure), '1');
  assert.equal(await control('Clear').evaluate(n => !!n.closest('.answer-area')), true);
  assert.equal(await control('Check').evaluate(n => !!n.closest('.answer-area')), true);
  assert.equal(await page.locator('.passage-line-controls').count(), 0);
  assert.equal(await control('Check').evaluate(n => n.closest('[data-measure]').dataset.measure), '2');
  report.checks.push('Idle pad starts/retries with keyboard and touch; starting gestures excluded from evidence; new count-in presses captured; consolidated help and first/last measure action placement');
  await page.getByLabel('Exercise preset', { exact: true }).selectOption('generated');
  for (const [width, height] of [[1366,650],[1280,600],[390,844],[320,667]]) {
    await page.setViewportSize({ width, height });
    for (const mode of ['write','tap','both']) {
      await page.getByLabel('Mode', { exact: true }).selectOption(mode); await page.evaluate(() => scrollTo(0,0));
      if (mode !== 'tap') {
        const overlaps = await page.evaluate(() => {
          const actions = [...document.querySelectorAll('.score-actions .control')];
          const targets = [...document.querySelectorAll('.count-slot:not([hidden]),.rest-target:not([hidden]),.rest-existing-opening,.rest-existing-closing')];
          return actions.flatMap(action => {
            const a = action.getBoundingClientRect();
            return targets.filter(target => { const b = target.getBoundingClientRect(); return a.width && b.width && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }).map(target => `${action.textContent}: ${target.getAttribute('aria-label')}`);
          });
        });
        assert.deepEqual(overlaps, [], `score actions must not cover count/rest targets at ${width}, ${mode}`);
      }
      await page.screenshot({ path: `${output}/refinement-${width}-${mode}.png`, fullPage: true });
    }
  }
  assert.deepEqual(errors, []); report.passed = true;
  console.log(`${engine}: generated Count Writing practice checks passed.`);
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close(); await host.close();
}
