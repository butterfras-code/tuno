import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
const engine=process.env.TUNO_BROWSER||'chromium',host=await hostBuild(),browser=await ({chromium,firefox})[engine].launch();
const output=`dist/validation/uil-${engine}`;await mkdir(output,{recursive:true});const report=[];
try {
 for(const width of [320,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/prototypes/rhythm-walk/?fixture=uil-figures',host.url).href);
  await page.addScriptTag({content:await readFile(new URL('./rhythm-uil-browser-scenarios.js',import.meta.url),'utf8')});
  report.push({width,...await page.evaluate(()=>uilScenarios())});
  await page.reload();assert.equal(await page.locator('[data-setting="instrument-scope"]').inputValue(),'percussion');
  assert.ok((await page.locator('.count-slot').allTextContents()).every(v=>v==='·'));
  for(const vocabulary of ['numbers','syllables']) {
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
