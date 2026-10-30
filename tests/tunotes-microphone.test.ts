import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MicrophoneHold, microphoneTranspositions } from '../src/apps/tunotes/engine/microphone.ts';
import { noteFrequency, writtenToConcert } from '../src/music/pitch.ts';

const hold = (policy: MicrophoneHold, note: number, offset = 0, start = 0) => {
  let result;
  for (const t of [0, 75, 150, 225, 300]) result = policy.update(start + t, noteFrequency(note), offset);
  return result!;
};
test('written middle C requires the correct sounding octave for every instrument group', () => {
  assert.deepEqual(microphoneTranspositions.map(t => writtenToConcert(60, t.offset)), [60, 58, 53, 51, 46, 39]);
  for (const { offset } of microphoneTranspositions) {
    assert.equal(hold(new MicrophoneHold(), 60 - offset, offset).answer, 60);
    assert.equal(hold(new MicrophoneHold(), 72 - offset, offset).answer, 72);
  }
});
test('requires 300 continuous milliseconds; does not repeatedly submit a held note', () => {
  const policy = new MicrophoneHold();
  for (const time of [0, 70, 140, 210, 299]) assert.equal(policy.update(time, 440, 0).answer, undefined);
  assert.equal(policy.update(300, 440, 0).answer, 69);
  policy.reset(); // New prompt must not reuse a sustained answer.
  assert.equal(hold(policy, 69, 0, 375).answer, undefined);
  policy.update(700, null, 0);
  assert.equal(hold(policy, 69, 0, 775).answer, 69);
});
test('silence, tolerance excursions, pitch changes and stale frames restart the hold', () => {
  for (const interruption of [null, 440 * 2 ** (26 / 1200), noteFrequency(70), NaN]) {
    const policy = new MicrophoneHold();
    policy.update(0, 440, 0); policy.update(100, 440, 0);
    policy.update(150, interruption, 0);
    assert.equal(policy.update(200, 440, 0).answer, undefined);
    assert.equal(policy.update(300, 440, 0).answer, undefined);
    assert.equal(policy.update(400, 440, 0).answer, undefined);
    assert.equal(policy.update(500, 440, 0).answer, 69);
  }
  const policy = new MicrophoneHold();
  policy.update(0, 440, 0);
  assert.equal(policy.update(300, 440, 0).progress, 0);
  assert.equal(policy.update(400, 440, 0, false).answer, undefined);
  assert.equal(policy.update(450, 440, 0).progress, 0);
});
