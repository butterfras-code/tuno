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
  assert.deepEqual(microphoneTranspositions.map(t => writtenToConcert(60, t.offset)), [60, 58, 53, 51, 48, 46, 39]);
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
  policy.update(700, null, 0, true, true);
  assert.equal(hold(policy, 69, 0, 775).answer, undefined, 'a brief quiet gap does not rearm');
});

test('counted notes survive missing, unreliable, out-of-tune and momentarily different readings across prompts', () => {
  for (const enabled of [true, false]) for (const glitch of [null, NaN, 440 * 2 ** (41 / 1200), noteFrequency(70), noteFrequency(81)]) {
    const policy = new MicrophoneHold();
    assert.equal(hold(policy, 69).answer, 69);
    policy.reset(); // Feedback/new prompt.
    policy.update(375, glitch, 0, enabled);
    policy.reset();
    assert.equal(hold(policy, 69, 0, 450).answer, undefined, `glitch ${glitch}`);
    policy.reset();
    assert.equal(hold(policy, 69, 0, 825).answer, undefined, 'later prompts still cannot reuse the note');
  }
});

test('a stable different pitch counts without silence and becomes the new blocked note', () => {
  const policy = new MicrophoneHold();
  assert.equal(hold(policy, 69).answer, 69);
  policy.reset();
  for (const time of [375, 450, 525, 600, 674]) assert.equal(policy.update(time, noteFrequency(71), 0).answer, undefined);
  assert.equal(policy.update(675, noteFrequency(71), 0).answer, 71);
  policy.reset();
  assert.equal(hold(policy, 71, 0, 750).answer, undefined);
  assert.equal(hold(policy, 69, 0, 1125).answer, 69, 'returning to the earlier pitch is a new note');
});

test('250 ms of confirmed quiet rearms a repeated pitch, including release during feedback', () => {
  const policy = new MicrophoneHold();
  assert.equal(hold(policy, 69).answer, 69);
  for (const time of [375, 450, 525, 600, 624, 625]) {
    policy.reset(); // Locked UI renders must not restart the release timer.
    policy.update(time, null, 0, false, true);
  }
  for (const time of [700, 775, 850, 925, 999]) assert.equal(policy.update(time, 440, 0).answer, undefined);
  assert.equal(policy.update(1000, 440, 0).answer, 69, 'a fresh full hold is required after release');
});

test('release must be continuous quiet evidence, never unreliable readings or an analysis gap', () => {
  for (const [time, frequency, quiet] of [[550, null, false], [550, 440, false], [800, null, true]] as const) {
    const policy = new MicrophoneHold();
    hold(policy, 69);
    policy.update(375, null, 0, true, true);
    policy.update(450, null, 0, true, true);
    policy.update(time, frequency, 0, true, quiet);
    policy.update(time + 75, null, 0, true, true);
    assert.equal(hold(policy, 69, 0, time + 150).answer, undefined);
  }
  const policy = new MicrophoneHold();
  hold(policy, 69);
  for (const time of [375, 450, 525, 600, 675, 750]) policy.update(time, null, 0);
  assert.equal(hold(policy, 69, 0, 825).answer, undefined, 'missing pitches alone never prove release');
});

test('a short quiet gap cannot accumulate across returns to a held pitch', () => {
  const policy = new MicrophoneHold();
  hold(policy, 69);
  for (const start of [375, 975, 1575]) {
    for (const time of [start, start + 75, start + 150, start + 249]) policy.update(time, null, 0, true, true);
    assert.equal(hold(policy, 69, 0, start + 250).answer, undefined);
  }
});

test('locked pitch changes cannot answer or rearm; explicit capture reset clears the latch', () => {
  const policy = new MicrophoneHold();
  hold(policy, 69);
  for (const time of [375, 450, 525, 600, 675]) assert.equal(policy.update(time, noteFrequency(71), 0, false).answer, undefined);
  assert.equal(hold(policy, 69, 0, 750).answer, undefined);
  policy.clear();
  assert.equal(hold(policy, 69, 0, 1125).answer, 69);
});
test('silence, tolerance excursions, pitch changes and stale frames restart the hold', () => {
  for (const interruption of [null, 440 * 2 ** (41 / 1200), noteFrequency(70), NaN]) {
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

test('beginner tolerance accepts pitches up to 40 cents flat or sharp', () => {
  for (const cents of [-40, -35, 35, 40, -41, 41]) {
    const policy = new MicrophoneHold();
    let result;
    for (const time of [0, 75, 150, 225, 300]) result = policy.update(time, 440 * 2 ** (cents / 1200), 0);
    assert.equal(result!.answer, Math.abs(cents) <= 40 ? 69 : undefined, `${cents} cents`);
  }
});
