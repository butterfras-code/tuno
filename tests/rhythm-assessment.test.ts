import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import type { AttemptRecord } from '../src/apps/rhythm-walk/capture.ts';
import type { RhythmMeasure } from '../src/music/measure.ts';
import { assessAttempt, attackCredit, attackWindows, sustainEvidence } from '../src/apps/rhythm-walk/assessment.ts';
import { assessmentPolicy, legacyAssessmentPolicy, legacyHoldPolicy } from '../src/apps/rhythm-walk/assessment-policy.ts';
import { tempoDescription, steadinessDescription, musicalFeedback } from '../src/apps/rhythm-walk/results.ts';
import { timingTimelines } from '../src/apps/rhythm-walk/timeline.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';
import { presets } from '../src/apps/rhythm-walk/activity.ts';
import { defaultGeneration, generateExercise, ingredients } from '../src/apps/rhythm-walk/shared/generation.ts';
import { meters } from '../src/apps/rhythm-walk/shared/meter.ts';

const quarters: RhythmMeasure[] = Array.from({ length: 2 }, () => ({ meter: [4, 4], events: [['Q'], ['Q'], ['Q'], ['Q']] }));
// Independent observed times; not produced by the scoring implementation.
function attempt(times: number[], measures = quarters, options: { style?: 'tap' | 'hold'; releases?: (number | null)[]; offset?: number; source?: string; bpm?: number; current?: boolean } = {}): AttemptRecord {
  const c = new Capture({ id: 'fixture', label: '', description: '', measures }, options.bpm ?? 120, false, undefined, options.offset === undefined ? undefined : { version: 1, input: 'keyboard', seconds: options.offset, method: 'tap', samples: 12, spread: 0 }, options.style ?? 'tap', undefined, options.current ? assessmentPolicy : legacyAssessmentPolicy);
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
  assert.equal(tempoDescription(7,a),'On target'); assert.equal(tempoDescription(-7.001,a),'Slightly slower'); assert.equal(tempoDescription(12,a),'Slightly faster'); assert.equal(tempoDescription(12.001,a),'Faster');
  assert.equal(steadinessDescription(7,a),'Steady'); assert.equal(steadinessDescription(12,a),'Mostly steady'); assert.equal(steadinessDescription(12.001,a),'Uneven');
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
    const a=assessAttempt(attempt(c.plan.notes.map(n=>n.start),[...measures],{style,current:true,releases:c.plan.notes.map(n=>style==='hold'?n.end:n.start+.01)}));
    if(c.plan.notes.length) { near(a.rhythm,100); if(style==='hold') { if(c.plan.notes.some(n=>n.end-n.start>=.4-1e-9)) near(a.hold,100); else assert.equal(a.hold,null); } } else assert.equal(a.rhythm,null);
  }
});

test('capture ends after a short allowance and grades unfinished slower attempts', () => {
  const c=new Capture({id:'slow-capture',label:'',description:'',measures:quarters},120,false);
  const downs=[0,.7,1.4,2.1,2.8,3.5,4.2];
  downs.forEach(t=>{c.input('down','keyboard',t,t*1000);c.input('up','keyboard',t+.01,(t+.01)*1000);});
  assert.equal(c.plan.captureEnd,4.3);assert.equal(c.advance(4.299),null);
  const record=c.advance(4.3)!;
  c.input('down','keyboard',4.9,4900);
  assert.equal(record.events.filter(e=>e.action==='down' && e.accepted).length,7);
  const a=assessAttempt(record);
  assert.equal(record.status,'completed');assert.equal(a.missing,1);assert.ok(a.rhythm!<100);
  assert.deepEqual(musicalFeedback(record,a),{summary:'You fell behind the beat.',suggestion:'Try a slower tempo.'});
});

