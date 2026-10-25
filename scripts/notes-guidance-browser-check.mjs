import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { emptySnapshot, validateSnapshot } from '../src/apps/tunotes/persistence/store.ts';
import { keySignature } from '../src/apps/tunotes/domain/notation.ts';
import { normalizePreset } from '../src/apps/tunotes/domain/presets.ts';
import { notesMode } from './notes-setup-helpers.mjs';
import { hostBuild } from './test-host.mjs';

const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[name].launch();
const host = await hostBuild();
const errors = [];
try {
  for (const [pitch, key, letter, arrow, label] of [
    ['Bb4', 'F', 'b', 'ArrowDown', 'B♭'], ['F#4', 'G', 'f', 'ArrowUp', 'F♯'], ['B4', 'F', 'b', 'ArrowRight', 'B♮'],
  ]) {
    const data = emptySnapshot();
    const source = { id: 'guidance-fixture', name: 'Guidance fixture', clef: 'treble', range: [pitch, pitch], content: 'lines-and-spaces', key: keySignature(key), accidentals: 'key-only', exactRange: true };
    assert.equal(normalizePreset(source).pool.length, 1);
    data.customPresets.push(source);
    data.profiles.push({ id: 'student', name: 'Student', defaultPresetId: source.id, adaptive: true, preview: false, contexts: [], results: [] });
    Object.assign(data.configuration, { presetId: source.id, profileId: 'student', remember: true, continueAfter: 'instant', showKeySignature: true });
    const context = await browser.newContext({ viewport: { width: pitch === 'Bb4' ? 360 : 1280, height: 900 } });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(data => { if (!localStorage.getItem('tunotes:data:v1')) localStorage.setItem('tunotes:data:v1', JSON.stringify(data)); }, validateSnapshot(data));
    await page.goto(new URL('/notes/', host.url).href);
    await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
    assert.deepEqual(errors, []);
    const staff = page.locator('.practice-play .staff');
    const notation = () => staff.evaluate(svg => { const copy = svg.cloneNode(true); copy.querySelector('.answer-feedback').remove(); return copy.outerHTML; });
    const initialStaff = await notation();
    assert.equal(await page.locator('#feedback > .keyboard-guidance-dismiss').count(), 1);
    const staffBounds = await staff.boundingBox();
    let previousPlacement;
    const initialCounts = await page.locator('#practice-counts').textContent();
    const initialData = await page.evaluate(() => localStorage.getItem('tunotes:data:v1'));
    for (let repeat = 0; repeat < 3; repeat++) {
      await page.keyboard.press(letter);
      assert.ok((await page.locator('.answer-feedback').textContent()).includes(`+ ${letter.toUpperCase()} for ${label}`), `Missing hint for ${pitch} on press ${repeat + 1}`);
      assert.equal(await page.locator('#practice-counts').textContent(), initialCounts);
      assert.equal(await notation(), initialStaff);
      assert.equal(await page.locator('#feedback > span').textContent(), '');
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) > 0.6);
      const placement = await staff.evaluate(svg => {
        const hint = svg.querySelector('.answer-feedback');
        const bounds = hint.getBoundingClientRect(), frame = svg.getBoundingClientRect();
        const notes = [...svg.querySelectorAll('.notehead, .note-accidental, .ledger')].map(note => note.getBoundingClientRect());
        return { transform: hint.getAttribute('transform'), opacity: Number(getComputedStyle(hint).opacity),
          overlaps: notes.some(note => bounds.left < note.right && bounds.right > note.left && bounds.top < note.bottom && bounds.bottom > note.top),
          contained: bounds.left >= frame.left && bounds.right <= frame.right && bounds.top >= frame.top && bounds.bottom <= frame.bottom };
      });
      assert.equal(placement.overlaps, false);
      assert.equal(placement.contained, true);
      assert.ok(placement.opacity <= 0.65);
      assert.notEqual(placement.transform, previousPlacement);
      previousPlacement = placement.transform;
      if (repeat === 0) {
        await mkdir('dist/validation', { recursive: true });
        await page.screenshot({ path: `dist/validation/notes-guidance-${name}-${pitch.replace('#', 'sharp')}.png` });
      }
      assert.deepEqual(await staff.boundingBox(), staffBounds);
      assert.equal(await page.getByRole('button', { name: 'Dismiss accidental reminders', exact: true }).isVisible(), true);
      assert.equal(await page.evaluate(() => localStorage.getItem('tunotes:data:v1')), initialData);
    }
    // A deliberate modifier immediately submits a correct answer, even for a natural.
    await page.keyboard.down(arrow); await page.keyboard.press(letter); await page.keyboard.up(arrow);
    assert.match(await page.locator('#practice-counts').textContent(), /1 correct \/ 1 attempts/);
    assert.equal(await page.locator('.answer-feedback').textContent(), 'Correct!');
    assert.equal(await page.getByRole('button', { name: 'Dismiss accidental reminders' }).isVisible(), false);
    await page.keyboard.press(letter);
    await page.getByRole('button', { name: 'Dismiss accidental reminders' }).click();
    assert.equal(await page.locator('.answer-feedback').textContent(), '');
    // Turning guidance off does not score the intercepted attempt retroactively.
    assert.match(await page.locator('#practice-counts').textContent(), /1 correct \/ 1 attempts/);
    await page.keyboard.press(letter);
    assert.match(await page.locator('#practice-counts').textContent(), /\/ 2 attempts/);
    assert.match(await page.locator('#practice-counts').textContent(), new RegExp(`${pitch === 'B4' ? 2 : 1} correct`));
    await page.reload();
    await notesMode(page, 'Options');
    assert.equal(await page.getByLabel('Keyboard accidental guidance', { exact: true }).isChecked(), false);
    await page.getByLabel('Keyboard accidental guidance', { exact: true }).check();
    await page.reload();
    await notesMode(page, 'Options');
    assert.equal(await page.getByLabel('Keyboard accidental guidance', { exact: true }).isChecked(), true);
    await notesMode(page, 'Practice');
    await page.getByRole('button', { name: 'Start Practice', exact: true }).click();
    await page.keyboard.press(letter);
    assert.match(await page.locator('#practice-counts').textContent(), /0 attempts/);
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) > 0.6);
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.answer-feedback')).opacity) === 0);
    assert.ok(await page.locator('.answer-feedback').evaluate(text => text.getAnimations()[0].currentTime >= 2500));
    assert.equal(await page.getByRole('button', { name: 'Dismiss accidental reminders', exact: true }).isVisible(), true);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(`${name}: flat, sharp and cancellation-natural hints repeat without attempts, prompt changes or saved learning; immediate correct retry; opt-out scores literally and progresses; preference and settings persist across reloads.`);
} finally { await browser.close(); await host.close(); }
