import test from 'node:test';
import assert from 'node:assert/strict';
import { Activity, defaultPreferences, presets, readPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { defaultCountingPreferences } from '../src/music/counting/preferences.ts';
import { enterToken, toggleUnit, evaluateAnswer } from '../src/music/counting/answer.ts';
import { unitPieces } from '../src/apps/count-writing/plan-editor.ts';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
const fixture = (id: string) => presets.find(p => p.id === id)!.measures;

test('exercise captures preferences; pending vocabulary, rules and appearance preserve answers/results', () => {
  const preferences = defaultPreferences(), activity = new Activity(preferences, fixture('half'));
  const plan = activity.countingPlan, first = plan.counts[0]!;
  activity.countingAnswer = enterToken(plan, activity.countingAnswer, first.id, '1');
  activity.countingAnswer = toggleUnit(plan, activity.countingAnswer, first.id, 'durationIndicated');
  activity.countingResult = evaluateAnswer(plan, activity.countingAnswer);
  const answer = activity.countingAnswer, result = activity.countingResult, exercise = activity.exercise;
  preferences.counting = { ...preferences.counting, vocabulary: 'syllables', dotted: true, longNotes: false, internalAppearance: 'lowered', showDurationLine: false, offbeat: '+' };
  for (const mode of ['both', 'tap', 'write'] as const) {
    activity.setMode(mode); assert.equal(activity.countingPlan, plan); assert.equal(activity.countingAnswer, answer); assert.equal(activity.countingResult, result); assert.equal(activity.exercise, exercise);
  }
  assert.deepEqual(evaluateAnswer(plan, answer), result);
  activity.replace(fixture('half'));
  assert.deepEqual(activity.countingPlan.preferences, preferences.counting);
  assert.equal(activity.countingResult, null); assert.ok(Object.values(activity.countingAnswer.counts).every(v => v === ''));
  assert.ok(Object.values(activity.countingAnswer.units).every(v => !v.restMarked && !v.durationIndicated));
});

test('one-bar and passage views share IDs, answer operations and continuous wrapped unit projections', () => {
  const a = new Activity(defaultPreferences(), fixture('tie-wrap')), p = a.countingPlan;
  const unit = p.units.find(u => u.counts.some(c => c.measure === 0) && u.counts.some(c => c.measure === 1))!;
  const onset = unit.counts[0]!, internal = unit.counts[1]!;
  a.countingAnswer = toggleUnit(p, a.countingAnswer, internal.id, 'durationIndicated');
  a.countingAnswer = toggleUnit(p, a.countingAnswer, onset.id, 'restMarked');
  assert.deepEqual(a.countingAnswer.units[unit.id], { durationIndicated: true, restMarked: true });
  const before = unitPieces(p, 0).find(piece => piece.unit.id === unit.id)!;
  const after = unitPieces(p, 1).find(piece => piece.unit.id === unit.id)!;
  assert.equal(before.unit, after.unit); assert.equal(before.continuesAfter, true); assert.equal(after.continuesBefore, true);
  assert.equal(evaluateAnswer(p, a.countingAnswer).rests.items.find(i => i.id === unit.id)!.verdict, 'incorrect');
  const one = new Activity(defaultPreferences(), fixture('half'));
  assert.ok(unitPieces(one.countingPlan, 0).every(piece => !piece.continuesAfter && !piece.continuesBefore));
});

test('old browser preferences preserve meaningful choices and unrelated settings; reload validates counting version', () => {
  const old = { ...defaultPreferences(), counting: undefined, countingSystem: 'syllables', offbeat: '+', presentation: { linePlacement: 'above', sustainAppearance: 'lowered' }, convention: 'required', bpm: 122, playStyle: 'hold', mode: 'both', metronome: false };
  const migrated = readPreferences(JSON.stringify(old));
  assert.deepEqual(migrated.counting, { ...defaultCountingPreferences, vocabulary: 'syllables', offbeat: '+', linePlacement: 'above', internalAppearance: 'lowered' });
  assert.equal(migrated.playStyle, 'hold'); assert.equal(migrated.bpm, 122); assert.equal(migrated.mode, 'both'); assert.equal(migrated.metronome, false); assert.deepEqual(migrated.generation, old.generation);
  const saved = { ...migrated, counting: { ...migrated.counting, includeRests: false, dotted: true, showDurationLine: false, internalAppearance: 'unchanged' } };
  assert.deepEqual(readPreferences(JSON.stringify(saved)).counting, saved.counting);
  assert.deepEqual(readPreferences(JSON.stringify({ version: 1, counting: { version: 99 } })).counting, defaultCountingPreferences);
  assert.deepEqual(readPreferences('{broken').counting, defaultCountingPreferences);
  assert.deepEqual(readPreferences(JSON.stringify({version:1,presentation:{linePlacement:'invalid',sustainAppearance:'lowered'}})).counting, {...defaultCountingPreferences,internalAppearance:'lowered'});
});

test('rest omission permits zero inputs; presentation suppresses applicable dimensions without changing music', () => {
  const prefs = defaultPreferences(); prefs.counting = { ...prefs.counting, includeRests: false };
  const a = new Activity(prefs, fixture('all-rests'));
  assert.deepEqual(a.countingPlan.counts, []); assert.deepEqual(a.countingAnswer, { counts: {}, units: {} });
  assert.ok(Object.values(evaluateAnswer(a.countingPlan, a.countingAnswer)).every(d => d.verdict === 'not-applicable'));
  prefs.counting = { ...prefs.counting, includeRests: true, showDurationLine: false, internalAppearance: 'unchanged' };
  a.replace(fixture('all-rests'));
  assert.equal(a.countingPlan.units.length, 2);
  assert.equal(evaluateAnswer(a.countingPlan, a.countingAnswer).duration.verdict, 'not-applicable');
  assert.equal(evaluateAnswer(a.countingPlan, a.countingAnswer).rests.verdict, 'incorrect');
});

test('compound fixtures distinguish written dotted half from tied quarters without altering performance', () => {
  for (const dotted of [false, true]) {
    const prefs = defaultPreferences(); prefs.counting = { ...prefs.counting, dotted };
    const half = new Activity(prefs, fixture('six-dotted-half')), tied = new Activity(prefs, fixture('six-dotted-tie'));
    assert.deepEqual(half.countingPlan.counts.map(c => c.expectedToken), ['1', '4']);
    assert.equal(tied.countingPlan.counts.length, dotted ? 6 : 2); assert.equal(tied.countingPlan.units.length, 1);
    const h = new Capture(half.exercise, 80, true), t = new Capture(tied.exercise, 80, true);
    assert.deepEqual(h.plan.notes.map(n => [n.start, n.end]), t.plan.notes.map(n => [n.start, n.end]));
  }
});

test('presentation variants keep independent rest/duration evidence and performance capture across mode switches', () => {
  for (const restAppearance of ['parentheses', 'slashes'] as const) for (const showDurationLine of [false, true]) {
    const prefs = defaultPreferences(); prefs.counting = { ...prefs.counting, restAppearance, showDurationLine };
    const a = new Activity(prefs, fixture('half-rest')), p = a.countingPlan;
    for (const count of p.counts) a.countingAnswer = enterToken(p, a.countingAnswer, count.id, count.expectedToken);
    const rest = p.units.find(u => u.expectedRest)!;
    a.countingAnswer = toggleUnit(p, a.countingAnswer, rest.counts[1]!.id, 'restMarked');
    assert.equal(evaluateAnswer(p, a.countingAnswer).rests.verdict, 'correct');
    assert.equal(evaluateAnswer(p, a.countingAnswer).duration.verdict, 'incorrect');
    a.countingAnswer = toggleUnit(p, a.countingAnswer, rest.counts[0]!.id, 'durationIndicated');
    assert.equal(evaluateAnswer(p, a.countingAnswer).duration.verdict, 'correct');
    const capture = new Capture(a.exercise, 80, true), answer = a.countingAnswer;
    a.setMode('tap'); a.setMode('both'); a.setMode('write');
    assert.equal(a.countingAnswer, answer); assert.equal(capture.plan.notes.length, 3);
  }
});
