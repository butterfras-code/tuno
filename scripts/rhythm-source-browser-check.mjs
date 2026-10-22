/** Cross-browser completed capture checks; not a physical latency/device test.
 * Run dev:walk first, then TUNO_BROWSER=chromium|firefox node this-file. */
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
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
  await page.goto(`${process.env.COUNT_WRITING_URL || 'http://localhost:5173/prototypes/rhythm-walk/'}?fixture=quarters`);
  const counts = page.locator('[data-count-id]');
  const labels = await counts.evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
  assert.ok(labels.length && labels.every(label => /^Measure \d+, beat \d+, offset \d+\/\d+ whole notes/.test(label) && !/\([1-6e&a+]\)/.test(label)));
  await writeFile(`${output}/${style}-empty-accessibility.yml`, await counts.first().ariaSnapshot());
  await counts.first().focus(); await page.keyboard.press('1');
  assert.equal(await counts.first().textContent(), '1');
  await writeFile(`${output}/${style}-accessibility.yml`, await counts.first().ariaSnapshot());
  await page.getByLabel('Mode', { exact: true }).selectOption('tap');
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
  await page.locator('.performance-results').waitFor();
  const result = await page.locator('.performance-results').textContent();
  assert.match(result, /8 matched · 0 missing · 0 extra/);
  if (style === 'hold') assert.match(result, /Hold accuracy: 100% across 8 assessed notes/);
  else assert.doesNotMatch(result, /Hold accuracy:/);
  assert.equal(await page.locator('#performance-results-heading').evaluate(n => n === document.activeElement), true);
  await page.locator('.timing-evidence > summary').click();
  await page.getByText('Download timing evidence', { exact: true }).click();
  const record = await page.evaluate(() => window.evidence);
  assert.equal(record.status, 'completed'); assert.equal(record.playStyle, style);
  assert.equal(record.exercise.score.measures.length, 2);
  assert.equal(record.exercise.measures, undefined);
  assert.deepEqual(errors, []);
  await page.getByLabel('Mode', { exact: true }).selectOption('both');
  assert.equal(await counts.first().textContent(), '1');
  assert.equal(await page.locator('.performance-results').textContent(), result);
  await page.getByLabel('Mode', { exact: true }).selectOption('tap');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('heading', { name: 'Interrupted attempt' }).waitFor();
  await page.getByRole('button', { name: 'Next exercise', exact: true }).click();
  assert.equal(await page.locator('.performance-results').count(), 0);
  report.attempts.push({ style, result, status: record.status });
  await context.close();
 }
 report.passed = true;
} finally { await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
