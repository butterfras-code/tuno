// Replacement contract tests. Existing count-writing tests remain legacy runtime regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreFromLegacy } from '../src/music/legacy-score.ts';
import type { RhythmEvent, RhythmMeasure } from '../src/music/measure.ts';
import { buildCountingPlan } from '../src/music/counting/plan.ts';
import { defaultCountingPreferences, captureCountingPreferences } from '../src/music/counting/preferences.ts';
import type { CountingPreferences } from '../src/music/counting/preferences.ts';
import { initializeAnswer, enterToken, toggleUnit, evaluateAnswer, normalizeAnswer } from '../src/music/counting/answer.ts';
import { add, compare, fraction } from '../src/music/fraction.ts';
import { practiceFixtures } from '../src/apps/rhythm-walk/shared/fixtures.ts';
const bar = (events: RhythmEvent[], meter: RhythmMeasure['meter'] = [4, 4]): RhythmMeasure => ({ meter, events });
const plan = (measures: RhythmMeasure[], prefs: Partial<CountingPreferences> = {}) => buildCountingPlan(scoreFromLegacy(measures), { ...defaultCountingPreferences, ...prefs });
const labels = (p: ReturnType<typeof plan>, unit = 0) => p.units[unit]!.counts.map(c => c.expectedToken).join(' ');
const q: RhythmEvent = ['Q'], e: RhythmEvent = ['E'], h: RhythmEvent = ['H'];
const dotQ: RhythmEvent = ['Q', { dots: 1 }];
const tq: RhythmEvent = ['Q', { tieNext: true }];
const examples: { name: string; music: RhythmMeasure[]; long: boolean; dotted: boolean; expected: string; unit?: number }[] = [
  { name: 'half off', music: [bar([h, h])], long: false, dotted: false, expected: '1' },
  { name: 'half on', music: [bar([h, h])], long: true, dotted: false, expected: '1 2' },
  { name: 'whole', music: [bar([['W']])], long: true, dotted: false, expected: '1 2 3 4' },
  { name: 'dotted quarter long only', music: [bar([dotQ, e, h])], long: true, dotted: false, expected: '1' },
  { name: 'dotted quarter dotted only', music: [bar([dotQ, e, h])], long: false, dotted: true, expected: '1 & 2' },
  { name: 'quarter tied quarter', music: [bar([tq, q, h])], long: true, dotted: false, expected: '1 2' },
  { name: 'no inferred dot on quarter tied eighth', music: [bar([tq, e, e, h])], long: false, dotted: true, expected: '1' },
  { name: 'written dot on continuation', music: [bar([['E', { tieNext: true }], dotQ, h])], long: false, dotted: true, expected: '1 & 2 &' },
  { name: 'offbeat attack-relative pulses', music: [bar([e, tq, q, e, q])], long: true, dotted: false, expected: '& &', unit: 1 },
  { name: 'barline tie', music: [bar([h, q, tq]), bar([q, h, q])], long: true, dotted: false, expected: '4 1', unit: 2 },
  { name: 'tie without rules', music: [bar([tq, q, h])], long: false, dotted: false, expected: '1' },
  { name: 'included half rest', music: [bar([['H', { rest: true }], h])], long: true, dotted: false, expected: '1 2' },
];
for (const ex of examples) test(`acceptance: ${ex.name}`, () => {
  const p = plan(ex.music, { longNotes: ex.long, dotted: ex.dotted });
  assert.equal(labels(p, ex.unit), ex.expected);
  assert.equal(p.units[ex.unit ?? 0]!.durationApplicable, ex.expected.split(' ').length > 1);
});
for (const longNotes of [false, true]) for (const dotted of [false, true]) {
  test(`compound acceptance matrix long=${longNotes} dotted=${dotted}`, () => {
    const prefs = { longNotes, dotted };
    for (const rest of [false, true]) {
      const half = plan([bar([['H', { dots: 1, rest }]], [6, 8])], prefs);
      assert.equal(labels(half), longNotes ? '1 4' : '1');
    }
    const tied = plan([bar([['Q', { dots: 1, tieNext: true }], dotQ], [6, 8])], prefs);
    assert.equal(labels(tied), dotted ? '1 2 3 4 5 6' : longNotes ? '1 4' : '1');
    assert.equal(tied.units.length, 1);
    const separate = plan([bar([dotQ, dotQ], [6, 8])], prefs);
    assert.deepEqual(separate.units.map((_, i) => labels(separate, i)), dotted ? ['1 2 3', '4 5 6'] : ['1', '4']);
    const eighths = plan([bar([e, e, e, e, e, e], [6, 8])], prefs);
    assert.deepEqual(eighths.units.map((_, i) => labels(eighths, i)), ['1', '2', '3', '4', '5', '6']);
  });
}
test('owner two-bar example and simple written dotted eighth/half', () => {
  const music = [bar([q, q, e, e, e, e]), bar([['H', { dots: 1 }], q])];
  for (const prefs of [{ longNotes: true, dotted: false }, { longNotes: false, dotted: true }, { longNotes: true, dotted: true }]) {
    const p = plan(music, prefs);
    assert.equal(p.counts.map(c => c.expectedToken).join(' '), '1 2 3 & 4 & 1 2 3 4');
    assert.equal(labels(p, 6), '1 2 3');
  }
  assert.equal(labels(plan([bar([['E', { dots: 1 }], ['S'], q, h])], { dotted: true })), '1 e &');
  const p = plan([bar([dotQ, e, h])], { dotted: true });
  assert.equal(labels(p, 1), '&');
});
test('cross-bar offbeat chain omits downbeat, with one unit and inherited state', () => {
  const p = plan([bar([h, q, e, ['E', { tieNext: true }]]), bar([tq, q, h])]);
  const u = p.units[3]!;
  assert.deepEqual(u.counts.map(c => [c.measure, c.localPosition, c.expectedToken]), [[0, [7, 8], '&'], [1, [1, 8], '&'], [1, [3, 8], '&']]);
  assert.equal(p.symbols[4]!.tiedToPrevious, true);
  assert.equal(p.symbols[4]!.counts[0], u.counts[1]);
  let answer = initializeAnswer(p);
  answer = toggleUnit(p, answer, u.counts[2]!.id, 'durationIndicated');
  assert.equal(answer.units[u.id]!.durationIndicated, true);
  answer = toggleUnit(p, answer, u.counts[0]!.id, 'durationIndicated');
  assert.equal(answer.units[u.id]!.durationIndicated, false);
  assert.equal(Object.keys(answer.units).length, p.units.length);
});
test('all fixtures: exact union, sparse identity, unique ownership, source references, immutable snapshot', () => {
  for (const fixture of practiceFixtures) {
    const source = scoreFromLegacy(fixture.measures);
    const base = buildCountingPlan(source, { ...defaultCountingPreferences, longNotes: false });
    const long = buildCountingPlan(source);
    const dotted = buildCountingPlan(source, { ...defaultCountingPreferences, longNotes: false, dotted: true });
    const both = buildCountingPlan(source, { ...defaultCountingPreferences, dotted: true });
    assert.deepEqual(new Set(both.counts.map(c => c.id)), new Set([...long.counts, ...dotted.counts].map(c => c.id)), fixture.id);
    assert.equal(new Set(both.counts.map(c => c.id)).size, both.counts.length);
    for (const c of both.counts) {
      const symbol = both.symbols.find(s => s.source.id === c.symbolId)!;
      assert.ok(symbol.counts.includes(c));
      assert.ok(both.units.find(u => u.id === c.unitId)!.counts.includes(c));
      assert.ok(compare(c.position, symbol.start) >= 0 && compare(c.position, symbol.end) < 0);
      assert.equal(symbol.source, both.source.measures[symbol.measure]!.notes[symbol.event]);
    }
    for (const c of base.counts) assert.equal(both.counts.find(b => b.id === c.id)!.position.join('/'), c.position.join('/'));
    assert.ok(Object.isFrozen(both.units[0]!.counts));
  }
  const prefs = { ...defaultCountingPreferences };
  const p = plan([bar([h, h])], prefs); prefs.longNotes = false;
  assert.equal(p.preferences.longNotes, true);
  assert.throws(() => (p.source.measures[0]!.notes as unknown[]).pop(), TypeError);
});
test('rest units stay separate; any count toggles the entire unit independently of duration', () => {
  const p = plan([bar([['H', { rest: true }], ['Q', { rest: true }], q])]);
  let a = initializeAnswer(p);
  assert.deepEqual(Object.values(a.units), Array.from({ length: 3 }, () => ({ restMarked: false, durationIndicated: false })));
  assert.equal(evaluateAnswer(p, a).rests.verdict, 'incorrect');
  a = toggleUnit(p, a, p.counts[1]!.id, 'restMarked');
  a = toggleUnit(p, a, p.counts[1]!.id, 'durationIndicated');
  assert.deepEqual(a.units[p.units[0]!.id], { restMarked: true, durationIndicated: true });
  assert.equal(a.units[p.units[1]!.id]!.restMarked, false);
  a = toggleUnit(p, a, p.units[1]!.counts[0]!.id, 'restMarked');
  assert.equal(evaluateAnswer(p, a).rests.verdict, 'correct');
  a = toggleUnit(p, a, p.units[2]!.counts[0]!.id, 'restMarked');
  assert.equal(evaluateAnswer(p, a).rests.verdict, 'incorrect');
  assert.equal(p.units.length, 3);
  const adjacent = plan([bar([['Q', { rest: true }], ['Q', { rest: true }], h])]);
  assert.deepEqual(adjacent.units.slice(0, 2).map(u => u.counts.length), [1, 1]);
});
test('omission removes all rest answer targets and suppresses rest controls on notes', () => {
  const p = plan([bar([['H', { rest: true }], h])], { includeRests: false });
  assert.equal(p.units.length, 1); assert.equal(labels(p), '3 4');
  assert.equal(p.symbols[0]!.unitId, null); assert.equal(p.symbols[0]!.counts.length, 0);
  const a = toggleUnit(p, initializeAnswer(p), p.counts[0]!.id, 'restMarked');
  assert.equal(a.units[p.units[0]!.id]!.restMarked, false);
  assert.equal(evaluateAnswer(p, a).rests.verdict, 'not-applicable');
  const silent = plan([bar([['W', { rest: true }]])], { includeRests: false });
  assert.deepEqual(initializeAnswer(silent), { counts: {}, units: {} });
  assert.deepEqual(Object.values(evaluateAnswer(silent, initializeAnswer(silent))).map(d => d.verdict), Array(3).fill('not-applicable'));
});
for (const showDurationLine of [false, true]) for (const internalAppearance of ['raised', 'lowered', 'unchanged'] as const) for (const restAppearance of ['parentheses', 'slashes'] as const) {
  test(`presentation applicability ${showDurationLine}/${internalAppearance}/${restAppearance}`, () => {
    const p = plan([bar([['H', { rest: true }], q, q])], { showDurationLine, internalAppearance, restAppearance });
    const applies = showDurationLine || internalAppearance !== 'unchanged';
    let a = initializeAnswer(p);
    for (const c of p.counts) a = enterToken(p, a, c.id, c.expectedToken);
    a = toggleUnit(p, a, p.counts[0]!.id, 'restMarked');
    let result = evaluateAnswer(p, a);
    assert.equal(result.tokens.verdict, 'correct'); assert.equal(result.rests.verdict, 'correct');
    assert.equal(result.duration.verdict, applies ? 'incorrect' : 'not-applicable');
    a = toggleUnit(p, a, p.counts[1]!.id, 'durationIndicated');
    assert.equal(a.units[p.units[0]!.id]!.durationIndicated, applies);
    assert.equal(evaluateAnswer(p, a).duration.verdict, applies ? 'correct' : 'not-applicable');
    a = toggleUnit(p, a, p.units[1]!.counts[0]!.id, 'durationIndicated');
    assert.equal(a.units[p.units[1]!.id]!.durationIndicated, false);
    result = evaluateAnswer(p, a);
    assert.equal(result.duration.items[1]!.verdict, 'not-applicable');
    const polluted = { ...a, units: { ...a.units, [p.units[1]!.id]: { restMarked: false, durationIndicated: true } } };
    assert.equal(normalizeAnswer(p, polluted).units[p.units[1]!.id]!.durationIndicated, false);
  });
}
test('vocabularies, atomic triplets, alias input, and independent wrong token feedback', () => {
  const music = [bar([['S'], ['S'], ['S'], ['S'], q, h])];
  const p = plan(music); let a = initializeAnswer(p);
  a = enterToken(p, a, p.counts[2]!.id, '+'); assert.equal(a.counts[p.counts[2]!.id], '&');
  a = enterToken(p, a, p.counts[0]!.id, '2');
  assert.equal(evaluateAnswer(p, a).tokens.items[0]!.verdict, 'incorrect');
  assert.equal(evaluateAnswer(p, a).rests.verdict, 'correct');
  assert.equal(plan(music, { vocabulary: 'syllables' }).counts.slice(0, 4).map(c => c.expectedToken).join(' '), '1 ta te ta');
  const triplets = plan([bar([['E', { tuplet: [3, 2] }], ['E', { tuplet: [3, 2] }], ['E', { tuplet: [3, 2] }], q], [2, 4])], { longNotes: false });
  assert.deepEqual(triplets.counts.slice(0, 3).map(c => c.position), [[0, 1], [1, 12], [1, 6]]);
  assert.equal(triplets.counts.map(c => c.expectedToken).join(' '), '1 la li 2');
  assert.equal(compare(add(triplets.symbols[2]!.start, triplets.symbols[2]!.duration), fraction(1, 4)), 0);
  assert.throws(() => enterToken(p, a, 'count:99:0/1', '1'), /Unknown/);
});
test('explicit capability and preference rejections', () => {
  assert.throws(() => plan([bar([h, q, tq]), bar([q, h], [3, 4])]), /Mixed-meter/);
  assert.throws(() => plan([bar([['Q', { dots: 2 }], ['S'], h])]), /Unsupported counting/);
  assert.throws(() => plan([bar([['Q', { tuplet: [2, 3] }], ['Q', { tuplet: [2, 3] }], q])]), /Unsupported counting/);
  assert.throws(() => captureCountingPreferences({ ...defaultCountingPreferences, version: 2 } as unknown as CountingPreferences), /Invalid/);
  assert.throws(() => captureCountingPreferences({ ...defaultCountingPreferences, longNotes: 'yes' } as unknown as CountingPreferences), /Invalid/);
});
test('overlapping rule reasons share a single exact count and do not infer pulse dots', () => {
  const p = plan([bar([['H', { dots: 1 }], q])], { dotted: true });
  assert.deepEqual(p.counts[1]!.reasons, ['long-note', 'written-dot']);
  assert.equal(p.counts.length, 4);
  const compound = plan([bar([['H', { dots: 1 }]], [6, 8])], { dotted: true });
  assert.deepEqual(compound.counts.map(c => c.reasons), [['attack'], ['long-note']]);
});
