import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';

const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({chromium,firefox})[engine].launch();
const host = await hostBuild();
try {
  for (const [width,height] of [[360,800],[390,844],[768,1024],[1024,768],[1366,768]]) {
    const page = await browser.newPage({viewport:{width,height},hasTouch:true});
    const errors = []; page.on('pageerror',error => errors.push(error.message));
    await page.goto(new URL('/notes/',host.url).href);
    await page.evaluate(() => document.fonts.ready);
    const check = async (panelName, action) => {
      const geometry = await page.evaluate(({panelName,action}) => {
        const panel = document.getElementById(panelName);
        const button = [...panel.querySelectorAll('button')].find(node => node.textContent === action && !node.hidden);
        const p = panel.getBoundingClientRect(), b = button.getBoundingClientRect();
        return { pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight,
          panelBottom: p.bottom, actionLeft: b.left, actionRight: b.right, actionBottom: b.bottom,
          panelScrolls: panel.scrollHeight > panel.clientHeight };
      },{panelName,action});
      assert.ok(geometry.pageWidth <= width,`${width} ${panelName}: horizontal page overflow`);
      assert.ok(geometry.actionLeft >= 0 && geometry.actionRight <= width,`${width} ${panelName}: action clipped`);
      if (width > 760) {
        assert.ok(geometry.pageHeight <= height+1,`${width} ${panelName}: page should fit viewport`);
        assert.ok(geometry.panelBottom <= height,`${width} ${panelName}: panel should fit viewport`);
        assert.ok(geometry.actionBottom <= geometry.panelBottom || geometry.panelScrolls,`${width} ${panelName}: action must be reachable inside panel`);
      }
    };
    await page.getByRole('navigation',{name:'tuNotes modes'}).getByRole('button',{name:'Challenge'}).click();
    await check('notes-challenge','Start Challenge');
    assert.equal(await page.locator('.challenge-advanced').evaluate(node => node.open),false);
    await page.getByRole('button',{name:'Target',exact:true}).click();
    assert.equal(await page.getByLabel('Qualifying accuracy (%)').isVisible(),false);
    await page.locator('.challenge-advanced summary').click();
    assert.equal(await page.getByLabel('Qualifying accuracy (%)').isVisible(),true);
    await page.getByRole('button',{name:'Adjust range'}).click();
    assert.equal(await page.locator('#notes-challenge .custom-editor').isVisible(),true);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('navigation',{name:'tuNotes modes'}).getByRole('button',{name:'Multi Player'}).click();
    await check('notes-multi player','Start round');
    assert.equal(await page.locator('.multiplayer-roster-section').isVisible(),true);
    assert.equal(await page.locator('.multiplayer-editor').isVisible(),true);
    await page.getByRole('button',{name:'Add player'}).click();
    assert.match(await page.locator('.multiplayer-selected-summary').textContent(),/Player 2/);
    await page.getByRole('button',{name:'Adjust range'}).click();
    assert.equal(await page.locator('#notes-multi\\ player .custom-editor').isVisible(),true);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('Challenge and Multiplayer panels, disclosure, roster and custom editors fit target viewports.');
} finally { await browser.close(); await host.close(); }
