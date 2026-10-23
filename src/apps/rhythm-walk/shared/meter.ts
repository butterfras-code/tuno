import type { RhythmMeasure } from '../../../music/measure.ts';
import type { Fraction } from '../../../music/fraction.ts';
import { add, compare, divide, fraction, multiply } from '../../../music/fraction.ts';

export const meters = ['2/4', '3/4', '4/4', '6/8'] as const;
export type CountMeter = typeof meters[number];
/** Counting, notation grouping and future performance pulse are separate policies. */
export function meterPolicy(id: CountMeter = '4/4') {
  if (!meters.includes(id)) throw new Error('Choose a supported meter: 2/4, 3/4, 4/4 or 6/8.');
  const compound = id === '6/8';
  const meter: RhythmMeasure['meter'] = compound ? [6, 8] : [Number(id[0]), 4];
  return { id, meter, compound, length: fraction(meter[0], meter[1]), countingUnit: fraction(1, compound ? 8 : 4), pulse: fraction(compound ? 3 : 1, compound ? 8 : 4), groupSlots: compound ? 3 : 2 };
}
export function sourcePolicy(source: RhythmMeasure) {
  return meterPolicy(`${source.meter[0]}/${source.meter[1]}` as CountMeter);
}
/** Off-pulse sound crossing the next pulse; ending at the pulse is not syncopation. */
export function syncopated(position: Fraction, duration: Fraction, pulse: Fraction) {
  const phase = divide(position, pulse);
  if (phase[1] === 1) return false;
  const next = multiply(pulse, fraction(Math.floor(phase[0] / phase[1]) + 1));
  return compare(add(position, duration), next) > 0;
}
