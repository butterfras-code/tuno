import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { hostBuild } from './test-host.mjs';

const host = await hostBuild();
try {
  for (const engine of [({ chromium, firefox, webkit })[process.env.TUNO_BROWSER || 'chromium']]) {
    const browser = await engine.launch();
    try {
      for (const mobile of [false, true]) {
        const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1120, height: 1000 }, hasTouch: mobile });
        const page = await context.newPage();
        await page.goto(host.url);
        if (mobile) await page.getByRole('tab', { name: 'Tempo', exact: true }).click();
        else await page.getByRole('navigation').getByRole('button', { name: 'Metronome', exact: true }).click();
        await page.getByLabel('Meter', { exact: true }).selectOption('4/4');
        const main = page.getByLabel('Tempo (BPM)', { exact: true });
        const quick = page.getByLabel('Quick tempo (BPM)', { exact: true });
        for (const numbered of [false, true]) {
          const toggle = page.locator('.beat-mode');
          if ((await toggle.getAttribute('aria-pressed')) !== String(numbered)) await toggle.click();
          for (const input of [main, quick]) {
            await input.fill('100');
            await input.press('Enter');
            if (mobile) await input.tap(); else await input.click();
            await page.keyboard.type('123');
            await input.press('Enter');
            assert.equal(await main.inputValue(), '123');
            assert.equal(await quick.inputValue(), '123');
            const box = await input.boundingBox();
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x, y - 60, { steps: 10 });
            await page.mouse.up();
            assert.equal(await input.inputValue(), '133');
            assert.equal(await input.evaluate(node => node === document.activeElement), false);
            await input.hover();
            await page.mouse.wheel(0, 100);
            await page.waitForFunction(() => document.querySelector('.tempo-input').value === '132');
            await input.fill('240');
            await input.press('Enter');
            await input.dispatchEvent('wheel', { deltaY: -100 });
            assert.equal(await input.inputValue(), '240');
            await input.fill('30');
            await input.press('Enter');
            await input.dispatchEvent('wheel', { deltaY: 100 });
            assert.equal(await input.inputValue(), '30');
            await input.fill('999');
            await input.press('Tab');
            assert.equal(await input.inputValue(), '30');
            await input.fill('120');
            await input.press('Escape');
            assert.equal(await input.inputValue(), '30');
            if (mobile && engine === chromium) {
              const touch = await context.newCDPSession(page);
              await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
              await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 60, y }] });
              await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
              assert.equal(await input.inputValue(), '40');
              assert.equal(await input.evaluate(node => node === document.activeElement), false);
              await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
              await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
              await input.tap();
              await page.keyboard.type('90');
              await input.press('Enter');
              assert.equal(await input.inputValue(), '90');
              await touch.detach();
            }
          }
        }
        await context.close();
      }
      console.log(`${engine.name()}: tempo editing, dragging, wheel, bounds, and cancellation passed at desktop and mobile sizes`);
    } finally { await browser.close(); }
  }
} finally { await host.close(); }
