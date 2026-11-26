import { NotesStore, validateSnapshot } from '../src/apps/tunotes/persistence/store.ts';
import { captureRange, notesAdapter } from '../src/apps/tunotes/sharing.ts';
import { defaultTimed } from '../src/apps/tunotes/engine/challenge.ts';
import { activityUrl, readActivityLink } from '../src/shared/sharing/activity-link.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoValues, defaultAuto, quarterBeats } from '../src/apps/tunotes/engine/auto-every.ts';
import { Practice } from '../src/apps/tunotes/engine/practice.ts';
import { presets } from '../src/apps/tunotes/domain/presets.ts';

test('written windows commit previews, allow recovery, expire once and gate resumed input', () => {
  assert.deepEqual(autoValues.map(quarterBeats),[1,2,3,4]);
  assert.equal(defaultAuto.lookahead,true);
  assert.equal(defaultAuto.sound,true);
  let now = 0, expired = 0;
  const s = new Practice(presets[0]!,false,() => now,() => 0.5,{continueAfter:'auto',adaptive:true,
    auto:{...defaultAuto,value:{type:'half',dots:1},lookahead:true}});
  const tick = () => s.advanceAuto(() => expired++);
  const preview = s.upcomingEvent;
  const first = s.token;
  assert.equal(s.answer(first,s.pitch),false);
  now = 2250;
  const wrong = {letter:s.pitch.letter === 'F' ? 'G' : 'F',accidental:0} as const;
  assert.ok(s.answer(first,wrong)); assert.equal(s.attempts,0);
  now += 750;
  assert.ok(s.answer(first,s.pitch)); assert.equal(s.correct,1);
  assert.equal(s.answer(first,s.pitch),false);
  now = 4500; tick();
  assert.deepEqual(s.currentEvent,preview);
  assert.equal(s.answer(first,s.pitch),false);
  s.pause(); now += 10_000; s.resume();
  assert.equal(s.countingIn,true);
  now += 2250; assert.equal(s.countingIn,false);
  now += 2250; assert.equal(s.answer(s.token,s.pitch),false);
  tick(); tick(); assert.equal(expired,1);
  assert.deepEqual(s.last?.answer,{kind:'unanswered'});
  assert.equal(s.attempts,2); assert.equal(s.accuracy,0.5);
});

test('auto pacing round trips through activity links and backups with expired prompts', async () => {
  const preset = presets[0]!;
  const auto = { ...defaultAuto, value:autoValues[0], bpm:120 };
  const activity = {mode:'practice',ranges:[captureRange(preset,false,false)],pace:'auto',auto,intro:false,rules:defaultTimed,format:'turns'} as const;
  const validated = notesAdapter.validate(activity);
  const url = await activityUrl('https://tuno.cc/notes/',notesAdapter,validated);
  assert.deepEqual(await readActivityLink(url,notesAdapter),{kind:'loaded',value:validated});
  let now = 0;
  const s = new Practice(preset,false,() => now,Math.random,{continueAfter:'auto',auto});
  const store = new NotesStore();
  const profile = { id:'student', name:'Student', results:[], contexts:[], defaultPresetId:preset.id };
  store.update(data => data.profiles.push(profile));
  store.data.configuration.auto = validated.auto;
  store.data.configuration.continueAfter = 'auto';
  now = 1000;
  s.advanceAuto(() => store.observe(profile.id,preset,s.last!));
  const restored = validateSnapshot(JSON.parse(JSON.stringify(store.data)));
  assert.deepEqual(restored.configuration.auto,validated.auto);
  assert.deepEqual(Object.values(restored.profiles[0]!.contexts[0]!.notes)[0]![0]!.answer,{kind:'unanswered'});
});

