import { parseFingering, fingerPositions } from '../src/shared/input/fingering-code.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptsFingering, trumpetFingering, OPEN_FINGERING, validFingering } from '../src/apps/tunotes/domain/fingering.ts';
import { chromatic, parsePitch } from '../src/apps/tunotes/domain/notation.ts';
import { presets, normalizePreset } from '../src/apps/tunotes/domain/presets.ts';
import { expansionPlan } from '../src/apps/tunotes/engine/adaptive.ts';
import { HeldFingers } from '../src/shared/input/held-fingers.ts';
import { FINGERING_SETTLE_MS, FingeringPolicy } from '../src/apps/tunotes/engine/fingering-policy.ts';
import { Practice } from '../src/apps/tunotes/engine/practice.ts';
import { Challenge, defaultTimed } from '../src/apps/tunotes/engine/challenge.ts';
import { fitFingerArrangement, fingerArrangementOffset } from '../src/shared/input/fingering-resize.ts';
import { fingerLayout, fingerSpacing } from '../src/shared/input/fingering-layout.ts';

test('hand layouts keep thumb offsets relative to their anchor for every spacing', () => {
  const horn = fingerLayout(4, { index: 3, anchor: 0, along: -0.75, across: 1 });
  for (const distance of Object.values(fingerSpacing)) {
    const [one, two, three, thumb] = horn.points;
    assert.equal((thumb!.along - one!.along) * distance, -distance * 0.75);
    assert.ok(Math.abs((thumb!.across - one!.across) * distance - distance) < 1e-9);
    assert.equal(two!.along - one!.along, three!.along - two!.along);
    assert.ok(distance >= 68 && distance <= 100);
  }
  for (const count of [3, 4]) {
    const layout = fingerLayout(count);
    assert.equal(layout.along, count - 1);
    assert.equal(layout.across, 0);
    assert.ok(layout.points.every(p => p.across === 0));
  }
  assert.deepEqual(fingerLayout(0), { along: 0, across: 0, points: [] });
});

