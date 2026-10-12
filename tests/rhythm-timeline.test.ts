import { legacyAssessmentPolicy } from '../src/apps/rhythm-walk/assessment-policy.ts';
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

test('early barline sustain starts at its matched marker, with no stray preceding segment', () => {
  for (const correction of [0, .113]) {
    const capture = new Capture(quarters, 80, true, undefined, correction ? { version: 1, seconds: correction, input: 'keyboard', method: 'tap', samples: 12, spread: 0 } : undefined, 'hold');
    capture.input('down', 'keyboard', 3 - .021 + correction, 0);
    capture.input('up', 'keyboard', 3.75 - .04 + correction, 0);
    const record = capture.advance(capture.plan.captureEnd)!;
    const rows = timingTimelines(record);
    assert.equal(rows[0]!.receivedSustain.length, 0);
    assert.equal(rows[1]!.receivedSustain.length, 1);
    const segment = rows[1]!.receivedSustain[0]!;
    assert.equal(segment.x1, rows[1]!.received[0]!.x);
    assert.equal(segment.continuesBefore, false, 'this segment contains the actual attack');
    assert.ok(Math.abs(segment.end! - segment.start - .731) < 1e-9);
    assert.ok(segment.x1 < 16, 'early timing remains visible before the expected attack');
    assert.equal(record.events[0]!.time, 3 - .021 + correction);
  }
});

test('an early barline attack anchors a tied or incomplete hold while later continuations still split', () => {
  for (const release of [2.99, null]) {
    const capture = new Capture({ id: 'barline-chain', label: '', description: '', measures: [
      { meter: [2, 4], events: [['H', { rest: true }]] },
      { meter: [2, 4], events: [['H', { tieNext: true }]] },
      { meter: [2, 4], events: [['H']] },
    ] }, 120, false, undefined, undefined, 'hold');
    capture.input('down', 'keyboard', .99, 0);
    if (release !== null) capture.input('up', 'keyboard', release, 0);
    const rows = timingTimelines(capture.advance(capture.plan.captureEnd)!);
    assert.deepEqual(rows.map(row => row.received.length), [0, 1, 0]);
    assert.deepEqual(rows.map(row => row.receivedSustain.length), [0, 1, 1]);
    assert.equal(rows[1]!.receivedSustain[0]!.x1, rows[1]!.received[0]!.x);
    assert.equal(rows[2]!.receivedSustain[0]!.continuesBefore, true);
    assert.equal(rows[2]!.receivedSustain[0]!.incomplete, release === null);
    assert.equal(rows[2]!.receivedSustain[0]!.end, release);
  }
});

test('expected lift windows use the saved policy and leave actual intervals intact', () => {
  const capture=new Capture(quarters,80,false,undefined,undefined,'hold');
  capture.plan.notes.forEach(note=>{capture.input('down','keyboard',note.start,0);capture.input('up','keyboard',note.end-.18,0);});
  const record=capture.advance(capture.plan.captureEnd)!;
  const rows=timingTimelines({...record,assessmentPolicy:legacyAssessmentPolicy}), windows=rows.flatMap(row=>row.expectedSustain.flatMap(s=>s.releaseWindow?[s.releaseWindow]:[]));
  assert.equal(windows.length,7);assert.ok(Math.abs(windows[0]!.start-.57)<1e-9);assert.equal(windows[0]!.end,.75);
  assert.ok(rows[0]!.expectedSustain.at(-1)!.releaseWindow,'separate note across barline allows lift on preceding bar');
  assert.equal(rows[1]!.expectedSustain.at(-1)!.releaseWindow,undefined,'last note has no adjacent-note lift band');
  assert.ok(Math.abs(rows[0]!.receivedSustain[0]!.end!-.57)<1e-9);assert.equal(rows[0]!.expectedSustain[0]!.end,.75);
  assert.ok(rows.flatMap(row=>row.receivedSustain).every(s=>!s.releaseWindow));
  const legacy={...record,assessmentPolicy:legacyAssessmentPolicy,evaluationPolicy:{...record.evaluationPolicy!,articulationRatio:.15,articulationCeiling:.08}};
  assert.ok(Math.abs(timingTimelines(legacy)[0]!.expectedSustain[0]!.releaseWindow!.start-.67)<1e-9);
  assert.deepEqual(timingTimelines({...legacy,evaluationPolicy:undefined}),timingTimelines(legacy));
});

test('lift bands never break internal ties or precede rests, and Tap has none', () => {
  const music={id:'lift-ties',label:'',description:'',measures:[
    {meter:[2,4] as const,events:[['H',{tieNext:true}]] as const},
    {meter:[2,4] as const,events:[['Q'],['Q']] as const},
    {meter:[2,4] as const,events:[['Q',{rest:true}],['Q']] as const},
  ]};
  const hold=new Capture(music,120,false,undefined,undefined,'hold');const rows=timingTimelines({...hold.advance(hold.plan.captureEnd)!,assessmentPolicy:legacyAssessmentPolicy});
  assert.equal(rows[0]!.expectedSustain[0]!.releaseWindow,undefined,'internal tied barline continuous');
  assert.ok(rows[1]!.expectedSustain[0]!.releaseWindow,'chain end before separate note permits lift');
  assert.equal(rows[1]!.expectedSustain[1]!.releaseWindow,undefined,'before rest uses ordinary release');
  const tap=new Capture(music,120,false);assert.ok(timingTimelines(tap.advance(tap.plan.captureEnd)!).every(row=>!row.expectedSustain.length));
});

test('a long tied chain ending in a short eighth never gets a lift band at an internal tie boundary', () => {
  const capture=new Capture({id:'short-tie-end',label:'',description:'',measures:[
    {meter:[6,8],events:[['Q',{tieNext:true}],['E'],['Q',{dots:1}]]},
  ]},180,false,undefined,undefined,'hold');
  const record=capture.advance(capture.plan.captureEnd)!;
  const note=record.plan.notes[0]!;assert.ok(Math.abs(note.finalSegmentDuration!-1/9)<1e-9);
  const band=timingTimelines({...record,assessmentPolicy:legacyAssessmentPolicy})[0]!.expectedSustain[0]!.releaseWindow!;
  assert.ok(Math.abs(band.start-11/36)<1e-9);assert.ok(band.start>2/9,'last tied eighth has a solid sustain section');
});

test('v2 accepted timing stays at received positions without target lift promises or warnings',()=>{
  const c=new Capture(quarters,120,false,undefined,undefined,'hold');
  c.plan.notes.forEach((n,i)=>{c.input('down','keyboard',n.start+.08,0);c.input('up','keyboard',n.start+.08+(i===7?.4:.35),0);});
  const rows=timingTimelines(c.advance(c.plan.captureEnd)!);
  assert.ok(rows.flatMap(r=>r.expectedSustain).every(s=>!s.releaseWindow));
  assert.ok(rows.flatMap(r=>r.receivedSustain).every(s=>s.feedback==='accepted'));
  assert.ok(rows.flatMap(r=>r.received).every(h=>!h.attention && !h.extra));
  assert.equal(rows[0]!.received[0]!.time,.08);assert.equal(rows[0]!.receivedSustain[0]!.end,.43);
});
