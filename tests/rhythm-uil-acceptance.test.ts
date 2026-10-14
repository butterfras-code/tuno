import { generationCapabilities } from '../src/apps/rhythm-walk/shared/capabilities.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTeachingPreset, teachingPresets, customizeTeachingPreset, resolveTeachingPreset } from '../src/apps/rhythm-walk/shared/teaching-presets.ts';
import { defaultGeneration, generateExercise, generationIssue, rhythmCapabilities } from '../src/apps/rhythm-walk/shared/generation.ts';
import { figureAllowedAt, figurePlan } from '../src/apps/rhythm-walk/shared/figures.ts';
import type { FigureId } from '../src/apps/rhythm-walk/shared/figures.ts';
import type { CountMeter } from '../src/apps/rhythm-walk/shared/meter.ts';
import { deriveMeasure } from '../src/music/measure.ts';
import type { RhythmMeasure } from '../src/music/measure.ts';
import { countGrid } from '../src/apps/count-writing/grid.ts';
import { evaluatePassage, blankAnswer } from '../src/apps/count-writing/evaluation.ts';
import { planPassage } from '../src/apps/rhythm-walk/timing.ts';
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { evaluateAttempt } from '../src/apps/rhythm-walk/evaluation.ts';
import { Activity, defaultPreferences, readPreferences } from '../src/apps/rhythm-walk/activity.ts';

