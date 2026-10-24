import { score } from './score-test-support.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { unoPresets, teachingPresets, generationLevels, resolveTeachingPreset, applyTeachingPreset, customizeTeachingPreset, teachingPresetLabel } from '../src/apps/rhythm-walk/shared/teaching-presets.ts';
import { defaultPreferences, readPreferences, Activity } from '../src/apps/rhythm-walk/activity.ts';
import { generateExercise as generateScore, ingredients } from '../src/apps/rhythm-walk/shared/generation.ts';
import { generationCapabilities } from '../src/apps/rhythm-walk/shared/capabilities.ts';
import type { RhythmEvent } from './score-test-support.ts';
import { derivePassage } from './score-test-support.ts';
import { countGrid } from '../src/apps/count-writing/grid.ts';

const base = ['whole', 'half', 'quarter', 'eighth', 'quarter-rest', 'half-rest'];
const second = [...base, 'dotted-half', 'dotted-quarter'];
const third = [...second, 'sixteenth', 'eighth-rest', 'triplet-eighth', 'dotted-eighth'];
const all = [...third, 'dotted-quarter-rest', 'sixteenth-rest', 'whole-rest'];
const expected = [
  { meters: ['4/4'], ingredients: ['quarter', 'quarter-rest', 'half'], ties: false, syncopation: false, notation: false },
  { meters: ['4/4'], ingredients: base, ties: false, syncopation: false, notation: false },
  { meters: ['4/4', '2/4', '3/4'], ingredients: second, ties: true, syncopation: false, notation: false },
  { meters: ['4/4', '2/4', '3/4', '6/8'], ingredients: third, ties: true, syncopation: true, notation: false },
  { meters: ['4/4', '2/4', '3/4', '6/8'], ingredients: all, ties: true, syncopation: true, notation: true },
];

test('Uno levels match the requested cumulative configurations without changing UIL scope', () => {
  assert.deepEqual(generationLevels.map(p => p.id), ['uno-1', 'uno-2', 'uno-3', 'uno-4', 'uno-5', 'uil-1', 'uil-2', 'uil-3', 'uil-4']);
  for (const [index, definition] of unoPresets.entries()) {
    const wanted = expected[index]!;
    assert.equal(definition.label, `Uno${index + 1}`); assert.equal(definition.source, null);
    assert.equal(resolveTeachingPreset(definition).supported, true);
    assert.deepEqual(definition.recommended.meters, wanted.meters);
    assert.deepEqual([...definition.recommended.ingredients].sort(), [...wanted.ingredients].sort());
    assert.equal(definition.recommended.ties, wanted.ties); assert.equal(definition.recommended.syncopation, wanted.syncopation);
    assert.equal(definition.recommended.allowUnintuitiveNotation, wanted.notation);
    assert.equal(definition.recommended.restrictions, undefined);
  }
  for (const definition of teachingPresets.slice(2)) assert.equal(resolveTeachingPreset(definition).supported, true);
  const capabilities = generationCapabilities();
  assert.equal(resolveTeachingPreset(unoPresets[3]!, { ...capabilities, ingredients: capabilities.ingredients.filter(id => id !== 'sixteenth') }).supported, false);
});

test('Uno application, customization and reload preserve independent preferences and source identity', () => {
  for (const definition of unoPresets) for (const length of [1, 2, 3, 4]) {
    const preferences = defaultPreferences();
    Object.assign(preferences, { mode: 'both', bpm: 123, countingSystem: 'syllables', playStyle: 'hold' });
    preferences.generation.measures = length;
    const before = structuredClone(preferences);
    const activity = new Activity(preferences, score(generateExercise(preferences.generation, () => .4)));
    const exercise = activity.exercise;
    const result = applyTeachingPreset(preferences.generation, definition);
    assert.equal(result.supported, true); if (!result.supported) continue;
    preferences.generation = result.settings;
    assert.equal(result.settings.measures, length);
    assert.deepEqual({ ...preferences, generation: before.generation }, before);
    for (const mode of ['tap', 'write', 'both'] as const) { activity.setMode(mode); assert.strictEqual(activity.exercise, exercise); }
    assert.deepEqual(readPreferences(JSON.stringify(preferences)).generation, result.settings);
    assert.equal(teachingPresetLabel(result.settings.teachingPreset), definition.label);
    const custom = customizeTeachingPreset({ ...result.settings, syncopation: !result.settings.syncopation });
    assert.equal(custom.teachingPreset?.id, definition.id);
    assert.equal(teachingPresetLabel(custom.teachingPreset), `${definition.label} · customized`);
    preferences.generation = custom;
    assert.deepEqual(readPreferences(JSON.stringify(preferences)).generation, custom);
    assert.equal(activity.next(() => .4).score.measures.length, length);
  }
});

test('Uno generation stays within selected written vocabulary and supported meter subsets', () => {
  let seed = 234;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const definition of unoPresets) for (const meter of definition.recommended.meters!) for (const measures of [1, 2, 3, 4]) for (let sample = 0; sample < 8; sample++) {
    const settings = { ...definition.recommended, meters: [meter], measures };
    const passage = generateExercise(settings, random);
    derivePassage(passage);
    for (const bar of passage) {
      countGrid(bar);
      assert.equal(bar.meter.join('/'), meter);
      for (const event of bar.notes) {
        assert.ok(ingredients.some(i => {
          const allowed: RhythmEvent = i.event;
          return settings.ingredients.includes(i.id) && allowed.type === event.type && Boolean((allowed.kind === 'rest')) === Boolean((event.kind === 'rest')) && (allowed.dots ?? 0) === (event.dots ?? 0) && JSON.stringify(allowed.timeModification) === JSON.stringify(event.timeModification);
        }));
        if (!settings.ties) assert.equal(event.tieNext, false);
        if (meter === '6/8') assert.ok(!['whole', 'half', '16th'].includes(event.type) && !event.timeModification);
      }
    }
  }
});

const generateExercise = (...args: Parameters<typeof generateScore>) => generateScore(...args).measures;