const combinations = ['00000|00000','00000|01000','00000|00100','00000|00010','00000|01100','00000|01010','00000|00110','00000|01110'];
test('all eight valve combinations preserve the ten-finger representation', () => {
  const notes = ['C4','F4','B3','A3','E4','D4','Eb4','F#3'];
  combinations.forEach((code, i) => {
    const held = new HeldFingers();
    fingerPositions.forEach(position => { if (parseFingering(code).fingers[position].includes('1')) held.down(position, position); });
    assert.equal(held.code, code);
    assert.ok(acceptsFingering(trumpetFingering, parsePitch(notes[i]!), code));
    assert.ok(validFingering(code));
  });
  assert.ok(!validFingering('1000')); assert.ok(!validFingering('00002000'));
});
test('chart covers trumpet presets and expansion, alternates and shared codes', () => {
  for (const p of presets.filter(p => p.instrument === 'trumpet-bb')) {
    for (const pitch of [...p.pool, ...expansionPlan(p).flat()]) assert.ok(trumpetFingering.pitches[chromatic(pitch)], JSON.stringify(pitch));
  }
  assert.equal(Object.keys(trumpetFingering.pitches).length, 31);
  for (const pitch of ['A3','E4','A4','E5','A5']) {
    for (const code of ['00000|01100','00000|00010']) assert.ok(acceptsFingering(trumpetFingering, parsePitch(pitch), code));
  }
  for (const pitch of ['C4','G4','C5','E5','G5','C6']) assert.ok(acceptsFingering(trumpetFingering, parsePitch(pitch), OPEN_FINGERING));
  assert.ok(acceptsFingering(trumpetFingering, parsePitch('Db4'), '00000|01110'));
  assert.ok(!acceptsFingering(trumpetFingering, parsePitch('C4'), '00000|01000'));
});
test('independent keyboard and touch sources retain the union of held fingers', () => {
  const held = new HeldFingers();
  held.down('touch:1','rightIndex'); held.down('touch:2','rightMiddle'); held.down('key:j','rightIndex');
  assert.equal(held.code,'00000|01100');
  assert.equal(held.down('key:j','rightIndex'),false);
  assert.equal(held.up('touch:1'),false);
  held.up('key:j'); assert.equal(held.code,'00000|00100');
  held.reset(); assert.equal(held.code,OPEN_FINGERING);
});
test('settling rolls, cancellations, open, locks and repeated cards', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const submissions: string[] = [];
  const policy = new FingeringPolicy((code, token) => submissions.push(`${token.prompt}:${code}`));
  policy.update({session:1,prompt:1},false);
  assert.equal(FINGERING_SETTLE_MS,350);
  t.mock.timers.tick(500); assert.equal(submissions.length,0);
  policy.change('00000|01000'); t.mock.timers.tick(120);
  policy.change('00000|01100'); t.mock.timers.tick(FINGERING_SETTLE_MS - 1); assert.equal(submissions.length,0);
  t.mock.timers.tick(1); assert.deepEqual(submissions,['1:00000|01100']);
  policy.change('00000|01100'); t.mock.timers.tick(500); assert.equal(submissions.length,1);
  policy.update({session:1,prompt:2},false); t.mock.timers.tick(500); assert.equal(submissions.length,1);
  policy.change('00000|00100'); t.mock.timers.tick(FINGERING_SETTLE_MS); assert.equal(submissions.at(-1),'2:00000|00100');
  policy.change(OPEN_FINGERING); t.mock.timers.tick(500); assert.equal(submissions.length,2);
  policy.open(); assert.equal(submissions.at(-1),'2:00000|00000');
  policy.change('00000|01000'); policy.change(OPEN_FINGERING,false); t.mock.timers.tick(500); assert.equal(submissions.length,3);
  policy.change('00000|01100'); policy.update({session:1,prompt:3},false); t.mock.timers.tick(500); assert.equal(submissions.length,3);
  policy.update({session:1,prompt:3},true); policy.open(); policy.change('00000|01000');
  policy.update({session:1,prompt:3},false); t.mock.timers.tick(500); assert.equal(submissions.length,3);
});
test('intermediate states held for a full window submit: isolated policy limitation', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const seen: string[] = []; const policy = new FingeringPolicy(code => seen.push(code));
  policy.update({session:1,prompt:1},false);
  policy.change('00000|01000'); t.mock.timers.tick(FINGERING_SETTLE_MS);
  policy.change('00000|01100'); t.mock.timers.tick(FINGERING_SETTLE_MS);
  assert.deepEqual(seen,['00000|01000','00000|01100']);
});
test('fingering uses existing scoring and all advancement policies without inventing pitches', () => {
  const preset = normalizePreset({id:'test', name:'Repeated E', clef:'treble', instrument:'trumpet-bb', range:['E4','E4'], content:'lines-and-spaces'});
  for (const continueAfter of ['instant','correct','click','delay'] as const) {
    let now = 0;
    const s = new Practice(preset,false,()=>now,Math.random,{continueAfter});
    assert.ok(s.answer(s.token,{kind:'fingering',code:'00000|01000'}));
    assert.equal(s.correct,0); assert.equal(s.attempts,1);
    assert.ok(!s.answer(s.token,{kind:'fingering',code:'00000|00010'}));
    now += 1000; s.advance(s.token,true);
    const old = s.token;
    assert.ok(s.answer(s.token,{kind:'fingering',code:'00000|00010'}));
    assert.equal(s.correct,1); assert.equal(s.last?.correct,true);
    assert.deepEqual(s.last?.answer,{kind:'fingering',code:'00000|00010'});
    now += 1000; s.advance(s.token,true);
    assert.ok(!s.answer(old,{kind:'fingering',code:'00000|00010'}));
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
  s.answer(s.token,{kind:'fingering',code:trumpetFingering.pitches[chromatic(s.pitch)]![0]!});
  store.observe(profile.id,preset,s.last!);
  const backup = parseBackup(store.export());
  assert.deepEqual(backup.profiles[0]!.contexts[0]!.notes,store.data.profiles[0]!.contexts[0]!.notes);
  assert.equal(validateSnapshot({...emptySnapshot(),schemaVersion:4}).schemaVersion,7);
  const invalid = JSON.parse(store.export());
  const observation = Object.values(invalid.profiles[0].contexts[0].notes)[0] as {answer:{code:string}}[];
  observation[0]!.answer.code = '1000'; assert.throws(()=>validateSnapshot(invalid));
});

test('additional brass charts cover every preset and adaptive expansion in written pitch', async () => {
  const { fingeringFor } = await import('../src/apps/tunotes/domain/fingering.ts');
  for (const instrument of ['horn-f','tuba','euphonium']) {
    const config = fingeringFor(instrument)!;
    for (const preset of presets.filter(p=>p.instrument===instrument)) {
      for (const pitch of [...preset.pool,...expansionPlan(preset).flat()]) {
        const codes = config.pitches[chromatic(pitch)];
        assert.ok(codes?.length,`${instrument}: ${JSON.stringify(pitch)}`);
        assert.ok(codes.every(code=>validFingering(code) && fingerPositions.every(name=>!parseFingering(code).fingers[name].length || config.fingers.some(f=>f.position===name))));
      }
    }
  }
  const tuba=fingeringFor('tuba')!, euph=fingeringFor('euphonium')!, horn=fingeringFor('horn-f')!;
  assert.ok(acceptsFingering(tuba,parsePitch('Bb1'),OPEN_FINGERING));
  assert.ok(acceptsFingering(euph,parsePitch('Bb2'),OPEN_FINGERING));
  assert.ok(!acceptsFingering(euph,parsePitch('C3'),OPEN_FINGERING));
  assert.ok(acceptsFingering(euph,parsePitch('C3'),'00000|01010'));
  assert.ok(acceptsFingering(horn,parsePitch('C4'),OPEN_FINGERING));
  assert.ok(acceptsFingering(horn,parsePitch('C4'),'00001|00000'));
  assert.ok(acceptsFingering(horn,parsePitch('Ab4'),'01101|00000'));
  assert.ok(acceptsFingering(horn,parsePitch('Ab4'),'01100|00000'));
  assert.ok(acceptsFingering(horn,parsePitch('Db2'),'01101|00000'));
  assert.ok(!acceptsFingering(horn,parsePitch('Db2'),'01100|00000'));
});

test('musical keyboard defaults to pitch class with optional octave matching, enharmonics, and stores answers', async () => {
  const { NotesStore,parseBackup }=await import('../src/apps/tunotes/persistence/store.ts');
  const preset=normalizePreset({id:'keyboard-test',name:'C sharp',instrument:'trumpet-bb',clef:'treble',range:['C#4','C#4'],exactRange:true,content:'lines-and-spaces'});
  const s=new Practice(preset,false,()=>0,Math.random,{continueAfter:'instant'});
  s.answer(s.token,{kind:'keyboard',note:49}); assert.equal(s.correct,1);
  s.advance(s.token); s.answer(s.token,{kind:'keyboard',note:59}); assert.equal(s.correct,1); // concert pitch is wrong
  s.advance(s.token); s.answer(s.token,{kind:'keyboard',note:61}); assert.equal(s.correct,2);
  s.advance(s.token); s.answer(s.token,{kind:'keyboard',note:49,matchOctave:true}); assert.equal(s.correct,2);
  s.advance(s.token); s.answer(s.token,{kind:'keyboard',note:61,matchOctave:true}); assert.equal(s.correct,3);
  const builtIn=presets.find(p=>p.id==='trumpet-bb-starter')!;
  const stored=new Practice(builtIn); stored.answer(stored.token,{kind:'keyboard',note:chromatic(stored.pitch)-12});
  const store=new NotesStore();
  store.update(data=>data.profiles.push({id:'piano',name:'Piano',results:[],contexts:[],defaultPresetId:builtIn.id}));
  store.observe('piano',builtIn,stored.last!);
  assert.deepEqual(parseBackup(store.export()).profiles[0]!.contexts,store.data.profiles[0]!.contexts);
  const legacy=JSON.parse(store.export());
  const record=Object.values(legacy.profiles[0].contexts[0].notes)[0] as Array<{answer:{matchOctave?:boolean};correct:boolean}>;
  delete record[0]!.answer.matchOctave;
  record[0]!.correct=false; // This different-octave answer was wrong under the old rule.
  const restored=parseBackup(JSON.stringify(legacy));
  const historical=Object.values(restored.profiles[0]!.contexts[0]!.notes)[0]![0]!;
  assert.equal(historical.correct,false);
  assert.deepEqual(historical.answer,{kind:'keyboard',note:chromatic(stored.pitch)-12,matchOctave:true});
  record[0]!.answer.matchOctave=false; // The same grading result would be inconsistent under the new rule.
  assert.throws(()=>parseBackup(JSON.stringify(legacy)),/Invalid keyboard observation/);
  store.flush();
});

test('four-valve low brass retains three-valve choices and adds standard fourth-valve answers', async () => {
  const { fingeringFor } = await import('../src/apps/tunotes/domain/fingering.ts');
  for (const [instrument,octave] of [['euphonium',2],['tuba',1]] as const) {
    const three=fingeringFor(instrument,3)!, four=fingeringFor(instrument,4)!;
    assert.equal(three.fingers.length,3); assert.equal(four.fingers.length,4);
    assert.deepEqual(four.fingers[3],{position:'rightLittle',label:'4',accessibleLabel:'Valve 4',key:';'});
    for (const [pitch,codes] of Object.entries(three.pitches)) {
      assert.ok(codes.every(code=>four.pitches[Number(pitch)]!.includes(code)));
      assert.ok(four.pitches[Number(pitch)]!.every(validFingering));
    }
    for (const [pitch,code] of [[`F${octave}`,'00000|00001'],[`E${octave}`,'00000|00101'],[`C${octave+1}`,'00000|00001'],[`Bb${octave}`,'00000|01001']] as const) {
      assert.ok(acceptsFingering(four,parsePitch(pitch),code));
      assert.ok(!acceptsFingering(three,parsePitch(pitch),code));
    }
    assert.ok(!acceptsFingering(four,parsePitch(`F${octave}`),'00000|01001'));
    for (let bits=0;bits<16;bits++) {
      const held=new HeldFingers();
      for (let i=0;i<4;i++) if (bits & (1 << (3-i))) held.down(`key:${i}`,fingerPositions[6+i]!);
      assert.equal(held.code,'00000|0'+bits.toString(2).padStart(4,'0'));
    }
  }
  assert.equal(fingeringFor('trumpet-bb',4)!.fingers.length,3);
  assert.equal(fingeringFor('horn-f',4)!.fingers[3]!.label,'T');
});

test('fourth-valve scores and saved observations round-trip for both bass-clef instruments', async () => {
  const { NotesStore,parseBackup }=await import('../src/apps/tunotes/persistence/store.ts');
  for (const instrument of ['euphonium','tuba']) {
    const preset=presets.find(p=>p.id===`${instrument}-one-and-half-octaves`)!;
    const session=new Practice(preset,false,()=>0,()=>0.999,{continueAfter:'instant'});
    session.pitch=parsePitch(instrument==='tuba' ? 'F1' : 'F2');
    session.answer(session.token,{kind:'fingering',code:'00000|00001'});
    assert.equal(session.correct,1);
    const store=new NotesStore();
    store.update(data=>data.profiles.push({id:'four',name:'Four valves',results:[],contexts:[],defaultPresetId:preset.id}));
    store.observe('four',preset,session.last!);
    assert.deepEqual(parseBackup(store.export()).profiles[0]!.contexts,store.data.profiles[0]!.contexts);
    store.flush();
  }
});

test('selected input instrument overrides the preset chart and survives backup export', async () => {
  const { NotesStore, parseBackup } = await import('../src/apps/tunotes/persistence/store.ts');
  const preset = presets.find(p => p.id === 'trumpet-bb-starter')!;
  const session = new Practice(preset, false, () => 0, () => 0, {continueAfter:'instant'});
  session.pitch = parsePitch('C4');
  // The thumb trigger alone is valid on double horn, while trumpet has no left-hand trigger bit.
  session.answer(session.token, {kind:'fingering', code:'00001|00000', instrument:'horn-f'});
  assert.equal(session.correct, 1);
  const store = new NotesStore();
  store.update(data=>data.profiles.push({id:'instrument',name:'Instrument',results:[],contexts:[],defaultPresetId:preset.id}));
  store.observe('instrument',preset,session.last!);
  assert.deepEqual(parseBackup(store.export()).profiles[0]!.contexts,store.data.profiles[0]!.contexts);
  const invalid = store.export().replaceAll('horn-f','not-an-instrument');
  assert.throws(()=>parseBackup(invalid),/Invalid fingering observation/);
  store.flush();
});

test('string Big 5 charts cover every existing preset in written pitch', async () => {
  const { fingeringFor } = await import('../src/apps/tunotes/domain/fingering.ts');
  for (const instrument of ['violin','viola','cello','double-bass']) {
    const chart=fingeringFor(instrument)!;
    assert.equal(chart.hand,'left'); assert.equal(chart.control,'finger');
    assert.deepEqual(chart.fingers.map(f=>f.key),['f','d','s','a']);
    const bigFive=presets.filter(p=>p.instrument===instrument && p.id.includes('starter'));
    assert.equal(bigFive.length,4);
    for(const preset of bigFive) for(const note of preset.pool) assert.ok(chart.pitches[chromatic(note)]?.length,`${preset.id}: ${JSON.stringify(note)}`);
  }
});

test('string fingerings accept lower held fingers but reject higher fingers and right-hand bits', async () => {
  const { fingeringFor } = await import('../src/apps/tunotes/domain/fingering.ts');
  const violin=fingeringFor('violin')!;
  for(const [pitch,finger] of [['E4',1],['F#4',2],['G4',3],['A4',4]] as const) {
    for(let bits=0;bits<1024;bits++) {
      const binary=bits.toString(2).padStart(10,'0');
      const code=binary.slice(0,5)+'|'+binary.slice(5);
      const highest=4-binary.slice(0,4).indexOf('1');
      const expected=(highest===finger && binary.slice(4)==='000000') || pitch==='A4' && bits===0;
      assert.equal(acceptsFingering(violin,parsePitch(pitch),code),expected,`${pitch}: ${code}`);
    }
  }
  assert.ok(acceptsFingering(fingeringFor('cello')!,parsePitch('F#3'),'01000|00000'));
  assert.ok(!acceptsFingering(fingeringFor('cello')!,parsePitch('F#3'),'00100|00000'));
  assert.ok(acceptsFingering(fingeringFor('double-bass')!,parsePitch('F#3'),'10000|00000'));
  assert.ok(acceptsFingering(fingeringFor('double-bass')!,parsePitch('G3'),OPEN_FINGERING));
  assert.ok(!acceptsFingering(fingeringFor('double-bass')!,parsePitch('G2'),OPEN_FINGERING));
  assert.ok(!acceptsFingering(fingeringFor('cello')!,parsePitch('E4'),OPEN_FINGERING));
});

test('violin open strings are primary without losing fourth-finger alternatives', async () => {
  const { fingeringFor } = await import('../src/apps/tunotes/domain/fingering.ts');
  const violin = fingeringFor('violin')!;
  for (const pitch of ['G3','D4','A4','E5']) {
    const note = parsePitch(pitch);
    assert.equal(violin.pitches[chromatic(note)]![0],OPEN_FINGERING,pitch);
    for (let bits = 0; bits < 1024; bits++) {
      const binary = bits.toString(2).padStart(10,'0');
      const code = binary.slice(0,5)+'|'+binary.slice(5);
      const fourthFinger = binary[0] === '1' && binary.slice(4) === '000000';
      assert.equal(acceptsFingering(violin,note,code),bits === 0 || pitch !== 'G3' && fourthFinger,`${pitch}: ${code}`);
    }
  }
  assert.notEqual(violin.pitches[chromatic(parsePitch('B5'))]![0],OPEN_FINGERING,'The top-string fourth finger is still required');
});

test('string answers grade through the existing activity and survive backup export', async () => {
  const { NotesStore, parseBackup } = await import('../src/apps/tunotes/persistence/store.ts');
  const preset=presets.find(p=>p.id==='violin-starter')!;
  const session=new Practice(preset,false,()=>0,()=>0,{continueAfter:'instant'});
  session.pitch=parsePitch('F#4');
  session.answer(session.token,{kind:'fingering',code:'00110|00000',instrument:'violin'});
  assert.equal(session.correct,1);
  const store=new NotesStore();
  store.update(data=>data.profiles.push({id:'strings',name:'Strings',results:[],contexts:[],defaultPresetId:preset.id}));
  store.observe('strings',preset,session.last!);
  assert.deepEqual(parseBackup(store.export()).profiles[0]!.contexts,store.data.profiles[0]!.contexts);
  store.flush();
});

test('a submitted held answer releases into the next primary-open card once', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const seen: string[] = [];
  const policy = new FingeringPolicy((code, token) => {
    seen.push(`${token.prompt}:${code}`);
    // Match synchronous instant advancement in the real entry component.
    policy.update({session:1,prompt:token.prompt+1},false,true);
  });
  policy.update({session:1,prompt:1},false);
  policy.change('00000|01100'); t.mock.timers.tick(FINGERING_SETTLE_MS);
  policy.change('00000|00100'); t.mock.timers.tick(50);
  policy.change(OPEN_FINGERING); t.mock.timers.tick(FINGERING_SETTLE_MS - 1);
  assert.deepEqual(seen,['1:00000|01100']);
  t.mock.timers.tick(1);
  assert.deepEqual(seen,['1:00000|01100','2:00000|00000']);
  t.mock.timers.tick(1000); policy.change(OPEN_FINGERING); t.mock.timers.tick(FINGERING_SETTLE_MS);
  assert.equal(seen.length,2,'remaining open cannot answer another card');
  policy.open(); assert.equal(seen.at(-1),'3:00000|00000');
});

