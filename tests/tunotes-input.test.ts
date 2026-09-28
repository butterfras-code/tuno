import test from 'node:test';
import assert from 'node:assert/strict';
import { answerLayout, supportedAnswer } from '../src/apps/tunotes/domain/answer-layout.ts';
import { keyNames, keySignature, spelling } from '../src/apps/tunotes/domain/notation.ts';
import { defaultPreset, normalizePreset } from '../src/apps/tunotes/domain/presets.ts';

test('every available key spans a full octave and repeats its spelled tonic', () => {
  for (const name of keyNames.filter(k=>k!=='Cb')) {
    const key=keySignature(name), layout=answerLayout(key);
    const tonic=layout.filter(t=>spelling(t.answer)===spelling(key.tonic));
    assert.equal(tonic.length,2);
    assert.deepEqual(tonic.map(t=>t.column),[1,15]);
    assert.deepEqual(tonic.map(t=>t.repeat),[false,true]);
    assert.ok(layout.every(t=>supportedAnswer(t.answer) && t.column>=1 && t.column<=15));
  }
});
test('black-key spellings sit halfway between naturals and align vertically', () => {
  const layout=answerLayout(keySignature('C'));
  const at=(label:string)=>layout.find(t=>spelling(t.answer)===label)!;
  for (const [natural,sharp,flat,next] of [['C','C♯','D♭','D'],['D','D♯','E♭','E'],['F','F♯','G♭','G'],['G','G♯','A♭','A'],['A','A♯','B♭','B']]) {
    assert.equal(at(sharp!).column,(at(natural!).column+at(next!).column)/2);
    assert.equal(at(sharp!).column,at(flat!).column);
    assert.equal(at(sharp!).row,1); assert.equal(at(flat!).row,3);
  }
  assert.deepEqual(layout.filter(t=>t.row===2).map(t=>spelling(t.answer)),['C','D','E','F','G','A','B','C']);
  assert.deepEqual(answerLayout(keySignature('Bb')).filter(t=>t.row===2).map(t=>spelling(t.answer)),['B','C','D','E','F','G','A']);
});
test('unavailable spellings are excluded from prompts rather than respelled', () => {
  for (const name of keyNames.filter(k=>k!=='Cb')) {
    const preset=normalizePreset({...defaultPreset,key:keySignature(name),range:['C4','B5'],accidentals:'both'});
    assert.ok(preset.pool.every(supportedAnswer));
  }
  assert.throws(()=>normalizePreset({...defaultPreset,key:keySignature('C#'),range:['B4','B4']}),/empty/);
  assert.throws(()=>normalizePreset({...defaultPreset,key:keySignature('Cb')}),/unavailable/);
});

 test('earlier saved rare-spelling configurations remain importable without making them playable', async () => {
  const {emptySnapshot,validateSnapshot}=await import('../src/apps/tunotes/persistence/store.ts');
  const data=emptySnapshot();
  const {pool,version,...base}=defaultPreset;
  const source={...base,id:'legacy-custom',name:'Earlier C-flat',key:keySignature('Cb'),ledgerBelow:0,ledgerAbove:0,accidentals:'key-only' as const};
  data.customPresets.push(source);
  assert.equal(validateSnapshot(data).customPresets[0]!.key!.fifths,-7);
  assert.throws(()=>normalizePreset(source),/unavailable/);
 });
