/** Equal temperament. Note numbers follow MIDI: C4 = 60, A4 = 69.
 * Numbers outside the MIDI transport range are allowed for musical calculations.
 */
export const DEFAULT_A4_HZ = 440;
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

function positiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
}

function integer(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer.`);
  }
}

export function noteFrequency(note: number, a4Hz = DEFAULT_A4_HZ): number {
  integer(note, 'Note');
  positiveFinite(a4Hz, 'A4 reference');
  const frequency = a4Hz * 2 ** ((note - 69) / 12);
  positiveFinite(frequency, 'Resulting frequency');
  return frequency;
}

export function centsBetween(frequencyHz: number, referenceHz: number): number {
  positiveFinite(frequencyHz, 'Frequency');
  positiveFinite(referenceHz, 'Reference frequency');
  return 1200 * (Math.log2(frequencyHz) - Math.log2(referenceHz));
}

export function noteName(note: number): string {
  integer(note, 'Note');
  const pitchClass = ((note % 12) + 12) % 12;
  return `${NOTE_NAMES[pitchClass]}${Math.floor(note / 12) - 1}`;
}

/** Offset is added to concert pitch to produce written pitch: B-flat instrument = +2. */
export function concertToWritten(concertNote: number, offset: number): number {
  integer(concertNote, 'Concert note');
  integer(offset, 'Transposition');
  const result = concertNote + offset;
  integer(result, 'Written note');
  return result;
}

export function writtenToConcert(writtenNote: number, offset: number): number {
  return concertToWritten(writtenNote, -offset);
}

export interface PitchReading {
  concertNote: number;
  writtenNote: number;
  cents: number;
}

/** Nearest equal-tempered note; exact halfway cases round toward the higher note. */
export function identifyPitch(frequencyHz: number, a4Hz = DEFAULT_A4_HZ, offset = 0): PitchReading {
  const semitonesFromA4 = centsBetween(frequencyHz, a4Hz) / 100;
  const concertNote = Math.round(69 + semitonesFromA4);
  return {
    concertNote,
    writtenNote: concertToWritten(concertNote, offset),
    cents: (69 + semitonesFromA4 - concertNote) * 100,
  };
}