test('release-to-open requires the immediately previous submitted hold and primary-open target', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  for (const scenario of ['first','unsubmitted','same-card','non-open','skipped','new-session','released-before-next'] as const) {
    const seen: string[] = [];
    const policy = new FingeringPolicy(code => seen.push(code));
    policy.update({session:1,prompt:1},false,true);
    if (scenario !== 'first') policy.change('00000|01000');
    if (!['first','unsubmitted'].includes(scenario)) t.mock.timers.tick(FINGERING_SETTLE_MS);
    if (scenario === 'released-before-next') policy.change(OPEN_FINGERING);
    policy.update({session:scenario === 'new-session' ? 2 : 1,prompt:scenario === 'same-card' ? 1 : scenario === 'skipped' ? 3 : 2},false,scenario !== 'non-open');
    const before = seen.length;
    policy.change(OPEN_FINGERING); t.mock.timers.tick(500);
    assert.equal(seen.length,before,scenario);
  }
});

test('release-to-open cancels on interruption, a new press, explicit Open, and stale prompts', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  for (const scenario of ['reset','partial-cancel','press','lock','prompt','explicit','cancel'] as const) {
    const seen: string[] = [];
    const policy = new FingeringPolicy(code => seen.push(code));
    policy.update({session:1,prompt:1},false);
    policy.change('00000|01100'); t.mock.timers.tick(FINGERING_SETTLE_MS);
    policy.update({session:1,prompt:2},false,true);
    if (scenario === 'partial-cancel') policy.change('00000|00100',false);
    policy.change(OPEN_FINGERING,scenario !== 'reset'); t.mock.timers.tick(100);
    if (scenario === 'press') { policy.change('00000|01000'); policy.change(OPEN_FINGERING); }
    if (scenario === 'lock') { policy.update({session:1,prompt:2},true,true); policy.update({session:1,prompt:2},false,true); }
    if (scenario === 'prompt') policy.update({session:1,prompt:3},false,true);
    if (scenario === 'explicit') policy.open();
    if (scenario === 'cancel') policy.cancel();
    t.mock.timers.tick(500);
    assert.deepEqual(seen,scenario === 'explicit' ? ['00000|01100',OPEN_FINGERING] : ['00000|01100'],scenario);
  }
});

