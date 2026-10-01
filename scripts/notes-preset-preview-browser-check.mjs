import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
import { setEndpoint, useRange, notesMode } from './notes-setup-helpers.mjs';

const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[engine].launch();
const host = await hostBuild();
try {
  await mkdir('dist/validation',{recursive:true});
  for (const activity of ['Practice','Challenge','Multi Player']) for (const [width,height] of [[320,667],[360,800],[768,1024],[1024,768],[1366,768],[844,390]]) {
    const page = await browser.newPage({viewport:{width,height}});
    const errors = []; page.on('pageerror',error => errors.push(error.message));
    await page.goto(new URL('/notes/',host.url).href);
    await notesMode(page,activity);
    await page.evaluate(() => document.fonts.ready);
    const prefix = activity === 'Multi Player' ? 'multi-' : '';
    const scope = page.locator(activity === 'Multi Player' ? '.multiplayer-editor' : '.practice-setup');
    const overview = scope.locator('.preset-overview');
    const range = overview.locator('.preset-preview-scene > .preset-preview');
    const summary = page.locator(`#${prefix}preset-summary`);
    const original = await summary.textContent();
    const stored = await page.evaluate(() => localStorage.getItem('tunotes:data:v1'));
    const dialog = page.getByRole('dialog');
    const openBass = async () => {
      await page.getByRole('button',{name:'Choose preset…',exact:true}).click();
      await dialog.getByRole('button',{name:'Clef',exact:true}).click();
      await dialog.getByRole('button',{name:'Bass',exact:true}).click();
    };
    const checkPreview = async () => {
      const d = await dialog.boundingBox(), r = await range.boundingBox();
      assert.ok(d.x >= 0 && d.x+d.width <= width+1 && d.y >= 0 && d.y+d.height <= height+1,`${width}: chooser fits viewport`);
      const inside = dialog.locator('.picker-range-preview');
      if (await inside.isVisible()) {
        assert.deepEqual(await inside.locator('output').allTextContents(),await range.locator('output').allTextContents());
      } else {
        assert.ok(r.y >= 0 && r.y+r.height <= height,`${width}: range stays visible in viewport`);
        assert.ok(d.x >= r.x+r.width || d.y >= r.y+r.height || d.y+d.height <= r.y,`${width}: chooser leaves range uncovered`);
      }
      const action = await dialog.getByRole('button',{name:'Use preset',exact:true}).boundingBox();
      assert.ok(action.y >= d.y && action.y+action.height <= d.y+d.height,`${width}: apply remains visible`);
    };
    await openBass();
    assert.equal(await dialog.getByLabel('Show key signature').isChecked(),false);
    await dialog.getByLabel('Show key signature').check();
    await dialog.locator('[data-preset-id="bass-lines-and-spaces"]').click();
    assert.equal(await dialog.isVisible(),true);
    assert.match(await summary.textContent(),/Bass clef/);
    await dialog.locator('[data-preset-id="bass-spaces"]').click();
    assert.match(await summary.textContent(),/Spaces · Bass clef/);
    await checkPreview();
    await page.screenshot({path:`dist/validation/preset-preview-${engine}-${activity}-${width}.png`,fullPage:true});
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await summary.textContent(),original);
    assert.equal(await page.evaluate(() => localStorage.getItem('tunotes:data:v1')),stored);
    assert.equal(await page.locator(`#${prefix}preset:focus`).count(),1);
    await openBass();
    await dialog.locator('[data-preset-id="bass-spaces"]').click();
    await page.keyboard.press('Escape');
    assert.equal(await summary.textContent(),original);
    await openBass();
    assert.equal(await dialog.getByLabel('Show key signature').isChecked(),false);
    await dialog.getByLabel('Show key signature').check();
    await dialog.locator('[data-preset-id="bass-spaces"]').click();
    await dialog.getByRole('button',{name:'Use preset',exact:true}).click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tunotes:data:v1')).configuration.showKeySignature),true);
    assert.match(await page.locator(`#${prefix}preset-name`).textContent(),/Bass — Spaces/);
    assert.match(await summary.textContent(),/Bass clef/);
    assert.equal(await page.locator('.preset-dialog:visible').count(),0);
    if (width === 1366) {
      // Cancel and applying an unchanged selection preserve an unsaved custom source.
      await setEndpoint(page,'Lowest note','D3'); await useRange(page);
      const custom = await summary.textContent(), name = await page.locator(`#${prefix}preset-name`).textContent();
      await openBass(); await dialog.locator('[data-preset-id="bass-spaces"]').click();
      await page.mouse.click(4,4);
      assert.equal(await summary.textContent(),custom);
      assert.equal(await page.locator(`#${prefix}preset-name`).textContent(),name);
      await page.locator(`#${prefix}preset`).click();
      await dialog.getByRole('button',{name:'Use preset',exact:true}).click();
      assert.equal(await summary.textContent(),custom);
    }
    assert.deepEqual(errors,[]); await page.close();
  }
  console.log(`${engine}: live preset preview, non-overlapping placement, compact-screen preview, apply/cancel/Escape/outside click, focus and unsaved custom restoration passed.`);
} finally { await browser.close(); await host.close(); }
