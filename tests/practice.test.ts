import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPracticeStore, meterInfo, pitchReading, rawPitchReading, toneHz } from '../src/practice/state.ts';

test('focus and octave browsing preserve selected pitch and settings', () => {
  const store = createPracticeStore();
  store.dispatch({ type: 'tone-note', value: 70 });
  store.dispatch({ type: 'settings', value: { a4: 442, transposition: 2, showUno: false } });
  store.dispatch({ type: 'pitch', value: 442 });
  const frequency = toneHz(store.get());
  for (const focus of ['tone', 'metronome', 'tuner'] as const) store.dispatch({ type: 'focus', value: focus });
  store.dispatch({ type: 'octave', value: 6 });
  assert.equal(store.get().toneNote, 70);
  assert.equal(toneHz(store.get()), frequency);
  assert.deepEqual(pitchReading(store.get()), { concertNote: 69, writtenNote: 71, cents: 0 });
  assert.equal(store.get().showUno, false);
});

test('clearing manual input clears evidence without resetting reference-tone selection', () => {
  const store = createPracticeStore();
  store.dispatch({ type: 'pitch', value: 440 });
  store.dispatch({ type: 'pitch', value: null });
  assert.equal(pitchReading(store.get()), null);
  assert.equal(store.get().toneNote, 58);
});

test('live display pitch stays separate from raw reward evidence', () => {
  const store = createPracticeStore();
  store.dispatch({ type: 'audio', value: { micStatus: 'listening', liveHz: 440, displayHz: 880 } });
  assert.equal(pitchReading(store.get())?.concertNote, 81);
  assert.equal(rawPitchReading(store.get())?.concertNote, 69);
});

test('tuner accuracy defaults to advanced and accepts the three supported levels', () => {
  const store = createPracticeStore();
  assert.equal(store.get().tunerAccuracy, 'advanced');
  for (const value of ['intermediate', 'beginner', 'advanced'] as const) {
    store.dispatch({ type: 'tuner-accuracy', value });
    assert.equal(store.get().tunerAccuracy, value);
  }
});

test('invalid control values never enter shared state', () => {
  const store = createPracticeStore();
  const original = store.get();
  store.dispatch({ type: 'tempo', value: NaN });
  store.dispatch({ type: 'tempo', value: 241 });
  store.dispatch({ type: 'octave', value: 3.5 });
  store.dispatch({ type: 'tone-volume', value: -1 });
  store.dispatch({ type: 'pitch', value: Infinity });
  store.dispatch({ type: 'settings', value: { a4: 442, transposition: 1, showUno: true } });
  assert.deepEqual(store.get(), original);
});

test('compound-meter preview uses two dotted-quarter beats and preserves tempo', () => {
  const store = createPracticeStore();
  store.dispatch({ type: 'meter', value: '6/8' });
  assert.equal(meterInfo(store.get()).beats, 2);
  assert.equal(meterInfo(store.get()).unit, 'Dotted quarter');
  assert.equal(store.get().numbered, true);
  assert.equal(store.get().tempo, 96);
  store.dispatch({ type: 'meter', value: 'free' });
  assert.equal(store.get().numbered, false);
});