test('a hold retained through feedback can release after delayed advancement', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const seen: string[] = [];
  const policy = new FingeringPolicy(code => seen.push(code));
  policy.update({session:1,prompt:1},false);
  policy.change('00000|01000'); t.mock.timers.tick(FINGERING_SETTLE_MS);
  policy.update({session:1,prompt:1},true); t.mock.timers.tick(500);
  policy.update({session:1,prompt:2},false,true);
  policy.change(OPEN_FINGERING); t.mock.timers.tick(FINGERING_SETTLE_MS);
  assert.deepEqual(seen,['00000|01000',OPEN_FINGERING]);
});


test('independent resizing fits each axis without limiting it to the other axis', () => {
  const fit = fitFingerArrangement(900, 120, 2, 0, 84, { x: 3, y: 1 });
  assert.equal(fit.scaleX, 3);
  assert.equal(fit.scaleY, 1);
  const bounded = fitFingerArrangement(300, 120, 2, 0, 84, { x: 20, y: 20 });
  assert.equal(bounded.baseWidth * bounded.scaleX, 300);
  assert.equal(bounded.baseHeight * bounded.scaleY, 120);
});

test('legacy proportional sizes fit within the available hand area', () => {
  for (const [width,height,along,across] of [[350,168,2.75,1],[166,480,1,2.75],[138,260,0,3],[900,500,3,0]]) {
    for (const spacing of Object.values(fingerSpacing)) {
      for (const requested of [0.75,1,1.5,20]) {
        const fit = fitFingerArrangement(width!,height!,along!,across!,spacing,requested);
        assert.ok(fit.baseWidth * fit.scale <= width! + 1e-9);
        assert.ok(fit.baseHeight * fit.scale <= height! + 1e-9);
        assert.ok(fit.step >= 64, 'target footprints never overlap');
        assert.ok(fit.scale <= requested && fit.scale <= fit.maximum);
        assert.ok(64 * fit.scale >= 48, 'supported areas retain comfortable minimum targets');
      }
    }
  }
  const full = fitFingerArrangement(900,500,3,0,84,20);
  assert.equal(full.baseWidth * full.scale, 900, 'Fill can use the entire available width');
});

