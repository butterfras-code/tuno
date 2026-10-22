import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTeachingPreset, teachingPresets, customizeTeachingPreset } from '../src/apps/rhythm-walk/shared/teaching-presets.ts';
import { defaultGeneration, generateExercise, generationIssue } from '../src/apps/rhythm-walk/shared/generation.ts';
import { Activity, defaultPreferences, readPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { buildCountingPlan } from '../src/music/counting/plan.ts';
import { defaultCountingPreferences } from '../src/music/counting/preferences.ts';
import { evaluateAnswer, enterToken, initializeAnswer } from '../src/music/counting/answer.ts';
import { deriveScore } from '../src/music/score.ts';
import type { ScoreMeasure } from '../src/music/score.ts';
import type { CountMeter } from '../src/apps/rhythm-walk/shared/meter.ts';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';

// Independent grammar and duration oracle, not derived from production figure definitions.
const grammar: Record<string, string[]> = { Q:['Q'], H:['H'], 'H.':['H.'], W:['W'], EE:['E','E'], 'Q.E':['Q.','E'], EQE:['E','Q','E'], 'E.S':['E.','S'], ESS:['E','S','S'], SSSS:['S','S','S','S'] };
const durations: Record<string,number> = {Q:4,H:8,'H.':12,W:16,E:2,'Q.':6,'E.':3,S:1};
const values = { quarter:'Q',half:'H',whole:'W',eighth:'E','16th':'S' };
const expected = (level:number,scope:string) => ['Q','H','H.','W','EE',...(level>=3?['Q.E']:[]),...(level===4?['EQE','E.S','ESS','SSSS']:scope==='percussion'?['ESS','SSSS',...(level===3?['E.S']:[])]:[])];
const meters = (level:number):CountMeter[] => level<3?['4/4']:['2/4','3/4','4/4'];
function config(level:number,scope:'general'|'percussion') {
  const result=applyTeachingPreset(defaultGeneration(),teachingPresets[level-1]!,undefined,scope);
  assert.ok(result.supported); return result.settings;
}
function parse(bar:ScoreMeasure,allowed:string[]) {
  const symbols=bar.notes.map(n=>{assert.equal(n.kind,'note');assert.equal(n.tieNext,false);assert.equal(n.timeModification,undefined);return values[n.type]+(n.dots?'.':'');});
  assert.equal(symbols.reduce((n,s)=>n+durations[s]!,0),bar.meter[0]*4);
  function walk(i:number,position:number):string[]|null {
    if(i===symbols.length)return [];
    if(position%4)return null;
    for(const id of allowed){const word=grammar[id]!;if(!word.every((v,j)=>v===symbols[i+j]))continue;
      const rest=walk(i+word.length,position+word.reduce((n,s)=>n+durations[s]!,0));if(rest)return [id,...rest];}
    return null;
  }
  const result=walk(0,0);assert.ok(result,`Forbidden permutation: ${symbols}`);return result;
}
const seed=(n:number)=>()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/2**32;};
test('I–IV both scopes, all meters and lengths use complete figures and the live counting core',()=>{
  for(let level=1;level<=4;level++)for(const scope of ['general','percussion'] as const)for(const meter of meters(level))for(const measures of [1,2,3,4]){
    for(let sample=0;sample<12;sample++){
      const source=generateExercise({...config(level,scope),meters:[meter],measures},seed(sample+17));
      assert.equal(source.measures.length,measures);deriveScore(source);
      for(const bar of source.measures){assert.equal(bar.meter.join('/'),meter);parse(bar,expected(level,scope));}
      for(const vocabulary of ['numbers','syllables'] as const)for(const dotted of [false,true])for(const longNotes of [false,true]){
        const plan=buildCountingPlan(source,{...defaultCountingPreferences,vocabulary,dotted,longNotes});assert.equal(plan.source,source);
        const answer={counts:Object.fromEntries(plan.counts.map(c=>[c.id,c.expectedToken])),units:Object.fromEntries(plan.units.map(u=>[u.id,{restMarked:false,durationIndicated:u.durationApplicable}]))};
        assert.equal(evaluateAnswer(plan,answer).tokens.verdict,'correct');
      }
    }
  }
});
test('every eligible figure is reachable deterministically without filler or partial atoms',()=>{
  for(let level=1;level<=4;level++)for(const scope of ['general','percussion'] as const)for(const meter of meters(level)){
    const wanted=expected(level,scope).filter(id=>meter==='2/4'?!['H.','W'].includes(id):meter==='3/4'?id!=='W':true), seen=new Set<string>();
    for(let i=0;i<100;i++)parse(generateExercise({...config(level,scope),meters:[meter],measures:1},()=>i/100).measures[0]!,expected(level,scope)).forEach(id=>seen.add(id));
    assert.deepEqual([...seen].sort(),wanted.sort());
  }
});
test('single-meter generation, completed performance and immutable shared mode identity',()=>{
  for(let level=1;level<=4;level++)for(const scope of ['general','percussion'] as const){
    const g={...config(level,scope),measures:4};const source=generateExercise(g,seed(level));
    assert.equal(new Set(source.measures.map(m=>m.meter.join('/'))).size,1);
    const a=new Activity({...defaultPreferences(),generation:g},source),exercise=a.exercise,plan=a.countingPlan;
    a.countingAnswer=enterToken(plan,initializeAnswer(plan),plan.counts[0]!.id,'1');const answer=a.countingAnswer;
    for(const mode of ['write','tap','both'] as const){a.setMode(mode);assert.equal(a.exercise,exercise);assert.equal(a.countingPlan,plan);assert.equal(a.countingAnswer,answer);}
    for(const style of ['tap','hold'] as const){const c=new Capture(exercise,60,true,undefined,undefined,style);
      for(const n of c.plan.notes){c.input('down','keyboard',n.start,n.start*1000);c.input('up','keyboard',n.end-.01,(n.end-.01)*1000);}
      const result=evaluateAttempt(c.advance(c.plan.captureEnd)!);assert.equal(result.status,'completed');assert.deepEqual(result.missing,[]);assert.deepEqual(result.extra,[]);assert.ok(result.matches.every(m=>m.attackAccepted));}
    a.next();assert.notEqual(a.exercise,exercise);assert.ok(Object.values(a.countingAnswer.counts).every(v=>v===''));
    assert.deepEqual(readPreferences(JSON.stringify({...defaultPreferences(),generation:g})).generation,g);
    assert.equal(customizeTeachingPreset({...g,ties:true}).figureProfile,undefined);
  }
});
test('deferred profiles and meter changes cannot generate; old saved settings acquire no new vocabulary',()=>{
  const g=config(4,'percussion');
  for(const bad of [{...g,meterChanges:1},{...g,figureProfile:{version:1 as const,level:5,scope:'general' as const}},{...g,meters:['6/8' as const]}]){assert.ok(generationIssue(bad));assert.throws(()=>generateExercise(bad));}
  for(const id of ['uil-1','uil-4','uil-5','uil-6'])for(const version of [1,2]){
    const old={...defaultPreferences(),generation:{...defaultGeneration(),ingredients:['quarter'],meters:['2/2'],meterChanges:2,teachingPreset:{id,version,customized:false}}};
    const restored=readPreferences(JSON.stringify(old));assert.deepEqual(restored.generation.ingredients,['quarter']);assert.deepEqual(restored.generation.meters,['4/4']);assert.equal(restored.generation.teachingPreset?.customized,true);assert.equal(restored.generation.figureProfile,undefined);assert.equal(restored.generation.meterChanges,undefined);
  }
});
test('UIL percussion fixture has explicit counts in both vocabularies',async()=>{
  const { practiceFixtures }=await import('../src/apps/rhythm-walk/shared/fixtures.ts');
  const source=practiceFixtures.find(f=>f.id==='uil-percussion')!.score;
  assert.deepEqual(buildCountingPlan(source).counts.map(c=>c.expectedToken),['1','&','a','2','e','&','a','3','4']);
  assert.deepEqual(buildCountingPlan(source,{...defaultCountingPreferences,vocabulary:'syllables'}).counts.map(c=>c.expectedToken),['1','te','ta','2','ta','te','ta','3','4']);
});
