import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countGrid, durationEndSlot, slotX } from '../src/apps/count-writing/grid.ts';
import { passageGrid } from '../src/apps/count-writing/passage.ts';
import { blankAnswer, evaluatePassage } from '../src/apps/count-writing/evaluation.ts';
import type { CountSymbol } from '../src/apps/count-writing/evaluation.ts';
import { syllableBuffer, translateCount } from '../src/apps/count-writing/input.ts';
import { tripletFixtures } from '../src/apps/rhythm-walk/shared/fixtures.ts';
import { defaultGeneration, generateExercise, generationIssue, ingredients, rhythmCapabilities } from '../src/apps/rhythm-walk/shared/generation.ts';
import type { IngredientId } from '../src/apps/rhythm-walk/shared/generation.ts';
import { meters } from '../src/apps/rhythm-walk/shared/meter.ts';
import { deriveMeasure, derivePassage } from '../src/music/measure.ts';
import type { RhythmEvent, RhythmMeasure } from '../src/music/measure.ts';
import { divide, fraction } from '../src/music/fraction.ts';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { timingTimelines } from '../src/apps/rhythm-walk/timeline.ts';
import { planPassage } from '../src/apps/rhythm-walk/timing.ts';
import { Activity, readPreferences } from '../src/apps/rhythm-walk/activity.ts';