for (const adaptive of [false, true]) test(`instrument prompts change primary fingering (adaptive=${adaptive})`, () => {
  const base = normalizePreset({id:'changes',name:'Changes',instrument:'trumpet-bb',clef:'treble',range:['C4','G4'],content:'lines-and-spaces'});
  // Three open pitches and one fingered pitch exercise depleted-bag bridging.
  const preset = {...base, pool: ['C4','E5','G4','D4'].map(parsePitch)};
  const session = new Practice(preset, false, () => 0, () => .999, {
    adaptive, continueAfter: 'instant', inputFingering: () => trumpetFingering,
  });
  const seen = new Set<number>();
  for (let i = 0; i < 40; i++) {
    const previous = trumpetFingering.pitches[chromatic(session.pitch)]![0]!;
    seen.add(chromatic(session.pitch));
    assert.ok(session.answer(session.token, {kind:'fingering',code:previous}));
    assert.ok(session.advance(session.token));
    assert.notEqual(trumpetFingering.pitches[chromatic(session.pitch)]![0], previous);
  }
  if (!adaptive) assert.equal(seen.size, 4, 'deferred pitches are still presented');
});

test('single-fingering pools stay playable and changing input method takes effect immediately', () => {
  const base = normalizePreset({id:'open',name:'Open',instrument:'trumpet-bb',clef:'treble',range:['C4','G4'],content:'lines-and-spaces'});
  for (const adaptive of [false, true]) {
    const session = new Practice({...base,pool:['C4','G4'].map(parsePitch)},false,()=>0,()=>.999,
      {adaptive,continueAfter:'instant',inputFingering:()=>trumpetFingering});
    for (let i=0;i<10;i++) {
      assert.ok(session.answer(session.token,{kind:'fingering',code:OPEN_FINGERING}));
      assert.ok(session.advance(session.token));
    }
  }
  let enabled = false;
  const session = new Practice({...base,pool:['D4','C4','G4'].map(parsePitch)},false,()=>0,()=>.999,
    {continueAfter:'instant',inputFingering:()=>enabled ? trumpetFingering : undefined});
  assert.equal(chromatic(session.pitch),67);
  session.answer(session.token,{kind:'fingering',code:OPEN_FINGERING}); session.advance(session.token);
  assert.equal(chromatic(session.pitch),60,'note-name selection retains its original order');
  enabled = true;
  session.answer(session.token,{kind:'fingering',code:OPEN_FINGERING}); session.advance(session.token);
  assert.equal(chromatic(session.pitch),62);
});


