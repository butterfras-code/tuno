import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { binaryFingering, canonicalFingering, fingerPositions, handCode, parseFingering, serializeFingering, validFingering } from '../src/shared/input/fingering-code.ts';
import { HeldFingers } from '../src/shared/input/held-fingers.ts';
import { acceptsFingering, fingeringFor, validInstrumentFingering } from '../src/apps/tunotes/domain/fingering.ts';
import type { FingeringConfiguration } from '../src/apps/tunotes/domain/fingering.ts';
import { parsePitch } from '../src/apps/tunotes/domain/notation.ts';
import { presets, fingerprint } from '../src/apps/tunotes/domain/presets.ts';
import { emptySnapshot, NotesStore, parseBackup, STORAGE_KEY, validateSnapshot } from '../src/apps/tunotes/persistence/store.ts';
import { migrateLegacyFingering } from '../src/apps/tunotes/persistence/legacy-fingering.ts';

test('ten anatomical positions round-trip independently, including both thumbs', () => {
  for (const finger of fingerPositions) {
    const held = new HeldFingers(); held.down('key', finger);
    assert.equal(held.code, binaryFingering([finger]));
    assert.deepEqual(parseFingering(held.code).fingers[finger], ['1']);
    assert.equal(Object.values(parseFingering(held.code).fingers).flat().length, 1);
    assert.equal(serializeFingering(parseFingering(held.code)), held.code);
  }
  assert.equal(binaryFingering(['leftThumb','rightThumb']), '00001|10000');
  assert.equal(binaryFingering(['leftLittle','rightLittle']), '10000|00001');
});

test('groups count as one position and canonicalize without accepting malformed syntax', () => {
  assert.equal(canonicalFingering('0000(731)|0(51)000|D'), '0000(137)|0(15)000|D');
  assert.equal(handCode('00010|00000|D'), '00010|00000');
  for (const code of ['00000000', '0000000000', '0000|00000', '000000|00000', '00000|00000|',
    '00000|00000|DD', '00000|00000|D|A', '00000|00000 ', '0000()|00000', '0000(1)|00000',
    '0000(11)|00000', '0000(10)|00000', '0000((12))|00000', '00000|00000|é']) assert.equal(validFingering(code), false, code);
});

const synthetic: FingeringConfiguration = {
  instrument: 'fixture', fingers: [], controls: {leftThumb: ['1','3','7'], rightIndex: ['1','2','3','4','5']},
  combinations: {leftThumb: [['1'],['1','3','7']]}, strings: ['D','A'],
  pitches: {60: ['0000(137)|0(12)000|D', '0000(137)|03000|A']},
};
test('instrument controls, simultaneous combinations and string context constrain matches', () => {
  const pitch = parsePitch('C4');
  assert.ok(acceptsFingering(synthetic, pitch, '0000(731)|0(21)000'));
  assert.ok(acceptsFingering(synthetic, pitch, '0000(137)|0(12)000', 'D'));
  assert.ok(!acceptsFingering(synthetic, pitch, '0000(137)|0(12)000', 'A'));
  assert.ok(!acceptsFingering(synthetic, pitch, '0000(137)|0(12)000|D', 'A'));
  assert.ok(!acceptsFingering(synthetic, pitch, '0000(137)|0(12)000|A'));
  assert.ok(!validInstrumentFingering(synthetic, '0000(13)|00000'));
  assert.ok(!validInstrumentFingering(synthetic, '00002|00000'));
  assert.ok(!validInstrumentFingering(synthetic, '10000|00000'));
  assert.ok(!validInstrumentFingering(synthetic, '00000|00000|G'));
  const unspecified = {...synthetic, pitches: {60: ['0000(137)|0(12)000']}};
  assert.ok(!acceptsFingering(unspecified, pitch, '0000(137)|0(12)000', 'D'));
});

// Hashes of the complete original ordered charts at 374a2e3, before migration.
const legacyCharts = [
  ['trumpet-bb',3,'eab54e868572e3dd97901c7ab382f952ece49d695bdd6e070869cf4c5bd479f7'],
  ['euphonium',3,'934dbff7cc675cc54dd66c09246bb48dba16f3d04d17646fc4e07dd6fc974d14'],
  ['euphonium',4,'a3423e9cffaef7bec04889374ce3f532b204013ad6f1a0508b47521a5ff4e82e'],
  ['tuba',3,'d32a56a0f7093b2857384a734752eaa79f04da5d88d1e31ce73f4b41f0c30dbb'],
  ['tuba',4,'29aa8f4710b79fa74e3ba9f91d0d6b0a23e67abcd6919d334c7e7d2f53a5e450'],
  ['horn-f',3,'f33b94e7b264e0ee36506e4282c57d9b7fea418d4e8654ee6669aee5fbff85ba'],
  ['violin',3,'661484f3d2c3181cc5adf82b7a581b9bb3c5d10983fc8f037cd0960c5d1eb831'],
  ['viola',3,'3e8c979480690453224a1f76cb7b7e2b108a40733e21af676bec6690568d04a8'],
  ['cello',3,'7b229d331e7fc23d62d0a76de31a4c3e8789c34619b77a5ba77ab5571354cce9'],
  ['double-bass',3,'7933cbca632fd2f42cda78271c2859fa55d92776dd329be002a1baa8dd171828'],
] as const;
test('all migrated charts preserve original pitches, primary order and every alternate', () => {
  for (const [instrument, valves, hash] of legacyCharts) {
    const config = fingeringFor(instrument, valves)!;
    const old = Object.fromEntries(Object.entries(config.pitches).map(([pitch, choices]) => [pitch, choices.map(code => {
      assert.ok(validInstrumentFingering(config, code), `${instrument}: ${code}`);
      const state = parseFingering(code);
      const order = ['leftIndex','leftMiddle','leftRing',instrument === 'horn-f' ? 'leftThumb' : 'leftLittle',
        'rightIndex','rightMiddle','rightRing','rightLittle'] as const;
      const legacy = order.map(name => state.fingers[name].length ? '1' : '0').join('');
      assert.equal(migrateLegacyFingering(legacy, instrument), code);
      return legacy;
    })]));
    assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'), hash, `${instrument}/${valves}`);
  }
});

