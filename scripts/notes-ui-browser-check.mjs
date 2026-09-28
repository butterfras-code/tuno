import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
import { notesMode, setToggle, setPacing, openData } from './notes-setup-helpers.mjs';
const browser = await ({chromium,firefox})[process.env.TUNO_BROWSER || 'chromium'].launch();
const host = await hostBuild();
try {
  const page = await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(host.url+'notes/');
  assert.equal(await page.locator('input[type=checkbox]').count(),0);
  assert.equal(await page.locator('.preset-preview .notehead').count(),2);
  assert.match(await page.locator('#preset-summary').textContent(),/C Major · E4–F5 · Lines and Spaces · Treble clef/);
  assert.equal(await page.locator('#adaptive-help').isVisible(),false);
  await setToggle(page,'adaptive',true); assert.equal(await page.locator('#adaptive-help').isVisible(),false);
  const help = page.getByRole('button',{name:'About Adapt Range',exact:true});
  await help.hover(); assert.equal(await page.locator('#adaptive-help').isVisible(),true);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#adaptive-help').isVisible(),false);
  await help.focus(); assert.equal(await page.locator('#adaptive-help').isVisible(),true);
  await page.keyboard.press('Escape'); await page.locator('#preset').focus();
  const practicePacing = page.locator('#notes-practice').getByRole('group',{name:'Continue After',exact:true});
  await practicePacing.getByRole('button',{name:'Click/Tap',exact:true}).click();
  await notesMode(page,'Options');
  assert.equal(await page.getByRole('button',{name:'Click/Tap',exact:true}).getAttribute('aria-pressed'),'true');
  await notesMode(page,'Practice');
  await setToggle(page,'adaptive',false); await setToggle(page,'meet-notes',false);
  await notesMode(page,'Challenge'); assert.equal(await page.getByRole('button',{name:'Start Challenge',exact:true}).isVisible(),true);
  await setPacing(page,'Instant'); await page.reload(); await notesMode(page,'Options');
  assert.equal(await page.getByRole('button',{name:'Instant',exact:true}).getAttribute('aria-pressed'),'true');
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
  await setToggle(page,'meet-notes',false); await setToggle(page,'adaptive',true); await page.reload();
  assert.equal(await page.locator('#adaptive').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#meet-notes').getAttribute('aria-pressed'),'false');
  await page.getByRole('button',{name:'Start Practice',exact:true}).click();
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
        assert.ok((await page.locator('.preset-preview').boundingBox()).width <= 480);
        assert.equal(Math.round((await page.getByRole('button',{name:'Start Practice',exact:true}).boundingBox()).width),270);
      }
      await page.screenshot({path:`dist/validation/notes-ui-${process.env.TUNO_BROWSER || 'chromium'}-${mode.toLowerCase()}-${width}.png`,fullPage:true});
    }
  }
  const touch = await browser.newContext({hasTouch:true,viewport:{width:360,height:800}});
  const touchPage = await touch.newPage(); await touchPage.goto(host.url+'notes/');
  const touchHelp = touchPage.getByRole('button',{name:'About Adapt Range',exact:true});
  await touchHelp.tap(); assert.equal(await touchPage.locator('#adaptive-help').isVisible(),true);
  assert.equal(await touchPage.locator('#adaptive').getAttribute('aria-pressed'),'false');
  await touchPage.getByText('Preset',{exact:true}).tap(); assert.equal(await touchPage.locator('#adaptive-help').isVisible(),false);
  await touchHelp.tap(); assert.equal(await touchPage.locator('#adaptive-help').isVisible(),true);
  await touchHelp.tap(); assert.equal(await touchPage.locator('#adaptive-help').isVisible(),false);
  await touch.close();
  assert.deepEqual(errors,[]); console.log('Navigation, range summary, toggles, persistence, mode-switch pause and responsive layouts passed.');
} finally { await browser.close(); await host.close(); }
