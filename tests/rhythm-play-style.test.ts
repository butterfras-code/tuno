import test from 'node:test';
import assert from 'node:assert/strict';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import type { Exercise } from '../src/apps/rhythm-walk/fixtures.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';
import { timingTimelines } from '../src/apps/rhythm-walk/timeline.ts';
import { defaultPreferences, readPreferences, presets } from '../src/apps/rhythm-walk/activity.ts';
import { provisionalEvaluation, releaseAllowances } from '../src/apps/rhythm-walk/play-policy.ts';
import type { PlayStyle } from '../src/apps/rhythm-walk/play-policy.ts';
import type { TimingOffset } from '../src/apps/rhythm-walk/offset.ts';
import { defaultGeneration, generateExercise, ingredients } from '../src/apps/rhythm-walk/shared/generation.ts';
import { meters } from '../src/apps/rhythm-walk/shared/meter.ts';

const adjacent: Exercise = { id: 'adjacent', label: '', description: '', measures: [{ meter: [2, 4], events: [['E'], ['E'], ['Q']] }] };
const rest: Exercise = { id: 'rest', label: '', description: '', measures: [{ meter: [2, 4], events: [['Q'], ['E', { rest: true }], ['E']] }] };
function capture(style: PlayStyle, exercise = adjacent, bpm = 120, offset?: TimingOffset) { return new Capture(exercise, bpm, false, undefined, offset, style); }
function pair(c: Capture, down: number, up: number | null, source = 'keyboard') {
  c.input('down', source, down, 10000 + down * 1000);
  if (up !== null) c.input('up', source, up, 10000 + up * 1000);
}
function complete(c: Capture) { return c.advance(c.plan.captureEnd)!; }

test('identical attacks and short releases pass Tap but require duration correction in Hold', () => {
  for (const style of ['tap', 'hold'] as const) {
    const c = capture(style); c.plan.notes.forEach(n => pair(c, n.start, n.start + .01));
    const record = complete(c), result = evaluateAttempt(record);
    assert.equal(result.acceptable, style === 'tap');
    assert.equal(result.matches.length, 3);
    assert.ok(result.matches.every(m => m.durationFeedback === (style === 'tap' ? 'not-graded' : 'early')));
    assert.equal(record.events.length, 6, 'both edges remain raw evidence');
    assert.equal(timingTimelines(record)[0]!.receivedSustain.length, style === 'tap' ? 0 : 3);
  }
});

test('adjacent-note articulation is bounded relative to expected end across tempos and short notes', () => {
  for (const bpm of [40, 80, 120, 180]) {
    for (const delta of [-.001, .001]) {
      const c = capture('hold', adjacent, bpm);
      const n = c.plan.notes[0]!;
      const allowance = releaseAllowances(n.end - n.start, true, provisionalEvaluation);
      pair(c, n.start, n.end - allowance.early + delta);
      pair(c, c.plan.notes[1]!.start, c.plan.notes[1]!.end);
      pair(c, c.plan.notes[2]!.start, c.plan.notes[2]!.end);
      assert.equal(evaluateAttempt(complete(c)).matches[0]!.durationFeedback, delta < 0 ? 'early' : 'accepted');
      assert.ok(allowance.early <= .08 && allowance.early <= (n.end - n.start) * .15);
    }
    // The ordinary and articulation bands are alternatives, not additive.
    const c = capture('hold', adjacent, bpm), n = c.plan.notes[0]!;
    const a = releaseAllowances(n.end - n.start, true, provisionalEvaluation);
    pair(c, n.start, n.end - a.early - a.late / 2);
    assert.equal(evaluateAttempt(complete(c)).matches[0]!.durationFeedback, 'early');
  }
});

test('late release and late reattack cannot validate each other; meaningful sustain remains necessary', () => {
  const c = capture('hold');
  pair(c, 0, .35); pair(c, .36, .5); pair(c, .5, 1);
  const result = evaluateAttempt(complete(c));
  assert.equal(result.matches[0]!.durationFeedback, 'late');
  assert.equal(result.matches[1]!.attackAccepted, false);
  assert.equal(result.acceptable, false);
  const short = capture('hold', adjacent, 180), n = short.plan.notes[0]!;
  const allowance = releaseAllowances(n.end - n.start, true, provisionalEvaluation);
  pair(short, n.start + .06, n.end - allowance.early);
  assert.equal(evaluateAttempt(complete(short)).matches[0]!.durationFeedback, 'short');
});

