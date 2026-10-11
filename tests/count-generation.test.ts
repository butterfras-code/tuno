import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultGeneration, generateExercise, generationIssue, ingredients } from '../src/apps/count-writing/generation.ts';
import { deriveMeasure, derivePassage } from '../src/music/measure.ts';
import { blankAnswer, evaluatePassage } from '../src/apps/count-writing/evaluation.ts';
import type { CountAnswer } from '../src/apps/count-writing/evaluation.ts';
import type { RhythmMeasure } from '../src/music/measure.ts';
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
          assert.ok(bar.events.length <= 8);
          bar.events.forEach(event => assert.ok(allowed.some(i => JSON.stringify(event) === JSON.stringify(i.event)), JSON.stringify(event)));
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
  assert.ok(generateExercise(subset, () => 0).every(bar => bar.events.every(event => event[0] === 'H')));
  for (const id of ['quarter', 'eighth-rest', 'half-rest'] as const) {
    const settings = { ...defaultGeneration(), measures: 4, ingredients: [id] }; const before = structuredClone(settings);
    assert.equal(generateExercise(settings, () => 0).length, 4);
    assert.deepEqual(settings, before);
  }
  assert.throws(() => generateExercise({ ...defaultGeneration(), measures: 0 }), /1 to 4/);
  assert.throws(() => generateExercise(defaultGeneration(), () => 1), /Random/);
});

const measures: RhythmMeasure[] = [
  { meter: [4, 4], events: [['Q', { dots: 1, rest: true }], ['E', { rest: true }], ['H']] },
  { meter: [4, 4], events: [['H', { rest: true }], ['Q', { rest: true }], ['Q', { rest: true }]] },
  { meter: [4, 4], events: [['E'], ['Q', { dots: 1 }], ['H']] },
  { meter: [4, 4], events: [['E', { rest: true }], ['E', { rest: true }], ['Q'], ['H']] },
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
  const source: RhythmMeasure = { meter: [4, 4], events: [['E', { rest: true }], ['Q', { dots: 1, rest: true }], ['H']] };
  const answer: CountAnswer = { symbols: ['1', '&', '2', '&', '3', '', '4', ''], spans: [{ start: 1, end: 3 }, { start: 4, end: 7 }], rests: [{ start: 0, end: 0 }, { start: 1, end: 3 }] };
  assert.ok(Object.values(evaluatePassage([source], [answer], 'required')[0]!).every(d => d.verdict === 'correct'));
  answer.symbols[3] = ''; answer.rests[1]!.end = 2;
  const required = evaluatePassage([source], [answer], 'required')[0]!;
  assert.equal(required.counts.verdict, 'revise'); assert.equal(required.rests.verdict, 'revise');
  assert.ok(Object.values(evaluatePassage([source], [answer], 'optional')[0]!).every(d => d.verdict === 'correct'));
});

test('beginner rest placement forbids offbeat starts at beat length or longer, but permits half rests on any whole beat', () => {
  assert.equal(readableRestPlacement(['H', { rest: true }], fraction(1, 8)), false);
  assert.equal(readableRestPlacement(['Q', { rest: true }], fraction(1, 8)), false);
  assert.equal(readableRestPlacement(['E', { rest: true }], fraction(1, 8)), true);
  for (const beat of [0, 1, 2]) assert.equal(readableRestPlacement(['H', { rest: true }], fraction(beat, 4)), true);
  assert.equal(readableRestPlacement(['Q', { dots: 1, rest: true }], fraction(0)), false);
  assert.equal(readableRestPlacement(['H'], fraction(1, 8)), true, 'note syncopation remains available');
  const draws = [0, .99, 0];
  const passage = generateExercise({ ...defaultGeneration(), measures: 1, ingredients: ['quarter', 'half-rest'] }, () => draws.shift()!);
  assert.deepEqual(passage[0]!.events, [['Q'], ['H', { rest: true }], ['Q']], 'a half rest starting on beat 2 is allowed');
});
test('the screenshot silence can be written as eighth, quarter, eighth rests; opt-in still generates less usual spellings', () => {
  const draws = [0, .99, .5, .99, .99, 0, 0];
  const passage = generateExercise({ ...defaultGeneration(), measures: 1, ingredients: ['eighth', 'quarter-rest', 'eighth-rest'] }, () => draws.shift()!);
  assert.deepEqual(passage[0]!.events, [['E'], ['E', { rest: true }], ['Q', { rest: true }], ['E', { rest: true }], ['E', { rest: true }], ['E'], ['E']]);
  const readableAnswer: CountAnswer = { symbols: ['1', '&', '2', '', '3', '&', '4', '&'], spans: [], rests: [{ start: 1, end: 1 }, { start: 2, end: 2 }, { start: 4, end: 4 }, { start: 5, end: 5 }] };
  assert.ok(Object.values(evaluatePassage(passage, [readableAnswer], 'required')[0]!).every(d => d.verdict === 'correct'), 'grading follows the separate written rests');
  readableAnswer.rests = [{ start: 1, end: 4 }, { start: 5, end: 5 }];
  assert.equal(evaluatePassage(passage, [readableAnswer], 'required')[0]!.rests.verdict, 'revise');
  const advanced = { ...defaultGeneration(), allowUnintuitiveNotation: true, ingredients: ingredients.map(i => i.id) };
  let offbeatHalf = false, dottedRest = false;
  for (let seed = 0; seed < 100; seed++) generateExercise(advanced, seeded(seed)).forEach(bar => {
    deriveMeasure(bar).events.forEach(event => {
      if (event.written[0] === 'H' && event.kind === 'rest' && !readableRestPlacement(event.written, event.start)) offbeatHalf = true;
      if (event.kind === 'rest' && event.written[1]?.dots) dottedRest = true;
    });
  });
  assert.equal(offbeatHalf, true); assert.equal(dottedRest, true);
  assert.equal(generationIssue({ ...advanced, allowUnintuitiveNotation: false }), null);
  for (let seed = 0; seed < 30; seed++) assert.ok(generateExercise({ ...advanced, allowUnintuitiveNotation: false }, seeded(seed)).every(bar => bar.events.every(event => !(event[1]?.rest && event[1]?.dots))));
});
