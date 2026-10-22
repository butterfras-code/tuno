import { divide, fraction } from '../fraction.ts';
import type { Fraction } from '../fraction.ts';
export const alphabet = ['1', '2', '3', '4', '5', '6', '&', 'e', 'a', 'ta', 'te', 'la', 'li'] as const;
export type CountToken = typeof alphabet[number] | '';
export type CountingSystem = 'numbers' | 'syllables';
export function countAt(position: Fraction, compound: boolean, system: CountingSystem = 'numbers', triplet = false): CountToken {
  if (triplet) {
    const thirds = divide(position, fraction(1, 12));
    if (thirds[1] !== 1) return '';
    return thirds[0] % 3 === 0 ? String(Math.floor(thirds[0] / 3) + 1) as CountToken : thirds[0] % 3 === 1 ? 'la' : 'li';
  }
  const units = divide(position, fraction(1, compound ? 8 : 16));
  if (units[1] !== 1) throw new Error('Position is outside the reviewed count lattice.');
  if (compound) return String(units[0] + 1) as CountToken;
  const phase = units[0] % 4;
  return phase === 0 ? String(Math.floor(units[0] / 4) + 1) as CountToken :
    (system === 'syllables' ? ['','ta','te','ta'] : ['','e','&','a'])[phase] as CountToken;
}
