import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, compare, divide, fraction, multiply } from '../src/music/fraction.ts';
import { beatCoordinate, deriveMeasure, derivePassage, duration } from '../src/music/measure.ts';
import type { RhythmEvent, RhythmMeasure } from '../src/music/measure.ts';
import { countGrid } from '../src/apps/count-writing/grid.ts';
import { blankAnswer, evaluate } from '../src/apps/count-writing/evaluation.ts';

const bar = (events: readonly RhythmEvent[]): RhythmMeasure => ({ meter: [4, 4], events });
test('exact arithmetic normalizes thirds and rejects unsafe quantities', () => {
  assert.deepEqual(add(fraction(1, 3), fraction(2, 3)), [1, 1]);
  assert.deepEqual(fraction(4, -8), [-1, 2]);
  assert.equal(compare(fraction(2, 6), fraction(1, 3)), 0);
  assert.throws(() => fraction(1, 0));
  assert.throws(() => fraction(.5));
  assert.throws(() => divide(fraction(1), fraction(0)));
  assert.throws(() => multiply(fraction(Number.MAX_SAFE_INTEGER), fraction(2)));
});
test('compact written values derive exact durations without stored onsets', () => {
  const values: RhythmEvent[] = [['W'], ['H'], ['Q'], ['E'], ['S'], ['E', { dots: 1 }], ['Q', { dots: 2 }]];
  assert.deepEqual(values.map(duration), [[1,1],[1,2],[1,4],[1,8],[1,16],[3,16],[7,16]]);
  const source = bar([['H'], ['Q'], ['E'], ['E']]);
  const original = JSON.stringify(source);
  const measure = deriveMeasure(source);
  assert.deepEqual(measure.events.map(e => e.start), [[0,1],[1,2],[3,4],[7,8]]);
  assert.deepEqual(measure.events.map(e => beatCoordinate(measure, e.start)), [[0,1],[24,1],[36,1],[42,1]]);
  assert.equal(JSON.stringify(source), original);
});
test('dotted eighths, sixteenths and double dots fill exact measures', () => {
  const measure = deriveMeasure(bar([['E', { dots: 1 }], ['S'], ['Q', { dots: 2 }], ['S'], ['Q']]));
  assert.deepEqual(measure.events.map(e => beatCoordinate(measure, e.start)), [[0,1],[9,1],[12,1],[33,1],[36,1]]);
  assert.deepEqual(deriveMeasure(bar(Array.from({ length: 16 }, () => ['S'] as const))).length, [1,1]);
});
test('triplet groups preserve written spelling and exact coordinates', () => {
  const triplet: RhythmEvent = ['E', { tuplet: [3,2] }];
  const measure = deriveMeasure(bar([triplet, triplet, triplet, ['H', { dots: 1 }]]));
  assert.deepEqual(measure.events.map(e => beatCoordinate(measure, e.start)), [[0,1],[4,1],[8,1],[12,1]]);
  assert.deepEqual(measure.events.map(e => e.tupletGroup), [0,0,0,null]);
  const adjacent = deriveMeasure({ meter: [2,4], events: Array(6).fill(triplet) });
  assert.deepEqual(adjacent.events.map(e => e.tupletGroup), [0,0,0,3,3,3]);
  assert.throws(() => deriveMeasure(bar([triplet, triplet, ['H']])));
  assert.throws(() => deriveMeasure(bar([triplet, ['Q', { tuplet: [3,2] }], triplet])));
});
test('meter and explicit grouping scale beat coordinates without changing written duration', () => {
  const events: RhythmEvent[] = Array.from({ length: 6 }, () => ['E']);
  const simple = deriveMeasure({ meter: [3,4], events });
  const compound = deriveMeasure({ meter: [6,8], events });
  const sixCounts = deriveMeasure({ meter: [6,8], groups: [1,1,1,1,1,1], events });
  assert.deepEqual(simple.length, compound.length);
  assert.deepEqual(simple.events.map(e => beatCoordinate(simple, e.start)), [[0,1],[6,1],[12,1],[18,1],[24,1],[30,1]]);
  assert.deepEqual(compound.events.map(e => beatCoordinate(compound, e.start)), [[0,1],[4,1],[8,1],[12,1],[16,1],[20,1]]);
  assert.deepEqual(beatCoordinate(sixCounts, sixCounts.events[1]!.start), [12,1]);
  const irregular = deriveMeasure({ meter: [7,8], groups: [2,2,3], events: [['Q'],['Q'],['Q',{ dots: 1 }]] });
  assert.deepEqual(irregular.events.map(e => beatCoordinate(irregular, e.start)), [[0,1],[12,1],[24,1]]);
  assert.deepEqual(beatCoordinate(irregular, irregular.length), [36,1]);
  assert.throws(() => deriveMeasure({ meter: [7,8], events: [['H', { dots: 2 }]] }));
  assert.throws(() => deriveMeasure({ meter: [7,8], groups: [3,3], events: [['H', { dots: 2 }]] }));
  assert.throws(() => beatCoordinate(simple, fraction(-1)));
});
test('compound duplets fit twelve-grid coordinates; other supported combinations retain fractions', () => {
  const duplet: RhythmEvent = ['E', { tuplet: [2,3] }];
  const compound = deriveMeasure({ meter: [6,8], events: [duplet, duplet, ['Q', { dots: 1 }]] });
  assert.deepEqual(compound.events.map(e => beatCoordinate(compound, e.start)), [[0,1],[6,1],[12,1]]);
  const triplet: RhythmEvent = ['E', { tuplet: [3,2] }];
  const mixed = deriveMeasure({ meter: [6,8], events: [triplet, triplet, triplet, ['H']] });
  assert.deepEqual(beatCoordinate(mixed, mixed.events[1]!.start), [8,3]);
});
test('ties preserve notation and combine attacks across a meter change', () => {
  const source: RhythmMeasure[] = [
    { meter: [3,4], events: [['H'], ['Q', { tieNext: true }]] },
    { meter: [6,8], events: [['E', { tieNext: true }], ['Q'], ['Q', { dots: 1, rest: true }]] },
  ];
  const passage = derivePassage(source);
  assert.deepEqual(passage.length, [3,2]);
  assert.deepEqual(passage.attacks.map(a => [a.start, a.duration]), [[[0,1],[1,2]], [[1,2],[5,8]]]);
  assert.deepEqual(passage.attacks[1]!.sources, [{ measure:0,event:1 },{ measure:1,event:0 },{ measure:1,event:1 }]);
  assert.equal(passage.measures[1]!.events.length, 3);
  assert.throws(() => derivePassage([bar([['W', { tieNext: true }]])]));
  assert.throws(() => derivePassage([bar([['W', { tieNext: true }]]), bar([['W', { rest: true }]])]));
  assert.throws(() => deriveMeasure(bar([['H', { tieNext: true }], ['H', { rest: true }]])));
  assert.throws(() => duration(['Q', { rest: true, tieNext: true }]));
});
test('rests advance time but emit no attack; bars reject gaps and overflow', () => {
  const passage = derivePassage([bar([['Q',{ rest:true }], ['H'], ['Q']])]);
  assert.deepEqual(passage.attacks.map(a => a.start), [[1,4],[3,4]]);
  assert.equal(derivePassage([bar([['W',{ rest:true }]])]).attacks.length, 0);
  assert.throws(() => deriveMeasure(bar([['Q']])));
  assert.throws(() => deriveMeasure(bar([['W'],['Q']])));
  assert.throws(() => duration(['32' as 'S']));
  assert.throws(() => duration(['E', { tuplet: [5,4] as unknown as [3,2] }]));
});
test('prototype guard separates domain support from rendering and counting support', () => {
  const sixteenths = bar(Array.from({ length:16 }, () => ['S'] as const));
  assert.doesNotThrow(() => deriveMeasure(sixteenths));
  assert.throws(() => countGrid(sixteenths), /currently supports/);
  assert.throws(() => countGrid({ meter:[6,8], events:[['H',{dots:1}]] }), /currently supports/);
});
test('counting policy follows notation, not fixture IDs, including shifted dotted quarters', () => {
  const source = bar([['Q'], ['Q',{ dots:1 }], ['E'], ['Q']]);
  const grid = countGrid(source);
  assert.deepEqual(grid.slots.filter(s => s.dottedInternal).map(s => s.label), ['beat 2 offbeat']);
  const answer = blankAnswer(source);
  answer.symbols = ['1','','2','','3','&','4',''];
  answer.spans = [{start:2,end:4}];
  assert.equal(evaluate(source, answer, 'optional').counts.verdict, 'correct');
  assert.equal(evaluate(source, answer, 'required').counts.verdict, 'revise');
  answer.symbols[3] = '&';
  assert.equal(evaluate(source, answer, 'required').counts.verdict, 'correct');
});
