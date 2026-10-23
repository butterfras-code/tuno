import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const host = process.env.COUNT_WRITING_URL ? null : await hostBuild();
const url = process.env.COUNT_WRITING_URL || new URL('/prototypes/rhythm-walk/', host.url).href;
const browser = await ({ chromium, firefox })[engine].launch();
const output = `dist/validation/counting-plan-${engine}`;
const source = await readFile(new URL('./counting-plan-browser-scenarios.js', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('./writing-workspace-browser-scenarios.js', import.meta.url), 'utf8');
const linkSource = await readFile(new URL('./counting-link-browser-scenarios.js', import.meta.url), 'utf8');
const report = { engine, url, passed: false, checks: [], physicalDeviceChecks: 'not performed' };
try {
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const width of [320, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${url}?fixture=half`);
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ content: source });
    report.checks.push(await page.evaluate(() => countingPlanScenarios()));
    await page.locator('[data-count-id]').first().focus();
    await page.keyboard.press('1'); await page.keyboard.press('c');
    assert.equal(await page.locator('[data-count-id]').first().textContent(), '1');
    assert.equal(await page.locator('.sustained').count(), 1);
    await page.addScriptTag({ content: workspaceSource });
    report.checks.push(await page.evaluate(() => writingWorkspaceScenarios()));
    await page.locator('[data-preset]').evaluate(el => { el.value = 'dense-sixteenths'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(100);
    const overview = await page.locator('.rhythm-overview').boundingBox();
    await page.mouse.click(overview.x + overview.width * .95, overview.y + overview.height / 2);
    const afterTap = await page.locator('.passage-scroll').evaluate(el => el.scrollLeft);
    assert.ok(afterTap > 0, 'Overview tap navigates the passage');
    const window = await page.locator('.rhythm-overview-window').boundingBox();
    await page.mouse.move(window.x + window.width / 2, window.y + window.height / 2);
    await page.mouse.down();
    await page.mouse.move(window.x + window.width / 2 - 30, window.y + window.height / 2, { steps: 5 });
    await page.mouse.up();
    assert.ok(await page.locator('.passage-scroll').evaluate(el => el.scrollLeft) < afterTap, 'Dragging the overview window navigates continuously');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-count-id]').last().focus();
    await page.keyboard.press('ArrowLeft');
    assert.ok(await page.locator('[data-count-id]').nth(62).evaluate(el => {
      const viewport = el.closest('.passage-scroll').getBoundingClientRect(), r = el.getBoundingClientRect();
      return r.left >= viewport.left && r.right <= viewport.right;
    }), 'Reduced-motion keyboard navigation keeps the selected count visible');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('[data-count-id]').first().click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/${width}.png`, fullPage: true });
    await page.addScriptTag({ content: linkSource });
    report.checks.push(await page.evaluate(async () => {
      const load = async search => {
        document.querySelector('#link-test')?.remove();
        const frame = document.createElement('iframe'); frame.id = 'link-test';
        frame.style = 'position:fixed;inset:0;width:100%;height:100%;border:0;background:white;z-index:999999';
        frame.src = '/prototypes/rhythm-walk/' + search;
        const ready = new Promise(resolve => { frame.onload = resolve; });
        document.body.append(frame); await ready; await frame.contentDocument.fonts.ready;
        return frame.contentWindow;
      };
      return countingLinkScenarios(load, localStorage);
    }));
    await page.evaluate(() => document.querySelector('#link-test').remove());
  }
  await page.evaluate(() => localStorage.setItem('tuno.rhythm-walk.preferences.v1', JSON.stringify({ version:1, countingSystem:'syllables', offbeat:'+', presentation:{linePlacement:'above',sustainAppearance:'lowered'}, bpm:123, metronome:false })));
  await page.reload();
  assert.match(await page.locator('.exercise-summary').textContent(), /Counting updated/);
  assert.equal(await page.locator('[data-counting-preference="vocabulary"]').inputValue(), 'syllables');
  await page.locator('[data-count-id]').first().focus(); await page.keyboard.press('1');
  await page.reload();
  assert.doesNotMatch(await page.locator('.exercise-summary').textContent(), /Counting updated/);
  assert.ok((await page.locator('[data-count-id]').allTextContents()).every(t => t === '·'));
  assert.deepEqual(errors, []); report.passed = true;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await host?.close();
}