const fixture = (id: string) => tripletFixtures.find(f => f.id === id)!;
const onsets: Record<string, [number[], CountSymbol[], CountSymbol[]]> = {
  'triplet-isolated': [[0,4,8,12,24,36], ['1','la','li','2','3','4'], ['1','la','li','2','3','4']],
  'triplet-consecutive': [[0,4,8,12,16,20], ['1','la','li','2','la','li'], ['1','la','li','2','la','li']],
  'triplet-beat-two': [[0,12,16,20,24], ['1','2','la','li','3'], ['1','2','la','li','3']],
  'triplet-mixed': [[0,4,8,12,18,24,28,32,36,39,42,45], ['1','la','li','2','&','3','la','li','4','e','&','a'], ['1','la','li','2','te','3','la','li','4','ta','te','ta']],
};
for (const [id, [positions, numbers, syllables]] of Object.entries(onsets)) test(`triplet independent count positions: ${id}`, () => {
  for (const [system, values] of [['numbers',numbers],['syllables',syllables]] as const) {
    const f = fixture(id), grid = countGrid(f.measures[0]!, system), answer = blankAnswer(f.measures[0]!);
    assert.deepEqual(grid.availableSlots, positions);
    assert.deepEqual(positions.map(i => grid.slots[i]!.symbol), values);
    positions.forEach((p,i) => { answer.symbols[p] = values[i]!; });
    if (id === 'triplet-isolated') answer.spans = [{ start:24, end:47 }];
    assert.equal(evaluatePassage(f.measures,[answer],'optional',undefined,system)[0]!.counts.verdict,'correct');
    assert.equal(evaluatePassage(f.measures,[answer],'optional',undefined,system)[0]!.spans.verdict,'correct');
    const la = positions[values.indexOf('la')]!;
    answer.symbols[la] = 'li';
    assert.equal(evaluatePassage(f.measures,[answer],'optional',undefined,system)[0]!.counts.verdict,'revise');
    assert.equal(translateCount('li',grid.slots[la]!.position,system,system === 'numbers' ? 'syllables' : 'numbers',true),'li');
    for (const event of grid.events.filter(e => e.tupletGroup !== null)) assert.deepEqual(event.duration,[1,12]);
  }
});
test('triplet atom capability, defaults and independent meter validation', () => {
  for (const meter of meters) assert.equal(rhythmCapabilities(meter).ingredients.includes('triplet-eighth'),meter !== '6/8');
  assert.ok(rhythmCapabilities('4/4').patterns.includes('triplet-eighth'));
  assert.ok(!rhythmCapabilities('6/8').patterns.includes('triplet-eighth'));
  assert.ok(!defaultGeneration().ingredients.includes('triplet-eighth'));
  const config = {...defaultGeneration(),ingredients:['triplet-eighth'] as IngredientId[]};
  assert.equal(generationIssue(config),null);
  assert.match(generationIssue({...config,meters:['4/4','6/8']})!,/cannot fill 6\/8/);
  assert.equal(generationIssue({...config,meters:['4/4','6/8'],ingredients:['triplet-eighth','eighth']}),null);
  assert.deepEqual(readPreferences(JSON.stringify({version:1,generation:config})).generation,config);
});
test('bounded deterministic generation emits only selected complete groups, no 6/8 leakage or triplet ties', () => {
  let seed=934; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  let seenTriplets=false, seenBinary=false;
  const ids: IngredientId[]=['triplet-eighth','eighth','sixteenth','quarter-rest'];
  for (let mask=1;mask<16;mask++) for (const meter of meters) for (const measures of [1,2,3,4]) for (const ties of [false,true]) for (const syncopation of [false,true]) {
    const settings={...defaultGeneration(),meters:[meter],measures,ingredients:ids.filter((_,i)=>mask&(1<<i)),ties,syncopation};
    if (generationIssue(settings)) {assert.throws(()=>generateExercise(settings,random));continue;}
    let draws=0;const passage=generateExercise(settings,()=>{assert.ok(++draws<=66);return random();});
    const derived=derivePassage(passage); assert.equal(passage.length,measures);
    for (const [barIndex,bar] of passage.entries()) {
      assert.deepEqual(derived.measures[barIndex]!.length,fraction(meter==='6/8'?6:Number(meter[0]),meter==='6/8'?8:4));
      const events=deriveMeasure(bar).events;
      for (const [i,event] of events.entries()) {
        const options=event.written[1];
        assert.ok(settings.ingredients.some(id=>{const value: RhythmEvent=ingredients.find(x=>x.id===id)!.event;return value[0]===event.written[0] && Boolean(value[1]?.rest)===Boolean(options?.rest) && Boolean(value[1]?.tuplet)===Boolean(options?.tuplet);}));
        if (options?.tuplet) {
          seenTriplets=true;assert.notEqual(meter,'6/8');assert.deepEqual(options.tuplet,[3,2]);assert.deepEqual(event.duration,[1,12]);
          assert.ok(!options.tieNext && !events[i-1]?.written[1]?.tieNext);
          const group=events.filter(e=>e.tupletGroup===event.tupletGroup);assert.equal(group.length,3);
          assert.equal(divide(group[0]!.start,fraction(1,4))[1],1);
        } else seenBinary=true;
      }
      countGrid(bar);
    }
  }
  assert.ok(seenTriplets&&seenBinary);
  // Fixed randomness makes both ternary and binary beats reachable in the same bar.
  const draws=[.99,0,0,.99];let index=0;
  const p=generateExercise({...defaultGeneration(),measures:1,ingredients:['eighth','triplet-eighth']},()=>draws[index++]??.99);
  assert.deepEqual(p[0]!.events.map(e=>Boolean(e[1]?.tuplet)),[true,true,true,false,false,true,true,true,true,true,true]);
});
test('review boundary rejects deferred tuplets and incoming barline ties', () => {
  const f=structuredClone(fixture('triplet-consecutive').measures[0]!);
  const events=f.events.map(e=>structuredClone(e));
  for (const modifier of [{rest:true},{tieNext:true}]) assert.throws(()=>countGrid({...f,events:events.map((e,i)=>i===0?['E',{...e[1],...modifier}]:e)}));
  assert.throws(()=>countGrid({meter:[6,8],events:events.concat([['Q']])}));
  const shifted: RhythmMeasure={meter:[2,4],events:[['E'],...events.slice(0,3),['E']]};
  assert.throws(()=>countGrid(shifted),/quarter beats/);
  assert.throws(()=>passageGrid([{meter:[2,4],events:[['Q'],['Q',{tieNext:true}]]},f]),/ties involving/);
});
test('triplet prefix is atomic and cancelable, with incorrect answers retained across systems', () => {
  const b=syllableBuffer();assert.equal(b.key('l'),null);assert.ok(b.active());assert.equal(b.key('a'),'la');assert.ok(!b.active());
  b.key('l');assert.equal(b.key('i'),'li');
  for(const key of ['Backspace','Delete','Tab','ArrowLeft','Escape']) {b.key('l');assert.equal(b.key(key),null);assert.ok(!b.active());}
  b.key('l');b.clear();assert.equal(b.key('i'),null);
  for(const p of [fraction(0),fraction(1,12),fraction(1,6),fraction(1,8)]) for(const token of ['la','li'] as const) {
    assert.equal(translateCount(token,p,'numbers','syllables',true),token);
    assert.equal(translateCount(token,p,'syllables','numbers',true),token);
  }
});
test('mixed triplet rest, tie and coarse measures retain exact duration geometry', () => {
  const bar=fixture('triplet-rest-tie').measures[0]!,grid=passageGrid([bar,{meter:[2,4],events:[['H']]}]);
  assert.deepEqual(grid.offsets,[0,48]);
  assert.deepEqual(grid.sustained.map(s=>[s.start,s.end]),[[24,35],[48,51]]);
  assert.equal(durationEndSlot(grid.grids[0]!,36),47);
  assert.ok(Math.abs(slotX(4,48,true)-slotX(0,48,true)-80/12)<1e-12);
  const answer=blankAnswer(bar);[[0,'1'],[4,'la'],[8,'li'],[12,'2'],[24,'3'],[36,'4']].forEach(([p,t])=>{answer.symbols[p as number]=t as CountSymbol;});
  answer.rests=[{start:12,end:12}];answer.spans=[{start:24,end:35}];
  const result=evaluatePassage([bar],[answer],'optional',answer.spans)[0]!;
  assert.equal(result.counts.verdict,'correct');assert.equal(result.spans.verdict,'correct');assert.equal(result.rests.verdict,'correct');
});
test('quarter BPM triplet plans, capture policies and timeline positions use canonical fractions', () => {
  const exercise={id:'independent',label:'Triplets',description:'',measures:fixture('triplet-consecutive').measures};
  const plan=planPassage(exercise.measures,60);
  assert.equal(plan.countIn,4);assert.equal(plan.duration,2);
  const starts=[0,1/3,2/3,1,4/3,5/3], ends=[1/3,2/3,1,4/3,5/3,2];
  plan.notes.forEach((n,i)=>{assert.ok(Math.abs(n.start-starts[i]!)<1e-12);assert.ok(Math.abs(n.end-ends[i]!)<1e-12);});
  for(const style of ['tap','hold'] as const) {
    const capture=new Capture(exercise,60,true,undefined,undefined,style);
    starts.forEach((t,i)=>{capture.input('down','keyboard',t,1000+t*1000);capture.input('up','keyboard',ends[i]!-.005,1000+ends[i]!*1000-5);});
    const record=capture.advance(capture.plan.captureEnd)!;
    assert.equal(record.status,'completed');assert.equal(record.events.length,12);assert.equal(record.playStyle,style);assert.ok(record.assessmentPolicy);
    const timeline=timingTimelines(record)[0]!;
    timeline.expected.forEach((hit,i)=>assert.ok(Math.abs(hit.x-(12+starts[i]!*40))<1e-10));
    assert.equal(capture.interrupt('blur',10).status,'completed');
    const canceled=new Capture(exercise,60,true);assert.equal(canceled.interrupt('mode switch',-1).status,'interrupted');
  }
  const activity=new Activity(readPreferences(null),exercise.measures), id=activity.exercise.id;
  for(const mode of ['tap','both','write'] as const) {activity.preferences.mode=mode;assert.equal(activity.exercise.id,id);assert.deepEqual(activity.exercise.measures,exercise.measures);}
});
