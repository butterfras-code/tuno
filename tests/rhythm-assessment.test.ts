import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import type { AttemptRecord } from '../src/apps/rhythm-walk/capture.ts';
import type { RhythmMeasure } from '../src/music/measure.ts';
import { assessAttempt, attackCredit, attackWindows } from '../src/apps/rhythm-walk/assessment.ts';
import { assessmentPolicy } from '../src/apps/rhythm-walk/assessment-policy.ts';
import { tempoDescription, steadinessDescription } from '../src/apps/rhythm-walk/results.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';
import { presets } from '../src/apps/rhythm-walk/activity.ts';
import { defaultGeneration, generateExercise, ingredients } from '../src/apps/rhythm-walk/shared/generation.ts';
import { meters } from '../src/apps/rhythm-walk/shared/meter.ts';

const quarters: RhythmMeasure[] = Array.from({ length: 2 }, () => ({ meter: [4, 4], events: [['Q'], ['Q'], ['Q'], ['Q']] }));
// Independent observed times; not produced by the scoring implementation.
function attempt(times: number[], measures = quarters, options: { style?: 'tap' | 'hold'; releases?: (number | null)[]; offset?: number; source?: string; bpm?: number } = {}): AttemptRecord {
  const c = new Capture({ id: 'fixture', label: '', description: '', measures }, options.bpm ?? 120, false, undefined, options.offset === undefined ? undefined : { version: 1, input: 'keyboard', seconds: options.offset, method: 'tap', samples: 12, spread: 0 }, options.style ?? 'tap');
  // Captured fixtures retain raw tails, including beyond current transport end,
  // so analytical fit tests do not depend on transport scheduling.
  const events = times.flatMap((time, i) => {
    const up = options.releases?.[i] ?? (options.releases?.[i] === null ? null : time + .01);
    const event = (action: 'down' | 'up', t: number) => ({ action, source: options.source ?? 'keyboard', time: t, timestampMs: t * 1000, region: 'exercise' as const, accepted: true });
    return up === null ? [event('down', time)] : [event('down', time), event('up', up)];
  });
  return { ...c.advance(c.plan.captureEnd)!, events };
}
const near = (actual: number | null, expected: number, tolerance = 1e-7) => assert.ok(actual !== null && Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('exact, steady slower/faster patterns and drift beyond target matching window', () => {
  for (const [times, bpm, difference] of [
    [[0,.5,1,1.5,2,2.5,3,3.5],120,0],
    [[0,.7,1.4,2.1,2.8,3.5,4.2,4.9],120/1.4,100*(1/1.4-1)],
    [[0,.4,.8,1.2,1.6,2,2.4,2.8],150,25],
  ] as const) {
    const record = attempt([...times]); const a = assessAttempt(record);
    near(a.rhythm,100); near(a.tempo!.bpm,bpm); near(a.tempo!.differencePercent,difference); near(a.steadiness,0);
    assert.equal(a.basis,'performed'); assert.equal(a.matchedNotes,8);
    if (bpm !== 120) assert.ok(evaluateAttempt(record).matches.length < 8);
  }
});

test('unequal durations, rests, compound pulse and barline ties share musical positions', () => {
  const mixed: RhythmMeasure[] = [{ meter:[4,4], events:[['H'],['E',{rest:true}],['E'],['Q']] },{ meter:[4,4], events:[['Q'],['Q',{rest:true}],['Q'],['Q']] }];
  const a = assessAttempt(attempt([0,1.5,1.8,2.4,3.6,4.2],mixed));
  near(a.rhythm,100); near(a.tempo!.bpm,100); near(a.steadiness,0);
  const six: RhythmMeasure[] = Array.from({length:3},()=>({meter:[6,8],events:[['Q',{dots:1}],['Q',{dots:1}]]}));
  const compound = assessAttempt(attempt([0,.6,1.2,1.8,2.4,3],six));
  near(compound.tempo!.bpm,100); near(compound.rhythm,100);
  const tied: RhythmMeasure[] = [{meter:[2,4],events:[['H',{tieNext:true}]]},{meter:[2,4],events:[['Q'],['Q']]}];
  const good = assessAttempt(attempt([0,1.5],tied,{style:'hold', releases:[1.5,2]})); near(good.hold,100); assert.equal(good.matchedNotes,2);
  const broken = assessAttempt(attempt([0,1,1.5],tied,{style:'hold',releases:[.99,1.49,2]})); assert.equal(broken.extra,1); near(broken.hold,50);
});

test('missing/extra attacks do not cascade; rests incur only one extra penalty', () => {
  const missing = assessAttempt(attempt([0,.5,1,2,2.5,3,3.5])); near(missing.rhythm,87.5); assert.equal(Math.round(missing.rhythm!),88); assert.equal(missing.missing,1);
  const extra = assessAttempt(attempt([0,.5,1,1.25,1.5,2,2.5,3,3.5])); near(extra.rhythm,100*8/9); assert.equal(Math.round(extra.rhythm!),89); assert.equal(extra.extra,1); assert.equal(extra.usableIntervals,6);
  const rest: RhythmMeasure[] = [{meter:[4,4],events:[['Q'],['Q',{rest:true}],['Q'],['Q']]},{meter:[4,4],events:[['Q'],['Q'],['Q'],['Q']]}];
  const restExtra=assessAttempt(attempt([0,.6,1,1.5,2,2.5,3,3.5],rest)); near(restExtra.rhythm,87.5); assert.equal(restExtra.extra,1);
  const early=assessAttempt(attempt([0,.97,1.5,2,2.5,3,3.5],rest)); near(early.rhythm,100); assert.equal(early.extra,0);
});

test('alternating intervals and gradual pace change are not described as steady', () => {
  const uneven=assessAttempt(attempt([0,.6,1,1.6,2,2.6,3,3.6])); assert.ok(uneven.steadiness! > 10); assert.equal(steadinessDescription(uneven.steadiness!,uneven),'Uneven');
  for (const times of [[0,.6,1.18,1.74,2.28,2.8,3.3,3.78],[0,.42,.86,1.32,1.8,2.3,2.82,3.36]]) {
    const a=assessAttempt(attempt(times)); assert.ok(a.tempo); assert.ok(a.steadiness! > 5); assert.ok(a.rhythm! < 100);
  }
});

test('sparse, silent, all-missed, interrupted and ambiguous cases are explicit', () => {
  const sparse=assessAttempt(attempt([0,.5])); assert.equal(sparse.basis,'target'); near(sparse.rhythm,25); assert.equal(sparse.tempo,null);
  near(assessAttempt(attempt([])).rhythm,0);
  near(assessAttempt(attempt([20,21,22,23])).rhythm,0);
  const silent: RhythmMeasure[]=[{meter:[4,4],events:[['W',{rest:true}]]}]; const rest=assessAttempt(attempt([],silent)); assert.equal(rest.rhythm,null); assert.match(rest.reason!,/Rest exercise/);
  const interrupted=assessAttempt({...attempt([0,.5]),status:'interrupted'}); assert.equal(interrupted.rhythm,null);
  const ambiguous=assessAttempt(attempt([.125],[{meter:[2,4],events:[['E'],['E'],['Q']]}])); assert.equal(ambiguous.rhythm,null); assert.match(ambiguous.reason!,/associations/);
  const alternate=assessAttempt(attempt([0,1,2,3])); assert.ok(alternate.rhythm === null || alternate.rhythm <= 50); assert.ok(alternate.tempo === null || alternate.tempo.bpm !== 60);
});

test('hold allowances, short sustain, overholds and absent releases use equal note weights', () => {
  const two: RhythmMeasure[]=[{meter:[2,4],events:[['Q'],['Q']]}];
  near(assessAttempt(attempt([0,.5],two,{style:'hold',releases:[.425,1]})).hold,100);
  near(assessAttempt(attempt([0,.5],two,{style:'hold',releases:[.2,1]})).hold,50);
  near(assessAttempt(attempt([0,.5],two,{style:'hold',releases:[.6125,1]})).hold,75);
  near(assessAttempt(attempt([0,.5],two,{style:'hold',releases:[.675,null]})).hold,0);
  const short=assessAttempt(attempt([.06],two,{style:'hold',bpm:180,releases:[1/3-.05]})); assert.ok(short.hold! < 100);
  assert.equal(assessAttempt(attempt([],two,{style:'hold'})).hold,null);
  const missing=assessAttempt(attempt([0],two,{style:'hold',releases:[.5]})); near(missing.hold,100); near(missing.rhythm,50);
});

test('exact attack thresholds, clamping, tempo descriptions and steadiness boundaries', () => {
  assert.deepEqual(attackWindows(.1),{full:.03,zero:.09}); assert.deepEqual(attackWindows(2),{full:.06,zero:.18});
  for (const beat of [.1,.5,2]) { const {full,zero}=attackWindows(beat); near(attackCredit(full,beat),1); near(attackCredit(zero,beat),0); near(attackCredit((full+zero)/2,beat),.5); assert.ok(attackCredit(full+.00001,beat)<1); }
  const a=assessAttempt(attempt([0,.5,1,1.5,2,2.5,3,3.5]));
  assert.equal(tempoDescription(5,a),'On target'); assert.equal(tempoDescription(-5.001,a),'Slightly slower'); assert.equal(tempoDescription(10,a),'Slightly faster'); assert.equal(tempoDescription(10.001,a),'Faster');
  assert.equal(steadinessDescription(5,a),'Steady'); assert.equal(steadinessDescription(10,a),'Mostly steady'); assert.equal(steadinessDescription(10.001,a),'Uneven');
});

test('input-specific fixed calibration, policy snapshots and deterministic replay preserve duration', () => {
  const record=attempt([.12,.62,1.12,1.62,2.12,2.62,3.12,3.62],quarters,{offset:.12,style:'hold',releases:[.62,1.12,1.62,2.12,2.62,3.12,3.62,4.12]});
  const saved=structuredClone(record); const a=assessAttempt(record); near(a.rhythm,100); near(a.hold,100); assert.deepEqual(record,saved); assert.deepEqual(assessAttempt(JSON.parse(JSON.stringify(record))),a);
  const pointer=assessAttempt({...record,events:record.events.map(e=>({...e,source:'pointer:1'}))}); assert.notDeepEqual(pointer.matches,a.matches);
  const custom={...assessmentPolicy,fullMinimum:.04}; const c=new Capture({id:'policy',label:'',description:'',measures:quarters},120,false,undefined,undefined,'tap',undefined,custom); custom.fullMinimum=.08;
  const snapshot=c.advance(c.plan.captureEnd)!; assert.equal(snapshot.assessmentPolicy!.fullMinimum,.04);
  const raw=evaluateAttempt(record,null), corrected=evaluateAttempt(record); raw.holds.forEach((h,i)=>near(corrected.holds[i]!.up!-corrected.holds[i]!.down,h.up!-h.down));
});

test('every preset and generated supported meter/length uses the same assessment', () => {
  let seed=13; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const passages=presets.map(p=>p.measures);
  for (const meter of meters) for (const measures of [1,2,3,4]) passages.push(generateExercise({...defaultGeneration(),meters:[meter],measures,ties:true,syncopation:true,allowUnintuitiveNotation:true,ingredients:ingredients.map(i=>i.id)},random));
  for (const measures of passages) for (const style of ['tap','hold'] as const) {
    const c=new Capture({id:'coverage',label:'',description:'',measures},120,false,undefined,undefined,style);
    const a=assessAttempt(attempt(c.plan.notes.map(n=>n.start),[...measures],{style,releases:c.plan.notes.map(n=>style==='hold'?n.end:n.start+.01)}));
    if(c.plan.notes.length) { near(a.rhythm,100); if(style==='hold') near(a.hold,100); } else assert.equal(a.rhythm,null);
  }
});

test('bounded capture retains a complete slower attempt and stops at its exact end', () => {
  const c=new Capture({id:'slow-capture',label:'',description:'',measures:quarters},120,false);
  const downs=[0,.7,1.4,2.1,2.8,3.5,4.2,4.9];
  downs.forEach(t=>{c.input('down','keyboard',t,t*1000);c.input('up','keyboard',t+.01,(t+.01)*1000);});
  assert.equal(c.plan.captureEnd,6.75);assert.equal(c.advance(6.749),null);
  const record=c.advance(6.75)!;assert.equal(record.events.filter(e=>e.action==='down' && e.accepted).length,8);
  near(assessAttempt(record).rhythm,100);assert.equal(record.plan.duration,4);
});

test('tempo bounds and omitted alternating notes cannot become a perfect pattern', () => {
  for(const scale of [2/3,1.5]) {const a=assessAttempt(attempt([0,.5,1,1.5,2,2.5,3,3.5].map(t=>t*scale)));near(a.rhythm,100);near(a.tempo!.bpm,120/scale);}
  for(const times of [[0,1,2,3],[.5,1.5,2.5,3.5],[0,.25,.5,.75,1,1.25,1.5,1.75],[0,1,2,3,4,5,6,7]]) {
    const a=assessAttempt(attempt(times));assert.ok(a.rhythm===null || a.rhythm<100);assert.ok(a.tempo===null || a.tempo.bpm>=80 && a.tempo.bpm<=180);
  }
});

test('release credit and meaningful sustain have deterministic exact boundaries', () => {
  const two: RhythmMeasure[]=[{meter:[2,4],events:[['Q'],['Q']]}];
  for(const [release,score] of [[.425,100],[.55,100],[.675,50]] as const) near(assessAttempt(attempt([0,.5],two,{style:'hold',releases:[release,1]})).hold,score);
  const onset=.075, release=.425;
  near(assessAttempt(attempt([onset],two,{style:'hold',releases:[release]})).hold,100);
  const short=assessAttempt(attempt([onset+.001],two,{style:'hold',releases:[release]}));near(short.hold,100*.349/.35);assert.ok(short.hold!<100);
});

test('input volume bound withholds analysis while retaining all raw events', () => {
  const record=attempt(Array.from({length:257},(_,i)=>i*.01));const saved=structuredClone(record.events);
  const a=assessAttempt(record);assert.equal(a.rhythm,null);assert.match(a.reason!,/bounded assessment/);assert.deepEqual(record.events,saved);
});

test('minimum tempo and steadiness counts/spans are inclusive and independent', () => {
  const four=assessAttempt(attempt([0,.5,1,1.5]));assert.ok(four.tempo);assert.equal(four.steadiness,null);assert.equal(four.usableIntervals,3);
  const five=assessAttempt(attempt([0,.5,1,1.5,2]));assert.ok(five.tempo);near(five.steadiness,0);assert.equal(five.usableIntervals,4);near(five.intervalSpan,4);
  const eighths: RhythmMeasure[]=[{meter:[4,4],events:[['E'],['E'],['E'],['E'],['H']]}];
  const shortSpan=assessAttempt(attempt([0,.25,.5,.75],eighths));assert.equal(shortSpan.tempo,null);assert.equal(shortSpan.basis,'target');
  const three=assessAttempt(attempt([0,.5,1.5]));assert.equal(three.tempo,null);assert.equal(three.basis,'target');
});

test('v2 permits practical lifts while v1 snapshots replay unchanged', () => {
  const music: RhythmMeasure[]=[{meter:[4,4],events:[['Q'],['Q'],['Q'],['Q']]}];
  const record=attempt([0,.75,1.5,2.25],music,{bpm:80,style:'hold',releases:[.57,1.32,2.07,3]});
  const current=assessAttempt(record);near(current.hold,100);near(current.rhythm,100);assert.equal(record.evaluationPolicy!.version,2);
  const v1={...record,evaluationPolicy:{...record.evaluationPolicy!,version:1 as const,articulationRatio:.15,articulationCeiling:.08}};
  near(assessAttempt(v1).hold,60);
  const noVersion={...v1,evaluationPolicy:{...v1.evaluationPolicy,version:undefined}};near(assessAttempt(noVersion).hold,60);
  near(assessAttempt({...v1,evaluationPolicy:undefined}).hold,60);
  assert.deepEqual(assessAttempt(JSON.parse(JSON.stringify(v1))),assessAttempt(v1));
  // Same attacks and tempo: only release policy changes the hold percentage.
  assert.deepEqual(current.tempo,assessAttempt(v1).tempo);near(current.rhythm,assessAttempt(v1).rhythm!);
  const shorter=assessAttempt(attempt([0,.75,1.5,2.25],music,{bpm:80,style:'hold',releases:[.52,1.27,2.02,3]}));near(shorter.hold,80);
});

test('lift allowance exact boundary and small separate eighths retain real sustain', () => {
  const two: RhythmMeasure[]=[{meter:[2,4],events:[['Q'],['Q']]}];
  near(assessAttempt(attempt([0,.75],two,{bpm:80,style:'hold',releases:[.57,1.5]})).hold,100);
  near(assessAttempt(attempt([0,.75],two,{bpm:80,style:'hold',releases:[.569,1.5]})).hold,100*(1+(1-.001/.1875))/2);
  const eighths: RhythmMeasure[]=[{meter:[2,4],events:[['E'],['E'],['Q']]}];
  near(assessAttempt(attempt([0,.375,.75],eighths,{bpm:80,style:'hold',releases:[.28125,.65625,1.5]})).hold,100);
  const veryShort=assessAttempt(attempt([0,.375,.75],eighths,{bpm:80,style:'hold',releases:[.1,.475,1.5]}));near(veryShort.hold,100/3);
});

test('a lift cannot skip the final short member of a tied chain', () => {
  const music: RhythmMeasure[]=[{meter:[6,8],events:[['Q',{tieNext:true}],['E'],['Q',{dots:1}]]}];
  const continuous=assessAttempt(attempt([0,1/3],music,{bpm:180,style:'hold',releases:[11/36,2/3]}));near(continuous.hold,100);
  const truncated=assessAttempt(attempt([0,1/3],music,{bpm:180,style:'hold',releases:[2/9,2/3]}));near(truncated.hold,50);near(truncated.rhythm,100);
});
