import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePitch, pitchAt, pitchLabel, staffPosition, ledgerPositions, sameAnswer } from '../src/apps/tunotes/domain/notation.ts';
import type { Clef } from '../src/apps/tunotes/domain/notation.ts';
import { presets, defaultPreset, normalizePreset } from '../src/apps/tunotes/domain/presets.ts';
import { Practice, PressGate, ShuffledBag } from '../src/apps/tunotes/engine/practice.ts';
import { NotesProgress } from '../src/apps/tunotes/engine/progress.ts';
import { staffGeometry } from '../src/apps/tunotes/ui/staff.ts';

test('written spelling preserves enharmonics and octave identity', () => {
  assert.deepEqual(parsePitch('F#4'), { letter: 'F', accidental: 1, octave: 4 });
  assert.equal(pitchLabel(parsePitch('Bb3')), 'B♭3');
  assert.equal(pitchLabel(parsePitch('B#3')), 'B♯3');
  assert.equal(pitchLabel(parsePitch('Cb4')), 'C♭4');
  assert.equal(sameAnswer(parsePitch('F#4'), parsePitch('Gb4')), false);
  assert.equal(sameAnswer(parsePitch('F4'), parsePitch('F5')), true);
  for (const invalid of ['C', 'H4', 'C##4', 'C-1', 'C9', 'C4x']) assert.throws(() => parsePitch(invalid));
});
test('all four natural staff fixtures and middle C anchors', () => {
  const fixtures: Record<Clef, string[]> = {
    treble: ['E4','F4','G4','A4','B4','C5','D5','E5','F5'],
    bass: ['G2','A2','B2','C3','D3','E3','F3','G3','A3'],
    alto: ['F3','G3','A3','B3','C4','D4','E4','F4','G4'],
    tenor: ['D3','E3','F3','G3','A3','B3','C4','D4','E4'],
  };
  for (const clef of Object.keys(fixtures) as Clef[]) {
    fixtures[clef].forEach((pitch, position) => {
      assert.equal(staffPosition(parsePitch(pitch), clef), position);
      assert.equal(pitchLabel(pitchAt(position, clef)), pitch);
    });
    // Every natural across the supported scientific octave domain round-trips, including exterior positions.
    for (let octave = 0; octave <= 8; octave++) for (const letter of 'CDEFGAB') {
      const pitch = parsePitch(`${letter}${octave}`);
      assert.deepEqual(pitchAt(staffPosition(pitch, clef), clef), pitch);
    }
  }
  assert.deepEqual((['treble','bass','alto','tenor'] as Clef[]).map(c => staffPosition(parsePitch('C4'), c)), [-2,10,4,6]);
  assert.equal(staffPosition(parsePitch('F#4'), 'treble'), staffPosition(parsePitch('F4'), 'treble'));
});
test('middle-C ledger geometry and exterior spaces', () => {
  assert.deepEqual(staffGeometry(parsePitch('C4'), 'treble'), { position: -2, noteY: 160, ledgers: [{position: -2, y: 160, x1: 207, x2: 253}] });
  assert.deepEqual(staffGeometry(parsePitch('C4'), 'bass'), { position: 10, noteY: 40, ledgers: [{position: 10, y: 40, x1: 207, x2: 253}] });
  assert.deepEqual(ledgerPositions(-1), []); assert.deepEqual(ledgerPositions(9), []);
  assert.deepEqual(ledgerPositions(-5), [-2,-4]); assert.deepEqual(ledgerPositions(17), [10,12,14,16]);
  assert.equal(staffGeometry(parsePitch('C7'), 'treble').ledgers.length, 5);
});
test('six presets normalize to exact finite C-major pools', () => {
  assert.deepEqual(presets.map(p => p.pool.map(pitchLabel)), [
    ['E4','G4','B4','D5','F5'], ['F4','A4','C5','E5'], ['E4','F4','G4','A4','B4','C5','D5','E5','F5'],
    ['G2','B2','D3','F3','A3'], ['A2','C3','E3','G3'], ['G2','A2','B2','C3','D3','E3','F3','G3','A3'],
  ]);
  assert.equal(defaultPreset.id, 'treble-lines-and-spaces');
  assert.ok(presets.every(p => p.key.fifths === 0 && Object.isFrozen(p.pool)));
  for (const range of [['F5','E4'], ['F#4','F5'], ['H4','F5']] as const) assert.throws(() => normalizePreset({ ...defaultPreset, range }));
  assert.throws(() => normalizePreset({ ...defaultPreset, range: ['E4','E4'], content: 'spaces' }), /empty pool/);
});
test('bags cover every pitch per cycle and avoid boundary repeats; one-note bags terminate', () => {
  for (const rng of [() => 0, () => .5, () => .9999]) {
    const bag = new ShuffledBag(defaultPreset.pool, rng); let previous = '';
    for (let cycle = 0; cycle < 10; cycle++) {
      const values = [];
      for (let i = 0; i < defaultPreset.pool.length; i++) {
        const value = pitchLabel(bag.next()); assert.notEqual(value, previous); previous = value; values.push(value);
      }
      assert.deepEqual(values.sort(), defaultPreset.pool.map(pitchLabel).sort());
    }
  }
  const one = new ShuffledBag([parsePitch('C4')]);
  for (let i = 0; i < 100; i++) assert.equal(pitchLabel(one.next()), 'C4');
  assert.throws(() => new ShuffledBag([]));
  assert.throws(() => new ShuffledBag(defaultPreset.pool, () => 1).next());
});
test('one answer per prompt, incorrect reveal interval, stale tokens and session rejection', () => {
  let now = 0; const s = new Practice(defaultPreset, false, () => now, () => .5); const token = s.token;
  now = 120; assert.equal(s.answer(token, s.pitch), true); assert.equal(s.answer(token, s.pitch), false);
  assert.equal(s.correct, 1); assert.equal(s.attempts, 1); assert.equal(s.last!.responseMs, 120);
  now = 369; assert.equal(s.advance(token), false); now = 370; assert.equal(s.advance(token), true);
  assert.equal(s.answer(token, s.pitch), false); assert.equal(s.advance(token), false);
  assert.equal(s.answer(new Practice(defaultPreset).token, s.pitch), false);
  const current = s.token; now = 500; s.answer(current, { letter: s.pitch.letter === 'A' ? 'B' : 'A', accidental: 0 });
  assert.equal(s.last!.correct, false); assert.equal(s.streak, 0); assert.equal(s.bestStreak, 1); assert.equal(s.accuracy, .5);
  now = 1299; assert.equal(s.advance(current), false); now = 1300; assert.equal(s.advance(current), true);
  s.finish(); now = 3000; assert.equal(s.activeMs, 1300); assert.equal(s.answer(s.token, s.pitch), false);
});
test('pauses exclude response and active time, preserve feedback remaining time', () => {
  let now = 0; const s = new Practice(defaultPreset, false, () => now);
  now = 100; s.pause(); now = 1100; assert.equal(s.activeMs, 100); assert.equal(s.answer(s.token, s.pitch), false);
  s.resume(); now = 1200; s.answer(s.token, s.pitch); assert.equal(s.last!.responseMs, 200);
  now = 1300; s.pause(); now = 2300; s.resume(); now = 2449; assert.equal(s.advance(s.token), false);
  now = 2450; assert.equal(s.advance(s.token), true);
  now = 2500; s.pause(); now = 5000; s.finish(); assert.equal(s.activeMs, 500);
  assert.equal(s.interrupted, true);
});
test('self-paced mode waits for Continue and held keys require release', () => {
  let now = 0; const s = new Practice(defaultPreset, true, () => now);
  assert.equal(s.accuracy, null); s.answer(s.token, s.pitch); now = 9000;
  assert.equal(s.advance(s.token), false); assert.equal(s.advance(s.token, true), true);
  const gate = new PressGate(); assert.equal(gate.down('KeyA'), true);
  assert.equal(gate.down('KeyA', true), false); assert.equal(gate.down('KeyA'), false);
  gate.up('KeyA'); assert.equal(gate.down('KeyA'), true);
});
test('lost keyup reset accepts fresh presses while still rejecting auto-repeat', () => {
  const gate = new PressGate();
  for (const code of ['KeyA', 'Enter', 'Space']) assert.equal(gate.down(code), true);
  gate.reset();
  for (const code of ['KeyA', 'Enter', 'Space']) {
    assert.equal(gate.down(code, true), false);
    assert.equal(gate.down(code), true);
    assert.equal(gate.down(code), false);
  }
});
test('Uno milestones are positive, monotonic, once-only and independent of streak errors', () => {
  const p = new NotesProgress(); assert.equal(p.update(0,0).pose, 'rest');
  assert.equal(p.update(2,2).look, true); assert.equal(p.update(2,0).look, false);
  assert.equal(p.update(4,2).pose, 'wag'); assert.equal(p.update(5,5).nod, true);
  assert.equal(p.update(5,5).nod, false); assert.equal(p.update(6,1).nod, true);
  assert.equal(p.update(8,3).pose, 'beg'); assert.equal(p.update(10,5).treat, true);
  assert.equal(p.update(10,0).pose, 'happy'); assert.equal(p.update(11,1).treat, false);
});
