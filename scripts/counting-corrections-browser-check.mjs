import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const host = await hostBuild(), browser = await ({chromium,firefox})[engine].launch();
const output = `dist/validation/counting-corrections-${engine}`;
await mkdir(output,{recursive:true});
const report = { passed:false,engine,widths:[] };
try {
  for (const width of [320,390,1024,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},hasTouch:true});
    const page = await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('/prototypes/rhythm-walk/?fixture=half-rest',host.url).href);
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.interaction-selector button:visible').evaluateAll(buttons=>buttons.every(button=>button.scrollWidth<=button.clientWidth)),true,'Response pill labels fit without overlap');
    const slots=page.locator('.count-slot'), totals=page.locator('.counting-totals');
    const shot=async name=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${output}/${width}-${name}.png`,fullPage:true});};
    assert.equal(await slots.first().evaluate(el=>el===document.activeElement),true,'Practice load selects the first count');
    await page.getByRole('link',{name:'Settings',exact:true}).click();
    await page.getByRole('link',{name:'Practice',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.count-slot')===document.activeElement);
    assert.equal(await slots.first().evaluate(el=>el===document.activeElement),true,'returning to Practice selects the first count');
    assert.equal(await totals.textContent(),'Not yet checked');
    assert.equal(await page.locator('.treat-ratings > li').count(),1);
    await slots.nth(0).focus(); await page.keyboard.press('1');
    await shot('incomplete');
    await slots.nth(1).focus(); await page.keyboard.press('4');
    await page.getByRole('button',{name:'Check',exact:true}).click();
    assert.equal(await page.locator('.feedback-snapshot').evaluate(el=>el===document.activeElement && !el.hidden),true,'Check displays and focuses Feedback');
    assert.equal(await totals.textContent(),'4/10 · 40%');
    assert.equal(await slots.nth(1).getAttribute('data-tokens'),'incorrect');
    assert.equal(await slots.nth(2).getAttribute('data-tokens'),'missing');
    assert.equal(await slots.nth(0).getAttribute('data-rests'),'missing');
    assert.equal(await slots.nth(0).getAttribute('data-duration'),'missing');
    assert.equal(await slots.nth(0).getAttribute('data-tokens'),null);
    assert.equal(await page.locator('.passage-feedback').count(),0);
    assert.equal(await page.locator('.count-problem-marker').count(),0);
    assert.equal(await slots.nth(1).textContent(),'4');
    await page.getByRole('button',{name:'Counts',exact:true}).click();
    await slots.nth(1).focus();
    const focused = await slots.nth(1).evaluate(el => ({
      focus: getComputedStyle(el).outlineStyle,
      focusColor: getComputedStyle(el).outlineColor,
      error: getComputedStyle(el,'::before').borderStyle,
      errorColor: getComputedStyle(el,'::before').borderColor,
    }));
    assert.equal(focused.focus,'solid'); assert.equal(focused.error,'dashed');
    assert.notEqual(focused.focusColor,focused.errorColor);
    const explanation = await page.locator('.count-correction-context').textContent();
    for (const aspect of ['count','rest','connect']) assert(explanation.toLowerCase().includes(aspect));
    await shot('incorrect');
    await slots.nth(1).focus(); await page.keyboard.press('2');
    assert.equal(await slots.nth(1).getAttribute('data-tokens'),'edited');
    assert.equal(await totals.textContent(),'4/10 · 40%');
    assert.match(await page.locator('.counting-confirmation').textContent(),/awaiting/);
    await slots.nth(1).click();
    assert.match(await page.locator('.count-correction-context').textContent(),/edited, awaiting check/);
    assert.equal(await slots.nth(1).evaluate(el=>getComputedStyle(el).borderStyle),'dotted');
    assert.equal(await slots.nth(1).textContent(),'2');
    await shot('awaiting-check');
    await page.getByRole('button',{name:'Counts',exact:true}).click();
    await page.getByRole('button',{name:'Check Again',exact:true}).click();
    assert.equal(await totals.textContent(),'5/10 · 50%');
    assert.equal(await slots.nth(1).getAttribute('data-tokens'),null);
    await page.locator('.treat-details > summary').click();
    await page.locator('.counting-problem-link').last().click();
    const target = await page.evaluate(()=>{const s=document.querySelector('.passage-scroll').getBoundingClientRect(),a=document.activeElement.getBoundingClientRect();return {inside:a.left>=s.left-1&&a.right<=s.right+1,active:document.activeElement.matches('.count-slot')};});
    assert.deepEqual(target,{inside:true,active:true});
    for (const [i,key] of ['1','2','3','4','&'].entries()) {await slots.nth(i).focus();await page.keyboard.press(key);}
    await slots.nth(0).focus(); await page.keyboard.press('r'); await page.keyboard.press('c');
    assert.equal(await totals.textContent(),'5/10 · 50%');
    const checkedExercise = await page.locator('.passage').getAttribute('data-exercise-id');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.passage').getAttribute('data-exercise-id'),checkedExercise,'checking with Enter does not activate Next prematurely');
    assert.equal(await page.locator('.feedback-snapshot').evaluate(el=>el===document.activeElement && !el.hidden),true,'correct Check displays and focuses Feedback');
    assert.equal(await totals.textContent(),'10/10 · 100%');
    assert.equal(await page.locator('.counting-rating').getAttribute('data-bones'),'5');
    assert.equal(await page.locator('.count-problem-marker').count(),0);
    assert.equal(await page.getByRole('button',{name:'Next Exercise',exact:true}).isVisible(),true);
    assert.equal(await page.locator('.count-slot[data-correction], .count-slot[data-awaiting-check]').count(),0);
    // A nearly perfect checked answer earns four, and edits keep that confirmed rating.
    await page.getByRole('button',{name:'Counts',exact:true}).click();
    await slots.last().focus(); await page.keyboard.press('Backspace');
    assert.equal(await page.locator('.counting-rating').getAttribute('data-bones'),'5');
    await page.getByRole('button',{name:'Counts',exact:true}).click();
    await page.getByRole('button',{name:'Check Again',exact:true}).click();
    assert.equal(await totals.textContent(),'9/10 · 90%');
    assert.equal(await page.locator('.counting-rating').getAttribute('data-bones'),'4');
    await page.getByRole('button',{name:'Counts',exact:true}).click();
    await slots.last().focus(); await page.keyboard.press('&');
    assert.equal(await page.locator('.counting-rating').getAttribute('data-bones'),'4');
    await page.getByRole('button',{name:'Counts',exact:true}).click();
    await page.getByRole('button',{name:'Check Again',exact:true}).click();
    assert.equal(await totals.textContent(),'10/10 · 100%');
    assert.equal(await page.locator('.counting-rating').getAttribute('data-bones'),'5');
    await shot('corrected');
    const identity=await page.locator('.passage').getAttribute('data-exercise-id');
    for (const panel of ['Perform','Counts']) await page.getByRole('button',{name:panel,exact:true}).click();
    assert.equal(await totals.textContent(),'10/10 · 100%');
    assert.equal(await page.locator('.passage').getAttribute('data-exercise-id'),identity);
    await page.getByRole('button',{name:'Next Exercise',exact:true}).click();
    assert.equal(await totals.textContent(),'Not yet checked');
    assert.notEqual(await page.locator('.passage').getAttribute('data-exercise-id'),identity);
    await page.locator('[data-counting-preference="restAppearance"]').evaluate(el => { el.value='slashes'; el.dispatchEvent(new Event('change',{bubbles:true})); });
    await page.locator('[data-preset]').evaluate(el => { el.value='half-rest'; el.dispatchEvent(new Event('change',{bubbles:true})); });
    await slots.first().focus(); await page.keyboard.press('r');
    await page.getByRole('button',{name:'Check',exact:true}).click();
    await page.getByRole('button',{name:'Counts',exact:true}).click();
    assert.equal(await slots.first().evaluate(el => el.classList.contains('rest-slashed') && getComputedStyle(el,'::after').transform !== 'none' && getComputedStyle(el,'::before').borderStyle === 'dashed'),true,'Rest slashes and correction border coexist');
    for (const fixture of ['tie-across-bar','dense-sixteenths','dotted-quarter','triplet-mixed-3']) {
      await page.locator('[data-preset]').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},fixture);
      await page.getByRole('button',{name:'Check',exact:true}).click();
      await page.locator('.treat-details > summary').click();
      await page.locator('.counting-problem-link').last().click();
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>{const s=document.querySelector('.passage-scroll').getBoundingClientRect(),a=document.activeElement.getBoundingClientRect();return a.left>=s.left-1&&a.right<=s.right+1;}),true,fixture);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,fixture);
      if(fixture==='tie-across-bar') {
        const cross=await slots.evaluateAll(nodes=>{const group=nodes.filter(n=>n.dataset.duration==='missing');return group.map(n=>({id:n.dataset.unitId,measure:n.closest('[data-measure]').dataset.measure}));});
        assert(cross.some(a=>cross.some(b=>a.id===b.id&&a.measure!==b.measure)),'Tied duration markers span bars');
      }
    }
    assert.deepEqual(errors,[]); report.widths.push(width);await context.close();
  }
  report.passed=true;
} finally {await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();await host.close();}
console.log(JSON.stringify(report));
