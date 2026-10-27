import test from 'node:test';
import assert from 'node:assert/strict';
import { activityLimits, activityUrl, readActivityLink } from '../src/shared/sharing/activity-link.ts';
import { captureTools, toolAdapter } from '../src/practice/sharing.ts';
import { createPracticeStore } from '../src/practice/state.ts';
import { captureRange, notesAdapter } from '../src/apps/tunotes/sharing.ts';
import type { NotesActivity } from '../src/apps/tunotes/sharing.ts';
import { defaultPreset, normalizePreset, presets } from '../src/apps/tunotes/domain/presets.ts';
import { defaultTimed } from '../src/apps/tunotes/engine/challenge.ts';
import { Activity, defaultPreferences } from '../src/apps/rhythm-walk/activity.ts';
import { captureRhythm, rhythmAdapter } from '../src/apps/rhythm-walk/sharing.ts';
import { generateExercise, selectedSixteenthPatterns } from '../src/apps/rhythm-walk/shared/generation.ts';
import { applyTeachingPreset, generationLevels, matchesTeachingPreset } from '../src/apps/rhythm-walk/shared/teaching-presets.ts';
import { NotesStore, STORAGE_KEY, emptySnapshot } from '../src/apps/tunotes/persistence/store.ts';
import { note, score } from '../src/music/measure.ts';

const base = 'https://tuno.cc/notes/?testing=1&fixture=bad#settings';
const notes = (): NotesActivity => ({mode:'practice',ranges:[captureRange(defaultPreset,false,false)],pace:'correct',intro:false,rules:defaultTimed,format:'turns'});

test('all tools round trip with companion settings, no runtime evidence or volume',async () => {
  const store = createPracticeStore(); store.dispatch({type:'tempo',value:132}); store.dispatch({type:'audio',value:{tonePlaying:true,liveHz:440}});
  for (const focus of ['tuner','tone','metronome'] as const) {
    store.dispatch({type:'focus',value:focus}); const value = captureTools(store);
    const url = await activityUrl(base,toolAdapter,value); const loaded = await readActivityLink(url,toolAdapter);
    assert.deepEqual(loaded,{kind:'loaded',value}); assert.equal(new URL(url).hash,'');
    assert.deepEqual([...new URL(url).searchParams.keys()],['activity']);
    assert.ok(!('toneVolume' in value)); assert.ok(!('liveHz' in value));
  }
  assert.throws(() => toolAdapter.validate({...captureTools(store),tempo:NaN}));
});

test('all built-in ranges and custom ranges preserve their pool and adaptive choice',async () => {
  for (const preset of presets) {
    const range = captureRange(preset,true,true);
    assert.deepEqual(notesAdapter.validate({...notes(),ranges:[range]}).ranges[0],range);
  }
  const custom = normalizePreset({...defaultPreset,id:'custom-private-id',name:'Private student name',range:['C4','G5'],exactRange:true,accidentals:'both'});
  const value = {...notes(),ranges:[captureRange(custom,true,true)]};
  assert.ok(!JSON.stringify(value).includes('Private')); assert.ok(!JSON.stringify(value).includes('private-id'));
  const url = await activityUrl(base,notesAdapter,value);
  assert.deepEqual(await readActivityLink(url,notesAdapter),{kind:'loaded',value});
  assert.throws(() => notesAdapter.validate({...value,ranges:[{...value.ranges[0],pool:['C0']}]}));
});

test('multiplayer includes ordered ranges and rules, bounded to eight generic slots',async () => {
  const value: NotesActivity = {...notes(),mode:'multiplayer',format:'head-to-head',ranges:[captureRange(defaultPreset,false,true),captureRange(presets.find(p => p.clef === 'bass')!,false,true)]};
  assert.deepEqual(await readActivityLink(await activityUrl(base,notesAdapter,value),notesAdapter),{kind:'loaded',value});
  assert.throws(() => notesAdapter.validate({...value,ranges:Array(9).fill(value.ranges[0])}));
  assert.throws(() => notesAdapter.validate({...value,ranges:[]}));
  assert.throws(() => notesAdapter.validate({...value,profileId:'private'}));
});

