import { compare, divide, fraction, toNumber, type Fraction } from './fraction.ts';

export const quarterPulse: Fraction = [1, 4];
/** BPM is in units of pulse, independent of counting labels or measure.groups. */
export function musicalSeconds(time: Fraction, bpm: number, pulse: Fraction = quarterPulse): number {
  if (!Number.isFinite(bpm) || bpm <= 0 || compare(pulse, fraction(0)) <= 0) throw new Error('Invalid tempo/pulse.');
  return toNumber(divide(time, pulse)) * 60 / bpm;
}