test('early matches wait for the downbeat, with or without a visible preview', () => {
  for (const lookahead of [true,false]) {
    let now = 0, credits = 0, misses = 0;
    const s = new Practice(presets[0]!,false,() => now,() => .5,{continueAfter:'auto',
      auto:{...defaultAuto,value:autoValues[0],bpm:120,lookahead}});
    const tick = () => s.advanceAuto(() => misses++,() => credits++);
    now = 249;
    assert.equal(s.inputOpen,false);
    assert.equal(s.queueAutoAnswer(s.inputToken,s.pitch),false);
    now = 250;
    assert.ok(s.queueAutoAnswer(s.inputToken,s.pitch));
    now = 499; tick(); assert.equal(s.attempts,0);
    now = 500; tick(); assert.equal(credits,1); assert.equal(s.correct,1);
    now = 749; assert.equal(s.inputOpen,false);
    now = 750; const next = s.inputPitch, token = s.inputToken;
    assert.ok(s.inputOpen); assert.ok(s.queueAutoAnswer(token,next));
    assert.equal(s.prompt,1); assert.equal(s.correct,1);
    now = 1000; tick(); tick();
    assert.deepEqual(s.pitch,next); assert.deepEqual(s.token,token);
    assert.equal(s.correct,2); assert.equal(s.last?.responseMs,0); assert.equal(misses,0);
    // Pausing cancels a buffered answer and gives the resumed prompt a fresh count-in.
    now = 1380; assert.ok(s.queueAutoAnswer(s.inputToken,s.inputPitch)); s.pause(); s.resume();
    now = 2380; tick(); assert.equal(s.attempts,2);
  }
});

test('overlap preserves the final retry, scores an unanswered outgoing note, and never doubles a press', () => {
  let now = 0;
  const preset = {...presets[0]!,pool:[presets[0]!.pool[0]!]};
  const s = new Practice(preset,false,()=>now,Math.random,{continueAfter:'auto',auto:{...defaultAuto,bpm:120,value:autoValues[0]}});
  now = 900;
  const overlap = s.inputToken;
  assert.equal(s.queueAutoAnswer(overlap,s.pitch),false);
  assert.ok(s.answer(overlap,s.pitch));
  now = 1000; s.advanceAuto(()=>{}); assert.equal(s.attempts,1);
  const missed = s.token;
  now = 2000; s.advanceAuto(()=>{});
  assert.equal(s.attempts,3); assert.equal(s.correct,1);
  assert.equal(s.answer(missed,s.pitch),false);
});

test('an early answer for a different pitch leaves the outgoing miss intact', () => {
  let now = 0;
  const s = new Practice(presets[0]!,false,()=>now,()=>.5,{continueAfter:'auto',auto:{...defaultAuto,bpm:120,value:autoValues[0]}});
  now = 900;
  assert.notDeepEqual(s.inputPitch,s.pitch);
  assert.ok(s.queueAutoAnswer(s.inputToken,s.inputPitch));
  assert.equal(s.attempts,0);
  now = 1000;
  const outcomes: boolean[] = [];
  s.advanceAuto(()=>outcomes.push(s.last!.correct),()=>outcomes.push(s.last!.correct));
  assert.deepEqual(outcomes,[false,true]);
  assert.equal(s.accuracy,.5);
});

test('the early window scales with tempo and stays half a beat for every note value', () => {
  for (const [bpm, halfBeatMs] of [[30,1000],[80,375],[150,200]] as const) {
    for (const value of autoValues) {
      let now = 0;
      const session = new Practice(presets[0]!,false,()=>now,Math.random,{
        continueAfter:'auto', auto:{...defaultAuto,value,bpm},
      });
      const noteMs = quarterBeats(value) * halfBeatMs * 2;
      now = noteMs - halfBeatMs - 1;
      assert.equal(session.inputOpen,false);
      now++;
      assert.equal(session.inputOpen,true);
      now = 2 * noteMs - halfBeatMs - 1;
      assert.equal(session.earlyNext,false);
      now++;
      assert.equal(session.earlyNext,true);
    }
  }
});
