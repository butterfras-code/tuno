import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { startPractice } from './notes-setup-helpers.mjs';

const engine = process.env.TUNO_BROWSER || 'chromium';
const host = await hostBuild();
const origin = new URL(host.url).origin;
const original = new Map(host.files);
const release = JSON.parse(await readFile(new URL('../dist/release.json', import.meta.url), 'utf8'));
const suiteBuild = /name="suite-version" content="([^"]+)"/.exec(original.get('index.html').toString())[1];
const builds = [...Object.values(release.apps).map(app => app.build), suiteBuild];
const digest = data => 'sha256-' + createHash('sha256').update(data).digest('base64');
function deploy(build, broken = false) {
  host.files.clear();
  for (const [name, bytes] of original) {
    let data = bytes;
    if (!name.endsWith('.png')) {
      let text = bytes.toString();
      for (const old of builds) text = text.replaceAll(old, build);
      data = Buffer.from(text);
    }
    host.files.set(name, data);
  }
  for (const worker of ['tune/sw.js', 'notes/sw.js', 'rhythm/sw.js', 'suite-sw.js']) {
    const prefix = worker.includes('/') ? worker.slice(0, worker.lastIndexOf('/') + 1) : '';
    let source = host.files.get(worker).toString();
    const old = /^const INTEGRITY = (.*);$/m.exec(source);
    const integrity = Object.fromEntries(Object.keys(JSON.parse(old[1])).map(name => [name, digest(host.files.get(prefix + name))]));
    if (broken && worker === 'tune/sw.js') integrity['app.css'] = digest('wrong fixture integrity');
    source = source.replace(old[0], `const INTEGRITY = ${JSON.stringify(integrity)};`);
    host.files.set(worker, Buffer.from(source));
  }
}
function restore() { host.files.clear(); for (const [name, bytes] of original) host.files.set(name, bytes); }
const browser = await ({ chromium, firefox })[engine].launch();
const notice = page => page.getByRole('region', { name: 'App update', exact: true });
async function manualCheck(page) {
  await page.getByRole('button', { name: 'About', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^About / });
  const check = dialog.getByRole('button', { name: 'Check for updates', exact: true });
  await check.click();
  await check.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.update-controls button').disabled);
  return dialog;
}
async function ready(page, route = '/tune/') {
  await page.goto(origin + route);
  await page.getByText('Offline ready', { exact: true }).waitFor();
}
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  assert.equal(await notice(page).count(), 0, 'No in-page update banner is rendered');
  let about = await manualCheck(page);
  await about.getByText('You’re up to date.', { exact: true }).waitFor();
  assert.match(await about.locator('.update-build').textContent(), new RegExp(release.apps.tuno.build));
  await page.keyboard.press('Escape');

  // Preserve real user preferences and storage across live reloads.
  await page.getByRole('button', { name: 'A4 = 440 Hz', exact: true }).click();
  const reference = page.getByRole('slider', { name: 'A4 reference (Hz)', exact: true });
  await reference.press('ArrowRight'); await reference.press('ArrowRight');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    localStorage.setItem('saved-update-progress', JSON.stringify({ correct: 12, attempts: 15 }));
    await caches.open('sibling:keep');
  });
  await page.getByRole('button', { name: 'Play tone', exact: true }).click();
  await page.getByRole('button', { name: 'Stop tone', exact: true }).waitFor();
  const other = await context.newPage(); await ready(other);

  deploy('update-ready-0002');
  about = await manualCheck(page);
  await about.getByText('A new version is ready. Reload to switch to it.', { exact: true }).waitFor();
  assert.equal(await notice(page).count(), 0, 'Background update never pops an in-page banner');
  assert.equal(await page.locator('meta[name="tuno-version"]').getAttribute('content'), release.apps.tuno.build);
  assert.equal(await page.getByRole('button', { name: 'Stop tone', exact: true }).isVisible(), true, 'Background update does not stop practice');

  // Reloading while another tab is open immediately switches to the live version without blocking.
  await about.getByRole('button', { name: 'Reload', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('meta[name="tuno-version"]').content === 'update-ready-0002');
  await page.getByText('Offline ready', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'A4 = 442 Hz', exact: true }).isVisible(), true);
  assert.equal(await page.evaluate(() => localStorage.getItem('saved-update-progress')), '{"correct":12,"attempts":15}');
  assert.ok((await page.evaluate(() => caches.keys())).includes('sibling:keep'));
  assert.equal(await page.getByRole('button', { name: 'Stop tone', exact: true }).count(), 0, 'No automatic playback after reload');
  await other.close();

  // Offline reload uses the updated verified cache, and manual check reports offline status.
  await context.setOffline(true); host.setAvailable(false);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('meta[name="tuno-version"]').content === 'update-ready-0002');
  await page.getByText('Offline ready', { exact: true }).waitFor();
  about = await manualCheck(page);
  await about.getByText('You’re offline. Reconnect to check for updates.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');

  // Reconnecting and deploying serves the live build immediately on navigation/reload without clicking Update.
  host.setAvailable(true); await context.setOffline(false);
  deploy('update-online-0003');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('meta[name="tuno-version"]').content === 'update-online-0003');
  await page.getByText('Offline ready', { exact: true }).waitFor();
  assert.equal(await notice(page).count(), 0);
  assert.deepEqual(errors, []);
  await context.close();

  // Every route receives live updates immediately on reload without an update button,
  // even when sibling tabs are open, and keeps offline fallback synced to the new build.
  for (const [route, id] of [['/', 'suite'], ['/tone/', 'suite'], ['/tempo/', 'suite'], ['/notes/', 'tunotes'], ['/rhythm/', 'rhythm']]) {
    restore();
    const isolated = await browser.newContext();
    const tool = await isolated.newPage();
    await ready(tool, route);
    const companion = route === '/' ? await isolated.newPage() : undefined;
    if (companion) await ready(companion, '/tempo/');
    const saved = await tool.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
    deploy('update-route-0004');
    await tool.reload();
    await tool.waitForFunction(({ id }) => document.querySelector(`meta[name="${id}-version"]`).content === 'update-route-0004', { id });
    await tool.getByText('Offline ready', { exact: true }).waitFor();
    assert.equal(new URL(tool.url()).pathname, route);
    assert.equal(await tool.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())), saved, route + ': saved data preserved');
    assert.equal(await notice(tool).count(), 0);
    // Verify the updated offline cache works offline right away.
    host.setAvailable(false); await isolated.setOffline(true);
    await tool.reload();
    await tool.waitForFunction(({ id }) => document.querySelector(`meta[name="${id}-version"]`).content === 'update-route-0004', { id });
    await tool.getByText('Offline ready', { exact: true }).waitFor();
    host.setAvailable(true); await isolated.setOffline(false);
    await isolated.close();
    console.log(`${engine}: ${route} live reload and offline sync passed`);
  }

  // Failed integrity keeps the previous verified offline cache intact.
  restore();
  const failed = await browser.newContext();
  const failedPage = await failed.newPage();
  await ready(failedPage);
  deploy('update-broken-0005', true);
  const failedDialog = await manualCheck(failedPage);
  await failedDialog.getByText('Couldn’t check or download the update. Try again when connected.', { exact: true }).waitFor();
  assert.equal(await failedDialog.getByRole('button', { name: 'Reload', exact: true }).count(), 0, 'Failed integrity must never offer Reload');
  await failedPage.keyboard.press('Escape');
  host.setAvailable(false); await failed.setOffline(true);
  await failedPage.reload();
  assert.equal(await failedPage.locator('meta[name="tuno-version"]').getAttribute('content'), release.apps.tuno.build, 'Previous verified cache survives failed integrity deploy');
  await failedPage.getByText('Offline ready', { exact: true }).waitFor();
  host.setAvailable(true); await failed.setOffline(false);
  await failed.close();

  // History navigation (/tune/ -> /tone/) still loads the live build on reload.
  restore();
  const navigation = await browser.newContext();
  const tune = await navigation.newPage(); await ready(tune);
  await tune.getByRole('link', { name: 'Reference tone', exact: true }).click();
  assert.equal(new URL(tune.url()).pathname, '/tone/');
  deploy('update-navigation-0006');
  await tune.reload();
  await tune.waitForFunction(() => document.querySelector('meta[name="tuno-version"]').content === 'update-navigation-0006');
  await tune.getByText('Offline ready', { exact: true }).waitFor();
  assert.equal(new URL(tune.url()).pathname, '/tone/');
  await navigation.close();

  // Evicted cache entries are repaired automatically on the next online load.
  restore();
  const evicted = await browser.newContext();
  const recovery = await evicted.newPage(); await ready(recovery);
  await recovery.evaluate(async () => {
    const cache = (await caches.keys()).find(key => key.startsWith('tuno:'));
    await (await caches.open(cache)).delete(new URL('app.css', location.href).href);
  });
  await evicted.setOffline(true); host.setAvailable(false);
  await recovery.evaluate(() => dispatchEvent(new Event('offline')));
  await recovery.getByText('Offline preparation incomplete · Reopen online to retry', { exact: true }).waitFor();
  host.setAvailable(true); await evicted.setOffline(false);
  await recovery.reload();
  await recovery.getByText('Offline ready', { exact: true }).waitFor();
  await evicted.close();

  // Active tuNotes round stays completely undisturbed when a new build deploys.
  restore();
  const practicing = await browser.newContext({ viewport: { width: 400, height: 550 } });
  const notes = await practicing.newPage(); await ready(notes, '/notes/');
  await startPractice(notes);
  const staff = await notes.locator('.staff').getAttribute('aria-label');
  const bounds = await notes.locator('.play-stage').boundingBox();
  deploy('update-practicing-0008');
  await notes.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await notes.waitForFunction(async () => (await caches.keys()).some(key => key.endsWith('update-practicing-0008')));
  assert.equal(await notice(notes).count(), 0, 'No update banner appears during or after practice');
  assert.equal(await notes.locator('.staff').getAttribute('aria-label'), staff, 'Background cache update preserves the current note');
  assert.ok(Math.abs((await notes.locator('.play-stage').boundingBox()).height - bounds.height) < 1, 'Background cache update does not shrink notation or answers');
  await practicing.close();

  console.log(`${engine}: network-first live loads across all routes, silent background cache updates without interrupting practice, About check/reload, offline fallback, failed integrity preservation, and cache recovery passed`);
} finally {
  await browser.close(); await host.close();
}
