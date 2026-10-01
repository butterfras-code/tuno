import test from 'node:test';
import assert from 'node:assert/strict';
import { keySignature, keyNames, keyAccidental, keyPositions, parsePitch, pitchLabel, chromatic, staffPosition } from '../src/apps/tunotes/domain/notation.ts';
import { presets, clefs, normalizePreset, defaultPreset, instruments, instrumentPresets, writtenToConcert, fingerprint, modifiersFor } from '../src/apps/tunotes/domain/presets.ts';
import { NotesStore, STORAGE_KEY, emptySnapshot, parseBackup, validateSnapshot, MAX_BYTES } from '../src/apps/tunotes/persistence/store.ts';
import { Practice } from '../src/apps/tunotes/engine/practice.ts';
import { NotesProgress } from '../src/apps/tunotes/engine/progress.ts';

test('every key has the expected signature and explicitly spelled single accidentals', () => {
  for (const [index,name] of keyNames.entries()) {
    const key = keySignature(name); assert.equal(key.fifths,index-7);
    const expected = (key.fifths > 0 ? 'FCGDAEB' : 'BEADGCF').slice(0,Math.abs(key.fifths));
    for (const letter of ['C','D','E','F','G','A','B'] as const) assert.equal(keyAccidental(letter,key),expected.includes(letter) ? Math.sign(key.fifths) : 0);
    if (name === 'Cb') { assert.throws(() => normalizePreset({...defaultPreset,key}), /unavailable/); continue; }
    for (const clef of clefs) {
      for (const policy of ['key-only','sharps','flats','both'] as const) {
        const p = normalizePreset({ ...defaultPreset,clef,key,range:['C4','B4'],accidentals:policy });
        const expectedPool = [...'CDEFGAB'].flatMap(letter => {
          const alteration = expected.includes(letter) ? Math.sign(key.fifths) : 0;
          const values = [...new Set([alteration,...(policy === 'key-only' ? [] : [0]),...(policy === 'sharps' || policy === 'both' ? [1] : []),...(policy === 'flats' || policy === 'both' ? [-1] : [])])];
          return values.filter(a => !(a === 1 && ['B','E'].includes(letter) || a === -1 && ['C','F'].includes(letter))).map(a => `${letter}${a === 1 ? '♯' : a === -1 ? '♭' : ''}4`);
        });
        assert.deepEqual(p.pool.map(pitchLabel),expectedPool);
      }
    }
  }
  assert.equal(chromatic(parsePitch('B#3')),chromatic(parsePitch('C4')));
  assert.equal(chromatic(parsePitch('Cb4')),chromatic(parsePitch('B3')));
  assert.equal(parsePitch('B#3').octave,3);
});
test('catalog pools exactly follow specified staff and ledger envelopes', () => {
  assert.equal(presets.length,88);
  for (const p of presets) {
    const start = staffPosition(parsePitch(p.range[0]),p.clef), end = staffPosition(parsePitch(p.range[1]),p.clef);
    const positions = Array.from({length:end-start+1},(_,i) => start+i).filter(n => p.content === 'lines-and-spaces' || Math.abs(n%2) === (p.content === 'lines' ? 0 : 1));
    assert.deepEqual(p.pool.map(note => staffPosition(note,p.clef)),positions);
    assert.equal(new Set(p.pool.map(pitchLabel)).size,p.pool.length);
    if (p.id.includes('ledger')) {
      const [, ,count,side] = p.id.split('-');
      assert.equal(start,side === 'above' ? 0 : -Number(count)*2); assert.equal(end,side === 'below' ? 8 : 8+Number(count)*2);
    }
  }
  assert.deepEqual(instrumentPresets.find(p => p.id === 'trombone-starter')!.pool.map(pitchLabel),['B♭2','C3','D3','E♭3','F3']);
  const zero = normalizePreset({...defaultPreset,range:['C0','B8'],ledgerBelow:0,ledgerAbove:0});
  assert.deepEqual(zero.pool.map(p => staffPosition(p,'treble')),[-1,0,1,2,3,4,5,6,7,8,9]);
  assert.throws(() => normalizePreset({...defaultPreset,range:['C4','C4'],ledgerBelow:0}),/empty/);
});
test('exact endpoints are independent of the key and keyless chromatic ranges are bounded', () => {
  const source = { ...defaultPreset, id: 'exact-range', clef: 'bass' as const, range: ['Bb2','F#3'] as const, exactRange: true, key: keySignature('G') };
  const keyed = normalizePreset(source);
  assert.equal(pitchLabel(keyed.pool[0]!), 'B♭2');
  assert.equal(pitchLabel(keyed.pool.at(-1)!), 'F♯3');
  assert.ok(keyed.pool.some(p => pitchLabel(p) === 'B2'));
  const chromatic = normalizePreset({ ...source, key: keySignature('C'), keyless: true, range: ['Bb2','F3'], accidentals: 'both' });
  assert.equal(pitchLabel(chromatic.pool[0]!), 'B♭2');
  assert.equal(pitchLabel(chromatic.pool.at(-1)!), 'F3');
  assert.ok(chromatic.pool.some(p => pitchLabel(p) === 'C♯3'));
  assert.ok(chromatic.pool.some(p => pitchLabel(p) === 'D♭3'));
  assert.ok(!chromatic.pool.some(p => pitchLabel(p) === 'F♯3'));
  assert.ok(!modifiersFor(chromatic).includes('key'));
  assert.equal(JSON.parse(fingerprint(chromatic))[3], 'none');
  assert.notEqual(fingerprint(chromatic), fingerprint(normalizePreset({ ...chromatic, keyless: false })));
});
test('signature placement fixtures follow the actual letter order in every clef', () => {
  const expected = {
    treble: { sharp:[8,5,9,6,3,7,4],flat:[4,7,3,6,2,5,1] }, bass:{sharp:[6,3,7,4,1,5,2],flat:[2,5,1,4,0,3,-1]},
    alto:{sharp:[7,4,8,5,2,6,3],flat:[3,6,2,5,1,4,0]},tenor:{sharp:[2,6,3,7,4,8,5],flat:[5,8,4,7,3,6,2]},
  };
  assert.deepEqual(keyPositions,expected);
});
test('all instrument written-to-concert fixtures preserve sign and octave', () => {
  const expected = [60,60,60,60,58,51,58,53,60,60,60];
  instruments.forEach((i,n) => assert.equal(writtenToConcert(parsePitch('C4'),i.transpose),expected[n]));
  assert.equal(writtenToConcert(parsePitch('C4'),14),46); // future octave-transposing B-flat instrument
});
function memory() {
  const values = new Map<string,string>([['tuno-preferences','untouched']]); let fail = false;
  return { values, set fail(value: boolean) { fail = value; }, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => { if(fail) throw new Error('quota'); values.set(k,v); }, removeItem: (k: string) => { if(fail) throw new Error('denied'); values.delete(k); } };
}
function profile(store: NotesStore) { store.update(d => { d.profiles.push({id:'student',name:'Student',results:[],contexts:[],defaultPresetId:d.configuration.presetId}); d.configuration.remember = true; d.configuration.profileId = 'student'; }); }
function play(store: NotesStore, count: number, correct = count, pause = false) {
  let now = 0; const s = new Practice(defaultPreset,true,() => now);
  for(let i=0;i<count;i++) { now+=100; s.answer(s.token,i < correct ? s.pitch : {letter:s.pitch.letter === 'A' ? 'B':'A',accidental:0}); store.observe('student',defaultPreset,s.last!); s.advance(s.token,true); }
  if(pause) s.pause(); s.finish(); store.record('student',s); return s;
}
test('profiles persist isolated bounded observations and comparable first-20 benchmarks', () => {
  const storage = memory(), store = new NotesStore(storage); profile(store);
  play(store,25,25); assert.equal(store.benchmark(defaultPreset),20);
  play(store,20,10,true); assert.equal(store.benchmark(defaultPreset),20);
  assert.equal(store.benchmark(presets[0]!),10);
  assert.equal(new NotesProgress(20).update(10,10).treat,false);
  for(let i=0;i<6;i++) play(store,20,12);
  assert.equal(store.benchmark(defaultPreset),12);
  assert.ok(Object.values(store.profile()!.contexts[0]!.notes).every(notes => notes.length<=10));
  const session = play(store,120,110); assert.equal(session.attempts,120); assert.equal(session.first20Correct,20); assert.equal(session.observations.length,100); assert.equal(session.responseTotalMs,12000);
  const fresh = new NotesStore(storage); assert.deepEqual(fresh.data,store.data); assert.equal(storage.values.get('tuno-preferences'),'untouched');
  store.update(d => { d.configuration.remember=false; }); assert.equal(store.benchmark(defaultPreset),10); assert.equal(store.profile(),undefined);
});
test('backup round trip, version migration and strict rejection leave data unchanged', () => {
  const storage = memory(), store = new NotesStore(storage); profile(store); play(store,20);
  const backup = store.export(); const destination = new NotesStore(memory()); destination.replace(parseBackup(backup)); assert.deepEqual(destination.data,store.data);
  const old = { ...emptySnapshot(),schemaVersion:0 } as Record<string,unknown>; delete old.configuration;
  assert.deepEqual(validateSnapshot(old),emptySnapshot()); assert.equal(old.schemaVersion,0);
  const bad = [ {...store.data,schemaVersion:99}, {...store.data,appId:'tuno'}, {...store.data,extra:'ignored'}, {...store.data,profiles:[{...store.data.profiles[0],name:'x'.repeat(41)}]}, {...store.data,configuration:{...store.data.configuration,profileId:'missing'}}, {...store.data,profiles:[{...store.data.profiles[0],results:[{...store.data.profiles[0]!.results[0],correct:999}]}]} ];
  for(const candidate of bad) assert.throws(() => store.replace(candidate as never));
  assert.throws(() => parseBackup(' '.repeat(MAX_BYTES+1)),/5 MiB/);
  assert.throws(() => parseBackup('{'));
  assert.equal(store.export(),backup);
  const prior = storage.values.get(STORAGE_KEY); storage.fail=true;
  assert.throws(() => store.replace(emptySnapshot()),/not committed/); assert.equal(store.export(),backup); assert.equal(storage.values.get(STORAGE_KEY),prior);
});
test('profiles require a valid default preset and retain it in backups', () => {
  const store = new NotesStore(memory()); profile(store);
  const choice = presets.find(p => p.id === 'bass-lines-and-spaces')!;
  store.update(d => { d.profiles[0]!.defaultPresetId = choice.id; });
  assert.equal(parseBackup(store.export()).profiles[0]!.defaultPresetId,choice.id);
  const missing = structuredClone(store.data); delete (missing.profiles[0] as Partial<typeof missing.profiles[0]>)!.defaultPresetId;
  assert.throws(() => validateSnapshot(missing));
  const invalid = structuredClone(store.data); invalid.profiles[0]!.defaultPresetId = 'unknown';
  assert.throws(() => validateSnapshot(invalid),/default preset/);
});
test('storage denial, corrupt saved content and quota retain usable memory and export', () => {
  const denied = new NotesStore(); profile(denied); assert.equal(denied.durable,false); assert.equal(parseBackup(denied.export()).profiles.length,1);
  denied.replace(emptySnapshot()); assert.equal(denied.data.profiles.length,0);
  const storage = memory(); storage.values.set(STORAGE_KEY,'corrupt'); const corrupt = new NotesStore(storage); profile(corrupt); assert.equal(storage.values.get(STORAGE_KEY),'corrupt');
  const full = memory(); const store = new NotesStore(full); profile(store); const before = full.values.get(STORAGE_KEY); full.fail=true; play(store,1); assert.equal(store.durable,false); assert.equal(full.values.get(STORAGE_KEY),before); assert.equal(parseBackup(store.export()).profiles[0]!.results.length,1);
});
test('profile, history and context bounds reject excessive imports', () => {
  const d = emptySnapshot(); d.profiles = Array.from({length:33},(_,i) => ({id:`p${i}`,name:'P',results:[],contexts:[],defaultPresetId:d.configuration.presetId})); assert.throws(() => validateSnapshot(d));
  const store = new NotesStore(memory()); profile(store); for(let i=0;i<103;i++) play(store,1); assert.equal(store.profile()!.results.length,100);
  assert.equal(store.profile()!.results[0]!.context,fingerprint(defaultPreset));
});

 test('teacher-reviewed starter written and sounding boundaries', () => {
   const fixtures = [['flute','F','F4','C5','F4','C5'],['oboe','F','F4','C5','F4','C5'],['bassoon','F','F2','C3','F2','C3'],['clarinet-bb','C','C4','G4','Bb3','F4'],['alto-sax','G','G4','D5','Bb3','F4'],['trumpet-bb','C','C4','G4','Bb3','F4'],['horn-f','C','C4','G4','F3','C4'],['trombone','Bb','Bb2','F3','Bb2','F3'],['euphonium','Bb','Bb2','F3','Bb2','F3'],['tuba','Bb','Bb1','F2','Bb1','F2'],['keyboards','C','C4','G4','C4','G4']];
   for (const [id,key,low,high,soundingLow,soundingHigh] of fixtures) {
     const p = instrumentPresets.find(p => p.instrument === id)!; const i = instruments.find(i => i.id === id)!;
     assert.equal(p.key.fifths,keySignature(key!).fifths);
     assert.equal(pitchLabel(p.pool[0]!),pitchLabel(parsePitch(low!))); assert.equal(pitchLabel(p.pool.at(-1)!),pitchLabel(parsePitch(high!)));
     assert.equal(writtenToConcert(p.pool[0]!,i.transpose),chromatic(parsePitch(soundingLow!))); assert.equal(writtenToConcert(p.pool.at(-1)!,i.transpose),chromatic(parsePitch(soundingHigh!)));
   }
 });
