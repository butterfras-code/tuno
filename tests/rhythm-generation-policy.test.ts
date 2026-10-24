import test from 'node:test';
import assert from 'node:assert/strict';
import { generateExercise, generationIssue, defaultGeneration, ingredients, sixteenthPatterns } from '../src/apps/rhythm-walk/shared/generation.ts';
import { duration, derivePassage } from '../src/music/measure.ts';
import { add, compare, fraction, multiply } from '../src/music/fraction.ts';
import { unoPresets, applyTeachingPreset } from '../src/apps/rhythm-walk/shared/teaching-presets.ts';
import { readPreferences } from '../src/apps/rhythm-walk/activity.ts';

test('rest duration stays below 15% and openings sound across meters, lengths and adversarial draws', () => {
  let seed = 873;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const meter of ['2/4', '3/4', '4/4', '6/8'] as const) for (const measures of [1, 2, 3, 4]) for (const draw of [() => 0, () => .999999, random]) for (let sample = 0; sample < 10; sample++) {
    const source = generateExercise({ ...defaultGeneration(), meters: [meter], measures, ingredients: ingredients.map(i => i.id), ties: true, syncopation: true, allowUnintuitiveNotation: true }, draw);
    derivePassage(source.measures);
    assert.equal(source.measures[0]!.notes[0]!.kind, 'note');
    const events = source.measures.flatMap(m => m.notes);
    const total = events.reduce((sum, e) => add(sum, duration(e)), fraction(0));
    const rests = events.filter(e => e.kind === 'rest').reduce((sum, e) => add(sum, duration(e)), fraction(0));
    assert.ok(compare(rests, multiply(total, fraction(15, 100))) <= 0);
  }
  assert.ok(generationIssue({ ...defaultGeneration(), ingredients: ['quarter-rest'] }));
});

test('each independently selected grouping emits only its complete written permutation', () => {
  for (const pattern of sixteenthPatterns) for (const meter of ['2/4', '3/4', '4/4'] as const) {
    const settings = { ...defaultGeneration(), meters: [meter], ingredients: [], sixteenthPatterns: [pattern.id], measures: 2 };
    const source = generateExercise(settings, () => .999);
    for (const bar of source.measures) {
      const shape = (e: { type: string; dots?: number }) => [e.type, e.dots ?? 0];
      assert.deepEqual(bar.notes.map(shape), Array.from({ length: Number(meter[0]) }, () => pattern.events.map(shape)).flat());
    }
    const restored = readPreferences(JSON.stringify({ version: 1, generation: settings })).generation;
    assert.deepEqual(restored.sixteenthPatterns, [pattern.id]);
  }
  assert.ok(generationIssue({ ...defaultGeneration(), ingredients: [], sixteenthPatterns: [] }));
});

test('saved old Uno identities shift once, preserving configuration and customization', () => {
  for (let old = 1; old <= 4; old++) for (const customized of [false, true]) {
    const applied = applyTeachingPreset(defaultGeneration(), unoPresets[old]!);
    assert.ok(applied.supported); if (!applied.supported) continue;
    const generation = { ...applied.settings, teachingPreset: { id: `uno-${old}`, version: 1, customized } };
    const migrated = readPreferences(JSON.stringify({ version: 1, generation }));
    assert.deepEqual(migrated.generation.teachingPreset, { id: `uno-${old + 1}`, version: 2, customized });
    assert.deepEqual(migrated.generation.ingredients, generation.ingredients);
    assert.deepEqual(readPreferences(JSON.stringify(migrated)).generation, migrated.generation);
  }
});

test('every generated Uno and UIL exercise has at least four sounding attacks after ties', async () => {
  const { teachingPresets } = await import('../src/apps/rhythm-walk/shared/teaching-presets.ts');
  for (const preset of [...unoPresets, ...teachingPresets]) for (const meter of preset.recommended.meters!) for (const measures of [1, 2, 3, 4]) for (const draw of [0, .4, .999999]) {
    const source = generateExercise({ ...preset.recommended, meters: [meter], measures }, () => draw);
    assert.ok(derivePassage(source.measures).attacks.length >= 4, `${preset.id}, ${meter}, ${measures}, ${draw}`);
  }
  for (const measures of [1, 2, 3]) assert.match(generationIssue({ ...defaultGeneration(), ingredients: ['whole'], measures })!, /four attacks/);
  const whole = generateExercise({ ...defaultGeneration(), ingredients: ['whole'], measures: 4, ties: true }, () => .4);
  assert.equal(derivePassage(whole.measures).attacks.length, 4, 'ties cannot consume the required calibration attacks');
  const oneBar = generateExercise({ ...unoPresets[0]!.recommended, measures: 1 }, () => .999);
  assert.deepEqual(oneBar.measures[0]!.notes.map(n => [n.type, n.kind]), Array.from({ length: 4 }, () => ['quarter', 'note']));
});
