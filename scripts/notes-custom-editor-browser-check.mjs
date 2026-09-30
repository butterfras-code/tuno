import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
import { emptySnapshot } from '../src/apps/tunotes/persistence/store.ts';
import { defaultPreset } from '../src/apps/tunotes/domain/presets.ts';
import { keySignature } from '../src/apps/tunotes/domain/notation.ts';
import { customTab, endpointTab, setEndpoint, setKey, setModifiers, saveCustom, useRange, setToggle, notesMode } from './notes-setup-helpers.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({chromium,firefox})[engine].launch();
const host = await hostBuild();
const errors = [];
try {
  await mkdir('dist/validation',{recursive:true});
  for (const [width,height] of [[320,667],[360,800],[390,844],[768,1024],[1024,768],[1366,768],[844,390]]) {
    const page = await browser.newPage({viewport:{width,height},hasTouch:true});
    page.on('pageerror',error => errors.push(error.message));
    await page.goto(new URL('/notes/',host.url).href); await page.evaluate(() => document.fonts.ready);
    const original = await page.locator('#preset-summary').textContent();
    const stored = await page.evaluate(() => localStorage.getItem('tunotes:data:v1'));
    await customTab(page,'Range');
    assert.equal(await page.getByRole('button',{name:'Start Practice',exact:true}).isVisible(),false);
    assert.equal(await page.locator('.practice-companion').isVisible(),false);
    for (const tab of ['Range','Options','Clefs']) {
      await customTab(page,tab);
      assert.equal(await page.locator('.custom-editor').getByRole('tabpanel').count(),1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true,`${width}: ${tab} horizontal overflow`);
      if (height >= 768) assert.equal(await page.evaluate(() => document.documentElement.scrollHeight<=innerHeight),true,`${width}: ${tab} page fit`);
      // The content viewport must end before the persistent actions, even when scrolled.
      const body = await page.locator('.configurator-body').boundingBox();
      const footer = await page.locator('.custom-editor-footer').boundingBox();
      if (tab === 'Options' && width >= 761 && height >= 768) {
        const spellings = await page.getByRole('group',{name:'Additional spellings',exact:true}).boundingBox();
        assert.ok(spellings.y+spellings.height <= body.y+body.height,`${width}: spelling controls should fit without scrolling`);
      }
      assert.ok(body.y+body.height <= footer.y+1,`${width}: ${tab} overlaps footer`);
      await page.getByRole('button',{name:'Use range',exact:true}).scrollIntoViewIfNeeded();
      assert.equal(await page.getByRole('button',{name:'Use range',exact:true}).evaluate(node => {
        const r=node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      }),true,`${width}: apply action is covered`);
      await page.screenshot({path:`dist/validation/custom-${engine}-${width}-${tab.toLowerCase()}.png`,fullPage:true});
    }
    await setEndpoint(page,'Lowest note','D4');
    await endpointTab(page,'Highest note');
    assert.match(await page.getByRole('slider',{name:'Highest note',exact:true}).getAttribute('aria-valuetext'),/^F5/);
    await endpointTab(page,'Lowest note');
    assert.match(await page.getByRole('slider',{name:'Lowest note',exact:true}).getAttribute('aria-valuetext'),/^D4/);
    if (width <= 600) assert.equal(await page.getByRole('slider').count(),1);
    await setKey(page,'G'); await setModifiers(page,['key','natural']);
    await customTab(page,'Clefs');
    await page.getByRole('group',{name:'Available clefs',exact:true}).getByRole('button',{name:'Bass',exact:true}).click();
    await customTab(page,'Range');
    assert.match(await page.locator('#preset-summary').textContent(),/G Major.*naturals.*Treble \/ Bass/);
    // Real tab keyboard navigation, including wrapping, with only one tab stop.
    await page.getByRole('tab',{name:'Range',exact:true}).focus(); await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('tab',{name:'Clefs',exact:true}).getAttribute('aria-selected'),'true');
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'Options',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('.custom-editor [role=tab][tabindex="0"]').count(),1);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.locator('#preset-summary').textContent(),original);
    assert.equal(await page.evaluate(() => localStorage.getItem('tunotes:data:v1')),stored);
    assert.equal(await page.getByRole('button',{name:'Customize…',exact:true}).evaluate(node => node === document.activeElement),true);
    await setEndpoint(page,'Lowest note','D4'); await useRange(page);
    assert.match(await page.locator('#preset-summary').textContent(),/D4–F5/);
    await setEndpoint(page,'Highest note','G5');
    await page.getByRole('button',{name:'Save as preset…',exact:true}).click();
    await page.getByLabel('Custom preset name',{exact:true}).fill('My range');
    await page.screenshot({path:`dist/validation/custom-${engine}-${width}-save.png`,fullPage:true});
    await page.getByRole('button',{name:'Save preset',exact:true}).click();
    assert.match(await page.locator('#preset-name').textContent(),/My range/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tunotes:data:v1')).customPresets);
    assert.equal(saved.length,1); assert.deepEqual(saved[0].range,['D4','G5']);
    await setEndpoint(page,'Highest note','A5'); await saveCustom(page,'Range copy');
    const copies = await page.evaluate(() => JSON.parse(localStorage.getItem('tunotes:data:v1')).customPresets);
    assert.equal(copies.length,2); assert.deepEqual(copies[0],saved[0]); assert.deepEqual(copies[1].range,['D4','A5']);
    await page.reload(); assert.match(await page.locator('#preset-name').textContent(),/Range copy/);
    await setToggle(page,'meet-notes',false);
    await page.getByRole('button',{name:'Start Practice',exact:true}).click();
    await page.getByRole('button',{name:'Finish',exact:true}).click();
    await page.getByRole('button',{name:'Edit setup',exact:true}).click();
    // Natural-only drafts are valid; a staff-content mismatch still blocks apply.
    const beforeInvalid = await page.locator('#preset-summary').textContent();
    await setModifiers(page,[]);
    assert.equal(await page.getByRole('button',{name:'Use range',exact:true}).isEnabled(),true);
    await setEndpoint(page,'Lowest note','G4'); await setEndpoint(page,'Highest note','G4');
    await customTab(page,'Options');
    await page.getByRole('group',{name:'Staff content',exact:true}).getByRole('button',{name:'Spaces',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Use range',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Save as preset…',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Save preset',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.locator('#preset-summary').textContent(),beforeInvalid);
    if (width === 1024) {
      await page.evaluate(() => { document.documentElement.style.zoom='2'; });
      await customTab(page,'Range'); await endpointTab(page,'Highest note');
      assert.equal(await page.getByRole('slider',{name:'Highest note',exact:true}).isVisible(),true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true);
      await page.getByRole('button',{name:'Cancel',exact:true}).click();
      await page.evaluate(() => { document.documentElement.style.zoom=''; });
      await notesMode(page,'Challenge'); await setEndpoint(page,'Lowest note','C4'); await useRange(page);
      assert.equal(await page.getByRole('button',{name:'Start Challenge',exact:true}).isVisible(),true);
      await notesMode(page,'Multi Player');
      const multiBefore = await page.locator('#multi-preset-summary').textContent();
      await setEndpoint(page,'Lowest note','C4'); await page.getByRole('button',{name:'Cancel',exact:true}).click();
      assert.equal(await page.locator('#multi-preset-summary').textContent(),multiBefore);
      await setEndpoint(page,'Lowest note','C4'); await useRange(page);
      await page.getByRole('button',{name:'Add player',exact:true}).click();
      await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
      await page.getByRole('button',{name:'Select Player 1',exact:true}).click();
      assert.match(await page.locator('#multi-preset-summary').textContent(),/C4/);
    }
    await page.close();
  }
  // Previously saved unsupported spellings must stay repairable, not crash startup.
  const legacy = emptySnapshot();
  const {pool,version,...source} = defaultPreset;
  legacy.customPresets.push({...source,id:'legacy-custom',name:'Earlier C-flat',key:keySignature('Cb'),ledgerBelow:0,ledgerAbove:0,accidentals:'key-only'});
  legacy.configuration.presetId = 'legacy-custom';
  const legacyPage = await browser.newPage(); legacyPage.on('pageerror',error => errors.push(error.message));
  await legacyPage.addInitScript(data => localStorage.setItem('tunotes:data:v1',JSON.stringify(data)),legacy);
  await legacyPage.goto(new URL('/notes/',host.url).href);
  assert.equal(await legacyPage.getByRole('button',{name:'Start Practice',exact:true}).isDisabled(),true);
  assert.match(await legacyPage.locator('#preset-name').textContent(),/Earlier C-flat/);
  await setKey(legacyPage,'C'); await useRange(legacyPage);
  assert.equal(await legacyPage.getByRole('button',{name:'Start Practice',exact:true}).isEnabled(),true);
  await legacyPage.close();
  assert.deepEqual(errors,[]);
  console.log(`${engine}: custom tabs, phone endpoints, no overlapping actions, draft cancel/apply, save/copy/reload, invalid pools, focus, zoom, Challenge and player isolation passed.`);
} finally { await browser.close(); await host.close(); }
