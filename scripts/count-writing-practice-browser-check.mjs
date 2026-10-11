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
  const bars = page.locator('.passage > section');
  const settings = async () => { await page.getByRole('link', { name: 'Settings', exact: true }).click(); };
  const practice = async () => { await page.getByRole('link', { name: 'Back to Count Writing', exact: true }).click(); };
  const snapshot = () => bars.evaluateAll(nodes => nodes.map(node => ({ notation: node.querySelector('.notation').outerHTML, symbols: [...node.querySelectorAll('.count-slot')].map(n => n.textContent), spans: [...node.querySelectorAll('.duration-line')].map(n => n.style.cssText), rests: [...node.querySelectorAll('.rest-group')].map(n => [n.dataset.start, n.dataset.end]) })));
  assert.equal(await bars.count(), 2, 'new session defaults to two measures');
  const initialSlot = bars.nth(0).locator('.count-slot').nth(0);
  await initialSlot.press('1');
  const before = await snapshot();
  await settings(); await page.getByLabel('Exercise length', { exact: true }).selectOption('4'); await practice();
  assert.deepEqual(await snapshot(), before, 'length setting preserves exercise and entered answer');
  await control('Check').click(); assert.deepEqual(await snapshot(), before, 'Check preserves answer');
  assert.match(await bars.nth(1).locator('.feedback').innerText(), /Measure 2.*Count symbols/s);
  await control('Retry').click(); assert.deepEqual(await snapshot(), before, 'Retry preserves answer');
  await initialSlot.press('4'); await control('Check').click(); assert.match(await bars.nth(0).locator('.feedback').innerText(), /beat 1/);
  report.checks.push('Default two bars; settings, Check and Retry preserve music and answer; feedback locates measure and beat');

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
      if (length > 1) {
        const first = bars.nth(0).locator('.count-slot:visible'), second = bars.nth(1).locator('.count-slot:visible');
        await first.last().focus(); await page.keyboard.press('ArrowRight'); assert.equal(await second.first().evaluate(n => n === document.activeElement), true);
        await page.keyboard.press('Shift+Tab'); assert.equal(await first.last().evaluate(n => n === document.activeElement), true);
        await page.keyboard.press('Tab'); assert.equal(await second.first().evaluate(n => n === document.activeElement), true);
        await page.keyboard.press('Backspace'); assert.equal(await first.last().evaluate(n => n === document.activeElement), true);
        await first.last().press('&'); assert.equal(await second.first().evaluate(n => n === document.activeElement), true, 'symbol entry advances across barline');
        await control('Reset answer').click();
      }
      await solve(); const solved = await snapshot(); await control('Check').tap();
      assert.deepEqual(await snapshot(), solved);
      assert.ok((await page.locator('.dimension').evaluateAll(nodes => nodes.map(n => n.className))).every(name => name === 'dimension correct'), await page.locator('.feedback').allTextContents());
      await control('Retry').tap(); assert.deepEqual(await snapshot(), solved);
      await control('Check').tap();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no page overflow at ${width}`);
      await page.screenshot({ path: `${output}/${width}-${length}.png`, fullPage: true });
      await control('Next exercise').tap(); assert.equal(await bars.count(), length);
      assert.equal(await page.locator('.dimension').count(), 0);
      assert.equal(await page.locator('.count-popover').count(), length, 'previous editor popovers are disposed');
    }
  }
  report.checks.push('Entire correct/retry/next loop at lengths 1–4 on desktop and 320px; keyboard/Tab/Backspace/auto-advance cross measures; touch duration lines and grouped rests');
  await settings();
  for (const ingredient of await page.locator('[data-ingredient]').all()) await ingredient.uncheck();
  assert.match(await page.getByLabel('Rhythm settings').innerText(), /Select at least one/);
  await practice(); assert.equal(await control('Next exercise').isDisabled(), true);
  const unchanged = await snapshot();
  await settings(); await page.locator('.active-ingredients').getByLabel('Dotted quarter notes', { exact: true }).check();
  assert.match(await page.getByLabel('Rhythm settings').innerText(), /cannot fill/);
  await page.locator('.active-ingredients').getByLabel('Half notes', { exact: true }).check();
  assert.match(await page.getByLabel('Rhythm settings').innerText(), /cannot fit/);
  await page.locator('.active-ingredients').getByLabel('Quarter notes', { exact: true }).check(); await practice();
  assert.deepEqual(await snapshot(), unchanged); assert.equal(await control('Next exercise').isDisabled(), false);
  await control('Next exercise').tap();
  const generatedKinds = await bars.locator('g[data-start]').evaluateAll(nodes => nodes.map(n => [n.dataset.duration, n.dataset.kind]));
  assert.ok(generatedKinds.every(([duration, kind]) => ['2', '3', '4'].includes(duration) && kind === 'note'));
  report.checks.push('Empty, impossible and unusable ingredient configurations explain and block Next; valid replacement applies selected ingredients only');
  await page.reload(); assert.equal(await bars.count(), 2);
  await settings(); await control('Expand all groups').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/settings-320.png`, fullPage: true });
  assert.deepEqual(errors, []); report.passed = true;
  console.log(`${engine}: generated Count Writing practice checks passed.`);
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close(); await host.close();
}