test('capture keeps the full final hold or rest, independent of pace and passage length', () => {
  for (const style of ['tap','hold'] as const) for (const measures of [1,2,3,4]) for (const rest of [false,true]) {
    const music: RhythmMeasure[]=Array.from({length:measures},()=>({meter:[4,4],events:[['H'],['H',{rest}]]}));
    const c=new Capture({id:'ending',label:'',description:'',measures:music},120,false,undefined,undefined,style);
    c.input('down','keyboard',0,0);
    assert.equal(c.advance(measures*2),null);
    if (!rest) c.input('up','keyboard',measures*2+.2,0);
    assert.equal(c.advance(measures*2+.299),null);
    const record=c.advance(measures*2+.3)!;
    assert.equal(record.endedAt,measures*2+.3);assert.equal(record.status,'completed');
    assert.equal(record.events.filter(e=>e.action==='up'&&e.accepted).length,rest?0:1);
  }
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

const v3Attempt = (times: number[], measures = quarters, options: Parameters<typeof attempt>[2] = {}) => ({ ...attempt(times,measures,{...options,current:true}), holdPolicy: legacyHoldPolicy });
const currentAttempt = (times: number[], measures = quarters, options: Parameters<typeof attempt>[2] = {}) => attempt(times,measures,{...options,current:true});
test('v2 spacing fit separates 80 ms start from exact, slower and faster tempo',()=>{
  for (const spacing of [.5,.7,.4]) for (const displacement of [0,.08]) {
    const times=Array.from({length:8},(_,i)=>i*spacing+displacement);
    const a=assessAttempt(currentAttempt(times)); near(a.tempo!.bpm,60/spacing);near(a.rhythm,100);near(a.startingDisplacement,displacement);near(a.steadiness,0);
    const e=evaluateAttempt(currentAttempt(times));assert.equal(e.matches.length,8);assert.ok(e.matches.every(m=>m.attackAccepted));
  }
});
test('v2 missing first, early extra, alternating skips and ambiguous associations retain penalties',()=>{
  const first=assessAttempt(currentAttempt([.58,1.08,1.58,2.08,2.58,3.08,3.58]));near(first.tempo!.bpm,120);near(first.rhythm,87.5);assert.equal(first.missing,1);
  const extra=assessAttempt(currentAttempt([0,.08,.58,1.08,1.58,2.08,2.58,3.08,3.58]));assert.equal(extra.extra,1);near(extra.rhythm,800/9);
  for(const times of [[0,1,2,3],[.5,1.5,2.5,3.5],[.125]]) {const a=assessAttempt(currentAttempt(times));assert.ok(a.rhythm===null || a.rhythm<=50);}
  const ambiguous=assessAttempt(currentAttempt([.125],[{meter:[2,4],events:[['E'],['E'],['Q']]}]));assert.equal(ambiguous.rhythm,null);
});
test('v2 own-attack duration accepts 70/80 percent and late onset without duplicate hold error',()=>{
  const times=[.08,.58,1.08,1.58,2.08,2.58,3.08,3.58];
  const record=currentAttempt(times,quarters,{style:'hold',releases:times.map((t,i)=>t+(i===7?.4:.35))});
  const a=assessAttempt(record);near(a.rhythm,100);near(a.hold,100);
  assert.ok(evaluateAttempt(record).matches.every(m=>m.durationFeedback==='accepted'));
  const rest: RhythmMeasure[]=[{meter:[4,4],events:[['Q'],['Q',{rest:true}],['Q'],['Q']]}];
  near(assessAttempt(currentAttempt([0,1,1.5],rest,{style:'hold',releases:[.4,1.35,1.9]})).hold,100);
});
test('saved hold v3 retains short-note, gradual-curve and final-member scoring',()=>{
  const two: RhythmMeasure[]=[{meter:[2,4],events:[['Q'],['Q']]}];
  for(const [elapsed,credit] of [[.33,1],[.31,1-.02/(.33*.6)],[.01,0],[.575,1],[.675,1-.1/(.5*.75)],[1,0]] as const){
    const a=assessAttempt(v3Attempt([0],two,{style:'hold',releases:[elapsed]}));near(a.hold,100*credit);
  }
  near(assessAttempt(v3Attempt([0],two,{style:'hold',releases:[null]})).hold,0);
  const eighth: RhythmMeasure[]=[{meter:[2,4],events:[['E'],['E'],['Q']]}];
  const short=assessAttempt(v3Attempt([0,1/6,1/3],eighth,{bpm:180,style:'hold',releases:[.1,1/6+.1,.6]}));near(short.hold,100);
  const taps=assessAttempt(v3Attempt([0,1/6,1/3],eighth,{bpm:180,style:'hold',releases:[.01,1/6+.01,1/3+.01]}));near(taps.hold,0);
  // Domain sixteenths tested without extending reviewed UI vocabulary.
  const sixteenth: RhythmMeasure[]=[{meter:[2,4],events:[['S'],['S'],['E'],['Q']]}];
  const s=assessAttempt(v3Attempt([0,1/12,1/6,1/3],sixteenth,{bpm:180,style:'hold',releases:[.05,1/12+.05,1/6+.1,.6]}));near(s.hold,100);
  const tie: RhythmMeasure[]=[{meter:[4,4],events:[['H',{tieNext:true}],['E'],['Q',{dots:1}]]}];
  const omitted=assessAttempt(v3Attempt([0,1.25],tie,{style:'hold',releases:[1,2]}));near(omitted.hold,50);
  const continuous=assessAttempt(v3Attempt([0,1.25],tie,{style:'hold',releases:[1.16,1.85]}));near(continuous.hold,100);
});
test('v2 analytical rests preserve target intersections but accept small overlap; intrusion is one hold penalty',()=>{
  const music: RhythmMeasure[]=[{meter:[4,4],events:[['Q'],['Q',{rest:true}],['Q'],['Q']]},{meter:[4,4],events:[['Q'],['Q'],['Q'],['Q']]}];
  const times=[.08,1.08,1.58,2.08,2.58,3.08,3.58];
  const record=currentAttempt(times,music,{style:'hold',releases:[.6,1.43,1.93,2.43,2.93,3.43,3.98]});
  const a=assessAttempt(record),e=evaluateAttempt(record);near(a.hold,100);assert.ok(e.restOverlaps.length);assert.equal(e.restViolations.length,0);
  const long=currentAttempt(times,music,{style:'hold',releases:[.9,1.43,1.93,2.43,2.93,3.43,3.98]});
  const b=assessAttempt(long);assert.equal(b.restIntrusions.length,1);assert.equal(evaluateAttempt(long).restViolations.length,1);near(b.rhythm,100);assert.ok(b.hold!<100);assert.equal(b.matches[0]!.holdCredit,Math.min(b.matches[0]!.duration!.credit!,b.restIntrusions[0]!.credit));
});
test('v2 policies snapshot; absent/v1 scoring policy replays legacy interpretation',()=>{
  const record=currentAttempt([.08,.58,1.08,1.58,2.08,2.58,3.08,3.58]);const saved=structuredClone(record);const current=assessAttempt(record);
  assert.equal(record.assessmentPolicy!.version,2);assert.equal(record.holdPolicy!.version,4);assert.deepEqual(assessAttempt(JSON.parse(JSON.stringify(record))),current);assert.deepEqual(record,saved);
  const old={...record,assessmentPolicy:legacyAssessmentPolicy,holdPolicy:undefined};assert.ok(assessAttempt(old).tempo!.bpm<120);assert.deepEqual(assessAttempt({...old,assessmentPolicy:undefined}),assessAttempt(old));
});

test('v2 feedback follows confidence and substantial/repeated issues, ignoring tiny release differences',()=>{
  const times=[0,.5,1,1.5,2,2.5,3,3.5];
  const good=currentAttempt(times,quarters,{style:'hold',releases:times.map((t,i)=>t+(i===7?.4:.35))});
  assert.deepEqual(musicalFeedback(good,assessAttempt(good)),{summary:'You kept the rhythm!',suggestion:null});
  const tiny={...good,events:good.events.map(e=>e.action==='up' && e.time===.35 ? {...e,time:.329}:e)};
  assert.equal(musicalFeedback(tiny,assessAttempt(tiny)).suggestion,null);
  const short=currentAttempt(times,quarters,{style:'hold',releases:times.map(t=>t+.01)});
  assert.equal(musicalFeedback(short,assessAttempt(short)).suggestion,'Try holding the longer notes a little more.');
  const sparse=currentAttempt([0,.5]);assert.match(musicalFeedback(sparse,assessAttempt(sparse)).summary,/few notes/);
  const absent=currentAttempt([]);assert.match(musicalFeedback(absent,assessAttempt(absent)).summary,/didn’t hear/);
  const interrupted={...good,status:'interrupted' as const};assert.match(musicalFeedback(interrupted,assessAttempt(interrupted)).summary,/interrupted/);
  const uneven=currentAttempt([0,.6,1,1.6,2,2.6,3,3.6]);assert.equal(musicalFeedback(uneven,assessAttempt(uneven)).suggestion,'Keep the same pace through the whole exercise.');
});
test('count-in holds cannot earn silent rest praise in Hold; Tap stays attack-only',()=>{
  const music: RhythmMeasure[]=[{meter:[4,4],events:[['W',{rest:true}]]}];
  for(const style of ['tap','hold'] as const){
    const c=new Capture({id:'rest-only',label:'',description:'',measures:music},120,false,undefined,undefined,style);
    c.input('down','keyboard',-.1,0);c.input('up','keyboard',1,0);const r=c.advance(c.plan.captureEnd)!;
    const a=assessAttempt(r);assert.equal(a.rhythm,null);assert.equal(a.hold,null);
    assert.equal(musicalFeedback(r,a).summary,style==='hold'?'There was input during this rest exercise.':'You left the rests silent.');
    assert.equal(evaluateAttempt(r).restViolations.length,style==='hold'?1:0);
  }
});

test('v2 bounds withhold confident tempo outside the range and fixed calibration preserves elapsed/raw evidence',()=>{
  for(const [spacing,start] of [[.5,.2],[.8,0],[.3,0]] as const) {
    const r=currentAttempt(Array.from({length:8},(_,i)=>i*spacing+start));const a=assessAttempt(r);
    assert.ok(a.rhythm===null || a.rhythm<100);assert.equal(a.tempo,null);
  }
  const times=[.12,.62,1.12,1.62,2.12,2.62,3.12,3.62];
  const r=currentAttempt(times,quarters,{style:'hold',offset:.12,releases:times.map((t,i)=>t+(i===7?.4:.35))});const saved=structuredClone(r);const a=assessAttempt(r);
  near(a.rhythm,100);near(a.hold,100);near(a.startingDisplacement,0);assert.deepEqual(r,saved);
  a.matches.forEach((m,i)=>near(m.duration!.elapsed,saved.events[2*i+1]!.time-saved.events[2*i]!.time));
});

test('an extra brief rest attack stays a rest issue without an additional duration score',()=>{
  const music: RhythmMeasure[]=[{meter:[4,4],events:[['Q'],['Q',{rest:true}],['Q'],['Q']]}];
  const r=currentAttempt([0,.6,1,1.5],music,{style:'hold',releases:[.4,.61,1.35,1.9]});
  const a=assessAttempt(r);assert.equal(a.extra,1);near(a.hold,100);assert.equal(evaluateAttempt(r).restViolations.length,1);
});

test('v2 spacing uses unequal notes, silence and compound musical pulse with displacement',()=>{
  const music: RhythmMeasure[]=[{meter:[4,4],events:[['H'],['E',{rest:true}],['E'],['Q']]},{meter:[4,4],events:[['Q'],['Q',{rest:true}],['Q'],['Q']]}];
  const a=assessAttempt(currentAttempt([.08,1.58,1.88,2.48,3.68,4.28],music));near(a.tempo!.bpm,100);near(a.rhythm,100);near(a.startingDisplacement,.08);
  const six: RhythmMeasure[]=Array.from({length:3},()=>({meter:[6,8],events:[['Q',{dots:1}],['Q',{dots:1}]]}));
  const b=assessAttempt(currentAttempt([.08,.68,1.28,1.88,2.48,3.08],six));near(b.tempo!.bpm,100);near(b.rhythm,100);near(b.startingDisplacement,.08);
});


test('v4 short notes are excluded, with no hold percentage or sustain warning', () => {
  for (const count of [8,16]) {
    const music: RhythmMeasure[] = [{ meter:[4,4], events:Array.from({length:count},()=>[count===8?'E':'S']) }];
    const times = Array.from({length:count},(_,i)=>i*3/count);
    const record = currentAttempt(times,music,{bpm:80,style:'hold',releases:times.map(t=>t+.04)});
    const a = assessAttempt(record);
    near(a.rhythm,100); assert.equal(a.hold,null); assert.match(a.holdReason!,/short notes only/);
    assert.ok(a.matches.every(m=>m.holdCredit===null && m.duration?.eligible===false));
    assert.ok(evaluateAttempt(record).matches.every(m=>m.durationFeedback==='not-graded'));
    assert.equal(evaluateAttempt(record).acceptable,true);
    assert.equal(musicalFeedback(record,a).suggestion,null);
    const timeline = timingTimelines(record)[0]!;
    timeline.receivedSustain.forEach((bar,i)=>{
      assert.equal(bar.feedback,'not-graded'); near(bar.start,times[i]!); near(bar.end,times[i]!+.04);
    });
    // Legacy v3 and absent hold snapshots retain their former short-note scoring.
    const old = {...record,holdPolicy:legacyHoldPolicy};
    near(assessAttempt(old).hold,0);
    assert.deepEqual(assessAttempt({...record,holdPolicy:undefined}),assessAttempt(old));
    assert.deepEqual(assessAttempt(JSON.parse(JSON.stringify(record))),a);
  }
});

test('v4 boundary is 400 ms at assessment tempo, independent of written value', () => {
  for (const duration of [.399,.4,.401]) {
    const d = sustainEvidence(duration,.01,true,duration);
    assert.equal(d.eligible,duration>=.4); assert.equal(d.credit,duration>=.4?0:null);
  }
  const times = [0,.4,.8,1.2,1.6,2,2.4,2.8];
  const atBoundary = assessAttempt(currentAttempt(times,quarters,{bpm:120,style:'hold'}));
  near(atBoundary.tempo!.bpm,150); near(atBoundary.hold,0);
  const faster = assessAttempt(currentAttempt(times.map(t=>t*.975),quarters,{bpm:120,style:'hold'}));
  near(faster.tempo!.bpm,60/.39); assert.equal(faster.hold,null);
  const slowEighths: RhythmMeasure[] = [{meter:[4,4],events:Array.from({length:8},()=>['E'])}];
  near(assessAttempt(currentAttempt(times,slowEighths,{bpm:80,style:'hold'})).hold,0);
  const compound: RhythmMeasure[] = [{meter:[6,8],events:Array.from({length:6},()=>['E'])}];
  assert.equal(assessAttempt(currentAttempt([0,.25,.5,.75,1,1.25],compound,{bpm:80,style:'hold'})).hold,null);
});

test('v4 mixed notes average only eligible played holds; missing long notes stay rhythm errors', () => {
  const music: RhythmMeasure[] = [{meter:[4,4],events:[['E'],['E'],['Q'],['H']]}];
  const record=currentAttempt([0,.25,.5,1],music,{style:'hold',releases:[.01,.26,.51,1.8]});
  const a=assessAttempt(record); near(a.rhythm,100); near(a.hold,50);
  assert.deepEqual(a.matches.map(m=>m.holdCredit),[null,null,0,1]);
  const missing=assessAttempt(currentAttempt([0,.25],music,{style:'hold'}));
  assert.equal(missing.hold,null); assert.equal(missing.missing,2); near(missing.rhythm,50);
});

test('v4 waives only a short final tie member, preserving the full endpoint and continuous attack', () => {
  const music: RhythmMeasure[] = [{meter:[4,4],events:[['Q'],['Q'],['H',{tieNext:true}]]},
    {meter:[4,4],events:[['E'],['E',{rest:true}],['Q'],['Q'],['Q']]}];
  const times=[0,.75,1.5,3.75,4.5,5.25];
  for (const release of [2.68,3,3.375]) {
    const record=currentAttempt(times,music,{bpm:80,style:'hold',releases:[.55,1.3,release,4.3,5.05,5.85]});
    const a=assessAttempt(record); near(a.rhythm,100); near(a.hold,100);
    const d=a.matches[2]!.duration!;
    near(d.expectedDuration,1.875); near(d.assessedDuration,1.5); near(d.waivedFinalDuration,.375);
    near(d.minimum,1.18); near(d.maximum,1.955);
    assert.ok(evaluateAttempt(record).matches.every(m=>m.durationFeedback==='accepted'));
  }
  near(sustainEvidence(1.875,1.955,false,.375).credit,1);
  assert.ok(sustainEvidence(1.875,2.2,false,.375).credit!<1);
  assert.equal(sustainEvidence(1.875,null,false,.375).credit,0);
  const split=assessAttempt(currentAttempt([0,.75,1.5,3,3.75,4.5,5.25],music,{bpm:80,style:'hold',releases:[.55,1.3,2.9,3.1,4.3,5.05,5.85]}));
  assert.equal(split.extra,1); assert.ok(split.rhythm!<100);
  const multi: RhythmMeasure[]=[{meter:[4,4],events:[['H',{tieNext:true}],['E',{tieNext:true}],['S'],['S'],['Q']]}];
  const truncated=assessAttempt(currentAttempt([0,1.375,1.5],multi,{style:'hold',releases:[1,1.4,1.9]}));
  const d=truncated.matches[0]!.duration!;
  near(d.waivedFinalDuration,.125); near(d.assessedDuration,1.25); near(d.credit,0);
  // 250 + 250 ms is eligible as one sound, though each written member is short.
  const tiedShorts: RhythmMeasure[]=[{meter:[2,4],events:[['E',{tieNext:true}],['E'],['Q']]}];
  const chain=assessAttempt(currentAttempt([0,.5],tiedShorts,{style:'hold',releases:[.2,.9]}));
  near(chain.hold,100); assert.equal(chain.matches[0]!.duration!.eligible,true);
  assert.equal(sustainEvidence(.375,.01,true,.125).eligible,false);
  assert.equal(sustainEvidence(1.4,1,true,.4).waivedFinalDuration,0);
  assert.ok(sustainEvidence(1.4,1,true,.4).credit!<1);
});

test('v4 exempt notes retain rest-intrusion evidence without entering the hold denominator', () => {
  const music: RhythmMeasure[]=[{meter:[4,4],events:[['E'],['E',{rest:true}],['Q'],['Q'],['Q']]}];
  const record=currentAttempt([0,.75,1.5,2.25],music,{bpm:80,style:'hold',releases:[.7,1.3,2.05,2.85]});
  const a=assessAttempt(record); near(a.rhythm,100); near(a.hold,100);
  assert.equal(a.matches[0]!.holdCredit,null); assert.equal(a.restIntrusions.length,1);
  assert.equal(evaluateAttempt(record).matches[0]!.durationFeedback,'late');
  assert.equal(evaluateAttempt(record).acceptable,false);
  assert.match(musicalFeedback(record,a).suggestion!,/silence/);
  const absent=currentAttempt([0],[{meter:[2,4],events:[['E'],['E',{rest:true}],['Q',{rest:true}]]}],{style:'hold',releases:[null]});
  assert.equal(assessAttempt(absent).hold,null); assert.ok(evaluateAttempt(absent).restViolations.length);
});


test('Tap ignores held overlap in rests while Hold still gives release guidance', () => {
  const music: RhythmMeasure[] = Array.from({length:2},()=>({meter:[4,4],events:[['Q'],['Q',{rest:true}],['Q'],['Q']]}));
  const times=[0,1,1.5,2,3,3.5], releases=[.95,1.35,1.9,2.95,3.35,3.9];
  for (const style of ['tap','hold'] as const) {
    const record=currentAttempt(times,music,{style,releases});
    const a=assessAttempt(record);
    near(a.rhythm,100); assert.equal(a.restIntrusions.length,2);
    assert.ok(a.restIntrusions.every(r=>!r.attack));
    assert.equal(musicalFeedback(record,a).suggestion,style==='tap'?null:'Leave a little more silence in the rests.');
    assert.equal(evaluateAttempt(record).restViolations.length,style==='tap'?0:2);
  }
});

test('a brief extra rest attack gets silence guidance in either style; accepted early attacks do not', () => {
  const music: RhythmMeasure[] = Array.from({length:2},()=>({meter:[4,4],events:[['Q'],['Q',{rest:true}],['Q'],['Q']]}));
  for (const style of ['tap','hold'] as const) {
    const record=currentAttempt([0,.7,1,1.5,2,3,3.5],music,{style,releases:[.4,.71,1.35,1.9,2.4,3.35,3.9]});
    const a=assessAttempt(record);
    assert.equal(a.extra,1); assert.equal(a.restIntrusions.length,1);
    assert.equal(a.restIntrusions[0]!.attack,true); near(a.restIntrusions[0]!.credit,1);
    assert.equal(musicalFeedback(record,a).suggestion,'Leave a little more silence in the rests.');
    const early=currentAttempt([0,.98,1.5,2,2.98,3.5],music,{style,releases:[.4,1.35,1.9,2.4,3.35,3.9]});
    near(assessAttempt(early).rhythm,100); assert.equal(musicalFeedback(early,assessAttempt(early)).suggestion,null);
  }
});
