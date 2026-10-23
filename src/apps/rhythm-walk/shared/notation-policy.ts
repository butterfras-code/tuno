import { meterPolicy } from './meter.ts';
import type { CountMeter } from './meter.ts';
import { duration } from '../../../music/measure.ts';
import type { RhythmEvent } from '../../../music/measure.ts';
import { add, compare, divide, fraction } from '../../../music/fraction.ts';
import type { Fraction } from '../../../music/fraction.ts';

/** Beginner reading policy for supported generated exercises, not a music-domain validity rule. */
export function readableRestPlacement(event: RhythmEvent, position: Fraction, meter: CountMeter = '4/4'): boolean {
  if (!(event.kind === 'rest')) return true;
  const policy = meterPolicy(meter);
  if (policy.compound) {
    const phase = divide(position, policy.pulse);
    const within = fraction(phase[0] % phase[1], phase[1]);
    return compare(add(within, divide(duration(event), policy.pulse)), fraction(1)) <= 0;
  }
  if (event.dots) return false; // Dotted rests remain opt-in in this simple-meter activity.
  const beat = fraction(1, 4);
  return compare(duration(event), beat) < 0 || divide(position, beat)[1] === 1;
}
