import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, firefox } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, platform, release as osRelease } from 'node:os';

const bundle = await build({ stdin: {
  contents: `import { detectPitch } from './src/audio/detector.ts';
import { pitchSignal } from './tests/fixtures/pitch-signal.ts';
import { createReferenceTone } from './src/audio/tone.ts';
import { noteFrequency } from './src/music/pitch.ts';
window.measure = async () => {
  const times = []; let maxCents = 0;
  for (const sampleRate of [44100, 48000]) {
    for (let note = 33; note <= 93; note++) {
      const frequency = 440 * 2 ** ((note - 69) / 12);
      for (const harmonics of [[1], [0.5, 1, 0.4, 0.2]]) {
        const signal = pitchSignal({ frequency, sampleRate, harmonics });
        const start = performance.now();
        const result = detectPitch(signal, sampleRate, 0.005);
        times.push(performance.now() - start);
        if (!result.frequency) throw Error('Missing detection: ' + frequency);
        maxCents = Math.max(maxCents, Math.abs(1200 * Math.log2(result.frequency / frequency)));
      }
    }
  }
  times.sort((a,b) => a-b);
  const renderedTones = [];
  for (const sampleRate of [44100, 48000]) {
    for (const a4 of [400, 440, 442, 480]) {
      const ac = new OfflineAudioContext(1, sampleRate, sampleRate);
      const frequency = noteFrequency(69, a4);
      const { oscillator, gain } = createReferenceTone(ac, frequency);
      gain.gain.setTargetAtTime(0.08, 0, 0.01);
      gain.gain.setTargetAtTime(0, 0.75, 0.01);
      oscillator.stop(0.9);
      const data = (await ac.startRendering()).getChannelData(0);
      const crossings = [];
      for (let i = Math.floor(sampleRate * 0.1); i < sampleRate * 0.7; i++) {
        if (data[i-1] <= 0 && data[i] > 0) crossings.push(i - 1 - data[i-1] / (data[i] - data[i-1]));
      }
      const measured = sampleRate * (crossings.length - 1) / (crossings[crossings.length-1] - crossings[0]);
      renderedTones.push({ sampleRate, a4, measured, cents: Math.abs(1200 * Math.log2(measured / frequency)), tailPeak: Math.max(...data.subarray(Math.floor(sampleRate * 0.92)).map(Math.abs)) });
    }
  }
  return { frames: times.length, maxCents, analysisMedianMs: times[Math.floor(times.length/2)], analysisP95Ms: times[Math.floor(times.length*.95)], analysisMaxMs: times[times.length-1], renderedTones };
};`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', platform: 'browser' });
const engineName = process.env.TUNO_BROWSER || 'chromium';
const browser = await ({ chromium, firefox })[engineName].launch();
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => window.measure());
  assert.ok(result.maxCents <= 5, `Pitch error ${result.maxCents}`);
  assert.ok(result.analysisP95Ms < 35, `Foreground analysis exceeds half the 70 ms cadence: ${result.analysisP95Ms}`);
  for (const tone of result.renderedTones) {
    assert.ok(tone.cents < 0.1);
    assert.equal(tone.tailPeak, 0);
  }
  const release = JSON.parse(await readFile(new URL('../dist/release.json', import.meta.url), 'utf8'));
  const report = { build: release.build, revision: release.revision, dirty: release.dirty, measuredAt: new Date().toISOString(), browser: `${engineName} ${browser.version()}`, os: `${platform()} ${osRelease()}`, cpu: cpus()[0]?.model, route: 'Synthetic input / OfflineAudioContext, no physical audio', ...result };
  await mkdir(new URL('../dist/validation/', import.meta.url), { recursive: true });
  await writeFile(new URL(`../dist/validation/${engineName}-performance.json`, import.meta.url), JSON.stringify(report, null, 2));
  console.log(`${report.browser}: ${result.frames} frames, max error ${result.maxCents.toFixed(3)} cents, analysis median/p95/max ${result.analysisMedianMs.toFixed(2)}/${result.analysisP95Ms.toFixed(2)}/${result.analysisMaxMs.toFixed(2)} ms; calibrated rendered tones <0.1 cent and silent after stop.`);
} finally { await browser.close(); }
