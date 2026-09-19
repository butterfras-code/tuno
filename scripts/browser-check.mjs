import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { hostBuild } from './test-host.mjs';
const engineName = process.env.TUNO_BROWSER || 'chromium';

const host = await hostBuild();
const temp = await mkdtemp(join(tmpdir(), 'tuno-portable-'));
const measurements = [];
let browser;
try {
  browser = await ({ chromium, firefox, webkit })[engineName].launch();
  const relocated = join(temp, 'renamed tuno.html');
  await copyFile(new URL('../dist/portable/tuno.html', import.meta.url), relocated);
  for (const [mode, url] of [
    ['hosted', host.url],
    ['portable', pathToFileURL(relocated).href],
  ]) {
    const context = await browser.newContext({ offline: mode === 'portable', viewport: { width: 1120, height: 1000 } });
    let page = await context.newPage();
    const stopAllAudio = () => page.locator('button', { hasText: 'Stop all audio' }).evaluate((button) => button.click());
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.pitch-note').innerText(), '—');
    assert.equal(await page.locator('.pitch-marker').isVisible(), false);
    assert.equal(await page.locator('.pitch-marker').evaluate((marker) => getComputedStyle(marker).transitionDuration), '0.14s');
    assert.equal(await page.getByRole('button', { name: 'Start listening' }).first().isEnabled(), true);
    const accuracyTrigger = page.getByRole('button', { name: 'Tuner accuracy', exact: true });
    assert.match(await accuracyTrigger.textContent(), /ADV/);
    for (const label of ['INT', 'BEG', 'ADV']) {
      await accuracyTrigger.click();
      await page.getByRole('menuitemradio', { name: label, exact: true }).click();
      assert.match(await accuracyTrigger.textContent(), new RegExp(label));
    }
    if (mode === 'hosted') {
      await page.getByText('Offline ready', { exact: true }).waitFor();
      host.setAvailable(false);
      await context.setOffline(true);
      await page.close();
      page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(url);
      await page.getByText('Offline ready', { exact: true }).waitFor();
    }
    const settings = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await settings.getByLabel('Written pitch', { exact: true }).selectOption('2');
    await settings.getByRole('button', { name: 'Save settings' }).click();
    assert.equal(await settings.isVisible(), false);
    // Settings are a draft until Save; Escape discards the draft and returns focus.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await settings.getByLabel('A4 reference (Hz)', { exact: true }).fill('442');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Settings', exact: true }).evaluate((node) => node === document.activeElement), true);
    assert.equal(await page.getByRole('button', { name: 'A4 = 440 Hz', exact: true }).isVisible(), true);

    const nav = page.getByRole('navigation', { name: 'Practice focus' });
    await nav.getByRole('button', { name: 'Reference tone', exact: true }).click();
    await page.getByRole('button', { name: 'Select F♯3', exact: true }).click();
    const soundingKey = page.getByRole('button', { name: 'Select F♯3', exact: true });
    await page.getByRole('button', { name: 'Stop tone', exact: true }).first().waitFor();
    await soundingKey.click();
    await page.getByRole('button', { name: 'Play tone', exact: true }).first().waitFor();
    await soundingKey.click();
    await page.getByRole('button', { name: 'Stop tone', exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Select G3', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Stop tone', exact: true }).first().isVisible(), true);
    const selectedFrequency = await page.locator('.selected-note').innerText();
    await page.getByRole('button', { name: '+ Octave', exact: true }).click();
    assert.equal(await page.locator('.selected-note').innerText(), selectedFrequency);
    assert.equal(await page.getByRole('button', { name: 'Select C4', exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Sustain on', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Sustain off', exact: true }).evaluate((node) => node === document.activeElement), true);
    await nav.getByRole('button', { name: 'Metronome', exact: true }).click();
    await page.getByLabel('Tempo (BPM)', { exact: true }).fill('108');
    await page.getByLabel('Tempo (BPM)', { exact: true }).press('Tab');
    await page.getByLabel('Meter', { exact: true }).selectOption('6/8');
    assert.equal(await page.locator('.beat:visible').count(), 2);
    assert.equal(await page.getByLabel('Tempo (BPM)', { exact: true }).inputValue(), '108');
    await nav.getByRole('button', { name: 'Reference tone', exact: true }).click();
    assert.equal(await page.locator('.selected-note').innerText(), selectedFrequency);
    assert.equal(await page.getByRole('button', { name: 'Select C4', exact: true }).isVisible(), true);
    await nav.getByRole('button', { name: 'Tuner', exact: true }).click();
    assert.equal(await page.locator('.pitch-note').innerText(), '—');
    assert.equal(await page.locator('.pitch-marker').isVisible(), false);

    await stopAllAudio();
    // Real Web Audio graph with synthetic input; this does not test permission or hardware.
    await page.evaluate(() => {
      window.scheduledClicks = [];
      const originalStart = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function(time = 0) {
        if (time > 0 && this.frequency.value >= 750) window.scheduledClicks.push({ time, now: this.context.currentTime, frequency: this.frequency.value });
        return originalStart.call(this, time);
      };
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
        await ac.resume(); window.inputStarted = performance.now(); return destination.stream;
      } });
    });
    await page.getByRole('button', { name: 'Start listening', exact: true }).first().click();
    await page.waitForFunction(() => document.querySelector('.pitch-note').textContent === 'B4');
    const settlingMs = await page.evaluate(() => performance.now() - window.inputStarted);
    assert.ok(settlingMs <= 500, `${mode}: settling ${settlingMs} ms`);
    await nav.getByRole('button', { name: 'Reference tone', exact: true }).click();
    if (await page.getByRole('button', { name: 'Sustain off', exact: true }).isVisible()) await page.getByRole('button', { name: 'Sustain off', exact: true }).click();
    await page.getByRole('button', { name: 'Play tone', exact: true }).first().click();
    await page.getByRole('button', { name: 'Stop tone', exact: true }).first().waitFor();
    await nav.getByRole('button', { name: 'Tuner', exact: true }).click();
    assert.equal(await page.locator('.pitch-note').innerText(), 'B4');
    await nav.getByRole('button', { name: 'Metronome', exact: true }).click();
    await page.getByLabel('Tempo (BPM)', { exact: true }).fill('120');
    await page.waitForTimeout(200);
    assert.equal(await page.getByLabel('Tempo (BPM)', { exact: true }).inputValue(), '120', 'Live pitch updates must not overwrite an edit');
    await page.getByLabel('Tempo (BPM)', { exact: true }).press('Tab');
    await page.getByLabel('Subdivision', { exact: true }).selectOption('3');
    await page.getByRole('button', { name: 'Start metronome', exact: true }).first().click();
    for (const focus of ['Tuner', 'Reference tone', 'Metronome', 'Tuner', 'Metronome']) {
      await nav.getByRole('button', { name: focus, exact: true }).click();
      await page.evaluate(() => { const until = performance.now() + 20; while (performance.now() < until) { /* Controlled foreground load. */ } });
    }
    await page.waitForFunction(() => window.scheduledClicks.length >= 13);
    const clicks = await page.evaluate(() => window.scheduledClicks);
    for (let i = 1; i < clicks.length; i++) assert.ok(Math.abs(clicks[i].time - clicks[i - 1].time - 1 / 6) < 0.00001);
    assert.ok(clicks.every((click) => click.time >= click.now), 'Clicks must be scheduled ahead of playback');
    assert.deepEqual(clicks.slice(0, 7).map((click) => click.frequency), [1500, 750, 750, 1000, 750, 750, 1500]);
    await page.waitForFunction(() => document.querySelector('.beat[aria-current="true"]'));
    // Change focus and settings while input analysis and clicks continue.
    await nav.getByRole('button', { name: 'Tuner', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Stop metronome', exact: true }).isVisible(), true);
    await page.evaluate(() => { window.silenceStarted = performance.now(); window.testInput.gain.gain.value = 0; });
    await page.waitForFunction(() => document.querySelector('.pitch-marker').hidden, { }, { timeout: 500 });
    const silenceClearMs = await page.evaluate(() => performance.now() - window.silenceStarted);
    assert.ok(silenceClearMs <= 500);
    await stopAllAudio();
    assert.equal(await page.evaluate(() => window.testInput.destination.stream.getTracks().every((track) => track.readyState === 'ended')), true);
    await page.evaluate(() => window.testInput.ac.close());
    const stoppedClicks = await page.evaluate(() => window.scheduledClicks.length);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.scheduledClicks.length), stoppedClicks);
    assert.equal(await page.locator('#current-beat').textContent(), 'Stopped');
    await page.getByRole('button', { name: 'Start metronome', exact: true }).click();
    await page.getByRole('button', { name: 'Stop metronome', exact: true }).waitFor();
    await page.evaluate(() => { const until = performance.now() + 500; while (performance.now() < until) { /* Deliberate scheduler underrun. */ } });
    await page.getByText('Metronome timing was interrupted. Start it again to resume a steady beat.', { exact: true }).waitFor();
    await stopAllAudio();
    measurements.push({ mode, settlingMs, silenceClearMs, clicks: clicks.length, minimumLeadMs: Math.min(...clicks.map((click) => click.time - click.now)) * 1000 });
    console.log(`${mode}: settling ${settlingMs.toFixed(0)} ms, silence clearing ${silenceClearMs.toFixed(0)} ms; ${clicks.length} clicks at 1/6-second spacing during pitch analysis, tone playback and UI activity; minimum scheduling lead ${(Math.min(...clicks.map((click) => click.time - click.now)) * 1000).toFixed(1)} ms; long stall stops playback.`);

    // Background interruption cancels active output and requires an explicit restart.
    await page.getByRole('button', { name: 'Play tone', exact: true }).click();
    await page.getByRole('button', { name: 'Stop tone', exact: true }).waitFor();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByText('Practice paused while tUno was hidden. Start a tool to resume.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Stop tone', exact: true }).count(), 0);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await stopAllAudio();

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
        if (focus === 'Reference tone' || focus === 'Metronome') {
          const sound = page.getByLabel(focus === 'Reference tone' ? (width <= 650 ? 'Tone output sound' : 'Tone sound') : 'Click sound', { exact: true });
          for (const value of focus === 'Reference tone' ? ['sine', 'triangle', 'rich'] : ['click', 'wood', 'beep', 'drum']) {
            await sound.selectOption(value);
            assert.equal(await sound.inputValue(), value);
          }
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${mode}: ${focus} overflow at ${width}px`);
      }
    }
    // Mobile pickers share the sounding note, retain focus, and leave tools accessible.
    await page.setViewportSize({ width: 390, height: 844 });
    await nav.getByRole('button', { name: 'Reference tone', exact: true }).click();
    const tone = page.locator('#view-tone');
    const noteTrigger = tone.locator('.note-picker-trigger');
    const selectedBeforeBrowsing = await noteTrigger.textContent();
    await tone.getByRole('button', { name: 'Browse octave', exact: true }).click();
    await page.getByRole('menuitemradio', { name: '5', exact: true }).click();
    assert.equal(await noteTrigger.textContent(), selectedBeforeBrowsing, 'Browsing must preserve the selected tone');
    assert.equal(await tone.getByRole('button', { name: 'Browse octave', exact: true }).evaluate(node => node === document.activeElement), true);
    await noteTrigger.click();
    await page.getByRole('menuitemradio', { name: 'A', exact: true }).click();
    assert.match(await noteTrigger.textContent(), /A5/);
    await page.locator('.tool-card').nth(1).getByRole('button', { name: 'Stop tone', exact: true }).waitFor();
    await tone.getByRole('button', { name: 'Browse octave', exact: true }).click();
    await page.getByRole('menuitemradio', { name: '4', exact: true }).click();
    assert.match(await noteTrigger.textContent(), /A5/);
    await noteTrigger.click();
    await page.keyboard.press('Escape');
    assert.equal(await noteTrigger.evaluate(node => node === document.activeElement), true);
    await tone.locator('.tone-output').getByRole('button', { name: 'Volume 40%', exact: true }).click();
    const toneVolume = page.getByLabel('Tone output volume', { exact: true });
    await toneVolume.fill('63');
    await page.keyboard.press('Escape');
    assert.equal(await tone.locator('.tone-output').getByRole('button', { name: 'Volume 63%', exact: true }).isVisible(), true);
    await nav.getByRole('button', { name: 'Metronome', exact: true }).click();
    await page.getByLabel('Meter', { exact: true }).selectOption('free');
    assert.equal(await page.locator('.beat-grid').isVisible(), false);
    await page.getByLabel('Meter', { exact: true }).selectOption('4/4');
    assert.equal(await page.locator('.beat:visible').count(), 4);
    await page.getByRole('button', { name: 'View · Numbered', exact: true }).click();
    assert.equal(await page.locator('.beat-grid').isVisible(), false);
    await page.getByRole('button', { name: 'View · Uno', exact: true }).click();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const focus of ['Tuner', 'Reference tone', 'Metronome']) {
        await nav.getByRole('button', { name: focus, exact: true }).click();
        const bounds = await page.locator('.practice-surface').boundingBox();
        assert.ok(bounds.height <= 485, `${mode}: ${focus} mobile surface must fit the design at ${width}px`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await nav.getByRole('button', { name: 'Reference tone', exact: true }).click();
      for (const trigger of [tone.locator('.note-picker-trigger'), tone.locator('.keyboard-heading .mobile-only')]) {
        await trigger.click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await page.locator('.tool-strip').getByRole('button', { name: 'Stop tone', exact: true }).isVisible(), true);
        await page.keyboard.press('Escape');
      }
    }
    await page.locator('.tool-strip').getByRole('button', { name: 'Stop tone', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    await nav.getByRole('button', { name: 'Tuner', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await settings.getByLabel('Show Uno', { exact: true }).uncheck();
    await settings.getByRole('button', { name: 'Save settings' }).click();
    assert.equal(await page.locator('.tuner-friend').isVisible(), false);
    assert.equal(await page.locator('.pitch-lane').isVisible(), true);
    assert.deepEqual(errors, []);
    if (mode === 'portable') assert.deepEqual(requests.filter((request) => request !== url), [], 'Portable must not request subresources.');

    if (process.env.TUNO_SCREENSHOT_DIR && mode === 'hosted') {
      const directory = process.env.TUNO_SCREENSHOT_DIR;
      await mkdir(directory, { recursive: true });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await settings.getByLabel('Show Uno', { exact: true }).check();
      await settings.getByLabel('Written pitch', { exact: true }).selectOption('0');
      await settings.getByRole('button', { name: 'Save settings' }).click();
      for (const width of [1120, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const focus of ['Tuner', 'Reference tone', 'Metronome']) {
          await nav.getByRole('button', { name: focus, exact: true }).click();
          await page.screenshot({ path: join(directory, `${focus.replaceAll(' ', '-')}-${width}.png`), fullPage: true });
        }
      }
    }
    console.log(`${mode}: shared state, controls, font/image decoding, responsive layouts, and keyboard checks passed in ${engineName} ${browser.version()}${mode === 'portable' ? '; relocated file, offline, no subresource requests' : ''}.`);
    await context.close();
    host.setAvailable(true);
  }
  const release = JSON.parse(await readFile(new URL('../dist/release.json', import.meta.url), 'utf8'));
  await mkdir(new URL('../dist/validation/', import.meta.url), { recursive: true });
  await writeFile(new URL(`../dist/validation/${engineName}-integrated.json`, import.meta.url), JSON.stringify({ build: release.build, revision: release.revision, dirty: release.dirty, browser: `${engineName} ${browser.version()}`, measuredAt: new Date().toISOString(), route: 'Synthetic microphone and virtual audio output', measurements }, null, 2));
} finally {
  await browser?.close();
  await host.close();
  await rm(temp, { recursive: true, force: true });
}
