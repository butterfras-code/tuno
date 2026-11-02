import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { viewportProfiles } from './viewport-profiles.mjs';
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
const output = `dist/validation/updates-${engine}`;
await mkdir(output, { recursive: true });
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
  await page.reload();
  await page.getByText('Offline ready', { exact: true }).waitFor();
}
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  assert.equal(await notice(page).count(), 0);
  let about = await manualCheck(page);
  await about.getByText('You’re up to date.', { exact: true }).waitFor();
  assert.match(await about.locator('.update-build').textContent(), new RegExp(release.apps.tuno.build));
  await page.keyboard.press('Escape');
  // Use a real preference, not just a synthetic storage marker.
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
  await about.getByText('A new version is ready.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await notice(page).waitFor(); await notice(other).waitFor();
  assert.equal(await page.locator('meta[name="tuno-version"]').getAttribute('content'), release.apps.tuno.build);
  assert.equal(await page.getByRole('button', { name: 'Stop tone', exact: true }).isVisible(), true, 'Download does not stop practice');
  await notice(page).getByRole('button', { name: 'Update and reload', exact: true }).click();
  await notice(page).getByText(/Close other tabs or app windows/).waitFor();
  assert.equal(await page.locator('meta[name="tuno-version"]').getAttribute('content'), release.apps.tuno.build);
  assert.equal(await other.locator('meta[name="tuno-version"]').getAttribute('content'), release.apps.tuno.build);
  assert.equal(await page.getByRole('button', { name: 'Stop tone', exact: true }).isVisible(), true);
  // Long blocking guidance and controls remain usable at every standard size.
  for (const profile of viewportProfiles) {
    await page.setViewportSize(profile.viewport);
    await notice(page).scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), profile.id + ': overflow');
    assert.ok(await notice(page).evaluate(node => Math.abs(node.getBoundingClientRect().width - node.parentElement.getBoundingClientRect().width) <= 1), profile.id + ': notice spans header');
    for (const button of await notice(page).getByRole('button').all()) {
      const box = await button.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= profile.viewport.width + 1 && box.height >= 47.99, `${profile.id}: notice target ${JSON.stringify(box)}`);
    }
    await page.screenshot({ path: `${output}/${profile.id}-notice.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.style.zoom = '2');
  assert.ok(await notice(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'Notice fits at 200% CSS zoom');
  await page.screenshot({ path: `${output}/phone-zoom-notice.png` });
  await page.evaluate(() => document.documentElement.style.zoom = '');
  await notice(page).getByRole('button', { name: 'Later', exact: true }).click();
  assert.equal(await notice(page).count(), 0);
  assert.equal(await page.locator('h1').evaluate(node => node === document.activeElement), true);
  about = await manualCheck(page);
  await about.getByRole('button', { name: 'Update and reload', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await notice(page).waitFor();
  await other.close();
  // A separately controlled sibling must neither block nor reload.
  const sibling = await context.newPage(); await ready(sibling, '/notes/');
  await page.locator('button', { hasText: 'Stop all audio' }).evaluate(node => node.click());
  await context.setOffline(true); host.setAvailable(false);
  await page.bringToFront();
  await notice(page).getByRole('button', { name: 'Update and reload', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('meta[name="tuno-version"]').content === 'update-ready-0002');
  await page.getByText('Offline ready', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'A4 = 442 Hz', exact: true }).isVisible(), true);
  assert.equal(await page.evaluate(() => localStorage.getItem('saved-update-progress')), '{"correct":12,"attempts":15}');
  assert.ok((await page.evaluate(() => caches.keys())).includes('sibling:keep'));
  assert.equal(await page.getByRole('button', { name: 'Stop tone', exact: true }).count(), 0, 'No automatic playback after reload');
  assert.equal(await sibling.locator('meta[name="tunotes-version"]').getAttribute('content'), 'update-ready-0002');
  about = await manualCheck(page);
  await about.getByText('You’re offline. Reconnect to check for updates.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  host.setAvailable(true); await context.setOffline(false);
  // Reconnection detects a release without a manual .update() or navigation.
  await context.setOffline(true);
  deploy('update-online-0003');
  await context.setOffline(false);
  await page.bringToFront();
  await notice(page).waitFor();
  assert.equal(await page.locator('meta[name="tuno-version"]').getAttribute('content'), 'update-ready-0002');
  assert.deepEqual(errors, []);
  await context.close();

  // Each visible app uses its own worker; aliases and launcher use the suite.
  for (const [route, id] of [['/', 'suite'], ['/tone/', 'suite'], ['/tempo/', 'suite'], ['/notes/', 'tunotes'], ['/rhythm/', 'rhythm']]) {
    restore();
    const isolated = await browser.newContext();
    const tool = await isolated.newPage();
    await ready(tool, route);
    const blocker = route === '/' ? await isolated.newPage() : undefined;
    if (blocker) await ready(blocker, '/tempo/');
    deploy('update-route-0004');
    const dialog = await manualCheck(tool);
    await dialog.getByText('A new version is ready.', { exact: true }).waitFor();
    if (blocker) {
      await dialog.getByRole('button', { name: 'Update and reload', exact: true }).click();
      await dialog.getByText(/Close other tabs or app windows/).waitFor();
      assert.equal(await blocker.locator('meta[name="suite-version"]').getAttribute('content'), suiteBuild);
      await blocker.close();
    }
    await tool.keyboard.press('Escape');
    for (const profile of viewportProfiles) {
      await tool.setViewportSize(profile.viewport);
      await notice(tool).scrollIntoViewIfNeeded();
      assert.ok(await tool.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} ${profile.id}: pending notice overflow`);
      const bounds = await notice(tool).boundingBox();
      assert.ok(bounds.width >= profile.viewport.width * .5, `${route} ${profile.id}: notice readable width`);
      await tool.screenshot({ path: `${output}/${route.replaceAll('/', '') || 'launcher'}-${profile.id}-notice.png` });
    }
    const saved = await tool.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
    await tool.getByRole('button', { name: 'About', exact: true }).click();
    await dialog.getByRole('button', { name: 'Update and reload', exact: true }).click();
    await tool.waitForFunction(({ id }) => document.querySelector(`meta[name="${id}-version"]`).content === 'update-route-0004', { id });
    await tool.getByText('Offline ready', { exact: true }).waitFor();
    assert.equal(new URL(tool.url()).pathname, route);
    assert.equal(await tool.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())), saved, route + ': saved data preserved');
    await isolated.close();
    console.log(`${engine}: ${route} update and reload passed`);
  }

  restore();
  const failed = await browser.newContext();
  const failedPage = await failed.newPage();
  await ready(failedPage);
  deploy('update-broken-0005', true);
  const failedDialog = await manualCheck(failedPage);
  await failedDialog.getByText('Couldn’t check or download the update. Try again when connected.', { exact: true }).waitFor();
  assert.equal(await notice(failedPage).count(), 0, 'Failed integrity must never offer an update');
  assert.equal(await failedPage.locator('meta[name="tuno-version"]').getAttribute('content'), release.apps.tuno.build);
  await failed.close();

  // History navigation keeps the tune document alive outside /tune/. Updating
  // only its directory worker would reload the older root-cached Tone page.
  restore();
  const navigation = await browser.newContext();
  const tune = await navigation.newPage(); await ready(tune);
  const tempo = await navigation.newPage(); await ready(tempo, '/tempo/');
  await tune.getByRole('link', { name: 'Reference tone', exact: true }).click();
  assert.equal(new URL(tune.url()).pathname, '/tone/');
  deploy('update-navigation-0006');
  const navigationDialog = await manualCheck(tune);
  await navigationDialog.getByText('A new version is ready.', { exact: true }).waitFor();
  await navigationDialog.getByRole('button', { name: 'Update and reload', exact: true }).click();
  await navigationDialog.getByText(/Close other tabs or app windows/).waitFor();
  assert.equal(await tune.locator('meta[name="tuno-version"]').getAttribute('content'), release.apps.tuno.build);
  assert.equal(await tune.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/tune/')).waiting), true, 'Both scopes stay unchanged when preflight blocks');
  await tempo.close();
  await navigationDialog.getByRole('button', { name: 'Update and reload', exact: true }).click();
  await tune.waitForFunction(() => document.querySelector('meta[name="tuno-version"]').content === 'update-navigation-0006');
  await tune.getByText('Offline ready', { exact: true }).waitFor();
  assert.equal(new URL(tune.url()).pathname, '/tone/');
  await navigation.close();

  // An installed update can lose cached files to storage eviction. Keep the
  // old worker when offline; repair and apply on a later connected retry.
  restore();
  const evicted = await browser.newContext();
  const recovery = await evicted.newPage(); await ready(recovery);
  deploy('update-recovery-0007');
  const recoveryDialog = await manualCheck(recovery);
  await recoveryDialog.getByText('A new version is ready.', { exact: true }).waitFor();
  await evicted.setOffline(true); host.setAvailable(false);
  await recovery.evaluate(async () => {
    const cache = (await caches.keys()).find(key => key.startsWith('tuno:') && key.endsWith('update-recovery-0007'));
    await (await caches.open(cache)).delete(new URL('app.css', location.href).href);
  });
  await recoveryDialog.getByRole('button', { name: 'Update and reload', exact: true }).click();
  await recoveryDialog.getByText('Couldn’t apply the update. Try again, or close this tool’s tabs and reopen it online.', { exact: true }).waitFor();
  assert.equal(await recovery.locator('meta[name="tuno-version"]').getAttribute('content'), release.apps.tuno.build);
  host.setAvailable(true); await evicted.setOffline(false);
  await recoveryDialog.getByRole('button', { name: 'Update and reload', exact: true }).click();
  await recovery.waitForFunction(() => document.querySelector('meta[name="tuno-version"]').content === 'update-recovery-0007');
  await recovery.getByText('Offline ready', { exact: true }).waitFor();
  await evicted.close();

  restore();
  const practicing = await browser.newContext({ viewport: { width: 400, height: 550 } });
  const notes = await practicing.newPage(); await ready(notes, '/notes/');
  await startPractice(notes);
  const staff = await notes.locator('.staff').getAttribute('aria-label');
  const bounds = await notes.locator('.play-stage').boundingBox();
  deploy('update-practicing-0008');
  await notes.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await notes.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.equal(await notice(notes).isVisible(), false, 'A round keeps the full fitted play area');
  assert.equal(await notes.locator('.staff').getAttribute('aria-label'), staff, 'Downloading preserves the current note');
  assert.ok(Math.abs((await notes.locator('.play-stage').boundingBox()).height - bounds.height) < 1, 'Download does not shrink notation or answers');
  await notes.getByRole('button', { name: 'Finish', exact: true }).first().click();
  await notice(notes).waitFor();
  await notes.screenshot({ path: `${output}/notes-results-pending-update.png` });
  await practicing.close();
  console.log(`${engine}: manual checks, download without interruption, Later, multi-tab guard, offline activation, saved data, reconnection, worker scopes, failed integrity, and responsive notices passed`);
} finally {
  await browser.close(); await host.close();
}
