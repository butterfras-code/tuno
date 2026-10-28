import test from 'node:test';
import assert from 'node:assert/strict';
import { Activity, defaultPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { note, score } from '../src/music/measure.ts';
import { enterToken, toggleUnit, evaluateAnswer } from '../src/music/counting/answer.ts';
import { countingPreviewScore } from '../src/apps/rhythm-walk/shared/counting-preview.ts';

function example() {
  return new Activity(defaultPreferences(), countingPreviewScore);
}
function checked(activity: Activity) {
  activity.checkedCountingAnswer = activity.countingAnswer;
  activity.countingResult = evaluateAnswer(activity.countingPlan, activity.countingAnswer);
}

test('saving subdivision changes keeps score identity, compatible answers and unit evidence', () => {
  const activity = example(), exercise = activity.exercise;
  const first = activity.countingPlan.counts[0]!;
  activity.countingAnswer = enterToken(activity.countingPlan, activity.countingAnswer, first.id, '1');
  activity.countingAnswer = toggleUnit(activity.countingPlan, activity.countingAnswer, first.id, 'durationIndicated');
  checked(activity);
  activity.saveCounting({ ...activity.preferences.counting, dotted: true });
  assert.strictEqual(activity.exercise, exercise);
  assert.strictEqual(activity.countingPlan.source, exercise.score);
  assert.equal(activity.countingAnswer.counts[first.id], '1');
  assert.equal(activity.countingAnswer.units[first.unitId]!.durationIndicated, true);
  assert.equal(activity.countingAnswer.counts['count:1:1/8'], '');
  assert.equal(activity.countingResult, null);
  assert.equal(activity.checkedCountingAnswer, null);
});

test('appearance and offbeat display changes retain confirmed feedback and canonical tokens', () => {
  const activity = example(), count = activity.countingPlan.counts.find(c => c.expectedToken === '&')!;
  activity.countingAnswer = enterToken(activity.countingPlan, activity.countingAnswer, count.id, '+');
  checked(activity);
  const result = activity.countingResult, snapshot = activity.checkedCountingAnswer;
  activity.saveCounting({ ...activity.preferences.counting, linePlacement: 'above', internalAppearance: 'lowered', restAppearance: 'slashes', offbeat: '+' });
  assert.equal(activity.countingAnswer.counts[count.id], '&');
  assert.strictEqual(activity.countingResult, result);
  assert.strictEqual(activity.checkedCountingAnswer, snapshot);
});

test('vocabulary changes retain shared counts and clear entries at incompatible positions', () => {
  const activity = example();
  for (const c of activity.countingPlan.counts) activity.countingAnswer = enterToken(activity.countingPlan, activity.countingAnswer, c.id, c.expectedToken);
  const previous = activity.countingPlan;
  checked(activity);
  activity.saveCounting({ ...activity.preferences.counting, vocabulary: 'syllables' });
  for (const c of activity.countingPlan.counts) {
    const before = previous.counts.find(p => p.id === c.id)!;
    assert.equal(activity.countingAnswer.counts[c.id], before.expectedToken === c.expectedToken ? c.expectedToken : '');
  }
  assert.equal(activity.countingResult, null);
});

test('removing/restoring subdivision or rests removes foreign evidence and restores blank inputs', () => {
  const activity = example();
  for (const c of activity.countingPlan.counts) activity.countingAnswer = enterToken(activity.countingPlan, activity.countingAnswer, c.id, c.expectedToken);
  const original = activity.countingPlan;
  activity.saveCounting({ ...activity.preferences.counting, longNotes: false, includeRests: false });
  const retained = new Set(activity.countingPlan.counts.map(c => c.id));
  assert.deepEqual(Object.keys(activity.countingAnswer.counts), [...retained]);
  activity.saveCounting({ ...activity.preferences.counting, longNotes: true, includeRests: true });
  for (const c of original.counts) assert.equal(activity.countingAnswer.counts[c.id], retained.has(c.id) ? c.expectedToken : '');
});

test('suppressing duration assessment invalidates grading and clears suppressed evidence', () => {
  const activity = example(), c = activity.countingPlan.counts[0]!;
  activity.countingAnswer = toggleUnit(activity.countingPlan, activity.countingAnswer, c.id, 'durationIndicated');
  checked(activity);
  activity.saveCounting({ ...activity.preferences.counting, showDurationLine: false, internalAppearance: 'unchanged' });
  assert.equal(activity.countingAnswer.units[c.unitId]!.durationIndicated, false);
  assert.equal(activity.countingResult, null);
});

test('saved presentation retains one cross-bar tie unit and its evidence', () => {
  const activity = new Activity(defaultPreferences(), score([
    { meter: [4, 4], notes: [note('whole', { tieNext: true })] },
    { meter: [4, 4], notes: [note('half'), note('half', { kind: 'rest' })] },
  ]));
  const c = activity.countingPlan.counts[0]!;
  activity.countingAnswer = toggleUnit(activity.countingPlan, activity.countingAnswer, c.id, 'durationIndicated');
  activity.saveCounting({ ...activity.preferences.counting, linePlacement: 'below' });
  assert.equal(activity.countingPlan.units[0]!.symbolIds.length, 2);
  assert.equal(activity.countingAnswer.units[c.unitId]!.durationIndicated, true);
});
