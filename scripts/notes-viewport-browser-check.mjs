import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { hostBuild } from './test-host.mjs';
import { setToggle } from './notes-setup-helpers.mjs';

const engine = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({chromium,firefox})[engine].launch();
const host = await hostBuild();
await mkdir('dist/validation',{recursive:true});
const button = (page,name) => page.getByRole('button',{name,exact:true});
async function check(page,label) {
  await page.clock.runFor(100);
  // Fullscreen window resizing is asynchronous, especially in Firefox. Wait
  // for the fitter's next layout before inspecting individual controls.
  await page.waitForFunction(() => {
    const stage=document.querySelector('.play-stage'), viewport=document.querySelector('.play-viewport');
    if (!stage || !viewport) return false;
    const s=stage.getBoundingClientRect(), v=viewport.getBoundingClientRect();
    return Math.abs(s.width-v.width)<1 && Math.abs(s.bottom-v.bottom)<1;
  },undefined,{timeout:3000});
  const geometry = await page.evaluate(() => {
    const visible = node => node.getClientRects().length && !node.closest('[hidden]');
    const stage = document.querySelector('.play-stage');
    const targets = [...document.querySelector('.play-viewport').querySelectorAll('.answer, .staff-panel, button')].filter(visible);
    const failures = [];
    for (const target of targets) {
      const r = target.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.left < -1 || r.top < -1 || r.right > innerWidth+1 || r.bottom > innerHeight+1) failures.push(`${target.className}: outside viewport`);
      for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent), p = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(css.overflowY) && (r.top < p.top-1 || r.bottom > p.bottom+1)) failures.push(`${target.className}: clipped vertically by ${parent.className}`);
        if (/(auto|scroll|hidden|clip)/.test(css.overflowX) && (r.left < p.left-1 || r.right > p.right+1)) failures.push(`${target.className}: clipped horizontally by ${parent.className}`);
      }
    }
    const panels = [...stage.querySelectorAll('.multiplayer-panel,.practice-play')].filter(visible);
    return {failures,answers: targets.filter(n=>n.matches('.answer')).length,
      scroll: panels.map(n=>({height:n.clientHeight,content:n.scrollHeight})),
      page: [document.documentElement.scrollWidth,document.documentElement.scrollHeight],viewport:[innerWidth,innerHeight]};
  });
  assert.deepEqual(geometry.failures,[],`${label}: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.page[0]<=geometry.viewport[0]+1 && geometry.page[1]<=geometry.viewport[1]+1,`${label}: page scrolls`);
  for (const panel of geometry.scroll) assert.ok(panel.content<=panel.height+1,`${label}: play content overflows ${JSON.stringify(panel)}`);
  return geometry;
}
try {
  // 2560×1440 is the CSS viewport of a fullscreen 4K display at 150% zoom.
  for (const [width,height] of [[3840,2160],[2560,1440],[1920,1080],[1184,1104],[1366,768],[1024,768],[960,600],[390,844],[844,390]]) {
    for (const mode of ['Practice','Challenge','Turns','Split Screen','Head to Head']) {
      const page = await browser.newPage({viewport:{width,height},hasTouch:engine==='chromium'});
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.clock.install(); await page.goto(new URL('/notes/',host.url).href);
      await page.evaluate(()=>document.fonts.ready);
      if (mode === 'Practice') {
        await setToggle(page,'meet-notes',false);
        await button(page,'Start Practice').click();
      } else if (mode === 'Challenge') {
        await button(page,'Challenge').click();await button(page,'Start Challenge').click();
      } else {
        await button(page,'Multi Player').click();
        await button(page,'Add player').click();await button(page.getByRole('dialog'),'Save').click();
        await page.getByRole('tab',{name:'Multi Player Settings'}).click();await button(page,mode).click();
        assert.equal(await button(page,'Start round').isDisabled(),false);
        await button(page,'Start round').click();
      }
      const label=`${engine} ${width}×${height} ${mode}`;
      await check(page,`${label} ready`);
      if (mode !== 'Practice') {await button(page,'Ready').click();await page.clock.runFor(3100);}
      assert.ok((await check(page,`${label} playing`)).answers>0,`${label}: answers displayed`);
      if(width===1920 || width===390) await page.screenshot({path:`dist/validation/viewport-${engine}-${width}-${mode.replaceAll(' ','-')}.png`});
      // Pointer targeting must still work through any fitting transform/rotation.
      const lanes=page.locator('.multiplayer-panel');
      if(await lanes.count()) {
        for(const lane of await lanes.all()) {await lane.locator('.answer-natural').first().click();assert.match(await lane.locator('.muted').first().textContent(),/1 attempts/);}
      } else {await page.locator('.answer-natural:visible').first().click();}
      await check(page,`${label} feedback`);
      await button(page,'Pause').click();await check(page,`${label} paused`);
      await button(page,'Resume').click();await check(page,`${label} resumed`);
      if (width===1920 && await button(page,'Enter fullscreen').isVisible()) {
        await button(page,'Enter fullscreen').click();
        await page.waitForFunction(()=>Boolean(document.fullscreenElement));
        await check(page,`${label} fullscreen`);
        await button(page,'Exit fullscreen').click();
        await page.waitForFunction(()=>!document.fullscreenElement);
        if (await button(page,'Resume').isVisible()) await button(page,'Resume').click();
        await check(page,`${label} exited fullscreen`);
      }
      if (mode==='Split Screen') {
        await page.setViewportSize({width:760,height:600});await page.clock.runFor(100);
        assert.equal(await button(page,'Pause').isVisible(),true,'Resize must not pause or disable Split Screen');
        assert.equal(await page.locator('.multiplayer-fit-warning').isVisible(),true);
        const switchButton=await button(page,'Switch to Turns').boundingBox();
        assert.ok(switchButton.height>=44,'Turns warning remains a usable touch target');
        await check(page,`${label} resized`);
        await button(page,'Switch to Turns').click();
        assert.equal(await lanes.count(),1);await check(page,`${label} switched to turns`);
      }
      assert.deepEqual(errors,[]);await page.close();
      console.log(`${label}: fits`);
    }
  }
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.clock.install();await page.goto(new URL('/notes/',host.url).href);
  await button(page,'Options').click();await page.getByLabel('Classroom display',{exact:true}).check();
  await page.reload();await button(page,'Options').click();
  assert.equal(await page.getByLabel('Classroom display',{exact:true}).isChecked(),true,'Classroom setting persists on this display');
  await button(page,'Practice').click();await setToggle(page,'meet-notes',false);await button(page,'Start Practice').click();
  await check(page,'Classroom display');
  const large=await page.locator('.answer-natural:visible').first().boundingBox();
  await button(page,'Options').click();await page.getByLabel('Classroom display',{exact:true}).uncheck();await button(page,'Practice').click();
  await check(page,'Automatic display size');
  const automatic=await page.locator('.answer-natural:visible').first().boundingBox();
  assert.ok(large.height>automatic.height*1.1,'Classroom preference enlarges controls');
  await page.close();
  // Introduction controls and staff also fit, including reduced-motion navigation.
  for (const [width,height] of [[390,844],[844,390],[3840,2160]]) {
    const intro=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    await intro.clock.install();await intro.goto(new URL('/notes/',host.url).href);
    await button(intro,'Start Practice').click();await check(intro,`${width} intro`);
    const staff=await intro.locator('.preview-staff').boundingBox();
    assert.ok(staff.height>0 && staff.y>=0 && staff.y+staff.height<=height,`${width}: intro staff fits`);
    await intro.close();
  }
} finally {await browser.close();await host.close();}
