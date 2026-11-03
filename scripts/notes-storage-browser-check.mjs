import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { openData, notesMode, startPractice as startNewPractice, readyForAnswer, configureMultiplayerNotes } from './notes-setup-helpers.mjs';
import { readNotesData, waitNotesSaved } from './notes-storage-helpers.mjs';
import { primaryViewports } from './viewport-profiles.mjs';

const engine = process.env.TUNO_BROWSER || 'chromium';
const host = await hostBuild(), browser = await ({ chromium, firefox })[engine].launch();
const url = new URL('/notes/', host.url).href, output = `dist/validation/notes-storage-${engine}`;
const report = { engine, passed: false, checks: [], physicalDeviceChecks: 'not performed' }, errors = [];
const notice = page => page.getByRole('region', { name: 'Saving status' });
async function open(context) {
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.getByRole('navigation', { name: 'tuNotes modes' }).waitFor(); return page;
}
async function add(page, name) {
  await openData(page); await page.getByRole('button', { name: 'Add profile', exact: true }).click();
  await page.getByLabel('Profile name', { exact: true }).fill(name); await page.getByLabel('Profile name', { exact: true }).press('Enter'); await waitNotesSaved(page);
}
async function replace(page, data) {
  await openData(page); await page.locator('#import-backup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.getByRole('button', { name: 'Replace tuNotes data', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#import-preview').textContent === 'Changes saved.');
}
async function clear(page) {
  await openData(page); page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Delete all tuNotes data', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#profile').options[0].textContent === 'No saved profiles');
}
async function startPractice(page) {
  await notesMode(page, 'Practice');
  const edit = page.getByRole('button', { name: 'Edit setup', exact: true });
  if (await edit.isVisible()) await edit.click();
  await startNewPractice(page);
}
async function answer(page) { await readyForAnswer(page); await page.locator('.practice-play .answer:visible').first().click(); }
async function finish(page) { await page.getByRole('button', { name: 'Finish', exact: true }).first().click(); await waitNotesSaved(page); }
async function screenshot(page, name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
try {
  await mkdir(output, { recursive: true });
  const context = await browser.newContext();
  const [a, b] = await Promise.all([open(context), open(context)]);
  assert.equal(await notice(a).isVisible(), false); assert.equal(await notice(b).isVisible(), false);
  await Promise.all([add(a, 'Alice'), add(b, 'Bob')]);
  assert.deepEqual((await readNotesData(a)).profiles.map(p => p.name).sort(), ['Alice', 'Bob']);
  await Promise.all([startPractice(a), startPractice(b)]);
  await Promise.all([answer(a), answer(b)]);
  assert.equal((await readNotesData(a)).profiles.reduce((sum, p) => sum + p.results.length, 0), 0, 'one answer stays in memory');
  await Promise.all([finish(a), finish(b)]);
  let data = await readNotesData(a); assert.equal(data.profiles.reduce((sum, p) => sum + p.results.length, 0), 2);
  report.checks.push('Concurrent startup and profile edits save in both tabs; answers remain in memory; simultaneous finishes retain both results');

  // Both tabs use the same profile, preserving each tab's selection even when another tab changes it.
  const alice = data.profiles.find(p => p.name === 'Alice').id;
  for (const page of [a, b]) { await openData(page); await page.locator('#profile').selectOption(alice); await startPractice(page); }
  await Promise.all([answer(a), answer(b)]);
  await a.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await a.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await b.evaluate(() => document.dispatchEvent(new Event('freeze')));
  await Promise.all([answer(a), answer(b)]);
  await Promise.all([finish(a), finish(b)]);
  data = await readNotesData(a);
  assert.deepEqual(data.profiles.find(p => p.id === alice).results.map(r => r.attempts).sort(), [1, 2, 2]);
  assert.equal(await notice(a).isVisible(), false); assert.equal(await notice(b).isVisible(), false);
  report.checks.push('Same-profile overlapping rounds retain both results; lifecycle checkpoints become one final result each; restored pages keep saving without reload warnings');

  await startPractice(b); await answer(b);
  await openData(a); await a.locator('#profile').selectOption(alice);
  a.once('dialog', dialog => dialog.accept()); await a.getByRole('button', { name: 'Delete selected profile', exact: true }).click();
  await finish(b); assert.equal((await readNotesData(a)).profiles.some(p => p.id === alice), false);
  report.checks.push('Finishing a round after another tab deletes its profile cannot resurrect the profile');

  await openData(b); await startPractice(b); await answer(b);
  const imported = await readNotesData(a); imported.profiles[0].name = 'Imported'; const count = imported.profiles[0].results.length;
  await replace(a, imported); await finish(b);
  data = await readNotesData(a); assert.equal(data.profiles[0].name, 'Imported'); assert.equal(data.profiles[0].results.length, count);
  await startPractice(b); await answer(b); await clear(a); await finish(b);
  assert.equal((await readNotesData(a)).profiles.length, 0);
  await add(b, 'Fresh'); assert.equal((await readNotesData(a)).profiles[0].name, 'Fresh');
  await b.goto(new URL('/', host.url).href); await b.goBack(); await b.getByRole('navigation', { name: 'tuNotes modes' }).waitFor();
  assert.equal(await notice(b).isVisible(), false); assert.equal((await readNotesData(b)).profiles[0].name, 'Fresh');
  report.checks.push('Import and clear invalidate stale rounds even when IDs match; new work and real away/back navigation save normally');

  for (const profile of [...primaryViewports, { id: 'narrow', viewport: { width: 320, height: 900 } }]) {
    await b.setViewportSize(profile.viewport); await notesMode(b, 'Practice');
    await screenshot(b, `${profile.id}-setup`); await startPractice(b); await answer(b); await screenshot(b, `${profile.id}-playing`);
    await finish(b); await screenshot(b, `${profile.id}-results`); await openData(b); await screenshot(b, `${profile.id}-options`);
  }
  assert.equal((await readNotesData(b)).profiles[0].results.length, primaryViewports.length + 1, 'new profiles still remember progress after another tab clears data');
  await context.close();
  for (const behavior of ['denied', 'quota', 'corrupt']) {
    const fallback = await browser.newContext();
    await fallback.addInitScript(behavior => {
      if (behavior === 'denied') Object.defineProperty(window, 'indexedDB', { get() { throw new Error('denied'); } });
      if (behavior === 'quota') IDBObjectStore.prototype.put = () => { throw new DOMException('full', 'QuotaExceededError'); };
      if (behavior === 'corrupt') localStorage.setItem('tunotes:data:v1', '{broken');
    }, behavior);
    const page = await open(fallback); await add(page, 'Memory'); assert.equal(await notice(page).isVisible(), true);
    await notice(page).getByText('Progress recovery', { exact: true }).click();
    const download = page.waitForEvent('download'); await notice(page).getByRole('button', { name: 'Export this tab’s backup' }).click();
    const backup = JSON.parse(await readFile(await (await download).path(), 'utf8')); assert.equal(backup.profiles[0].name, 'Memory');
    for (const profile of [...primaryViewports, { id: 'narrow', viewport: { width: 320, height: 900 } }]) {
      await page.setViewportSize(profile.viewport); await screenshot(page, `${profile.id}-${behavior}`);
    }
    if (behavior === 'denied') {
      await page.setViewportSize({ width: 390, height: 844 }); await notesMode(page, 'Multi Player');
      await page.getByRole('button', { name: 'Add player', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
      await configureMultiplayerNotes(page); await page.getByRole('button', { name: 'Start round', exact: true }).click();
      await page.getByRole('group', { name: 'Play Style' }).getByRole('button', { name: 'Head to Head', exact: true }).click();
      await page.getByRole('button', { name: 'Continue to round', exact: true }).click();
      await page.locator('.multiplayer-round--head-to-head').waitFor();
      assert.equal(await notice(page).isVisible(), true); await screenshot(page, 'head-to-head-memory-390');
    }
    if (behavior === 'corrupt') {
      await clear(page); assert.equal(await notice(page).isVisible(), false);
      await add(page, 'Recovered'); assert.equal((await readNotesData(page)).profiles[0].name, 'Recovered');
    }
    await fallback.close();
  }
  report.checks.push('Storage denial, quota and corrupt legacy data keep play and backup export available; recovery details and activity screens fit primary profiles and existing narrow sizes');
  assert.deepEqual(errors, []); report.passed = true; console.log(JSON.stringify(report));
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); await host.close();
}
