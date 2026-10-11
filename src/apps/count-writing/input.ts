import { alphabet } from './evaluation.ts';
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
