import { chromatic, diatonic, letters } from './notation.ts';
import type { AnswerSpelling, KeySignature } from './notation.ts';

export function supportedAnswer(p: AnswerSpelling) {
  return !(p.accidental === 1 && (p.letter === 'B' || p.letter === 'E') || p.accidental === -1 && (p.letter === 'C' || p.letter === 'F'));
}

/** Diatonic keys occupy whole slots; the five black-key positions occupy half slots.
 * Both spellings of a black key share x, but live above/below the natural row.
 */
export function answerLayout(key: KeySignature) {
  const low = chromatic({ ...key.tonic, octave: 4 });
  const pitches = [];
  for (let octave = 3; octave <= 5; octave++) for (const letter of letters) for (const accidental of [1, 0, -1] as const) {
    const pitch = { letter, accidental, octave };
    const semitone = chromatic(pitch);
    if (supportedAnswer(pitch) && semitone >= low && semitone <= low + 12) pitches.push(pitch);
  }
  const origin = Math.min(...pitches.map(p => diatonic(p) + p.accidental / 2));
  return pitches.map(p => ({
    answer: { letter: p.letter, accidental: p.accidental },
    column: Math.round(2 * (diatonic(p) + p.accidental / 2 - origin)) + 1,
    row: p.accidental === 1 ? 1 : p.accidental === 0 ? 2 : 3,
    repeat: chromatic(p) === low + 12,
  })).sort((a, b) => a.row - b.row || a.column - b.column);
}
