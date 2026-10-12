import { alphabet } from './evaluation.ts';
import { divide, fraction } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';
import type { CountSymbol } from './evaluation.ts';

// Input aliases and displayed syllables belong to the counting system, not musical time.
export type OffbeatSymbol = '&' | '+';
export function countKey(key: string): CountSymbol | null {
  if (key === '+') return '&';
  return (alphabet as readonly string[]).includes(key) ? key as CountSymbol : null;
}
export function displayCount(symbol: CountSymbol, offbeat: OffbeatSymbol): string {
  return symbol === '&' ? offbeat : symbol;
}

export type CountingSystem = 'numbers' | 'syllables';
export function countAt(position: Fraction, compound: boolean, system: CountingSystem = 'numbers', triplet = false): CountSymbol {
  if (triplet) {
    const thirds = divide(position, fraction(1, 12));
    if (thirds[1] !== 1) return '';
    return thirds[0] % 3 === 0 ? String(Math.floor(thirds[0] / 3) + 1) as CountSymbol : thirds[0] % 3 === 1 ? 'la' : 'li';
  }
  const units = divide(position, fraction(1, compound ? 8 : 16));
  if (units[1] !== 1) throw new Error('Position is outside the reviewed count lattice.');
  if (compound) return String(units[0] + 1) as CountSymbol;
  const phase = units[0] % 4;
  return phase === 0 ? String(Math.floor(units[0] / 4) + 1) as CountSymbol :
    (system === 'syllables' ? ['','ta','te','ta'] : ['','e','&','a'])[phase] as CountSymbol;
}
/** Translate meaning, never substitute the expected answer for an incorrect token. */
export function translateCount(token: CountSymbol, position: Fraction, from: CountingSystem, to: CountingSystem, triplet = false): CountSymbol {
  if (from === to || !token || token === 'la' || token === 'li' || /^\d$/.test(token)) return token;
  if (to === 'syllables' && (token === 'e' || token === 'a') && countAt(position, false, 'numbers', triplet) !== token && countAt(position, false, 'syllables', triplet) === 'ta') return '';
  if (to === 'syllables') return ({ e: 'ta', '&': 'te', a: 'ta' } as Partial<Record<CountSymbol, CountSymbol>>)[token] ?? '';
  if (token === 'te') return '&';
  if (token === 'ta') {
    const expected = countAt(position, false, 'numbers', triplet);
    return expected === 'e' || expected === 'a' ? expected : '';
  }
  return '';
}
/** Incomplete syllables are transient editor state, never saved answer tokens. */
export function syllableBuffer() {
  let pending: 't' | 'l' | null = null;
  return {
    clear: () => { pending = null; },
    active: () => pending !== null,
    key: (key: string): CountSymbol | null => {
      if (key === 't' || key === 'l') { pending = key; return null; }
      if (pending === 't' && (key === 'a' || key === 'e')) { pending = null; return key === 'a' ? 'ta' : 'te'; }
      if (pending === 'l' && (key === 'a' || key === 'i')) { pending = null; return key === 'a' ? 'la' : 'li'; }
      pending = null; return countKey(key);
    },
  };
}
