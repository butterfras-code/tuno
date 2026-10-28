import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { viewportProfiles } from './viewport-profiles.mjs';

const engine = process.env.TUNO_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox'].includes(engine), `Unsupported browser: ${engine}`);
const output = `dist/validation/viewports-${engine}`;
await mkdir(output, { recursive: true });
const release = JSON.parse(await readFile('dist/release.json', 'utf8'));
const report = {
  engine, revision: release.revision, build: release.build, dirty: release.dirty,
  passed: false, physicalAcceptance: 'not performed', results: [],
};
const host = await hostBuild();
let browser;
try {
  browser = await ({ chromium, firefox })[engine].launch();
  for (const profile of viewportProfiles) {
    const context = await browser.newContext({ viewport: profile.viewport, hasTouch: profile.hasTouch, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const route of ['/', '/tune/', '/tone/', '/tempo/', '/notes/', '/rhythm/']) {
        const result = { profile: profile.id, viewport: profile.viewport, provisional: profile.provisional, route, passed: false };
        report.results.push(result);
        try {
          const response = await page.goto(new URL(route, host.url).href);
          assert.ok(response.ok(), `${route}: HTTP ${response.status()}`);
          await page.locator('h1').waitFor();
          await page.evaluate(() => document.fonts.ready);
          const name = route === '/' ? 'launcher' : route.replaceAll('/', '');
          await page.screenshot({ path: `${output}/${profile.id}-${name}.png` });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page horizontal overflow');
          if (route !== '/') {
            await page.locator('footer').getByRole('button', { name: 'About', exact: true }).click();
            const dialog = page.getByRole('dialog');
            await dialog.waitFor();
            const bounds = await dialog.boundingBox();
            const { width, height } = profile.viewport;
            assert.ok(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1, 'About dialog outside viewport');
            assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'About dialog horizontal overflow');
            await page.screenshot({ path: `${output}/${profile.id}-${name}-about.png` });
            await page.keyboard.press('Escape');
            assert.equal(await dialog.count(), 0, 'Escape closes About dialog');
          }
          if (route === '/rhythm/') {
            const count = page.locator('[data-count-id]').first();
            await count.focus(); await page.keyboard.press('1');
            const answer = await count.textContent();
            await page.getByRole('link', { name: 'Help', exact: true }).click();
            const help = page.locator('#help-view');
            await help.waitFor({ state: 'visible' });
            assert.equal(await page.locator('#practice-view').isVisible(), false);
            assert.equal(await page.locator('#settings-view').isVisible(), false);
            assert.equal(await page.getByRole('link', { name: 'Help', exact: true }).getAttribute('aria-current'), 'page');
            assert.equal(await page.title(), 'Help — Uno234');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Help has no horizontal overflow');
            await page.screenshot({ path: `${output}/${profile.id}-rhythm-help.png`, fullPage: true });
            await page.getByRole('link', { name: 'Settings', exact: true }).click();
            await page.locator('#settings-view').waitFor({ state: 'visible' });
            assert.equal(await help.isVisible(), false);
            await page.goBack(); await help.waitFor({ state: 'visible' });
            await page.getByRole('link', { name: 'Practice', exact: true }).click();
            await count.waitFor({ state: 'visible' });
            assert.equal(await count.textContent(), answer, 'Help navigation preserves the answer');
          }
          assert.deepEqual(errors, [], 'No uncaught page errors');
          result.passed = true;
        } catch (error) {
          result.error = error.message;
          throw new Error(`${profile.id} ${route}: ${error.message}`, { cause: error });
        }
      }
    } finally { await context.close(); }
    console.log(`${engine}: ${profile.id} passed`);
  }
  report.passed = true;
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  await browser?.close();
  await host.close();
}
