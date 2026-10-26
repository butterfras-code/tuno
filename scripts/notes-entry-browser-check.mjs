import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
import { notesMode, startPractice, configureMultiplayerNotes } from './notes-setup-helpers.mjs';

const name = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[name].launch();
const host = await hostBuild();
try {
  const styles = [], backgrounds = [];
  for (const mode of ['Practice', 'Challenge', 'Multi Player']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(new URL('/notes/',host.url).href);
    await notesMode(page, mode);
    if (mode === 'Practice') await startPractice(page);
    else if (mode === 'Challenge') await page.getByRole('button',{name:'Start Challenge',exact:true}).click();
    else {
      await configureMultiplayerNotes(page);
      await page.getByRole('button',{name:'Start round',exact:true}).click();
      await page.getByRole('button',{name:'Pass and Play',exact:true}).click();
      await page.getByRole('button',{name:'Continue to round',exact:true}).click();
    }
    if (mode !== 'Practice') {
      await page.getByRole('button',{name:'Ready',exact:true}).click();
      await page.clock.runFor(3050);
    } else await page.clock.runFor(50);
    const scope = page.locator(mode === 'Multi Player' ? '.multiplayer-panel' : '.practice-play');
    // No timers or animation frames can run between these submissions. A full
    // correct/miss/correct sequence must leave the next prompt ready each time.
    const result = await scope.evaluate(panel => {
      const svg = () => panel.querySelector('.staff-panel svg');
      const letter = () => {
        const y = Number(/translate\([^ ]+ ([^)]+)\)/.exec(svg().querySelector('.notehead').getAttribute('transform'))[1]);
        return 'CDEFGAB'[(4*7+2+Math.round((140-y)/10))%7];
      };
      const background = element => {
        for (let current = element; current; current = current.parentElement) {
          const color = getComputedStyle(current).backgroundColor;
          if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
        }
      };
      const backgrounds = [background(svg()), background(panel)];
      const outcomes = [];
      for (const correct of [true,false,true]) {
        const expected = letter();
        const answer = correct ? expected : expected === 'C' ? 'D' : 'C';
        const before = svg();
        panel.querySelector(`.answer[data-letter="${answer}"][data-accidental="0"]`).click();
        outcomes.push({ unlocked: [...panel.querySelectorAll('.answer')].every(b => b.getAttribute('aria-disabled') === 'false'), advanced: svg() !== before, toast: svg().querySelector('.answer-feedback')?.textContent, correct: svg().querySelector('.answer-feedback')?.dataset.correct });
      }
      const css = selector => {
        const s = getComputedStyle(panel.querySelector(selector));
        return Object.fromEntries(['fontFamily','fontSize','color','backgroundColor','borderRadius','minHeight','gridTemplateRows','gap'].map(k => [k,s[k]]));
      };
      return { outcomes, backgrounds, styles: ['.answer-natural','.answer-sharp','.answer-flat','.answers','.answer-feedback','.answer-preview','.feedback'].map(css), summary: panel.querySelector('.counts, .muted').textContent };
    });
    for (const [index,outcome] of result.outcomes.entries()) {
      assert.equal(outcome.unlocked,true,`${mode}: entry stays usable immediately`);
      assert.equal(outcome.advanced,true,`${mode}: prompt advances synchronously`);
      assert.ok(outcome.toast,`${mode}: toast follows the new staff`);
      assert.equal(outcome.correct,String(index !== 1));
    }
    assert.match(result.summary,/2 correct.*3 attempts/);
    styles.push(result.styles);
    assert.equal(result.backgrounds[0],result.backgrounds[1],`${mode}: notation and entry use the same surface color`);
    backgrounds.push(result.backgrounds);
    const focused = scope.locator('.answer-natural').first();
    await focused.focus();
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    const summary = scope.locator(mode === 'Multi Player' ? '.muted' : '.counts').first();
    assert.match(await summary.textContent(),/4 attempts/,`${mode}: held Enter submits once`);
    await page.keyboard.press('Space');
    assert.match(await summary.textContent(),/5 attempts/,`${mode}: focused Space uses the same entry path`);
    if (mode === 'Multi Player') {
      assert.deepEqual(await scope.locator('.answer-keycap').allTextContents(),['3','2','1']);
      assert.equal(await scope.locator('.answer-natural[data-letter="A"]').first().getAttribute('aria-keyshortcuts'),'Q');
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  assert.deepEqual(styles[1],styles[0],'Challenge uses the same entry and toast styling as Practice');
  assert.deepEqual(styles[2],styles[0],'Multiplayer uses the same entry and toast styling as Practice');
  assert.deepEqual(backgrounds[1],backgrounds[0],'Challenge background matches Practice');
  assert.deepEqual(backgrounds[2],backgrounds[0],'Multiplayer background matches Practice');
  console.log(`${name}: all three modes share entry and toast styles; correct and incorrect answers advance synchronously with feedback still mounted.`);
} finally { await browser.close(); await host.close(); }
