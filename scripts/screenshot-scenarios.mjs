import assert from 'node:assert/strict';
import { choosePreset, startPractice, notesMode, configureMultiplayerNotes, openRange, openCustom, rangeDialog, setKey, setModifiers } from './notes-setup-helpers.mjs';

const button = (page, name) => page.getByRole('button', { name, exact: true });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function fingering(page, instrument, count) {
  await choosePreset(page, instrument === 'violin' ? 'violin-starter' : 'trumpet-bb-starter');
  await startPractice(page);
  await page.getByRole('button', { name: /^Choose instrument/ }).click();
  await page.getByRole('dialog', { name: 'Choose instrument', exact: true }).locator(`[data-instrument="${instrument}"]`).click();
  // Use the real layout controls, including Flip, rather than altering CSS for a shot.
  for (let attempt = 0; attempt < 3 && await page.locator('.note-entry:visible').getAttribute('data-grip-position') !== 'right'; attempt++) {
    await page.getByRole('button', { name: /^Move Panel:/ }).click();
  }
  await settle(page);
  const valves = page.locator('.fingering-valve:visible');
  assert.equal(await valves.count(), count);
  const ascending = instrument === 'violin';
  const positions = () => valves.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y));
  let ys = await positions();
  if ((ys[0] < ys[1]) !== ascending) {
    await button(page, 'Adjust Input').click();
    await button(page, 'Flip finger order').click();
    await button(page, 'Done').click();
    await settle(page);
    ys = await positions();
  }
  assert.ok(ys.every((y, i) => !i || (ascending ? y > ys[i - 1] : y < ys[i - 1])), `${instrument}: incorrect finger order`);
  const viewport = page.viewportSize();
  const input = await page.locator('.note-entry:visible').boundingBox();
  assert.ok(input.x >= viewport.width / 2, `${instrument}: input must be on the right`);
  for (const valve of await valves.all()) {
    const box = await valve.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, 'Finger control must fit the screenshot');
    assert.ok(await valve.locator('kbd').isVisible(), 'Input key must be visible');
  }
}

async function multiplayer(page, format) {
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T12:00:01Z'));
  await notesMode(page, 'Multi Player');
  await button(page, 'Add player').click();
  await button(page.getByRole('dialog'), 'Save').click();
  await configureMultiplayerNotes(page);
  await page.locator('.multiplayer-view').getByLabel('Duration (seconds)').fill('60');
  await button(page, 'Start round').click();
  await page.getByRole('group', { name: 'Play Style' }).getByRole('button', { name: format, exact: true }).click();
  await button(page, 'Continue to round').click();
  await page.clock.runFor(100);
  // The genuine small-screen fit warning can cover the pointer target. Use the
  // button's keyboard action and retain the warning in the screenshot.
  await button(page, 'Ready').press('Enter');
  await page.clock.runFor(3200);
  assert.equal(await page.locator('.multiplayer-panel:visible').count(), format === 'Pass and Play' ? 1 : 2);
}

const scenario = (id, title, route, setup = async () => {}, extra = {}) => ({ id, title, route, setup, ...extra });
export const screenshotScenarios = [
  scenario('tuner', 'Tuner — synthetic A4 input', '/tune/', async page => {
    // Same Web Audio fixture as the browser checks: no real microphone or speakers.
    await page.evaluate(() => {
      const audio = new AudioContext();
      const source = audio.createOscillator();
      const gain = audio.createGain();
      const destination = audio.createMediaStreamDestination();
      source.frequency.value = 440; gain.gain.value = 0.2;
      source.connect(gain).connect(destination); source.start();
      navigator.mediaDevices.getUserMedia = async () => { await audio.resume(); return destination.stream; };
    });
    await button(page, 'Start listening').first().click();
    await page.waitForFunction(() => document.querySelector('.pitch-note')?.textContent === 'A4');
  }),
  scenario('metronome', 'Metronome — 4/4 at 100 BPM', '/tempo/', async page => {
    await page.getByLabel('Meter', { exact: true }).selectOption('4/4');
    await page.getByLabel('Tempo (BPM)', { exact: true }).fill('100');
    await page.getByLabel('Tempo (BPM)', { exact: true }).press('Enter');
  }),
  scenario('tone', 'Reference tone keyboard', '/tone/'),
  scenario('notes-single', 'tuNotes — single-player practice', '/notes/', async page => {
    await choosePreset(page, 'treble-lines-and-spaces');
    await startPractice(page);
  }),
  scenario('notes-pass-and-play', 'tuNotes — Pass and Play', '/notes/', page => multiplayer(page, 'Pass and Play')),
  scenario('notes-side-by-side', 'tuNotes — Side by Side', '/notes/', page => multiplayer(page, 'Side by Side')),
  scenario('notes-head-to-head', 'tuNotes — Head to Head', '/notes/', page => multiplayer(page, 'Head to Head')),
  scenario('trumpet', 'Trumpet — valves 1, 2, 3 bottom to top; input on right', '/notes/', page => fingering(page, 'trumpet-bb', 3), {
    matches: profile => profile.id === 'phone-landscape',
  }),
  scenario('violin', 'Violin — fingers 1, 2, 3, 4 top to bottom', '/notes/', page => fingering(page, 'violin', 4), {
    matches: profile => profile.hasTouch && profile.viewport.height > profile.viewport.width,
  }),
  scenario('uno234-counts', 'Uno234 — counting input', '/rhythm/', async page => {
    await button(page, 'Counts').click();
    const cells = page.locator('[data-count-id]');
    await cells.first().click();
    await page.keyboard.press('1');
  }),
  scenario('uno234-performance', 'Uno234 — Perform with written counts', '/rhythm/', async page => {
    await page.locator('[data-count-id]').first().click();
    await page.keyboard.press('1');
    await button(page, 'Perform').click();
    if (await button(page, 'Options').isVisible()) await button(page, 'Options').click();
    await page.getByRole('checkbox', { name: 'Show written counts during performance', exact: true }).check();
    await button(page, 'Perform').click();
    await button(page, 'Performance pad').waitFor();
  }),
  scenario('uno234-settings', 'Uno234 — settings', '/rhythm/', async page => {
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.locator('#settings-view').waitFor({ state: 'visible' });
  }),
  scenario('notes-settings', 'tuNotes — options and settings', '/notes/', page => notesMode(page, 'Options')),
  scenario('notes-presets', 'tuNotes — preset chooser', '/notes/', page => openRange(page)),
  scenario('notes-configurator-range', 'tuNotes — custom note range', '/notes/', page => openCustom(page)),
  scenario('notes-configurator-options', 'tuNotes — key, spellings and clefs', '/notes/', async page => {
    await openCustom(page);
    await setKey(page, 'G');
    await setModifiers(page, ['key', 'flat', 'sharp']);
    await rangeDialog(page).getByRole('group', { name: 'Practice clefs', exact: true }).scrollIntoViewIfNeeded();
  }),
  ...[['uno', 'Uno’s Choice'], ['uil', 'UIL Sight Reading'], ['custom', 'Custom']].map(([id, tab]) =>
    scenario(`uno234-configurator-${id}`, `Uno234 — ${tab} presets`, '/rhythm/', async page => {
      await button(page, 'Choose rhythms').click();
      await page.getByRole('tab', { name: tab, exact: true }).click();
    })),
];
