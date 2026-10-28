import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { uilScenarios } from './rhythm-uil-browser-scenarios.js';
const engine=process.env.TUNO_BROWSER||'chromium',host=await hostBuild(),browser=await ({chromium,firefox})[engine].launch();
const output=`dist/validation/uil-${engine}`;await mkdir(output,{recursive:true});const report=[];
try {
 for(const width of [320,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/prototypes/rhythm-walk/?fixture=uil-figures',host.url).href);
  report.push({width,...await uilScenarios(page)});
  await page.reload();
  await page.getByRole('button',{name:'Choose rhythms',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Choose rhythms',exact:true});
  await dialog.getByRole('tab',{name:'UIL Sight Reading',exact:true}).click();
  assert.equal(await dialog.getByRole('combobox',{name:'UIL instrument scope',exact:true}).inputValue(),'percussion');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.ok((await page.locator('.count-slot').allTextContents()).every(v=>v==='·'));
  for(const vocabulary of ['numbers','syllables']) {
   await page.getByRole('button',{name:'Counts',exact:true}).click();
   await page.evaluate(vocabulary=>{
    const choose=(selector,value)=>{const n=document.querySelector(selector);n.value=value;n.dispatchEvent(new Event('change',{bubbles:true}));};
    choose('[data-counting-preference="vocabulary"]',vocabulary);
    choose('[data-preset]','uil-percussion');
   },vocabulary);
   const tokens=vocabulary==='numbers'?['1','&','a','2','e','&','a','3','4']:['1','te','ta','2','ta','te','ta','3','4'];
   assert.equal(await page.locator('.count-slot').count(),tokens.length);
   for(let i=0;i<tokens.length;i++){await page.locator('.count-slot').nth(i).focus();await page.keyboard.type(tokens[i]);}
   assert.deepEqual(await page.locator('.count-slot').allTextContents(),tokens);
   await page.getByRole('button',{name:'Check',exact:true}).click();
   assert.equal(await page.locator('.count-slot[data-tokens]').count(),0);
  }
  await page.screenshot({path:`${output}/${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(`${output}/report.json`,JSON.stringify({passed:true,engine,report},null,2));console.log(JSON.stringify(report));
} finally {await browser.close();await host.close();}
