import { notationOnly } from './score-test-support.ts';
import { note } from './score-test-support.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { meterFixtures } from '../src/apps/count-writing/fixtures.ts';
import { blankAnswer, evaluatePassage } from './legacy/count-evaluation.ts';
import type { CountSymbol, Span } from './legacy/count-evaluation.ts';
import { countGrid } from '../src/apps/count-writing/grid.ts';
import { passageGrid, spanPieces } from './legacy/count-passage.ts';
import { defaultGeneration, generateExercise as generateScore, generationIssue, ingredients } from '../src/apps/count-writing/generation.ts';
import { meterPolicy, meters, syncopated } from '../src/apps/count-writing/meter.ts';
import { readableRestPlacement } from '../src/apps/count-writing/notation-policy.ts';
import { derivePassage } from './score-test-support.ts';
import { compare, fraction } from '../src/music/fraction.ts';
const numbers: CountSymbol[] = ['1', '2', '3', '4', '5', '6'];
const fixture = (id: string) => meterFixtures.find(f => f.id === id)!.score.measures;
// Explicit musical expectations: no grid-derived answer oracle.
const examples: [string, CountSymbol[][], Span[], Span[][]][] = [
  ['meter-2', [['1', '', '2', '&']], [], [[]]],
  ['meter-3', [['1', '', '2', '&', '3', '']], [], [[]]],
  ['six-eighths', [numbers], [], [[]]],
  ['six-dotted', [numbers], [{ start: 0, end: 2 }, { start: 3, end: 5 }], [[]]],
  ['six-quarter-eighth', [numbers], [{ start: 0, end: 1 }, { start: 3, end: 4 }], [[]]],
  ['six-eighth-quarter', [numbers], [{ start: 1, end: 2 }, { start: 4, end: 5 }], [[]]],
  ['six-rest-first', [numbers], [{ start: 0, end: 2 }, { start: 3, end: 5 }], [[{ start: 0, end: 2 }]]],
  ['six-rest-second', [numbers], [{ start: 0, end: 2 }, { start: 3, end: 5 }], [[{ start: 3, end: 5 }]]],
  ['six-rest-boundary', [numbers], [{ start: 1, end: 2 }, { start: 4, end: 5 }], [[{ start: 1, end: 2 }, { start: 3, end: 3 }]]],
  ['six-adjacent-rests', [numbers], [{ start: 0, end: 1 }, { start: 3, end: 5 }], [[{ start: 0, end: 1 }, { start: 2, end: 2 }]]],
  ['six-tied-quarters', [numbers], [{ start: 0, end: 1 }, { start: 3, end: 4 }], [[]]],
  ['six-tied', [numbers], [{ start: 0, end: 2 }, { start: 3, end: 5 }], [[]]],
  ['six-bar-tie', [numbers, numbers], [{ start: 0, end: 2 }, { start: 3, end: 8 }, { start: 9, end: 11 }], [[], []]],
  ['six-wrap', [numbers, numbers], [{ start: 0, end: 2 }, { start: 3, end: 8 }, { start: 9, end: 11 }], [[], []]],
  ['six-syncopation', [numbers], [{ start: 0, end: 1 }, { start: 2, end: 3 }, { start: 4, end: 5 }], [[]]],
];
for (const [id, symbols, lines, rests] of examples) test(`explicit musical answer: ${id}`, () => {
  const source = fixture(id);
  const answers = source.map((m, i) => ({ ...blankAnswer(m), symbols: [...symbols[i]!], rests: rests[i]! }));
  for (const convention of ['required', 'optional', 'review'] as const) {
    const results = evaluatePassage(source, answers, convention, lines);
    assert.ok(results.every(r => Object.values(r).every(d => d.verdict === 'correct')), JSON.stringify(results));
  }
});
test('six numbered counts, two pulses, fixed duration requirements and independent feedback', () => {
  const source = fixture('six-dotted'), grid = countGrid(source[0]!);
  assert.deepEqual(grid.slots.map(s => s.symbol), numbers);
  assert.deepEqual(grid.slots.flatMap((s, i) => s.onPulse ? [i] : []), [0, 3]);
  assert.deepEqual(grid.measure.beats.map(b => b.duration), [[3, 8], [3, 8]]);
  const answers = [{ ...blankAnswer(source[0]!), symbols: [...numbers] }];
  answers[0]!.symbols[1] = '';
  const result = evaluatePassage(source, answers, 'optional', [{ start: 0, end: 2 }, { start: 3, end: 5 }])[0]!;
  assert.equal(result.counts.verdict, 'revise'); assert.match(result.counts.issues.join(' '), /Measure 1.*count 2/);
  assert.equal(result.spans.verdict, 'correct'); assert.equal(result.rests.verdict, 'correct');
  answers[0]!.symbols = [...numbers];
  assert.equal(evaluatePassage(source, answers, 'review', [{ start: 0, end: 1 }, { start: 3, end: 5 }])[0]!.spans.verdict, 'revise');
  const tied = passageGrid(fixture('six-tied'));
  assert.equal(tied.slots[2]!.attack, false); assert.equal(tied.slots[4]!.attack, false);
  assert.deepEqual(spanPieces({ start: 3, end: 8 }, [6, 6]), [
    { measure: 0, start: 3, end: 5, incoming: false, outgoing: true },
    { measure: 1, start: 0, end: 2, incoming: true, outgoing: false },
  ]);
});
test('readable silence exposes the middle boundary and respects enabled spellings', () => {
  assert.equal(readableRestPlacement(note('quarter', { kind: 'rest' }), fraction(1, 8), '6/8'), true);
  assert.equal(readableRestPlacement(note('quarter', { kind: 'rest' }), fraction(2, 8), '6/8'), false);
  assert.equal(readableRestPlacement(note('quarter', { dots: 1, kind: 'rest' }), fraction(0), '6/8'), true);
  assert.equal(readableRestPlacement(note('quarter', { dots: 1, kind: 'rest' }), fraction(3, 8), '6/8'), true);
  assert.equal(readableRestPlacement(note('quarter', { dots: 1, kind: 'rest' }), fraction(1, 8), '6/8'), false);
  assert.equal(generationIssue({ ...defaultGeneration(), meters: ['6/8'], ingredients: ['dotted-quarter-rest'] }), null);
  assert.match(generationIssue({ ...defaultGeneration(), meters: ['6/8'], ingredients: ['quarter-rest'] })!, /cannot fill/);
  assert.equal(generationIssue({ ...defaultGeneration(), meters: ['6/8'], ingredients: ['half-rest', 'eighth-rest'] }), null);
  const bar = generateExercise({ ...defaultGeneration(), meters: ['6/8'], ingredients: ['quarter-rest', 'eighth-rest'] }, () => 0)[0]!;
  assert.deepEqual(notationOnly(bar.notes), notationOnly([note('quarter', { kind: 'rest' }), note('eighth', { kind: 'rest' }), note('quarter', { kind: 'rest' }), note('eighth', { kind: 'rest' })]));
  for (const meter of ['2/4', '3/4', '4/4'] as const) {
    assert.equal(readableRestPlacement(note('quarter', { kind: 'rest' }), fraction(1, 8), meter), false);
    assert.equal(readableRestPlacement(note('half', { kind: 'rest' }), fraction(1, 4), meter), true);
  }
});
test('syncopation uses the dotted-quarter pulse, not each numbered eighth', () => {
  assert.equal(syncopated(fraction(1, 8), fraction(1, 4), fraction(3, 8)), false); // 2 through 3, ends at 4
  assert.equal(syncopated(fraction(2, 8), fraction(1, 4), fraction(3, 8)), true); // 3 through 4
  assert.equal(syncopated(fraction(3, 8), fraction(1, 4), fraction(3, 8)), false);
  const settings = { ...defaultGeneration(), meters: ['6/8' as const], ingredients: ['quarter'] as const };
  assert.match(generationIssue({ ...settings, ingredients: [...settings.ingredients] })!, /cannot fill/);
  const allowed = { ...settings, ingredients: [...settings.ingredients], syncopation: true };
  assert.equal(generationIssue(allowed), null);
  assert.deepEqual(notationOnly(generateExercise(allowed, () => 0)[0]!.notes), notationOnly([note('quarter'), note('quarter'), note('quarter')]));
});
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }
test('all meters, lengths, ingredient subsets and pattern modes are bounded and exact', () => {
  assert.deepEqual(defaultGeneration().meters, ['4/4']); assert.equal(defaultGeneration().measures, 2);
  for (const allowUnintuitiveNotation of [false, true]) for (const meter of meters) for (const measures of [1, 2, 3, 4]) for (let mask = 0; mask < 256; mask++) for (const mode of [0, 1, 2, 3]) {
    const selected = ingredients.filter((_, i) => mask & (1 << i));
    const settings = { meters: [meter], measures, ingredients: selected.map(i => i.id), ties: !!(mode & 1), syncopation: !!(mode & 2), allowUnintuitiveNotation };
    if (generationIssue(settings)) { assert.throws(() => generateExercise(settings, seeded(mask))); continue; }
    const source = generateExercise(settings, seeded(mask + measures));
    assert.deepEqual(source, generateExercise(settings, seeded(mask + measures)));
    const policy = meterPolicy(meter), derived = derivePassage(source), grid = passageGrid(source);
    const size = meter === '2/4' ? 4 : meter === '4/4' ? 8 : 6;
    assert.deepEqual(grid.offsets, Array.from({ length: measures }, (_, i) => i * size));
    assert.equal(grid.slots.length, size * measures);
    source.forEach((bar, i) => {
      assert.equal(compare(derived.measures[i]!.length, policy.length), 0);
      assert.equal(blankAnswer(bar).symbols.length, size);
      assert.equal(grid.grids[i]!.slots[0]!.symbol, '1');
      derived.measures[i]!.events.forEach(e => {
        const { id: _id, tieNext: _, ...mods } = e.written;
        assert.ok(selected.some(s => {const {id: _id, tieNext: _tie, ...expected} = s.event; return JSON.stringify(expected) === JSON.stringify(mods);}));
        assert.ok(allowUnintuitiveNotation || readableRestPlacement(e.written, e.start, meter));
      });
    });
    const perBar = Array<number>(measures).fill(0);
    derived.attacks.forEach(a => { if (syncopated(a.start, a.duration, policy.pulse)) perBar[a.sources[0]!.measure]!++; });
    assert.ok(perBar.every(n => n <= (settings.syncopation ? 1 : 0)));
    assert.ok(derived.attacks.filter(a => a.sources.length > 1).length <= (settings.ties ? 1 : 0));
  }
});

