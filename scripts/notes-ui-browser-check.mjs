import { startPractice, readyForAnswer } from './notes-setup-helpers.mjs';
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
import { notesMode, setToggle, setPacing, openData, choosePreset } from './notes-setup-helpers.mjs';
const browser = await ({chromium,firefox})[process.env.TUNO_BROWSER || 'chromium'].launch();
const host = await hostBuild();
try {
  const page = await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/notes/', host.url).href);
  assert.equal(await page.locator('.preset-preview .notehead').count(),2);
  assert.match(await page.locator('#preset-summary').textContent(),/C Major · E4–F5/);
  assert.equal(await page.locator('#adaptive, #meet-notes').count(),0);
  await setPacing(page,'Correct Only');await page.reload();
  assert.equal(await page.getByRole('button',{name:'Correct Only',exact:true}).getAttribute('aria-pressed'),'true');
  await setPacing(page,'Normal');await page.reload();
  assert.equal(await page.getByRole('button',{name:'Normal',exact:true}).getAttribute('aria-pressed'),'true');
  await openData(page); await page.getByRole('button',{name:'Add profile',exact:true}).click(); await page.getByLabel('Profile name',{exact:true}).fill('UI reader'); await page.getByLabel('Profile name',{exact:true}).press('Enter');
  assert.equal(await page.locator('.profile-card').isVisible(),true);
  assert.equal(await page.locator('.profile-save-status').textContent(),'Changes saved.');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tunotes:data:v1')).profiles[0].name),'UI reader');
  await setToggle(page,'remember-progress',false);
  assert.equal(await page.locator('.profile-card').isVisible(),true);
  assert.equal(await page.locator('#profile').isEnabled(),true);
  await setToggle(page,'remember-progress',true);
  await page.getByRole('button',{name:'Add profile',exact:true}).click();
  assert.equal(await page.getByLabel('Profile name',{exact:true}).evaluate(input=>input===document.activeElement),true);
  await page.getByLabel('Profile name',{exact:true}).fill('Second reader');
  assert.match(await page.locator('#profile option:checked').textContent(),/Profile 2/);
  await page.getByRole('button',{name:'Previous profile',exact:true}).click();
  assert.match(await page.locator('#profile option').nth(1).textContent(),/Second reader/);
  assert.equal(await page.locator('.profile-card > h3').textContent(),'Profile 1 settings');
  await page.getByRole('button',{name:'Next profile',exact:true}).click();
  assert.equal(await page.locator('.profile-card > h3').textContent(),'Profile 2 settings');
  page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'Delete selected profile',exact:true}).click();
  assert.equal(await page.locator('#profile option').count(),1);
  await choosePreset(page,'treble-lines-and-spaces',true);await page.reload();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tunotes:data:v1')).profiles[0].adaptive),true);
  await startPractice(page);
  await notesMode(page,'Options'); await page.keyboard.press('e');
  assert.match(await page.locator('#practice-counts').textContent(),/0 attempts/);
  await notesMode(page,'Practice'); assert.equal(await page.getByRole('button',{name:'Resume',exact:true}).isVisible(),true);
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.getByRole('button',{name:'Finish',exact:true}).click(); await page.getByRole('button',{name:'Edit setup',exact:true}).click();
  await mkdir('dist/validation',{recursive:true});
  for (const width of [360,768,1280]) {
    await page.setViewportSize({width,height:900});
    for (const mode of ['Practice','Options']) {
      await notesMode(page,mode);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if (mode === 'Practice') {
        const preview = await page.locator('.preset-preview').boundingBox();
        const scene = await page.locator('.preset-preview-scene').boundingBox();
        assert.ok(preview.width > 0 && preview.x >= scene.x - 1 && preview.x + preview.width <= scene.x + scene.width + 1, 'Range preview fits its responsive setup scene');
        const start=await page.getByRole('button',{name:'Start Practice',exact:true}).boundingBox();
        assert.ok(start.width >= 44 && start.height >= 44);
      }
      await page.screenshot({path:`dist/validation/notes-ui-${process.env.TUNO_BROWSER || 'chromium'}-${mode.toLowerCase()}-${width}.png`,fullPage:true});
    }
  }
  assert.deepEqual(errors,[]); console.log('Navigation, range summary, toggles, persistence, mode-switch pause and responsive layouts passed.');
} finally { await browser.close(); await host.close(); }
