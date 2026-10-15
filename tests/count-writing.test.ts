import { note } from './score-test-support.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveMeasure, validateMeasure } from './score-test-support.ts';
import { countWritingFixtures } from '../src/apps/count-writing/fixtures.ts';
import { toNumber } from '../src/music/fraction.ts';
import { blankAnswer, evaluate } from './legacy/count-evaluation.ts';
import type { CountAnswer } from './legacy/count-evaluation.ts';
const solutions: CountAnswer[] = [
  { symbols: ['1', '', '2', '', '3', '', '4', '&'], spans: [{ start: 0, end: 3 }], rests: [] },
  { symbols: ['1', '', '2', '&', '3', '', '4', ''], spans: [{ start: 0, end: 2 }, { start: 4, end: 7 }], rests: [] },
  { symbols: ['1', '', '2', '', '3', '&', '4', ''], spans: [], rests: [{ start: 2, end: 2 }] },
  { symbols: ['1', '', '2', '', '3', '', '4', ''], spans: [{ start: 0, end: 5 }], rests: [] },
];
test('all four fixtures have exact onsets and fill 4/4', () => {
  const positions = [[0, 4, 6, 7], [0, 3, 4], [0, 2, 4, 5, 6], [0, 6]];
  const lengths = [[4, 2, 1, 1], [3, 1, 4], [2, 2, 1, 1, 2], [6, 2]];
  countWritingFixtures.slice(0, 4).forEach((fixture, i) => {
    validateMeasure(fixture);
    assert.deepEqual(deriveMeasure(fixture).events.map(e => toNumber(e.start) * 8), positions[i]);
    assert.deepEqual(deriveMeasure(fixture).events.map(e => toNumber(e.duration) * 8), lengths[i]);
  });
  assert.throws(() => validateMeasure({ ...countWritingFixtures[0]!, notes: [note('quarter')] }));
});
countWritingFixtures.slice(0, 4).forEach((fixture, i) => {
  test(`${fixture.id}: independent correct and incorrect dimensions; checking does not mutate`, () => {
    const answer = structuredClone(solutions[i]!);
    const before = structuredClone(answer);
    const good = evaluate(fixture, answer);
    assert.equal(good.counts.verdict, i === 1 ? 'provisional' : 'correct');
    assert.equal(good.spans.verdict, 'correct');
    assert.equal(good.rests.verdict, 'correct');
    assert.deepEqual(answer, before);
    answer.symbols[0] = '4';
    assert.equal(evaluate(fixture, answer).counts.verdict, 'revise');
    assert.equal(evaluate(fixture, answer).spans.verdict, 'correct');
    answer.symbols[0] = '1'; answer.rests.push({ start: 0, end: 0 });
    assert.equal(evaluate(fixture, answer).rests.verdict, 'revise');
    assert.equal(evaluate(fixture, answer).counts.verdict, good.counts.verdict);
    answer.rests.pop();
    answer.spans = i === 2 ? [{ start: 0, end: 2 }] : [];
    assert.equal(evaluate(fixture, answer).spans.verdict, 'revise');
    assert.equal(evaluate(fixture, answer).counts.verdict, good.counts.verdict);
    assert.equal(evaluate(fixture, answer).rests.verdict, 'correct');
  });
});
test('disputed dotted-quarter & and endpoint variants are provisional, not wrong', () => {
  const answer = structuredClone(solutions[1]!);
  answer.symbols[1] = '&';
  assert.equal(evaluate(countWritingFixtures[1]!, answer).counts.verdict, 'provisional');
  answer.spans[0] = { start: 0, end: 1 };
  assert.equal(evaluate(countWritingFixtures[1]!, answer).spans.verdict, 'provisional');
  answer.spans[0] = { start: 0, end: 3 };
  assert.equal(evaluate(countWritingFixtures[1]!, answer).spans.verdict, 'revise');
});
test('empty rest count and missing parentheses are assessed independently', () => {
  const answer = blankAnswer(countWritingFixtures[2]!);
  assert.equal(evaluate(countWritingFixtures[2]!, answer).rests.verdict, 'revise');
  answer.rests.push({ start: 2, end: 2 });
  assert.equal(evaluate(countWritingFixtures[2]!, answer).rests.verdict, 'correct');
  assert.equal(evaluate(countWritingFixtures[2]!, answer).counts.verdict, 'revise');
});
test('open alphabet has no implicit &/+ aliases and valid extra subdivisions are provisional', () => {
  const answer = structuredClone(solutions[0]!);
  answer.symbols[1] = '&';
  assert.equal(evaluate(countWritingFixtures[0]!, answer).counts.verdict, 'provisional');
  answer.symbols[1] = 'e';
  assert.equal(evaluate(countWritingFixtures[0]!, answer).counts.verdict, 'revise');
});
test('teacher-selected dotted-quarter requirement changes only symbol evaluation', () => {
  const fixture = countWritingFixtures[1]!;
  const answer = structuredClone(solutions[1]!);
  assert.equal(evaluate(fixture, answer, 'required').counts.verdict, 'revise');
  assert.equal(evaluate(fixture, answer, 'optional').counts.verdict, 'correct');
  answer.symbols[1] = '&';
  assert.equal(evaluate(fixture, answer, 'required').counts.verdict, 'correct');
  assert.equal(evaluate(fixture, answer, 'optional').counts.verdict, 'correct');
  answer.symbols[1] = 'e';
  assert.equal(evaluate(fixture, answer, 'optional').counts.verdict, 'revise');
  assert.equal(evaluate(fixture, answer, 'required').spans.verdict, 'correct');
});

