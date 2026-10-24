import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNER_ACCURACIES } from '../src/practice/state.ts';
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
test('6/10 cent hysteresis and 220ms grace pause progress without pose flicker', () => {
  const f = fixture();
  f.set({ note: 69, cents: 6 }); // Already entered at zero.
  assert.equal(f.advance(1000).pose, 'wag');
  const before = f.advance(0).progress;
  f.set(null);
  assert.equal(f.advance(210).progress, before);
  f.set({ note: 69, cents: 0 });
  assert.ok(Math.abs(f.advance(100).progress - before - 0.04) < 0.01);
  f.set({ note: 69, cents: 11 });
  assert.equal(f.advance(230).progress, 0);
  assert.equal(f.advance(170).pose, 'rest');
  f.set({ note: 69, cents: 7 });
  assert.equal(f.advance(1000).pose, 'rest');
  f.set({ note: 69, cents: 6 });
  assert.equal(f.advance(250).pose, 'wag');
});
test('every configured level rewards newly accepted pitches and rejects sustained errors', () => {
  for (const { value, scale } of TUNER_ACCURACIES) {
    for (const sign of [-1, 1]) {
      const feedback = createTunerFeedback();
      const entry = { note: 69, cents: sign * 6 * scale };
      feedback.update(0, entry, false, scale);
      // A small wobble may leave the entry window once a hold has begun.
      const wobble = { note: 69, cents: sign * 10 * scale };
      let result;
      for (let time = 100; time <= 2500; time += 100) result = feedback.update(time, wobble, false, scale);
      assert.equal(result!.reward, 1, value);

      const outside = createTunerFeedback();
      for (let time = 0; time <= 3000; time += 100) {
        assert.equal(outside.update(time, { note: 69, cents: sign * 6.1 * scale }, false, scale).reward, 0, value);
      }
      // Beyond the outer edge, a longer excursion still loses the hold.
      feedback.reset();
      feedback.update(4000, entry, false, scale);
      feedback.update(4200, entry, false, scale);
      const error = { note: 69, cents: sign * 10.1 * scale };
      feedback.update(4210, error, false, scale);
      assert.equal(feedback.update(4440, error, false, scale).progress, 0, value);
    }
  }
});

test('repeated brief pitch wobbles pause progress without erasing the hold or earning time', () => {
  const f = fixture();
  f.advance(1000);
  for (let i = 0; i < 5; i++) {
    const before = f.advance(0).progress;
    f.set({ note: 69, cents: 15 });
    assert.equal(f.advance(220).progress, before);
    f.set({ note: 69, cents: 0 });
    assert.equal(f.advance(0).progress, before);
    assert.equal(f.advance(250).reward, 0);
  }
  assert.equal(f.advance(240).reward, 0);
  assert.equal(f.advance(10).reward, 1);
});

test('stale updates and changing notes cannot carry progress into a treat', () => {
  const f = fixture();
  f.advance(2000);
  assert.equal(f.feedback.update(2300, { note: 69, cents: 0 }).progress, 0);
  assert.equal(f.feedback.update(2400, { note: 71, cents: 0 }).progress, 0);
  assert.equal(f.feedback.update(2500, null).reward, 0);
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
