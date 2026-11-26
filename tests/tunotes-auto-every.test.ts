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
