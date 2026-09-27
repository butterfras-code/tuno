import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, copyFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build } from 'esbuild';
import { contentType } from './test-host.mjs';

const browserName = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[browserName].launch({ headless: true });
const temporary = await mkdtemp(join(tmpdir(), 'tunotes-portable-'));
const release = JSON.parse(await readFile(new URL('../dist/release.json', import.meta.url), 'utf8'));
let blockNotesWorker = true;
let online = true;
const server = createServer(async (request, response) => {
  if (!online) { response.destroy(); return; }
  const url = new URL(request.url, 'http://localhost');
  let name = url.pathname.replace(/^\/(?:nested\/classroom\/)?/, '');
  if (name.endsWith('/') || !name) name += 'index.html';
  if (blockNotesWorker && name === 'notes/sw.js') { response.writeHead(503).end(); return; }
  try {
    const bytes = await readFile(new URL(`../dist/hosted/${name}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': contentType(name), 'Cache-Control': 'no-store' }).end(bytes);
  } catch { response.writeHead(404).end('Missing resource'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
const ready = page => page.waitForFunction(() => document.querySelector('#offline-status')?.textContent === 'Offline ready');
try {
  const fixture = await build({ stdin: { contents: "import { animatedUno } from './src/shared/ui/uno.ts'; import { onUnmount } from './src/shared/ui/unmount.ts'; window.makeUno = animatedUno; window.onUnmount = onUnmount;", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', loader: { '.svg': 'dataurl' } });
  const lifecycle = await browser.newPage();
  await lifecycle.goto('about:blank');
  await lifecycle.addScriptTag({ content: fixture.outputFiles[0].text });
  for (let mount = 0; mount < 3; mount++) {
    await lifecycle.evaluate(() => { window.dog = window.makeUno(); document.body.append(window.dog.node); window.dog.nod(); });
    assert.ok(await lifecycle.evaluate(() => window.dog.node.getAnimations({ subtree: true }).length > 0));
    await lifecycle.evaluate(() => { window.dog.dispose(); window.dog.dispose(); window.dog.node.remove(); });
    assert.equal(await lifecycle.evaluate(() => window.dog.node.getAnimations({ subtree: true }).length), 0);
  }
  const disposal = await lifecycle.evaluate(async () => {
    const counts = { immediate: 0, ancestor: 0, moved: 0, cancelled: 0 };
    const tick = () => new Promise(resolve => queueMicrotask(resolve));
    const immediate = document.createElement('div');
    window.onUnmount(immediate, () => counts.immediate++);
    document.body.append(immediate);
    immediate.remove();
    const ancestor = document.createElement('div');
    const child = document.createElement('div');
    ancestor.append(child);
    window.onUnmount(child, () => counts.ancestor++);
    document.body.append(ancestor);
    ancestor.remove();
    ancestor.replaceChildren();
    const moved = document.createElement('div');
    const destination = document.createElement('section');
    document.body.append(destination);
    window.onUnmount(moved, () => counts.moved++);
    document.body.append(moved);
    destination.append(moved);
    const cancelled = document.createElement('div');
    const stop = window.onUnmount(cancelled, () => counts.cancelled++);
    document.body.append(cancelled);
    stop();
    cancelled.remove();
    await tick();
    const beforeRemoval = { ...counts };
    moved.remove();
    await tick();
    // A later remount must not trigger an already-disposed observer again.
    document.body.append(immediate, moved);
    immediate.remove(); moved.remove(); destination.remove();
    await tick();
    return { beforeRemoval, afterRemoval: counts };
  });
  assert.deepEqual(disposal.beforeRemoval, { immediate: 1, ancestor: 1, moved: 0, cancelled: 0 });
  assert.deepEqual(disposal.afterRemoval, { immediate: 1, ancestor: 1, moved: 1, cancelled: 0 });
  await lifecycle.close();
  results.push('Immediate and ancestor unmount dispose once; connected moves and cancelled observers do not dispose');
  results.push('Repeated Uno mount/dispose cancels active animations and is idempotent');
  for (const [id, title] of [['tuno', 'tUno'], ['tunotes', 'tuNotes']]) {
    const file = join(temporary, `${id}-renamed.html`);
    await copyFile(new URL(`../dist/portable/${id}.html`, import.meta.url), file);
    const context = await browser.newContext({ offline: true });
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(file).href);
    assert.equal(await page.locator('h1').textContent(), title);
    assert.equal(await page.locator('#offline-status').textContent(), 'Self-contained offline file');
    assert.equal(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('18px Nunito'))), true);
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    await context.close();
    results.push(`${id}: moved standalone file cold-opens offline without network requests`);
  }
  for (const prefix of ['/', '/nested/classroom/']) {
    blockNotesWorker = true;
    const context = await browser.newContext({ acceptDownloads: true });
    // Count reduced-motion listener registrations/removals to catch detached Uno leaks.
    await context.addInitScript(() => {
      if (location.search === '?without-worker') navigator.serviceWorker.register = () => Promise.reject(new Error('Child worker unavailable in first-visit fixture'));
      const match = window.matchMedia.bind(window);
      window.unoListeners = 0;
      window.matchMedia = query => {
        const media = match(query);
        const add = media.addEventListener.bind(media), remove = media.removeEventListener.bind(media);
        media.addEventListener = (...args) => { if (query.includes('prefers-reduced-motion')) window.unoListeners++; add(...args); };
        media.removeEventListener = (...args) => { if (query.includes('prefers-reduced-motion')) window.unoListeners--; remove(...args); };
        return media;
      };
    });
    const tuner = await context.newPage();
    await tuner.goto(origin + prefix);
    await ready(tuner);
    const before = await tuner.evaluate(() => caches.keys());
    assert.equal(before.length, 1);
    assert.ok(before[0].startsWith(`tuno:${origin}${prefix}:`));
    await tuner.evaluate(() => localStorage.setItem('tuno-test-sentinel', 'preserve'));
    const notes = await context.newPage();
    await notes.goto(origin + prefix);
    await ready(notes);
    await notes.goto(origin + prefix + 'notes/?without-worker');
    await notes.waitForFunction(() => document.querySelector('#offline-status')?.textContent.includes('failed'));
    assert.equal(await notes.locator('h1').textContent(), 'tuNotes');
    const initialController = await notes.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null);
    if (browserName === 'chromium') assert.equal(initialController, origin + prefix + 'sw.js');
    else assert.ok(initialController === null || initialController === origin + prefix + 'sw.js');
    const rootFetch = await tuner.evaluate(async () => {
      const html = await (await fetch('./notes/')).text();
      return { html, missing: (await fetch('./notes/missing.js')).status, controller: navigator.serviceWorker.controller.scriptURL };
    });
    assert.equal(rootFetch.controller, origin + prefix + 'sw.js');
    assert.ok(rootFetch.html.includes('<title>tuNotes'));
    assert.equal(rootFetch.missing, 404);
    assert.deepEqual(await notes.evaluate(() => caches.keys()), before, 'Root worker does not cache notes or claim its readiness');
    assert.equal(await notes.evaluate(async () => (await fetch('./missing.js')).status), 404);
    blockNotesWorker = false;
    await notes.goto(origin + prefix + 'notes/');
    await ready(notes);
    assert.equal(await notes.evaluate(() => navigator.serviceWorker.controller.scriptURL), origin + prefix + 'notes/sw.js');
    const keys = await notes.evaluate(() => caches.keys());
    assert.equal(keys.length, 2);
    assert.ok(keys.includes(before[0]));
    assert.ok(keys.some(key => key.startsWith(`tunotes:${origin}${prefix}notes/:`)));
    const manifests = await notes.evaluate(async base => Promise.all([base, base + 'notes/'].map(async base => {
      const manifest = await (await fetch(base + 'manifest.webmanifest')).json();
      return { name: manifest.short_name, id: new URL(manifest.id, location.origin + base).href };
    })), prefix);
    assert.notEqual(manifests[0].id, manifests[1].id);
    assert.deepEqual(manifests.map(item => item.name), ['tUno', 'tuNotes']);
    // Prove each worker deletes only stale caches for its own app and scope.
    await notes.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const own = registrations.find(item => item.scope.endsWith('/notes/'));
      await caches.open(`tunotes:${own.scope}:obsolete`);
      await caches.open('unrelated-cache');
      await own.unregister();
    });
    await notes.close();
    const reopened = await context.newPage();
    await reopened.goto(origin + prefix + 'notes/');
    await ready(reopened);
    const retained = await reopened.evaluate(() => caches.keys());
    assert.ok(retained.includes(before[0]));
    assert.ok(retained.includes('unrelated-cache'));
    assert.ok(!retained.some(key => key.endsWith(':obsolete')));
    await reopened.evaluate(() => caches.delete('unrelated-cache'));
    online = false;
    await context.setOffline(true);
    await tuner.reload();
    await reopened.reload();
    await ready(tuner); await ready(reopened);
    assert.equal(await tuner.locator('h1').textContent(), 'tUno');
    assert.equal(await reopened.locator('h1').textContent(), 'tuNotes');
    const downloadEvent = reopened.waitForEvent('download');
    await reopened.getByRole('link', { name: 'Download offline HTML' }).click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), `tunotes-${release.apps.tunotes.build}.html`);
    const downloaded = join(temporary, download.suggestedFilename());
    await download.saveAs(downloaded);
    assert.deepEqual(await readFile(downloaded), await readFile(new URL('../dist/portable/tunotes.html', import.meta.url)));
    assert.equal(await reopened.evaluate(() => localStorage.getItem('tuno-test-sentinel')), 'preserve');
    for (const width of [360, 768, 1280]) {
      await reopened.setViewportSize({ width, height: 900 });
      assert.equal(await reopened.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    assert.equal(await reopened.evaluate(() => window.unoListeners), 1);
    await reopened.evaluate(() => document.querySelector('main').remove());
    await reopened.waitForFunction(() => window.unoListeners === 0);
    assert.equal(await tuner.evaluate(() => window.unoListeners), 2);
    await tuner.evaluate(() => document.querySelector('#app').replaceChildren());
    await tuner.waitForFunction(() => window.unoListeners === 0);
    await context.close();
    online = true;
    results.push(`${prefix}: root-worker first visit, distinct manifests/caches, scoped cleanup, offline reload/download, narrow layouts and Uno disposal passed`);
  }
  await mkdir('dist/validation', { recursive: true });
  await writeFile(`dist/validation/dual-app-${browserName}.json`, JSON.stringify({ builds: Object.fromEntries(Object.entries(release.apps).map(([id, app]) => [id, app.build])), results }, null, 2));
  console.log(`${browserName}: ${results.join('\n')}`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
