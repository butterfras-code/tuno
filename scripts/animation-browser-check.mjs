import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';

const engine = ({ chromium, firefox })[process.env.TUNO_BROWSER || 'chromium'];
const host = await hostBuild();
const browser = await engine.launch();
await mkdir('dist/validation/animations', { recursive: true });
try {
  for (const [mode, url] of [['hosted', host.url], ['portable', pathToFileURL(resolve('dist/portable/tuno.html')).href]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, offline: mode === 'portable' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    const nav = page.getByRole('navigation');
    const focus = name => nav.getByRole('button', { name, exact: true }).click();
    await focus('Metronome');
    await page.evaluate(() => {
      window.nods = 0;
      const animate = Element.prototype.animate;
      Element.prototype.animate = function(...args) {
        if (this.classList.contains('uno-head')) window.nods++;
        return animate.apply(this, args);
      };
    });
    const pet = page.locator('.pet-tempo');
    const tempo = page.getByLabel('Tempo (BPM)', { exact: true });
    await pet.press('Enter');
    assert.equal(await page.evaluate(() => window.nods), 1, 'keyboard taps nod');
    await page.waitForTimeout(300);
    const box = await pet.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.waitForTimeout(340);
    assert.equal(await page.locator('.pet-tempo .uno-looking').count(), 1);
    await page.mouse.move(x, y - 80, { steps: 5 });
    assert.equal(await tempo.inputValue(), '116');
    await page.screenshot({ path: `dist/validation/animations/${engine.name()}-${mode}-drag.png` });
    await page.mouse.up();
    assert.equal(await page.locator('.pet-tempo .uno-looking').count(), 0);
    assert.equal(await page.evaluate(() => window.nods), 1, 'hold/drag suppresses tap');
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x, y + 40, { steps: 3 }); await page.mouse.up();
    assert.equal(await tempo.inputValue(), '106', 'movement starts dragging before long press');
    assert.equal(await page.evaluate(() => window.nods), 1);
    if (engine === chromium) {
      const touch = await context.newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 40 }] });
      assert.equal(await tempo.inputValue(), '116');
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.equal(await page.locator('.pet-tempo .uno-looking').count(), 0);
      assert.equal(await page.evaluate(() => window.nods), 1);
      await touch.detach();
    }
    await pet.tap();
    assert.equal(await page.evaluate(() => window.nods), 2, 'touch tap nods once');
    await tempo.fill('240'); await tempo.press('Enter');
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 80); await page.mouse.up();
    assert.equal(await tempo.inputValue(), '240');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pet.press('Enter');
    assert.equal(await page.evaluate(() => window.nods), 2, 'reduced motion suppresses nod');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await page.setViewportSize({ width: 1120, height: 1000 });
    await tempo.fill('120'); await tempo.press('Enter');
    await page.getByLabel('Meter', { exact: true }).selectOption('3/4');
    await page.getByLabel('Subdivision', { exact: true }).selectOption('3');
    await page.evaluate(() => {
      window.clickTimes = [];
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function(time = 0) {
        if (time > 0) { window.beatContext = this.context; window.clickTimes.push(time); }
        return start.call(this, time);
      };
    });
    await page.getByRole('button', { name: 'Start metronome', exact: true }).first().click();
    await page.waitForFunction(() => window.clickTimes.length > 0);
    const samples = await page.evaluate(() => new Promise(done => {
      const samples = [];
      const start = performance.now();
      function sample() {
        const context = window.beatContext;
        const now = context.getOutputTimestamp?.().contextTime || context.currentTime;
        samples.push({ time: now, angle: Number(document.querySelector('.pet-tempo .uno-tail').style.transform.match(/rotate\(([-\d.]+)/)?.[1]) });
        if (performance.now() - start > 2300) done({ samples, first: window.clickTimes[0] });
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }));
    const valid = samples.samples.filter(s => s.time >= samples.first && Number.isFinite(s.angle));
    assert.ok(valid.length > 30);
    assert.ok(valid.every(s => Math.abs(s.angle - 25 * Math.cos(Math.PI * (s.time - samples.first) / 0.5)) < 5), 'tail follows audio phase through 3/4 bar boundary, not subdivisions');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(60);
    assert.match(await pet.getAttribute('data-beat'), /left|right/);
    assert.notEqual(await pet.evaluate(node => getComputedStyle(node).boxShadow), 'none');
    assert.equal(await page.locator('.pet-tempo .uno-tail').evaluate(node => getComputedStyle(node).transform), 'none');
    await page.getByRole('button', { name: 'Stop metronome', exact: true }).first().click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await focus('Tuner');
    await page.evaluate(() => {
      const ac = new AudioContext();
      const oscillator = ac.createOscillator(), gain = ac.createGain(), destination = ac.createMediaStreamDestination();
      oscillator.frequency.value = 440; gain.gain.value = 0.2;
      oscillator.connect(gain).connect(destination); oscillator.start();
      window.signal = { ac, oscillator, gain };
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => { await ac.resume(); return destination.stream; } });
      window.rewards = 0;
      const animate = Element.prototype.animate;
      Element.prototype.animate = function(...args) {
        if (this.classList.contains('uno-reward')) window.rewards++;
        return animate.apply(this, args);
      };
    });
    await page.getByRole('button', { name: 'Start listening', exact: true }).first().click();
    const pose = value => page.waitForFunction(value => document.querySelector('.tuner-friend .uno').dataset.pose === value, value);
    await pose('wag'); await pose('beg'); await page.waitForTimeout(320);
    await page.screenshot({ path: `dist/validation/animations/${engine.name()}-${mode}-beg.png` });
    await pose('catch');
    assert.equal(await page.locator('.pitch-marker').isVisible(), true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `dist/validation/animations/${engine.name()}-${mode}-catch.png` });
    await pose('happy'); await page.waitForTimeout(2800);
    assert.equal(await page.evaluate(() => window.rewards), 1);
    await page.evaluate(() => { window.signal.gain.gain.value = 0; });
    await pose('rest'); await page.waitForTimeout(250);
    assert.equal(await page.locator('.pitch-marker').isVisible(), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { window.signal.gain.gain.value = 0.2; });
    await pose('catch');
    assert.equal(await page.evaluate(() => window.rewards), 1, 'reduced motion catch is static');
    await page.getByRole('button', { name: 'Stop listening', exact: true }).first().click();
    await pose('rest');
    await page.evaluate(() => window.signal.ac.close());
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${engine.name()} ${mode}: poses, rewards, audio phase, pet taps/drags, cancellation and reduced motion passed`);
  }
} finally { await browser.close(); await host.close(); }
