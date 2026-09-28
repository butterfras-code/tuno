import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';

const host = await hostBuild();
const origin = new URL(host.url).origin;
const release = JSON.parse(await readFile(new URL('../dist/release.json', import.meta.url), 'utf8'));
const browser = await (process.env.TUNO_BROWSER === 'firefox' ? firefox : chromium).launch();
try {
  const redirect = await fetch(origin, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), '/tune/');
  assert.equal((await fetch(origin + '/tune/missing.js')).status, 404);
  assert.equal((await fetch(origin + '/notes/missing.js')).status, 404);
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];
  page.on('response', (response) => { if (response.status() >= 400) failures.push(response.url()); });
  await page.goto(origin);
  assert.equal(page.url(), host.url);
  await page.getByText('Offline ready', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Offline ready', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller.scriptURL), origin + '/tune/sw.js');
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/tune/');
  assert.equal(manifest.scope, '/tune/');
  assert.equal(await page.evaluate(async () => !!await navigator.serviceWorker.getRegistration('/')), false);
  await page.goto(origin + '/notes/');
  assert.equal(await page.locator('h1').textContent(), 'tuNotes');
  await page.getByText('Offline ready', { exact: true }).waitFor();
  await page.reload();
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller.scriptURL), origin + '/notes/sw.js');
  await page.goto(host.url);
  await page.getByText('Offline ready', { exact: true }).waitFor();
  host.setAvailable(false);
  await context.setOffline(true);
  await page.reload();
  await page.getByText('Offline ready', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Play tone', exact: true }).click();
  await page.getByRole('button', { name: 'Stop tone', exact: true }).waitFor();
  assert.deepEqual(failures, []);
  await context.close();
  host.setAvailable(true);

  // Recreate the previous root deployment with the unchanged production worker
  // algorithm and correctly hashed resources, then deploy the new site in place.
  const current = new Map(host.files);
  const legacy = Object.fromEntries([...current].filter(([name]) => name.startsWith('tune/') && name !== 'tune/sw.js').map(([name, data]) => [name.slice(5), data]));
  legacy['manifest.webmanifest'] = Buffer.from(JSON.stringify({ ...manifest, id: './', start_url: './', scope: './', icons: manifest.icons.map((icon) => ({ ...icon, src: icon.src.replace('/tune/', './') })) }));
  const integrity = Object.fromEntries(['index.html', ...Object.keys(legacy).filter((name) => name !== 'index.html')].map((name) => [name, legacy[name]]).map(([name, data]) => [name, 'sha256-' + createHash('sha256').update(data).digest('base64')]));
  const template = await readFile(new URL('../src/distribution/service-worker.js', import.meta.url), 'utf8');
  host.files.set('_redirects', Buffer.from(''));
  for (const [name, data] of Object.entries(legacy)) host.files.set(name, data);
  host.files.set('sw.js', Buffer.from(template.replaceAll('__APP_ID__', 'tuno').replace('__EXCLUDED_PATHS__', '[]').replace('__BUILD_VERSION__', release.apps.tuno.build).replace('__RESOURCE_INTEGRITY__', JSON.stringify(integrity))));
  const old = await browser.newContext();
  const first = await old.newPage();
  await first.goto(origin);
  await first.waitForFunction(() => !!navigator.serviceWorker.controller);
  await first.getByText('Offline ready', { exact: true }).waitFor();
  await first.getByRole('button', { name: 'Play tone', exact: true }).waitFor();
  const second = await old.newPage();
  await second.goto(origin);
  await first.evaluate(async () => {
    localStorage.setItem('migration-preference', 'keep');
    await caches.open('sibling:keep');
  });
  host.setAvailable(false);
  await old.setOffline(true);
  await first.reload();
  await first.getByRole('button', { name: 'Play tone', exact: true }).click();
  await first.getByRole('button', { name: 'Stop tone', exact: true }).waitFor();
  host.setAvailable(true);
  await old.setOffline(false);
  host.files.clear();
  for (const [name, data] of current) host.files.set(name, data);
  await first.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await first.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.equal(await first.getByRole('button', { name: 'Stop tone', exact: true }).isVisible(), true);
  await first.close();
  assert.equal(await second.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), true);
  // A sibling tab opened before retirement is also an old root-worker client.
  const observer = await old.newPage();
  await observer.goto(origin + '/notes/');
  await second.close();
  // The legacy worker can control the notes tab until it closes too.
  await observer.close();
  const probe = await old.newPage();
  // The new tune worker claims this client; await retirement explicitly because
  // navigation can race the old worker's activation.
  await probe.goto(origin + '/tune/');
  await probe.getByText('Offline ready', { exact: true }).waitFor();
  await probe.waitForFunction(async () => !(await navigator.serviceWorker.getRegistrations()).some((r) => r.scope === location.origin + '/'));
  assert.equal(await probe.evaluate(() => localStorage.getItem('migration-preference')), 'keep');
  const keys = await probe.evaluate(() => caches.keys());
  assert.ok(keys.includes('sibling:keep'));
  assert.ok(!keys.some((key) => key.startsWith(`tuno:${origin}/:`)));
  assert.ok(keys.some((key) => key.startsWith(`tuno:${origin}/tune/:`)));
  await probe.goto(origin);
  assert.equal(probe.url(), host.url);
  await probe.goto(origin + '/notes/');
  await probe.reload();
  await probe.getByText('Offline ready', { exact: true }).waitFor();
  assert.equal(await probe.evaluate(() => navigator.serviceWorker.controller.scriptURL), origin + '/notes/sw.js');
  await probe.goto(host.url);
  await probe.getByText('Offline ready', { exact: true }).waitFor();
  host.setAvailable(false);
  await old.setOffline(true);
  await probe.reload();
  await probe.getByText('Offline ready', { exact: true }).waitFor();
  await old.close();
  console.log('Site routing, manifest identity, sibling isolation, offline playback, and deferred legacy root-worker retirement passed.');
} finally {
  await browser.close();
  await host.close();
}
