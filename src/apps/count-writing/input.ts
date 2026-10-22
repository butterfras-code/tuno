import { countAt } from '../../music/counting/vocabulary.ts';
import type { CountingSystem } from '../../music/counting/vocabulary.ts';
export { countAt } from '../../music/counting/vocabulary.ts';
export type { CountingSystem } from '../../music/counting/vocabulary.ts';
import { alphabet } from '../../music/counting/vocabulary.ts';
import type { Fraction } from '../../music/fraction.ts';
import type { CountToken as CountSymbol } from '../../music/counting/vocabulary.ts';

// Input aliases and displayed syllables belong to the counting system, not musical time.
export type OffbeatSymbol = '&' | '+';
export function countKey(key: string): CountSymbol | null {
  if (key === '+' || key === '=') return '&';
  if (key === 'l') return 'la';
  if (key === 'i') return 'li';
  return (alphabet as readonly string[]).includes(key) ? key as CountSymbol : null;
}
export function displayCount(symbol: CountSymbol, offbeat: OffbeatSymbol): string {
  return symbol === '&' ? offbeat : symbol;
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
  let pending: 't' | null = null;
  return {
    clear: () => { pending = null; },
    active: () => pending !== null,
    key: (key: string): CountSymbol | null => {
      if (key === 't') { pending = key; return null; }
      if (pending === 't' && (key === 'a' || key === 'e')) { pending = null; return key === 'a' ? 'ta' : 'te'; }
      pending = null; return countKey(key);
    },
  };
}
