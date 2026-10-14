import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RhythmMeasure } from '../src/music/measure.ts';
import { derivePassage } from '../src/music/measure.ts';
import { compare, divide, fraction } from '../src/music/fraction.ts';
import { defaultGeneration, generateExercise, generationIssue, ingredients } from '../src/apps/count-writing/generation.ts';
import { blankAnswer, evaluatePassage } from './legacy/count-evaluation.ts';
import type { CountAnswer, Span } from './legacy/count-evaluation.ts';
import { passageGrid, passageDurationEnd, spanPieces } from './legacy/count-passage.ts';
import { tieFixtures } from '../src/apps/count-writing/fixtures.ts';
const bar = (events: RhythmMeasure['events']): RhythmMeasure => ({ meter: [4, 4], events });
const fixture = (id: string) => tieFixtures.find(f => f.id === id)!.measures;
const answer = (symbols: CountAnswer['symbols'], rests: Span[] = []): CountAnswer => ({ symbols, spans: [], rests });
const beats: CountAnswer['symbols'] = ['1', '', '2', '', '3', '', '4', ''];
const correct = (source: RhythmMeasure[], answers: CountAnswer[], spans: Span[]) => {
  const before = structuredClone({ source, answers, spans });
  const result = evaluatePassage(source, answers, 'required', spans);
  assert.ok(result.every(r => Object.values(r).every(d => d.verdict === 'correct')), JSON.stringify(result));
  assert.deepEqual({ source, answers, spans }, before);
};
test('review fixtures: within beat, across beat, barline, three segments, offbeat, untied and rests', () => {
  correct(fixture('tie-within-beat'), [answer(beats)], [{ start: 0, end: 1 }, { start: 4, end: 7 }]);
  correct(fixture('tie-across-beat'), [answer(beats)], [{ start: 0, end: 3 }, { start: 4, end: 7 }]);
  correct(fixture('tie-chain'), [answer(beats)], [{ start: 0, end: 3 }, { start: 4, end: 7 }]);
  correct(fixture('tie-across-bar'), [answer(beats), answer(beats)], [{ start: 0, end: 3 }, { start: 6, end: 9 }, { start: 10, end: 13 }]);
  correct(fixture('tie-wrap'), [answer(beats), answer(beats)], [{ start: 0, end: 3 }, { start: 6, end: 9 }, { start: 10, end: 13 }]);
  correct(fixture('tie-offbeat'), [answer(['1', '&', '2', '&', '3', '', '4', ''])], [{ start: 1, end: 3 }, { start: 4, end: 7 }]);
  correct(fixture('syncopation'), [answer(['1', '&', '2', '&', '3', '', '4', ''])], [{ start: 1, end: 2 }, { start: 4, end: 7 }]);
  correct(fixture('tie-rests'), [answer(beats, [{ start: 0, end: 0 }, { start: 4, end: 4 }])], [{ start: 2, end: 3 }]);
});
test('single and tied sounding durations share attack/beat/dotted-count rules, independently of written onsets', () => {
  const single = [bar([['Q', { dots: 1 }], ['E'], ['H']])];
  const tied = [bar([['Q', { tieNext: true }], ['E'], ['E'], ['H']])];
  const a = answer(['1', '&', '2', '&', '3', '', '4', '']);
  for (const convention of ['required', 'optional', 'review'] as const) {
    for (const internal of ['', '&'] as const) {
      const variant = structuredClone(a); variant.symbols[1] = internal;
      assert.deepEqual(evaluatePassage(single, [variant], convention, [{ start: 0, end: 2 }, { start: 4, end: 7 }]).map(r => [r.counts.verdict, r.spans.verdict]), evaluatePassage(tied, [variant], convention, [{ start: 0, end: 2 }, { start: 4, end: 7 }]).map(r => [r.counts.verdict, r.spans.verdict]));
    }
  }
  assert.deepEqual(derivePassage(single).attacks.map(a => [a.start, a.duration]), derivePassage(tied).attacks.map(a => [a.start, a.duration]));
  assert.equal(passageGrid(tied).slots[1]!.available, true, 'sounding dotted quarter exposes internal offbeat even when written quarter hides it');
  const half = [bar([['H'], ['H']])];
  assert.deepEqual(evaluatePassage(half, [answer(beats)], 'required', [{ start: 0, end: 3 }, { start: 4, end: 7 }]).map(r => r.counts), evaluatePassage(fixture('tie-chain'), [answer(beats)], 'required', [{ start: 0, end: 3 }, { start: 4, end: 7 }]).map(r => r.counts));
});
test('feedback distinguishes missing attack, continuation count and extended line without modifying answers', () => {
  const source = fixture('tie-across-bar');
  const a = [answer([...beats]), answer([...beats])];
  a[0]!.symbols[6] = ''; a[1]!.symbols[0] = '4';
  const result = evaluatePassage(source, a, 'required', [{ start: 0, end: 3 }, { start: 6, end: 10 }, { start: 10, end: 13 }]);
  assert.match(result[0]!.counts.issues.join(' '), /Measure 1: Missing attack count.*beat 4/);
  assert.match(result[1]!.counts.issues.join(' '), /Measure 2: Incorrect sustained continuation count.*not a new attack/);
  assert.match(result[0]!.spans.issues.join(' '), /Incorrectly extended.*measure 2/);
  const restart = evaluatePassage(source, [answer(beats), answer(beats)], 'required', [{ start: 0, end: 3 }, { start: 6, end: 7 }, { start: 8, end: 9 }, { start: 10, end: 13 }]);
  assert.equal(restart[1]!.spans.verdict, 'revise');
  assert.match(restart[1]!.spans.issues.join(' '), /not a tied continuation/);
  const extra = evaluatePassage(source, [answer(beats), answer(beats)], 'required', [{ start: 4, end: 5 }]);
  assert.match(extra[0]!.spans.issues.join(' '), /Remove the extra duration line.*beat 3/);
});
test('visual pieces and endpoint selection retain continuous duration at barlines and wraps', () => {
  const source = fixture('tie-wrap'), grid = passageGrid(source);
  assert.deepEqual(spanPieces({ start: 6, end: 9 }, [8, 8]), [
    { measure: 0, start: 6, end: 7, incoming: false, outgoing: true },
    { measure: 1, start: 0, end: 1, incoming: true, outgoing: false },
  ]);
  assert.equal(passageDurationEnd(grid, 8), 9);
  assert.equal(grid.slots[8]!.attack, false);
  assert.equal(grid.slots[8]!.symbol, '1');
  assert.equal(derivePassage(source).attacks.find(a => a.sources.length === 2)!.sources[1]!.measure, 1);
});
test('invalid chains and exercise boundaries are rejected before grading', () => {
  for (const source of [
    [bar([['H'], ['H', { tieNext: true }]])],
    [bar([['Q', { rest: true, tieNext: true }], ['Q'], ['H']])],
    [bar([['Q', { tieNext: true }], ['Q', { rest: true }], ['H']])],
    [bar([['H'], ['H', { tieNext: true }]]), bar([['Q', { rest: true }], ['Q'], ['H']])],
    [bar([['Q', { tieNext: true }], ['Q']])],
  ]) assert.throws(() => evaluatePassage(source, source.map(blankAnswer)), /tie|fill/);
});
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }
test('bounded seeded generation respects independent pattern controls, written ingredients and boundaries', () => {
  assert.equal(defaultGeneration().ties, false); assert.equal(defaultGeneration().syncopation, false);
  let observedTie = false, observedBarTie = false, observedTriple = false, observedSync = false;
  for (const ties of [false, true]) for (const syncopation of [false, true]) for (const allowUnintuitiveNotation of [false, true]) for (let mask = 1; mask < 256; mask++) for (const measures of [1, 2, 3, 4]) {
    const selected = ingredients.filter((_, i) => mask & (1 << i));
    const settings = { measures, ingredients: selected.map(i => i.id), allowUnintuitiveNotation, ties, syncopation };
    if (generationIssue(settings)) { assert.throws(() => generateExercise(settings, seeded(53))); continue; }
    const source = generateExercise(settings, seeded(mask + measures));
    assert.deepEqual(source, generateExercise(settings, seeded(mask + measures)));
    source.forEach(m => m.events.forEach(([value, modifiers]) => {
      const { tieNext: _, ...written } = modifiers ?? {};
      assert.ok(selected.some(i => i.event[0] === value && JSON.stringify(i.event[1] ?? {}) === JSON.stringify(written)));
    }));
    const derived = derivePassage(source);
    assert.ok(derived.measures.every(m => compare(m.length, fraction(1)) === 0));
    const chains = derived.attacks.filter(a => a.sources.length > 1);
    assert.ok(chains.length <= (ties ? 1 : 0)); assert.ok(chains.every(a => a.sources.length <= 3));
    observedTie ||= chains.length > 0; observedTriple ||= chains.some(a => a.sources.length === 3);
    observedBarTie ||= chains.some(a => a.sources[0]!.measure !== a.sources.at(-1)!.measure);
    const offbeats = Array<number>(measures).fill(0);
    derived.attacks.forEach(a => {
      if (divide(a.start, fraction(1, 4))[1] !== 1 && compare(a.duration, fraction(1, 8)) > 0) offbeats[a.sources[0]!.measure]!++;
    });
    assert.ok(offbeats.every(n => n <= (syncopation ? 1 : 0)));
    observedSync ||= offbeats.some(Boolean);
  }
  assert.ok(observedTie && observedTriple && observedBarTie && observedSync);
  assert.equal(generationIssue({ ...defaultGeneration(), ingredients: ['half-rest'], ties: true }), null);
  assert.equal(generationIssue({ ...defaultGeneration(), ingredients: ['quarter'], syncopation: true }), null);
  assert.equal(generationIssue({ ...defaultGeneration(), ingredients: ['eighth'], ties: true, syncopation: true }), null);
  assert.equal(generationIssue({ ...defaultGeneration(), measures: 1, ingredients: ['dotted-quarter', 'eighth-rest'], ties: true }), null);
  assert.equal(generationIssue({ ...defaultGeneration(), measures: 1, ingredients: ['dotted-quarter', 'eighth-rest'], ties: false }), null);
});
