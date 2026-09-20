import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostBuild } from './test-host.mjs';

const host = await hostBuild({ tls: true });
const temp = await mkdtemp(join(tmpdir(), 'tuno-download-'));
const engineName = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[engineName].launch(engineName === 'chromium' ? { args: [`--ignore-certificate-errors-spki-list=${host.certificateSpki}`] } : {});
try {
  // Certificate exception is only for this ephemeral localhost TLS fixture.
  const context = await browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true });
  const page = await context.newPage();
  const clickHiddenButton = (name) => page.locator('button', { hasText: name }).evaluate((button) => button.click());
  const waitForHiddenText = (text) => page.waitForFunction((value) => document.body.textContent.includes(value), text);
  await page.goto(host.url);
  assert.equal(await page.evaluate(() => isSecureContext), true);
  await page.getByText('Offline ready', { exact: true }).waitFor();
  const version = await page.locator('meta[name="tuno-version"]').getAttribute('content');
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  assert.equal(manifest.display, 'standalone');
  for (const item of manifest.icons) {
    const dimensions = await page.evaluate(async (src) => { const image = new Image(); image.src = src; await image.decode(); return [image.naturalWidth, image.naturalHeight]; }, item.src);
    assert.equal(dimensions.join('x'), item.sizes);
  }
  host.setAvailable(false);
  await context.setOffline(true);
  const downloading = page.waitForEvent('download');
  await page.locator('a', { hasText: 'Download offline HTML' }).evaluate((link) => link.click());
  const download = await downloading;
  assert.equal(download.suggestedFilename(), `tuno-${version}.html`);
  const saved = join(temp, download.suggestedFilename());
  await download.saveAs(saved);
  assert.deepEqual(await readFile(saved), await readFile(new URL('../dist/portable/tuno.html', import.meta.url)));
  // Installation lifecycle uses a synthetic event; an OS installation is not automated here.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.promptCalls = (window.promptCalls || 0) + 1; };
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    dispatchEvent(event);
  });
  await clickHiddenButton('Install tUno');
  await waitForHiddenText('Installation cancelled. You can keep practicing here.');
  assert.equal(await page.evaluate(() => window.promptCalls), 1);
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { throw Error('Install fixture failure'); };
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    dispatchEvent(event);
  });
  await clickHiddenButton('Install tUno');
  await waitForHiddenText('Installation could not start. Use your browser’s install menu if available.');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    dispatchEvent(event);
  });
  await clickHiddenButton('Install tUno');
  await waitForHiddenText('Installation requested.');
  await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
  await waitForHiddenText('tUno installed.');
  await page.close();
  const fileContext = await browser.newContext({ offline: true });
  const portable = await fileContext.newPage();
  const requests = [];
  portable.on('request', (request) => requests.push(request.url()));
  const fileUrl = pathToFileURL(saved).href;
  await portable.goto(fileUrl);
  assert.equal(await portable.locator('meta[name="tuno-version"]').getAttribute('content'), version);
  assert.equal(await portable.getByRole('link', { name: 'Download offline HTML' }).count(), 0);
  await portable.getByRole('button', { name: 'Play tone', exact: true }).click();
  await portable.getByRole('button', { name: 'Stop tone', exact: true }).waitFor();
  await portable.getByRole('button', { name: 'Start metronome', exact: true }).click();
  await portable.getByRole('button', { name: 'Stop metronome', exact: true }).waitFor();
  await portable.locator('button', { hasText: 'Stop all audio' }).evaluate((button) => button.click());
  assert.deepEqual(requests.filter((request) => request !== fileUrl), []);
  await fileContext.close();
  await context.close();
  console.log(`${engineName}: localhost HTTPS manifest/icons, offline download, matching file launch/playback, and simulated install lifecycle passed.`);
} finally {
  await browser.close();
  await host.close();
  await rm(temp, { recursive: true, force: true });
}
