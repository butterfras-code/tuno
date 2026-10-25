import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { emptySnapshot } from '../src/apps/tunotes/persistence/store.ts';
import { keySignature } from '../src/apps/tunotes/domain/notation.ts';
import { hostBuild } from './test-host.mjs';

const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[name].launch();
const host = await hostBuild();
const errors = [];
try {
  for (const [width, pace, reducedMotion] of [[360, 'instant', 'no-preference'], [1280, 'delay', 'no-preference'], [768, 'click', 'reduce'], [360, 'correct', 'no-preference']]) {
    const data = emptySnapshot();
    const preset = { id: 'feedback-fixture', name: 'Feedback fixture', clef: 'treble', range: ['B4', 'B4'], content: 'lines-and-spaces', key: keySignature('C'), accidentals: 'key-only', exactRange: true };
    data.customPresets.push(preset);
    data.profiles.push({ id: 'student', name: 'Student', defaultPresetId: preset.id, preview: false, contexts: [], results: [] });
    Object.assign(data.configuration, { presetId: preset.id, profileId: 'student', continueAfter: pace });
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(data => localStorage.setItem('tunotes:data:v1', JSON.stringify(data)), data);
    await page.goto(new URL('/notes/', host.url).href);
    await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
    const staff = page.locator('.practice-play .staff');
    const answers = page.locator('.practice-play .answer-input');
    const before = { staff: await staff.boundingBox(), answers: await answers.boundingBox() };
    await page.keyboard.press('b');
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) > 0.9);
    assert.equal(await page.locator('.answer-feedback').textContent(), 'Correct!');
    assert.equal(await page.locator('.answer-feedback-announcement').textContent(), 'Correct!');
    assert.equal(await page.locator('#feedback > span').textContent(), '');
    assert.deepEqual(await staff.boundingBox(), before.staff);
    assert.deepEqual(await answers.boundingBox(), before.answers);
    const centered = await staff.evaluate(svg => {
      const text = svg.querySelector('.answer-feedback');
      return Number(text.getAttribute('x')) === svg.viewBox.baseVal.width / 2 && text.getAttribute('y') === '100';
    });
    assert.ok(centered, 'Feedback is centered on the staff lines');
    await mkdir('dist/validation', { recursive: true });
    await page.screenshot({ path: `dist/validation/notes-feedback-${name}-${width}-${pace}.png` });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) === 0);
    // Advancing the prompt must not cut off the one-second animation.
    assert.ok(await page.locator('.answer-feedback').evaluate(text => text.getAnimations()[0].currentTime >= 1000));
    if (pace === 'click') await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.keyboard.press('b');
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) > 0.9);
    assert.match(await page.locator('#practice-counts').textContent(), /2 correct \/ 2 attempts/);
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) === 0);
    if (pace === 'click') await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.keyboard.press('a');
    assert.equal(await page.locator('.answer-feedback').textContent(), pace === 'correct' ? 'Try again' : 'That note is B.');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    assert.equal(await page.locator('.answer-feedback').textContent(), '');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`${name}: centered feedback fades for one second across pacing modes, repeats, preserves layout, supports reduced motion and clears on pause.`);
} finally { await browser.close(); await host.close(); }