test('context LRU stays bounded and profiles never share learning', () => {
  const store = new NotesStore(memory()); profile(store);
  store.update(d => d.profiles.push({id:'second',name:'Student',results:[],contexts:[],defaultPresetId:d.configuration.presetId}));
  for(const clef of clefs) for(const key of keyNames.filter(k=>k!=='Cb')) for(const content of ['lines','spaces','lines-and-spaces'] as const) {
    const p = normalizePreset({...defaultPreset,clef,key:keySignature(key),content}); const s = new Practice(p); s.answer(s.token,s.pitch); store.observe('student',p,s.last!);
  }
  store.flush(); assert.equal(store.profile()!.contexts.length,128); assert.equal(store.data.profiles[1]!.contexts.length,0);
  const bad = structuredClone(store.data); bad.profiles[0]!.contexts[0]!.fingerprint = bad.profiles[0]!.contexts[0]!.fingerprint.replace(defaultPreset.id,'missing-preset'); assert.throws(() => validateSnapshot(bad),/missing preset/);
  const extra = structuredClone(store.data); const records = Object.values(extra.profiles[0]!.contexts[0]!.notes)[0]!; while(records.length<=10) records.push(records[0]!); assert.throws(() => validateSnapshot(extra),/oversized/);
});
test('explicit deletion clears corrupt storage while preserving tUno', () => {
  const storage=memory(); storage.values.set(STORAGE_KEY,'corrupt'); const store=new NotesStore(storage); store.clear();
  assert.equal(storage.values.has(STORAGE_KEY),false); assert.equal(storage.values.get('tuno-preferences'),'untouched'); assert.equal(store.durable,true);
  storage.fail=true; store.clear(); assert.match(store.message,/could not be deleted/);
});

