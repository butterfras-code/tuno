import { C_MAJOR, diatonic, parsePitch, pitchAt, staffPosition } from './notation.ts';
import type { Clef, KeySignature, WrittenPitch } from './notation.ts';
export type Content = 'lines' | 'spaces' | 'lines-and-spaces';
export interface PresetSource { readonly id: string; readonly name: string; readonly clef: Clef; readonly range: readonly [string, string]; readonly content: Content }
export interface Preset extends PresetSource { readonly version: 1; readonly key: KeySignature; readonly pool: readonly WrittenPitch[] }
export function normalizePreset(source: PresetSource): Preset {
  if (!source.id || !source.name || !['treble', 'bass', 'alto', 'tenor'].includes(source.clef)) throw new Error('Preset needs an ID, name and supported clef.');
  if (!['lines', 'spaces', 'lines-and-spaces'].includes(source.content)) throw new Error(`${source.id}: unsupported content filter.`);
  const low = parsePitch(source.range[0]), high = parsePitch(source.range[1]);
  if (low.accidental || high.accidental || diatonic(low) > diatonic(high)) throw new Error(`${source.id}: use ascending natural range boundaries.`);
  const pool: WrittenPitch[] = [];
  for (let p = staffPosition(low, source.clef); p <= staffPosition(high, source.clef); p++) {
    if (source.content === 'lines-and-spaces' || Math.abs(p % 2) === (source.content === 'lines' ? 0 : 1)) pool.push(pitchAt(p, source.clef));
  }
  if (!pool.length) throw new Error(`${source.id}: range and content produce an empty pool.`);
  return Object.freeze({ ...source, range: Object.freeze([...source.range]) as readonly [string, string], version: 1, key: C_MAJOR, pool: Object.freeze(pool) });
}
export const presets: readonly Preset[] = Object.freeze((['treble', 'bass'] as const).flatMap(clef =>
  (['lines', 'spaces', 'lines-and-spaces'] as const).map(content => normalizePreset({
    id: `${clef}-${content}`, name: `${clef === 'treble' ? 'Treble' : 'Bass'} — ${content === 'lines-and-spaces' ? 'Lines + Spaces' : content === 'lines' ? 'Lines' : 'Spaces'}`,
    clef, range: clef === 'treble' ? ['E4', 'F5'] : ['G2', 'A3'], content,
  }))));
export const defaultPreset = presets[2]!;
