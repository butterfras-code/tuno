import test from 'node:test';
import assert from 'node:assert/strict';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { exercises } from '../src/apps/rhythm-walk/fixtures.ts';
import { timingTimelines } from '../src/apps/rhythm-walk/timeline.ts';

const quarters = exercises.find(e => e.id === 'quarters')!;
test('timeline attacks align to the score and corrected timing, without changing raw evidence', () => {
  const capture = new Capture(quarters, 80, true);
  for (const note of capture.plan.notes) {
    capture.input('down', 'keyboard', note.start + .1, 0);
    capture.input('up', 'keyboard', note.end - .1, 0);
  }
  const raw = capture.advance(capture.plan.captureEnd)!;
  const record = { ...raw, timingOffset: { version: 1 as const, seconds: .1, input: 'keyboard' as const, method: 'tap' as const, samples: 12, spread: 0 } };
  // Use the stored session correction shape from Capture's public contract.
  const rows = timingTimelines(record);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0]!.expected.map(h => h.x), [16, 38, 60, 82]);
  rows.forEach(row => row.received.forEach((hit, i) => assert.ok(Math.abs(hit.x - row.expected[i]!.x) < 1e-8)));
  assert.equal(raw.events[0]!.time, .1);
});
test('ties have one expected attack, missing and extra hits remain visible, interruptions have no graded timeline', () => {
  const capture = new Capture(exercises.find(e => e.id === 'tie')!, 80, true);
  capture.input('down', 'keyboard', .4, 0); capture.input('up', 'keyboard', .5, 0);
  const rows = timingTimelines(capture.advance(capture.plan.captureEnd)!);
  assert.equal(rows.flatMap(r => r.expected).length, 3);
  assert.ok(rows.flatMap(r => r.expected).every(h => h.missing));
  assert.equal(rows[0]!.received[0]!.extra, true);
  assert.deepEqual(timingTimelines(new Capture(quarters, 80, true).interrupt('cancelled', 0)), []);
});
test('6/8 timelines use dotted-quarter seconds while retaining eighth-note positions', () => {
  const capture = new Capture({ id: 'six', label: 'six', description: 'six eighth notes', measures: [{ meter: [6, 8], groups: [3, 3], events: Array.from({ length: 6 }, () => ['E'] as const) }] }, 80, true);
  capture.plan.notes.forEach(note => { capture.input('down', 'keyboard', note.start, 0); capture.input('up', 'keyboard', note.end - .01, 0); });
  const row = timingTimelines(capture.advance(capture.plan.captureEnd)!)[0]!;
  assert.equal(capture.plan.duration, 1.5);
  assert.equal(row.expected.length, 6);
  row.received.forEach((hit, i) => assert.ok(Math.abs(hit.x - row.expected[i]!.x) < 1e-8));
});

test('slightly early measure-start attacks retain the same displacement as other attacks across the engraving gap', () => {
  const capture = new Capture(quarters, 80, true);
  const early = .021;
  capture.plan.notes.forEach(note => {
    capture.input('down', 'keyboard', note.start - early, 0);
    capture.input('up', 'keyboard', note.end - .1, 0);
  });
  const record = capture.advance(capture.plan.captureEnd)!;
  const rows = timingTimelines(record);
  // The first uncorrected count-in press stays separate, but measure 2's first
  // attack belongs beside its expected hit, rather than at the end of measure 1.
  assert.equal(rows[0]!.received.length, 3);
  assert.equal(rows[1]!.received.length, 4);
  assert.ok(Math.abs(rows[1]!.received[0]!.x - (16 - early * 88 / 3)) < 1e-8);
  const displacement = rows[1]!.received[0]!.x - rows[1]!.expected[0]!.x;
  rows[1]!.received.forEach((hit, i) => assert.ok(Math.abs(hit.x - rows[1]!.expected[i]!.x - displacement) < 1e-8));
});

test('calibrated early barline attacks and nearby unmatched attacks remain distinct and visible', () => {
  const capture = new Capture(quarters, 80, true);
  capture.plan.notes.forEach(note => {
    capture.input('down', 'keyboard', note.start + .113 - .021, 0);
    capture.input('up', 'keyboard', note.end - .1, 0);
  });
  const raw = capture.advance(capture.plan.captureEnd)!;
  for (const method of ['tap', 'estimated'] as const) {
    const record = { ...raw, timingOffset: { version: 1 as const, seconds: .113, input: 'keyboard' as const, method, samples: 12, spread: 0 } };
    const rows = timingTimelines(record);
    assert.equal(rows[0]!.received.length, 4);
    assert.equal(rows[1]!.received.length, 4);
    const displacements = rows.flatMap(row => row.received.map((hit, i) => hit.x - row.expected[i]!.x));
    assert.ok(displacements.every(delta => Math.abs(delta + .021 * 88 / 3) < 1e-8));
    assert.equal(raw.events[0]!.time, .092);
  }
  const extra = new Capture(quarters, 80, true);
  extra.input('down', 'keyboard', 2.6, 0); extra.input('up', 'keyboard', 2.65, 0);
  extra.input('down', 'keyboard', 2.979, 0); extra.input('up', 'keyboard', 3.1, 0);
  const rows = timingTimelines(extra.advance(extra.plan.captureEnd)!);
  assert.equal(rows[0]!.received.length, 1);
  assert.equal(rows[0]!.received[0]!.extra, true);
  assert.equal(rows[1]!.received.length, 1);
  assert.equal(rows[1]!.received[0]!.extra, false);
});
