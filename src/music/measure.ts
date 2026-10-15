/** Derived bar/beat views of the typed score, never a second authored model. */
import { noteDuration, deriveScore, createScore } from './score.ts';
import type { WrittenNote, ScoreMeasure } from './score.ts';
import { add, compare, divide, fraction, multiply, subtract } from './fraction.ts';
import type { Fraction } from './fraction.ts';
import type { WrittenType } from './written.ts';
export type RhythmEvent = WrittenNote;
export type RhythmMeasure = ScoreMeasure;
export type NoteValue = WrittenType;
export const duration = noteDuration;
/** Authoring/generation template. score() assigns deterministic passage-wide IDs. */
export function note(type: WrittenType, options: Partial<Omit<WrittenNote, 'id' | 'type'>> = {}): WrittenNote {
  return { id: 'draft', kind: 'note', type, dots: 0, tieNext: false, ...options };
}
/** Finish construction once; consumers retain this immutable score and its IDs. */
export function score(measures: readonly ScoreMeasure[]) {
  return createScore({ measures: measures.map((bar, mi) => ({ meter: bar.meter, notes: bar.notes.map((n, ni) => ({ ...n, id: `m${mi + 1}n${ni + 1}` })) })) });
}
export interface DerivedEvent {
  readonly written: WrittenNote;
  readonly index: number;
  readonly start: Fraction;
  readonly duration: Fraction;
  readonly end: Fraction;
  readonly kind: 'note' | 'rest';
  readonly tupletGroup: number | null;
}
export interface DerivedMeasure {
  readonly length: Fraction;
  readonly beats: readonly { start: Fraction; duration: Fraction }[];
  readonly events: readonly DerivedEvent[];
}
/** Layout/generator view; complete-score validation owns IDs and cross-bar ties. */
export function deriveMeasure(measure: ScoreMeasure): DerivedMeasure {
  const [n, d] = measure.meter;
  if (!['2/4', '3/4', '4/4', '6/8'].includes(measure.meter.join('/'))) throw new Error('Unsupported profile meter.');
  const groups = d === 8 ? [3, 3] : Array<number>(n).fill(1);
  const length = fraction(n, d);
  let position = fraction(0);
  const beats = groups.map(group => {
    const beat = { start: position, duration: fraction(group, d) };
    position = add(position, beat.duration); return beat;
  });
  position = fraction(0);
  let remaining = 0, groupStart: number | null = null, signature = '';
  const events = measure.notes.map((written, index): DerivedEvent => {
    const value = duration(written);
    const nextSignature = JSON.stringify([written.type, written.dots, written.timeModification]);
    if (remaining && signature !== nextSignature) throw new Error('Incomplete or mixed-value tuplet group.');
    if (!remaining && written.timeModification) { remaining = written.timeModification[0]; groupStart = index; signature = nextSignature; }
    const event = { written, index, start: position, duration: value, end: add(position, value), kind: written.kind, tupletGroup: remaining ? groupStart : null };
    if (remaining) remaining--;
    if (written.kind === 'rest' && (written.tieNext || measure.notes[index - 1]?.tieNext)) throw new Error('Rests cannot tie.');
    position = event.end; return event;
  });
  if (remaining) throw new Error('Incomplete tuplet group at barline.');
  if (compare(position, length)) throw new Error('Written notes must fill the measure exactly.');
  return { length, beats, events };
}
export function validateMeasure(measure: ScoreMeasure) { deriveMeasure(measure); }
export function beatCoordinate(measure: DerivedMeasure, position: Fraction): Fraction {
  if (compare(position, fraction(0)) < 0 || compare(position, measure.length) > 0) throw new Error('Position outside measure.');
  if (!compare(position, measure.length)) return fraction(measure.beats.length * 12);
  const index = measure.beats.findIndex(b => compare(position, add(b.start, b.duration)) < 0);
  const beat = measure.beats[index]!;
  return add(fraction(index * 12), multiply(divide(subtract(position, beat.start), beat.duration), fraction(12)));
}
export function derivePassage(source: readonly ScoreMeasure[]) {
  const derived = deriveScore({ measures: source });
  return { measures: source.map(deriveMeasure), attacks: derived.attacks.map(a => ({ start: a.start, duration: a.duration, sources: a.sources.map(s => ({ measure: s.measure, event: s.event })) })), length: derived.length };
}
