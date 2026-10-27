import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptsFingering, trumpetFingering, OPEN_FINGERING, validMask } from '../src/apps/tunotes/domain/fingering.ts';
import { chromatic, parsePitch } from '../src/apps/tunotes/domain/notation.ts';
import { presets, normalizePreset } from '../src/apps/tunotes/domain/presets.ts';
import { expansionPlan } from '../src/apps/tunotes/engine/adaptive.ts';
import { HeldFingers } from '../src/shared/input/held-fingers.ts';
import { FingeringPolicy } from '../src/apps/tunotes/engine/fingering-policy.ts';
import { Practice } from '../src/apps/tunotes/engine/practice.ts';

const combinations = ['00000000','00001000','00000100','00000010','00001100','00001010','00000110','00001110'];
test('all eight valve combinations preserve the eight-bit representation', () => {
  const notes = ['C4','F4','B3','A3','E4','D4','Eb4','F#3'];
  combinations.forEach((mask, i) => {
    const held = new HeldFingers();
    [...mask].forEach((bit, position) => { if (bit === '1') held.down(String(position), position); });
    assert.equal(held.mask, mask);
    assert.ok(acceptsFingering(trumpetFingering, parsePitch(notes[i]!), mask));
    assert.ok(validMask(mask));
  });
  assert.ok(!validMask('1000')); assert.ok(!validMask('00002000'));
});
test('chart covers trumpet presets and expansion, alternates and shared masks', () => {
  for (const p of presets.filter(p => p.instrument === 'trumpet-bb')) {
    for (const pitch of [...p.pool, ...expansionPlan(p).flat()]) assert.ok(trumpetFingering.pitches[chromatic(pitch)], JSON.stringify(pitch));
  }
  assert.equal(Object.keys(trumpetFingering.pitches).length, 31);
  for (const pitch of ['A3','E4','A4','E5','A5']) {
    for (const mask of ['00001100','00000010']) assert.ok(acceptsFingering(trumpetFingering, parsePitch(pitch), mask));
  }
  for (const pitch of ['C4','G4','C5','E5','G5','C6']) assert.ok(acceptsFingering(trumpetFingering, parsePitch(pitch), OPEN_FINGERING));
  assert.ok(acceptsFingering(trumpetFingering, parsePitch('Db4'), '00001110'));
  assert.ok(!acceptsFingering(trumpetFingering, parsePitch('C4'), '00001000'));
});
test('independent keyboard and touch sources retain the union of held fingers', () => {
  const held = new HeldFingers();
  held.down('touch:1',4); held.down('touch:2',5); held.down('key:j',4);
  assert.equal(held.mask,'00001100');
  assert.equal(held.down('key:j',4),false);
  assert.equal(held.up('touch:1'),false);
  held.up('key:j'); assert.equal(held.mask,'00000100');
  held.reset(); assert.equal(held.mask,OPEN_FINGERING);
});
test('settling rolls, cancellations, open, locks and repeated cards', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const submissions: string[] = [];
  const policy = new FingeringPolicy((mask, token) => submissions.push(`${token.prompt}:${mask}`));
  policy.update({session:1,prompt:1},false);
  t.mock.timers.tick(500); assert.equal(submissions.length,0);
  policy.change('00001000'); t.mock.timers.tick(120);
  policy.change('00001100'); t.mock.timers.tick(199); assert.equal(submissions.length,0);
  t.mock.timers.tick(1); assert.deepEqual(submissions,['1:00001100']);
  policy.change('00001100'); t.mock.timers.tick(500); assert.equal(submissions.length,1);
  policy.update({session:1,prompt:2},false); t.mock.timers.tick(500); assert.equal(submissions.length,1);
  policy.change('00000100'); t.mock.timers.tick(200); assert.equal(submissions.at(-1),'2:00000100');
  policy.change(OPEN_FINGERING); t.mock.timers.tick(500); assert.equal(submissions.length,2);
  policy.open(); assert.equal(submissions.at(-1),'2:00000000');
  policy.change('00001000'); policy.change(OPEN_FINGERING,false); t.mock.timers.tick(500); assert.equal(submissions.length,3);
  policy.change('00001100'); policy.update({session:1,prompt:3},false); t.mock.timers.tick(500); assert.equal(submissions.length,3);
  policy.update({session:1,prompt:3},true); policy.open(); policy.change('00001000');
  policy.update({session:1,prompt:3},false); t.mock.timers.tick(500); assert.equal(submissions.length,3);
});
test('intermediate states held for a full window submit: isolated policy limitation', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const seen: string[] = []; const policy = new FingeringPolicy(mask => seen.push(mask));
  policy.update({session:1,prompt:1},false);
  policy.change('00001000'); t.mock.timers.tick(200);
  policy.change('00001100'); t.mock.timers.tick(200);
  assert.deepEqual(seen,['00001000','00001100']);
});
test('fingering uses existing scoring and all advancement policies without inventing pitches', () => {
  const preset = normalizePreset({id:'test', name:'Repeated E', clef:'treble', instrument:'trumpet-bb', range:['E4','E4'], content:'lines-and-spaces'});
  for (const continueAfter of ['instant','correct','click','delay'] as const) {
    let now = 0;
    const s = new Practice(preset,false,()=>now,Math.random,{continueAfter});
    assert.ok(s.answer(s.token,{kind:'fingering',mask:'00001000'}));
    assert.equal(s.correct,0); assert.equal(s.attempts,1);
    assert.ok(!s.answer(s.token,{kind:'fingering',mask:'00000010'}));
    now += 1000; s.advance(s.token,true);
    const old = s.token;
    assert.ok(s.answer(s.token,{kind:'fingering',mask:'00000010'}));
    assert.equal(s.correct,1); assert.equal(s.last?.correct,true);
    assert.deepEqual(s.last?.answer,{kind:'fingering',mask:'00000010'});
    now += 1000; s.advance(s.token,true);
    assert.ok(!s.answer(old,{kind:'fingering',mask:'00000010'}));
    assert.equal(s.attempts,2);
  }
});

test('saved profiles and backups round-trip fingering observations and migrate old snapshots', async () => {
  const { NotesStore, parseBackup, emptySnapshot, validateSnapshot } = await import('../src/apps/tunotes/persistence/store.ts');
  const store = new NotesStore();
  const profile = {id:'trumpeter',name:'Trumpeter',results:[],contexts:[],defaultPresetId:'trumpet-bb-starter'};
  store.update(data => { data.profiles.push(profile); });
  const preset = presets.find(p => p.id === 'trumpet-bb-starter')!;
  const s = new Practice(preset);
  s.answer(s.token,{kind:'fingering',mask:trumpetFingering.pitches[chromatic(s.pitch)]![0]!});
  store.observe(profile.id,preset,s.last!);
  const backup = parseBackup(store.export());
  assert.deepEqual(backup.profiles[0]!.contexts[0]!.notes,store.data.profiles[0]!.contexts[0]!.notes);
  assert.equal(validateSnapshot({...emptySnapshot(),schemaVersion:4}).schemaVersion,5);
  const invalid = JSON.parse(store.export());
  const observation = Object.values(invalid.profiles[0].contexts[0].notes)[0] as {answer:{mask:string}}[];
  observation[0]!.answer.mask = '1000'; assert.throws(()=>validateSnapshot(invalid));
});
