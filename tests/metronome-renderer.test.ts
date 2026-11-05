import test from 'node:test';
import assert from 'node:assert/strict';
import { MetronomeRenderer } from '../src/audio/metronome-renderer.ts';
import type { ClickSamples, MetronomeSettings } from '../src/audio/metronome-renderer.ts';

// Impulses expose exact audio sample positions independently of click synthesis.
const samples = Object.fromEntries(['click', 'wood', 'beep', 'drum'].map(sound => [sound,
  { accent: new Float32Array([0.75]), beat: new Float32Array([0.5]), part: new Float32Array([0.25]) },
])) as ClickSamples;
const defaults: MetronomeSettings = { tempo: 120, beats: 2, subdivision: 3, clickSound: 'click', beatAccents: [true, false] };

for (const rate of [44100, 48000]) {
  test(`audio-thread pulses stay on time without UI callbacks at ${rate} Hz`, () => {
    const engine = new MetronomeRenderer(rate, 0.05, samples, defaults);
    const onsets: number[] = [], levels: number[] = [];
    const output = new Float32Array(128);
    // Over a minute of audio, without a single UI/settings/position message.
    for (let frame = 0; frame < rate * 65; frame += output.length) {
      engine.render(output, frame / rate);
      output.forEach((sample, index) => { if (sample) { onsets.push((frame + index) / rate); levels.push(sample); } });
    }
    assert.equal(onsets.length, 390);
    onsets.forEach((time, index) => assert.ok(Math.abs(time - (0.05 + index / 6)) <= 0.51 / rate));
    assert.deepEqual(levels.slice(0, 7), [0.75, 0.25, 0.25, 0.5, 0.25, 0.25, 0.75]);
    assert.equal(engine.snapshot().length, 64, 'bounded visual history while hidden');
    assert.ok(engine.snapshot().at(-1)!.index > 100, 'returning UI reads current beat identity');
  });
}

test('tempo/subdivision changes wait for a beat boundary; meter changes start a new bar', () => {
  const rate = 48000;
  const engine = new MetronomeRenderer(rate, 0, samples, defaults);
  engine.render(new Float32Array(rate * 0.2), 0);
  engine.settings = { ...defaults, tempo: 60, beats: 3, subdivision: 2 };
  engine.render(new Float32Array(rate * 1.4), 0.2);
  assert.deepEqual(engine.snapshot().map(pulse => [Number(pulse.time.toFixed(6)), pulse.beat, pulse.part]),
    [[0, 0, 0], [0.166667, 0, 1], [0.333333, 0, 2], [0.5, 0, 0], [1, 0, 1], [1.5, 1, 0]]);
  assert.equal(engine.snapshot()[3]!.duration, 1);
});

test('overlapping click tails are mixed and free pulse has no accents', () => {
  const bank = { accent: new Float32Array(60).fill(0.75), beat: new Float32Array(60).fill(0.5), part: new Float32Array(60).fill(0.25) };
  const engine = new MetronomeRenderer(1000, 0, { ...samples, click: bank }, { ...defaults, tempo: 240, beats: 0, subdivision: 7 });
  const output = new Float32Array(100);
  engine.render(output, 0);
  assert.equal(output[0], 0.5);
  assert.equal(output[40], 0.75);
  assert.ok(engine.snapshot().every(pulse => !pulse.accented));
});

test('an actual audio-clock discontinuity cannot replay missed clicks in a burst', () => {
  const engine = new MetronomeRenderer(48000, 0, samples, defaults);
  engine.render(new Float32Array(128), 0);
  const output = new Float32Array(128);
  assert.throws(() => engine.render(output, 10), /timeline was interrupted/);
  assert.ok(output.every(sample => sample === 0));
});