test('rhythm sharing preserves written passage and captured settings rather than pending edits',async () => {
  const preferences = defaultPreferences();
  const passage = score([{meter:[4,4],notes:[note('quarter',{tieNext:true}),note('quarter'),note('quarter',{kind:'rest'}),note('eighth',{dots:1}),note('16th')]}]);
  const activity = new Activity(preferences,passage);
  const original = captureRhythm(activity);
  preferences.generation.measures = 4; preferences.counting = {...preferences.counting,offbeat:'+'};
  activity.countingAnswer = {...activity.countingAnswer,counts:{...activity.countingAnswer.counts,[activity.countingPlan.counts[0]!.id]:'1'}};
  const value = captureRhythm(activity);
  assert.deepEqual(value.score,passage); assert.deepEqual(value.preferences.counting,original.preferences.counting);
  assert.equal(value.preferences.generation.measures,2);
  assert.ok(!('answer' in value));
  assert.deepEqual(await readActivityLink(await activityUrl(base,rhythmAdapter,value),rhythmAdapter),{kind:'loaded',value});
  assert.throws(() => rhythmAdapter.validate({...value,preferences:{...value.preferences,bpm:999}}));
  assert.throws(() => rhythmAdapter.validate({...value,score:{measures:[...passage.measures,...passage.measures,...passage.measures,...passage.measures,...passage.measures]}}));
});

test('every rhythm preset shares and restores explicit groupings without changing their order',async t => {
  for (const definition of generationLevels) for (const scope of definition.source ? ['general', 'percussion'] as const : ['general'] as const) {
    await t.test(`${definition.id} ${scope}`,async () => {
      const preferences = defaultPreferences();
      const applied = applyTeachingPreset(preferences.generation,definition,undefined,scope);
      assert.ok(applied.supported);
      preferences.generation = applied.settings;
      // The chooser makes inferred groupings explicit in display order.
      const patterns = selectedSixteenthPatterns(preferences.generation);
      for (const order of [patterns,[...patterns].reverse()]) {
        preferences.generation.sixteenthPatterns = [...order];
        const before = structuredClone(preferences.generation);
        assert.equal(matchesTeachingPreset(preferences.generation,definition),true);
        assert.deepEqual(preferences.generation,before,'matching must not mutate settings');
        const activity = new Activity(preferences,generateExercise(preferences.generation,() => 0.5));
        const value = captureRhythm(activity);
        assert.deepEqual(value.preferences.generation,before);
        assert.deepEqual(activity.exerciseGeneration,before);
        assert.deepEqual(await readActivityLink(await activityUrl(base,rhythmAdapter,value),rhythmAdapter),{kind:'loaded',value});
      }
    });
  }
});