// Independent acceptance grammar, in sixteenth units. Never import production figure data.
const grammar: Record<string, string[]> = { Q:['Q'], H:['H'], 'H.':['H.'], W:['W'], EE:['E','E'], 'Q.E':['Q.','E'], EQE:['E','Q','E'], 'E.S':['E.','S'], ESS:['E','S','S'], SSSS:['S','S','S','S'], SSE:['S','S','E'], T:['T','T','T'] };
const units: Record<string, number> = { Q:4,H:8,'H.':12,W:16,E:2,'Q.':6,'E.':3,S:1,T:4/3 };
const expected = (level:number, scope:string) => ['Q','H','H.','W','EE', ...(level>=3?['Q.E']:[]), ...(level>=4?['EQE','E.S','ESS','SSSS']:scope==='percussion'?['ESS','SSSS',...(level===3?['E.S']:[])]:[]), ...(level>=5?['SSE','T']:[])];
const allowedMeters = (level:number): CountMeter[] => level<3?['4/4']:level<5?['2/4','3/4','4/4']:['2/4','3/4','4/4','6/8','2/2'];
const seed = (n:number) => () => { n=(Math.imul(n,1664525)+1013904223)>>>0; return n/2**32; };
function configured(level:number, scope:'general'|'percussion') {
  const result=applyTeachingPreset(defaultGeneration(),teachingPresets[level-1]!,undefined,scope);
  assert.ok(result.supported); return result.settings;
}
function parse(bar:RhythmMeasure, ids:string[]): string[] {
  const symbols=bar.events.map(([v,m])=>{assert.ok(!m?.rest && !m?.tieNext);return m?.tuplet?'T':v+(m?.dots?'.':'');});
  function walk(i:number, position:number): string[]|null {
    if(i===symbols.length)return [];
    for(const id of ids){
      const word=grammar[id]!;
      if(!word.every((s,j)=>s===symbols[i+j]))continue;
      if(bar.meter[1]===8 ? !((position===0 && ['H.','Q.E','EQE'].includes(id)) || position===8 && id==='EE') : position%4!==0)continue;
      if(bar.meter[1]===2 && ['E.S','ESS','SSSS','SSE','T'].includes(id))continue;
      const rest=walk(i+word.length,position+word.reduce((n,s)=>n+units[s]!,0));
      if(rest)return [id,...rest];
    } return null;
  }
  const parsed=walk(0,0);assert.ok(parsed,`Unlisted or misplaced figure: ${symbols.join(' ')}`);return parsed;
}
test('every level/scope/meter/length generates complete independent figure grammar and shared count grids',()=>{
  for(let level=1;level<=6;level++)for(const scope of ['general','percussion'] as const)for(const meter of allowedMeters(level))for(const measures of [1,2,3,4]){
    const config={...configured(level,scope),meters:[meter],measures};
    assert.equal(generationIssue(config),null);
    for(let sample=0;sample<24;sample++){
      const passage=generateExercise(config,seed(sample+43));assert.equal(passage.length,measures);
      for(const bar of passage){assert.equal(bar.meter.join('/'),meter);assert.deepEqual(deriveMeasure(bar).length,meter==='2/4'?[1,2]:meter==='3/4'||meter==='6/8'?[3,4]:[1,1]);parse(bar,expected(level,scope));for(const system of ['numbers','syllables'] as const)countGrid(bar,system);}
    }
  }
});
test('every eligible figure is deterministically reachable; impossible placements are rejected',()=>{
  for(let level=1;level<=6;level++)for(const scope of ['general','percussion'] as const)for(const meter of allowedMeters(level)){
    const config={...configured(level,scope),meters:[meter],measures:1};
    const wanted=expected(level,scope).filter(id=>meter==='6/8'?['H.','Q.E','EQE','EE'].includes(id):meter==='2/2'?!['E.S','ESS','SSSS','SSE','T'].includes(id):meter==='2/4'?!['H.','W'].includes(id):meter==='3/4'?id!=='W':true);
    const seen=new Set<string>();
    // Enumerate each first-choice interval with a deterministic constant stream.
    for(let index=0;index<120;index++)parse(generateExercise(config,()=>index/120)[0]!,expected(level,scope)).forEach(id=>seen.add(id));
    assert.deepEqual([...seen].sort(),wanted.sort(),`${level}/${scope}/${meter}`);
    const plan=figurePlan(config.figureProfile!,meter);
    assert.deepEqual(plan.choicesAt([0,1]).map(f=>f.id).sort(),wanted.filter(id=>meter!=='6/8'||id!=='EE').sort());
  }
  for(const id of Object.keys(grammar) as FigureId[])assert.equal(figureAllowedAt(id,'4/4',[1,8]),false);
  for(const id of ['T','SSSS','E.S','ESS','SSE'] as FigureId[])assert.equal(figureAllowedAt(id,'2/2',[0,1]),false);
  assert.equal(figureAllowedAt('EE','6/8',[0,1]),false);
});
test('scaled cut-time counts, fixed 6/8 counts, exact timing and completed assessment',()=>{
  const cut:RhythmMeasure={meter:[2,2],events:Array.from({length:8},()=>['E'])};
  assert.deepEqual(countGrid(cut).slots.map(s=>s.symbol),['1','e','&','a','2','e','&','a']);
  assert.deepEqual(countGrid(cut,'syllables').slots.map(s=>s.symbol),['1','ta','te','ta','2','ta','te','ta']);
  assert.deepEqual(countGrid(cut).slots.flatMap((s,i)=>s.onPulse?[i]:[]),[0,4]);
  for(const system of ['numbers','syllables'] as const){const a=blankAnswer(cut);a.symbols=countGrid(cut,system).slots.map(s=>s.symbol);assert.equal(evaluatePassage([cut],[a],'required',[],system)[0]!.counts.verdict,'correct');}
  const mixed:RhythmMeasure[]=[cut,{meter:[6,8],events:[['Q',{dots:1}],['Q',{dots:1}]]},{meter:[3,4],events:[['Q'],['Q'],['Q']]}];
  const p=planPassage(mixed,60);assert.equal(p.countIn,4);assert.equal(p.duration,7);assert.deepEqual(p.pulses.filter(p=>p.countIn).map(p=>p.time),[-4,-3,-2,-1]);
  assert.deepEqual(p.pulses.filter(p=>!p.countIn).map(p=>p.time),[0,1,2,3,4,5,6]);
  assert.deepEqual(p.notes.map(n=>n.start),[0,.25,.5,.75,1,1.25,1.5,1.75,2,3,4,5,6]);
  assert.deepEqual(countGrid(mixed[1]!).slots.map(s=>s.symbol),['1','2','3','4','5','6']);
  for(const style of ['tap','hold'] as const){const c=new Capture({id:'mixed',label:'Mixed',description:'',measures:mixed},60,true,undefined,undefined,style);for(const n of c.plan.notes){c.input('down','keyboard',n.start,n.start*1000);c.input('up','keyboard',n.end-.01,(n.end-.01)*1000);}const result=evaluateAttempt(c.advance(c.plan.captureEnd)!);assert.equal(result.status,'completed');assert.deepEqual(result.missing,[]);assert.deepEqual(result.extra,[]);assert.ok(result.matches.every(m=>m.attackAccepted));}
  assert.ok(!rhythmCapabilities('2/2').ingredients.includes('sixteenth'));
  assert.throws(()=>countGrid({meter:[2,2],events:Array.from({length:16},()=>['S'])}));
});
test('bounded meter changes, persistence, customization and independent mode identity',()=>{
  for(let level=1;level<=6;level++)for(const scope of ['general','percussion'] as const)for(const length of [1,2,3,4]){
    const g={...configured(level,scope),measures:length,meterChanges:Math.max(0,level-3)};
    const bars=generateExercise(g,()=>.99);const changes=bars.filter((b,i)=>i&&b.meter.join('/')!==bars[i-1]!.meter.join('/')).length;
    assert.equal(changes,Math.min(length-1,Math.max(0,level-3)));
    const prefs={...defaultPreferences(),generation:g};const restored=readPreferences(JSON.stringify(prefs));assert.deepEqual(restored.generation,g);
    const a=new Activity(restored,bars), identity=a.exercise;for(const mode of ['write','tap','both'] as const){a.setMode(mode);assert.equal(a.exercise,identity);}
    const custom=customizeTeachingPreset({...g,ties:true});assert.equal(custom.figureProfile,undefined);assert.equal(custom.meterChanges,undefined);assert.equal(custom.teachingPreset?.customized,true);
  }
  const old={...defaultPreferences(),generation:{...defaultGeneration(),ingredients:['quarter' as const],teachingPreset:{id:'uil-6',version:1,customized:false}}};
  const migrated=readPreferences(JSON.stringify(old));assert.deepEqual(migrated.generation.ingredients,['quarter']);assert.equal(migrated.generation.figureProfile,undefined);assert.equal(migrated.generation.teachingPreset?.customized,true);
});

