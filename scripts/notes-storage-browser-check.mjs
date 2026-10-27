import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { openData, notesMode, setPacing, startPractice, configureMultiplayerNotes } from './notes-setup-helpers.mjs';

const engine = process.env.TUNO_BROWSER || 'chromium';
const host = await hostBuild(), browser = await ({ chromium, firefox })[engine].launch();
const url = new URL('/notes/', host.url).href;
const key = 'tunotes:data:v1';
const output = `dist/validation/notes-storage-${engine}`;
const report = { engine, passed: false, checks: [], physicalDeviceChecks: 'not performed' };
const errors = [];
const notice = page => page.getByRole('region', { name: 'Saving status' });
const snapshot = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const names = async page => (await snapshot(page))?.profiles.map(p => p.name) ?? [];
async function open(context) {
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.getByRole('navigation', { name: 'tuNotes modes' }).waitFor(); return page;
}
async function add(page, name) {
  await openData(page); await page.getByRole('button', { name: 'Add profile', exact: true }).click();
  await page.getByLabel('Profile name', { exact: true }).fill(name);
  await page.getByLabel('Profile name', { exact: true }).press('Enter');
}
async function backup(page) {
  const download = page.waitForEvent('download');
  await notice(page).getByRole('button', { name: 'Export this tab’s backup', exact: true }).click();
  return JSON.parse(await readFile(await (await download).path(), 'utf8'));
}
async function replace(page, data) {
  await openData(page);
  await page.locator('#import-backup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.getByRole('button', { name: 'Replace tuNotes data', exact: true }).click();
}
async function clear(page) {
  await openData(page); page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete all tuNotes data', exact: true }).click();
}
try {
  await mkdir(output, { recursive: true });
  const context = await browser.newContext();
  const a = await open(context), b = await open(context);
  assert.equal(await notice(a).isVisible(), false);
  assert.match(await notice(b).textContent(), /Another tuNotes tab/);
  await add(a, 'Alice');
  await setPacing(b, 'Correct Only'); await add(b, 'Bob');
  assert.deepEqual(await names(a), ['Alice']);
  assert.deepEqual((await backup(b)).profiles.map(p => p.name), ['Bob']);
  b.once('dialog', dialog => dialog.dismiss());
  await notice(b).getByRole('button', { name: 'Reload saved data' }).click();
  assert.deepEqual((await backup(b)).profiles.map(p => p.name), ['Bob']);
  for (const mode of ['Practice', 'Challenge', 'Multi Player', 'Options']) {
    await notesMode(b, mode); assert.equal(await notice(b).isVisible(), true);
  }
  await b.setViewportSize({ width: 320, height: 900 });
  await notesMode(b, 'Practice');
  assert.equal(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await b.screenshot({ path: `${output}/memory-only-320.png`, fullPage: true });
  await startPractice(b);
  assert.equal(await notice(b).isVisible(), true);
  await b.locator('.practice-play .answer:visible').first().click();
  assert.deepEqual(await names(a), ['Alice']);
  report.checks.push('Two real tabs: stale settings/profiles/practice cannot overwrite Alice; recovery export preserves Bob; cancelled reload preserves memory; notice available in every mode and at 320px');

  const imported = await snapshot(a); imported.profiles[0].name = 'Imported';
  await replace(a, imported);
  await b.getByRole('button', { name: 'Finish', exact: true }).first().click();
  await b.setViewportSize({ width: 390, height: 844 });
  await notesMode(b, 'Multi Player');
  await b.getByRole('button', { name: 'Add player', exact: true }).click();
  await b.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await configureMultiplayerNotes(b);
  await b.getByRole('button', { name: 'Start round', exact: true }).click();
  await b.getByRole('group', { name: 'Play Style' }).getByRole('button', { name: 'Head to Head', exact: true }).click();
  await b.getByRole('button', { name: 'Continue to round', exact: true }).click();
  await b.locator('.multiplayer-round--head-to-head').waitFor();
  assert.equal(await notice(b).isVisible(), true);
  assert.ok((await backup(b)).profiles.some(p => p.name === 'Bob'));
  assert.equal(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await b.screenshot({ path: `${output}/head-to-head-memory-390.png`, fullPage: true });
  await b.getByRole('button', { name: 'End round', exact: true }).click();
  report.checks.push('Head-to-head play retains visible, usable recovery controls at 390px');
  await replace(b, { ...imported, profiles: imported.profiles.map(p => ({ ...p, name: 'Memory import' })) });
  assert.deepEqual(await names(a), ['Imported']);
  await clear(b); assert.deepEqual(await names(a), ['Imported']);
  await add(b, 'Only in B');
  await clear(a); assert.deepEqual(await names(a), []);
  await setPacing(b, 'Normal'); assert.deepEqual(await names(a), []);
  await replace(a, imported);
  await a.close();
  await add(b, 'Still in memory'); assert.deepEqual(await names(b), ['Imported']);
  b.once('dialog', dialog => dialog.accept());
  await notice(b).getByRole('button', { name: 'Reload saved data' }).click();
  await b.waitForFunction(() => document.querySelector('.notes-saving-notice')?.hidden === true);
  await add(b, 'Carol'); assert.deepEqual(await names(b), ['Imported', 'Carol']);
  await b.reload(); await b.getByRole('navigation', { name: 'tuNotes modes' }).waitFor();
  assert.equal(await notice(b).isVisible(), false);
  assert.deepEqual(await names(b), ['Imported', 'Carol']);
  report.checks.push('Import and clear survive stale edits; stale clear is memory-only; closing owner does not promote stale tab; explicit reload reads current data and resumes saving');

  // Exercise lifecycle handlers deterministically; this is not physical BFCache/freeze acceptance.
  await b.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await b.waitForFunction(() => !document.querySelector('.notes-saving-notice').hidden);
  const c = await open(context); assert.equal(await notice(c).isVisible(), false);
  await clear(c);
  await b.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await add(b, 'Restored'); assert.deepEqual(await names(c), []);
  assert.ok((await backup(b)).profiles.some(p => p.name === 'Restored'));
  await c.evaluate(() => document.dispatchEvent(new Event('freeze')));
  const d = await open(context); assert.equal(await notice(d).isVisible(), false);
  await add(d, 'Fresh'); await add(c, 'Resumed'); assert.deepEqual(await names(d), ['Fresh']);
  // Real navigation/reopening validates normal release and startup, regardless of BFCache eligibility.
  await d.goto(new URL('/', host.url).href); await d.goBack();
  await d.getByRole('navigation', { name: 'tuNotes modes' }).waitFor();
  assert.deepEqual(await names(d), ['Fresh']);
  report.checks.push('Synthetic pagehide/pageshow and freeze revoke saving permanently; fresh tabs take ownership; real away/back navigation retains persisted data');
  await context.close();

  const racing = await browser.newContext();
  const pages = await Promise.all([open(racing), open(racing)]);
  const owners = await Promise.all(pages.map(async p => !(await notice(p).isVisible())));
  assert.equal(owners.filter(Boolean).length, 1);
  await Promise.all(pages.map((p, i) => add(p, `Racer ${i}`)));
  assert.deepEqual(await names(pages[0]), [`Racer ${owners.indexOf(true)}`]);
  await racing.close();
  report.checks.push('Simultaneous page startup grants exactly one writer; concurrent UI edits retain only that writer’s durable changes');

  for (const behavior of ['missing', 'rejected', 'quota', 'corrupt']) {
    const fallback = await browser.newContext();
    await fallback.addInitScript(({ key, behavior }) => {
      if (behavior === 'missing') Object.defineProperty(navigator, 'locks', { value: undefined });
      if (behavior === 'rejected') Object.defineProperty(navigator, 'locks', { value: { request: () => Promise.reject(new Error('denied')) } });
      if (behavior === 'quota') Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
      if (behavior === 'corrupt') localStorage.setItem(key, '{broken');
    }, { key, behavior });
    const page = await open(fallback); await add(page, 'Memory');
    assert.equal(await notice(page).isVisible(), true);
    assert.deepEqual((await backup(page)).profiles.map(p => p.name), ['Memory']);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), behavior === 'corrupt' ? '{broken' : null);
    if (behavior === 'corrupt') {
      await clear(page); assert.equal(await notice(page).isVisible(), false);
      await add(page, 'Recovered'); assert.deepEqual(await names(page), ['Recovered']);
    }
    await fallback.close();
  }
  report.checks.push('Missing/rejected locks, full storage, and corrupt data preserve exportable memory; corrupt storage is recoverable by explicit owner deletion');
  assert.deepEqual(errors, []); report.passed = true;
  console.log(JSON.stringify(report));
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await host.close();
}
