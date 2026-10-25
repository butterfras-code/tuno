import { positivePhrases } from '../src/apps/tunotes/ui/answer-feedback.ts';
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
  for (const [width, pace, reducedMotion, pitch] of [[360, 'instant', 'no-preference', 'B4'], [1280, 'delay', 'no-preference', 'E5'], [768, 'click', 'reduce', 'C6'], [360, 'correct', 'no-preference', 'C4'], [1280, 'instant', 'no-preference', 'F#4']]) {
    const data = emptySnapshot();
    const preset = { id: 'feedback-fixture', name: 'Feedback fixture', clef: 'treble', range: [pitch, pitch], content: 'lines-and-spaces', key: keySignature(pitch.includes('#') ? 'G' : 'C'), accidentals: 'key-only', exactRange: true };
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
    const answer = async () => {
      if (pitch.includes('#')) await page.keyboard.down('ArrowUp');
      await page.keyboard.press(pitch[0].toLowerCase());
      if (pitch.includes('#')) await page.keyboard.up('ArrowUp');
    };
    await answer();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) > 0.6);
    assert.ok(positivePhrases.includes(await page.locator('.answer-feedback').textContent()));
    assert.equal(await page.locator('.answer-feedback-announcement').textContent(), await page.locator('.answer-feedback').textContent());
    assert.equal(await page.locator('#feedback > span').textContent(), '');
    assert.deepEqual(await staff.boundingBox(), before.staff);
    assert.deepEqual(await answers.boundingBox(), before.answers);
    const placement = async () => staff.evaluate(svg => {
      const text = svg.querySelector('.answer-feedback');
      const bounds = text.getBoundingClientRect();
      const notes = [...svg.querySelectorAll('.notehead, .note-accidental, .ledger')].map(note => note.getBoundingClientRect());
      const overlaps = notes.some(note => bounds.left < note.right && bounds.right > note.left && bounds.top < note.bottom && bounds.bottom > note.top);
      const frame = svg.getBoundingClientRect();
      return { overlaps, contained: bounds.left >= frame.left && bounds.right <= frame.right && bounds.top >= frame.top && bounds.bottom <= frame.bottom,
        x: Number(text.getAttribute('x')), y: Number(text.getAttribute('y')), angle: Number(/rotate\(([^ ]+)/.exec(text.getAttribute('transform'))[1]), opacity: Number(getComputedStyle(text).opacity), center: svg.viewBox.baseVal.width / 2 };
    });
    const firstPhrase = await page.locator('.answer-feedback').textContent();
    const first = await placement();
    assert.equal(first.overlaps, false, 'Feedback clears the note, accidental and ledger lines');
    assert.equal(first.contained, true, 'Feedback fits inside the staff viewport');
    assert.ok(Math.abs(first.x - first.center) <= 8, 'Feedback stays near the horizontal center');
    assert.ok(first.opacity <= 0.65, 'Feedback is translucent');
    await mkdir('dist/validation', { recursive: true });
    await page.screenshot({ path: `dist/validation/notes-feedback-${name}-${width}-${pace}-${pitch.replace('#', 'sharp')}.png` });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) === 0);
    // Advancing the prompt must not cut off the one-second animation.
    assert.ok(await page.locator('.answer-feedback').evaluate(text => text.getAnimations()[0].currentTime >= 1000));
    if (pace === 'click') await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await answer();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) > 0.6);
    assert.notEqual(await page.locator('.answer-feedback').textContent(), firstPhrase, 'Positive phrases do not repeat consecutively');
    const second = await placement();
    assert.equal(second.overlaps, false);
    assert.notEqual(second.x, first.x, 'Placement varies on each answer');
    if (reducedMotion !== 'reduce') assert.notEqual(second.angle, first.angle, 'Angle varies on each answer');
    else assert.equal(second.angle, 0, 'Reduced motion keeps the text level');
    assert.match(await page.locator('#practice-counts').textContent(), /2 correct \/ 2 attempts/);
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) === 0);
    if (pace === 'click') await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.keyboard.press('a');
    assert.equal(await page.locator('.answer-feedback').textContent(), pace === 'correct' ? 'Try again' : `That note is ${pitch.replace(/[0-9]/g, '').replace('#', '♯')}.`);
    assert.equal((await placement()).overlaps, false, 'Longer corrections also clear the note');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    assert.equal(await page.locator('.answer-feedback').textContent(), '');
    if (pace === 'click') {
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      for (let correct = 3; correct <= 10; correct++) {
        await answer();
        if (correct === 7) assert.match(await page.locator('.answer-feedback').textContent(), /5 in a row/);
        if (correct < 10) await page.getByRole('button', { name: 'Continue', exact: true }).click();
      }
      assert.equal(await page.locator('.answer-feedback').textContent(), 'A treat for Uno!');
      assert.equal(await page.locator('.encouragement, #expansion-announcement').count(), 0);
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) > 0.6);
      assert.equal((await placement()).overlaps, false);
      assert.equal((await placement()).contained, true);
      await page.screenshot({ path: `dist/validation/notes-feedback-${name}-treat.png` });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`${name}: translucent feedback varies its placement, clears notation and fades for one second across pacing modes, repeats, preserves layout, supports reduced motion and clears on pause.`);
} finally { await browser.close(); await host.close(); }
