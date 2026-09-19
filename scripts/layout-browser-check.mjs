import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';

const engine = ({ chromium, firefox })[process.env.TUNO_BROWSER || 'chromium'];
const directory = process.env.TUNO_SCREENSHOT_DIR || 'dist/validation/layout';
await mkdir(directory, { recursive: true });
const host = await hostBuild();
const browser = await engine.launch();
const findings = [];
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const inspect = async (width, view) => {
    const issues = await page.evaluate(() => {
      const issues = [];
      if (document.documentElement.scrollWidth > innerWidth) issues.push('horizontal overflow');
      const visible = el => {
        if (!el.checkVisibility() || !el.getBoundingClientRect().width) return false;
        const rail = el.closest('.octave-rail');
        if (!rail) return true;
        const box = el.getBoundingClientRect(), clip = rail.getBoundingClientRect();
        return box.top >= clip.top && box.bottom <= clip.bottom;
      };
      const controls = [...document.querySelectorAll('nav button, main button, main select, main input:not([type=range]), .tool-strip button, .tool-strip input')]
        .filter(el => visible(el) && !el.closest('.piano, [popover]'));
      for (const el of controls) {
        const box = el.getBoundingClientRect();
        const name = el.getAttribute('aria-label') || el.textContent;
        if (box.left < -1 || box.right > innerWidth + 1) issues.push(`${name}: outside viewport`);
        const parent = el.closest('.practice-surface, .tool-card, nav').getBoundingClientRect();
        if (box.left < parent.left - 1 || box.right > parent.right + 1 || box.top < parent.top - 1 || box.bottom > parent.bottom + 1) issues.push(`${name}: outside container`);
      }
      for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i].getBoundingClientRect(), b = controls[j].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1)
          issues.push(`overlap: ${controls[i].getAttribute('aria-label') || controls[i].textContent} / ${controls[j].getAttribute('aria-label') || controls[j].textContent}`);
      }
      return issues;
    });
    findings.push({ width, view, issues });
    assert.deepEqual(issues, [], `${width}px ${view}`);
  };
  for (const width of [320, 360, 375, 390, 414, 430, 650, 768, 1120]) {
    await page.setViewportSize({ width, height: width === 1120 ? 820 : 900 });
    await page.goto(host.url);
    await page.evaluate(() => document.fonts.ready);
    const nav = page.getByRole('navigation');
    for (const [name, view] of [['Tuner', 'tune'], ['Reference tone', 'tone'], ['Metronome', 'tempo']]) {
      await nav.getByRole('button', { name, exact: true }).click();
      await inspect(width, view);
      await page.screenshot({ path: `${directory}/${engine.name()}-${width}-${view}.png`, fullPage: true });
    }
    const tempo = page.getByLabel('Tempo (BPM)', { exact: true });
    await tempo.fill('240'); await tempo.press('Enter');
    await inspect(width, 'tempo-240');
    await page.getByRole('button', { name: 'View · Uno', exact: true }).click();
    assert.equal(await page.locator('.beat:visible').count(), 1, 'Numbers also works for one free pulse');
    await page.getByLabel('Meter', { exact: true }).selectOption('4/4');
    const accent = page.getByRole('button', { name: 'Accent beat 3', exact: true });
    await accent.click(); assert.equal(await accent.getAttribute('aria-pressed'), 'true');
    await accent.click(); assert.equal(await accent.getAttribute('aria-pressed'), 'false');
    await inspect(width, 'numbers-240');
    await page.screenshot({ path: `${directory}/${engine.name()}-${width}-numbers.png`, fullPage: true });
    await tempo.fill('96'); await tempo.press('Enter');
    for (const [trigger, option] of [['Tuner accuracy', 'BEG'], ['Note', 'A'], ['Octave', '4'], ['Quick subdivision', '7']]) {
      await page.getByRole('button', { name: trigger, exact: true }).click();
      const menu = page.locator('.selector-popup:popover-open');
      const bounds = await menu.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 901);
      await menu.getByRole('menuitemradio', { name: option, exact: true }).click();
      assert.equal(await menu.count(), 0);
      assert.equal(await page.locator('#view-metronome').isVisible(), true, 'Quick selectors preserve focus view');
    }
    await page.locator('.tool-card').nth(1).getByRole('button', { name: '40%', exact: true }).click();
    const slider = page.getByLabel('Quick tone volume', { exact: true });
    await slider.fill('63'); await slider.press('ArrowRight');
    await page.screenshot({ path: `${directory}/${engine.name()}-${width}-volume.png`, fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.tool-card').nth(1).getByRole('button', { name: '64%', exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Start metronome', exact: true }).first().click();
    await page.waitForFunction(() => document.querySelector('.beat[aria-current="true"]'));
    await inspect(width, 'playing');
    await page.getByRole('button', { name: 'Stop metronome', exact: true }).first().click();
    assert.ok(await page.locator('.tool-tap img').getAttribute('src').then(src => src.startsWith('data:image/svg+xml')));
  }
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/${engine.name()}-results.json`, JSON.stringify(findings, null, 2));
  console.log(`${engine.name()}: ${findings.length} layout checks; all views, 9 widths, popovers, live beats, 240 BPM and SVG tap target passed.`);
} finally { await browser.close(); await host.close(); }