test('Challenge avoids shared primary fingerings and Until correct preserves retries', () => {
  const base = normalizePreset({id:'transition',name:'Transition',instrument:'trumpet-bb',clef:'treble',range:['C4','G4'],content:'lines-and-spaces'});
  const preset = {...base,pool:['D4','C4','G4'].map(parsePitch)};
  let now = 0;
  const challenge = new Challenge(preset,defaultTimed,()=>now,()=>.999,{inputFingering:()=>trumpetFingering});
  challenge.ready(); now = 3000; challenge.tick();
  assert.ok(challenge.answer(challenge.token,{kind:'fingering',code:OPEN_FINGERING}));
  assert.ok(challenge.advance(challenge.token));
  assert.equal(chromatic(challenge.pitch),62);
  const practice = new Practice(preset,false,()=>now,()=>.999,{continueAfter:'correct',inputFingering:()=>trumpetFingering});
  const original = practice.pitch;
  practice.answer(practice.token,{kind:'fingering',code:'00000|01000'}); now += 800;
  assert.ok(practice.advance(practice.token));
  assert.equal(practice.pitch,original);
});


test('hand placement reaches input edges and clamps without changing hand size', () => {
  assert.deepEqual(fingerArrangementOffset(160,500,64,300,{x:0,y:0}),{x:-48,y:-100});
  assert.deepEqual(fingerArrangementOffset(160,500,64,300,{x:1,y:1}),{x:48,y:100});
  assert.deepEqual(fingerArrangementOffset(160,500,64,300,{x:0.5,y:0.5}),{x:0,y:0});
  assert.deepEqual(fingerArrangementOffset(160,500,64,300,{x:-2,y:4}),{x:-48,y:100});
  assert.deepEqual(fingerArrangementOffset(64,300,64,300,{x:1,y:1}),{x:0,y:0});
});

