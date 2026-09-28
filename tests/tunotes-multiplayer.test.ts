import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, standings, displayNames, canPair } from '../src/apps/tunotes/engine/multiplayer.ts';
import { Challenge } from '../src/apps/tunotes/engine/challenge.ts';
import { defaultPreset } from '../src/apps/tunotes/domain/presets.ts';
import { fingerprint } from '../src/apps/tunotes/domain/presets.ts';
import { NotesStore } from '../src/apps/tunotes/persistence/store.ts';

test('turns and pairs cover every roster size once, with an odd final solo heat',() => {
  for (let size=1;size<=8;size++) {
    const roster = Array.from({length:size},(_,i)=>i);
    for (const format of ['turns','pairs'] as const) {
      const heats = schedule(roster,format);
      assert.deepEqual(heats.flat(),roster);
      assert.equal(heats.length,Math.ceil(size/(format === 'pairs' ? 2 : 1)));
      assert.equal(heats.at(-1)!.length,format === 'pairs' && size%2 ? 1 : format === 'pairs' ? 2 : 1);
    }
  }
  assert.throws(()=>schedule([], 'turns'));
  assert.throws(()=>schedule(Array(9).fill(0),'pairs'));
  assert.equal(canPair(960,600),true); assert.equal(canPair(959,600),false); assert.equal(canPair(960,599),false);
});

test('paired Challenge instances have isolated deadlines, answers, completion and shared interruption',() => {
  let now=0;
  const rules={goal:'target',target:1,timeout:15,accuracyFloor:80} as const;
  const a=new Challenge(defaultPreset,rules,()=>now,()=>0), b=new Challenge(defaultPreset,rules,()=>now,()=>0);
  a.ready(now); b.ready(now); now=3000; a.tick(); b.tick();
  assert.equal(a.answer(a.token,{letter:a.pitch.letter,accidental:a.pitch.accidental}),true);
  assert.equal(a.state,'finished'); assert.equal(b.state,'running'); assert.equal(b.attempts,0);
  const stale=a.token; assert.equal(a.answer(stale,{letter:a.pitch.letter,accidental:a.pitch.accidental}),false);
  b.pause(); now=9000; b.resume(); assert.equal(b.activeMs,0);
  assert.equal(b.answer(b.token,{letter:b.pitch.letter,accidental:b.pitch.accidental}),true);
  assert.equal(a.interrupted,false); assert.equal(b.interrupted,true);
  assert.equal(a.qualified,true); assert.equal(b.qualified,false);
});

test('qualified exact ties share rank; unranked rows retain roster order and duplicate names show session numbers',() => {
  let now=0;
  const rules={goal:'timed',seconds:15,scoring:'adjusted'} as const;
  const roster=Array.from({length:4},(_,i)=>({id:String(i),name:i<2?'Sam':`Player ${i+1}`}));
  const sessions=roster.map(()=>new Challenge(defaultPreset,rules,()=>now,()=>0));
  sessions.forEach(s=>s.ready(now)); now=3000; sessions.forEach(s=>s.tick());
  for (const s of sessions.slice(0,2)) s.answer(s.token,{letter:s.pitch.letter,accidental:s.pitch.accidental});
  sessions[2]!.pause(); sessions[2]!.resume();
  now=18000; sessions.forEach(s=>s.tick());
  const rows=standings(roster.map((player,i)=>({player,session:sessions[i]!})),rules);
  assert.deepEqual(rows.map(row=>row.player.id),['0','1','2','3']);
  assert.deepEqual(rows.map(row=>row.rank),[1,1,undefined,undefined]);
  const names=displayNames(roster); assert.equal(names.get('0'),'Sam · Seat 1'); assert.equal(names.get('1'),'Sam · Seat 2');
});

test('independent profile observations persist across a fresh retry without carrying round counters',() => {
  const memory=new Map<string,string>();
  const storage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{memory.set(key,value);},removeItem:(key:string)=>{memory.delete(key);}};
  const store=new NotesStore(storage);
  store.update(data=>{data.profiles.push({id:'one',name:'One',results:[],contexts:[]},{id:'two',name:'Two',results:[],contexts:[]});data.configuration.remember=true;});
  let now=0; const rules={goal:'target',target:1,timeout:15,accuracyFloor:80} as const;
  const first=new Challenge(defaultPreset,rules,()=>now,()=>0,{adaptive:true});
  const second=new Challenge(defaultPreset,rules,()=>now,()=>0,{adaptive:false});
  first.ready(now);second.ready(now);now=3000;first.tick();second.tick();
  first.answer(first.token,{letter:first.pitch.letter,accidental:first.pitch.accidental});
  second.answer(second.token,{letter:'A',accidental:0});
  store.observe('one',first.preset,first.last!,first.adaptive,first.savedLearning);
  store.observe('two',second.preset,second.last!,second.adaptive,second.savedLearning);
  store.flush();
  assert.equal(store.data.profiles[0]!.contexts.length,1);
  assert.equal(store.data.profiles[1]!.contexts.length,1);
  assert.notEqual(store.data.profiles[0]!.contexts[0]!.fingerprint,store.data.profiles[1]!.contexts[0]!.fingerprint);
  const saved=new NotesStore(storage);
  const context=saved.data.profiles[0]!.contexts.find(c=>c.fingerprint===fingerprint(defaultPreset,true,'challenge'))!;
  const retry=new Challenge(defaultPreset,rules,()=>now,()=>0,{adaptive:true,notes:context.notes,learning:context.learning});
  assert.equal(retry.attempts,0);assert.equal(retry.correct,0);assert.equal(retry.phase,'ready');
  assert.equal(Object.keys(retry.learning.notes).length,1);
});

test('Target ranks by recorded integer milliseconds and excludes interrupted completion',() => {
  let now=0; const rules={goal:'target',target:1,timeout:15,accuracyFloor:80} as const;
  const roster=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}];
  const sessions=roster.map(()=>new Challenge(defaultPreset,rules,()=>now,()=>0));
  sessions.forEach(s=>s.ready(now)); now=3000; sessions.forEach(s=>s.tick());
  now=4123.1;sessions[0]!.answer(sessions[0]!.token,{letter:sessions[0]!.pitch.letter,accidental:sessions[0]!.pitch.accidental});
  now=4123.9;sessions[1]!.answer(sessions[1]!.token,{letter:sessions[1]!.pitch.letter,accidental:sessions[1]!.pitch.accidental});
  sessions[2]!.pause();sessions[2]!.resume();
  now=4124.2;sessions[2]!.answer(sessions[2]!.token,{letter:sessions[2]!.pitch.letter,accidental:sessions[2]!.pitch.accidental});
  const rows=standings(roster.map((player,i)=>({player,session:sessions[i]!})),rules);
  assert.deepEqual(rows.map(row=>row.rank),[1,1,undefined]);
});
