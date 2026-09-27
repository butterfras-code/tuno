import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreset, clefForPitch, fingerprint, generatedPresetName } from '../src/apps/tunotes/domain/presets.ts';
import type { PresetSource } from '../src/apps/tunotes/domain/presets.ts';
import { keySignature, parsePitch, pitchLabel, staffPosition } from '../src/apps/tunotes/domain/notation.ts';
import { emptySnapshot, validateSnapshot, NotesStore } from '../src/apps/tunotes/persistence/store.ts';
import { Practice } from '../src/apps/tunotes/engine/practice.ts';
const base: PresetSource = { id:'graphic',name:'Graphical',editorVersion:2,clef:'treble',range:['F4','G4'],content:'lines-and-spaces',key:keySignature('G'),accidentals:'key-only',modifiers:['key'],availableClefs:['treble'],endpointClefs:['treble','treble'] };
const labels = (p: PresetSource) => normalizePreset(p).pool.map(pitchLabel);
test('modifiers are independent additive spellings, bounded by accidental endpoints',() => {
  assert.deepEqual(labels(base),['F♯4','G4']);
  assert.deepEqual(labels({...base,modifiers:['key','natural']}),['F♯4','F4','G4']);
  assert.deepEqual(labels({...base,modifiers:['natural']}),['F4','G4']);
  assert.deepEqual(labels({...base,range:['Db4','D#4'],modifiers:['flat','natural','sharp']}),['D♭4','D4','D♯4']);
  assert.deepEqual(labels({...base,range:['D4','D#4'],modifiers:['flat','natural','sharp']}),['D4','D♯4']);
  assert.equal(normalizePreset({...base,modifiers:['sharp']}).key.fifths,0);
  assert.throws(() => normalizePreset({...base,range:['F4','F4']}),/empty pool/);
  assert.throws(() => normalizePreset({...base,modifiers:[]}),/modifier/);
  assert.throws(() => normalizePreset({...base,range:['D#4','Db4']}),/Lowest/);
});
test('mixed clefs use readable assignment, apply staff content in that clef and do not clip ledgers',() => {
  const p = normalizePreset({...base,range:['C2','C7'],modifiers:['natural'],availableClefs:['treble','bass']});
  assert.equal(clefForPitch(p,parsePitch('C2')),'bass');
  assert.equal(clefForPitch(p,parsePitch('C7')),'treble');
  assert.equal(p.pool.length,36);
  for (const content of ['lines','spaces'] as const) {
    const q = normalizePreset({...p,content});
    assert.ok(q.pool.every(n => Math.abs(staffPosition(n,clefForPitch(q,n))%2) === (content === 'lines' ? 0 : 1)));
  }
  assert.throws(() => normalizePreset({...base,availableClefs:[]}),/clef/);
  assert.throws(() => normalizePreset({...base,availableClefs:['treble','treble']}),/clef/);
  assert.throws(() => normalizePreset({...base,ledgerBelow:0}),/ledger limits/);
});
test('version 1 backup migration and version 2 graphical settings/history round trip',() => {
  const legacy = {...emptySnapshot(),schemaVersion:1,customPresets:[{id:'old',name:'Old',clef:'bass',range:['C2','C4'],content:'lines',key:keySignature('C'),accidentals:'key-only',ledgerBelow:0,ledgerAbove:1}]};
  const migrated = validateSnapshot(legacy); assert.equal(migrated.schemaVersion,4); assert.equal(migrated.customPresets[0]!.ledgerBelow,0);
  const store = new NotesStore();
  store.update(d => { d.customPresets.push(base); d.profiles.push({id:'player',name:'Player',results:[],contexts:[]}); d.configuration = {...d.configuration,profileId:'player',remember:true,presetId:base.id}; });
  const p = normalizePreset(base); const session = new Practice(p,true);
  session.answer(session.token,session.pitch); store.observe('player',p,session.last!); session.finish(); store.record('player',session); store.flush();
  assert.deepEqual(validateSnapshot(JSON.parse(store.export())),store.data);
  assert.notEqual(fingerprint(p),fingerprint(normalizePreset({...base,availableClefs:['treble','alto']})));
  const corrupt = JSON.parse(store.export()); corrupt.customPresets[0].modifiers=['unknown']; assert.throws(() => validateSnapshot(corrupt),/modifier/);
  const bad = JSON.parse(store.export()); bad.profiles[0].contexts[0].fingerprint = JSON.stringify([...JSON.parse(fingerprint(p)).slice(0,9),{version:2,clefs:['unknown'],modifiers:['key']}]); assert.throws(() => validateSnapshot(bad),/context/);
});

test('generated names describe the range, content, optional key and modifiers in stable order',() => {
  assert.equal(generatedPresetName(base),'F4–G4 Both in G major');
  assert.equal(generatedPresetName({...base,range:['Db4','F#5'],content:'lines',key:keySignature('Bb'),modifiers:['sharp','key','natural','flat']}),'D♭4–F♯5 Line in B♭ major + ♭ ♮ ♯');
  assert.equal(generatedPresetName({...base,content:'spaces',modifiers:['flat']}),'F4–G4 Space + ♭');
  assert.equal(generatedPresetName({...base,name:'An override',modifiers:['natural','key']}),generatedPresetName({...base,modifiers:['key','natural']}));
});
