import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const host = await hostBuild();
const browser = await ({ chromium, firefox })[engine].launch(engine === 'chromium' ? { args: ['--autoplay-policy=no-user-gesture-required'] } : { firefoxUserPrefs: { 'media.autoplay.default': 0 } });
try {
  for (const { width, fixture, counts } of [
    { width: 390, fixture: 'dense-sixteenths', counts: false },
    { width: 320, fixture: 'dense-sixteenths', counts: true },
    { width: 320, fixture: 'tie-across-bar', counts: true },
    { width: 1440, fixture: 'half', counts: false },
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true });
    await page.addInitScript(() => {
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext {
        constructor(...args) { super(...args); window.followAudio = this; }
      };
    });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL(`/prototypes/rhythm-walk/?fixture=${fixture}`, host.url).href);
    await page.getByRole('button', { name: 'Perform', exact: true }).click();
    await page.locator('.score-tempo input').fill('180');
    if (counts) {
      // Configure the same control in either desktop or mobile presentation.
      await page.getByRole('checkbox', { name: 'Show written counts during performance', exact: true, includeHidden: true }).evaluate(input => {
        input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    await page.waitForTimeout(150);
    const overflow = await page.locator('.passage-scroll').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    assert.equal(overflow, width < 1000);
    await page.locator('.passage-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await page.getByRole('button', { name: 'Performance pad', exact: true }).click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.passage-scroll').evaluate(el => el.scrollLeft), 0, 'Count-in resets to beginning');
    await page.evaluate(() => {
      window.followSamples = [];
      window.followTimer = setInterval(() => {
        const scroll = document.querySelector('.passage-scroll');
        const pad = document.querySelector('.pad').getBoundingClientRect();
        window.followSamples.push({ t: performance.now(), x: scroll.scrollLeft, page: scrollY, pad: pad.top, overview: parseFloat(document.querySelector('.rhythm-overview-window').style.left), expected: 100 * scroll.scrollLeft / scroll.scrollWidth });
      }, 50);
    });
    if (fixture === 'dense-sixteenths') {
      const pad = await page.getByRole('button', { name: 'Performance pad', exact: true }).boundingBox();
      for (let tap = 0; tap < 24; tap++) {
        await page.waitForTimeout(140);
        await page.mouse.click(pad.x + pad.width / 2, pad.y + pad.height / 2);
      }
    }
    await page.waitForFunction(() => !document.querySelector('.tap-response').classList.contains('active'), null, { timeout: 15000 });
    const samples = await page.evaluate(() => { clearInterval(window.followTimer); return window.followSamples; });
    assert.ok(samples.length > 20);
    if (fixture === 'dense-sixteenths') {
      // Four equal 4/4 bars at 180 BPM: barline whitespace must not produce
      // a burst of speed, even while real mouse input arrives on the pad.
      const speed = await page.locator('.notation').first().evaluate(el => el.getBoundingClientRect().width / (4 * 60 / 180));
      assert.ok(samples.every((p, i) => !i || p.x - samples[i - 1].x <= speed * ((p.t - samples[i - 1].t) / 1000 + .04) + 2), 'Live pad clicks and barlines do not accelerate horizontal scrolling');
    }
    assert.ok(samples.every((p, i) => i === 0 || p.x >= samples[i - 1].x - 1), 'Playback follows forward through the score');
    assert.ok(samples.every(p => Math.abs(p.overview - p.expected) < .1), 'Overview tracks viewport');
    assert.ok(samples.slice(0, -2).every(p => Math.abs(p.page - samples[0].page) < 1 && Math.abs(p.pad - samples[0].pad) < 1), 'Page and pad stay stationary during playback');
    assert.equal(samples.some(p => p.x > 50), overflow, 'Only overflowing notation moves');
    const end = await page.locator('.passage-scroll').evaluate(el => el.scrollLeft);
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.passage-scroll').evaluate(el => el.scrollLeft), end, 'Completion stops following');
    await page.getByRole('button', { name: 'Perform', exact: true }).click();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.passage-scroll').evaluate(el => el.scrollLeft), 0, 'Retry resets scrolling');
    await page.waitForTimeout(1800);
    // Freeze only the exposed playback clock: input must never move the viewport.
    await page.evaluate(() => {
      Object.defineProperty(window.followAudio, 'currentTime', { configurable: true, value: window.followAudio.currentTime });
    });
    await page.waitForTimeout(100);
    const viewport = () => page.evaluate(() => ({
      x: document.querySelector('.passage-scroll').scrollLeft,
      page: scrollY, pad: document.querySelector('.pad').getBoundingClientRect().top,
    }));
    const frozen = await viewport();
    const pad = await page.getByRole('button', { name: 'Performance pad', exact: true }).boundingBox();
    // Use browser input directly; locator.click can itself scroll the target.
    await page.mouse.click(pad.x + pad.width / 2, pad.y + pad.height / 2);
    await page.keyboard.press('Space');
    await page.touchscreen.tap(pad.x + pad.width / 2, pad.y + pad.height / 2);
    await page.waitForTimeout(100);
    assert.deepEqual(await viewport(), frozen, 'Mouse, touch and keyboard input cannot move a frozen playback viewport');
    // Stop may retain focus during capture. Refocusing a partly visible pad must
    // not ask the browser to reveal its entire bounding box.
    await page.getByRole('button', { name: 'Stop', exact: true }).focus();
    await page.evaluate(() => {
      const pad = document.querySelector('.pad');
      window.scrollBy(0, pad.getBoundingClientRect().top + 40);
    });
    const partial = await viewport();
    const partialPad = await page.getByRole('button', { name: 'Performance pad', exact: true }).boundingBox();
    await page.mouse.click(partialPad.x + partialPad.width / 2, Math.max(5, partialPad.y + partialPad.height - 20));
    assert.deepEqual(await viewport(), partial, 'Pointer refocus must not scroll a partially visible pad');
    await page.evaluate(() => { delete window.followAudio.currentTime; });
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    const stopped = await page.locator('.passage-scroll').evaluate(el => el.scrollLeft);
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.passage-scroll').evaluate(el => el.scrollLeft), stopped, 'Interruption stops following');
    assert.deepEqual(errors, []);
    console.log(`${engine}: ${width}px ${fixture}, written counts ${counts}: passed`);
    await page.close();
  }
} finally { await browser.close(); await host.close(); }
