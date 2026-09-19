import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const root = new URL('../dist/hosted/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const version = /name="tuno-version" content="([^"]+)"/.exec(html)[1];
let revision = version;
let failCss = false;
let online = true;
const resources = new Map(await Promise.all((await readdir(root)).map(async (name) => [name, await readFile(new URL(name, root))])));
const server = createServer((request, response) => {
  if (!online) { response.destroy(); return; }
  const name = request.url === '/practice/' ? 'index.html' : request.url.replace('/practice/', '').replace(revision, version);
  if (!resources.has(name)) { response.writeHead(404).end(); return; }
  if (failCss && name === 'app.css') { response.writeHead(503).end(); return; }
  response.writeHead(200, { 'Content-Type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : name.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html', 'Cache-Control': 'no-cache' });
  let contents = name.endsWith('.png') ? resources.get(name) : resources.get(name).toString().replaceAll(version, revision);
  if (name === 'sw.js') {
    const digest = (text) => createHash('sha256').update(text).digest('base64');
    for (const [file, data] of resources) {
      if (file === 'sw.js' || file.endsWith('.png')) continue;
      contents = contents.replace(digest(data), digest(data.toString().replaceAll(version, revision)));
    }
  }
  response.end(contents);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await (process.env.TUNO_BROWSER === 'firefox' ? firefox : chromium).launch();
  const url = `http://127.0.0.1:${server.address().port}/practice/`;
  const context = await browser.newContext();
  let page = await context.newPage();
  await page.goto(url);
  await page.getByText('Offline ready', { exact: true }).waitFor();
  await page.evaluate(() => caches.open('tuno:unrelated-scope:keep'));
  await page.getByRole('button', { name: 'Play tone', exact: true }).click();
  await page.getByRole('button', { name: 'Stop tone', exact: true }).waitFor();
  revision = 'test-update-0002';
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
  await page.waitForFunction(() => document.querySelector('#offline-status').textContent.includes('Update downloaded'));
  assert.equal(await page.getByRole('button', { name: 'Stop tone', exact: true }).isVisible(), true);
  assert.equal(await page.locator('meta[name="tuno-version"]').getAttribute('content'), version);
  const other = await context.newPage();
  await other.goto(url);
  await other.getByText(/Update downloaded/).waitFor();
  await page.getByRole('button', { name: 'Stop all audio' }).click();
  await page.close();
  assert.equal(await other.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), true, 'Another open tab must keep the update waiting');
  await other.close();
  online = false;
  await context.setOffline(true);
  page = await context.newPage();
  await page.goto(url);
  await page.getByText('Offline ready', { exact: true }).waitFor();
  assert.equal(await page.locator('meta[name="tuno-version"]').getAttribute('content'), revision);
  assert.ok((await page.evaluate(() => caches.keys())).includes('tuno:unrelated-scope:keep'));
  await page.evaluate(async () => {
    const keys = await caches.keys();
    const key = keys.find((key) => key.endsWith('test-update-0002'));
    await (await caches.open(key)).delete(new URL('app.js', location.href).href);
    dispatchEvent(new Event('offline'));
  });
  await page.getByText('Offline preparation incomplete · Reopen online to retry', { exact: true }).waitFor();
  online = true;
  await context.setOffline(false);
  await page.reload();
  await page.getByText('Offline ready', { exact: true }).waitFor();
  await context.close();

  failCss = true;
  const failed = await browser.newContext();
  const brokenPage = await failed.newPage();
  await brokenPage.goto(url);
  await brokenPage.getByText('Offline preparation failed · Reopen online to retry', { exact: true }).waitFor();
  assert.equal(await brokenPage.getByText('Offline ready', { exact: true }).count(), 0);
  assert.equal((await brokenPage.evaluate(() => caches.keys())).length, 0, 'Failed installation must discard its partial cache');
  await failed.close();
  console.log('Hosted offline: update waits across active tabs, activates after closure, reopens offline, preserves other scopes, detects missing cache, and reports failed installation.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
