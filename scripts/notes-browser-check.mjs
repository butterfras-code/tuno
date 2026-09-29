import { notesMode, openData, setToggle, setPacing, openPracticeSettings } from './notes-setup-helpers.mjs';
import { choosePreset } from './notes-setup-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { hostBuild } from './test-host.mjs';
const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[name].launch();
const host = await hostBuild();
const temporary = await mkdtemp(join(tmpdir(), 'notes practice '));
const results = [];
const expected = page => page.locator('.staff').getAttribute('aria-label').then(label => {
  const positions = ['first line','first space','second line','second space','third line','third space','fourth line','fourth space','fifth line'];
  const position = positions.findIndex(value => label.includes(value));
  return (label.startsWith('treble') ? 'EFGABCDEF' : 'GABCDEFG A'.replaceAll(' ', ''))[position];
});
const count = async (page, attempts) => assert.match(await page.locator('#practice-counts').textContent(), new RegExp(`/ ${attempts} attempts`));
const running = page => page.waitForFunction(() => document.querySelector('.answer-natural:not(.answer-unavailable)').getAttribute('aria-disabled') === 'false');
async function lostKeyup(page) {
  let attempts = 0;
  for (const loss of ['blur', 'visibility']) for (const [key, code] of [['a', 'KeyA'], ['Enter', 'Enter'], [' ', 'Space']]) {
    const answer = page.getByRole('button', { name: 'A', exact: true }).first();
    await answer.focus();
    const press = repeat => answer.dispatchEvent('keydown', { key, code, repeat, bubbles: true });
    await press(false); await count(page, ++attempts);
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    // Model a release outside the page: deliberately omit document keyup.
    await page.evaluate(loss => {
      if (loss === 'blur') window.dispatchEvent(new Event('blur'));
      else {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      }
    }, loss);
    if (loss === 'visibility') await page.getByRole('button', { name: 'Resume', exact: true }).first().click();
    await answer.focus();
    await press(true); await count(page, attempts); // still-held auto-repeat remains rejected
    await press(false); await count(page, ++attempts); // first fresh press must work
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    await press(true); await count(page, attempts);
    await answer.dispatchEvent('keyup', { key, code, bubbles: true });
  }
}
async function loop(page, mode) {
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  assert.equal(await page.locator('#preset').getAttribute('value'), 'treble-lines-and-spaces');
  assert.equal(await page.locator('#preset').getAttribute('aria-haspopup'), 'dialog');
  await setPacing(page,'Click/Tap');
  await setToggle(page,'meet-notes',false); await page.getByRole('button', { name: 'Start Practice', exact: true }).first().click();
  assert.equal(await page.locator('.answers .answer-natural').allTextContents().then(a => a.join('')), 'CDEFGABC');
  assert.equal(await page.locator('h2:focus').count(), 1);
  const seen = new Set([await page.locator('.staff').getAttribute('aria-label')]);
  const answer = await expected(page);
  assert.ok(answer);
  await page.keyboard.down(answer.toLowerCase());
  await count(page, 1);
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.keyboard.down(answer.toLowerCase()); // held through feedback must not submit again
  await count(page, 1); await page.keyboard.up(answer.toLowerCase());
  seen.add(await page.locator('.staff').getAttribute('aria-label'));
  const wrongFor = await expected(page); const wrong = wrongFor === 'A' ? 'B' : 'A';
  await page.getByRole('button', { name: wrong, exact: true }).first().click();
  await count(page, 2); assert.match(await page.locator('#feedback').textContent(), new RegExp(`That note is ${wrongFor}`));
  await page.getByRole('button', { name: wrong, exact: true }).first().click({ force: true }); await count(page, 2);
  // Pointer pressed during locked feedback cannot click into the next card.
  await page.evaluate(() => { window.oldPress = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }); });
  await page.getByRole('button', { name: 'A', exact: true }).first().dispatchEvent('pointerdown', { pointerId: 1 });
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.getByRole('button', { name: 'A', exact: true }).first().dispatchEvent('click', { detail: 1 }); await count(page, 2);
  await page.evaluate(() => document.dispatchEvent(window.oldPress)); await count(page, 2); await page.keyboard.up('a');
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
  await page.keyboard.press('a'); await count(page, 2); assert.equal(await page.locator('.staff').isVisible(), false);
  await page.getByRole('button', { name: 'Resume', exact: true }).first().click();
  // Visibility event fixture: browser hidden state is injected; does not claim physical OS/tab acceptance.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.getByRole('button', { name: 'Resume', exact: true }).first().count(), 1);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.getByRole('button', { name: 'Resume', exact: true }).first().count(), 1);
  await page.getByRole('button', { name: 'Resume', exact: true }).first().click();
  for (let i = 0; i < 10; i++) {
    const current = await expected(page); seen.add(await page.locator('.staff').getAttribute('aria-label'));
    if (i === 6) assert.equal(seen.size, 9);
    await page.keyboard.press(current.toLowerCase());
    if (i < 9) await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  }
  assert.equal(seen.size, 9);
  await page.waitForFunction(() => document.querySelector('.uno').dataset.pose === 'happy');
  await page.getByRole('button', { name: 'Finish', exact: true }).first().click();
  assert.match(await page.locator('#result-summary').textContent(), /11 correct \/ 12 attempts · Accuracy 92% · Best streak 10/);
  assert.equal(await page.locator('h2:focus').textContent(), 'Practice results');
  await page.getByRole('button', { name: 'Retry', exact: true }).first().click(); await count(page, 0);
  await lostKeyup(page);
  await page.getByRole('button', { name: 'Finish', exact: true }).first().click();
  await page.getByRole('button', { name: 'Retry', exact: true }).first().click(); await count(page, 0);
  await page.getByRole('button', { name: 'Finish', exact: true }).first().click();
  await page.getByRole('button', { name: 'Edit setup', exact: true }).first().click();
  await choosePreset(page,'bass-spaces'); await setPacing(page,'Delay');
  await setToggle(page,'meet-notes',false); await page.getByRole('button', { name: 'Start Practice', exact: true }).first().click();
  const bass = await expected(page); await page.keyboard.press(bass.toLowerCase()); await running(page);
  const bad = (await expected(page)) === 'A' ? 'C' : 'A'; await page.keyboard.press(bad.toLowerCase());
  assert.match(await page.locator('#feedback').textContent(), /That note is/);
  await page.waitForTimeout(350); assert.equal(await page.locator('.answer').first().getAttribute('aria-disabled'), 'true');
  await running(page); await count(page, 2);
  await page.getByRole('button', { name: 'A', exact: true }).first().focus(); await page.keyboard.press('Space'); await count(page, 3);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const sizes = await page.locator('.answer:visible').evaluateAll(buttons => buttons.map(b => ({ w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
    assert.ok(sizes.every(s => s.w >= 44 && s.h >= 44));
    await page.screenshot({ path: `dist/validation/notes-${name}-${mode}-${width}.png` });
  }
  // 200% effective viewport, and browser CSS zoom, both must retain usable controls.
  await page.setViewportSize({ width: 640, height: 450 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: 'Finish', exact: true }).first().click();
  await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  await openPracticeSettings(page);
  await page.locator('.practice-settings summary').focus();
  for (let tabs = 0; tabs < 5 && !await page.locator('#adaptive:focus').count(); tabs++) await page.keyboard.press('Tab');
  assert.equal(await page.locator('#adaptive:focus').count(), 1);
  assert.notEqual(await page.locator('#adaptive').evaluate(node => getComputedStyle(node).outlineStyle), 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setToggle(page,'meet-notes',false); await page.getByRole('button', { name: 'Start Practice', exact: true }).first().click();
  for (let i = 0; i < 10; i++) { await page.keyboard.press((await expected(page)).toLowerCase()); await running(page); }
  await page.waitForFunction(() => document.querySelector('.uno').dataset.pose === 'happy');
  assert.equal(await page.locator('.uno').evaluate(node => node.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0);
  const beforeCleanup = await page.evaluate(() => ({ ...window.practiceListeners, timers: window.practiceTimers.size }));
  await page.locator('.practice-view').evaluate(node => node.remove());
  await page.waitForFunction(() => window.practiceListeners.keydown === 0 && window.practiceTimers.size === 0);
  const afterCleanup = await page.evaluate(() => ({ ...window.practiceListeners, timers: window.practiceTimers.size }));
  assert.equal(beforeCleanup.keydown, 1); assert.equal(beforeCleanup.keyup, 1); assert.equal(beforeCleanup.timers, 1);
  assert.equal(beforeCleanup.blur, 1); assert.equal(afterCleanup.blur, 0);
  assert.equal(afterCleanup.keyup, 0); assert.equal(afterCleanup.visibilitychange, beforeCleanup.visibilitychange - 1);
  assert.deepEqual(errors, []);
  results.push(`${mode}: full Practice, bag coverage, incorrect reveal, duplicate/held/stale pointer rejection, pause/resume, visibility fixture, lost-keyup recovery and repeat rejection for letters/Enter/Space on blur/visibility loss, results/retry/home, 360/768/1280 layouts, 200% zoom, focus, reduced motion and Practice listener/timer cleanup passed`);
}
const instrument = () => {
  window.practiceListeners = { keydown: 0, keyup: 0, visibilitychange: 0, blur: 0 };
  const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
  document.addEventListener = (type, ...args) => { if (type in window.practiceListeners) window.practiceListeners[type]++; return add(type, ...args); };
  document.removeEventListener = (type, ...args) => { if (type in window.practiceListeners) window.practiceListeners[type]--; return remove(type, ...args); };
  const addWindow = window.addEventListener.bind(window), removeWindow = window.removeEventListener.bind(window);
  window.addEventListener = (type, ...args) => { if (type === 'blur') window.practiceListeners.blur++; return addWindow(type, ...args); };
  window.removeEventListener = (type, ...args) => { if (type === 'blur') window.practiceListeners.blur--; return removeWindow(type, ...args); };
  window.practiceTimers = new Set(); const set = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
  window.setInterval = (...args) => { const id = set(...args); window.practiceTimers.add(id); return id; };
  window.clearInterval = id => { window.practiceTimers.delete(id); clear(id); };
};
try {
  await mkdir('dist/validation', { recursive: true });
  const notation = await build({ stdin: { contents: `import { renderStaff } from './src/apps/tunotes/ui/staff.ts'; import { parsePitch, C_MAJOR } from './src/apps/tunotes/domain/notation.ts'; for (const clef of ['treble','bass','alto','tenor']) { const section = document.createElement('section'); const title = document.createElement('h2'); title.textContent = clef + ' — C4'; section.append(title, renderStaff(parsePitch('C4'), clef, C_MAJOR)); document.body.append(section); }`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife' });
  const fixture = await browser.newPage({ viewport: { width: 800, height: 620 } });
  await fixture.setContent('<style>body{display:grid;grid-template-columns:1fr 1fr;font:18px sans-serif;color:#262626}svg{width:360px}</style>');
  await fixture.addScriptTag({ content: notation.outputFiles[0].text });
  assert.equal(await fixture.locator('.ledger').count(), 2);
  await fixture.screenshot({ path: `dist/validation/notes-${name}-clefs.png` }); await fixture.close();
  const file = join(temporary, 'renamed practice.html'); await copyFile('dist/portable/tunotes.html', file);
  const portable = await browser.newContext({ offline: true }); await portable.addInitScript(instrument); const portablePage = await portable.newPage();
  const requests = []; portablePage.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  await portablePage.goto(pathToFileURL(file).href); await loop(portablePage, 'portable'); assert.deepEqual(requests, []); await portable.close();
  const hosted = await browser.newContext(); await hosted.addInitScript(instrument); const page = await hosted.newPage(); await page.goto(new URL('/notes/', host.url).href);
  await page.waitForFunction(() => document.querySelector('#offline-status')?.textContent === 'Offline ready');
  await page.evaluate(() => localStorage.setItem('tuno-test-sentinel', 'preserve'));
  host.setAvailable(false); await hosted.setOffline(true); await page.reload(); await loop(page, 'hosted-offline');
  assert.equal(await page.evaluate(() => localStorage.getItem('tuno-test-sentinel')), 'preserve'); await hosted.close();
  if (name === 'chromium') {
    const touch = await browser.newContext({ offline: true, hasTouch: true, viewport: { width: 390, height: 844 } });
    const p = await touch.newPage(); await p.goto(pathToFileURL(file).href);
    await setToggle(p,'meet-notes',false); await p.getByRole('button', { name: 'Start Practice', exact: true }).first().tap();
    await p.getByRole('button', { name: await expected(p), exact: true }).first().tap(); await count(p, 1);
    await p.getByRole('button', { name: 'Finish', exact: true }).first().tap(); assert.match(await p.locator('#result-summary').textContent(), /1 correct \/ 1 attempts/);
    await touch.close(); results.push('Emulated touch Start → answer → Finish passed');
  }
  const release = JSON.parse(await readFile('dist/release.json', 'utf8'));
  await writeFile(`dist/validation/notes-${name}.json`, JSON.stringify({ build: release.apps.tunotes.build, browser: browser.version(), results }, null, 2));
  console.log(results.join('\n'));
} finally { await browser.close(); await host.close(); await rm(temporary, { recursive: true, force: true }); }
