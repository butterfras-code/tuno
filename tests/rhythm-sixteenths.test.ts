import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countGrid, durationEndSlot, slotX } from '../src/apps/count-writing/grid.ts';
import { passageGrid, passageDurationEnd } from './legacy/count-passage.ts';
import { blankAnswer, evaluatePassage } from './legacy/count-evaluation.ts';
import type { CountSymbol } from './legacy/count-evaluation.ts';
import { countKey, displayCount, translateCount, syllableBuffer } from '../src/apps/count-writing/input.ts';
import { sixteenthFixtures } from '../src/apps/rhythm-walk/shared/fixtures.ts';
import { generateExercise, generationIssue, defaultGeneration, ingredients } from '../src/apps/rhythm-walk/shared/generation.ts';
import { meters, meterPolicy, syncopated } from '../src/apps/rhythm-walk/shared/meter.ts';
import { derivePassage, duration } from '../src/music/measure.ts';
import { compare, fraction } from '../src/music/fraction.ts';
import { readPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { planPassage } from '../src/apps/rhythm-walk/timing.ts';

// Hand-derived onset expectations, independent of the generated expected symbols.
const expected: Record<string, [number[], CountSymbol[], CountSymbol[]]> = {
  'four-sixteenths': [[0,1,2,3,4,8,12], ['1','e','&','a','2','3','4'], ['1','ta','te','ta','2','3','4']],
  'eighth-two-sixteenths': [[0,2,3,4], ['1','&','a','2'], ['1','te','ta','2']],
  'two-sixteenths-eighth': [[0,1,2,4], ['1','e','&','2'], ['1','ta','te','2']],
  'dotted-eighth-sixteenth': [[0,3,4,8], ['1','a','2','3'], ['1','ta','2','3']],
};
for (const [id, [positions, numbers, syllables]] of Object.entries(expected)) test(`independent onset answer: ${id}`, () => {
  const fixture = sixteenthFixtures.find(f => f.id === id)!;
  for (const [system, values] of [['numbers', numbers], ['syllables', syllables]] as const) {
    const answer = blankAnswer(fixture.measures[0]!);
    positions.forEach((p, i) => { answer.symbols[p] = values[i]!; });
    if (id === 'four-sixteenths') answer.spans = [{ start: 8, end: 15 }];
    const results = evaluatePassage(fixture.measures, [answer], 'optional', undefined, system);
    assert.equal(results[0]!.counts.verdict, 'correct');
    assert.equal(results[0]!.spans.verdict, 'correct');
    answer.symbols[3] = system === 'numbers' ? 'e' : 'te';
    assert.equal(evaluatePassage(fixture.measures, [answer], 'optional', undefined, system)[0]!.counts.verdict, 'revise');
  }
});
test('optional subdivisions, hidden endpoints and written rest geometry use the finer local grid', () => {
  const f = sixteenthFixtures[0]!.measures[0]!;
  const grid = countGrid(f);
  assert.deepEqual(grid.availableSlots, [0,1,2,3,4,8,12]);
  assert.equal(durationEndSlot(grid, 12), 15);
  const dottedSource = sixteenthFixtures.find(f => f.id === 'dotted-eighth-sixteenth')!.measures[0]!;
  const dotted = countGrid(dottedSource);
  assert.equal(dotted.slots[1]!.available, true);
  assert.equal(dotted.slots[2]!.available, true);
  const answer = blankAnswer(dottedSource);
  [0,3,4,8].forEach(p => { answer.symbols[p] = dotted.slots[p]!.symbol; });
  assert.equal(evaluatePassage([dottedSource], [answer])[0]!.counts.verdict, 'correct');
  answer.symbols[1] = 'e';
  assert.equal(evaluatePassage([dottedSource], [answer])[0]!.counts.verdict, 'provisional');
  const rests = sixteenthFixtures.find(f => f.id === 'sixteenth-rests')!.measures;
  const rg = countGrid(rests[0]!); const ra = blankAnswer(rests[0]!);
  ra.symbols = rg.slots.map(s => s.symbol);
  ra.rests = [{start:0,end:0},{start:5,end:5},{start:10,end:10},{start:15,end:15}];
  assert.equal(evaluatePassage(rests,[ra])[0]!.rests.verdict,'correct');
  ra.rests[1]!.end = 6;
  assert.equal(evaluatePassage(rests,[ra])[0]!.rests.verdict,'revise');
});
test('switching never turns a wrong token correct; duplicate ta is resolved only at e/a coordinates', () => {
  const grid = countGrid(sixteenthFixtures[0]!.measures[0]!);
  for (const slot of grid.slots) for (const token of ['1','2','e','&','a',''] as const) {
    const translated = translateCount(token, slot.position, 'numbers', 'syllables');
    const syllable = countGrid(sixteenthFixtures[0]!.measures[0]!, 'syllables').slots[grid.slots.indexOf(slot)]!.symbol;
    if (token !== slot.symbol && translated) assert.notEqual(translated, syllable);
  }
  assert.equal(translateCount('e',fraction(3,16),'numbers','syllables'),'');
  assert.equal(translateCount('a',fraction(1,16),'numbers','syllables'),'');
  assert.equal(translateCount('ta',fraction(1,16),'syllables','numbers'),'e');
  assert.equal(translateCount('ta',fraction(3,16),'syllables','numbers'),'a');
  assert.equal(translateCount('ta',fraction(1,8),'syllables','numbers'),'');
  assert.equal(translateCount('te',fraction(3,16),'syllables','numbers'),'&');
  assert.equal(countKey('+'),'&'); assert.equal(displayCount('&','+'),'+');
});
test('syllable entry buffers t without advancing and cancellation never stores fragments', () => {
  const buffer = syllableBuffer();
  assert.equal(buffer.key('t'),null); assert.equal(buffer.active(),true);
  assert.equal(buffer.key('a'),'ta'); assert.equal(buffer.active(),false);
  buffer.key('t'); assert.equal(buffer.key('e'),'te');
  for (const key of ['Backspace','ArrowRight','Tab','Escape']) { buffer.key('t'); assert.equal(buffer.key(key),null); assert.equal(buffer.active(),false); }
  buffer.key('t'); buffer.clear(); assert.equal(buffer.active(),false);
});
test('legacy preferences retain configuration and offbeat choice; new ingredients default off', () => {
  const generation = {...defaultGeneration(), measures:4, ties:true};
  const p = readPreferences(JSON.stringify({version:1,offbeat:'+',generation,mode:'both',bpm:123}));
  assert.equal(p.countingSystem,'numbers'); assert.equal(p.offbeat,'+'); assert.deepEqual(p.generation,generation);
  assert.equal(p.bpm,123); assert.equal(p.mode,'both');
  assert.equal(readPreferences(JSON.stringify({...p,countingSystem:'syllables'})).countingSystem,'syllables');
  assert.ok(defaultGeneration().ingredients.every(id=> !['sixteenth','sixteenth-rest','dotted-eighth'].includes(id)));
});
test('new ingredient subsets preserve exact totals, reachability, selected spellings and 6/8 vocabulary', () => {
  const ids = ['quarter','eighth','sixteenth','sixteenth-rest','dotted-eighth'] as const;
  let seed=347; const random=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/2**32; };
  for (let mask=1;mask<32;mask++) for (const meter of meters) for (const measures of [1,2,3,4]) for (const ties of [false,true]) for (const syncopation of [false,true]) {
    const selected=ids.filter((_,i)=>mask&(1<<i));
    const settings={...defaultGeneration(),meters:[meter],measures,ingredients:[...selected],ties,syncopation};
    const before=structuredClone(settings);
    if (generationIssue(settings)) { assert.throws(()=>generateExercise(settings,random)); continue; }
    const passage=generateExercise(settings,random), derived=derivePassage(passage), policy=meterPolicy(meter);
    assert.deepEqual(settings,before); assert.equal(passage.length,measures);
    passage.forEach((bar,i)=>{
      assert.equal(compare(derived.measures[i]!.length,policy.length),0);
      bar.events.forEach(([v,m])=>{const {tieNext:_,...mods}=m??{}; assert.ok(ingredients.some(ing=>selected.includes(ing.id as typeof selected[number]) && ing.event[0]===v && JSON.stringify(ing.event[1]??{})===JSON.stringify(mods))); if(meter==='6/8') assert.ok(v!=='S' && !(v==='E'&&m?.dots)); });
    });
    if(!syncopation) assert.ok(derived.attacks.every(a=>!syncopated(a.start,a.duration,policy.pulse)));
  }
});
test('ties retain exact sixteenth attacks and releases at barline and layout boundaries', () => {
  const fixture=sixteenthFixtures.find(f=>f.id==='sixteenth-bar-tie')!;
  const grid=passageGrid(fixture.measures); assert.deepEqual(grid.offsets,[0,8]);
  assert.deepEqual(grid.sustained.map(s=>[s.start,s.end]),[[7,8]]);
  assert.equal(passageDurationEnd(grid,7),7); assert.equal(passageDurationEnd(grid,8),8);
  const plan=planPassage(fixture.measures,120);
  assert.equal(plan.notes.length,7);
  assert.equal(plan.notes[3]!.start, .875); assert.equal(plan.notes[3]!.end,1.125);
  assert.equal(duration(['E',{dots:1}])[0],3);
  assert.equal(slotX(3,16,true),27);
});

