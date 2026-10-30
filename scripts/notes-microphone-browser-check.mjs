import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
import { choosePreset, startPractice, setPacing } from './notes-setup-helpers.mjs';
import { viewportProfiles } from './viewport-profiles.mjs';

const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[name].launch();
const host = await hostBuild();
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.micTest = { hz: 0, streams: [], deny: false };
    navigator.mediaDevices.getUserMedia = async () => {
      if (window.micTest.deny) throw new DOMException('Denied', 'NotAllowedError');
      const context = new AudioContext();
      const stream = context.createMediaStreamDestination().stream;
      window.micTest.streams.push(stream);
      return stream;
    };
    AnalyserNode.prototype.getFloatTimeDomainData = function(buffer) {
      for (let i = 0; i < buffer.length; i++) buffer[i] = window.micTest.hz ? .2 * Math.sin(2 * Math.PI * window.micTest.hz * i / this.context.sampleRate) : 0;
    };
  });
  await page.goto(new URL('/notes/', host.url).href);
  await choosePreset(page, 'trumpet-bb-starter');
  await setPacing(page, 'Normal'); await startPractice(page);
  await page.getByRole('button', { name: 'Mic', exact: true }).click();
  const select = page.getByLabel('Microphone transposition');
  const attempts = async () => Number((await page.locator('#practice-counts').textContent()).match(/\/ (\d+) attempts/)[1]);
  await select.selectOption('2');
  await page.getByRole('button', { name: 'Start mic', exact: true }).click();
  await page.evaluate(() => { window.micTest.hz = 233.08188; }); // B♭3 -> written C4.
  await page.waitForFunction(() => /\/ 1 attempts/.test(document.querySelector('#practice-counts').textContent));
  assert.match(await page.locator('.notes-mic-pitch').textContent(), /C4/);
  await page.waitForTimeout(650); assert.equal(await attempts(), 1, 'sustained note submits once');
  for (const [offset, hz] of [[7,174.61412],[9,155.56349],[14,116.54094],[21,77.78175],[0,261.62557]]) {
    const before = await attempts();
    await page.evaluate(() => { window.micTest.hz = 0; });
    await select.selectOption(String(offset));
    await page.evaluate(hz => { window.micTest.hz = hz; }, hz);
    await page.waitForFunction(n => Number(document.querySelector('#practice-counts').textContent.match(/\/ (\d+) attempts/)[1]) === n, before + 1);
    assert.match(await page.locator('.notes-mic-pitch').textContent(), /C4/);
  }
  await mkdir('dist/validation', { recursive: true });
  for (const profile of viewportProfiles) {
    await page.setViewportSize(profile.viewport);
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('button', {name:'Stop mic', exact:true}).count(), 1, `${profile.id}: rotation preserves microphone`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, profile.id);
    const bounds = await page.locator('.notes-mic').boundingBox();
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= profile.viewport.width + 1 && bounds.y + bounds.height <= profile.viewport.height + 1, `${profile.id}: input fits viewport`);
    await page.screenshot({ path: `dist/validation/notes-mic-${name}-${profile.id}.png` });
  }
  await page.setViewportSize({width:1366,height:650});
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  assert.equal(await page.evaluate(() => window.micTest.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Start mic', exact: true }).click();
  await page.getByRole('button', { name: 'Note Names', exact: true }).click();
  assert.equal(await page.evaluate(() => window.micTest.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
  await page.getByRole('button', { name: 'Mic', exact: true }).click();
  await page.evaluate(() => { window.micTest.deny = true; });
  await page.getByRole('button', { name: 'Start mic', exact: true }).click();
  await page.getByText('Microphone permission denied.', {exact:false}).waitFor();
  assert.deepEqual(errors, []);
  await writeFile(`dist/validation/notes-mic-${name}.json`, JSON.stringify({ browser: browser.version(), profiles: viewportProfiles.map(p => p.id), results: ['All transpositions preserve written C4', '300 ms hold and sustained-note latch', 'Pause and mode change stop tracks', 'Permission denial is recoverable', 'All primary and secondary viewports fit'], errors },null,2));
} finally { await browser.close(); await host.close(); }
