import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseMusicXML, serializeMusicXML, serializeCountingExercise } from '../src/music/musicxml.ts';
import { deriveScore, createScore } from '../src/music/score.ts';
import { derivePassage } from '../src/music/measure.ts';
import { scoreFromLegacy } from '../src/music/legacy-score.ts';
import { practiceFixtures } from '../src/apps/rhythm-walk/shared/fixtures.ts';
import { planPassage, musicalSeconds } from '../src/apps/rhythm-walk/timing.ts';
import { buildCountingPlan } from '../src/music/counting/plan.ts';
import { defaultCountingPreferences } from '../src/music/counting/preferences.ts';
import { add } from '../src/music/fraction.ts';
const dir = new URL('./fixtures/musicxml/', import.meta.url);
const fixture = (name: string) => readFileSync(new URL(`${name}.musicxml`, dir), 'utf8');
for (const file of readdirSync(dir).filter(f => f.endsWith('.musicxml'))) test(`MusicXML golden round trip: ${file}`, () => {
  const xml = readFileSync(new URL(file, dir), 'utf8');
  const source = parseMusicXML(xml);
  assert.deepEqual(parseMusicXML(serializeMusicXML(source)), source);
  if (file === 'derived-exercise.musicxml') assert.equal(serializeCountingExercise(buildCountingPlan(source)), xml);
  else assert.equal(serializeMusicXML(source), xml);
});
test('all legacy fixtures: exact attack/duration/source and performance-time equivalence through XML', () => {
  for (const fixture of practiceFixtures) {
    const old = derivePassage(fixture.measures);
    const source = parseMusicXML(serializeMusicXML(scoreFromLegacy(fixture.measures)));
    const current = deriveScore(source);
    assert.deepEqual(current.length, old.length);
    assert.deepEqual(current.attacks.map(a => ({ start: a.start, duration: a.duration, sources: a.sources.map(s => ({ measure: s.measure, event: s.event })) })), old.attacks, fixture.id);
    for (const symbol of current.symbols) {
      const previous = old.measures[symbol.measure]!.events[symbol.event]!;
      assert.deepEqual(symbol.localStart, previous.start); assert.deepEqual(symbol.duration, previous.duration);
    }
    for (const bpm of [60, 103, 180]) {
      const pulse = fixture.measures[0]!.meter[1] === 8 ? [3, 8] as const : [1, 4] as const;
      const legacy = planPassage(fixture.measures, bpm, undefined, pulse);
      const notes = current.attacks.map(a => ({ start: musicalSeconds(a.start, bpm, pulse), end: musicalSeconds(add(a.start, a.duration), bpm, pulse), sources: a.sources.map(s => ({ measure: s.measure, event: s.event })), finalSegmentDuration: musicalSeconds(a.sources.at(-1)!.duration, bpm, pulse) }));
      assert.deepEqual(notes, legacy.notes, fixture.id);
    }
  }
});
test('ties have one authored relation, computed incoming state across bars, and both serialized endpoints', () => {
  const score = parseMusicXML(fixture('cross-bar-tie'));
  const symbols = deriveScore(score).symbols;
  assert.equal(symbols[3]!.tiedToPrevious, true);
  assert.equal(symbols[4]!.tiedToPrevious, true);
  assert.equal(symbols[3]!.source.tieNext, true);
  assert.ok(!Object.hasOwn(symbols[3]!.source, 'tiedToPrevious'));
  assert.deepEqual(deriveScore(score).attacks[2]!.duration, [3, 4]);
  assert.deepEqual(deriveScore(parseMusicXML(serializeMusicXML(score))).attacks, deriveScore(score).attacks);
});
test('mixed binary/triplet export chooses exact divisions and never rounds', () => {
  const xml = fixture('triplet-binary');
  assert.match(xml, /<divisions>12<\/divisions>/);
  const symbols = deriveScore(parseMusicXML(xml)).symbols;
  assert.deepEqual(symbols.slice(0, 3).map(s => s.duration), [[1, 12], [1, 12], [1, 12]]);
  assert.deepEqual(symbols[3]!.duration, [1, 16]);
  const broad = parseMusicXML(fixture('double-dot-duplet'));
  assert.deepEqual(broad.measures[0]!.notes[0]!.dots, 2);
  assert.deepEqual(broad.measures[0]!.notes[2]!.timeModification, [2, 3]);
  assert.throws(() => buildCountingPlan(broad), /Unsupported counting/);
});
test('derived marker is standard text, stripped on import and rebuilt from immutable configuration', () => {
  const xml = fixture('derived-exercise');
  assert.match(xml, /<other-notation type="single" print-object="no">tuno:subdivide<\/other-notation>/);
  assert.match(xml, /miscellaneous-field name="tuno:counting-v1"/);
  const source = parseMusicXML(xml);
  assert.ok(!serializeMusicXML(source).includes('tuno:'));
  const off = buildCountingPlan(source, { ...defaultCountingPreferences, longNotes: false, dotted: true });
  assert.equal(off.counts.length, 1);
  assert.ok(!serializeCountingExercise(off).includes('tuno:subdivide'));
});
const binary = fixture('binary-rests');
const rejects: [string, string][] = [
  ['inconsistent duration', binary.replace('<duration>4</duration>', '<duration>3</duration>')],
  ['unsupported pitch', binary.replace('<unpitched/>', '<pitch><step>C</step><octave>4</octave></pitch>')],
  ['custom child', binary.replace('<unpitched/>', '<unpitched/><tuno:subdivide/>')],
  ['polyphony backup', binary.replace('</measure>', '<backup><duration>1</duration></backup></measure>')],
  ['chord', binary.replace('<unpitched/>', '<chord/><unpitched/>')],
  ['voice', binary.replace('<voice>1</voice>', '<voice>2</voice>')],
  ['performed duration offset', binary.replace('<note id=', '<note attack="1" id=')],
  ['unknown attribute', binary.replace('<rest/>', '<rest measure="yes"/>')],
  ['unknown notation', binary.replace('</note>', '<notations><other-notation type="single">subdivide</other-notation></notations></note>')],
  ['duplicate duration', binary.replace('</duration>', '</duration><duration>1</duration>')],
  ['out of order', binary.replace('<voice>1</voice>', '').replace('</type>', '</type><voice>1</voice>')],
  ['unsupported type', binary.replace('<type>half</type>', '<type>32nd</type>')],
  ['bad divisions', binary.replace('<divisions>2</divisions>', '<divisions>0</divisions>')],
  ['fractional divisions outside profile', binary.replace('<divisions>2</divisions>', '<divisions>2.5</divisions>')],
  ['unsafe integer', binary.replace('<divisions>2</divisions>', '<divisions>9007199254740992</divisions>')],
  ['namespace', binary.replace('version="4.0"', 'version="4.0" xmlns="urn:other"')],
  ['DTD', '<!DOCTYPE score-partwise SYSTEM "https://example.invalid/test.dtd">' + binary],
  ['malformed', binary.replace('</note>', '</wrong>')],
  ['duplicate source IDs', binary.replace('id="m1n2"', 'id="m1n1"')],
  ['unsupported meter', binary.replace('<beats>4</beats>', '<beats>5</beats>')],
  ['unresolved tie', fixture('cross-bar-tie').replaceAll('<tie type="stop"/>', '')],
  ['inconsistent tie arc', fixture('cross-bar-tie').replace('<tied type="start"/>', '<tied type="stop"/>')],
  ['rest tie', binary.replace('<voice>1</voice>', '<tie type="start"/><voice>1</voice>')],
  ['unsupported tuplet', fixture('triplet-binary').replace('<actual-notes>3</actual-notes>', '<actual-notes>5</actual-notes>')],
  ['incomplete measure', binary.replace(/<note id="m1n3">[\s\S]*?<\/note>/, '')],
];
for (const [name, xml] of rejects) test(`reject MusicXML: ${name}`, () => {
  assert.notEqual(xml, binary, 'mutation must change fixture');
  assert.throws(() => parseMusicXML(xml));
});
test('typed source validation rejects incomplete tuplets, rest tie destinations and final ties', () => {
  assert.throws(() => scoreFromLegacy([{ meter: [4, 4], events: [['Q', { tieNext: true }], ['Q', { rest: true }], ['H']] }]), /rest/);
  const valid = parseMusicXML(binary), notes = valid.measures[0]!.notes;
  assert.throws(() => createScore({ measures: [{ meter: [4, 4], notes: notes.map((n, i) => i === 2 ? { ...n, tieNext: true } : n) }] }), /final tie/);
  assert.throws(() => createScore({ measures: [] }), /Empty/);
  const triplet = parseMusicXML(fixture('triplet-binary'));
  assert.throws(() => createScore({ measures: [{ ...triplet.measures[0]!, notes: triplet.measures[0]!.notes.slice(1) }] }), /tuplet/);
});
test('authored source refuses duplicate duration, incoming-tie, and teaching-marker truth', () => {
  const source = parseMusicXML(fixture('compound-dotted-half'));
  for (const extra of [{ duration: [3, 4] }, { tiedToPrevious: false }, { subdivide: true }]) {
    assert.throws(() => createScore({ measures: [{ ...source.measures[0]!, notes: [{ ...source.measures[0]!.notes[0]!, ...extra }] }] }), /authored musical field/);
  }
  const collision = createScore({ measures: [{ ...source.measures[0]!, notes: [{ ...source.measures[0]!.notes[0]!, id: 'P1' }] }] });
  assert.match(serializeMusicXML(collision), /score-part id="P1_"/);
  assert.deepEqual(parseMusicXML(serializeMusicXML(collision)), collision);
});
test('deterministic generated passages retain attacks after the one-way conversion', async () => {
  const { generateExercise, ingredients } = await import('../src/apps/rhythm-walk/shared/generation.ts');
  let seed = 714;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const meter of ['2/4', '3/4', '4/4', '6/8'] as const) for (const measures of [1, 2, 3, 4]) for (let sample = 0; sample < 8; sample++) {
    const legacy = generateExercise({ meters: [meter], measures, ingredients: ingredients.map(i => i.id), ties: true, syncopation: true, allowUnintuitiveNotation: true }, random);
    const source = scoreFromLegacy(legacy);
    const actual = deriveScore(parseMusicXML(serializeMusicXML(source)));
    assert.deepEqual(actual.attacks.map(a => ({ start: a.start, duration: a.duration })), derivePassage(legacy).attacks.map(a => ({ start: a.start, duration: a.duration })));
    for (const dotted of [false, true]) buildCountingPlan(source, { ...defaultCountingPreferences, dotted });
  }
});
