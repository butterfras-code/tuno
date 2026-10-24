import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
const host = await hostBuild();
const origin = new URL(host.url).origin;
const browserName = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[browserName].launch();
const routes = [
  ['/', 'tUno', '/', '/suite-sw.js'],
  ['/tune/', 'tUno', '/', '/tune/sw.js'],
  ['/tone/', 'tUno', '/', '/suite-sw.js'],
  ['/tempo/', 'tUno', '/', '/suite-sw.js'],
  ['/notes/', 'tuNotes', '/notes/', '/notes/sw.js'],
  ['/rhythm/', 'Uno234', '/rhythm/', '/rhythm/sw.js'],
];
try {
  for (const [route, name, identity, worker] of routes) {
    host.setAvailable(true);
    const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + route);
    await page.locator('#offline-status').filter({ hasText: /^Offline ready$/ }).waitFor();
    const metadata = await page.evaluate(async () => {
      const url = document.querySelector('link[rel="manifest"]').href;
      return { url, manifest: await (await fetch(url)).json(), worker: navigator.serviceWorker.controller.scriptURL };
    });
    assert.equal(new URL(metadata.manifest.id, metadata.url).pathname, identity);
    assert.equal(metadata.manifest.display, 'standalone');
    assert.equal(new URL(metadata.worker).pathname, worker);
    if (route === '/rhythm/') {
      const title = await page.locator('h1').boundingBox();
      const brand = await page.locator('.app-header .brand').boundingBox();
      assert.ok(title.x + title.width <= brand.x + brand.width + 1, 'Rhythm title fits without overlapping header controls');
    }
    const trigger = page.getByRole('button', { name: 'Install', exact: true });
    const originalMode = route === '/notes/' ? await page.locator('.focus-navigation [aria-pressed="true"]').textContent() : null;
    assert.equal(await trigger.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)', 'Install is a text control');
    assert.match(await trigger.evaluate(node => getComputedStyle(node).textDecorationLine), /underline/);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: `Install ${name}`, exact: true });
    assert.equal(await dialog.evaluate(node => node.matches(':modal')), true);
    const help = page.locator('.install-help');
    await help.waitFor();
    assert.match(await help.textContent(), /Install or Add to Home Screen/);
    assert.match(await help.textContent(), /Share menu in Safari/);
    await help.getByRole('img', { name: /Install icon/ }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Download offline HTML' }).count(), 0);
    assert.equal(await page.locator('meta[name$="-download"]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.keyboard.press('Escape');
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    // The outer Install action must call the native flow immediately, even if the panel is closed.
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = async () => { window.installCalls = (window.installCalls || 0) + 1; };
      event.userChoice = Promise.resolve({ outcome: 'dismissed' });
      dispatchEvent(event);
    });
    await trigger.click();
    await page.getByText('Installation cancelled. You can keep practicing here.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.installCalls), 1);
    assert.equal(await dialog.evaluate(node => node.matches(':modal')), true, 'Cancellation opens the shared modal');
    if (originalMode) assert.equal(await page.locator('.focus-navigation [aria-pressed="true"]').textContent(), originalMode, 'Install does not navigate to Options');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    await trigger.click();
    await page.getByRole('button', { name: `Install ${name}`, exact: true }).click();
    assert.equal(await page.evaluate(() => window.installCalls), 1, 'A captured prompt is used only once');
    await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
    assert.equal(await page.getByRole('button', { name: `Install ${name}`, exact: true }).count(), 0);
    host.setAvailable(false); await context.setOffline(true);
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(origin + route);
    await reopened.locator('#offline-status').filter({ hasText: /^Offline ready$/ }).waitFor();
    assert.equal(await reopened.locator('h1').textContent(), route === '/' ? 'tUno' : name);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${browserName}: ${route} manifest, install flow, fallback, focus, narrow layout and offline reopening passed`);
  }
  host.setAvailable(true);
  const installed = await browser.newContext();
  await installed.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  const page = await installed.newPage(); await page.goto(host.url);
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await page.getByText('This app is running as an installed app.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Install tUno', exact: true }).count(), 0);
  await installed.close();
} finally { await browser.close(); await host.close(); }
