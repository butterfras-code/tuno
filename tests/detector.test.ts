import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch } from '../src/audio/detector.ts';
import { pitchSignal } from './fixtures/pitch-signal.ts';

test('adapted YIN detects clean and overtone-rich signals at both sample rates', () => {
  for (const sampleRate of [44100, 48000]) {
    for (const frequency of [55, 65.406, 110, 233.082, 440, 880, 1600, 1760]) {
      for (const harmonics of [[1], [0.5, 1, 0.4, 0.2]]) {
        const result = detectPitch(pitchSignal({ frequency, sampleRate, harmonics }), sampleRate, 0.005);
        assert.ok(result.frequency, `${frequency} Hz @ ${sampleRate}`);
        assert.ok(Math.abs(1200 * Math.log2(result.frequency / frequency)) <= 5, `${frequency}: ${result.frequency}`);
        assert.ok(result.quality > 0.8);
      }
    }
  }
});
test('rejects silence, noise and below-gate input', () => {
  for (const signal of [new Float32Array(4096), pitchSignal({ amplitude: 0, noise: 0.2 }), pitchSignal({ amplitude: 0.001 })]) {
    assert.equal(detectPitch(signal, 48000, 0.005).frequency, null);
  }
});
