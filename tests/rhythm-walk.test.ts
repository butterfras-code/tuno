import test from 'node:test';
import assert from 'node:assert/strict';
import { exercises } from '../src/apps/rhythm-walk/fixtures.ts';
import { musicalSeconds, planPassage, inputAudioTime } from '../src/apps/rhythm-walk/timing.ts';
import type { RhythmMeasure } from '../src/music/measure.ts';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';
function capture(id = 'mixed', bpm = 80) { return new Capture(exercises.find(e => e.id === id)!, bpm, true); }
function input(c: Capture, action: 'down' | 'up', time: number, source = 'keyboard', repeat = false) { c.input(action, source, time, 10000 + time * 1000, repeat); }
function finish(c: Capture) { return c.advance(c.plan.captureEnd)!; }
function play(c: Capture, skip = -1) { c.plan.notes.forEach((n, i) => { if (i !== skip) { input(c, 'down', n.start); input(c, 'up', n.end); } }); }
test('exact musical time converts only at scheduling boundary at different tempos and pulses', () => {
  assert.equal(musicalSeconds([1, 8], 80), .375);
  assert.equal(musicalSeconds([1, 3], 120), 2 / 3);
  assert.equal(musicalSeconds([1, 1], 60), 4);
  assert.equal(musicalSeconds([1, 1], 120), 2);
  assert.equal(musicalSeconds([3, 8], 80, [3, 8]), .75);
  const compound = planPassage([{ meter: [6, 8], groups: [1, 1, 1, 1, 1, 1], events: [['H', { dots: 1 }]] }], 80, undefined, [3, 8]);
  assert.equal(compound.pulses.filter(p => !p.countIn).length, 2);
  assert.equal(compound.duration, 1.5);
  assert.equal(inputAudioTime(1100, { performanceMs: 1000, audioSeconds: 5 }), 5.1);
  assert.throws(() => musicalSeconds([1, 4], 0));
});
test('all curated two-bar fixtures fill exactly, with quarter pulses derived from bars', () => {
  exercises.forEach(e => { assert.equal(e.measures.length, 2); const p = planPassage(e.measures, 80); assert.equal(p.duration, 6); assert.equal(p.countIn, 3); assert.equal(p.pulses.length, 12); });
});
test('barline tie has a single attack and combined release with both written sources', () => {
  const c = capture('tie'); const n = c.plan.notes[1]!;
  assert.equal(n.start, 2.25); assert.equal(n.end, 3.75);
  assert.deepEqual(n.sources, [{ measure: 0, event: 2 }, { measure: 1, event: 0 }]);
  play(c); const r = evaluateAttempt(finish(c));
  assert.equal(r.matches.length, 3); assert.equal(r.extra.length, 0); assert.equal(r.restOverlaps.length, 0);
  assert.ok(r.matches.every(m => m.onsetOffset === 0 && m.releaseOffset === 0));
});
test('correct performances and identical recorded evidence give identical evaluations', () => {
  const c = capture(); play(c); const record = finish(c); const r = evaluateAttempt(record);
  assert.equal(r.matches.length, c.plan.notes.length); assert.deepEqual(r.missing, []); assert.deepEqual(r.extra, []); assert.deepEqual(r.restOverlaps, []);
  assert.deepEqual(r, evaluateAttempt(structuredClone(record)));
});
test('bounded matching recovers after missing and extra attacks, independent of release', () => {
  const c = capture('quarters');
  c.plan.notes.forEach((n, i) => {
    if (i === 1) { input(c, 'down', n.start + .3); input(c, 'up', n.start + .4); return; }
    input(c, 'down', n.start); input(c, 'up', n.end - .1);
  });
  const r = evaluateAttempt(finish(c)); assert.deepEqual(r.missing, [1]); assert.equal(r.extra.length, 1);
  assert.deepEqual(r.matches.map(m => m.expected), [0, 2, 3, 4, 5, 6, 7]);
  assert.ok(r.matches.every(m => Math.abs(m.releaseOffset! + .1) < 1e-9));
});
test('early/late onsets and releases, missing release, and rest overlap retain separate evidence', () => {
  const c = capture(); input(c, 'down', .05); input(c, 'up', 1.6); // half ends 1.5
  input(c, 'down', 2.2); input(c, 'up', 2.55); // eighth starts 2.25, ends 2.625
  input(c, 'down', 3); input(c, 'up', 4.1); // overlaps quarter rest from 3.75
  input(c, 'down', 5.25); // final quarter never released
  const r = evaluateAttempt(finish(c));
  assert.equal(r.matches[0]!.onsetOffset, .05); assert.ok(Math.abs(r.matches[0]!.releaseOffset! - .1) < 1e-9);
  assert.ok(r.matches.some(m => m.onsetOffset < 0 && m.releaseOffset! < 0));
  assert.equal(r.restOverlaps.length, 1); assert.equal(r.restOverlaps[0]!.start, 3.75); assert.equal(r.restOverlaps[0]!.end, 4.1);
  assert.equal(r.matches.at(-1)!.releaseOffset, null);
});
test('one-to-one matching cannot reuse a press; bounded policy rejects distant presses', () => {
  const c = capture('quarters'); input(c, 'down', .4); input(c, 'up', .5); input(c, 'down', .75); input(c, 'up', 1.5);
  const r = evaluateAttempt(finish(c)); assert.equal(r.matches.length, 1); assert.equal(r.matches[0]!.expected, 1); assert.equal(r.extra.length, 1);
});
test('count-in holds are separate, no synthetic onset across start, release then repress recovers', () => {
  const c = capture('quarters'); input(c, 'down', -1); input(c, 'down', 0, 'keyboard', true); input(c, 'up', .2); input(c, 'down', .75); input(c, 'up', 1.5);
  const record = finish(c); const r = evaluateAttempt(record);
  assert.equal(record.events[0]!.region, 'count-in'); assert.equal(record.events[1]!.accepted, false);
  assert.ok(r.missing.includes(0)); assert.equal(r.extra.length, 0); assert.equal(r.matches[0]!.expected, 1);
});
test('capture bounds, final late release, and unreleased input complete within finite tail', () => {
  const c = capture('quarters'); input(c, 'down', 5.25); assert.equal(c.advance(6), null); input(c, 'up', 6.5);
  const r = evaluateAttempt(finish(c)); assert.equal(r.matches[0]!.releaseOffset, .5);
  const stuck = capture('quarters'); input(stuck, 'down', 5.25); assert.equal(finish(stuck).status, 'completed');
  assert.equal(evaluateAttempt(finish(stuck)).matches[0]!.releaseOffset, null);
  const boundary = capture(); input(boundary, 'down', -boundary.plan.countIn - .01); input(boundary, 'down', -boundary.plan.countIn); input(boundary, 'up', -.1); input(boundary, 'down', 0); input(boundary, 'up', 1.5); input(boundary, 'down', boundary.plan.captureEnd - .01); input(boundary, 'up', boundary.plan.captureEnd);
  const record = finish(boundary); assert.equal(record.events[0]!.accepted, false); assert.equal(record.events[1]!.accepted, true);
  assert.equal(evaluateAttempt(record).extra.length, 1); assert.equal(record.events.at(-1)!.action, 'down');
});
test('repeat/duplicate/multiple pointers cannot end another source hold', () => {
  const c = capture('quarters'); input(c, 'down', 0); input(c, 'down', .01, 'keyboard', true); input(c, 'down', .02); input(c, 'down', .03, 'pointer:1'); input(c, 'up', .04, 'pointer:1'); input(c, 'up', .75);
  const record = finish(c); assert.equal(record.events.filter(e => e.accepted).length, 2); assert.equal(evaluateAttempt(record).matches[0]!.releaseOffset, 0);
  const pointers = capture(); input(pointers, 'down', 0, 'pointer:1'); input(pointers, 'down', .1, 'pointer:2'); input(pointers, 'up', .2, 'pointer:2'); input(pointers, 'up', 1.5, 'pointer:1');
  assert.equal(evaluateAttempt(finish(pointers)).matches[0]!.releaseOffset, 0);
});
test('cancel, focus loss, background, audio suspension and pointer cancellation interrupt without grading', () => {
  for (const reason of ['Stopped by learner', 'Performance pad lost focus', 'Page backgrounded', 'Audio clock interrupted', 'Pointer cancelled']) {
    const c = capture(); input(c, 'down', 0); const record = c.interrupt(reason, .2); const r = evaluateAttempt(record);
    assert.equal(r.status, 'interrupted'); assert.deepEqual(r.matches, []); assert.equal(record.events.length, 1); assert.equal(record.reason, reason); assert.equal(c.phase(.2), 'interrupted');
  }
});
test('snapshot settings and written exercise survive outside mutation', () => {
  const e = structuredClone(exercises[0]!); const policy = { attackWindow: .18, releaseGrace: .75, leadIn: .12 }; const c = new Capture(e, 80, false, policy);
  policy.attackWindow = 2; (e.measures as unknown[]).pop(); assert.equal(c.plan.duration, 6); assert.equal(c.policy.attackWindow, .18);
  const record = finish(c); assert.equal(record.metronome, false); assert.equal(c.interrupt('later focus loss', 9).status, 'completed');
});
test('a press within a written rest is extra and overlaps silence; count-in holds also overlap initial rests', () => {
  const c = capture(); input(c, 'down', 3.9); input(c, 'up', 4.1);
  const r = evaluateAttempt(finish(c)); assert.equal(r.extra.length, 1); assert.equal(r.restOverlaps.length, 1);
  const initialRest = new Capture({ id: 'rest-first', label: 'Rest first', description: '', measures: [
    { meter: [4, 4], events: [['Q', { rest: true }], ['H'], ['Q']] },
    { meter: [4, 4], events: [['H'], ['H']] },
  ] }, 80, false);
  input(initialRest, 'down', -.2); input(initialRest, 'up', .3);
  const held = evaluateAttempt(finish(initialRest)); assert.equal(held.matches.length, 0); assert.equal(held.extra.length, 0);
  assert.equal(held.restOverlaps[0]!.start, 0); assert.equal(held.restOverlaps[0]!.end, .3);
});

