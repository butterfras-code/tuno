import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTunerFeedback, type FeedbackEvidence } from '../src/practice/feedback.ts';

function fixture() {
  const feedback = createTunerFeedback();
  let time = 0;
  let evidence: FeedbackEvidence = { note: 69, cents: 0 };
  let silent = false;
  let result = feedback.update(time, evidence);
  return {
    feedback,
    set(value: FeedbackEvidence, silence = false) {
      evidence = value; silent = silence; result = feedback.update(time, evidence, silent); return result;
    },
    advance(ms: number) {
      for (let i = 0; i < ms; i += 10) { time += Math.min(10, ms - i); result = feedback.update(time, evidence, silent); }
      return result;
    },
  };
}
test('patient poses, one catch per note, and happy sit after the reward', () => {
  const f = fixture();
  assert.equal(f.advance(240).pose, 'rest');
  assert.equal(f.advance(10).pose, 'wag');
  assert.equal(f.advance(950).pose, 'beg');
  assert.equal(f.advance(1300).pose, 'catch');
  assert.equal(f.advance(1090).pose, 'catch');
  assert.equal(f.advance(10).pose, 'happy');
  assert.equal(f.advance(5000).reward, 1);
});
test('5/8 cent hysteresis and 150ms grace pause progress without pose flicker', () => {
  const f = fixture();
  f.set({ note: 69, cents: 6 }); // Already entered at zero.
  assert.equal(f.advance(1000).pose, 'wag');
  const before = f.advance(0).progress;
  f.set(null);
  assert.equal(f.advance(140).progress, before);
  f.set({ note: 69, cents: 0 });
  assert.ok(Math.abs(f.advance(100).progress - before - 0.04) < 0.01);
  f.set({ note: 69, cents: 9 });
  assert.equal(f.advance(160).progress, 0);
  assert.equal(f.advance(240).pose, 'rest');
  f.set({ note: 69, cents: 6 });
  assert.equal(f.advance(1000).pose, 'rest');
  f.set({ note: 69, cents: 5 });
  assert.equal(f.advance(250).pose, 'wag');
});
test('intermediate and beginner scales relax both edges of the accuracy window', () => {
  const intermediate = createTunerFeedback();
  intermediate.update(0, { note: 69, cents: 5.5 }, false, 1.1);
  assert.equal(intermediate.update(250, { note: 69, cents: 8.8 }, false, 1.1).pose, 'wag');

  const beginner = createTunerFeedback();
  beginner.update(0, { note: 69, cents: 6 }, false, 1.2);
  assert.equal(beginner.update(250, { note: 69, cents: 9.6 }, false, 1.2).pose, 'wag');

  const advanced = createTunerFeedback();
  advanced.update(0, { note: 69, cents: 5.5 });
  assert.equal(advanced.update(250, { note: 69, cents: 5.5 }).pose, 'rest');
});
test('silence, sustained out-of-tune input and stable new notes rearm rewards', () => {
  for (const reason of ['silence', 'out', 'note']) {
    const f = fixture();
    assert.equal(f.advance(2500).reward, 1);
    f.advance(1100);
    f.set(reason === 'silence' ? null : { note: reason === 'note' ? 71 : 69, cents: reason === 'out' ? 12 : 0 }, reason === 'silence');
    f.advance(reason === 'silence' ? 500 : reason === 'out' ? 700 : 250);
    f.set({ note: reason === 'note' ? 71 : 69, cents: 0 });
    assert.equal(f.advance(2490).reward, 1, reason);
    assert.equal(f.advance(20).reward, 2, reason);
  }
});
test('uncertain input and short silences cannot earn or rearm a reward', () => {
  const f = fixture();
  f.advance(3600);
  f.set(null, true); f.advance(400);
  f.set({ note: 69, cents: 0 });
  assert.equal(f.advance(3000).reward, 1);
  f.set(null); f.advance(5000);
  f.set({ note: 69, cents: 0 });
  assert.equal(f.advance(3000).reward, 1);
  f.feedback.reset();
  f.set(null);
  assert.equal(f.advance(5000).pose, 'rest');
  assert.equal(f.advance(0).progress, 0);
});
