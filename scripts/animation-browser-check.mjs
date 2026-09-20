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
    const focus = name => page.getByRole('navigation', { name: 'Practice focus' }).getByRole('button', { name, exact: true }).click();
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
    const head = pet.locator('.pet-head');
    const body = pet.locator('.pet-body');
    const tempo = page.getByLabel('Tempo (BPM)', { exact: true });
    await head.press('Enter');
    assert.equal(await page.evaluate(() => window.nods), 1, 'keyboard head taps nod');
    const headBox = await head.boundingBox();
    await page.mouse.move(headBox.x + headBox.width / 2, headBox.y + headBox.height / 2);
    await page.mouse.down();
    assert.equal(await page.evaluate(() => window.nods), 2, 'head nods on contact before release');
    await page.mouse.up();
    await page.waitForTimeout(320);
    assert.equal(await page.evaluate(() => window.nods), 2, 'head tap nods only once');
    await head.dblclick();
    assert.equal(await pet.getAttribute('data-tail-motion'), 'bounce', 'head double taps never switch the tail');
    const beforeBody = await page.evaluate(() => window.nods);
    const beforeBodyTempo = await tempo.inputValue();
    await body.tap(); await page.waitForTimeout(80); await body.tap();
    assert.equal(await pet.getAttribute('data-tail-motion'), 'sides', 'body double taps switch the tail');
    assert.equal(await page.evaluate(() => window.nods), beforeBody, 'body taps never nod');
    assert.equal(await tempo.inputValue(), beforeBodyTempo, 'body taps never set tempo');
    await body.press('Enter');
    assert.equal(await pet.getAttribute('data-tail-motion'), 'bounce', 'body keyboard activation switches the tail');

    for (const target of [tempo, page.locator('.tempo-drag-area')]) {
      await tempo.fill('96'); await tempo.press('Enter');
      await tempo.click();
      const box = await target.boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      assert.equal(await pet.locator('.uno-looking').count(), 0, 'contact alone does not turn the head');
      await page.mouse.move(x, y - 60, { steps: 5 });
      assert.equal(await tempo.inputValue(), '106');
      assert.equal(await pet.locator('.uno-looking').count(), 1, 'dragging tempo turns the head left');
      assert.equal(await pet.locator('.uno-head').evaluate(node => getComputedStyle(node).transitionDuration), '0s', 'drag follows without smoothing');
      await page.screenshot({ path: `dist/validation/animations/${engine.name()}-${mode}-drag.png` });
      await page.mouse.up();
      assert.equal(await pet.locator('.uno-looking').count(), 0, 'release restores the head');
      if (engine === chromium) {
        const touch = await context.newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 60 }] });
        assert.equal(await tempo.inputValue(), '116');
        assert.equal(await pet.locator('.uno-looking').count(), 1);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        assert.equal(await pet.locator('.uno-looking').count(), 0, 'touch cancellation restores the head');
        await touch.detach();
      }
    }
    const beforeTouch = await page.evaluate(() => window.nods);
    await head.tap();
    assert.equal(await page.evaluate(() => window.nods), beforeTouch + 1, 'touch head tap nods immediately');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await head.press('Enter'); await head.tap();
    assert.equal(await page.evaluate(() => window.nods), beforeTouch + 1, 'reduced motion suppresses nod');
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
        samples.push({ time: now, angle: Number(document.querySelector('.pet-tempo .uno-tail').style.transform.match(/rotate\(([-\d.e+]+)/)?.[1]) });
        if (performance.now() - start > 2300) done({ samples, first: window.clickTimes[0] });
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }));
    const valid = samples.samples.filter(s => s.time >= samples.first && Number.isFinite(s.angle));
    assert.ok(valid.length > 30);
    assert.ok(valid.every(s => Math.abs(s.angle - 12.5 * (1 + Math.cos(2 * Math.PI * (s.time - samples.first) / 0.5))) < 5), 'tail is down on each beat and up halfway through, independent of subdivisions');
    await body.tap(); await page.waitForTimeout(80); await body.tap();
    assert.equal(await pet.getAttribute('data-tail-motion'), 'sides');
    const sides = await page.evaluate(() => new Promise(done => {
      const samples = [];
      const start = performance.now();
      function sample() {
        const tail = document.querySelector('.pet-tempo .uno-tail-side');
        const angle = document.querySelector('.pet-tempo .uno-tail').style.transform;
        const dog = document.querySelector('.pet-tempo .uno-animated').getBoundingClientRect();
        const bounds = tail.getBoundingClientRect();
        const tip = new DOMPoint(243, 193.895).matrixTransform(tail.querySelector('path').getScreenCTM());
        samples.push({ beat: document.querySelector('.pet-tempo').dataset.beat, transform: tail.style.transform,
          angle, tipY: (tip.y - dog.top) / dog.height, tipX: (tip.x - dog.left) / dog.width, center: bounds.left + bounds.width / 2 - dog.left - dog.width / 2 });
        if (performance.now() - start > 1100) done(samples);
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }));
    assert.ok(sides.some(sample => sample.beat === 'left' && sample.transform === 'scaleX(-1)'));
    assert.ok(sides.some(sample => sample.beat === 'right' && sample.transform === ''));
    assert.ok(sides.every(sample => ['', 'scaleX(-1)'].includes(sample.transform)), 'tail mirrors across Uno rather than rotating in place');
    assert.ok(sides.every(sample => sample.angle === 'rotate(0deg)'), 'tail stays up on both sides');
    assert.ok(sides.some(sample => sample.center < 0) && sides.some(sample => sample.center > 0), 'tail crosses Uno centerline');
    assert.ok(sides.every(sample => Math.abs(sample.tipY - 193.895 / 320) < 0.002), 'both sides retain the original raised SVG tip height');
    assert.ok(sides.some(sample => sample.tipX < 0.25) && sides.some(sample => sample.tipX > 0.75), 'tail tip stays distinct from the torso on each side');
    await page.screenshot({ path: `dist/validation/animations/${engine.name()}-${mode}-tail-sides.png` });
    await body.dblclick();
    assert.equal(await pet.getAttribute('data-tail-motion'), 'bounce', 'mouse double-click also toggles tail motion');
    await body.dblclick();
    assert.equal(await pet.getAttribute('data-tail-motion'), 'sides');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(60);
    assert.match(await pet.getAttribute('data-beat'), /left|right/);
    assert.notEqual(await pet.evaluate(node => getComputedStyle(node).boxShadow), 'none');
    assert.equal(await page.locator('.pet-tempo .uno-tail').evaluate(node => getComputedStyle(node).transform), 'none');
    await page.getByRole('button', { name: 'Stop metronome', exact: true }).first().click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await tempo.fill('30'); await tempo.press('Enter');
    for (const motion of ['bounce', 'sides']) {
      if (await pet.getAttribute('data-tail-motion') !== motion) await body.press('Enter');
      for (let restart = 0; restart < 2; restart++) {
        await page.getByRole('button', { name: 'Start metronome', exact: true }).first().click();
        await page.waitForFunction(motion => {
          const dog = document.querySelector('.pet-tempo');
          if (!dog.querySelector('.uno-playing')) return false;
          return motion === 'sides'
            ? dog.querySelector('.uno-tail-side').style.transform === 'scaleX(-1)'
            : Number(dog.querySelector('.uno-tail').style.transform.match(/rotate\(([-\d.e+]+)/)?.[1]) > 20;
        }, motion, { timeout: 700 });
        await page.getByRole('button', { name: 'Stop metronome', exact: true }).first().click();
        await page.waitForTimeout(220);
      }
    }
    await tempo.fill('240'); await tempo.press('Enter');
    await page.getByLabel('Meter', { exact: true }).selectOption('4/4');
    await page.getByRole('button', { name: 'Accent beat 3', exact: true }).click();
    await page.getByRole('button', { name: 'Start metronome', exact: true }).first().click();
    const accents = await page.evaluate(() => new Promise(done => {
      const frames = [];
      const start = performance.now();
      const sample = () => {
        const dog = document.querySelector('.pet-tempo');
        const dy = selector => [...dog.querySelectorAll(selector)].map(node => new DOMMatrix(getComputedStyle(node).transform).m42);
        frames.push({ beat: [...document.querySelectorAll('.beat')].findIndex(node => node.getAttribute('aria-current') === 'true'),
          brows: dy('.uno-eyebrow'), ears: dy('.uno-ear') });
        if (performance.now() - start > 1600) done(frames);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }));
    for (const beat of [0, 2]) {
      assert.ok(accents.some(frame => frame.beat === beat && frame.brows.every(y => y < -0.8 && y >= -2) && frame.ears.every(y => y > 0.3 && y <= 1)), 'accent lifts both poses’ brows and lowers their ears');
    }
    assert.ok(accents.some(frame => frame.beat === 1), 'sample includes an unaccented beat');
    assert.ok(accents.filter(frame => frame.beat === 1 || frame.beat === 3).every(frame => [...frame.brows, ...frame.ears].every(y => y === 0)), 'unaccented beats and their subdivisions leave the face at rest');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300);
    assert.ok(await pet.locator('.uno-eyebrow, .uno-ear').evaluateAll(nodes => nodes.every(node => !node.style.transform)), 'reduced motion clears accent animation');
    await page.getByRole('button', { name: 'Stop metronome', exact: true }).first().click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.ok(await pet.locator('.uno-eyebrow, .uno-ear').evaluateAll(nodes => nodes.every(node => !node.style.transform)), 'stop resets the face');
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
    assert.equal(await page.locator('.tuner-friend .uno').getAttribute('data-pose'), 'sleep');
    const hint = page.locator('.hold-caption');
    assert.equal(await hint.textContent(), 'Wake Uno! (Turn on mic above)');
    assert.equal(await hint.evaluate(node => node.previousElementSibling?.classList.contains('hold-progress')), true);
    assert.equal(await page.locator('.tuner-friend .uno-sleep-eye').isVisible(), true);
    assert.equal(await page.locator('.tuner-friend .uno-window-night').isVisible(), true);
    await page.getByRole('button', { name: 'Start listening', exact: true }).first().click();
    const pose = value => page.waitForFunction(value => document.querySelector('.tuner-friend .uno').dataset.pose === value, value);
    await pose('wag'); await pose('beg'); await page.waitForTimeout(320);
    await page.screenshot({ path: `dist/validation/animations/${engine.name()}-${mode}-beg.png` });
    await pose('catch');
    assert.equal(await page.locator('.pitch-marker').isVisible(), true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `dist/validation/animations/${engine.name()}-${mode}-catch.png` });
    await pose('happy'); await page.waitForTimeout(2800);
    assert.equal(await hint.isVisible(), true);
    assert.equal(await hint.textContent(), 'Hold a note to give Uno a treat');
    assert.equal(await page.evaluate(() => window.rewards), 1);
    await page.evaluate(() => { window.signal.gain.gain.value = 0; });
    await pose('rest'); await page.waitForTimeout(250);
    assert.equal(await page.locator('.tuner-friend .uno-rest-eye').first().isVisible(), true, 'silence while listening leaves Uno awake');
    assert.equal(await page.locator('.tuner-friend .uno-window-night').isVisible(), false);
    assert.equal(await page.locator('.pitch-marker').isVisible(), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { window.signal.gain.gain.value = 0.2; });
    await pose('catch');
    assert.equal(await page.evaluate(() => window.rewards), 1, 'reduced motion catch is static');
    await page.getByRole('button', { name: 'Stop listening', exact: true }).first().click();
    await pose('sleep');
    assert.equal(await hint.textContent(), 'Wake Uno! (Turn on mic above)');
    assert.equal(await page.locator('.tuner-friend .uno-sleep-eye').isVisible(), true, 'stopping the microphone closes Uno’s eye');
    assert.equal(await page.locator('.tuner-friend .uno-window-night').isVisible(), true);
    await page.evaluate(() => window.signal.ac.close());
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${engine.name()} ${mode}: poses, rewards, audio phase, pet taps/drags, cancellation and reduced motion passed`);
  }
} finally { await browser.close(); await host.close(); }
