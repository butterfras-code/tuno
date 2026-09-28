import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { setToggle, setPacing, notesMode } from './notes-setup-helpers.mjs';
const browser = await ({chromium,firefox})[process.env.TUNO_BROWSER || 'chromium'].launch();
const host = await hostBuild();
try {
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(host.url+'notes/');
  await setToggle(page,'meet-notes',false);
  const action = name => page.getByRole('button',{name,exact:true});
  const stats = () => page.locator('#practice-counts').textContent();
  const pitch = () => page.locator('.staff').getAttribute('aria-label');
  const correct = async () => {
    const label = await pitch();
    const positions = ['first line','first space','second line','second space','third line','third space','fourth line','fourth space','fifth line'];
    await page.keyboard.press('efgabcdef'[positions.findIndex(value=>label.includes(value))]);
  };
  await action('Start Practice').click();
  for (let i=0;i<5;i++) { await correct(); await page.waitForTimeout(300); }
  assert.match(await stats(),/5 correct \/ 5 attempts.*Streak 5 \(best 5\)/);
  assert.match(await page.locator('.encouragement').textContent(),/5 in a row/);
  await page.waitForTimeout(2300); assert.equal(await page.locator('.encouragement').isVisible(),false);
  const before = await pitch();
  await page.locator('.answer[data-letter="C"][data-accidental="1"]').first().click();
  assert.match(await stats(),/5 correct \/ 6 attempts.*Streak 0 \(best 5\)/);
  assert.match(await page.locator('#feedback').textContent(),/That note is/);
  await page.waitForTimeout(850); assert.notEqual(await pitch(),before);
  // Keyboard and assistive clicks must count out-of-pool guesses too.
  await page.keyboard.down('ArrowDown'); await page.keyboard.press('d'); await page.keyboard.up('ArrowDown');
  assert.match(await stats(),/5 correct \/ 7 attempts/); await page.waitForTimeout(850);
  await page.locator('.answer[data-letter="F"][data-accidental="1"]').evaluate(b=>b.click());
  assert.match(await stats(),/5 correct \/ 8 attempts/); await page.waitForTimeout(850);
  await action('Finish').click(); await action('Edit setup').click();
  await setPacing(page,'Correct'); await page.reload(); await notesMode(page,'Options');
  assert.equal(await action('Correct').getAttribute('aria-pressed'),'true'); await notesMode(page,'Practice');
  await setToggle(page,'meet-notes',false); await action('Start Practice').click();
  const retry = await pitch();
  await page.locator('.answer[data-letter="C"][data-accidental="1"]').first().click();
  assert.match(await stats(),/0 correct \/ 1 attempts.*Streak 0/);
  await page.waitForTimeout(850); assert.equal(await pitch(),retry);
  await correct(); assert.match(await stats(),/1 correct \/ 2 attempts.*Streak 1/);
  await page.waitForTimeout(300); assert.notEqual(await pitch(),retry);
  assert.deepEqual(errors,[]);
  console.log('Out-of-pool pointer/keyboard/assistive guesses count as misses; default advances; streak resets, best streak persists, toast expires; Correct retries and persists.');
} finally { await browser.close(); await host.close(); }