test('Tap ignores overholds and missing releases but still detects attacks in rests', () => {
  const tap = capture('tap', rest);
  pair(tap, 0, .7); pair(tap, .75, null);
  const result = evaluateAttempt(complete(tap));
  assert.equal(result.acceptable, true);
  assert.ok(result.restOverlaps.length > 0); assert.deepEqual(result.restViolations, []);
  const extra = capture('tap', rest); pair(extra, 0, .01); pair(extra, .6, .61); pair(extra, .75, .76);
  const bad = evaluateAttempt(complete(extra));
  assert.equal(bad.acceptable, false); assert.equal(bad.restAttacks.length, 1);
});

test('rest-boundary and final releases use ordinary tolerance, retaining finite incomplete evidence', () => {
  for (const noteIndex of [0, 1]) for (const delta of [-.001, .001]) {
    const c = capture('hold', rest), n = c.plan.notes[noteIndex]!;
    const allowance = releaseAllowances(n.end - n.start, false, provisionalEvaluation);
    pair(c, n.start, n.end + allowance.late + delta);
    const r = evaluateAttempt(complete(c));
    assert.equal(r.matches[0]!.durationFeedback, delta < 0 ? 'accepted' : 'late');
    if (noteIndex === 0) assert.equal(r.restViolations.length, delta < 0 ? 0 : 1);
  }
  const c = capture('hold', rest); pair(c, .75, null);
  const record = complete(c), r = evaluateAttempt(record);
  assert.equal(record.endedAt, record.plan.captureEnd);
  assert.equal(r.matches[0]!.releaseOffset, null); assert.equal(r.matches[0]!.durationFeedback, 'incomplete');
  assert.equal(record.events.length, 1);
});

test('accepted early attacks after rests keep raw overlap without a contradictory rest violation', () => {
  for (const style of ['tap', 'hold'] as const) for (const early of [.01, .08, .081]) {
    const c = capture(style, rest);
    pair(c, 0, .5); pair(c, .75 - early, 1);
    const record = complete(c), raw = structuredClone(record.events), result = evaluateAttempt(record);
    assert.equal(result.matches[1]!.attackAccepted, early <= .08);
    assert.equal(result.acceptable, early <= .08);
    assert.equal(result.restViolations.length, early <= .08 ? 0 : 1);
    assert.equal(result.restAttacks.length, 1, 'raw rest attack remains evidence');
    assert.ok(Math.abs(result.restOverlaps[0]!.end - result.restOverlaps[0]!.start - early) < 1e-9);
    assert.deepEqual(record.events, raw);
  }
});

test('rest acceptance does not excuse unmatched attacks or unrelated sustained intrusion', () => {
  for (const style of ['tap', 'hold'] as const) {
    const c = capture(style, rest);
    pair(c, 0, .5); pair(c, .51, .52); pair(c, .74, 1);
    const result = evaluateAttempt(complete(c));
    assert.equal(result.extra.length, 1); assert.equal(result.restAttacks.length, 2);
    assert.equal(result.restViolations.length, 1); assert.equal(result.acceptable, false);
  }
  const held = capture('hold', rest); pair(held, 0, .7); pair(held, .74, 1);
  const result = evaluateAttempt(complete(held));
  assert.equal(result.restViolations.length, 1, 'previous note overhold still fails despite accepted next attack');
  assert.equal(result.matches[0]!.durationFeedback, 'late');
});

test('ties require a single continuous hold, within and across bars', () => {
  for (const measures of [
    [{ meter: [2, 4] as const, events: [['Q', { tieNext: true }], ['Q']] as const }],
    [{ meter: [2, 4] as const, events: [['H', { tieNext: true }]] as const }, { meter: [2, 4] as const, events: [['H']] as const }],
  ]) {
    const exercise = { id: 'tie', label: '', description: '', measures };
    const good = capture('hold', exercise); pair(good, 0, good.plan.duration);
    assert.equal(evaluateAttempt(complete(good)).acceptable, true);
    const broken = capture('hold', exercise), boundary = measures.length === 1 ? .5 : 1;
    pair(broken, 0, boundary - .01); pair(broken, boundary, broken.plan.duration);
    const r = evaluateAttempt(complete(broken));
    assert.equal(r.matches.length, 1); assert.equal(r.matches[0]!.durationFeedback, 'early'); assert.equal(r.extra.length, 1);
  }
});

test('fixed input-specific correction preserves raw evidence and measured hold duration', () => {
  const offset: TimingOffset = { version: 1, seconds: .12, input: 'keyboard', method: 'tap', samples: 12, spread: 0 };
  const c = capture('hold', adjacent, 120, offset);
  c.plan.notes.forEach(n => pair(c, n.start + .12, n.end + .12 - .01));
  offset.seconds = .3;
  const record = complete(c), saved = structuredClone(record.events);
  const corrected = evaluateAttempt(record), raw = evaluateAttempt(record, null);
  assert.equal(record.timingOffset!.seconds, .12); assert.equal(corrected.acceptable, true);
  corrected.holds.forEach((h, i) => assert.ok(Math.abs((h.up! - h.down) - (raw.holds[i]!.up! - raw.holds[i]!.down)) < 1e-9));
  assert.deepEqual(record.events, saved);
  const other = capture('hold', adjacent, 120, record.timingOffset);
  pair(other, .12, .24, 'pointer:1'); assert.equal(evaluateAttempt(complete(other)).holds[0]!.down, .12);
});