test('transport rejects invalid, conflicting, wrong-route, unknown-version and oversized links',async () => {
  const good = await activityUrl(base,notesAdapter,notes());
  const urls = [good+'&counting=1',good+'&activity=1j.e30',good.replace('/notes/','/rhythm/'),good.replace('activity=1','activity=9'),good.slice(0,-7),'https://tuno.cc/notes/?activity=1z.bad','https://tuno.cc/notes/?activity='+ 'a'.repeat(activityLimits.encoded+1)];
  for (const url of urls) assert.equal((await readActivityLink(url,notesAdapter)).kind,'error',url.slice(0,80));
  assert.equal((await readActivityLink('https://tuno.cc/notes/',notesAdapter)).kind,'none');
  const bomb = new Uint8Array(await new Response(new Blob([' '.repeat(activityLimits.decodedBytes+1)]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  assert.equal((await readActivityLink('https://tuno.cc/notes/?activity=1z.'+Buffer.from(bomb).toString('base64url'),notesAdapter)).kind,'error');
});

test('shared NotesStore protects saved configuration and profile preferences on progress flush',() => {
  const initial = emptySnapshot(); initial.configuration.continueAfter = 'correct';
  initial.profiles.push({id:'local',name:'Student',results:[],contexts:[],defaultPresetId:defaultPreset.id,adaptive:true});
  let saved = JSON.stringify(initial);
  const store = new NotesStore({getItem:() => saved,setItem:(_k,v) => {saved=v;},removeItem:() => {}});
  store.beginSharedSession();
  store.update(data => {data.configuration.continueAfter='instant';data.profiles[0]!.adaptive=false;});
  assert.equal(JSON.parse(saved).configuration.continueAfter,'correct');
  assert.equal(JSON.parse(saved).profiles[0].adaptive,true);
  assert.equal(store.data.configuration.continueAfter,'instant');
  assert.equal(STORAGE_KEY,'tunotes:data:v1');
});

test('representative payload corpus stays below the encoded budget',async t => {
  const largest = presets.reduce((a,b) => a.pool.length > b.pool.length ? a : b);
  const multiplayer: NotesActivity = {...notes(),mode:'multiplayer',ranges:Array.from({length:8},() => captureRange(largest,true,true))};
  const preferences = defaultPreferences();preferences.generation.measures=4;
  const rhythm = captureRhythm(new Activity(preferences,generateExercise(preferences.generation,() => 0.5)));
  const varied: NotesActivity = {...notes(),mode:'multiplayer',ranges:Array.from({length:8},(_,i) => captureRange(normalizePreset({...defaultPreset,id:`custom-${i}`,name:'Custom',range:[`C${i%3}`,`B${8-i%3}`],exactRange:true,accidentals:'both'}),false,true))};
  const dense = captureRhythm(new Activity(preferences,score(Array.from({length:4},() => ({meter:[4,4] as const,notes:Array.from({length:16},() => note('16th'))})))));
  for (const [name,url] of [['tools',await activityUrl(base,toolAdapter,captureTools(createPracticeStore()))],['eight-player',await activityUrl(base,notesAdapter,multiplayer)],['four-measure',await activityUrl(base,rhythmAdapter,rhythm)],['eight-varied',await activityUrl(base,notesAdapter,varied)],['dense-four-measure',await activityUrl(base,rhythmAdapter,dense)]]) {
    assert.ok(url!.length < activityLimits.encoded); t.diagnostic(`${name}: ${url!.length} URL characters`);
  }
});

test('version-one decode fixtures retain their complete meaning',async () => {
  const { readFile } = await import('node:fs/promises');
  const fixtures = JSON.parse(await readFile(new URL('./fixtures/activity-sharing-v1.json',import.meta.url),'utf8'));
  for (const fixture of fixtures) {
    const adapter = fixture.app === 'tuno' ? toolAdapter : fixture.app === 'tunotes' ? notesAdapter : rhythmAdapter;
    const result = await readActivityLink(fixture.url,adapter as typeof toolAdapter);
    assert.deepEqual(result,{kind:'loaded',value:fixture.value});
  }
});

test('full rhythm sessions save only explicitly selected counting defaults',async () => {
  const {createPreferenceSession} = await import('../src/apps/rhythm-walk/counting-session.ts');
  const {countingPreferencesUrl} = await import('../src/music/counting/link.ts');
  const saved = defaultPreferences(); saved.bpm = 71;
  const shared = {...defaultPreferences(),bpm:123,counting:{...saved.counting,offbeat:'+' as const}};
  const session = createPreferenceSession(JSON.stringify(saved),'',shared);
  assert.equal(session.isLinked(),true); assert.equal(session.preferences.bpm,123);
  assert.equal(JSON.parse(session.serialize()).bpm,71);
  assert.deepEqual(JSON.parse(session.serialize()).counting,saved.counting);
  let written = '';
  session.saveAsDefaults(raw => {written=raw;});
  assert.equal(JSON.parse(written).bpm,71); assert.deepEqual(JSON.parse(written).counting,shared.counting);
  assert.equal(session.isLinked(),true,'the complete activity still stays temporary');
  const legacy = countingPreferencesUrl('https://tuno.cc/rhythm/?activity=old',saved.counting);
  assert.equal(new URL(legacy).searchParams.has('activity'),false);
});

test('explicit profile default saves remain available within an isolated notes session',() => {
  const initial = emptySnapshot(); initial.profiles.push({id:'local',name:'Student',results:[],contexts:[],defaultPresetId:defaultPreset.id});
  let saved = JSON.stringify(initial);
  const store = new NotesStore({getItem:() => saved,setItem:(_k,v) => {saved=v;},removeItem:() => {}});
  store.beginSharedSession();
  const bass = presets.find(p => p.clef === 'bass')!;
  store.saveProfileDefault('local',bass.id);
  assert.equal(JSON.parse(saved).profiles[0].defaultPresetId,bass.id);
  store.update(data => {data.configuration.continueAfter='correct';});
  assert.equal(JSON.parse(saved).configuration.continueAfter,undefined);
});

test('automatic custom selections stay temporary while explicit custom saves persist',() => {
  let saved = JSON.stringify(emptySnapshot());
  const store = new NotesStore({getItem:() => saved,setItem:(_k,v) => {saved=v;},removeItem:() => {}});
  store.beginSharedSession();
  const source = captureRange(normalizePreset({...defaultPreset,id:'custom-new',name:'Draft'}),false,false).source;
  store.automaticPreset(source.id);
  store.update(data => {data.customPresets.push(source);data.configuration.presetId=source.id;});
  assert.deepEqual(JSON.parse(saved).customPresets,[]);
  store.update(data => {data.customPresets.push({...source,id:'custom-explicit',name:'Saved explicitly'});});
  assert.equal(JSON.parse(saved).customPresets[0].id,'custom-explicit');
});
