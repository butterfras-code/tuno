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
        const toolbar = panel.querySelector('.activity-setup-toolbar');
        if (!toolbar.contains(button)) throw new Error('Start must belong to the setup toolbar');
        const p = panel.getBoundingClientRect(), b = button.getBoundingClientRect();
        const t = toolbar.getBoundingClientRect(), tabs = toolbar.querySelector('[role=tablist]').getBoundingClientRect();
        return { pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight,
          toolbarTop: t.top, tabsRight: tabs.right, actionTop: b.top, panelBottom: p.bottom, actionLeft: b.left, actionRight: b.right, actionBottom: b.bottom,
          panelScrolls: panel.scrollHeight > panel.clientHeight };
      },{panelName,action});
      assert.ok(Math.abs(geometry.actionTop-geometry.toolbarTop)<1,`${width} ${panelName}: Start at top of tab bar`);
      assert.ok(geometry.actionLeft >= geometry.tabsRight,`${width} ${panelName}: Start to the right of tabs`);
      assert.ok(geometry.pageWidth <= width,`${width} ${panelName}: horizontal page overflow`);
      assert.ok(geometry.actionLeft >= 0 && geometry.actionRight <= width,`${width} ${panelName}: action clipped`);
      if (width > 760 && panelName !== 'notes-multi player') {
        assert.ok(geometry.pageHeight <= height+1,`${width} ${panelName}: page should fit viewport`);
        assert.ok(geometry.panelBottom <= height,`${width} ${panelName}: panel should fit viewport`);
        assert.ok(geometry.actionBottom <= geometry.panelBottom || geometry.panelScrolls,`${width} ${panelName}: action must be reachable inside panel`);
      }
    };
    for (const mode of ['Practice','Challenge']) {
      await page.getByRole('navigation',{name:'tuNotes modes'}).getByRole('button',{name:mode,exact:true}).click();
      const action = page.getByRole('button',{name:`Start ${mode}`,exact:true});
      const before = await action.boundingBox();
      await page.getByRole('tab',{name:`${mode} settings`,exact:true}).click();
      const after = await action.boundingBox();
      assert.ok(Math.abs(before.y-after.y)<1,`${width} ${mode}: shared action placement`);
      assert.equal(await page.locator('#preset').isVisible(),false);
      await page.getByRole('tab',{name:'Notes',exact:true}).click();
      assert.equal(await page.locator('.preset-preview-companion .uno').isVisible(),true);
      await check(mode === 'Practice' ? 'notes-practice' : 'notes-challenge',`Start ${mode}`);
    }
    await page.getByRole('tab',{name:'Challenge settings',exact:true}).click();
    await page.getByLabel('Duration (seconds)').fill('14');
    await page.getByRole('tab',{name:'Notes',exact:true}).click();
    await page.getByRole('button',{name:'Start Challenge',exact:true}).click();
    assert.equal(await page.getByRole('tab',{name:'Challenge settings',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await page.getByLabel('Duration (seconds)').evaluate(node => node === document.activeElement),true);
    await page.getByLabel('Duration (seconds)').fill('60');
    assert.equal(await page.locator('.challenge-advanced').evaluate(node => node.open),false);
    await page.getByRole('button',{name:'Target',exact:true}).click();
    assert.equal(await page.getByLabel('Qualifying accuracy (%)').isVisible(),false);
    await page.locator('.challenge-advanced summary').click();
    assert.equal(await page.getByLabel('Qualifying accuracy (%)').isVisible(),true);
    await page.getByRole('tab',{name:'Notes',exact:true}).click();
    await page.getByRole('button',{name:'Customize…',exact:true}).click();
    assert.equal(await page.locator('#notes-challenge .custom-editor').isVisible(),true);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('navigation',{name:'tuNotes modes'}).getByRole('button',{name:'Multi Player'}).click();
    await check('notes-multi player','Start round');
    assert.equal(await page.locator('.multiplayer-roster-section').isVisible(),true);
    assert.equal(await page.locator('.multiplayer-editor').isVisible(),true);
    await page.getByRole('button',{name:'Add player'}).click();
    await page.getByLabel('Player 2 name').fill('Cancelled player');
    await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.locator('.multiplayer-player-tab').count(),1);
    await page.getByRole('button',{name:'Add player'}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
    assert.equal(await page.locator('.multiplayer-selected-summary').count(),0);
    assert.equal(await page.getByRole('tab',{name:"Player 2's Notes"}).getAttribute('aria-selected'),'true');
    await page.getByRole('tab',{name:'Multi Player Settings',exact:true}).click();
    await page.locator('.multiplayer-view').getByLabel('Duration (seconds)').fill('14');
    await page.getByRole('tab',{name:"Player 2's Notes"}).click();
    await page.getByRole('button',{name:'Start round',exact:true}).click();
    assert.equal(await page.getByRole('tab',{name:'Multi Player Settings'}).getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('.multiplayer-view').getByLabel('Duration (seconds)').evaluate(node => node === document.activeElement),true);
    await page.locator('.multiplayer-view').getByLabel('Duration (seconds)').fill('60');
    await page.getByRole('tab',{name:"Player 2's Notes"}).click();
    await page.getByRole('button',{name:'Customize…'}).click();
    assert.equal(await page.locator('#notes-multi\\ player .custom-editor').isVisible(),true);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('button',{name:'Edit Player 2',exact:true}).click();
    await page.getByLabel('Player 2 name').fill('Discarded edit');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#multiplayer-notes-tab').textContent(),"Player 2's Notes");
    await page.getByRole('button',{name:'Edit Player 2',exact:true}).click();
    await page.getByLabel('Player 2 name').fill('A'.repeat(40));
    await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
    assert.equal(await page.locator('#multiplayer-notes-tab').textContent(),`${'A'.repeat(40)}'s Notes`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,`${width}: long player name fits`);
    assert.equal(await page.locator('.multiplayer-player-fields input, .multiplayer-player-fields select').count(),0);
    const direction = width > 760 ? 'up' : 'left';
    assert.equal(await page.getByRole('button',{name:`Move Player 2 ${direction}`,exact:true}).textContent(),width > 760 ? '↑' : '←');
    await page.setViewportSize({width: width > 760 ? 360 : 1024,height});
    assert.equal(await page.getByRole('button',{name:`Move Player 2 ${width > 760 ? 'left' : 'up'}`,exact:true}).textContent(),width > 760 ? '←' : '↑');
    assert.equal(await page.locator('.multiplayer-player-controls').count(),0);
    await page.getByRole('button',{name:'Remove Player 1',exact:true}).click();
    assert.equal(await page.locator('.multiplayer-player-tab').count(),1);
    assert.equal(await page.locator('#multiplayer-notes-tab').textContent(),`${'A'.repeat(40)}'s Notes`);
    assert.equal(await page.getByRole('button',{name:'Remove Player 1',exact:true}).isDisabled(),true);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('Challenge and Multiplayer panels, disclosure, roster and custom editors fit target viewports.');
} finally { await browser.close(); await host.close(); }
