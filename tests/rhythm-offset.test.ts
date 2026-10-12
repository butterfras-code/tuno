import test from 'node:test';
import assert from 'node:assert/strict';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { exercises } from '../src/apps/rhythm-walk/fixtures.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';
import { estimateOffset, estimateTapOffset, readOffset } from '../src/apps/rhythm-walk/offset.ts';
import type { TimingOffset } from '../src/apps/rhythm-walk/offset.ts';
const profile: TimingOffset = { version: 1, seconds: .25, input: 'keyboard', method: 'estimated', samples: 8, spread: .02 };
function performance(downs: number[], timing?: TimingOffset, source = 'keyboard') {
  const c = new Capture(exercises[0]!, 80, true, undefined, timing);
  downs.forEach(time => { c.input('down', source, time, 1000 + time * 1000); c.input('up', source, time + .65, 1650 + time * 1000); });
  return c.advance(c.plan.captureEnd)!;
}
test('screenshot pattern estimates a quarter-second offset and recovers all eight attacks', () => {
  const record = performance([.287, .999, 1.754, 2.525, 3.271, 4, 4.696, 5.476]);
  const before = structuredClone(record), estimated = estimateOffset(record);
  assert.equal(estimated.ok, true); if (!estimated.ok) return;
  assert.ok(Math.abs(estimated.offset.seconds - .252) < .005);
  assert.equal(evaluateAttempt(record).matches.length, 0);
  const normalized = evaluateAttempt(record, estimated.offset);
  assert.equal(normalized.matches.length, 8); assert.equal(normalized.extra.length, 0);
  assert.deepEqual(record, before, 'raw evidence stays unchanged');
  assert.deepEqual(estimateOffset(record), estimated, 'deterministic evidence');
});
test('saved offset applies equally to both edges and does not normalize the next attempt again', () => {
  const record = performance(Array.from({ length: 8 }, (_, i) => i * .75 + .3), profile);
  const normalized = evaluateAttempt(record);
  assert.ok(normalized.matches.every(m => Math.abs(m.onsetOffset - .05) < 1e-9));
  assert.ok(normalized.matches.every(m => Math.abs(m.releaseOffset! + .05) < 1e-9));
  assert.equal(evaluateAttempt(record, null).matches.length, 0);
  assert.equal(record.timingOffset?.seconds, .25);
  assert.ok(Math.abs((normalized.holds[0]!.up! - normalized.holds[0]!.down) - .65) < 1e-9);
  const otherInput = performance(Array.from({ length: 8 }, (_, i) => i * .75 + .3), profile, 'pointer:1');
  assert.equal(evaluateAttempt(otherInput).matches.length, 0, 'keyboard correction never applied to touch');
});
test('sparse, drifting, inconsistent, interrupted and ambiguous evidence cannot set automatic timing', () => {
  assert.equal(estimateOffset(performance([.25, 1, 1.75])).ok, false);
  assert.equal(estimateOffset(performance(Array.from({ length: 8 }, (_, i) => i * .75 + i * .025))).ok, false);
  assert.equal(estimateOffset(performance([0, .9, 1.4, 2.6, 3.2, 3.7, 4.9, 5.15])).ok, false);
  const interrupted = new Capture(exercises[0]!, 80, false).interrupt('Stopped', 1);
  assert.equal(estimateOffset(interrupted).ok, false);
  const dense = { ...exercises[0]!, measures: Array.from({ length: 2 }, () => ({ meter: [4, 4] as const, events: Array.from({ length: 8 }, () => ['E'] as const) })) };
  const c = new Capture(dense, 80, true);
  c.plan.notes.forEach(n => { c.input('down', 'keyboard', n.start + .25, 0); c.input('up', 'keyboard', n.start + .3, 0); });
  const ambiguous = estimateOffset(c.advance(c.plan.captureEnd)!);
  assert.equal(ambiguous.ok, false); if (!ambiguous.ok) assert.match(ambiguous.reason, /More than one/);
});
test('negative correction admits early first attacks without inventing attacks for early count-in holds', () => {
  const negative = { ...profile, seconds: -.2 };
  const record = performance(Array.from({ length: 8 }, (_, i) => i * .75 - .2), negative);
  assert.equal(evaluateAttempt(record).matches.length, 8);
  const c = new Capture(exercises[0]!, 80, true, undefined, profile);
  c.input('down', 'keyboard', -1, 0); c.input('up', 'keyboard', .5, 1);
  assert.equal(evaluateAttempt(c.advance(c.plan.captureEnd)!).matches.length, 0);
});
test('corrected releases and rest overlaps use the same fixed offset; capture leaves room for it', () => {
  const c = new Capture(exercises[1]!, 80, true, undefined, profile);
  const endingBeforeRest = c.plan.notes.find(n => n.end === 3.75)!;
  c.input('down', 'keyboard', endingBeforeRest.start + .25, 0); c.input('up', 'keyboard', endingBeforeRest.end + .25, 1);
  c.input('down', 'keyboard', 5.5, 2); c.input('up', 'keyboard', 6.85, 3);
  assert.equal(c.advance(6.9), null);
  assert.equal(c.plan.captureEnd, 10);
  const record = c.advance(c.plan.captureEnd)!;
  assert.equal(evaluateAttempt(record).restOverlaps.length, 0);
  assert.ok(evaluateAttempt(record, null).restOverlaps.length > 0);
  assert.ok(Math.abs(evaluateAttempt(record).matches.at(-1)!.releaseOffset! - .6) < 1e-9);
});
test('manual taps ignore warmup, reject duplicates/misses/noise, and support signed offsets', () => {
  for (const shift of [.25, -.15]) {
    const taps = Array.from({ length: 16 }, (_, i) => i * .75 + shift + (i % 2 ? .01 : -.01));
    const result = estimateTapOffset(taps, 'pointer');
    assert.equal(result.ok, true); if (result.ok) { assert.ok(Math.abs(result.offset.seconds - shift) < 1e-9); assert.equal(result.offset.samples, 12); }
  }
  assert.equal(estimateTapOffset([3.25, 4], 'keyboard').ok, false);
  const duplicates = Array.from({ length: 16 }, (_, i) => [i * .75, i * .75 + .1]).flat();
  assert.equal(estimateTapOffset(duplicates, 'keyboard').ok, false);
  assert.equal(estimateTapOffset(Array.from({ length: 16 }, (_, i) => i * .75 + (i % 2 ? .2 : -.2)), 'keyboard').ok, false);
});
test('session profiles are validated and captured by value', () => {
  assert.deepEqual(readOffset(JSON.stringify(profile)), profile);
  for (const value of [null, 'bad', '{}', JSON.stringify({ ...profile, seconds: 9 }), JSON.stringify({ ...profile, samples: 0 })]) assert.equal(readOffset(value), undefined);
  const mutable = { ...profile }; const c = new Capture(exercises[0]!, 80, true, undefined, mutable); mutable.seconds = .1;
  assert.equal(c.advance(c.plan.captureEnd)!.timingOffset?.seconds, .25);
});
