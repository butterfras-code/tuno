import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const hosted = new URL('../dist/hosted/', import.meta.url);
const files = new Map([
  ['/practice/', ['index.html', 'text/html']],
  ['/practice/app.js', ['app.js', 'text/javascript']],
  ['/practice/app.css', ['app.css', 'text/css']],
]);
const server = createServer(async (request, response) => {
  const file = files.get(request.url);
  if (!file) { response.writeHead(404).end(); return; }
  try {
    response.writeHead(200, { 'Content-Type': file[1] });
    response.end(await readFile(new URL(file[0], hosted)));
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const temp = await mkdtemp(join(tmpdir(), 'tuno-portable-'));
let browser;
try {
  browser = await chromium.launch();
  const relocated = join(temp, 'renamed tuno.html');
  await copyFile(new URL('../dist/portable/tuno.html', import.meta.url), relocated);
  for (const [mode, url] of [
    ['hosted', `http://127.0.0.1:${server.address().port}/practice/`],
    ['portable', pathToFileURL(relocated).href],
  ]) {
    const context = await browser.newContext({ offline: mode === 'portable', viewport: { width: 1120, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.pitch-note').innerText(), '—');
    assert.equal(await page.locator('.pitch-marker').isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Start listening' }).first().isEnabled(), true);
    assert.equal(await page.getByText('Offline ready', { exact: true }).count(), 0);
    await page.getByText('Explore a sample pitch', { exact: true }).click();
    await page.getByLabel('Frequency (Hz)', { exact: true }).fill('233.08188075904496');
    await page.getByRole('button', { name: 'Check pitch' }).click();
    const settings = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await settings.getByLabel('Written pitch', { exact: true }).selectOption('2');
    await settings.getByRole('button', { name: 'Save settings' }).click();
    assert.equal(await settings.isVisible(), false);
    assert.match(await page.locator('#pitch-result').innerText(), /Concert B♭3 · Written C4 · In tune/);
    assert.equal(await page.locator('.pitch-note').innerText(), 'C4');
    assert.equal(await page.locator('.pitch-marker').isVisible(), true);
    // Settings are a draft until Save; Escape discards the draft and returns focus.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await settings.getByLabel('A4 reference (Hz)', { exact: true }).fill('442');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Settings', exact: true }).evaluate((node) => node === document.activeElement), true);
    assert.equal(await page.getByRole('button', { name: 'A4 = 440 Hz', exact: true }).isVisible(), true);

    const nav = page.getByRole('navigation', { name: 'Practice focus' });
    await nav.getByRole('button', { name: 'Reference tone', exact: true }).click();
    await page.getByRole('button', { name: 'Select F♯3', exact: true }).click();
    const selectedFrequency = await page.locator('.selected-tone').innerText();
    await page.getByRole('button', { name: '+ Octave', exact: true }).click();
    assert.equal(await page.locator('.selected-tone').innerText(), selectedFrequency);
    assert.equal(await page.getByRole('button', { name: 'Select C4', exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Sustain on', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Sustain off', exact: true }).evaluate((node) => node === document.activeElement), true);
    await nav.getByRole('button', { name: 'Metronome', exact: true }).click();
    await page.getByLabel('Tempo (BPM)', { exact: true }).fill('108');
    await page.getByLabel('Tempo (BPM)', { exact: true }).press('Tab');
    await page.getByLabel('Meter', { exact: true }).selectOption('6/8');
    assert.equal(await page.locator('.beat:visible').count(), 2);
    assert.equal(await page.getByText('Dotted quarter = 108 BPM', { exact: true }).isVisible(), true);
    await nav.getByRole('button', { name: 'Reference tone', exact: true }).click();
    assert.equal(await page.locator('.selected-tone').innerText(), selectedFrequency);
    assert.equal(await page.getByRole('button', { name: 'Select C4', exact: true }).isVisible(), true);
    await nav.getByRole('button', { name: 'Tuner', exact: true }).click();
    assert.equal(await page.locator('.pitch-note').innerText(), 'C4');
    await page.getByLabel('Frequency (Hz)', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Check pitch' }).click();
    assert.equal(await page.locator('#frequency').evaluate((input) => input.validity.valid), false);
    assert.equal(await page.locator('.pitch-note').innerText(), 'C4');
    await page.getByRole('button', { name: 'Clear sample' }).click();
    assert.equal(await page.locator('.pitch-note').innerText(), '—');
    assert.equal(await page.locator('.pitch-marker').isVisible(), false);

    await page.getByRole('button', { name: 'Stop all audio' }).click();
    // Real Web Audio graph with synthetic input; this does not test permission or hardware.
    await page.evaluate(() => {
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const destination = ac.createMediaStreamDestination();
      osc.frequency.value = 440;
      gain.gain.value = 0.2;
      osc.connect(gain).connect(destination);
      osc.start();
      window.testInput = { ac, gain, destination };
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
        await ac.resume(); return destination.stream;
      } });
    });
    await page.getByRole('button', { name: 'Start listening', exact: true }).first().click();
    await page.waitForFunction(() => document.querySelector('.pitch-note').textContent === 'B4');
    await nav.getByRole('button', { name: 'Reference tone', exact: true }).click();
    await page.getByRole('button', { name: 'Play tone', exact: true }).first().click();
    await page.getByRole('button', { name: 'Stop tone', exact: true }).first().waitFor();
    await nav.getByRole('button', { name: 'Tuner', exact: true }).click();
    assert.equal(await page.locator('.pitch-note').innerText(), 'B4');
    await page.evaluate(() => { window.testInput.gain.gain.value = 0; });
    await page.waitForFunction(() => document.querySelector('.pitch-marker').hidden, { }, { timeout: 1000 });
    await page.getByRole('button', { name: 'Stop all audio' }).click();
    assert.equal(await page.evaluate(() => window.testInput.destination.stream.getTracks().every((track) => track.readyState === 'ended')), true);
    await page.evaluate(() => window.testInput.ac.close());

    // Fonts and exact Figma vectors must decode inside both distributions.
    const assets = await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
      return {
        fonts: [...document.fonts].map((font) => [font.family, font.status]),
        images: [...document.images].every((image) => image.naturalWidth > 0 && image.src.startsWith('data:')),
      };
    });
    assert.equal(assets.images, true);
    assert.ok(assets.fonts.some(([name, status]) => name === 'Nunito' && status === 'loaded'));
    assert.ok(assets.fonts.some(([name, status]) => name === 'Nunito Sans' && status === 'loaded'));

    for (const width of [1120, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const focus of ['Tuner', 'Reference tone', 'Metronome']) {
        await nav.getByRole('button', { name: focus, exact: true }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${mode}: ${focus} overflow at ${width}px`);
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    await nav.getByRole('button', { name: 'Tuner', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await settings.getByLabel('Show Uno', { exact: true }).uncheck();
    await settings.getByRole('button', { name: 'Save settings' }).click();
    assert.equal(await page.locator('.tuner-friend').isVisible(), false);
    assert.equal(await page.locator('.pitch-lane').isVisible(), true);
    assert.deepEqual(errors, []);
    if (mode === 'portable') assert.deepEqual(requests, [url], 'Portable must only load itself.');

    if (process.env.TUNO_SCREENSHOT_DIR && mode === 'hosted') {
      const directory = process.env.TUNO_SCREENSHOT_DIR;
      await mkdir(directory, { recursive: true });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await settings.getByLabel('Show Uno', { exact: true }).check();
      await settings.getByLabel('Written pitch', { exact: true }).selectOption('0');
      await settings.getByRole('button', { name: 'Save settings' }).click();
      await page.getByLabel('Frequency (Hz)', { exact: true }).fill('232.812775');
      await page.getByRole('button', { name: 'Check pitch' }).click();
      await page.getByText('Explore a sample pitch', { exact: true }).click();
      for (const width of [1120, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const focus of ['Tuner', 'Reference tone', 'Metronome']) {
          await nav.getByRole('button', { name: focus, exact: true }).click();
          await page.screenshot({ path: join(directory, `${focus.replaceAll(' ', '-')}-${width}.png`), fullPage: true });
        }
      }
    }
    console.log(`${mode}: shared state, controls, font/image decoding, responsive layouts, and keyboard checks passed in Chromium ${browser.version()}${mode === 'portable' ? '; relocated file, offline, no subresource requests' : ''}.`);
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