test('short simple-meter barline ties use actual offsets and numbering resets', () => {
  for (const numerator of [2, 3]) {
    const source = [
      { meter: [numerator, 4] as const, notes: Array.from({ length: numerator }, (_, i) => i === numerator - 1 ? note('quarter', { tieNext: true }) : note('quarter')) },
      { meter: [numerator, 4] as const, notes: Array.from({ length: numerator }, () => note('quarter')) },
    ];
    const symbols = numerator === 2 ? ['1', '', '2', ''] : ['1', '', '2', '', '3', ''];
    const answers = source.map(bar => ({ ...blankAnswer(bar), symbols: symbols as CountSymbol[] }));
    const lines = [{ start: (numerator - 1) * 2, end: numerator * 2 + 1 }];
    const grid = passageGrid(source);
    assert.equal(grid.slots[numerator * 2]!.symbol, '1');
    assert.equal(grid.slots[numerator * 2]!.attack, false);
    assert.ok(evaluatePassage(source, answers, 'required', lines).every(r => Object.values(r).every(d => d.verdict === 'correct')));
  }
});

test('rest pairs and duration errors are independently located at 6/8 counting positions', () => {
  const source = fixture('six-rest-boundary');
  const answers = [{ ...blankAnswer(source[0]!), symbols: [...numbers], rests: [{ start: 1, end: 1 }, { start: 3, end: 3 }] }];
  const lines = [{ start: 1, end: 2 }, { start: 4, end: 5 }];
  const restError = evaluatePassage(source, answers, 'review', lines)[0]!;
  assert.equal(restError.counts.verdict, 'correct'); assert.equal(restError.spans.verdict, 'correct');
  assert.equal(restError.rests.verdict, 'revise'); assert.match(restError.rests.issues.join(' '), /Measure 1.*count 2.*count 3/);
  answers[0]!.rests[0]!.end = 2;
  const lineError = evaluatePassage(source, answers, 'review', [{ start: 1, end: 1 }, { start: 4, end: 5 }])[0]!;
  assert.equal(lineError.counts.verdict, 'correct'); assert.equal(lineError.rests.verdict, 'correct'); assert.equal(lineError.spans.verdict, 'revise');
  assert.match(lineError.spans.issues.join(' '), /Measure 1.*count 2.*count 3/);
});

const generateExercise = (...args: Parameters<typeof generateScore>) => generateScore(...args).measures;
