import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { build } from 'esbuild';
import { hostBuild } from './test-host.mjs';

const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[engine].launch();
const host = await hostBuild();
try {
  const compiled = await build({ stdin: { contents: `
    import {answerControls} from './src/apps/tunotes/ui/answers.ts';
    import {keyNames,keySignature} from './src/apps/tunotes/domain/notation.ts';
    import {defaultPreset} from './src/apps/tunotes/domain/presets.ts';
    window.keys=keyNames.filter(k=>k!=='Cb'); window.received=[];
    const root=document.createElement('div'); root.id='home';
    const stage=document.createElement('div'); stage.className='play-stage'; stage.style.cssText='display:block;position:relative;width:100%';
    root.append(stage); document.body.replaceChildren(root);
    const controls=answerControls(a=>window.received.push(a)); stage.append(controls.node);
    window.setKey=name=>{const key=keySignature(name); controls.update({...defaultPreset,key},{session:1,prompt:1},false); return key.tonic;};
  `, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife' });
  const page = await browser.newPage();
  await page.goto(new URL('/notes/', host.url).href);
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  const letters = ['C','D','E','F','G','A','B'];
  for (const key of await page.evaluate(() => window.keys)) {
    await page.setViewportSize({ width: 1000, height: 950 });
    await page.evaluate(() => { document.querySelector('.play-stage').classList.remove('play-stage--compact'); document.body.firstElementChild.id='home'; });
    const tonic = await page.evaluate(key => window.setKey(key), key);
    const endpoints = page.locator(`.answer[data-letter="${tonic.letter}"][data-accidental="${tonic.accidental}"]`);
    assert.equal(await endpoints.count(), 2);
    const first = await endpoints.first().boundingBox(), last = await endpoints.last().boundingBox();
    // Accidentals fit their labels; octave spacing follows the natural-key grid.
    const natural = await page.locator('.answer-natural').first().boundingBox();
    assert.ok(Math.abs((last.x + last.width / 2) - (first.x + first.width / 2) - natural.width * 7) < 1, key);
    for (const layout of ['home','notes-practice']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(layout => {
        document.body.firstElementChild.id=layout;
        document.querySelector('.play-stage').classList.add('play-stage--compact');
      }, layout);
      const targets = await page.locator('.answer:visible').evaluateAll(bs => bs.map(b => ({
        letter:b.dataset.letter, accidental:Number(b.dataset.accidental),
        column:Number(getComputedStyle(b).gridColumnStart), row:Number(getComputedStyle(b).gridRowStart),
        width:b.getBoundingClientRect().width, height:b.getBoundingClientRect().height,
      })));
      for (const target of targets) {
        assert.equal(target.column,(letters.indexOf(target.letter)-letters.indexOf(tonic.letter)+7)%7+1,key);
        assert.equal(target.row,target.accidental===1?1:target.accidental===0?2:3,key);
        assert.ok(target.width>=44 && target.height>=44,JSON.stringify({key,layout,target}));
      }
      assert.equal(await endpoints.filter({visible:true}).count(),1,key);
      assert.equal(targets.find(t=>t.letter===tonic.letter && t.accidental===tonic.accidental).column,1,key);
      await endpoints.filter({visible:true}).click();
      assert.deepEqual(await page.evaluate(()=>window.received.at(-1)),{letter:tonic.letter,accidental:tonic.accidental});
    }
  }
  console.log(`${engine}: all supported keys retain desktop tonic and stacked mobile spelling columns in both compact layouts; tonic clicks submit correctly.`);
} finally {
  await browser.close();
  await host.close();
}
