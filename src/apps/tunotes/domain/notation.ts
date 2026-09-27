export const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = typeof letters[number];
export type Accidental = -1 | 0 | 1;
export interface AnswerSpelling { readonly letter: Letter; readonly accidental: Accidental }
export interface WrittenPitch extends AnswerSpelling { readonly octave: number }
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';
export interface KeySignature { readonly tonic: AnswerSpelling; readonly fifths: number; readonly mode: 'major' }
export const C_MAJOR: KeySignature = Object.freeze({ tonic: Object.freeze({ letter: 'C', accidental: 0 }), fifths: 0, mode: 'major' });
export const anchors: Readonly<Record<Clef, WrittenPitch>> = {
  treble: { letter: 'E', accidental: 0, octave: 4 }, bass: { letter: 'G', accidental: 0, octave: 2 },
  alto: { letter: 'F', accidental: 0, octave: 3 }, tenor: { letter: 'D', accidental: 0, octave: 3 },
};
export function parsePitch(source: string): WrittenPitch {
  const match = /^([A-G])([b#]?)([0-8])$/.exec(source);
  if (!match) throw new Error(`Invalid written pitch: ${source}; use C4, Bb3 or F#4 (octaves 0–8).`);
  return Object.freeze({ letter: match[1] as Letter, accidental: match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0, octave: Number(match[3]) });
}
export function diatonic(pitch: WrittenPitch) { return pitch.octave * 7 + letters.indexOf(pitch.letter); }
export function staffPosition(pitch: WrittenPitch, clef: Clef) { return diatonic(pitch) - diatonic(anchors[clef]); }
export function pitchAt(position: number, clef: Clef): WrittenPitch {
  const value = diatonic(anchors[clef]) + position;
  if (!Number.isInteger(position) || value < 0 || value > 62) throw new Error('Staff position must resolve to octave 0–8.');
  return Object.freeze({ letter: letters[value % 7]!, accidental: 0, octave: Math.floor(value / 7) });
}
export function spelling(pitch: AnswerSpelling) { return pitch.letter + (pitch.accidental === 1 ? '♯' : pitch.accidental === -1 ? '♭' : ''); }
export function pitchLabel(pitch: WrittenPitch) { return spelling(pitch) + pitch.octave; }
export function sameAnswer(a: AnswerSpelling, b: AnswerSpelling) { return a.letter === b.letter && a.accidental === b.accidental; }
export function ledgerPositions(position: number) {
  const result: number[] = [];
  for (let p = -2; p >= position; p -= 2) result.push(p);
  for (let p = 10; p <= position; p += 2) result.push(p);
  return result;
}
export function positionDescription(position: number) {
  if (position >= 0 && position <= 8) return `${['first', 'second', 'third', 'fourth', 'fifth'][Math.floor(position / 2)]} ${position % 2 ? 'space' : 'line'} from bottom`;
  return `${Math.abs(position < 0 ? position : position - 8)} half-space steps ${position < 0 ? 'below' : 'above'} staff`;
}

export const keyNames = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'] as const;
export function keySignature(name: string): KeySignature {
  const index = (keyNames as readonly string[]).indexOf(name);
  if (index < 0) throw new Error('Choose a supported major key.');
  return Object.freeze({ tonic: parsePitch(`${name}4`), fifths: index - 7, mode: 'major' });
}
export function keyName(key: KeySignature) { return keyNames[key.fifths + 7]!; }
export function keyAccidental(letter: Letter, key: KeySignature): Accidental {
  const order = key.fifths > 0 ? 'FCGDAEB' : 'BEADGCF';
  return order.slice(0, Math.abs(key.fifths)).includes(letter) ? key.fifths > 0 ? 1 : -1 : 0;
}
export function chromatic(p: WrittenPitch) { return (p.octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][letters.indexOf(p.letter)]! + p.accidental; }
// Standard engraving placements, in half-spaces from each clef's bottom line.
export const keyPositions: Record<Clef, { sharp: readonly number[]; flat: readonly number[] }> = {
  treble: { sharp: [8,5,9,6,3,7,4], flat: [4,7,3,6,2,5,1] },
  bass: { sharp: [6,3,7,4,1,5,2], flat: [2,5,1,4,0,3,-1] },
  alto: { sharp: [7,4,8,5,2,6,3], flat: [3,6,2,5,1,4,0] },
  tenor: { sharp: [2,6,3,7,4,8,5], flat: [5,8,4,7,3,6,2] },
};
