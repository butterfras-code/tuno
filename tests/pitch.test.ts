import assert from 'node:assert/strict';
import { test } from 'node:test';
import { centsBetween, concertToWritten, identifyPitch, noteFrequency, noteName, writtenToConcert } from '../src/music/pitch.ts';

function near(actual: number, expected: number, tolerance = 1e-8): void {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should equal ${expected}`);
}

test('A4 calibration and octave frequencies', () => {
  assert.equal(noteFrequency(69), 440);
  assert.equal(noteFrequency(69, 442), 442);
  assert.equal(noteFrequency(57), 220);
  assert.equal(noteFrequency(81), 880);
  near(noteFrequency(60), 261.6255653005986);
  assert.deepEqual(identifyPitch(442, 442), { concertNote: 69, writtenNote: 69, cents: 0 });
});

test('cents have the correct direction and scale', () => {
  near(centsBetween(880, 440), 1200);
  near(centsBetween(220, 440), -1200);
  near(identifyPitch(440 * 2 ** (23 / 1200)).cents, 23);
  near(identifyPitch(440 * 2 ** (-31 / 1200)).cents, -31);
});

test('nearest-note selection crosses B/C and octave boundaries', () => {
  assert.equal(noteName(59), 'B3');
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(70), 'B♭4');
  assert.equal(noteName(-1), 'B-2');
  const b3 = noteFrequency(59);
  assert.equal(identifyPitch(b3 * 2 ** (49.9 / 1200)).concertNote, 59);
  assert.equal(identifyPitch(b3 * 2 ** (50.1 / 1200)).concertNote, 60);
});

test('B-flat written pitch is two semitones above concert pitch', () => {
  const concertBb = 58;
  assert.equal(noteName(concertToWritten(concertBb, 2)), 'C4');
  assert.equal(writtenToConcert(60, 2), concertBb);
  const frequency = noteFrequency(concertBb);
  const reading = identifyPitch(frequency, 440, 2);
  assert.equal(reading.concertNote, 58);
  assert.equal(reading.writtenNote, 60);
  near(reading.cents, 0);
  assert.equal(noteFrequency(reading.concertNote), frequency);
});

test('pitch and transposition round trips across the piano range and calibrations', () => {
  for (const a4 of [415, 440, 442, 466]) {
    for (let note = 21; note <= 108; note++) {
      for (const offset of [-12, -2, 0, 2, 7, 9, 14]) {
        const reading = identifyPitch(noteFrequency(note, a4), a4, offset);
        assert.equal(reading.concertNote, note);
        near(reading.cents, 0);
        assert.equal(writtenToConcert(reading.writtenNote, offset), note);
      }
    }
  }
});

test('silence, nonfinite input, and invalid notes are rejected', () => {
  for (const invalid of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(() => identifyPitch(invalid), RangeError);
    assert.throws(() => identifyPitch(440, invalid), RangeError);
    assert.throws(() => noteFrequency(69, invalid), RangeError);
  }
  for (const invalid of [69.5, NaN, Infinity, Number.MAX_VALUE]) {
    assert.throws(() => noteFrequency(invalid), RangeError);
    assert.throws(() => noteName(invalid), RangeError);
    assert.throws(() => concertToWritten(69, invalid), RangeError);
  }
  assert.throws(() => noteFrequency(100000), RangeError);
  assert.throws(() => noteFrequency(-100000), RangeError);
});
