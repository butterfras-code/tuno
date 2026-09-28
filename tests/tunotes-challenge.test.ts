import test from 'node:test';
import assert from 'node:assert/strict';
import { Challenge, challengeScore, defaultTimed, defaultTarget, validateRules } from '../src/apps/tunotes/engine/challenge.ts';
import { defaultPreset, fingerprint } from '../src/apps/tunotes/domain/presets.ts';
import { NotesStore, parseBackup } from '../src/apps/tunotes/persistence/store.ts';
import type { ChallengeRules } from '../src/apps/tunotes/engine/challenge.ts';
function fixture(rules: ChallengeRules = defaultTimed) {
  let now = 0;
  const round = new Challenge(defaultPreset,rules,() => now,() => .5);
  return { round, set: (t: number) => { now = t; }, add: (ms: number) => { now += ms; }, begin: () => { round.ready(); now += 3000; round.tick(); } };
}
function respond(f: ReturnType<typeof fixture>, correct = true) {
  assert.equal(f.round.answer(f.round.token,correct ? f.round.pitch : { letter: f.round.pitch.letter === 'C' ? 'D' : 'C', accidental: 0 }),true);
  f.add(correct ? 250 : 800); f.round.advance(f.round.token);
}
test('rules are validated, copied and frozen; Ready/countdown accept no answers or active time', () => {
  for (const seconds of [NaN, Infinity, 1.5, 14, 301]) assert.throws(() => validateRules({ ...defaultTimed, seconds }));
  for (const bad of [{...defaultTarget,target:0},{...defaultTarget,timeout:601},{...defaultTarget,accuracyFloor:49},{...defaultTimed,extra:1}]) assert.throws(() => validateRules(bad));
  const config = {goal:'timed' as const,seconds:15,scoring:'adjusted' as const}; const f = fixture(config); config.seconds = 300;
  assert.equal(Object.isFrozen(f.round.rules),true); assert.equal(f.round.limitMs,15000);
  assert.equal(f.round.answer(f.round.token,f.round.pitch),false); f.set(10000); assert.equal(f.round.activeMs,0);
  f.round.ready(); f.add(2999); assert.equal(f.round.countdown,1); assert.equal(f.round.answer(f.round.token,f.round.pitch),false);
  f.add(1); f.round.tick(); assert.equal(f.round.phase,'playing'); assert.equal(f.round.activeMs,0);
});
test('exact deadline rejects input; delayed timers clamp time; feedback cannot extend allowance', () => {
  const f=fixture({goal:'timed',seconds:15,scoring:'adjusted'});f.begin();f.set(17999);
  assert.equal(f.round.answer(f.round.token,f.round.pitch),true);assert.equal(f.round.state,'feedback');
  f.set(18000);assert.equal(f.round.answer(f.round.token,f.round.pitch),false);assert.equal(f.round.state,'finished');assert.equal(f.round.activeMs,15000);assert.equal(f.round.qualified,true);
  const late=fixture({goal:'timed',seconds:15,scoring:'correct'});late.begin();late.set(90000);late.round.tick();assert.equal(late.round.activeMs,15000);assert.equal(late.round.score,0);assert.equal(late.round.qualified,false);
});
test('Target completes strictly before timeout without waiting for feedback', () => {
  const rules = {goal:'target' as const,target:1,timeout:15,accuracyFloor:80};
  const f=fixture(rules);f.begin();f.set(17999);assert.equal(f.round.answer(f.round.token,f.round.pitch),true);
  assert.equal(f.round.end,'completed');assert.equal(f.round.activeMs,14999);assert.equal(f.round.qualified,true);
  f.set(99999);f.round.tick();assert.equal(f.round.end,'completed');assert.equal(f.round.activeMs,14999);
  const late=fixture(rules);late.begin();late.set(18000);assert.equal(late.round.answer(late.round.token,late.round.pitch),false);assert.equal(late.round.end,'timeout');assert.equal(late.round.attempts,0);
});
test('formula fixtures and Target floor use exact counts, not rounded percentages', () => {
  assert.equal(challengeScore(24,30),19.2);assert.equal(challengeScore(25,25),25);assert.equal(challengeScore(0,0),0);
  for (const misses of [2,3]) { const f=fixture(defaultTarget);f.begin();for(let i=0;i<misses;i++)respond(f,false);for(let i=0;i<10;i++)respond(f);assert.equal(f.round.qualified,misses===2);assert.equal(f.round.attempts,10+misses); }
  const f=fixture({...defaultTimed,scoring:'correct'});f.begin();respond(f);respond(f,false);assert.equal(f.round.score,1);f.round.finish();assert.equal(f.round.qualified,false);assert.equal(f.round.end,'partial');
});
test('pauses preserve remaining countdown, prompt, feedback and time but invalidate ranking', () => {
  const f=fixture();f.round.ready();f.add(1000);f.round.pause();f.add(20000);assert.equal(f.round.countdown,2);f.round.resume();f.add(1999);f.round.tick();assert.equal(f.round.phase,'countdown');f.add(1);f.round.tick();
  const token=f.round.token;f.add(100);f.round.answer(token,f.round.pitch);f.add(100);f.round.pause();const duration=f.round.activeMs;f.add(5000);assert.equal(f.round.activeMs,duration);f.round.resume();assert.equal(f.round.advance(token),false);f.add(150);assert.equal(f.round.advance(token),true);
  f.add(60000);f.round.tick();assert.equal(f.round.qualified,false);assert.equal(f.round.interrupted,true);assert.equal(f.round.activeMs,60000);
});
test('stale prompt/session input and repeated finish cannot change results', () => {
  const f=fixture();f.begin();const token=f.round.token;respond(f);assert.equal(f.round.answer(token,f.round.pitch),false);
  const next=fixture();next.begin();assert.equal(next.round.answer(token,next.round.pitch),false);
  f.round.finish();const time=f.round.activeMs;f.add(100000);f.round.finish();assert.equal(f.round.end,'partial');assert.equal(f.round.activeMs,time);assert.equal(f.round.answer(f.round.token,f.round.pitch),false);
});
test('Challenge backups retain zero-attempt results, isolate learning and benchmarks, and validate outcomes', () => {
  const store=new NotesStore();store.update(d=>{d.profiles.push({id:'p',name:'Player',results:[],contexts:[],defaultPresetId:d.configuration.presetId});d.configuration.remember=true;d.configuration.profileId='p';});
  const f=fixture();f.begin();for(let i=0;i<24;i++){respond(f);store.observe('p',defaultPreset,f.round.last!);}
  f.add(60000);f.round.tick();store.record('p',f.round);
  assert.equal(store.challengeBenchmark(defaultPreset,false,defaultTimed),24);assert.equal(store.benchmark(defaultPreset),10);assert.equal(store.challengeBenchmark(defaultPreset,false,{...defaultTimed,seconds:30}),10);
  assert.equal(store.profile()!.contexts[0]!.fingerprint,fingerprint(defaultPreset,false,'challenge'));
  const empty=fixture();empty.round.finish();store.record('p',empty.round);assert.equal(store.profile()!.results.length,2);
  assert.deepEqual(parseBackup(store.export()),store.data);
  const bad=JSON.parse(store.export());bad.profiles[0].results[0].activeMs=1;assert.throws(()=>parseBackup(JSON.stringify(bad)));
  for(const version of [0,1,2,3]) { const old={...JSON.parse(store.export()),schemaVersion:version,profiles:[],configuration:{remember:false,profileId:null,presetId:defaultPreset.id,selfPaced:false}};if(version===0)delete old.configuration;assert.equal(parseBackup(JSON.stringify(old)).schemaVersion,4); }
});
