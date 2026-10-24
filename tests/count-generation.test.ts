import { notationOnly } from './score-test-support.ts';
import { note } from './score-test-support.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultGeneration, generateExercise as generateScore, generationIssue, ingredients } from '../src/apps/count-writing/generation.ts';
import { deriveMeasure, derivePassage } from './score-test-support.ts';
import { blankAnswer, evaluatePassage } from './legacy/count-evaluation.ts';
import type { CountAnswer } from './legacy/count-evaluation.ts';
import type { RhythmMeasure } from './score-test-support.ts';
import { readableRestPlacement } from '../src/apps/count-writing/notation-policy.ts';
import { fraction } from '../src/music/fraction.ts';

function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}
test('defaults are two measures; deterministic generation validates every subset at every supported length', () => {
  assert.equal(defaultGeneration().measures, 2);
  assert.equal(defaultGeneration().allowUnintuitiveNotation, false);
  assert.ok(!defaultGeneration().ingredients.includes('dotted-quarter-rest'));
  for (const allowUnintuitiveNotation of [false, true]) for (let mask = 0; mask < 256; mask++) {
    const allowed = ingredients.filter((_, i) => mask & (1 << i));
    for (let measures = 1; measures <= 4; measures++) {
      const settings = { measures, ingredients: allowed.map(i => i.id), allowUnintuitiveNotation };
      if (generationIssue(settings)) {
        assert.throws(() => generateExercise(settings, seeded(mask)), /ingredient|fill|fit|Select|notation/);
        continue;
      }
      for (const seed of [1, 53, 879]) {
        const passage = generateExercise(settings, seeded(seed));
        assert.deepEqual(passage, generateExercise(settings, seeded(seed)));
        assert.equal(passage.length, measures);
        const derived = derivePassage(passage);
        derived.measures.forEach(bar => assert.deepEqual(bar.length, [1, 1]));
        passage.forEach(bar => {
          assert.deepEqual(bar.meter, [4, 4]);
          assert.ok(bar.notes.length <= 8);
          bar.notes.forEach(event => assert.ok(allowed.some(i => JSON.stringify(notationOnly(event)) === JSON.stringify(notationOnly(i.event))), JSON.stringify(event)));
          if (!allowUnintuitiveNotation) deriveMeasure(bar).events.forEach(event => assert.ok(readableRestPlacement(event.written, event.start)));
        });
      }
    }
  }
});
test('impossible selections fail; unavailable ingredients are skipped without mutating settings', () => {
  for (const settings of [
    { ...defaultGeneration(), measures: 2, ingredients: [] },
    { ...defaultGeneration(), measures: 2, ingredients: ['dotted-quarter' as const] },
  ]) assert.ok(generationIssue(settings));
  const subset = { ...defaultGeneration(), ingredients: ['dotted-quarter' as const, 'half' as const] };
  assert.equal(generationIssue(subset), null);
  assert.ok(generateExercise(subset, () => 0).every(bar => bar.notes.every(event => event.type === 'half')));
  for (const id of ['quarter', 'eighth-rest', 'half-rest'] as const) {
    const settings = { ...defaultGeneration(), measures: 4, ingredients: [id] }; const before = structuredClone(settings);
    if (id === 'quarter') assert.equal(generateExercise(settings, () => 0).length, 4);
    else assert.throws(() => generateExercise(settings, () => 0), /15% rests/);
    assert.deepEqual(settings, before);
  }
  assert.throws(() => generateExercise({ ...defaultGeneration(), measures: 0 }), /1 to 4/);
  assert.throws(() => generateExercise(defaultGeneration(), () => 1), /Random/);
});

const measures: readonly RhythmMeasure[] = [
  { meter: [4, 4], notes: [note('quarter', { dots: 1, kind: 'rest' }), note('eighth', { kind: 'rest' }), note('half')] },
  { meter: [4, 4], notes: [note('half', { kind: 'rest' }), note('quarter', { kind: 'rest' }), note('quarter', { kind: 'rest' })] },
  { meter: [4, 4], notes: [note('eighth'), note('quarter', { dots: 1 }), note('half')] },
  { meter: [4, 4], notes: [note('eighth', { kind: 'rest' }), note('eighth', { kind: 'rest' }), note('quarter'), note('half')] },
];
const answers: CountAnswer[] = [
  { symbols: ['1', '&', '2', '&', '3', '', '4', ''], spans: [{ start: 0, end: 2 }, { start: 4, end: 7 }], rests: [{ start: 0, end: 2 }, { start: 3, end: 3 }] },
  { symbols: ['1', '', '2', '', '3', '', '4', ''], spans: [{ start: 0, end: 3 }], rests: [{ start: 0, end: 2 }, { start: 4, end: 4 }, { start: 6, end: 6 }] },
  { symbols: ['1', '&', '2', '&', '3', '', '4', ''], spans: [{ start: 1, end: 3 }, { start: 4, end: 7 }], rests: [] },
  { symbols: ['1', '&', '2', '', '3', '', '4', ''], spans: [{ start: 4, end: 7 }], rests: [{ start: 0, end: 0 }, { start: 1, end: 1 }] },
];
test('derived grading handles 1–4 bars, shifted dots, dotted/eighth/adjacent/sustained rests and resets beats', () => {
  for (let length = 1; length <= 4; length++) {
    const before = structuredClone(answers);
    const result = evaluatePassage(measures.slice(0, length), answers.slice(0, length), 'required');
    result.forEach(bar => assert.deepEqual(Object.values(bar).map(d => d.verdict), ['correct', 'correct', 'correct']));
    assert.deepEqual(answers, before);
  }
  const optional = structuredClone(answers); optional[0]!.symbols[1] = '';
  assert.equal(evaluatePassage(measures, optional, 'required')[0]!.counts.verdict, 'revise');
  assert.equal(evaluatePassage(measures, optional, 'optional')[0]!.counts.verdict, 'correct');
  assert.equal(evaluatePassage(measures, optional, 'review')[0]!.counts.verdict, 'provisional');
});
test('measure boundaries reject spans/rests outside the bar and locate each issue without contaminating neighbors', () => {
  const changed = structuredClone(answers);
  changed[1]!.symbols[0] = '4'; changed[1]!.spans[0]!.end = 8; changed[1]!.rests[0]!.end = 8;
  const result = evaluatePassage(measures, changed, 'required');
  assert.deepEqual(Object.values(result[1]!).map(d => d.verdict), ['revise', 'revise', 'revise']);
  Object.values(result[1]!).forEach(d => assert.ok(d.issues.every((issue: string) => issue.startsWith('Measure 2:'))));
  [0, 2, 3].forEach(index => assert.ok(Object.values(result[index]!).every(d => d.verdict === 'correct')));
  assert.throws(() => evaluatePassage(measures, [blankAnswer(measures[0]!)]), /one answer per measure/);
  changed[3]!.rests = [{ start: 0, end: 1 }];
  assert.equal(evaluatePassage(measures, changed, 'required')[3]!.rests.verdict, 'revise');
});

