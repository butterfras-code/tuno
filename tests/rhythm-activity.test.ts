import test from 'node:test';
import assert from 'node:assert/strict';
import { Activity, defaultPreferences, modes, presets, readPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { defaultGeneration, generateExercise, generationIssue, ingredients } from '../src/apps/rhythm-walk/shared/generation.ts';
import { meters } from '../src/apps/rhythm-walk/shared/meter.ts';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';
import { blankAnswer, evaluatePassage } from '../src/apps/count-writing/evaluation.ts';
import { passageGrid } from '../src/apps/count-writing/passage.ts';
import type { RhythmMeasure } from '../src/music/measure.ts';
import type { CountSymbol } from '../src/apps/count-writing/evaluation.ts';

function exerciseWorks(measures: readonly RhythmMeasure[]) {
  const grid = passageGrid(measures);
  const answers = measures.map(blankAnswer);
  grid.slots.forEach(slot => { if (slot.attack || slot.onCount || slot.dottedInternal) answers[slot.measure]!.symbols[slot.index] = slot.symbol as CountSymbol; });
  grid.grids.forEach((bar, measure) => bar.events.filter(e => e.kind === 'rest').forEach(e => {
    const counts = answers[measure]!.symbols;
    answers[measure]!.rests.push({ start: e.startSlot, end: counts.flatMap((symbol, i) => symbol && i >= e.startSlot && i < e.endSlot ? [i] : []).at(-1)! });
  }));
  const lines = grid.sustained.map(sound => ({ start: sound.start, end: sound.end }));
  const counts = evaluatePassage(measures, answers, 'required', lines);
  assert.ok(counts.every(result => Object.values(result).every(d => d.verdict === 'correct')), JSON.stringify(counts));
  const capture = new Capture({ id: 'shared', label: 'Shared', description: '', measures }, 80, true);
  capture.plan.notes.forEach(note => {
    capture.input('down', 'keyboard', note.start, note.start * 1000);
    capture.input('up', 'keyboard', note.end, note.end * 1000);
  });
  const result = evaluateAttempt(capture.advance(capture.plan.captureEnd)!);
  assert.equal(result.matches.length, capture.plan.notes.length);
  assert.deepEqual(result.missing, []); assert.deepEqual(result.extra, []); assert.deepEqual(result.restOverlaps, []);
  assert.ok(result.matches.every(match => match.onsetOffset === 0 && match.releaseOffset === 0));
  return capture;
}

test('mode switching retains the canonical exercise object, identity and pending configuration', () => {
  const preferences = defaultPreferences();
  const activity = new Activity(preferences, presets[0]!.measures);
  const exercise = activity.exercise;
  preferences.generation.measures = 4;
  for (const mode of [...modes, ...modes].reverse()) { activity.setMode(mode); assert.strictEqual(activity.exercise, exercise); assert.equal(activity.preferences.generation.measures, 4); }
  const next = activity.next(() => .4);
  assert.notEqual(next.id, exercise.id); assert.equal(next.measures.length, 4); assert.equal(preferences.preset, 'generated');
  preferences.generation.ingredients = [];
  assert.throws(() => activity.next()); assert.strictEqual(activity.exercise, next);
});

for (const preset of presets) test(`shared preset works in both evaluators: ${preset.id}`, () => { exerciseWorks(preset.measures); });

test('generated meters, lengths, ingredient pools and pattern options serve both evaluators', () => {
  let seed = 12;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const meter of meters) for (const measures of [1, 2, 3, 4]) for (const allowUnintuitiveNotation of [false, true]) for (const ties of [false, true]) for (const syncopation of [false, true]) {
    for (const pool of [ingredients.map(i => i.id), ['quarter', 'eighth'] as const, ['eighth-rest'] as const]) {
      const generation = { ...defaultGeneration(), meter, measures, allowUnintuitiveNotation, ties, syncopation, ingredients: [...pool] };
      if (!generationIssue(generation)) exerciseWorks(generateExercise(generation, random));
    }
  }
});

test('6/8 capture uses two dotted-quarter pulses and six independent written counts', () => {
  const capture = exerciseWorks(presets.find(p => p.id === 'six-eighths')!.measures);
  assert.equal(capture.plan.countIn, 1.5); assert.equal(capture.plan.duration, 1.5);
  assert.deepEqual(capture.plan.pulses.filter(p => !p.countIn).map(p => p.time), [0, .75]);
  assert.deepEqual(capture.plan.notes.map(n => n.start), [0, .25, .5, .75, 1, 1.25]);
});

test('saved shared and mode preferences validate independently and preserve editable invalid pools', () => {
  const prefs = defaultPreferences(); Object.assign(prefs, { mode: 'both', preset: 'six-bar-tie', offbeat: '+', bpm: 123, showCounts: true });
  prefs.generation = { ...defaultGeneration(), meter: '6/8', measures: 4, ingredients: ['eighth'], ties: true };
  assert.deepEqual(readPreferences(JSON.stringify(prefs)), prefs);
  assert.deepEqual(readPreferences('{bad'), defaultPreferences());
  const restored = readPreferences(JSON.stringify({ ...prefs, bpm: Infinity, generation: { ...prefs.generation, ingredients: [] } }));
  assert.equal(restored.bpm, 80); assert.equal(restored.mode, 'both'); assert.deepEqual(restored.generation.ingredients, []);
  assert.deepEqual(readPreferences(JSON.stringify({ ...prefs, generation: { ...prefs.generation, ingredients: ['unsupported'] } })).generation, defaultGeneration());
});

test('explicit cancellation cannot complete an active attempt or replace its raw evidence', () => {
  const capture = new Capture({ id: 'shared', label: 'Shared', description: '', measures: presets[0]!.measures }, 80, true);
  capture.input('down', 'keyboard', .1, 100);
  const record = capture.interrupt('Mode changed', capture.plan.captureEnd + 1);
  assert.equal(record.status, 'interrupted'); assert.equal(record.events.length, 1);
  assert.equal(evaluateAttempt(record).status, 'interrupted');
  assert.deepEqual(capture.advance(100), record);
});