test('invalid profile settings cannot silently fall back or retain exact persisted identity',()=>{
  const g=configured(6,'percussion');
  for(const bad of [{...g,ingredients:[]},{...g,ties:true},{...g,meterChanges:4},{...g,figureProfile:{...g.figureProfile!,version:2 as 1}}]){
    assert.ok(generationIssue(bad));assert.throws(()=>generateExercise(bad));
  }
  const free={...defaultGeneration(),meterChanges:1};assert.ok(generationIssue(free));assert.throws(()=>generateExercise(free));
  for(const invalid of [{...g,teachingPreset:{...g.teachingPreset!,scope:'invalid'}},{...g,meterChanges:-1},{...g,figureProfile:{...g.figureProfile!,scope:'invalid'}}]){
    const restored=readPreferences(JSON.stringify({...defaultPreferences(),generation:invalid}));assert.equal(restored.generation.teachingPreset?.customized,true);assert.equal(restored.generation.figureProfile,undefined);
  }
});

test('meter capabilities distinguish reachable UIL atoms from unrestricted ingredient support',()=>{
  const capabilities=generationCapabilities();
  assert.ok(capabilities.byMeter!['6/8']!.figures!.includes('H.'));
  assert.ok(!capabilities.byMeter!['6/8']!.ingredients.includes('dotted-half'));
  assert.deepEqual([...capabilities.byMeter!['2/2']!.figures!].sort(),['Q','H','H.','W','EE','Q.E','EQE'].sort());
  const missing=structuredClone(capabilities);missing.byMeter!['4/4']!.figures=missing.byMeter!['4/4']!.figures!.filter(id=>id!=='ESS');
  assert.equal(resolveTeachingPreset(teachingPresets[0]!,missing,'general').supported,true);
  assert.equal(resolveTeachingPreset(teachingPresets[0]!,missing,'percussion').supported,false);
});
