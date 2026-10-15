import test from 'node:test';
import assert from 'node:assert/strict';
import { Activity, defaultPreferences, presets } from '../src/apps/rhythm-walk/activity.ts';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { planPassage } from '../src/apps/rhythm-walk/timing.ts';
import { countGrid } from '../src/apps/count-writing/grid.ts';
import { defaultGeneration, generateExercise, ingredients } from '../src/apps/rhythm-walk/shared/generation.ts';
import { deriveScore, createScore } from '../src/music/score.ts';
import { derivePassage as legacyDerive } from './legacy/measure.ts';
import type { RhythmMeasure, NoteValue } from './legacy/measure.ts';
import { toNumber, add, divide } from '../src/music/fraction.ts';

test('generation, activity, counting and capture retain one immutable typed source', () => {
  const generated = generateExercise(defaultGeneration(), () => .4);
  const a = new Activity(defaultPreferences(), generated);
  assert.equal(a.exercise.score, generated);
  assert.equal(a.countingPlan.source, generated);
  assert.equal(new Capture(a.exercise, 80, true).exercise.score, generated);
  assert.equal(createScore(generated), generated);
  const ids = generated.measures.flatMap(m => m.notes.map(n => n.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => id !== 'draft'));
  assert.throws(() => { (generated.measures[0]!.notes[0] as {type:string}).type = 'whole'; }, TypeError);
  for (const mode of ['write','tap','both'] as const) { a.setMode(mode); assert.equal(a.exercise.score, generated); }
  assert.notEqual(a.next(() => .2).score, generated);
});

test('caller mutation cannot alter source, and authored XML IDs survive every consumer', () => {
  const input = structuredClone(presets.find(f => f.id === 'tie')!.score);
  const source = createScore({measures:input.measures.map((m,mi)=>({...m,notes:m.notes.map((n,ni)=>({...n,id:`imported-${mi}-${ni}`}))}))});
  const a = new Activity(defaultPreferences(), source), c = new Capture(a.exercise, 120, false, undefined, undefined, 'hold');
  assert.equal(c.exercise.score, a.countingPlan.source);
  a.exercise.score.measures.forEach((m,mi)=>countGrid(m).events.forEach((e,ei)=>assert.equal(e.written, source.measures[mi]!.notes[ei])));
  assert.ok(a.countingPlan.units.every(u=>u.id.startsWith('unit:imported-')));
  const mutable = structuredClone(source), detached = new Activity(defaultPreferences(), mutable);
  (mutable.measures[0]!.notes[0] as {tieNext:boolean}).tieNext = true;
  assert.notEqual(detached.exercise.score.measures[0]!.notes[0]!.tieNext, mutable.measures[0]!.notes[0]!.tieNext);
});

test('all fixtures and seeded generated scores preserve historical attacks, rests and final tie-member timing', () => {
  const scores = presets.map(f => f.score);
  let seed = 20261015;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/2**32; };
  for (const meter of ['2/4','3/4','4/4','6/8'] as const) for (const measures of [1,2,3,4]) {
    scores.push(generateExercise({...defaultGeneration(),meters:[meter],measures,ingredients:ingredients.map(i=>i.id),ties:true,syncopation:true,allowUnintuitiveNotation:true},random));
  }
  for (const source of scores) {
    // Independent pre-migration timing implementation stays under tests only.
    const values = {whole:'W',half:'H',quarter:'Q',eighth:'E','16th':'S'} as const;
    const legacy: RhythmMeasure[] = source.measures.map(m=>({meter:m.meter,events:m.notes.map(n=>[values[n.type] as NoteValue,{rest:n.kind==='rest',dots:n.dots,tuplet:n.timeModification,tieNext:n.tieNext}])}));
    const old = legacyDerive(legacy), current = deriveScore(source);
    assert.deepEqual(current.attacks.map(a=>({start:a.start,duration:a.duration,sources:a.sources.map(s=>({measure:s.measure,event:s.event}))})),old.attacks);
    for (const bpm of [40,80,180]) {
      const pulse = source.measures[0]!.meter[1]===8 ? [3,8] as const : [1,4] as const;
      const seconds = (t: readonly [number,number]) => toNumber(divide(t,pulse))*60/bpm;
      const plan = planPassage(source.measures,bpm,undefined,pulse);
      assert.equal(plan.duration,seconds(old.length));
      let offset = [0, 1] as const as readonly [number, number];
      const rests = old.measures.flatMap((bar, measure) => {
        const result = bar.events.filter(e => e.kind === 'rest').map(e => ({start:seconds(add(offset,e.start)),end:seconds(add(offset,e.end)),source:{measure,event:e.index}}));
        offset = add(offset, bar.length); return result;
      });
      assert.deepEqual(plan.rests, rests);
      assert.deepEqual(plan.notes,old.attacks.map(a=>{const last=a.sources.at(-1)!;return {start:seconds(a.start),end:seconds(add(a.start,a.duration)),sources:a.sources,finalSegmentDuration:seconds(old.measures[last.measure]!.events[last.event]!.duration)};}));
    }
  }
});

test('position labels do not disclose expected counting tokens', () => {
  for (const fixture of presets) {
    const plan = new Activity(defaultPreferences(),fixture.score).countingPlan;
    for (const count of plan.counts) {
      assert.match(count.label,/^Measure \d+, (beat|count) \d+, offset \d+\/\d+ whole notes$/);
      assert.ok(!count.label.includes(`(${count.expectedToken})`));
    }
  }
});