test('offbeat dotted rests apply the internal offbeat convention and enclose its required or entered count', () => {
  const source: RhythmMeasure = { meter: [4, 4], notes: [note('eighth', { kind: 'rest' }), note('quarter', { dots: 1, kind: 'rest' }), note('half')] };
  const answer: CountAnswer = { symbols: ['1', '&', '2', '&', '3', '', '4', ''], spans: [{ start: 1, end: 3 }, { start: 4, end: 7 }], rests: [{ start: 0, end: 0 }, { start: 1, end: 3 }] };
  assert.ok(Object.values(evaluatePassage([source], [answer], 'required')[0]!).every(d => d.verdict === 'correct'));
  answer.symbols[3] = ''; answer.rests[1]!.end = 2;
  const required = evaluatePassage([source], [answer], 'required')[0]!;
  assert.equal(required.counts.verdict, 'revise'); assert.equal(required.rests.verdict, 'revise');
  assert.ok(Object.values(evaluatePassage([source], [answer], 'optional')[0]!).every(d => d.verdict === 'correct'));
});

test('beginner rest placement forbids offbeat starts at beat length or longer, but permits half rests on any whole beat', () => {
  assert.equal(readableRestPlacement(note('half', { kind: 'rest' }), fraction(1, 8)), false);
  assert.equal(readableRestPlacement(note('quarter', { kind: 'rest' }), fraction(1, 8)), false);
  assert.equal(readableRestPlacement(note('eighth', { kind: 'rest' }), fraction(1, 8)), true);
  for (const beat of [0, 1, 2]) assert.equal(readableRestPlacement(note('half', { kind: 'rest' }), fraction(beat, 4)), true);
  assert.equal(readableRestPlacement(note('quarter', { dots: 1, kind: 'rest' }), fraction(0)), false);
  assert.equal(readableRestPlacement(note('half'), fraction(1, 8)), true, 'note syncopation remains available');
  const passage = generateExercise({ ...defaultGeneration(), measures: 1, ingredients: ['quarter', 'half-rest'] }, () => .99);
  assert.ok(passage[0]!.notes.every(e => e.kind === 'note'), 'a half rest exceeds the duration budget of one bar');
});
test('the screenshot silence can be written as eighth, quarter, eighth rests; opt-in still generates less usual spellings', () => {
  // Dense authored examples remain valid for grading, but no longer for generation.
  const passage = [{ meter: [4, 4] as const, notes: [note('eighth'), note('eighth', { kind: 'rest' }), note('quarter', { kind: 'rest' }), note('eighth', { kind: 'rest' }), note('eighth', { kind: 'rest' }), note('eighth'), note('eighth')] }];
  const readableAnswer: CountAnswer = { symbols: ['1', '&', '2', '', '3', '&', '4', '&'], spans: [], rests: [{ start: 1, end: 1 }, { start: 2, end: 2 }, { start: 4, end: 4 }, { start: 5, end: 5 }] };
  assert.ok(Object.values(evaluatePassage(passage, [readableAnswer], 'required')[0]!).every(d => d.verdict === 'correct'), 'grading follows the separate written rests');
  readableAnswer.rests = [{ start: 1, end: 4 }, { start: 5, end: 5 }];
  assert.equal(evaluatePassage(passage, [readableAnswer], 'required')[0]!.rests.verdict, 'revise');
  const advanced = { ...defaultGeneration(), measures: 4, allowUnintuitiveNotation: true, ingredients: ingredients.map(i => i.id) };
  let offbeatHalf = false, dottedRest = false;
  for (let seed = 0; seed < 100; seed++) generateExercise(advanced, seeded(seed)).forEach(bar => {
    deriveMeasure(bar).events.forEach(event => {
      if (event.written.type === 'half' && event.kind === 'rest' && !readableRestPlacement(event.written, event.start)) offbeatHalf = true;
      if (event.kind === 'rest' && event.written.dots) dottedRest = true;
    });
  });
  assert.equal(offbeatHalf, true); assert.equal(dottedRest, true);
  assert.equal(generationIssue({ ...advanced, allowUnintuitiveNotation: false }), null);
  for (let seed = 0; seed < 30; seed++) assert.ok(generateExercise({ ...advanced, allowUnintuitiveNotation: false }, seeded(seed)).every(bar => bar.notes.every(event => !((event.kind === 'rest') && event.dots))));
});

const generateExercise = (...args: Parameters<typeof generateScore>) => generateScore(...args).measures;