test('preferences and policies are snapshotted; retry uses current selection', () => {
  assert.equal(defaultPreferences().playStyle, 'tap');
  assert.equal(readPreferences(JSON.stringify({ version: 1 })).playStyle, 'tap');
  assert.equal(readPreferences(JSON.stringify({ version: 1, playStyle: 'invalid' })).playStyle, 'tap');
  const prefs = defaultPreferences(); prefs.playStyle = 'hold';
  assert.equal(readPreferences(JSON.stringify(prefs)).playStyle, 'hold');
  const policy = { ...provisionalEvaluation };
  const c = new Capture(adjacent, 120, true, undefined, undefined, prefs.playStyle, policy);
  prefs.playStyle = 'tap'; policy.releaseTolerance = 1;
  c.plan.notes.forEach(n => pair(c, n.start, n.start + .01));
  const record = complete(c); assert.equal(record.playStyle, 'hold'); assert.equal(record.evaluationPolicy!.releaseTolerance, .06);
  const original = evaluateAttempt(record); prefs.playStyle = 'hold'; assert.deepEqual(evaluateAttempt(record), original);
  prefs.playStyle = 'tap'; const retry = capture(prefs.playStyle); assert.equal(complete(retry).playStyle, 'tap');
});

test('duration geometry splits tied, unmatched, overheld and incomplete inputs without new attacks', () => {
  const exercise: Exercise = { id: 'cross', label: '', description: '', measures: [
    { meter: [2, 4], events: [['H', { tieNext: true }]] },
    { meter: [2, 4], events: [['Q'], ['Q']] },
  ] };
  const c = capture('hold', exercise); pair(c, 0, 1.49); pair(c, 1.5, null);
  const rows = timingTimelines(complete(c));
  assert.deepEqual(rows.map(r => r.expected.length), [1, 1]);
  assert.deepEqual(rows.map(r => r.received.length), [1, 1]);
  assert.equal(rows[0]!.expectedSustain[0]!.continuesAfter, true);
  assert.equal(rows[1]!.expectedSustain[0]!.continuesBefore, true);
  assert.equal(rows[1]!.receivedSustain[0]!.end, 1.49, 'accepted small gap remains visible');
  assert.equal(rows[1]!.receivedSustain[1]!.end, null);
  assert.equal(rows[1]!.receivedSustain[1]!.incomplete, true);
  const extra = capture('hold', exercise); pair(extra, .3, 1.3);
  const extras = timingTimelines(complete(extra));
  assert.deepEqual(extras.map(r => r.received.length), [1, 0]);
  assert.deepEqual(extras.map(r => r.receivedSustain.length), [1, 1]);
  assert.ok(extras.every(r => r.receivedSustain[0]!.feedback === 'extra'));
  const over = capture('hold', exercise); pair(over, 0, 1.6);
  assert.equal(timingTimelines(complete(over))[1]!.receivedSustain[0]!.end, 1.6);
  const tail = capture('hold', exercise); pair(tail, 2.1, 2.2);
  const clipped = timingTimelines(complete(tail))[1]!;
  assert.equal(clipped.receivedSustain[0]!.start, 2.1); assert.equal(clipped.receivedSustain[0]!.end, 2.2);
  assert.equal(clipped.receivedSustain[0]!.x1, 100); assert.equal(clipped.received[0]!.extra, true);
});

test('both performance settings cover every preset and generated supported meter/length', () => {
  let seed = 45;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const exercises: Exercise[] = presets.map(p => ({ ...p, description: '' }));
  for (const meter of meters) for (const measures of [1, 2, 3, 4]) {
    exercises.push({ id: meter, label: '', description: '', measures: generateExercise({ ...defaultGeneration(), meters: [meter], measures, ties: true, syncopation: true, allowUnintuitiveNotation: true, ingredients: ingredients.map(i => i.id) }, random) });
  }
  for (const exercise of exercises) for (const style of ['tap', 'hold'] as const) {
    const c = capture(style, exercise);
    c.plan.notes.forEach(n => pair(c, n.start, style === 'tap' ? n.start + .01 : n.end));
    assert.equal(evaluateAttempt(complete(c)).acceptable, true, `${exercise.id} ${style}`);
  }
});
