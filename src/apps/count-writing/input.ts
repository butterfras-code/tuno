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
export function countAt(position: Fraction, compound: boolean, system: CountingSystem = 'numbers'): CountSymbol {
  const units = divide(position, fraction(1, compound ? 8 : 16));
  if (units[1] !== 1) throw new Error('Position is outside the reviewed count lattice.');
  if (compound) return String(units[0] + 1) as CountSymbol;
  const phase = units[0] % 4;
  return phase === 0 ? String(Math.floor(units[0] / 4) + 1) as CountSymbol :
    (system === 'syllables' ? ['','ta','te','ta'] : ['','e','&','a'])[phase] as CountSymbol;
}
/** Translate meaning, never substitute the expected answer for an incorrect token. */
export function translateCount(token: CountSymbol, position: Fraction, from: CountingSystem, to: CountingSystem): CountSymbol {
  if (from === to || !token || /^\d$/.test(token)) return token;
  if (to === 'syllables' && (token === 'e' || token === 'a') && countAt(position, false, 'numbers') !== token && countAt(position, false, 'syllables') === 'ta') return '';
  if (to === 'syllables') return ({ e: 'ta', '&': 'te', a: 'ta' } as Partial<Record<CountSymbol, CountSymbol>>)[token] ?? '';
  if (token === 'te') return '&';
  if (token === 'ta') {
    const expected = countAt(position, false, 'numbers');
    return expected === 'e' || expected === 'a' ? expected : '';
  }
  return '';
}
/** Incomplete syllables are transient editor state, never saved answer tokens. */
export function syllableBuffer() {
  let pending = false;
  return {
    clear: () => { pending = false; },
    active: () => pending,
    key: (key: string): CountSymbol | null => {
      if (key === 't') { pending = true; return null; }
      if (pending && (key === 'a' || key === 'e')) { pending = false; return key === 'a' ? 'ta' : 'te'; }
      pending = false; return countKey(key);
    },
  };
}
