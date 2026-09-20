import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimeline, createTapTempo } from '../src/music/rhythm.ts';
import { createPracticeStore } from '../src/practice/state.ts';

test('simple meter and subdivisions share an exact beat timeline', () => {
  const timeline = createTimeline(1);
  const pulses = Array.from({ length: 16 }, () => timeline.next({ tempo: 120, beats: 4, subdivision: 2 }));
  assert.deepEqual(pulses.map((pulse) => pulse.time), Array.from({ length: 16 }, (_, i) => 1 + i / 4));
  assert.deepEqual(pulses.filter((pulse) => pulse.downbeat).map((pulse) => pulse.time), [1, 3]);
  assert.deepEqual(pulses.slice(0, 4).map(({ beat, part }) => [beat, part]), [[0, 0], [0, 1], [1, 0], [1, 1]]);
});
test('6/8 uses two dotted-quarter beats and three eighth-note pulses per beat', () => {
  const timeline = createTimeline(0);
  const pulses = Array.from({ length: 7 }, () => timeline.next({ tempo: 60, beats: 2, subdivision: 3 }));
  pulses.forEach((pulse, i) => assert.ok(Math.abs(pulse.time - i / 3) < 1e-12));
  assert.deepEqual(pulses.map(({ beat, part }) => [beat, part]), [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 0]]);
  assert.deepEqual(pulses.map((pulse) => pulse.downbeat), [true, false, false, false, false, false, true]);
});
test('changes preserve the current beat; meter change begins a new bar', () => {
  const timeline = createTimeline(0);
  timeline.next({ tempo: 120, beats: 4, subdivision: 2 });
  const settings = { tempo: 60, beats: 3, subdivision: 1 };
  assert.deepEqual(timeline.next(settings), { time: 0.25, beat: 0, part: 1, downbeat: false });
  assert.deepEqual(timeline.next(settings), { time: 0.5, beat: 0, part: 0, downbeat: true });
  assert.equal(timeline.next(settings).time, 1.5);
});
test('free pulse has no downbeat; long runs do not accumulate material drift', () => {
  const timeline = createTimeline(0);
  for (let i = 0; i < 10000; i++) {
    const pulse = timeline.next({ tempo: 137, beats: 0, subdivision: 4 });
    assert.equal(pulse.downbeat, false);
    assert.ok(Math.abs(pulse.time - i * 60 / 137 / 4) < 1e-8);
  }
});
test('tap tempo handles reset, bounce, outliers and tempo limits', () => {
  const tap = createTapTempo();
  assert.equal(tap(0), null);
  assert.equal(tap(20), null);
  assert.equal(tap(500), 120);
  assert.equal(tap(1000), 120);
  assert.equal(tap(1700), 120);
  assert.equal(tap(4000), null);
  assert.equal(tap(4100), 240);
});
test('invalid metronome settings do not enter shared state', () => {
  const store = createPracticeStore();
  store.dispatch({ type: 'subdivision', value: 0 });
  store.dispatch({ type: 'click-volume', value: -1 });
  assert.equal(store.get().subdivision, 1);
  assert.equal(store.get().clickVolume, 50);
});
test('tap tempo uses the latest four intervals', () => {
  const tap = createTapTempo();
  for (const time of [0, 1000, 2000, 3000, 3500]) tap(time);
  assert.equal(tap(4000), 80);
});
test('numbered accents persist across presentation changes and subdivisions reach seven', () => {
  const store = createPracticeStore();
  store.dispatch({ type: 'meter', value: '4/4' });
  store.dispatch({ type: 'beat-accent', value: 2 });
  store.dispatch({ type: 'numbered', value: false });
  store.dispatch({ type: 'focus', value: 'tone' });
  assert.deepEqual(store.get().beatAccents, [true, false, true, false]);
  store.dispatch({ type: 'beat-accent', value: 9 });
  assert.deepEqual(store.get().beatAccents, [true, false, true, false]);
  store.dispatch({ type: 'subdivision', value: 7 });
  assert.equal(store.get().subdivision, 7);
  store.dispatch({ type: 'subdivision', value: 8 });
  assert.equal(store.get().subdivision, 7);
  const timeline = createTimeline(0);
  const pulses = Array.from({ length: 8 }, () => timeline.next({ tempo: 60, beats: 4, subdivision: 7 }));
  assert.equal(pulses[6]!.part, 6);
  assert.equal(pulses[7]!.beat, 1);
  assert.ok(Math.abs(pulses[7]!.time - 1) < 1e-12);
});
