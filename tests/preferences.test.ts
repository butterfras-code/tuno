import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeStore } from '../src/practice/state.ts';
import { keepPreferences, PREFERENCES_KEY } from '../src/practice/preferences.ts';

function memory(initial: string | null = null) {
  let data = initial;
  let writes = 0;
  return { getItem: (_key: string) => data, setItem(key: string, value: string) {
    assert.equal(key, PREFERENCES_KEY); data = value; writes++;
  }, get writes() { return writes; } };
}

test('preferences survive reload without restoring capture, playback, or pitch', () => {
  const storage = memory();
  const first = createPracticeStore();
  keepPreferences(first, storage);
  first.dispatch({ type: 'settings', value: { a4: 442, transposition: 2, showUno: false } });
  first.dispatch({ type: 'tempo', value: 123 });
  first.dispatch({ type: 'meter', value: '6/8' });
  first.dispatch({ type: 'numbered', value: false });
  first.dispatch({ type: 'beat-accent', value: 2 });
  const before = storage.writes;
  first.dispatch({ type: 'audio', value: { micStatus: 'listening', liveHz: 442, tonePlaying: true, metronomePlaying: true } });
  first.dispatch({ type: 'pitch', value: 440 });
  assert.equal(storage.writes, before);
  const next = createPracticeStore();
  keepPreferences(next, storage);
  assert.equal(next.get().a4, 442);
  assert.equal(next.get().showUno, false);
  assert.equal(next.get().tempo, 123);
  assert.equal(next.get().meter, '6/8');
  assert.equal(next.get().numbered, false);
  assert.equal(next.get().beatAccents[2], true);
  assert.equal(next.get().micStatus, 'idle');
  assert.equal(next.get().tonePlaying, false);
  assert.equal(next.get().metronomePlaying, false);
  assert.equal(next.get().manualHz, null);
  assert.equal(next.get().liveHz, null);
});

test('invalid saved values cannot inject state or bypass store validation', () => {
  const store = createPracticeStore();
  keepPreferences(store, memory(JSON.stringify({ tempo: 999, focus: 'unknown', sustain: 'yes', toneSound: 'bogus', a4: 2, micStatus: 'listening', beatAccents: [true] })));
  assert.equal(store.get().tempo, 96);
  assert.equal(store.get().a4, 440);
  assert.equal(store.get().focus, 'tuner');
  assert.equal(store.get().sustain, true);
  assert.equal(store.get().toneSound, 'rich');
  assert.equal(store.get().micStatus, 'idle');
  assert.equal(store.get().beatAccents.length, 7);
});

test('corrupt or blocked storage leaves practice usable', () => {
  for (const storage of [memory('{oops'), { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } }]) {
    const store = createPracticeStore();
    assert.doesNotThrow(() => keepPreferences(store, storage));
    assert.doesNotThrow(() => store.dispatch({ type: 'tempo', value: 120 }));
    assert.equal(store.get().tempo, 120);
  }
});