test('Tap and Hold retain exact sixteenth/dotted timing, calibrated evidence and aligned timelines', async () => {
  const { Capture } = await import('../src/apps/rhythm-walk/capture.ts');
  const { evaluateAttempt } = await import('../src/apps/rhythm-walk/evaluation.ts');
  const { timingTimelines } = await import('../src/apps/rhythm-walk/timeline.ts');
  for (const fixture of sixteenthFixtures.filter(f=>!['dense-sixteenths','sixteenth-all-rests'].includes(f.id))) for (const style of ['tap','hold'] as const) {
    const c=new Capture({...fixture,description:''},120,false,undefined,{version:1,input:'keyboard',seconds:.047,method:'tap',samples:12,spread:0},style);
    for(const n of c.plan.notes) { c.input('down','keyboard',n.start+.047,10000+(n.start+.047)*1000); c.input('up','keyboard',n.end+.047,10000+(n.end+.047)*1000); }
    const record=c.advance(c.plan.captureEnd)!; const before=structuredClone(record), result=evaluateAttempt(record);
    assert.equal(result.acceptable,true,fixture.id); assert.equal(result.matches.length,c.plan.notes.length);
    const timelines=timingTimelines(record);
    timelines.forEach((timeline,bar)=>{
      const grid=countGrid(fixture.measures[bar]!);
      const starts=c.plan.notes.filter(n=>n.sources[0]!.measure===bar).map(n=>grid.events[n.sources[0]!.event]!.startSlot);
      assert.deepEqual(timeline.expected.map(n=>n.x),starts.map(p=>slotX(p,grid.slots.length,grid.fine)));
      timeline.received.forEach((hit,i)=>assert.ok(Math.abs(hit.x-timeline.expected[i]!.x)<1e-9));
      assert.equal(timeline.receivedSustain.length>0,style==='hold');
    });
    assert.deepEqual(record,before,'count/geometry evaluation never alters raw/corrected performance evidence');
    assert.equal(record.events[0]!.time,c.plan.notes[0]!.start+.047);
  }
});
test('mixed fine/coarse bars and dotted-quarter chains retain old convention without extra e/a requirements', () => {
  const measures=[{meter:[4,4] as const,events:[['S'],['S'],['E'],['Q',{dots:1}],['E'],['Q']] as const}, {meter:[4,4] as const,events:[['H'],['H']] as const}];
  const grid=passageGrid(measures);
  assert.deepEqual(grid.offsets,[0,16]); assert.equal(grid.slots.length,24);
  assert.deepEqual(grid.grids[0]!.slots.flatMap((s,i)=>s.dottedInternal?[i]:[]),[6]);
  const answers=measures.map(blankAnswer);
  answers.forEach((a,i)=>{a.symbols=grid.grids[i]!.slots.map(s=>s.onCount||s.onset||s.dottedInternal?s.symbol:'');});
  assert.ok(evaluatePassage(measures,answers,'required').every(r=>r.counts.verdict==='correct'));
});
