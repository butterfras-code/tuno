import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveMeasure, validateMeasure } from '../src/music/measure.ts';
import { countWritingFixtures } from '../src/apps/count-writing/fixtures.ts';
import { toNumber } from '../src/music/fraction.ts';
import { blankAnswer, evaluate } from '../src/apps/count-writing/evaluation.ts';
import type { CountAnswer } from '../src/apps/count-writing/evaluation.ts';
const solutions: CountAnswer[] = [
  { symbols: ['1', '', '2', '', '3', '', '4', '&'], spans: [{ start: 0, end: 3 }], rests: Array(8).fill(false) },
  { symbols: ['1', '', '2', '&', '3', '', '4', ''], spans: [{ start: 0, end: 2 }, { start: 4, end: 7 }], rests: Array(8).fill(false) },
  { symbols: ['1', '', '2', '', '3', '&', '4', ''], spans: [], rests: [false, false, true, false, false, false, false, false] },
  { symbols: ['1', '', '2', '', '3', '', '4', ''], spans: [{ start: 0, end: 5 }], rests: Array(8).fill(false) },
];
test('all four fixtures have exact onsets and fill 4/4', () => {
  const positions = [[0, 4, 6, 7], [0, 3, 4], [0, 2, 4, 5, 6], [0, 6]];
  const lengths = [[4, 2, 1, 1], [3, 1, 4], [2, 2, 1, 1, 2], [6, 2]];
  countWritingFixtures.forEach((fixture, i) => {
    validateMeasure(fixture);
    assert.deepEqual(deriveMeasure(fixture).events.map(e => toNumber(e.start) * 8), positions[i]);
    assert.deepEqual(deriveMeasure(fixture).events.map(e => toNumber(e.duration) * 8), lengths[i]);
  });
  assert.throws(() => validateMeasure({ ...countWritingFixtures[0]!, events: [['Q']] }));
});
countWritingFixtures.forEach((fixture, i) => {
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
    answer.symbols[0] = '1'; answer.rests[0] = true;
    assert.equal(evaluate(fixture, answer).rests.verdict, 'revise');
    assert.equal(evaluate(fixture, answer).counts.verdict, good.counts.verdict);
    answer.rests[0] = false;
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
  answer.rests[2] = true;
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
  answer.spans[0] = { start: 0, end: 2 };
  assert.equal(evaluate(countWritingFixtures[0]!, answer).spans.verdict, 'provisional');
});
