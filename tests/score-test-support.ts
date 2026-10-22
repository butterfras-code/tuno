/** Test notation templates are finalized before tests call complete-score consumers. */
export * from '../src/music/measure.ts';
export { musicalSeconds, inputAudioTime } from '../src/apps/rhythm-walk/timing.ts';
import { score, derivePassage as derive } from '../src/music/measure.ts';
import { planPassage as plan } from '../src/apps/rhythm-walk/timing.ts';
export const derivePassage = (measures: Parameters<typeof derive>[0]) => derive(score(measures).measures);
export const planPassage = (measures: Parameters<typeof plan>[0], ...args: Parameters<typeof plan> extends [unknown, ...infer R] ? R : never) => plan(score(measures).measures, ...args);
/** Historical notation assertions predate IDs; keep their musical expectations exact. */
export function notationOnly(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(notationOnly);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.entries(record).map(([k,v]) => [k, k === 'id' && 'type' in record && 'kind' in record ? 'draft' : notationOnly(v)]));
  }
  return value;
}
