import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PitchDisplay } from '../src/practice/pitch-display.ts';
import { pitchSequence, pitchSignal } from '../tests/fixtures/pitch-signal.ts';
import { cpus } from 'node:os';

const { detectPitch } = await import(process.env.TUNO_DETECTOR ? pathToFileURL(process.env.TUNO_DETECTOR).href : '../src/audio/detector.ts');

const groups: Record<string, { frames: number; detected: number; within5: number; octaveErrors: number; maxCents: number; errors: number[] }> = {};
const times: number[] = [];
const failures: { group: string; sampleRate: number; frequency: number; measured: number | null }[] = [];
for (const sampleRate of [44100, 48000]) {
  for (let note = 33; note <= 93; note++) {
    for (const detune of [-49, -23, 0, 23, 49]) {
      const frequency = 440 * 2 ** ((note - 69 + detune / 100) / 12);
      if (frequency < 55 || frequency > 1760) continue;
      for (const [name, harmonics, noise] of [
        ['pure', [1], 0], ['rich', [0.5, 1, 0.4, 0.2], 0],
        ['weak', [0.1, 1, 0.4, 0.2], 0], ['missing', [0, 1, 0.4, 0.2], 0],
        ['noisy', [0.5, 1, 0.4, 0.2], 0.1],
      ] as const) {
        const signal = pitchSignal({ frequency, sampleRate, harmonics: [...harmonics], noise, phase: note });
        const start = performance.now();
        const result = detectPitch(signal, sampleRate, 0.005);
        times.push(performance.now() - start);
        if (result.frequency === null || Math.abs(1200 * Math.log2(result.frequency / frequency)) > 5) failures.push({ group: name, sampleRate, frequency, measured: result.frequency });
        const g = groups[name] ??= { frames: 0, detected: 0, within5: 0, octaveErrors: 0, maxCents: 0, errors: [] };
        g.frames++;
        if (result.frequency !== null) {
          const cents = Math.abs(1200 * Math.log2(result.frequency / frequency));
          g.detected++; g.errors.push(cents); g.maxCents = Math.max(g.maxCents, cents);
          if (cents <= 5) g.within5++;
          if (cents >= 1150 && Math.abs(cents - Math.round(cents / 1200) * 1200) <= 50) g.octaveErrors++;
        }
      }
    }
  }
}
let falsePositives = 0;
const rejectionGroups: Record<string, { frames: number; falsePositives: number }> = {};
for (const sampleRate of [44100, 48000]) for (let seed = 1; seed <= 50; seed++) {
  const white = pitchSignal({ amplitude: 0, noise: 0.2, seed, sampleRate });
  let previous = 0;
  const colored = white.map(value => previous = previous * 0.85 + value * 0.15);
  const impulse = new Float32Array(4096); impulse[seed * 73] = 0.5;
  for (const [name, signal] of [
    ['silence', new Float32Array(4096)], ['below-gate', pitchSignal({ amplitude: 0.001, sampleRate })],
    ['white', white], ['colored', colored], ['DC', new Float32Array(4096).fill(0.1)], ['impulse', impulse],
  ] as const) {
    const g = rejectionGroups[name] ??= { frames: 0, falsePositives: 0 };
    g.frames++;
    if (detectPitch(signal, sampleRate, 0.005).frequency !== null) { falsePositives++; g.falsePositives++; }
  }
}
const display = new PitchDisplay();
const transition = [440, 440, 440, 660, 660, 660, null].map((hz, i) => display.frame(i * 70, hz));
for (const g of Object.values(groups)) g.errors.sort((a,b) => a-b);
times.sort((a,b) => a-b);
const sequences = [];
for (const sampleRate of [44100, 48000]) for (const kind of ['attack', 'step', 'vibrato', 'decay'] as const) {
  const display = new PitchDisplay();
  const readings = pitchSequence(kind, sampleRate).map(({ time, signal }) => {
    const rawHz = detectPitch(signal, sampleRate, 0.005).frequency;
    return { time, rawHz, displayHz: display.frame(time, rawHz) };
  });
  const sustained = readings.filter(r => r.time >= 420 && r.time <= 630 && r.displayHz !== null).map(r => 1200 * Math.log2(r.displayHz! / 440));
  sequences.push({ kind, sampleRate, firstDisplayMs: (readings.find(r => r.displayHz !== null)?.time ?? Infinity) - 140,
    stepSettlingMs: kind === 'step' ? (readings.find(r => r.time >= 700 && r.displayHz !== null && Math.abs(1200 * Math.log2(r.displayHz / 659.255)) < 5)?.time ?? Infinity) - 700 : null,
    sustainedPeakToPeakCents: Math.max(...sustained) - Math.min(...sustained),
    silenceClearMs: (readings.find(r => r.time >= 1540 && r.displayHz === null)?.time ?? Infinity) - 1540,
    readings });
}
const report = { cpu: cpus()[0]?.model, node: process.version, route: 'Deterministic synthetic frames, no physical input', groups: Object.fromEntries(Object.entries(groups).map(([name, { errors, ...g }]) => [name, { ...g, p95Cents: errors[Math.floor(errors.length * .95)] }])), failures, noiseFrames: 600, rejectionGroups, falsePositives, transition, sequences, times: { medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * .95)], maxMs: times.at(-1) } };
if (process.argv.includes('--check')) {
  mkdirSync('dist/validation', { recursive: true });
  writeFileSync('dist/validation/pitch-benchmark.json', JSON.stringify(report, null, 2));
  for (const [name, g] of Object.entries(groups)) {
    assert.equal(g.octaveErrors, 0, name);
    assert.equal(g.within5, g.detected, name);
    assert.ok(g.detected >= g.frames - (name === 'noisy' ? 1 : 0), `${name}: coverage`);
  }
  assert.equal(falsePositives, 0);
  assert.ok(report.times.p95Ms < 35);
  for (const sequence of sequences) {
    assert.ok(sequence.firstDisplayMs > 0 && sequence.firstDisplayMs <= 280);
    assert.ok(sequence.silenceClearMs <= 140);
    if (sequence.stepSettlingMs !== null) assert.ok(sequence.stepSettlingMs > 0 && sequence.stepSettlingMs <= 210);
    if (sequence.kind !== 'vibrato') assert.ok(sequence.sustainedPeakToPeakCents < 1);
    else assert.ok(sequence.sustainedPeakToPeakCents > 1 && sequence.sustainedPeakToPeakCents < 40, 'Vibrato must remain visible');
  }
  console.log('Pitch benchmark: 3,010 pitched frames, 600 silence/noise/transient frames, 8 temporal sequences; accuracy, coverage, octave, latency and CPU checks passed.');
} else console.log(JSON.stringify(report, null, 2));
