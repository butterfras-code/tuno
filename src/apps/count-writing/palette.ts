import type { CountToken as CountSymbol } from '../../music/counting/vocabulary.ts';
import type { CountingSystem } from './input.ts';

/** Palette vocabulary follows the active exercise, independently of grading. */
export function paletteSymbols(beats: number, compound: boolean, system: CountingSystem, vocabulary: { sixteenths: boolean; triplets: boolean }): readonly CountSymbol[] {
  const numbers = Array.from({ length: beats }, (_, index) => String(index + 1) as CountSymbol);
  if (compound) return numbers;
  return [...numbers,
    ...(system === 'syllables' ? vocabulary.sixteenths ? ['ta', 'te'] as const : ['te'] as const : vocabulary.sixteenths ? ['e', '&', 'a'] as const : ['&'] as const),
    ...(vocabulary.triplets ? ['la', 'li'] as const : []),
  ];
}