test('equivalent grouped codes do not restart the settling window', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const seen: string[] = [];
  const policy = new FingeringPolicy(code=>seen.push(code));
  policy.update({session:1,prompt:1},false);
  policy.change('0000(31)|00000'); t.mock.timers.tick(200);
  policy.change('0000(13)|00000'); t.mock.timers.tick(FINGERING_SETTLE_MS-200);
  assert.deepEqual(seen,['0000(13)|00000']);
});

test('open-hand recognition includes optional string identity without automatic open submissions', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const seen: string[] = [];
  const policy = new FingeringPolicy(code=>seen.push(code));
  policy.update({session:1,prompt:1},false,true);
  policy.change('00000|00000|D'); t.mock.timers.tick(500);
  assert.deepEqual(seen,[]);
  policy.change('00010|00000|D'); t.mock.timers.tick(FINGERING_SETTLE_MS);
  policy.update({session:1,prompt:2},false,true);
  policy.change('00000|00000|D'); t.mock.timers.tick(FINGERING_SETTLE_MS);
  assert.deepEqual(seen,['00010|00000|D','00000|00000|D']);
  policy.update({session:1,prompt:3},false,true);
  policy.change('00000|00000|A'); t.mock.timers.tick(500);
  assert.equal(seen.length,2,'Changing an open string must not submit another answer');
});

