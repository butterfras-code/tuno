import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, firefox } from 'playwright';
import { hostBuild } from './test-host.mjs';

// Exercise the same pulse and click modules using the browser's audio renderer.
const bundle = await build({ stdin: {
  contents: `import { createTimeline } from './src/music/rhythm.ts';
import { scheduleClick } from './src/audio/click.ts';
import { prepareMetronome } from './src/audio/metronome.ts';
import { createReferenceTone, setToneSound } from './src/audio/tone.ts';
window.captureMetronome = async (rate) => {
  const ac = new AudioContext({ sampleRate: rate });
  await ac.resume();
  const create = await prepareMetronome(ac);
  const source = new Blob([\`class Recorder extends AudioWorkletProcessor {
    constructor() { super(); this.data = new Float32Array(sampleRate * 3); this.offset = 0; }
    process(inputs, outputs) {
      const input = inputs[0]?.[0], output = outputs[0]?.[0];
      if (input && output) output.set(input);
      if (input) {
        const length = Math.min(input.length, this.data.length - this.offset);
        this.data.set(input.subarray(0, length), this.offset); this.offset += length;
        if (this.offset === this.data.length) {
          this.port.postMessage(this.data, [this.data.buffer]); return false;
        }
      }
      return true;
    }
  } registerProcessor('test-recorder', Recorder);\`], { type: 'text/javascript' });
  const url = URL.createObjectURL(source);
  try {
    await ac.audioWorklet.addModule(url);
    const recorder = new AudioWorkletNode(ac, 'test-recorder', { outputChannelCount: [1] });
    const recorded = new Promise(resolve => { recorder.port.onmessage = event => resolve(event.data); });
    const node = create({ tempo: 120, beats: 2, subdivision: 3, clickSound: 'click', beatAccents: [true, false] });
    node.connect(recorder).connect(ac.destination);
    setTimeout(() => { const until = performance.now() + 1000; while (performance.now() < until) {} }, 250);
    const data = await recorded;
    const onsets = [], peaks = []; let last = -rate;
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > 0.005 && i - last > rate * 0.08) {
        onsets.push(i / rate); last = i;
        let peak = 0;
        for (let j = i; j < Math.min(i + rate * 0.04, data.length); j++) peak = Math.max(peak, Math.abs(data[j]));
        peaks.push(peak);
      }
    }
    node.port.postMessage({ type: 'stop' }); node.disconnect(); node.port.close();
    return { onsets, peaks, rate: ac.sampleRate };
  } finally { URL.revokeObjectURL(url); await ac.close(); }
};
window.renderTone = async (sampleRate, sound, initialSound = sound) => {
  const ac = new OfflineAudioContext(1, sampleRate, sampleRate);
  const voice = createReferenceTone(ac, 110, initialSound);
  setToneSound(ac, voice.oscillator, sound);
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
};
window.renderMixedPeak = async (sampleRate, sound) => {
  const ac = new OfflineAudioContext(1, sampleRate, sampleRate);
  const voice = createReferenceTone(ac, 440, 'rich');
  voice.gain.gain.value = 0.2;
  const timeline = createTimeline(0.1);
  for (let i = 0; i < 25; i++) scheduleClick(ac, timeline.next({ tempo: 240, beats: 2, subdivision: 7 }), { accent: true, clickVolume: 100, clickSound: sound });
  const data = (await ac.startRendering()).getChannelData(0);
  let peak = 0;
  for (const sample of data) peak = Math.max(peak, Math.abs(sample));
  return peak;
};`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', platform: 'browser' });
const host = await hostBuild();
const browser = await (process.env.TUNO_BROWSER === 'firefox' ? firefox : chromium).launch();
try {
  const page = await browser.newPage();
  await page.goto(host.url);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const sampleRate of [44100, 48000]) {
    const captured = await page.evaluate(rate => window.captureMetronome(rate), sampleRate);
    assert.equal(captured.rate, sampleRate);
    assert.ok(captured.onsets.length >= 16, 'actual audio continues through a one-second main-thread stall');
    captured.onsets.forEach((time, index) => assert.ok(Math.abs(time - captured.onsets[0] - index / 6) < 0.001, 'no gap, burst or phase drift during a UI stall'));
    assert.ok(captured.peaks[0] > captured.peaks[3] && captured.peaks[3] > captured.peaks[1], 'worklet retains downbeat/beat/subdivision amplitudes');

    for (const sound of ['click', 'wood', 'beep', 'drum']) {
      const result = await page.evaluate(([rate, sound]) => window.renderClicks(rate, 50, sound), [sampleRate, sound]);
      assert.equal(result.onsets.length, 12);
      result.onsets.forEach((time, index) => assert.ok(Math.abs(time - (0.1 + index / 6)) < 0.001));
      assert.ok(result.accents[0] > result.accents[3]);
      assert.ok(result.accents[3] > result.accents[1]);
      assert.ok(result.accents[0] > 0.2, `${sound}: default downbeat has useful peak level`);
      assert.ok(result.accents[3] > 0.1, `${sound}: default beat has useful peak level`);
      const mixedPeak = await page.evaluate(([rate, sound]) => window.renderMixedPeak(rate, sound), [sampleRate, sound]);
      assert.ok(mixedPeak < 1, `${sound}: full-volume clicks and tone do not clip (${mixedPeak})`);
      const silent = await page.evaluate(([rate, sound]) => window.renderClicks(rate, 0, sound), [sampleRate, sound]);
      assert.equal(silent.peak, 0);
      assert.deepEqual(silent.onsets, []);
    }
    for (const sound of ['sine', 'triangle', 'rich', 'sweet', 'clear']) {
      const { amplitudes: a, peak } = await page.evaluate(([rate, sound]) => window.renderTone(rate, sound), [sampleRate, sound]);
      assert.ok(peak <= 0.201, `${sound}: bounded output`);
      assert.ok(a[0] > 0.06 && a.slice(1).every(value => value < a[0]), `${sound}: strongest fundamental`);
      if (sound === 'sine') assert.ok(a.slice(1).every(value => value < 0.001));
      if (sound === 'triangle') assert.ok(a[2] > 0.01 && a[1] < 0.001);
      if (sound === 'sweet') assert.ok(a[2] > a[1] * 2 && a[1] > 0.01, 'Sweet: rounded odd-harmonic reed blend');
      if (sound === 'clear') assert.ok(a[1] > a[2] && a[3] > a[0] * 0.3, 'Clear: bright full harmonic series');
      for (const initial of ['rich', 'sweet', 'clear', 'sine']) {
        const switched = await page.evaluate(([rate, target, initial]) => window.renderTone(rate, target, initial), [sampleRate, sound, initial]);
        switched.amplitudes.forEach((value, index) => assert.ok(Math.abs(value - a[index]) < 0.0001, `${initial} → ${sound}: applies selected waveform`));
      }
      if (sound === 'rich') assert.ok(a[1] > 0.05 && a[2] > 0.025 && a[3] > 0.01);
    }
  }
  console.log('Real AudioWorklet output survives a one-second main-thread stall at 44.1/48 kHz without gaps or phase drift. Rendered all four clicks at 44.1/48 kHz: onset error <1 ms, correct accents, silent zero volume. All five reference tones retain their fundamental and expected harmonics.');
} finally { await browser.close(); await host.close(); }
