import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const hosted = new URL('../dist/hosted/', import.meta.url);
const files = new Map([
  ['/practice/', ['index.html', 'text/html']],
  ['/practice/app.js', ['app.js', 'text/javascript']],
  ['/practice/app.css', ['app.css', 'text/css']],
]);
const server = createServer(async (request, response) => {
  const file = files.get(request.url);
  if (!file) { response.writeHead(404).end(); return; }
  try {
    response.writeHead(200, { 'Content-Type': file[1] });
    response.end(await readFile(new URL(file[0], hosted)));
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const temp = await mkdtemp(join(tmpdir(), 'tuno-portable-'));
let browser;
try {
  browser = await chromium.launch();
  const relocated = join(temp, 'renamed tuno.html');
  await copyFile(new URL('../dist/portable/tuno.html', import.meta.url), relocated);
  for (const [mode, url] of [
    ['hosted', `http://127.0.0.1:${server.address().port}/practice/`],
    ['portable', pathToFileURL(relocated).href],
  ]) {
    const context = await browser.newContext({ offline: mode === 'portable' });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(url);
    assert.match(await page.locator('#pitch-result').innerText(), /Concert A4 · Written A4 · In tune/);
    await page.getByLabel('Frequency (Hz)', { exact: true }).fill('233.08188075904496');
    await page.getByLabel('Written pitch', { exact: true }).selectOption('2');
    await page.getByRole('button', { name: 'Check pitch' }).click();
    assert.match(await page.locator('#pitch-result').innerText(), /Concert B♭3 · Written C4 · In tune/);
    await page.getByLabel('Frequency (Hz)', { exact: true }).fill('442');
    await page.getByLabel('A4 reference (Hz)', { exact: true }).fill('442');
    await page.getByLabel('Written pitch', { exact: true }).selectOption('0');
    await page.getByRole('button', { name: 'Check pitch' }).focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#pitch-result').innerText(), /Concert A4 · Written A4 · In tune/);
    await page.getByLabel('Frequency (Hz)', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Check pitch' }).click();
    assert.equal(await page.locator('#frequency').evaluate((input) => input.validity.valid), false);
    assert.deepEqual(errors, []);
    if (mode === 'portable') assert.deepEqual(requests, [url], 'Portable must only load itself.');
    console.log(`${mode}: pitch controls and validation passed in Chromium ${browser.version()}${mode === 'portable' ? '; relocated file, offline, no subresource requests' : ''}.`);
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
