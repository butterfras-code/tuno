import assert from 'node:assert/strict';
import { viewportProfiles } from './viewport-profiles.mjs';
import { startPractice } from './notes-setup-helpers.mjs';

export async function checkAutoEvery(browser,host) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror',e => errors.push(e.message));
  const layouts = async screen => {
    for (const profile of viewportProfiles) {
      await page.setViewportSize(profile.viewport);
      if (screen === 'setup') await page.locator('.auto-selected').scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),profile.id + ' ' + screen);
      await page.screenshot({path:`dist/validation/auto-every/${browser.browserType().name()}/${profile.id}-${screen}.png`});
    }
  };
  try {
    await page.addInitScript(() => {
      window.practiceClicks = [];
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function(time) {
        window.practiceClicks.push({frequency:this.frequency.value,time});
        return start.call(this,time);
      };
    });
    await page.goto(new URL('/notes/',host.url).href);
    await page.getByRole('button',{name:'Auto Every',exact:true}).click();
    await page.getByLabel('Note duration').selectOption('2');
    await page.getByLabel('Show next note').check();
    await page.getByLabel('Metronome',{exact:true}).check();
    await layouts('setup');
    await startPractice(page);
    const play = page.locator('.practice-play:visible');
    const current = play.locator('.staff').first();
    await play.locator('.upcoming-note').waitFor();
    assert.equal(await current.getAttribute('data-value'),'dotted-half');
    await page.waitForFunction(() => window.practiceClicks.length >= 5);
    const clicks = await page.evaluate(() => window.practiceClicks.slice(0,5));
    assert.deepEqual(clicks.map(c => c.frequency),[1500,1000,1000,1500,1000]);
    assert.ok(Math.abs(clicks[4].time - clicks[1].time - 2.25) < .08,'next group keeps tempo');
    await layouts('playing');
    await play.getByRole('button',{name:'Metronome on'}).click();
    await play.getByRole('button',{name:'Pause',exact:true}).click();
    await play.getByRole('button',{name:'Resume',exact:true}).click();
    assert.match(await play.locator('.practice-beats').textContent(),/Count in/);
    await play.locator('.upcoming-note').waitFor();
    const preview = (await play.locator('.upcoming-note').getAttribute('aria-label')).replace(/^Next note, /,'');
    const initial = await current.getAttribute('aria-label');
    const positions = ['first line','first space','second line','second space','third line','third space','fourth line','fourth space','fifth line'];
    const letter = 'efgabcdef'[positions.findIndex(value => initial.includes(value))];
    assert.ok(letter);
    await page.keyboard.press(letter === 'f' ? 'g' : 'f');
    assert.equal(await play.locator('.answer-feedback-announcement').textContent(),'Try again');
    await page.keyboard.press(letter);
    assert.match(await play.locator('.counts').textContent(),/1 correct/);
    assert.equal(await current.getAttribute('aria-label'),initial);
    await page.waitForFunction(() => document.querySelector('.practice-play .answer')?.getAttribute('aria-disabled') === 'false');
    assert.equal(await current.getAttribute('aria-label'),preview);
    await play.getByRole('button',{name:'Finish',exact:true}).click();
    const results = page.locator('.practice-results:visible');
    await results.waitFor();
    await layouts('results');
    assert.deepEqual(errors,[]);
  } finally { await page.close(); }
}
