import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';
const engine = process.env.TUNO_BROWSER || 'chromium';
const host = await hostBuild();
const browser = await ({ chromium, firefox })[engine].launch(engine === 'chromium' ? { args: ['--autoplay-policy=no-user-gesture-required'] } : { firefoxUserPrefs: { 'media.autoplay.default': 0 } });
const output = `dist/validation/responsive-workspace-${engine}`;
const assessmentSource = await readFile(new URL('./rhythm-assessment-browser-scenarios.js', import.meta.url), 'utf8');
const report = { passed: false, engine, layouts: [], assessments: [], physicalDeviceChecks: 'not performed' };
await mkdir(output, { recursive: true });
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const url = new URL('/prototypes/rhythm-walk/', host.url).href;
    await page.goto(url); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${width}-default.png`, fullPage: true });
    await page.goto(`${url}?fixture=dense-sixteenths`);
    const layouts = await page.evaluate(async () => {
      const checks = [], q = s => document.querySelector(s), all = s => [...document.querySelectorAll(s)];
      const check = (value, label) => { if (!value) throw Error(label); checks.push(label); };
      const settle = () => new Promise(r => setTimeout(r, 100));
      const panel = name => all('.interaction-selector button').find(b => b.textContent === name).click();
      const choose = (selector, value) => { const input = q(selector); input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); };
      const rect = selector => q(selector).getBoundingClientRect();
      const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      check(!q('.shared-controls') && !all('#practice-view summary').some(el => el.textContent === 'Exercise settings'), 'Practice omits the extra Exercise settings disclosure');
      all('button').find(b => b.getAttribute('aria-label') === 'Customize next exercise').click();
      check(q('.custom-exercise-dialog').open && q('.custom-exercise-dialog [data-level-details]') && q('.custom-exercise-dialog .testing-fixtures'), 'Customize retains level requirements and opt-in testing fixtures');
      q('[data-level-details]').open = true; await settle();
      check(visible(q('[data-level-details] p')) && q('.custom-exercise-dialog').scrollWidth <= q('.custom-exercise-dialog').clientWidth, 'Requirements remain readable without dialog overflow');
      q('.custom-exercise-dialog').close(); await settle();
      const header = rect('.app-header');
      check(all('.app-header > *').filter(visible).every(el => { const r = el.getBoundingClientRect(); return r.top >= header.top && r.bottom <= header.bottom; }), 'Header controls remain within the shared header');
      check(!q('[aria-label="Mode"]') && all('.interaction-selector button').length===2, 'Counts and Perform are the only response selector');
      const level = rect('.level-configuration'), bag = rect('.feedback-snapshot');
      check(Math.abs(level.top - bag.top) < 1 && level.right <= bag.left, 'Level and feedback share a horizontal row');
      panel('Perform');
      const ratings = all('.treat-ratings > li');
      check(ratings.length === 4 && ratings.every(el => !visible(el)), 'Unscored dimensions stay compact until review');
      check(ratings.every(el => el.dataset.bones === '' && el.textContent.includes('Not yet scored')), 'Unscored state never implies zero bones');
      check(q('.feedback-snapshot').dataset.scored === 'false', 'Feedback is quiet before scoring');
      check(q('.performance-setup').querySelectorAll('input[type=checkbox]').length===2, 'Perform contains metronome and written-count controls');
      check(!q('.counting-rating') && q('.passage').classList.contains('counts-hidden'), 'Perform shows performance feedback and hides written counts by default');
      const showCounts = all('.performance-setup label').find(label=>label.textContent.includes('Show written counts')).querySelector('input');
      showCounts.checked=true; showCounts.dispatchEvent(new Event('change'));
      check(!q('.passage').classList.contains('counts-hidden') && all('.answer-area').every(area=>area.inert), 'Perform can show read-only written counts');
      showCounts.checked=false; showCounts.dispatchEvent(new Event('change'));
      panel('Counts');
      check(q('.counting-rating') && !q('[data-metric="rhythm"]') && !q('.passage').classList.contains('counts-hidden'), 'Counts restores editable counts and counting-only feedback');
      for (const fixture of ['dense-sixteenths', 'dotted-quarter', 'tie-across-bar', 'half-rest', 'triplet-mixed-3']) {
        choose('[data-preset]', fixture); await settle();
        const bars = all('.plan-measure').map(el => el.getBoundingClientRect());
        check(bars.every(r => Math.abs(r.top - bars[0].top) < 1), `${fixture}: continuous music`);
        const scroll = q('.passage-scroll');
        check(q('.rhythm-overview').hidden === (scroll.scrollWidth <= scroll.clientWidth + 1), `${fixture}: conditional minimap`);
        check(rect('.shared-interaction').top >= rect('.passage').bottom - 1, `${fixture}: dock clears notation and mode controls`);
        check(document.documentElement.scrollWidth <= innerWidth, `${fixture}: no page overflow`);
        const tokens = all('[data-count-id]');
        if (tokens.length) {
          tokens.at(-1).click(); await settle();
          const last = tokens.at(-1).getBoundingClientRect(), view = scroll.getBoundingClientRect();
          check(last.left >= view.left - 1 && last.right <= view.right + 1, `${fixture}: selection following retained`);
        }
      }
      choose('[data-preset]', 'half'); await settle();
      q('[data-count-id]').click(); document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }));
      const answer = all('[data-count-id]').map(el => el.textContent).join('|'), identity = q('.passage').dataset.exerciseId;
      for (const name of ['Perform', 'Counts']) panel(name);
      check(answer === all('[data-count-id]').map(el => el.textContent).join('|') && q('.passage').dataset.exerciseId === identity, 'Modes retain written answers and exercise');
      choose('[data-setting="teaching-preset"]', 'uno-2');
      check(answer === all('[data-count-id]').map(el => el.textContent).join('|') && q('.passage').dataset.exerciseId === identity && q('.exercise-summary').textContent.includes('Pending settings'), 'Level applies to next exercise without replacing responses');
      all('.write-actions button').find(b => b.textContent === 'Check').click();
      q('.treat-details').open = true; await settle();
      check(visible(q('.treat-details .counting-problem-link, .treat-details p')) && rect('.exercise-overview-row').bottom <= rect('.passage').top, 'Expanded feedback remains in flow above the score');
      q('.treat-details').open = false;
      return { width: innerWidth, assertions: checks.length, checks };
    });
    report.layouts.push(layouts);
    for (const height of [568, 420, 844]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
      for (const y of [0, 120, 260]) {
        await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(60);
        assert.ok(await page.evaluate(() => {
          const q = s => document.querySelector(s), dock = q('.shared-interaction').getBoundingClientRect(), mode = q('.passage').getBoundingClientRect(), area = q('.practice-workspace').getBoundingClientRect();
          const noArtificialGap = q('.practice-workspace').classList.contains('dock-roomy') || dock.top - mode.bottom < 20;
          return noArtificialGap && dock.top >= mode.bottom - 1 && dock.bottom <= area.bottom + 1 && document.documentElement.scrollWidth <= innerWidth;
        }), `${width}x${height}: dock stays inside workspace and never overlays preceding content`);
      }
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.exposeFunction('__assessmentSnapshot', async () => {
      await page.getByRole('button', {name:'Perform',exact:true}).click();
      await page.locator('.treat-details').evaluate(el => { el.open = true; });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
      assert.equal(await page.locator('.treat-ratings > li:not(.counting-rating)').count(), 4);
      assert.ok(await page.locator('[data-metric="hold"]').getAttribute('data-bones'));
      await page.screenshot({ path: `${output}/${width}-expanded-feedback.png`, fullPage: true });
      await page.getByRole('button', {name:'Perform',exact:true}).click();
    });
    await page.evaluate(() => { window.__assessmentScenario = 'accepted'; });
    await page.addScriptTag({ content: assessmentSource });
    report.assessments.push(await page.evaluate(() => window.__assessmentCheck));
    // Additional Tap and silent-capture checks keep hold placeholders honest.
    if (width === 390) {
      await page.evaluate(() => { window.__assessmentSnapshot = undefined; });
      for (const scenario of ['keyboard', 'no-input', 'cancellation']) {
        await page.evaluate(s => { window.__assessmentScenario = s; }, scenario);
        await page.addScriptTag({ content: assessmentSource });
        report.assessments.push(await page.evaluate(() => window.__assessmentCheck));
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  report.passed = true;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await host.close();
}
