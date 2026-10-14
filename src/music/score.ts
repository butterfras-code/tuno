import { add, compare, fraction } from './fraction.ts';
import type { Fraction } from './fraction.ts';
import { immutable, writtenDuration } from './written.ts';
import type { WrittenType, TimeModification } from './written.ts';

/** Typed MusicXML 4.0 rhythm profile. No stored performed duration or incoming tie. */
export interface WrittenNote {
  readonly id: string;
  readonly kind: 'note' | 'rest';
  readonly type: WrittenType;
  readonly dots: 0 | 1 | 2;
  readonly timeModification?: TimeModification;
  /** The sole authored tie relation, to the immediately following written note. */
  readonly tieNext: boolean;
}
export interface ScoreMeasure {
  readonly meter: readonly [number, 4 | 8];
  readonly notes: readonly WrittenNote[];
}
export interface RhythmScore { readonly measures: readonly ScoreMeasure[] }
export interface ScoreSymbol {
  readonly source: WrittenNote;
  readonly measure: number;
  readonly event: number;
  readonly localStart: Fraction;
  readonly start: Fraction;
  readonly duration: Fraction;
  readonly end: Fraction;
  readonly tiedToPrevious: boolean;
  readonly tupletGroup: string | null;
}
export interface SoundingAttack {
  readonly start: Fraction;
  readonly duration: Fraction;
  readonly sources: readonly ScoreSymbol[];
}
export interface DerivedScore {
  readonly symbols: readonly ScoreSymbol[];
  readonly attacks: readonly SoundingAttack[];
  readonly length: Fraction;
}
function onlyKeys(value: object, allowed: readonly string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unsupported authored musical field.');
}
export const noteDuration = (note: WrittenNote) => writtenDuration(note.type, note.dots, note.timeModification);
export function deriveScore(score: RhythmScore): DerivedScore {
  onlyKeys(score, ['measures']);
  if (!score.measures.length) throw new Error('Empty score.');
  const symbols: ScoreSymbol[] = [];
  const attacks: { start: Fraction; duration: Fraction; sources: ScoreSymbol[] }[] = [];
  const ids = new Set<string>();
  let offset = fraction(0), pending = false;
  score.measures.forEach((measure, mi) => {
    onlyKeys(measure, ['meter', 'notes']);
    if (measure.meter.length !== 2) throw new Error('Unsupported profile meter.');
    if (!['2/4', '3/4', '4/4', '6/8'].includes(measure.meter.join('/'))) throw new Error('Unsupported profile meter.');
    let local = fraction(0), remaining = 0, signature = '', tupletGroup: string | null = null;
    measure.notes.forEach((note, ei) => {
      onlyKeys(note, ['id', 'kind', 'type', 'dots', 'timeModification', 'tieNext']);
      if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(note.id) || ids.has(note.id)) throw new Error('Source IDs must be unique XML IDs.');
      ids.add(note.id);
      if (!['note', 'rest'].includes(note.kind) || typeof note.tieNext !== 'boolean') throw new Error('Invalid written note.');
      if (note.kind === 'rest' && (pending || note.tieNext)) throw new Error('Rests cannot tie.');
      const duration = noteDuration(note);
      const nextSignature = JSON.stringify([note.type, note.dots, note.timeModification]);
      if (remaining && signature !== nextSignature) throw new Error('Incomplete or mixed tuplet group.');
      if (!remaining && note.timeModification) {
        remaining = note.timeModification[0]; signature = nextSignature; tupletGroup = note.id;
      }
      const start = add(offset, local);
      const symbol: ScoreSymbol = { source: note, measure: mi, event: ei, localStart: local, start, duration, end: add(start, duration), tiedToPrevious: pending, tupletGroup: remaining ? tupletGroup : null };
      if (remaining) remaining--;
      symbols.push(symbol);
      if (note.kind === 'note') {
        if (pending) { const attack = attacks.at(-1)!; attack.duration = add(attack.duration, duration); attack.sources.push(symbol); }
        else attacks.push({ start, duration, sources: [symbol] });
      }
      pending = note.tieNext;
      local = add(local, duration);
    });
    if (remaining) throw new Error('Incomplete tuplet at barline.');
    if (compare(local, fraction(...measure.meter))) throw new Error('Written notes must fill the measure exactly.');
    offset = add(offset, local);
  });
  if (pending) throw new Error('Unresolved final tie.');
  return immutable({ symbols, attacks: attacks as readonly SoundingAttack[], length: offset });
}
/** Own a detached immutable source; callers cannot mutate a captured exercise. */
export function createScore(source: RhythmScore): RhythmScore {
  const score = structuredClone(source);
  deriveScore(score);
  return immutable(score);
}
