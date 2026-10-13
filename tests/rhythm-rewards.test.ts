import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { assessAttempt } from '../src/apps/rhythm-walk/assessment.ts';
import type { Assessment } from '../src/apps/rhythm-walk/assessment.ts';
import { performanceRewards, TreatBagState } from '../src/apps/rhythm-walk/rewards.ts';
import type { RewardMetric } from '../src/apps/rhythm-walk/rewards.ts';
import { Activity, defaultPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { musicalFeedback, steadinessDescription } from '../src/apps/rhythm-walk/results.ts';

const preferences = defaultPreferences();
const activity = new Activity(preferences, Array.from({ length: 2 }, () => ({ meter: [4, 4], events: [['Q'], ['Q'], ['Q'], ['Q']] })));
function completed(style: 'tap' | 'hold' = 'hold') {
  const c = new Capture(activity.exercise, 120, false, undefined, undefined, style);
  for (const time of [0, .5, 1, 1.5, 2, 2.5, 3, 3.5]) {
    c.input('down', 'keyboard', time, time * 1000);
    c.input('up', 'keyboard', time + .4, (time + .4) * 1000);
  }
  return c.advance(c.plan.captureEnd)!;
}
const record = completed();
const assessed = assessAttempt(record);
function metric(metric: RewardMetric, value: number | null | undefined): Assessment {
  return { ...assessed, [metric]: metric === 'tempo' ? value == null ? null : { ...assessed.tempo!, differencePercent: value } : value } as Assessment;
}
const rating = (a: Assessment, key: RewardMetric) => performanceRewards(record, a).categories.find(c => c.metric === key)?.bones;

for (const [key, boundaries] of Object.entries({ rhythm: [90, 75, 60, 40], hold: [85, 70, 55, 35], tempo: [7, 12, 20, 30], steadiness: [7, 12, 20, 30] }) as [RewardMetric, number[]][]) {
  test(`${key}: every boundary and immediately adjacent unrounded values`, () => {
    boundaries.forEach((boundary, i) => {
      assert.equal(rating(metric(key, boundary), key), 5 - i);
      const ascending = key === 'rhythm' || key === 'hold';
      assert.equal(rating(metric(key, boundary + .000001), key), ascending ? 5 - i : 4 - i);
      assert.equal(rating(metric(key, boundary - .000001), key), ascending ? 4 - i : 5 - i);
    });
    for (const absent of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(rating(metric(key, absent), key), null);
  });
}
test('tempo sign does not change rewards; steady beat remains independent', () => {
  for (const value of [0, 7, 7.00001, 12, 12.00001, 20, 20.00001, 30, 30.00001, 40]) assert.equal(rating(metric('tempo', value), 'tempo'), rating(metric('tempo', -value), 'tempo'));
  const a = { ...metric('tempo', 25), rhythm: 39, steadiness: 7 } as Assessment;
  assert.deepEqual(performanceRewards(record, a).categories.map(c => c.bones), [1, 5, 2, 5]);
  assert.equal(steadinessDescription(7, a), 'Steady');
  assert.notEqual(musicalFeedback(record, a).suggestion, 'Keep the same pace through the whole exercise.');
});
test('interrupted, no input, all rests and unavailable assessment never earn bones', () => {
  for (const [r, a] of [
    [{ ...record, status: 'interrupted' as const }, assessed],
    [record, { ...assessed, capturedAttacks: 0, rhythm: 0 }],
    [record, { ...assessed, expectedAttacks: 0 }],
    [record, { ...assessed, basis: 'unavailable' as const }],
  ] as const) assert.ok(performanceRewards(r, a as Assessment).categories.every(c => c.bones === null));
  assert.equal(rating({ ...assessed, tempo: null, steadiness: 0 } as Assessment, 'steadiness'), null);
});
test('Tap hides holds; short sounds explain unavailable holds; assessed hold credit is used unchanged', () => {
  assert.ok(!performanceRewards({ ...record, playStyle: 'tap' }, assessed).categories.some(c => c.metric === 'hold'));
  const short = performanceRewards(record, { ...assessed, hold: null, holdReason: 'Hold not assessed—short notes only.' }).categories.find(c => c.metric === 'hold')!;
  assert.equal(short.bones, null); assert.equal(short.reason, 'No long notes to check');
  assert.equal(assessed.hold, 100); // 80% written duration earns full assessed sustain credit.
  assert.equal(rating(assessed, 'hold'), 5);
});
test('completed snapshot survives pending settings, every mode, retry and interruption; replacement clears', () => {
  const state = new TreatBagState(); state.finish(record, assessed);
  const original = state.completed;
  preferences.playStyle = 'tap'; preferences.bpm = 180;
  for (const mode of ['write', 'tap', 'both'] as const) { activity.setMode(mode); assert.equal(state.completed, original); }
  assert.equal(state.completed!.record.playStyle, 'hold');
  assert.equal(state.completed!.assessment, assessed);
  state.begin(); assert.equal(state.previous, true);
  state.finish({ ...record, status: 'interrupted' }, assessAttempt({ ...record, status: 'interrupted' }));
  assert.equal(state.completed, original); assert.equal(state.previous, true);
  const nextRecord = completed('tap'); state.finish(nextRecord, assessAttempt(nextRecord));
  assert.equal(state.previous, false); assert.equal(state.completed!.record, nextRecord);
  activity.replace(activity.exercise.measures); state.clear();
  assert.equal(state.completed, null); assert.equal(state.previous, false);
});

test('real no-input and all-rest captures preserve silence evidence without rewards', () => {
  for (const style of ['tap', 'hold'] as const) {
    for (const rests of [false, true]) {
      const exercise = rests ? { ...activity.exercise, measures: [{ meter: [4, 4] as const, events: [['W', { rest: true }] as const] }] } : activity.exercise;
      const capture = new Capture(exercise, 120, false, undefined, undefined, style);
      const r = capture.advance(capture.plan.captureEnd)!;
      const a = assessAttempt(r);
      assert.ok(performanceRewards(r, a).categories.every(c => c.bones === null));
      assert.equal(musicalFeedback(r, a).summary, rests ? 'You left the rests silent.' : 'We didn’t hear the written notes clearly.');
    }
  }
});

test('five-bone wording accepts small rhythm mistakes and seven percent tempo variation', () => {
  const a = { ...metric('tempo', 7), rhythm: 90, missing: 1, steadiness: 7 } as Assessment;
  assert.equal(musicalFeedback(record, a).summary, 'You kept the rhythm!');
  assert.equal(steadinessDescription(7, a), 'Steady');
});