test('duration lines anchor at the note onset without shrinking the onset count', () => {
  const answer = structuredClone(solutions[0]!);
  assert.equal(evaluate(countWritingFixtures[0]!, answer).spans.verdict, 'correct');
  answer.spans[0]!.start = 1;
  assert.equal(evaluate(countWritingFixtures[0]!, answer).spans.verdict, 'revise');
  assert.equal(evaluate(countWritingFixtures[0]!, answer).counts.verdict, 'correct');
  answer.spans[0] = { start: 0, end: 0 };
  assert.equal(evaluate(countWritingFixtures[0]!, answer).spans.verdict, 'provisional');
});

test('available positions keep beats/onsets and activate subdivisions locally', async () => {
  const { countGrid } = await import('../src/apps/count-writing/grid.ts');
  const expected = [[0, 2, 4, 6, 7], [0, 1, 2, 3, 4, 6], [0, 2, 4, 5, 6], [0, 2, 4, 6]];
  countWritingFixtures.slice(0, 4).forEach((fixture, i) => assert.deepEqual(countGrid(fixture).availableSlots, expected[i]));
  assert.deepEqual(countGrid({ meter: [4, 4], notes: [note('quarter'), note('quarter'), note('quarter'), note('quarter')] }).availableSlots, [0, 2, 4, 6]);
  // An offbeat quarter still has an onset; it does not subdivide unrelated beats.
  assert.deepEqual(countGrid({ meter: [4, 4], notes: [note('eighth'), note('quarter'), note('eighth'), note('quarter'), note('quarter')] }).availableSlots, [0, 1, 2, 3, 4, 6]);
});

