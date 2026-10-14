import { fraction, multiply } from './fraction.ts';
import type { Fraction } from './fraction.ts';
export type WrittenType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th';
export type TimeModification = readonly [3, 2] | readonly [2, 3];
export const writtenDenominators: Readonly<Record<WrittenType, number>> = Object.freeze({ whole: 1, half: 2, quarter: 4, eighth: 8, '16th': 16 });
/** Shared arithmetic for legacy tuples and the typed MusicXML profile. */
export function writtenDuration(type: WrittenType, dots: number, tuplet?: TimeModification): Fraction {
  if (!Object.hasOwn(writtenDenominators, type)) throw new Error('Unsupported written value.');
  if (![0, 1, 2].includes(dots)) throw new Error('Only zero, one or two dots are supported.');
  let value = multiply(fraction(1, writtenDenominators[type]), fraction(2 ** (dots + 1) - 1, 2 ** dots));
  if (tuplet) {
    const [actual, normal] = tuplet;
    if (tuplet.length !== 2 || !((actual === 3 && normal === 2) || (actual === 2 && normal === 3))) throw new Error('Only triplet 3:2 and duplet 2:3 groups are supported.');
    value = multiply(value, fraction(normal, actual));
  }
  return value;
}
export function immutable<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(immutable);
    Object.freeze(value);
  }
  return value;
}