function legacySnapshot(instrument: string | undefined, mask: string, correct: boolean, version = 5) {
  const preset = presets.find(p => p.id === 'trumpet-bb-starter')!;
  const snapshot = {...emptySnapshot(), schemaVersion: version, profiles: [{id:'p', name:'Player', defaultPresetId:preset.id, results:[],
    contexts:[{version:1, fingerprint:fingerprint(preset,false), updated:123, notes:{C4:[{
      pitch:parsePitch('C4'), answer:{kind:'fingering',mask,...(instrument ? {instrument} : {})},
      correct,responseMs:456,activity:'practice',preset:preset.id,
    }]}}]}]};
  if (version === 0) delete (snapshot as {configuration?:unknown}).configuration;
  return snapshot;
}
test('all supported legacy schemas migrate once, preserving context, correctness and timing', () => {
  for (let version = 0; version <= 5; version++) {
    for (const [instrument, mask, correct, expected] of [
      ['horn-f','00010000',true,'00001|00000'],
      ['violin','00010000',false,'10000|00000'],
      [undefined,'00000000',true,'00000|00000'],
      [undefined,'10000000',false,'00010|00000'],
    ] as const) {
      const migrated = validateSnapshot(legacySnapshot(instrument,mask,correct,version));
      const record = migrated.profiles[0]!.contexts[0]!.notes.C4![0]!;
      assert.equal(migrated.schemaVersion,7);
      assert.deepEqual(record.answer,{kind:'fingering',code:expected,...(instrument ? {instrument} : {})});
      assert.equal(record.correct,correct); assert.equal(record.responseMs,456);
      assert.equal(migrated.profiles[0]!.contexts[0]!.updated,123);
      assert.deepEqual(validateSnapshot(migrated),migrated);
      assert.deepEqual(parseBackup(JSON.stringify(migrated)),migrated);
    }
  }
  assert.throws(()=>validateSnapshot(legacySnapshot('horn-f','00010000',false)),/Invalid fingering observation/);
  assert.throws(()=>validateSnapshot(legacySnapshot('unknown','00000000',false)),/resolve legacy fingering instrument/);
  assert.throws(()=>validateSnapshot(legacySnapshot('horn-f','00001|00000',true)),/legacy fingering/);
  assert.throws(()=>validateSnapshot(legacySnapshot('horn-f','00010000',true,6)),/Invalid fingering observation/);
});

test('storage migrates lazily, exports new format, and preserves unreadable legacy data', () => {
  for (const invalid of [false,true]) {
    let raw = JSON.stringify(legacySnapshot('horn-f','00010000',!invalid));
    const original = raw;
    const storage = {getItem:(key:string)=>{assert.equal(key,STORAGE_KEY);return raw;}, setItem:(_key:string,value:string)=>{raw=value;},removeItem:()=>{raw='';}};
    const store = new NotesStore(storage);
    assert.equal(raw,original,'read does not overwrite storage');
    if (invalid) {
      assert.equal(store.durable,false);store.update(data=>{data.configuration.selfPaced=true;});store.flush();
      assert.equal(raw,original);
    } else {
      assert.equal(JSON.parse(store.export()).schemaVersion,7);store.flush();
      assert.equal(JSON.parse(raw).schemaVersion,7);
      assert.deepEqual(new NotesStore(storage).data,store.data);
    }
  }
});

test('schema 6 mask fields migrate to code; schema 7 rejects mixed or obsolete fields', () => {
  const legacy = legacySnapshot('horn-f','00001|00000',true,6);
  const migrated = validateSnapshot(legacy);
  assert.equal(migrated.schemaVersion,7);
  const answer = migrated.profiles[0]!.contexts[0]!.notes.C4![0]!.answer;
  assert.deepEqual(answer,{kind:'fingering',code:'00001|00000',instrument:'horn-f'});
  assert.ok(!JSON.stringify(migrated).includes('"mask":'));
  assert.deepEqual(parseBackup(JSON.stringify(migrated)),migrated);
  assert.throws(()=>validateSnapshot({...legacy,schemaVersion:7}),/unsupported fields/);
  assert.throws(()=>validateSnapshot({...migrated,schemaVersion:6}),/unsupported fields/);
  const mixed = structuredClone(migrated);
  Object.assign(mixed.profiles[0]!.contexts[0]!.notes.C4![0]!.answer,{mask:'00001|00000'});
  assert.throws(()=>validateSnapshot(mixed),/unsupported fields/);
});
