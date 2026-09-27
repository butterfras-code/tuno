import test from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHM_VERSION, activePool, expansionPlan, initialAdaptive, learn, mastered, observe, recommendation, selectAdaptive, weight } from '../src/apps/tunotes/engine/adaptive.ts';
import { beginnerPreview, previewGroups } from '../src/apps/tunotes/engine/preview.ts';
import { Practice } from '../src/apps/tunotes/engine/practice.ts';
import type { Observation } from '../src/apps/tunotes/engine/practice.ts';
import { defaultPreset, fingerprint, instrumentPresets, instrumentRangePresets, normalizePreset, presets } from '../src/apps/tunotes/domain/presets.ts';
import { chromatic, parsePitch, pitchLabel, staffPosition } from '../src/apps/tunotes/domain/notation.ts';
import { NotesStore, parseBackup } from '../src/apps/tunotes/persistence/store.ts';
const observation = (pitch = defaultPreset.pool[0]!, correct = true, responseMs = 1): Observation => ({ pitch, answer: correct ? pitch : {letter: pitch.letter === 'C' ? 'D' : 'C', accidental: 0}, correct, responseMs, activity: 'practice', preset: defaultPreset.id });
function rng(seed = 123) { return () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed/2**32; }; }

test('bounded outcomes, error weighting and mastery never depend on speed', () => {
  let notes = {};
  for (let i=0;i<30;i++) notes = observe(notes,observation(undefined,i>=25,999999));
  const records = Object.values(notes)[0] as Observation[];
  assert.equal(records.length,10); assert.ok(mastered(records));
  assert.equal(weight(),2); assert.equal(weight([observation(undefined,false)]),4); assert.equal(weight([observation()]),1);
  assert.equal(mastered(records.slice(-4)),false);
});
test('deterministic stable learning, lower/upper growth, all-pitch gates and finite bounds', () => {
  const run = () => {
    let state = initialAdaptive(); const random = rng(); const trace: string[][] = [];
    for(let i=0;i<6000 && state.expansionCount<expansionPlan(defaultPreset).length;i++) {
      const pool = activePool(defaultPreset,{algorithmVersion:1,expansionCount:state.expansionCount});
      const chosen = selectAdaptive(state,pool,random); assert.ok(pool.length===1 || pitchLabel(chosen.pitch)!==state.previous);
      const result = learn(chosen.state,observation(chosen.pitch,true,i%2 ? 1 : 999999),defaultPreset);
      if(result.added.length) {
        assert.ok(result.state.recent.filter(o=>o.correct).length>=18);
        assert.ok(pool.every(p=>mastered(result.state.notes[pitchLabel(p)])));
        assert.ok(chosen.state.sinceExpansion>=19);
        trace.push(result.added.map(pitchLabel));
      }
      state=result.state;
    }
    assert.equal(state.expansionCount,expansionPlan(defaultPreset).length);
    assert.deepEqual(trace.slice(0,2),[['D4'],['G5']]);
    assert.deepEqual(activePool(defaultPreset,{algorithmVersion:1,expansionCount:state.expansionCount}).map(p=>staffPosition(p,'treble')).sort((a,b)=>a-b),Array.from({length:25},(_,i)=>i-8));
    for(let i=0;i<30;i++) state=learn(state,observation(),defaultPreset).state;
    assert.equal(state.expansionCount,trace.length); return trace;
  };
  assert.deepEqual(run(),run());
});
test('aggregate accuracy cannot bypass one unmastered pitch or the 20-answer interval', () => {
  let state=initialAdaptive();
  for(const p of defaultPreset.pool) for(let i=0;i<5;i++) state.notes=observe(state.notes,observation(p));
  state.notes={...state.notes,[pitchLabel(defaultPreset.pool.at(-1)!)]:[observation(defaultPreset.pool.at(-1),false)]};
  for(let i=0;i<100;i++) { const next=learn(state,observation(),defaultPreset); assert.equal(next.added.length,0); state=next.state; }
  for(let i=0;i<5;i++) state=learn(state,observation(defaultPreset.pool.at(-1)),defaultPreset).state;
  assert.equal(state.expansionCount,1);
  for(let i=0;i<19;i++) { const next=learn(state,observation(),defaultPreset); assert.equal(next.added.length,0); state=next.state; }
});
test('repeated errors focus ten prompts, contrasts cannot consume protected review, recovery retains history', () => {
  let state=initialAdaptive();
  for(let i=0;i<20;i++) state=learn(state,observation(undefined,false),defaultPreset).state;
  assert.equal(state.focusRemaining,10); assert.equal(state.focus.length,4); assert.equal(state.contrast.length,2);
  for(let i=1;i<=10;i++) {
    const next=selectAdaptive(state,defaultPreset.pool,()=>.1);
    if(i%5===0) { assert.equal(next.kind,'review'); assert.ok(!state.focus.includes(pitchLabel(next.pitch))); }
    state=next.state;
  }
  assert.equal(state.focusRemaining,0); assert.equal(state.contrast.length,0);
  for(const pitch of defaultPreset.pool) for(let i=0;i<10;i++) state=learn(state,observation(pitch),defaultPreset).state;
  assert.ok(state.recent.every(o=>o.correct)); assert.ok(Object.values(state.notes).every(r=>r.length<=10));
});
test('one-note Custom terminates, remains bounded, adaptive-off ignores restored expansion', () => {
  const custom=normalizePreset({...defaultPreset,id:'one',range:['C4','C4']});
  const game=new Practice(custom,true,()=>0,()=>0,{adaptive:true});
  for(let i=0;i<100;i++) { game.answer(game.token,game.pitch); game.advance(game.token,true); }
  assert.equal(game.activePreset.pool.length,1); assert.equal(game.savedLearning.expansionCount,0);
  const off=new Practice(defaultPreset,true,()=>0,rng(),{adaptive:false,learning:{algorithmVersion:1,expansionCount:10}});
  const seen=new Set<string>(); for(let i=0;i<9;i++) { seen.add(pitchLabel(off.pitch)); off.answer(off.token,off.pitch); off.advance(off.token,true); }
  assert.deepEqual([...seen].sort(),defaultPreset.pool.map(pitchLabel).sort());
  assert.deepEqual(expansionPlan(normalizePreset({...defaultPreset,id:'custom',range:['D4','F5']})),[]);
  assert.equal(initialAdaptive(game.learning.notes,{algorithmVersion:99,expansionCount:5}).expansionCount,0);
  assert.deepEqual(initialAdaptive(game.learning.notes,{algorithmVersion:99,expansionCount:5}).notes,{});
});
test('approved instrument levels are exact perfect intervals and replace old bounds', () => {
  for(const starter of instrumentPresets) {
    const levels=instrumentRangePresets.filter(p=>p.instrument===starter.instrument);
    assert.equal(levels.length,3);
    const first=chromatic(starter.pool[0]!);
    assert.deepEqual(levels.map(p=>[chromatic(p.pool[0]!)-first,chromatic(p.pool.at(-1)!)-first]),[[0,12],[-7,12],[-7,17]]);
    for(const preset of [starter,...levels]) {
      const expanded=activePool(preset,{algorithmVersion:1,expansionCount:189});
      assert.equal(Math.min(...expanded.map(chromatic)),first-7); assert.equal(Math.max(...expanded.map(chromatic)),first+17);
    }
  }
  for(const p of presets.filter(p=>p.id.endsWith('-above'))) assert.ok(expansionPlan(p).flat().every(n=>staffPosition(n,p.clef)>8));
  for(const p of presets.filter(p=>p.id.endsWith('-below'))) assert.ok(expansionPlan(p).flat().every(n=>staffPosition(n,p.clef)<0));
});
test('profile weights, adaptive toggles, benchmarks, expanded contexts and preview metadata survive backup independently', () => {
  const data=new Map<string,string>(); const store=new NotesStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);}});
  store.update(d=>{d.profiles=[{id:'a',name:'A',results:[],contexts:[],adaptive:true,preview:false},{id:'b',name:'B',results:[],contexts:[]}];d.configuration.remember=true;d.configuration.profileId='a';});
  const game=new Practice(defaultPreset,true,()=>0,rng(),{adaptive:true});
  game.preview={shown:true,skipped:false,completed:true};
  for(let i=0;i<300;i++) {game.answer(game.token,game.pitch);store.observe('a',game.preset,game.last!,true,game.savedLearning);game.advance(game.token,true);}
  game.finish();store.record('a',game);store.flush();
  const snapshot=parseBackup(store.export());assert.deepEqual(snapshot,store.data);
  assert.ok(snapshot.profiles[0]!.contexts[0]!.learning!.expansionCount>0);
  assert.deepEqual(snapshot.profiles[1]!.contexts,[]); assert.equal(store.benchmark(defaultPreset,true),20);assert.equal(store.benchmark(defaultPreset,false),10);
  assert.deepEqual(snapshot.profiles[0]!.results[0]!.preview,game.preview);
  store.update(d=>{d.configuration.profileId='b';});assert.equal(store.benchmark(defaultPreset,true),10);
  const before=store.export();store.observe(undefined,defaultPreset,observation());assert.equal(store.export(),before);
  const corrupt=structuredClone(snapshot);corrupt.profiles[0]!.contexts[0]!.learning!.expansionCount=999;assert.throws(()=>parseBackup(JSON.stringify(corrupt)));
  const legacy=structuredClone(snapshot);delete legacy.profiles[0]!.results[0]!.preview;assert.equal(parseBackup(JSON.stringify(legacy)).profiles[0]!.results[0]!.preview,undefined);
  assert.notEqual(fingerprint(defaultPreset),fingerprint(defaultPreset,true));
});
test('preview pools sort explicit spellings, group large pools and include restored growth; recommendations are observational', () => {
  const mixed=normalizePreset({...defaultPreset,id:'mixed',range:['C4','C6'],editorVersion:2,availableClefs:['treble','bass'],endpointClefs:['bass','treble'],modifiers:['natural','sharp','flat']});
  const groups=previewGroups(mixed);assert.ok(groups.every(g=>g.length<=4));
  const pitches=groups.flat();assert.equal(pitches.length,mixed.pool.length);assert.deepEqual(pitches.map(chromatic),pitches.map(chromatic).sort((a,b)=>a-b));
  assert.ok(pitches.some(p=>pitchLabel(p)==='D♭4'));assert.ok(pitches.some(p=>pitchLabel(p)==='C♯4'));
  assert.ok(beginnerPreview(defaultPreset));assert.ok(!beginnerPreview(mixed));
  const grown={...defaultPreset,pool:activePool(defaultPreset,{algorithmVersion:ALGORITHM_VERSION,expansionCount:2})};
  assert.equal(previewGroups(grown).flat().length,11);
  assert.match(recommendation(20,18,{}),/broader/);assert.match(recommendation(20,13,{C4:[observation(parsePitch('C4'),false)]}),/C4/);assert.match(recommendation(19,19,{}),/own pace/);
});
test('the final focus/review prompt still blocks expansion until the block ends', () => {
  let state=initialAdaptive();
  for(const p of defaultPreset.pool) for(let i=0;i<5;i++) state.notes=observe(state.notes,observation(p));
  state={...state,focus:defaultPreset.pool.slice(0,4).map(pitchLabel),focusRemaining:1,sinceExpansion:20,recent:Array.from({length:20},()=>observation())};
  const lastFocus=selectAdaptive(state,defaultPreset.pool,()=>.2);
  assert.equal(lastFocus.state.focusRemaining,0);
  const blocked=learn(lastFocus.state,observation(lastFocus.pitch),defaultPreset);
  assert.equal(blocked.added.length,0);
  const normal=selectAdaptive(blocked.state,defaultPreset.pool,()=>.2);
  assert.equal(learn(normal.state,observation(normal.pitch),defaultPreset).added.length,1);
});
test('schema 2 results migrate with unknown preview exposure and no inferred learning', () => {
  const store=new NotesStore();
  const old={...store.data,schemaVersion:2};
  const migrated=parseBackup(JSON.stringify(old));assert.equal(migrated.schemaVersion,3);assert.deepEqual(migrated.profiles,[]);assert.equal(old.schemaVersion,2);
  assert.match(recommendation(100,10,{}, {C4:20,D4:10,E4:30}),/E4 and C4/);
});
