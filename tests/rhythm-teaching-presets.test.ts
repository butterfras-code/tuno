import { notationOnly } from './score-test-support.ts';
import { score } from './score-test-support.ts';
import { note } from './score-test-support.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { teachingPresets, criteriaSource, resolveTeachingPreset, applyTeachingPreset, customizeTeachingPreset } from '../src/apps/rhythm-walk/shared/teaching-presets.ts';
import type { TeachingPresetDefinition } from '../src/apps/rhythm-walk/shared/teaching-presets.ts';
import { generationCapabilities } from '../src/apps/rhythm-walk/shared/capabilities.ts';
import { defaultGeneration, generateExercise as generateScore, generationIssue, rhythmCapabilities } from '../src/apps/rhythm-walk/shared/generation.ts';
import { Activity, defaultPreferences, modes, presets, readPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { countGrid } from '../src/apps/count-writing/grid.ts';
import { blankAnswer, evaluatePassage } from './legacy/count-evaluation.ts';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';

// Independent source expectations: do not generate these from the definitions.
const expectedGeneral = [
  ['Q', 'H', 'H.', 'W', 'E E'],
  ['Q', 'H', 'H.', 'W', 'E E'],
  ['Q', 'H', 'H.', 'W', 'E E', 'Q. E'],
  ['Q', 'H', 'H.', 'W', 'E E', 'Q. E', 'E Q E', 'E. S', 'S S S S', 'E S S'],
  ['Q', 'H', 'H.', 'W', 'E E', 'Q. E', 'E Q E', 'E. S', 'S S S S', 'E S S', 'E3:2 E3:2 E3:2', 'S S E'],
  ['Q', 'H', 'H.', 'W', 'E E', 'Q. E', 'E Q E', 'E. S', 'S S S S', 'E S S', 'E3:2 E3:2 E3:2', 'S S E'],
];
test('I–IV definitions preserve independently inspected figures and source restrictions', () => {
  assert.deepEqual(teachingPresets.map(p => p.id), ['uil-1', 'uil-2', 'uil-3', 'uil-4']);
  for (const [index, definition] of teachingPresets.entries()) {
    assert.equal(definition.version, 4); assert.deepEqual(definition.source, criteriaSource);
    assert.deepEqual(definition.figures.filter(f => f.scope === 'general').map(f => f.events.join(' ')), expectedGeneral[index]);
    assert.deepEqual(definition.figures.filter(f => f.scope === 'percussion').map(f => f.events.join(' ')), index < 2 ? ['E S S', 'S S S S'] : index === 2 ? ['E S S', 'S S S S', 'E. S'] : []);
    assert.ok(resolveTeachingPreset(definition).supported);
  }
  assert.deepEqual(teachingPresets.map(p => p.meterChanges), [0, 0, 0, 1]); // Source requirement, not generation behavior.
  assert.deepEqual(teachingPresets[2]!.officialMeters, ['2/4', '3/4', '4/4']);
});
test('whole notes have independent counts, duration endpoint and shared performance timing', () => {
  const measure = { meter: [4, 4] as const, notes: [note('whole')] };
  const grid = countGrid(measure);
  assert.deepEqual(grid.availableSlots, [0, 2, 4, 6]);
  assert.deepEqual(grid.slots.filter(s => s.available).map(s => s.symbol), ['1', '2', '3', '4']);
  const answer = blankAnswer(measure); answer.symbols = ['1', '', '2', '', '3', '', '4', ''];
  const correct = evaluatePassage([measure], [answer], 'required', [{ start: 0, end: 7 }]);
  assert.equal(correct[0]!.counts.verdict, 'correct'); assert.equal(correct[0]!.spans.verdict, 'correct');
  answer.symbols[6] = ''; assert.equal(evaluatePassage([measure], [answer])[0]!.counts.verdict, 'revise');
  const capture = new Capture({ id: 'whole-test', label: 'Whole', description: '', score: score([measure]) }, 60, true);
  assert.equal(capture.plan.notes.length, 1);
  const sound = capture.plan.notes[0]!; assert.equal(sound.end - sound.start, 4);
  capture.input('down', 'keyboard', sound.start, sound.start * 1000);
  capture.input('up', 'keyboard', sound.end, sound.end * 1000);
  const result = evaluateAttempt(capture.advance(capture.plan.captureEnd)!);
  assert.deepEqual(result.missing, []); assert.deepEqual(result.extra, []);
  assert.equal(result.matches[0]!.releaseOffset, 0);
  assert.deepEqual(notationOnly(generateExercise({ ...defaultGeneration(), ingredients: ['whole'], measures: 4 }, () => 0).map(m => m.notes)), notationOnly(Array.from({ length: 4 }, () => [note('whole')])));
  for (const meter of ['2/4', '3/4', '6/8'] as const) assert.ok(generationIssue({ ...defaultGeneration(), meters: [meter], ingredients: ['whole'] }));
});

test('whole rests exceed the generation cap but authored rests retain counting and silent performance', () => {
  const settings = { ...defaultGeneration(), ingredients: ['whole-rest' as const] };
  assert.ok(!defaultGeneration().ingredients.includes('whole-rest'));
  assert.throws(() => generateExercise(settings, () => 0), /15% rests/);
  const measures = score([{ meter: [4, 4], notes: [note('whole', { kind: 'rest' })] }, { meter: [4, 4], notes: [note('whole', { kind: 'rest' })] }]).measures;
  assert.deepEqual(notationOnly(measures.map(m => m.notes)), notationOnly([[note('whole', { kind: 'rest' })], [note('whole', { kind: 'rest' })]]));
  for (const meter of ['2/4', '3/4', '6/8'] as const) {
    assert.ok(!rhythmCapabilities(meter).ingredients.includes('whole-rest'));
    assert.ok(generationIssue({ ...settings, meters: [meter] }));
  }
  const measure = measures[0]!;
  const answer = blankAnswer(measure);
  answer.symbols = ['1', '', '2', '', '3', '', '4', ''];
  answer.spans = [{ start: 0, end: 7 }]; answer.rests = [{ start: 0, end: 6 }];
  const result = evaluatePassage([measure], [answer])[0]!;
  assert.equal(result.counts.verdict, 'correct'); assert.equal(result.spans.verdict, 'correct'); assert.equal(result.rests.verdict, 'correct');
  answer.rests = [{ start: 0, end: 2 }, { start: 4, end: 6 }];
  assert.equal(evaluatePassage([measure], [answer])[0]!.rests.verdict, 'revise');
  for (const style of ['tap', 'hold'] as const) {
    const capture = new Capture({ id: 'whole-rest', label: 'Whole rest', description: '', score: score([measure]) }, 60, true, undefined, undefined, style);
    assert.deepEqual(capture.plan.notes, []);
    assert.equal(capture.plan.rests[0]!.end - capture.plan.rests[0]!.start, 4);
    const evaluation = evaluateAttempt(capture.advance(capture.plan.captureEnd)!);
    assert.deepEqual(evaluation.missing, []); assert.deepEqual(evaluation.extra, []);
  }
  const preferences = defaultPreferences(); preferences.generation = settings;
  assert.deepEqual(readPreferences(JSON.stringify(preferences)).generation.ingredients, ['whole-rest']);
});

/** Test-only teaching template that the unmodified engine really can enforce. Not a UIL level. */
const quarterPractice: TeachingPresetDefinition = {
  ...teachingPresets[0]!, id: 'test-quarter-practice', label: 'Quarter practice test',
  figures: [{ events: ['Q'], url: teachingPresets[0]!.figures[0]!.url, scope: 'general' }],
  restrictions: [], unresolved: [],
  recommended: { ...defaultGeneration(), ingredients: ['quarter'], ties: false, syncopation: false },
  required: { ingredients: ['quarter'], patterns: [], meters: ['4/4'] },
};
test('supported application changes pending settings only, preserves length, and deliberately reapplies', () => {
  const preferences = defaultPreferences(); preferences.generation.measures = 4;
  preferences.mode = 'both'; preferences.countingSystem = 'syllables'; preferences.bpm = 123; preferences.playStyle = 'hold';
  const activity = new Activity(preferences, score(presets[0]!.score.measures));
  const before = structuredClone(preferences); const exercise = activity.exercise;
  const applied = applyTeachingPreset(preferences.generation, quarterPractice, generationCapabilities());
  assert.equal(applied.supported, true); if (!applied.supported) return;
  preferences.generation = applied.settings;
  assert.equal(preferences.generation.measures, 4); assert.strictEqual(activity.exercise, exercise);
  assert.deepEqual({ ...preferences, generation: before.generation }, before);
  const customized = customizeTeachingPreset({ ...applied.settings, meters: ['6/8'], ingredients: ['eighth'] });
  assert.equal(customized.teachingPreset?.customized, true); assert.equal(generationIssue(customized), null);
  const reapplied = applyTeachingPreset(customized, quarterPractice);
  assert.equal(reapplied.supported, true); if (!reapplied.supported) return;
  assert.equal(reapplied.settings.teachingPreset?.customized, false); assert.equal(reapplied.settings.measures, 4);
  assert.deepEqual(reapplied.settings.meters, ['4/4']);
  preferences.generation = reapplied.settings;
  const replacement = activity.next(() => .2); assert.notEqual(replacement.id, exercise.id);
  assert.equal(replacement.score.measures.length, 4);
  // Independent allowed/forbidden exercise expectation for the enforceable test template.
  assert.deepEqual(notationOnly(replacement.score.measures.map(m => m.notes)), notationOnly(Array.from({ length: 4 }, () => [note('quarter'), note('quarter'), note('quarter'), note('quarter')])));
});
test('unsupported application leaves pending settings and current exercise unchanged', () => {
  const preferences = defaultPreferences(); const activity = new Activity(preferences, score(presets[0]!.score.measures));
  const before = structuredClone(preferences); const exercise = activity.exercise;
  for (const definition of teachingPresets) assert.equal(applyTeachingPreset(preferences.generation, definition, { ingredients: [], patterns: [], meters: [] }).supported, false);
  assert.deepEqual(preferences, before); assert.strictEqual(activity.exercise, exercise);
  assert.equal(applyTeachingPreset({ ...defaultGeneration(), measures: 9 }, quarterPractice).supported, false);
});
test('independent meter override uses one meter per passage in every response mode', () => {
  const settings = { ...defaultGeneration(), meters: ['4/4', '6/8'] as const, ingredients: ['quarter', 'eighth'] as const };
  for (const draw of [.1, .8]) {
    const generated = generateExercise({ ...settings, meters: [...settings.meters], ingredients: [...settings.ingredients] }, () => draw);
    assert.ok(generated.every(m => m.meter.join('/') === generated[0]!.meter.join('/')));
    const activity = new Activity(defaultPreferences(), score(generated)); const exercise = activity.exercise;
    for (const mode of modes) { activity.setMode(mode); assert.strictEqual(activity.exercise, exercise); assert.deepEqual(activity.exercise.score.measures, generated); }
  }
});
test('preference migration validates attribution separately and never trusts a saved exact label', () => {
  const preferences = defaultPreferences(); preferences.bpm = 117; preferences.generation.measures = 3;
  preferences.generation.teachingPreset = { id: 'uil-1', version: 1, customized: false };
  const restored = readPreferences(JSON.stringify(preferences));
  assert.deepEqual(restored.generation.teachingPreset, { id: 'uil-1', version: 4, customized: true, scope: 'general' });
  assert.equal(restored.bpm, 117); assert.equal(restored.generation.measures, 3);
  for (const malformed of [null, {}, { id: 'uil-9', version: 1, customized: false }, { id: 'uil-1', version: 99, customized: false }, { id: 'uil-1', version: 1, customized: 'no' }]) {
    assert.equal(readPreferences(JSON.stringify({ ...preferences, generation: { ...preferences.generation, teachingPreset: malformed } })).generation.teachingPreset, undefined);
  }
  delete preferences.generation.teachingPreset;
  assert.deepEqual(readPreferences(JSON.stringify(preferences)), preferences);
  assert.deepEqual(readPreferences('{bad'), defaultPreferences());
  const applied = applyTeachingPreset(preferences.generation, teachingPresets[0]!);
  assert.ok(applied.supported); if (!applied.supported) return;
  const exact = readPreferences(JSON.stringify({ ...preferences, generation: applied.settings }));
  assert.equal(exact.generation.teachingPreset?.customized, false);
  assert.deepEqual(exact.generation.figureProfile, { version: 1, level: 1, scope: 'general' });
  for (const invalid of [{ version: 99, level: 1, scope: 'general' }, null, { version: 1, level: 1 }]) {
    const restored = readPreferences(JSON.stringify({ ...preferences, generation: { ...applied.settings, figureProfile: invalid } }));
    assert.equal(restored.generation.figureProfile, undefined); assert.equal(restored.generation.teachingPreset?.customized, true);
  }
});


test('integrated capability catalogue derives meter support and rejects globally-only ingredients', () => {
  const capabilities = generationCapabilities();
  for (const meter of capabilities.meters) {
    assert.deepEqual(capabilities.byMeter![meter], rhythmCapabilities(meter));
  }
  assert.ok(capabilities.byMeter!['4/4']!.ingredients.includes('triplet-eighth'));
  assert.ok(!capabilities.byMeter!['6/8']!.ingredients.includes('triplet-eighth'));
  assert.ok(!capabilities.byMeter!['6/8']!.ingredients.includes('whole'));
  assert.ok(!capabilities.byMeter!['2/4']!.ingredients.includes('dotted-half'));
  assert.equal(resolveTeachingPreset(teachingPresets[0]!, capabilities).supported, true);
  const missing = structuredClone(capabilities);
  missing.byMeter!['4/4']!.ingredients = [];
  const result = resolveTeachingPreset(teachingPresets[0]!, missing);
  assert.equal(result.supported, false);
  if (!result.supported) assert.ok(result.reasons.includes('Missing ingredient in selected meters: whole.'));
  for (const preset of teachingPresets) assert.equal(resolveTeachingPreset(preset, capabilities).supported, true);
});

const generateExercise = (...args: Parameters<typeof generateScore>) => generateScore(...args).measures;
