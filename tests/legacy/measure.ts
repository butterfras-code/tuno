import { writtenDuration } from '../../src/music/written.ts';
import type { WrittenType } from '../../src/music/written.ts';
import { add, compare, divide, fraction, multiply, subtract } from '../../src/music/fraction.ts';
import type { Fraction } from '../../src/music/fraction.ts';

/** Historical pre-migration tuple implementation: test oracle only, never runtime source. */
export type NoteValue = 'W' | 'H' | 'Q' | 'E' | 'S';
export interface Modifiers {
  readonly rest?: boolean;
  readonly dots?: 0 | 1 | 2;
  /** Actual notes : normal notes. Flat, homogeneous groups; no nested tuplets. */
  readonly tuplet?: readonly [3, 2] | readonly [2, 3];
  readonly tieNext?: boolean;
}
export type RhythmEvent = readonly [value: NoteValue, modifiers?: Modifiers];
export interface RhythmMeasure {
  readonly meter: readonly [numerator: number, denominator: 2 | 4 | 8 | 16];
  /** Denominator-unit counts per beat: 6/8 [3,3], 7/8 [2,2,3]. */
  readonly groups?: readonly number[];
  readonly events: readonly RhythmEvent[];
}
export interface DerivedEvent {
  readonly written: RhythmEvent;
  readonly index: number;
  readonly start: Fraction;
  readonly duration: Fraction;
  readonly end: Fraction;
  readonly kind: 'note' | 'rest';
  /** Index of the first event in this tuplet group, or null. */
  readonly tupletGroup: number | null;
}
export interface DerivedMeasure {
  readonly length: Fraction;
  readonly beats: readonly { start: Fraction; duration: Fraction }[];
  readonly events: readonly DerivedEvent[];
}
const writtenTypes: Record<NoteValue, WrittenType> = { W: 'whole', H: 'half', Q: 'quarter', E: 'eighth', S: '16th' };

/** Written duration in whole-note units, independent of meter and counting convention. */
export function duration([value, options = {}]: RhythmEvent): Fraction {
  if (!Object.hasOwn(writtenTypes, value)) throw new Error('Unsupported written value.');
  if ((options.rest !== undefined && typeof options.rest !== 'boolean') ||
      (options.tieNext !== undefined && typeof options.tieNext !== 'boolean')) throw new Error('Invalid event modifier.');
  if (options.rest && options.tieNext) throw new Error('A rest cannot start a tie.');
  return writtenDuration(writtenTypes[value], options.dots ?? 0, options.tuplet);
}

function meterGroups(measure: RhythmMeasure): readonly number[] {
  const [n, d] = measure.meter;
  if (!Number.isSafeInteger(n) || n < 1 || n > 32 || ![2, 4, 8, 16].includes(d)) throw new Error('Unsupported meter.');
  const groups = measure.groups ?? (n > 3 && n % 3 === 0 && d >= 8 ? Array<number>(n / 3).fill(3) : n <= 4 ? Array<number>(n).fill(1) : null);
  if (!groups) throw new Error('Specify beat groups for this meter.');
  if (!groups.length || groups.some(g => !Number.isSafeInteger(g) || g <= 0) || groups.reduce((a, b) => a + b, 0) !== n) throw new Error('Beat groups must sum to the meter numerator.');
  return groups;
}

/** Validate one complete bar. An outgoing final tie is resolved by derivePassage. */
export function deriveMeasure(measure: RhythmMeasure): DerivedMeasure {
  const groups = meterGroups(measure);
  const length = fraction(measure.meter[0], measure.meter[1]);
  let position = fraction(0);
  const beats = groups.map(group => {
    const beat = { start: position, duration: fraction(group, measure.meter[1]) };
    position = add(position, beat.duration);
    return beat;
  });
  position = fraction(0);
  let remaining = 0, groupStart: number | null = null, groupSignature = '';
  const events = measure.events.map((written, index): DerivedEvent => {
    const value = duration(written);
    const options = written[1];
    const signature = options?.tuplet ? JSON.stringify([written[0], options.dots ?? 0, options.tuplet]) : '';
    if (remaining && signature !== groupSignature) throw new Error('Incomplete or mixed-value tuplet group.');
    if (!remaining && options?.tuplet) {
      remaining = options.tuplet[0]; groupStart = index; groupSignature = signature;
    }
    const event = { written, index, start: position, duration: value, end: add(position, value), kind: options?.rest ? 'rest' as const : 'note' as const, tupletGroup: remaining ? groupStart : null };
    if (remaining) remaining--;
    if (index && measure.events[index - 1]?.[1]?.tieNext && event.kind === 'rest') throw new Error('A tie cannot continue into a rest.');
    position = event.end;
    return event;
  });
  if (remaining) throw new Error('Incomplete tuplet group at barline.');
  if (compare(position, length)) throw new Error('Written events must fill the measure exactly.');
  return { length, beats, events };
}
export function validateMeasure(measure: RhythmMeasure): void { deriveMeasure(measure); }

/** Zero-based beat coordinates with 12 subdivisions per grouped beat.
 * Fractions are retained for combinations not integral on this grid; never round. */
export function beatCoordinate(measure: DerivedMeasure, position: Fraction): Fraction {
  if (compare(position, fraction(0)) < 0 || compare(position, measure.length) > 0) throw new Error('Position outside measure.');
  if (!compare(position, measure.length)) return fraction(measure.beats.length * 12);
  const index = measure.beats.findIndex(b => compare(position, add(b.start, b.duration)) < 0);
  const beat = measure.beats[index]!;
  return add(fraction(index * 12), multiply(divide(subtract(position, beat.start), beat.duration), fraction(12)));
}

export interface Attack {
  readonly start: Fraction;
  duration: Fraction;
  readonly sources: { measure: number; event: number }[];
}
/** Monophonic written events remain intact; ties collapse only in this performance view. */
export function derivePassage(source: readonly RhythmMeasure[]): { measures: DerivedMeasure[]; attacks: Attack[]; length: Fraction } {
  const measures = source.map(deriveMeasure);
  const attacks: Attack[] = [];
  let offset = fraction(0), pendingTie = false;
  measures.forEach((measure, measureIndex) => {
    measure.events.forEach(event => {
      if (pendingTie && event.kind === 'rest') throw new Error('A tie cannot continue into a rest.');
      if (event.kind === 'note') {
        const origin = { measure: measureIndex, event: event.index };
        if (pendingTie) {
          const attack = attacks.at(-1)!;
          attack.duration = add(attack.duration, event.duration); attack.sources.push(origin);
        } else attacks.push({ start: add(offset, event.start), duration: event.duration, sources: [origin] });
      }
      pendingTie = event.written[1]?.tieNext ?? false;
    });
    offset = add(offset, measure.length);
  });
  if (pendingTie) throw new Error('Unresolved tie at end of passage.');
  return { measures, attacks, length: offset };
}
