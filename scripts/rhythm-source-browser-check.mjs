/** Cross-browser completed capture checks; not a physical latency/device test.
 * Uses the local build; optional COUNT_WRITING_URL overrides the hosted fixture. */
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
const host = process.env.COUNT_WRITING_URL ? null : await hostBuild();
const url = process.env.COUNT_WRITING_URL || new URL('/prototypes/rhythm-walk/', host.url).href;
const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[engine].launch();
const output = `dist/validation/rhythm-source-${engine}`;
await mkdir(output, { recursive: true });
const report = { engine, attempts: [], physicalDevice: false, screenReader: false };
try {
 for (const style of ['tap', 'hold']) {
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
   const original = AudioContext.prototype.createOscillator;
   window.audioStarts = [];
   AudioContext.prototype.createOscillator = function () {
    window.audioClock = this; const osc = original.call(this), start = osc.start.bind(osc);
    osc.start = time => { window.audioStarts.push(time); start(time); }; return osc;
   };
   const originalURL = URL.createObjectURL;
   URL.createObjectURL = blob => { window.evidence = blob.text().then(JSON.parse); return originalURL(blob); };
   document.addEventListener('click', e => { if (e.target instanceof HTMLAnchorElement && e.target.download) e.preventDefault(); }, true);
  });
  await page.goto(`${url}?fixture=quarters`);
  const counts = page.locator('[data-count-id]');
  const labels = await counts.evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
  assert.ok(labels.length && labels.every(label => /^Measure \d+, beat \d+, empty$/.test(label) && !/\([1-6e&a+]\)/.test(label)));
  await writeFile(`${output}/${style}-empty-accessibility.yml`, await counts.first().ariaSnapshot());
  await counts.first().focus(); await page.keyboard.press('1');
  assert.equal(await counts.first().textContent(), '1');
  await writeFile(`${output}/${style}-accessibility.yml`, await counts.first().ariaSnapshot());
  await page.getByRole('button', { name: 'Perform', exact: true }).click();
  await page.getByLabel('How to play', { exact: true }).selectOption(style);
  await page.getByLabel('Tempo (quarter-note BPM)', { exact: true }).fill('120');
  await page.getByLabel('Metronome during exercise', { exact: true }).check();
  await page.getByRole('button', { name: 'Performance pad', exact: true }).click();
  await page.waitForFunction(() => window.audioStarts.length >= 4);
  // Wait on the real audio clock; synthetic DOM keyboard edges avoid IPC scheduling jitter.
  await page.evaluate(async style => {
   const sleep = ms => new Promise(r => setTimeout(r, ms));
   const wait = async time => { while (audioClock.currentTime < time) await sleep(2); };
   const start = audioStarts[0] + 2, pad = document.querySelector('.pad');
   for (let i = 0; i < 8; i++) {
    await wait(start + i * .5);
    pad.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
    await wait(start + i * .5 + (style === 'hold' ? .45 : .05));
    pad.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
   }
  }, style);
  await page.locator('.performance-results').waitFor({ state: 'attached' });
  await page.locator('#feedback-panel').waitFor({ state: 'visible' });
  const result = await page.locator('.performance-results').textContent();
  assert.equal(await page.locator('.performance-results details').count(), 0, 'input area has no duplicate numerical review');
  assert.equal(await page.locator('.performance-setup .setting-hint').count(), 0, 'instructions live in Practice help');
  assert.equal(await page.locator('.timing-evidence').isVisible(), false, 'diagnostic evidence is not displayed');
  assert.equal(await page.locator('.timing-timeline').count(), 2, 'the graph retains performance evidence');
  assert.equal(await page.locator('#feedback-panel').evaluate(n => n === document.activeElement), true);
  // Diagnostics remain available to automation without exposing them in the input area.
  await page.locator('.timing-evidence button').evaluate(button => button.click());
  const record = await page.evaluate(() => window.evidence);
  assert.equal(record.assessment.matchedNotes, 8);
  assert.equal(record.assessment.missing, 0); assert.equal(record.assessment.extra, 0);
  if (style === 'hold') assert.equal(record.assessment.hold, 100);
  else assert.equal(record.assessment.hold, null);
  assert.equal(record.status, 'completed'); assert.equal(record.playStyle, style);
  assert.equal(record.exercise.score.measures.length, 2);
  assert.equal(record.exercise.measures, undefined);
  assert.deepEqual(errors, []);
  await page.getByRole('button', { name: 'Counts', exact: true }).click();
  assert.equal(await counts.first().textContent(), '1');
  assert.equal(await page.locator('.performance-results').textContent(), result);
  await page.getByRole('button', { name: 'Perform', exact: true }).click();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('heading', { name: 'Interrupted attempt' }).waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Next exercise', exact: true }).click();
  assert.equal(await page.locator('.performance-results').count(), 0);
  await page.reload();
  assert.equal(await page.getByRole('button', { name: 'Perform', exact: true }).getAttribute('aria-pressed'), 'true', 'reload restores Perform');
  await page.getByRole('button', { name: 'Counts', exact: true }).click();
  await page.reload();
  assert.equal(await page.getByRole('button', { name: 'Counts', exact: true }).getAttribute('aria-pressed'), 'true', 'reload restores Counts');
  report.attempts.push({ style, result, status: record.status });
  await context.close();
 }
 report.passed = true;
} finally { await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); await host?.close(); }
