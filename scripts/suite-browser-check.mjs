import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
const host = await hostBuild();
const origin = new URL(host.url).origin;
const browser = await (process.env.TUNO_BROWSER === 'firefox' ? firefox : chromium).launch();
try {
  const context = await browser.newContext({ hasTouch: true });
  let page = await context.newPage();
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const routes = [['/tune/', 'tUno', 'Practice with a friend.'], ['/tone/', 'tUno', 'Practice with a friend.'], ['/tempo/', 'tUno', 'Practice with a friend.'], ['/notes/', 'tuNotes', 'Read Notes with a friend.'], ['/rhythm/', 'Uno234', 'Practice rhythm with a friend.']];
  for (const width of [360, 1280]) {
    console.log(`Checking suite navigation at ${width}px`);
    if (width === 1280) {
      await page.close(); page = await context.newPage();
      page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
    }
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin);
    assert.equal(await page.locator('h1').textContent(), 'tUno');
    assert.equal(await page.locator('.launcher-brand p').textContent(), "Uno's Practice Tools");
    for (const path of ['/tune/', '/notes/', '/rhythm/']) {
      await page.locator(`.launcher-card[href="${path}"]`).tap();
      await page.waitForURL(origin + path);
      assert.equal(new URL(page.url()).pathname, path);
      await page.getByRole('link', { name: '← Tools' }).click();
      assert.equal(new URL(page.url()).pathname, '/');
    }
    for (const [path, title, subtitle] of routes) {
      await page.goto(origin + path); await page.reload();
      assert.equal(await page.locator('h1').textContent(), title);
      assert.equal(await page.locator('.suite-header .tagline').textContent(), subtitle);
      assert.ok(await page.locator('.suite-header .tagline').isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path + ' overflows');
      for (const box of await page.locator('.suite-header .control:visible').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, right: r.right, height: r.height }; }))) {
        assert.ok(box.x >= 0 && box.right <= width && box.height >= 40, path + ' navigation clipped');
      }
      await page.getByRole('link', { name: '← Tools' }).click();
      assert.equal(new URL(page.url()).pathname, '/');
    }
  }
  console.log('Checking in-place history and audio exit');
  await page.goto(origin + '/tune/');
  await page.evaluate(() => { window.originalDocument = document; });
  const nav = page.getByRole('navigation', { name: 'tUno tools' });
  await nav.getByRole('link', { name: 'Reference tone', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/tone/');
  await nav.getByRole('link', { name: 'Metronome', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/tempo/');
  await page.goBack(); assert.equal(new URL(page.url()).pathname, '/tone/');
  assert.ok(await page.locator('#view-tone').isVisible());
  await page.goForward(); assert.ok(await page.locator('#view-metronome').isVisible());
  assert.ok(await page.evaluate(() => document === window.originalDocument));
  await nav.getByRole('button', { name: 'Settings', exact: true }).click();
  assert.ok(await page.getByRole('dialog', { name: 'Practice settings', exact: true }).isVisible());
  await page.keyboard.press('Escape');
  // Leaving the app stops live playback, including when restored from history.
  await page.getByRole('button', { name: 'Start metronome', exact: true }).first().click();
  await page.getByRole('button', { name: 'Stop metronome', exact: true }).first().waitFor();
  await page.getByRole('link', { name: '← Tools' }).click();
  await page.goBack();
  await page.getByRole('button', { name: 'Start metronome', exact: true }).first().waitFor();
  // Keyboard links and old rhythm links retain their query/hash state.
  await page.goto(origin);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await page.waitForURL(origin + '/tune/');
  assert.equal(new URL(page.url()).pathname, '/tune/');
  for (const path of ['/prototypes/rhythm-walk/', '/prototypes/count-writing/']) {
    await page.goto(origin + path + '?fixture=half#settings');
    assert.equal(await page.locator('h1').textContent(), 'Uno234');
    assert.equal(await page.locator('.rhythm-nav [aria-current="page"]').textContent(), 'Settings');
  }
  // Prepare each independent app, then test aliases and Tools with networking off.
  for (const path of ['/tune/', '/notes/', '/tone/', '/tempo/']) {
    await page.goto(origin + path);
    await page.getByText('Offline ready', { exact: true }).waitFor();
  }
  console.log('Checking offline route entry and Tools');
  await context.setOffline(true); host.setAvailable(false);
  for (const path of ['/tone/', '/tempo/', '/tune/', '/notes/']) {
    await page.goto(origin + path); await page.reload();
    await page.getByText('Offline ready', { exact: true }).waitFor();
    await page.getByRole('link', { name: '← Tools' }).click();
    await page.locator('.launcher-card').first().waitFor();
    assert.equal(await page.locator('.launcher-card').count(), 3);
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Suite: desktop/mobile, touch/keyboard, direct loads, refresh, history, audio exit, legacy rhythm links and offline routes passed.');
} finally { await browser.close(); await host.close(); }
