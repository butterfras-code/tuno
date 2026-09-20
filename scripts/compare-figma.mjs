import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { hostBuild } from './test-host.mjs';

// Usage: node scripts/compare-figma.mjs '/path/to/supplied.pdf' [output-directory]
// Requires Poppler and ImageMagick. Compares real browser output, without masking or moving pixels.
const pdf = process.argv[2];
if (!pdf) throw new Error('Supply the exported Figma PDF.');
const output = resolve(process.argv[3] || 'dist/validation/figma');
await mkdir(output, { recursive: true });
const host = await hostBuild();
const browser = await chromium.launch();
const results = [];
try {
  const page = await browser.newPage();
  for (const [width, height, firstPage] of [[1120, 820, 6], [390, 844, 12]]) {
    await page.setViewportSize({ width, height });
    await page.goto(host.url);
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // A real Web Audio oscillator drives the app's normal microphone/pitch pipeline.
    // The fixture provides the populated Figma example without requiring hardware.
    await page.evaluate(() => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = 233.081880759 * 2 ** (-2 / 1200);
      gain.gain.value = 0.2;
      oscillator.connect(gain).connect(destination); oscillator.start();
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => { await context.resume(); return destination.stream; } });
    });
    await page.getByRole('button', { name: 'Tuner accuracy', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'BEG', exact: true }).click();
    await page.getByRole('button', { name: 'Start listening', exact: true }).first().click();
    await page.waitForFunction(() => document.querySelector('.pitch-note').textContent === 'B♭3');
    await page.waitForFunction(() => document.querySelector('.tuner-friend .uno').dataset.pose === 'happy');
    for (const [offset, name, focus] of [[0, 'tune', 'Tuner'], [1, 'tone', 'Reference tone'], [2, 'tempo', 'Metronome'], [3, 'numbers', 'Metronome']]) {
      await page.getByRole('navigation').getByRole('button', { name: focus, exact: true }).click();
      if (name === 'tone') {
        await page.getByRole('button', { name: 'Play tone', exact: true }).first().click();
        await page.getByRole('button', { name: 'Stop tone', exact: true }).first().waitFor();
      }
      if (name === 'tempo') {
        await page.locator('.tool-card').nth(1).getByRole('button', { name: 'Stop tone', exact: true }).click();
        await page.getByLabel('Click sound', { exact: true }).selectOption('wood');
        await page.locator('.beat-volume > button').click();
        await page.getByLabel('Beat volume', { exact: true }).fill('60');
        await page.keyboard.press('Escape');
      }
      if (name === 'numbers') {
        await page.getByLabel('Meter', { exact: true }).selectOption('4/4');
        await page.getByLabel('Subdivision', { exact: true }).selectOption('2');
        await page.getByRole('button', { name: 'Start metronome', exact: true }).first().click();
        await page.waitForFunction(() => document.querySelectorAll('.beat')[1].getAttribute('aria-current') === 'true');
      }
      await page.locator('.wordmark').click();
      const prefix = `${output}/${width}-${name}`;
      await page.screenshot({ path: `${prefix}-live.png` });
      execFileSync('pdftoppm', ['-f', String(firstPage + offset), '-l', String(firstPage + offset), '-r', '72', '-singlefile', '-png', pdf, `${prefix}-reference`]);
      execFileSync('magick', [`${prefix}-reference.png`, `${prefix}-live.png`, '+append', `${prefix}-comparison.png`]);
      execFileSync('magick', [`${prefix}-reference.png`, `${prefix}-live.png`, '-compose', 'blend', '-define', 'compose:args=50,50', '-composite', `${prefix}-overlay.png`]);
      const diff = spawnSync('magick', ['compare', '-metric', 'AE', '-fuzz', '5%', `${prefix}-reference.png`, `${prefix}-live.png`, `${prefix}-diff.png`], { encoding: 'utf8' });
      if (![0, 1].includes(diff.status)) throw new Error(diff.stderr);
      const fraction = Number(execFileSync('magick', [`${prefix}-reference.png`, `${prefix}-live.png`, '-compose', 'difference', '-composite', '-separate', '-evaluate-sequence', 'max', '-threshold', '5%', '-format', '%[fx:mean]', 'info:'], { encoding: 'utf8' }));
      const differentPixels = Math.round(fraction * width * height);
      results.push({ width, height, view: name, pdfPage: firstPage + offset, differentPixels, differentPercent: Number((differentPixels / (width * height) * 100).toFixed(2)) });
    }
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ note: 'Unmasked comparisons at PDF frame sizes; 5% color tolerance. Synthetic microphone input exercises the real pitch pipeline; playback and volume are set through the UI. The design contains inconsistent shared volumes and transport states. Mobile tools follow the surface instead of covering its last 20px.', results }, null, 2));
  const cards = results.map(r => `<section><h2>${r.width}px ${r.view} · PDF page ${r.pdfPage}</h2><p>${r.differentPercent}% of pixels differ beyond 5% color tolerance. Reference left; live code right.</p><a href="${r.width}-${r.view}-overlay.png">50% overlay</a> · <a href="${r.width}-${r.view}-diff.png">Pixel difference</a><img src="${r.width}-${r.view}-comparison.png" alt="Figma PDF alongside live browser screenshot"></section>`).join('\n');
  await writeFile(`${output}/index.html`, `<!doctype html><meta charset="utf-8"><title>tUno Figma comparison</title><style>body{font:16px system-ui;margin:32px;background:#eee}img{display:block;max-width:100%;margin-top:16px}section{margin:32px 0}p{max-width:900px}</style><h1>Figma PDF / Live browser comparison</h1><p>Unmodified browser screenshots at the original frame sizes. Populated states use a synthetic B-flat microphone signal through the real audio pipeline. Playback, accuracy, meter and volume are set through the UI. Shared controls stay truthful even where the design shows inconsistent values. Mobile controls remain usable by placing the tool strip below the surface; the PDF overlaps the final 20px.</p>${cards}`);
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); await host.close(); }