test('feedback pacing round-trips and old self-paced settings remain readable', () => {
  for (const continueAfter of ['instant','delay','click','correct'] as const) {
    const data = emptySnapshot(); data.configuration.continueAfter = continueAfter; data.configuration.selfPaced = continueAfter === 'click';
    assert.equal(parseBackup(JSON.stringify(data)).configuration.continueAfter,continueAfter);
  }
  const old = emptySnapshot(); old.configuration.selfPaced = true;
  assert.equal(parseBackup(JSON.stringify(old)).configuration.selfPaced,true);
  assert.throws(() => validateSnapshot({...old,configuration:{...old.configuration,continueAfter:'sometimes'}}),/pacing/);
});


test('notation preference defaults to note accidentals and survives backup round trips', () => {
  const old = emptySnapshot();
  assert.equal(validateSnapshot(old).configuration.showKeySignature ?? false, false);
  for (const showKeySignature of [true, false]) {
    const store = new NotesStore();
    store.update(data => { data.configuration.showKeySignature = showKeySignature; });
    assert.equal(parseBackup(store.export()).configuration.showKeySignature, showKeySignature);
  }
  assert.throws(() => validateSnapshot({ ...old, configuration: { ...old.configuration, showKeySignature: 'yes' } }), /true or false/);
});
