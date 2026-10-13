import test from 'node:test';
import assert from 'node:assert/strict';
import { teachingPresets, criteriaSource, resolveTeachingPreset, applyTeachingPreset, customizeTeachingPreset } from '../src/apps/rhythm-walk/shared/teaching-presets.ts';
import type { TeachingPresetDefinition } from '../src/apps/rhythm-walk/shared/teaching-presets.ts';
import { generationCapabilities } from '../src/apps/rhythm-walk/shared/capabilities.ts';
import { defaultGeneration, generateExercise, generationIssue, rhythmCapabilities } from '../src/apps/rhythm-walk/shared/generation.ts';
import { Activity, defaultPreferences, modes, presets, readPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { countGrid } from '../src/apps/count-writing/grid.ts';
import { blankAnswer, evaluatePassage } from '../src/apps/count-writing/evaluation.ts';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';
import { deriveMeasure } from '../src/music/measure.ts';

// Independent source expectations: do not generate these from the definitions.
const expectedGeneral = [
  ['Q', 'H', 'H.', 'W', 'E E'],
  ['Q', 'H', 'H.', 'W', 'E E'],
  ['Q', 'H', 'H.', 'W', 'E E', 'Q. E'],
  ['Q', 'H', 'H.', 'W', 'E E', 'Q. E', 'E Q E', 'E. S', 'S S S S', 'E S S'],
  ['Q', 'H', 'H.', 'W', 'E E', 'Q. E', 'E Q E', 'E. S', 'S S S S', 'E S S', 'E3:2 E3:2 E3:2', 'S S E'],
  ['Q', 'H', 'H.', 'W', 'E E', 'Q. E', 'E Q E', 'E. S', 'S S S S', 'E S S', 'E3:2 E3:2 E3:2', 'S S E'],
];
test('all six stable definitions have versioned provenance and exact inspected figures', () => {
  assert.deepEqual(teachingPresets.map(p => p.id), ['uil-1', 'uil-2', 'uil-3', 'uil-4', 'uil-5', 'uil-6']);
  assert.deepEqual(teachingPresets.map(p => p.label), ['UIL I', 'UIL II', 'UIL III', 'UIL IV', 'UIL V', 'UIL VI']);
  for (const [index, definition] of teachingPresets.entries()) {
    assert.equal(definition.version, 1); assert.deepEqual(definition.source, criteriaSource);
    assert.equal(definition.source.revision, 'Revised 2022'); assert.equal(definition.source.retrieved, '2026-10-12');
    assert.deepEqual(definition.figures.filter(f => f.scope === 'general').map(f => f.events.join(' ')), expectedGeneral[index]);
    assert.ok(definition.figures.every(f => f.url.startsWith('https://www.uiltexas.org/files/music/music-notations/')));
    const percussion = definition.figures.filter(f => f.scope === 'percussion').map(f => f.events.join(' '));
    assert.deepEqual(percussion, index < 2 ? ['E S S', 'S S S S'] : index === 2 ? ['E S S', 'S S S S', 'E. S'] : []);
    // Merely allowing S/E does not authorize these unlisted figures.
    for (const forbidden of ['S E S', 'E. E.', 'E3:2 rest E3:2']) assert.ok(!definition.figures.some(f => f.events.join(' ') === forbidden));
  }
  assert.deepEqual(teachingPresets.map(p => p.meterChanges), [0, 0, 0, 1, 2, 3]);
  assert.deepEqual(teachingPresets[0]!.officialMeters, ['4/4']);
  assert.deepEqual(teachingPresets[2]!.officialMeters, ['2/4', '3/4', '4/4']);
  assert.deepEqual(teachingPresets[4]!.officialMeters, ['2/4', '3/4', '4/4', '6/8', 'cut-time']);
  assert.ok(teachingPresets[2]!.restrictions.some(r => r.includes('2023')));
});
test('higher levels remain blocked, independently of sounded eighth triplet support', () => {
  const actual = generationCapabilities();
  assert.ok(actual.ingredients.includes('triplet-eighth'));
  for (const definition of teachingPresets.slice(2)) for (const triplets of [false, true]) {
    const result = resolveTeachingPreset(definition, { ...actual, ingredients: [...actual.ingredients.filter(id => id !== 'triplet-eighth'), ...(triplets ? ['triplet-eighth'] : [])] });
    assert.equal(result.supported, false);
    if (!result.supported) {
      assert.ok(!result.reasons.includes('Missing ingredient: whole.'));
      assert.ok(result.reasons.includes(`Missing pattern support: ${definition.id}-figures.`));
      assert.equal(result.reasons.includes('Missing ingredient: triplet-eighth.'), Number(definition.id.slice(-1)) >= 5 && !triplets);
      assert.ok(result.reasons.some(r => r.includes('clarification')));
    }
  }
});
test('capability query checks meters and patterns independently of ingredients', () => {
  const definition = teachingPresets[4]!;
  const complete = { ingredients: [...definition.required.ingredients], patterns: [...definition.required.patterns], meters: [...definition.required.meters] };
  const result = resolveTeachingPreset({ ...definition, unresolved: [] }, { ...complete, patterns: complete.patterns.filter(p => p !== 'cut-time'), meters: ['4/4'] });
  assert.equal(result.supported, false);
  if (!result.supported) { assert.ok(result.reasons.includes('Missing pattern support: cut-time.')); assert.ok(result.reasons.includes('Unsupported meter: 6/8.')); }
});
test('I–II note-only presets require paired figures, not just vocabulary', () => {
  const capabilities = generationCapabilities();
  assert.ok(!capabilities.byMeter?.['6/8']?.ingredients.includes('whole'));
  assert.ok(!capabilities.byMeter?.['2/4']?.ingredients.includes('dotted-half'));
  assert.ok(capabilities.byMeter?.['4/4']?.ingredients.includes('whole'));
  const missingByMeter = { ...capabilities, byMeter: { ...capabilities.byMeter, '4/4': { ingredients: capabilities.ingredients, patterns: [] } } };
  assert.equal(resolveTeachingPreset(teachingPresets[0]!, missingByMeter).supported, false);
  for (const definition of teachingPresets.slice(0, 2)) {
    assert.equal(resolveTeachingPreset(definition).supported, true);
    for (const missing of ['paired-eighths', 'no-quarter-rest-beat-one']) {
      const result = resolveTeachingPreset(definition, { ...capabilities, patterns: capabilities.patterns.filter(p => p !== missing) });
      assert.equal(result.supported, false);
    }
    assert.equal(resolveTeachingPreset(definition, { ...capabilities, ingredients: capabilities.ingredients.filter(i => i !== 'whole') }).supported, false);
    let seed = 123;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let sample = 0; sample < 200; sample++) {
      const result = applyTeachingPreset({ ...defaultGeneration(), measures: 4 }, definition);
      assert.equal(result.supported, true); if (!result.supported) continue;
      const passage = generateExercise(result.settings, random);
      for (const measure of passage) {
        assert.deepEqual(measure.meter, [4, 4]);
        const events = deriveMeasure(measure).events;
        for (let i = 0; i < events.length; i++) {
          const event = events[i]!;
          assert.ok(!event.written[1]?.rest && !event.written[1]?.tieNext && !event.written[1]?.tuplet);
          if (event.written[0] === 'E') {
            assert.equal((event.start[0] * 4) % event.start[1], 0, 'pair begins on a quarter beat');
            assert.deepEqual(events[++i]?.written, ['E'], 'independently require second eighth');
          } else {
            assert.ok(event.written[0] === 'Q' || event.written[0] === 'H' || event.written[0] === 'W');
            assert.ok(!event.written[1]?.dots || event.written[0] === 'H');
          }
        }
      }
    }
  }
});
test('downbeat-rest restriction and impossible paired patterns fail without retries', () => {
  const settings = { ...defaultGeneration(), ingredients: ['quarter-rest', 'eighth'] as const, restrictions: { pairedEighths: true, noQuarterRestBeatOne: true } };
  for (const draw of [0, .3, .9]) {
    const measures = generateExercise({ ...settings, ingredients: [...settings.ingredients] }, () => draw);
    assert.ok(measures.every(m => !m.events[0]![1]?.rest));
    for (const measure of measures) for (let i = 0; i < measure.events.length; i++) if (measure.events[i]![0] === 'E') assert.deepEqual(measure.events[++i], ['E']);
  }
  assert.ok(generationIssue({ ...settings, ingredients: ['quarter-rest'] }));
  assert.ok(generationIssue({ ...settings, ingredients: ['sixteenth'] }));
  assert.ok(generationIssue({ ...settings, ingredients: ['eighth'], meters: ['6/8'] }));
  assert.ok(generationIssue({ ...settings, ingredients: ['eighth'], ties: true }));
});
test('whole notes have independent counts, duration endpoint and shared performance timing', () => {
  const measure = { meter: [4, 4] as const, events: [['W'] as const] };
  const grid = countGrid(measure);
  assert.deepEqual(grid.availableSlots, [0, 2, 4, 6]);
  assert.deepEqual(grid.slots.filter(s => s.available).map(s => s.symbol), ['1', '2', '3', '4']);
  const answer = blankAnswer(measure); answer.symbols = ['1', '', '2', '', '3', '', '4', ''];
  const correct = evaluatePassage([measure], [answer], 'required', [{ start: 0, end: 7 }]);
  assert.equal(correct[0]!.counts.verdict, 'correct'); assert.equal(correct[0]!.spans.verdict, 'correct');
  answer.symbols[6] = ''; assert.equal(evaluatePassage([measure], [answer])[0]!.counts.verdict, 'revise');
  const capture = new Capture({ id: 'whole-test', label: 'Whole', description: '', measures: [measure] }, 60, true);
  assert.equal(capture.plan.notes.length, 1);
  const note = capture.plan.notes[0]!; assert.equal(note.end - note.start, 4);
  capture.input('down', 'keyboard', note.start, note.start * 1000);
  capture.input('up', 'keyboard', note.end, note.end * 1000);
  const result = evaluateAttempt(capture.advance(capture.plan.captureEnd)!);
  assert.deepEqual(result.missing, []); assert.deepEqual(result.extra, []);
  assert.equal(result.matches[0]!.releaseOffset, 0);
  assert.deepEqual(generateExercise({ ...defaultGeneration(), ingredients: ['whole'] }, () => 0).map(m => m.events), [[['W']], [['W']]]);
  for (const meter of ['2/4', '3/4', '6/8'] as const) assert.ok(generationIssue({ ...defaultGeneration(), meters: [meter], ingredients: ['whole'] }));
  assert.throws(() => countGrid({ meter: [4, 4], events: [['W', { rest: true }]] }));
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
  const activity = new Activity(preferences, presets[0]!.measures);
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
  assert.equal(replacement.measures.length, 4);
  // Independent allowed/forbidden exercise expectation for the enforceable test template.
  assert.deepEqual(replacement.measures.map(m => m.events), Array.from({ length: 4 }, () => [['Q'], ['Q'], ['Q'], ['Q']]));
});
test('blocked application leaves pending settings and current exercise unchanged', () => {
  const preferences = defaultPreferences(); const activity = new Activity(preferences, presets[0]!.measures);
  const before = structuredClone(preferences); const exercise = activity.exercise;
  for (const definition of teachingPresets.slice(2)) assert.equal(applyTeachingPreset(preferences.generation, definition).supported, false);
  assert.deepEqual(preferences, before); assert.strictEqual(activity.exercise, exercise);
  assert.equal(applyTeachingPreset({ ...defaultGeneration(), measures: 9 }, quarterPractice).supported, false);
});
test('independent meter override uses one meter per passage in every response mode', () => {
  const settings = { ...defaultGeneration(), meters: ['4/4', '6/8'] as const, ingredients: ['quarter', 'eighth'] as const };
  for (const draw of [.1, .8]) {
    const generated = generateExercise({ ...settings, meters: [...settings.meters], ingredients: [...settings.ingredients] }, () => draw);
    assert.ok(generated.every(m => m.meter.join('/') === generated[0]!.meter.join('/')));
    const activity = new Activity(defaultPreferences(), generated); const exercise = activity.exercise;
    for (const mode of modes) { activity.setMode(mode); assert.strictEqual(activity.exercise, exercise); assert.deepEqual(activity.exercise.measures, generated); }
  }
});
test('preference migration validates attribution separately and never trusts a saved exact label', () => {
  const preferences = defaultPreferences(); preferences.bpm = 117; preferences.generation.measures = 3;
  preferences.generation.teachingPreset = { id: 'uil-1', version: 1, customized: false };
  const restored = readPreferences(JSON.stringify(preferences));
  assert.deepEqual(restored.generation.teachingPreset, { id: 'uil-1', version: 1, customized: true });
  assert.equal(restored.bpm, 117); assert.equal(restored.generation.measures, 3);
  for (const malformed of [null, {}, { id: 'uil-9', version: 1, customized: false }, { id: 'uil-1', version: 2, customized: false }, { id: 'uil-1', version: 1, customized: 'no' }]) {
    assert.equal(readPreferences(JSON.stringify({ ...preferences, generation: { ...preferences.generation, teachingPreset: malformed } })).generation.teachingPreset, undefined);
  }
  delete preferences.generation.teachingPreset;
  assert.deepEqual(readPreferences(JSON.stringify(preferences)), preferences);
  assert.deepEqual(readPreferences('{bad'), defaultPreferences());
  const applied = applyTeachingPreset(preferences.generation, teachingPresets[0]!);
  assert.ok(applied.supported); if (!applied.supported) return;
  const exact = readPreferences(JSON.stringify({ ...preferences, generation: applied.settings }));
  assert.equal(exact.generation.teachingPreset?.customized, false);
  assert.deepEqual(exact.generation.restrictions, { pairedEighths: true, noQuarterRestBeatOne: true });
  for (const invalid of [{ pairedEighths: 'yes', noQuarterRestBeatOne: true }, null, { pairedEighths: true }]) {
    const restored = readPreferences(JSON.stringify({ ...preferences, generation: { ...applied.settings, restrictions: invalid } }));
    assert.equal(restored.generation.restrictions, undefined); assert.equal(restored.generation.teachingPreset?.customized, true);
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
  for (const preset of teachingPresets.slice(2)) assert.equal(resolveTeachingPreset(preset, capabilities).supported, false);
});
