import { rhythmCapabilities } from './generation.ts';
import { meters } from './meter.ts';
import type { CountMeter } from './meter.ts';

/** Engine support, not domain-model support. Triplet worker extends this query. */
export interface GenerationCapabilities {
  ingredients: readonly string[];
  patterns: readonly string[];
  meters: readonly CountMeter[];
  byMeter?: Partial<Record<CountMeter, { ingredients: readonly string[]; patterns: readonly string[]; figures?: readonly string[] }>>;
}
/** Aggregate view of the same meter policy used by generation; no duplicate support lists. */
export function generationCapabilities(): GenerationCapabilities {
  const byMeter = Object.fromEntries(meters.map(meter => [meter, rhythmCapabilities(meter)]));
  const support = Object.values(byMeter);
  return { ingredients: [...new Set(support.flatMap(c => c.ingredients))], patterns: [...new Set(support.flatMap(c => c.patterns))], meters: [...meters], byMeter };
}
