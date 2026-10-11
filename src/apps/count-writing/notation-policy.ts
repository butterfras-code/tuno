import { duration } from '../../music/measure.ts';
import type { RhythmEvent } from '../../music/measure.ts';
import { compare, divide, fraction } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';

/** Beginner reading policy for generated 4/4 exercises, not a music-domain validity rule. */
export function readableRestPlacement(event: RhythmEvent, position: Fraction): boolean {
  if (!event[1]?.rest) return true;
  if (event[1]?.dots) return false; // Dotted rests remain opt-in in this simple-meter activity.
  const beat = fraction(1, 4);
  return compare(duration(event), beat) < 0 || divide(position, beat)[1] === 1;
}