test('position policy derives dotted, tuplet and grouped-meter subdivisions exactly', async () => {
  const { availableCountPositions } = await import('../src/apps/count-writing/positions.ts');
  const positions = (source: Parameters<typeof availableCountPositions>[0]) => availableCountPositions(source).map(toNumber);
  assert.deepEqual(positions({ meter: [4, 4], notes: [note('eighth', { dots: 1 }), note('16th'), note('quarter'), note('half')] }),
    [0, 1, 2, 3, 4, 8, 12].map(n => n / 16));
  const triplet = note('eighth', { timeModification: [3, 2] });
  assert.deepEqual(availableCountPositions({ meter: [4, 4], notes: [triplet, triplet, triplet, note('quarter'), note('half')] }).slice(0, 4),
    [[0, 1], [1, 12], [1, 6], [1, 4]]);
  assert.deepEqual(positions({ meter: [6, 8], notes: [note('quarter', { dots: 1 }), note('quarter', { dots: 1 })] }),
    Array.from({ length: 6 }, (_, n) => n / 8));
  assert.deepEqual(positions({ meter: [4, 4], notes: [note('half', { kind: 'rest' }), note('quarter'), note('quarter')] }),
    [0, 2, 4, 6].map(n => n / 8));
});


test('duration endings extend through hidden subdivisions without revealing count inputs', async () => {
  const { countGrid, durationEndSlot } = await import('../src/apps/count-writing/grid.ts');
  const grid = countGrid(countWritingFixtures[0]!);
  assert.equal(durationEndSlot(grid, 2), 3);
  assert.equal(grid.slots[3]!.available, false);
  assert.equal(durationEndSlot(grid, 4), 5);
  assert.equal(durationEndSlot(grid, 7), 7);
  assert.equal(durationEndSlot(countGrid(countWritingFixtures[1]!), 2), 2);
  const answer = structuredClone(solutions[0]!);
  assert.equal(evaluate(countWritingFixtures[0]!, answer).spans.verdict, 'correct');
  answer.spans[0]!.end = 2;
  assert.equal(evaluate(countWritingFixtures[0]!, answer).spans.verdict, 'provisional');
});


test('half rests require one group and a duration line; quarter rests require separate groups', () => {
  const half = countWritingFixtures.find(f => f.id === 'half-rest')!;
  const quarters = countWritingFixtures.find(f => f.id === 'two-rests')!;
  const answer: CountAnswer = { symbols: ['1', '', '2', '', '3', '', '4', '&'], spans: [{ start: 0, end: 3 }], rests: [{ start: 0, end: 2 }] };
  assert.deepEqual(Object.values(evaluate(half, answer)).map(d => d.verdict), ['correct', 'correct', 'correct']);
  answer.rests = [{ start: 0, end: 0 }, { start: 2, end: 2 }];
  assert.equal(evaluate(half, answer).rests.verdict, 'revise');
  answer.spans = [];
  assert.deepEqual(Object.values(evaluate(quarters, answer)).map(d => d.verdict), ['correct', 'correct', 'correct']);
  answer.rests = [{ start: 0, end: 2 }];
  assert.equal(evaluate(quarters, answer).rests.verdict, 'revise');
  answer.rests = [{ start: 0, end: 0 }, { start: 2, end: 2 }, { start: 2, end: 2 }];
  assert.equal(evaluate(quarters, answer).rests.verdict, 'revise');
});


test('rest groups must bound all counts of exactly one event, independently of symbols and lines', () => {
  const half = countWritingFixtures.find(f => f.id === 'half-rest')!;
  const answer = blankAnswer(half);
  answer.rests = [{ start: 0, end: 2 }];
  assert.equal(evaluate(half, answer).rests.verdict, 'correct');
  assert.equal(evaluate(half, answer).counts.verdict, 'revise');
  assert.equal(evaluate(half, answer).spans.verdict, 'revise');
  for (const group of [{ start: 0, end: 0 }, { start: 2, end: 2 }, { start: 2, end: 0 }, { start: 0, end: 4 }]) {
    answer.rests = [group];
    assert.equal(evaluate(half, answer).rests.verdict, 'revise');
  }
  answer.rests = [{ start: 0, end: 2 }];
  answer.symbols[3] = '&';
  assert.equal(evaluate(half, answer).rests.verdict, 'revise', 'an entered rest count outside the pair is unbounded');
  answer.rests[0]!.end = 3;
  assert.equal(evaluate(half, answer).rests.verdict, 'correct');
});