test('practice rejects malformed codes and records canonical valid attempts', () => {
  const preset = presets.find(p=>p.id==='trumpet-bb-starter')!;
  const session = new Practice(preset,false,()=>0,()=>0,{continueAfter:'instant'});
  session.pitch = parsePitch('C4');
  assert.equal(session.answer(session.token,{kind:'fingering',code:'00000000'}),false);
  assert.equal(session.attempts,0); assert.equal(session.observations.length,0);
  assert.ok(session.answer(session.token,{kind:'fingering',code:'00000|0(21)000'}));
  assert.deepEqual(session.last?.answer,{kind:'fingering',code:'00000|0(12)000'});
  assert.equal(session.last?.correct,false,'Unsupported controls remain an incorrect attempt');
});

test('prompt selection ignores string-only differences for finger-only input', () => {
  const preset = normalizePreset({id:'string-context',name:'String context',instrument:'trumpet-bb',clef:'treble',range:['C4','E4'],content:'lines-and-spaces'});
  const config = {...trumpetFingering,strings:['D','A'],pitches:{60:['00000|00000|D'],62:['00000|00000|A'],64:['00000|01000|D']}};
  const session = new Practice(preset,false,()=>0,()=>0,{continueAfter:'instant',inputFingering:()=>config});
  session.pitch=parsePitch('C4');
  session.answer(session.token,{kind:'keyboard',note:60}); session.advance(session.token);
  assert.equal(chromatic(session.pitch),64);
});
