import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { hostBuild } from './test-host.mjs';
const host = await hostBuild(), browser = await chromium.launch();
const output = 'dist/validation/rhythm-patterns';
await mkdir(output, { recursive: true });
const results = [];
try {
  for (const width of [320, 580, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('/rhythm/', host.url).href);
    // /rhythm is the integrated app; exercise controls belong to its shared activity.
    await page.locator('.level-customize').click();
    const dialog = page.locator('#custom-exercise');
    await dialog.waitFor({ state: 'visible' });
    const level = dialog.locator('[data-setting="teaching-preset"]');
    assert.deepEqual(await level.locator('option').evaluateAll(nodes => nodes.filter(n => n.value.startsWith('uno-')).map(n => n.value)), ['uno-1','uno-2','uno-3','uno-4','uno-5']);
    await level.selectOption('uno-1');
    assert.deepEqual(await dialog.locator('[data-ingredient]:checked').evaluateAll(nodes => nodes.map(n => n.dataset.ingredient).sort()), ['half','quarter','quarter-rest']);
    await level.selectOption('uno-4');
    const patterns = dialog.locator('[data-sixteenth-pattern]');
    assert.equal(await patterns.count(), 5);
    assert.equal(await dialog.locator('[data-value="16th"] .ingredient-row:first-child .rhythm-pattern-preview').count(), 5);
    assert.equal(await dialog.locator('[data-value="16th"]').evaluate(row => row.scrollWidth <= row.clientWidth + 1), true);
    assert.equal(await dialog.locator('[data-ingredient="sixteenth"]').count(), 0);
    const identity = await page.locator('.passage').getAttribute('data-exercise-id');
    for (const pattern of await patterns.all()) await pattern.uncheck();
    await dialog.locator('[data-sixteenth-pattern="16-8-16"]').check();
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('tuno.rhythm-walk.preferences.v1')).generation);
    assert.deepEqual((await read()).sixteenthPatterns, ['16-8-16']);
    assert.equal((await read()).teachingPreset.customized, true);
    assert.equal(await page.locator('.passage').getAttribute('data-exercise-id'), identity);
    assert.equal(await dialog.evaluate(d => d.scrollWidth <= d.clientWidth + 1), true);
    await page.screenshot({ path: `${output}/${width}.png`, fullPage: true });
    await page.reload();
    assert.deepEqual((await read()).sixteenthPatterns, ['16-8-16']);
    await page.locator('.level-customize').click();
    assert.equal(await page.locator('[data-sixteenth-pattern]:checked').count(), 1);
    assert.equal(await page.locator('[data-sixteenth-pattern="16-8-16"]').isChecked(), true);
    await page.locator('#custom-exercise [data-setting="teaching-preset"]').selectOption('uno-1');
    await page.locator('#custom-exercise [name="exercise-length"][value="1"]').check();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'New exercise', exact: true }).filter({ visible: true }).click();
    const events = await page.locator('.passage g[data-event]').evaluateAll(nodes => nodes.map(n => [n.dataset.value, n.dataset.kind]));
    assert.deepEqual(events, Array.from({ length: 4 }, () => ['quarter', 'note']));
    assert.deepEqual(errors, []);
    results.push({ width, passed: true });
    await page.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(results, null, 2));
  console.log(results);
} finally { await browser.close(); await host.close(); }
