import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { emptySnapshot } from '../src/apps/tunotes/persistence/store.ts';
import { keySignature } from '../src/apps/tunotes/domain/notation.ts';

const browser = await chromium.launch();
const host = await hostBuild();
const errors = [];
try {
  for (const [width,height] of [[320,667],[390,844],[1024,768]]) {
    const page = await browser.newPage({viewport:{width,height},hasTouch:true});
    page.on('pageerror',error => errors.push(error.message));
    await page.goto(new URL('/notes/',host.url).href);
    const summary = page.locator('#preset-summary');
    const original = await summary.textContent();
    const open = async () => {
      await page.getByRole('button',{name:'Select range',exact:true}).click();
      await page.getByRole('button',{name:'Custom',exact:true}).click();
    };
    await open();
    const dialog = page.locator('.range-picker-dialog[open]');
    const content = dialog.getByRole('group',{name:'Staff content',exact:true});
    const lines = content.getByRole('button',{name:'Lines',exact:true});
    const spaces = content.getByRole('button',{name:'Spaces',exact:true});
    assert.equal(await lines.getAttribute('aria-pressed'),'true');
    assert.equal(await spaces.getAttribute('aria-pressed'),'true');
    const selectedBackground = await lines.evaluate(n => getComputedStyle(n).backgroundColor);
    assert.equal(selectedBackground,await content.evaluate(n => getComputedStyle(n.closest('dialog').querySelector('.visual-range-pair')).backgroundColor),'selected content keeps its light background');
    const lineBox = await lines.boundingBox(), spaceBox = await spaces.boundingBox();
    assert.ok(spaceBox.x>lineBox.x && Math.abs(lineBox.y-spaceBox.y)<1,'content toggles share one row');
    await lines.click();
    assert.equal(await lines.evaluate(n => getComputedStyle(n).backgroundColor),selectedBackground,'checkmark carries selection without changing background');
    assert.equal(await lines.getAttribute('aria-pressed'),'false');
    assert.equal(await spaces.getAttribute('aria-pressed'),'true','content toggles are independent');
    await spaces.click();
    assert.equal(await dialog.getByRole('button',{name:'Save',exact:true}).isDisabled(),true,'empty inclusion disables Save');
    assert.match(await dialog.textContent(),/Turn on Lines or Spaces/);
    await lines.click(); await spaces.click();
    assert.equal(await dialog.getByRole('button',{name:'Save',exact:true}).isEnabled(),true);
    const low = dialog.getByRole('slider',{name:'Lowest note',exact:true});
    const high = dialog.getByRole('slider',{name:'Highest note',exact:true});
    assert.equal(await low.isVisible(),true); assert.equal(await high.isVisible(),true);
    const lowBox = await low.boundingBox(), highBox = await high.boundingBox();
    assert.ok(highBox.x > lowBox.x && Math.abs(highBox.y-lowBox.y)<1,'staves remain side by side');
    const up = await dialog.getByRole('button',{name:'Lowest note: move up',exact:true}).boundingBox();
    const down = await dialog.getByRole('button',{name:'Lowest note: move down',exact:true}).boundingBox();
    assert.ok(up.y+up.height <= lowBox.y+1 && down.y >= lowBox.y+lowBox.height-1,'chevrons sit above and below their staff');
    assert.equal(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth),true,`${width}: dialog overflows horizontally`);
    const accidental = dialog.locator('.visual-range-endpoint').first().locator('.range-accidental-cycle');
    assert.equal(await dialog.locator('.range-accidental-cycle').count(),2,'one accidental per staff');
    assert.equal(await accidental.textContent(),'♮');
    const appearance = await accidental.evaluate(n => {
      const style=getComputedStyle(n); return {border:style.borderTopWidth,background:style.backgroundColor};
    });
    assert.equal(appearance.border,'0px');
    assert.equal(appearance.background,'rgba(0, 0, 0, 0)','accidental stays unboxed');
    await dialog.getByRole('button',{name:'Lowest note: move up',exact:true}).click();
    assert.match(await low.getAttribute('aria-valuetext'),/^F4/);
    await dialog.getByRole('button',{name:'Lowest note: move down',exact:true}).click();
    assert.match(await low.getAttribute('aria-valuetext'),/^E4/);
    await accidental.click(); // E sharp is unsupported, so natural cycles straight to flat.
    assert.match(await low.getAttribute('aria-valuetext'),/^E♭4/);
    assert.match(await high.getAttribute('aria-valuetext'),/^F5/,'other accidental is independent');
    await accidental.click();
    assert.match(await low.getAttribute('aria-valuetext'),/^E4/);
    await dialog.getByRole('button',{name:'Lowest note: move down',exact:true}).click();
    for (const [symbol,pitch] of [['♯','D♯4'],['♭','D♭4'],['♮','D4']]) {
      await accidental.click();
      assert.equal(await accidental.textContent(),symbol);
      assert.ok((await low.getAttribute('aria-valuetext')).startsWith(pitch));
    }
    await accidental.focus(); await page.keyboard.press('Space');
    assert.match(await low.getAttribute('aria-valuetext'),/^D♯4/,'keyboard cycles accidental');
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    assert.match(await low.getAttribute('aria-valuetext'),/^D4/);
    await dialog.getByRole('button',{name:'Lowest note: move up',exact:true}).click();
    for (const clef of ['Treble','Bass','Alto','Tenor']) {
      await dialog.getByRole('button',{name:`Lowest note clef: ${clef}. Change clef`,exact:true}).click();
      assert.match(await high.getAttribute('aria-valuetext'),/^F5, treble clef$/,'other clef stays independent');
    }
    assert.match(await low.getAttribute('aria-valuetext'),/^E4, treble clef$/);
    // Drag the rendered notehead using the live SVG scale.
    await low.scrollIntoViewIfNeeded();
    const drag = await low.evaluate(n => {
      const svg=n.querySelector('svg'), m=svg.getScreenCTM();
      const point=new DOMPoint(230,140).matrixTransform(m);
      return {x:point.x,y:point.y,unit:10*m.d};
    });
    await page.mouse.move(drag.x,drag.y); await page.mouse.down();
    await page.mouse.move(drag.x,drag.y-2*drag.unit,{steps:5}); await page.mouse.up();
    assert.match(await low.getAttribute('aria-valuetext'),/^G4/,'drag moves two staff positions');
    await low.focus(); await page.keyboard.press('PageDown');
    const ledgerBounds = await low.evaluate(n => {
      const svg=n.querySelector('svg'), box=svg.viewBox.baseVal;
      return {top:box.y,bottom:box.y+box.height};
    });
    assert.equal(ledgerBounds.top,60,'upper chevron stays at the staff when no note exceeds it');
    assert.ok(ledgerBounds.bottom>140,'lower chevron extends for the ledger note');
    await page.keyboard.press('End');
    assert.match(await low.getAttribute('aria-valuetext'),/^F5/,'cannot cross highest note');
    await page.keyboard.press('ArrowDown');
    assert.match(await low.getAttribute('aria-valuetext'),/^E5/);
    await dialog.getByRole('button',{name:'Close range selection',exact:true}).click();
    assert.equal(await summary.textContent(),original,'close discards draft');
    await open();
    assert.match(await low.getAttribute('aria-valuetext'),/^E4/,'reopening reloads committed range');
    await dialog.getByRole('button',{name:'Lowest note: move up',exact:true}).click();
    await dialog.getByRole('button',{name:'Save',exact:true}).click();
    assert.match(await summary.textContent(),/F4–F5/);
    await page.getByRole('button',{name:'Customize…',exact:true}).click();
    assert.match(await page.getByRole('slider',{name:'Lowest note',exact:true}).getAttribute('aria-valuetext'),/^F4/,'legacy editor receives applied draft');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await open(); await spaces.click();
    await dialog.getByRole('button',{name:'Save',exact:true}).click();
    assert.match(await summary.textContent(),/ · Lines · /,'content selection applies to practice');
    await page.close();
  }
  // Editing only the range preserves the custom options that have not migrated.
  const saved = {id:'saved-range',name:'Saved range',editorVersion:2,clef:'treble',
    availableClefs:['treble'],endpointClefs:['treble','treble'],range:['D4','G5'],
    content:'spaces',key:keySignature('G'),modifiers:['key','flat'],accidentals:'key-only'};
  const data = emptySnapshot(); data.customPresets.push(saved); data.configuration.presetId = saved.id;
  const page = await browser.newPage();
  await page.addInitScript(value => localStorage.setItem('tunotes:data:v1',JSON.stringify(value)),data);
  await page.goto(new URL('/notes/',host.url).href);
  await page.getByRole('button',{name:'Select range',exact:true}).click();
  await page.getByRole('button',{name:'Custom',exact:true}).click();
  const content = page.locator('.range-picker-dialog[open]').getByRole('group',{name:'Staff content',exact:true});
  assert.equal(await content.getByRole('button',{name:'Lines',exact:true}).getAttribute('aria-pressed'),'false','existing content loads');
  assert.equal(await content.getByRole('button',{name:'Spaces',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Lowest note: move up',exact:true}).click();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  assert.match(await page.locator('#preset-summary').textContent(),/G Major.*Spaces.*flats/);
  await page.getByRole('button',{name:'Start Practice',exact:true}).click();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('tunotes:data:v1')).customPresets.find(p=>p.id==='custom-current'));
  assert.equal(persisted.content,'spaces'); assert.equal(persisted.key.fifths,1);
  assert.deepEqual(persisted.modifiers,['key','flat']); assert.deepEqual(persisted.range,['E4','G5']);
  await page.close();
  assert.deepEqual(errors,[]);
  console.log('Visual custom range: clefs, accidentals, dragging, chevrons, keyboard, bounds, cancel/apply, legacy interoperability and mobile layout passed.');
} finally { await browser.close(); await host.close(); }
