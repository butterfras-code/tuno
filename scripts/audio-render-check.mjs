import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, firefox } from 'playwright';

// Exercise the same pulse and click modules using the browser's audio renderer.
const bundle = await build({ stdin: {
  contents: `import { createTimeline } from './src/music/rhythm.ts';
import { scheduleClick } from './src/audio/click.ts';
import { createReferenceTone } from './src/audio/tone.ts';
window.renderTone = async (sampleRate, sound) => {
  const ac = new OfflineAudioContext(1, sampleRate, sampleRate);
  const voice = createReferenceTone(ac, 110, sound);
  voice.gain.gain.value = 0.2;
  const data = (await ac.startRendering()).getChannelData(0);
  const amplitudes = [110, 220, 330, 440].map(frequency => {
    let real = 0, imaginary = 0;
    for (let i = 0; i < data.length; i++) {
      real += data[i] * Math.cos(2 * Math.PI * frequency * i / sampleRate);
      imaginary += data[i] * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return 2 * Math.hypot(real, imaginary) / data.length;
  });
  return { amplitudes, peak: data.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0) };
};
window.renderClicks = async (sampleRate, volume, sound) => {
  const ac = new OfflineAudioContext(1, sampleRate * 3, sampleRate);
  const timeline = createTimeline(0.1);
  for (let i = 0; i < 12; i++) scheduleClick(ac, timeline.next({ tempo: 120, beats: 2, subdivision: 3 }), { accent: true, clickVolume: volume, clickSound: sound });
  const rendered = await ac.startRendering();
  const data = rendered.getChannelData(0);
  const onsets = [];
  let last = -sampleRate;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > 0.005 && i - last > sampleRate * 0.05) { onsets.push(i / sampleRate); last = i; }
  }
  return { onsets, peak: Math.max(...data.subarray(0, sampleRate)), accents: Array.from({ length: 12 }, (_, i) => {
    const start = Math.floor((0.1 + i / 6) * sampleRate);
    return Math.max(...data.subarray(start, start + Math.floor(0.04 * sampleRate)).map(Math.abs));
  }) };
};`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', platform: 'browser' });
const browser = await (process.env.TUNO_BROWSER === 'firefox' ? firefox : chromium).launch();
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const sampleRate of [44100, 48000]) {
    for (const sound of ['click', 'wood', 'beep', 'drum']) {
      const result = await page.evaluate(([rate, sound]) => window.renderClicks(rate, 50, sound), [sampleRate, sound]);
      assert.equal(result.onsets.length, 12);
      result.onsets.forEach((time, index) => assert.ok(Math.abs(time - (0.1 + index / 6)) < 0.001));
      assert.ok(result.accents[0] > result.accents[3]);
      assert.ok(result.accents[3] > result.accents[1]);
      const silent = await page.evaluate(([rate, sound]) => window.renderClicks(rate, 0, sound), [sampleRate, sound]);
      assert.equal(silent.peak, 0);
      assert.deepEqual(silent.onsets, []);
    }
    for (const sound of ['sine', 'triangle', 'rich']) {
      const { amplitudes: a, peak } = await page.evaluate(([rate, sound]) => window.renderTone(rate, sound), [sampleRate, sound]);
      assert.ok(peak <= 0.201, `${sound}: bounded output`);
      assert.ok(a[0] > 0.1 && a.slice(1).every(value => value < a[0]), `${sound}: strongest fundamental`);
      if (sound === 'sine') assert.ok(a.slice(1).every(value => value < 0.001));
      if (sound === 'triangle') assert.ok(a[2] > 0.01 && a[1] < 0.001);
      if (sound === 'rich') assert.ok(a[1] > 0.05 && a[2] > 0.025 && a[3] > 0.01);
    }
  }
  console.log('Rendered all four clicks at 44.1/48 kHz: onset error <1 ms, correct accents, silent zero volume. All three reference tones retain their fundamental and expected harmonics.');
} finally { await browser.close(); }