test('count-in uses complete bars with at least four performance beats, preserving exercise timing', () => {
  const cases: { measure: RhythmMeasure; pulse: [number, number]; beats: number[]; seconds: number; accents: number[] }[] = [
    { measure: { meter: [2, 4], events: [['H']] }, pulse: [1, 4], beats: [1, 2, 1, 2], seconds: 2, accents: [0, 2] },
    { measure: { meter: [3, 4], events: [['H', { dots: 1 }]] }, pulse: [1, 4], beats: [1, 2, 3, 1, 2, 3], seconds: 3, accents: [0, 3] },
    { measure: { meter: [4, 4], events: [['W']] }, pulse: [1, 4], beats: [1, 2, 3, 4], seconds: 2, accents: [0] },
    { measure: { meter: [6, 8], events: [['H', { dots: 1 }]] }, pulse: [3, 8], beats: [1, 2, 1, 2], seconds: 2, accents: [0, 2] },
  ];
  for (const { measure, pulse, beats, seconds, accents } of cases) {
    const plan = planPassage([measure], 120, undefined, pulse);
    const clicks = plan.pulses.filter(p => p.countIn);
    assert.equal(plan.countIn, seconds);
    assert.deepEqual(clicks.map(p => p.beat), beats);
    assert.deepEqual(clicks.map(p => p.time), beats.map((_, i) => -seconds + i * .5));
    assert.deepEqual(clicks.flatMap((p, i) => p.downbeat ? [i] : []), accents);
    assert.equal(plan.notes[0]!.start, 0);
    assert.equal(plan.notes[0]!.end, plan.duration);
    assert.equal(plan.pulses.find(p => !p.countIn)!.time, 0);
  }
});
