import { supportedAnswer } from './answer-layout.ts';
import { diatonic, parsePitch, pitchAt, staffPosition, keySignature, keyAccidental, keyName, pitchLabel, chromatic } from './notation.ts';
import type { Accidental, Clef, KeySignature, WrittenPitch } from './notation.ts';
export type Content = 'lines' | 'spaces' | 'lines-and-spaces';
export type Policy = 'key-only' | 'sharps' | 'flats' | 'both';
export interface PresetSource {
  readonly id: string; readonly name: string; readonly clef: Clef; readonly range: readonly [string, string]; readonly content: Content;
  readonly key?: KeySignature; readonly accidentals?: Policy; readonly ledgerBelow?: number; readonly ledgerAbove?: number;
  readonly instrument?: string; readonly expansion?: readonly [string, string];
}
export interface Preset extends PresetSource { readonly version: 1; readonly key: KeySignature; readonly pool: readonly WrittenPitch[] }
export function normalizePreset(source: PresetSource, options: { legacySpellings?: boolean } = {}): Preset {
  if (!source.id || !source.name || !['treble', 'bass', 'alto', 'tenor'].includes(source.clef)) throw new Error('Preset needs an ID, name and supported clef.');
  if (!['lines', 'spaces', 'lines-and-spaces'].includes(source.content)) throw new Error('Choose lines, spaces or both.');
  const low = parsePitch(source.range[0]), high = parsePitch(source.range[1]);
  if (low.accidental || high.accidental || diatonic(low) > diatonic(high)) throw new Error('Use ascending natural range boundaries.');
  const key = source.key ?? keySignature('C'), policy = source.accidentals ?? 'key-only';
  if (!Number.isInteger(key.fifths) || Math.abs(key.fifths) > 7 || key.mode !== 'major' || keySignature(keyName(key)).tonic.letter !== key.tonic.letter || keySignature(keyName(key)).tonic.accidental !== key.tonic.accidental) throw new Error('Invalid major key.');
  if (!options.legacySpellings && key.fifths === -7) throw new Error('C♭ major is unavailable in this answer layout. Choose another key.');
  if (!['key-only','sharps','flats','both'].includes(policy)) throw new Error('Invalid accidental policy.');
  for (const limit of [source.ledgerBelow, source.ledgerAbove]) if (limit !== undefined && (!Number.isInteger(limit) || limit < 0 || limit > 4)) throw new Error('Ledger limits must be 0–4.');
  const pool: WrittenPitch[] = [];
  for (let p = staffPosition(low, source.clef); p <= staffPosition(high, source.clef); p++) {
    if (source.ledgerBelow !== undefined && p < -2 * source.ledgerBelow - 1 || source.ledgerAbove !== undefined && p > 9 + 2 * source.ledgerAbove) continue;
    if (source.content !== 'lines-and-spaces' && Math.abs(p % 2) !== (source.content === 'lines' ? 0 : 1)) continue;
    const natural = pitchAt(p, source.clef);
    const alterations = new Set<Accidental>([keyAccidental(natural.letter, key)]);
    if (policy !== 'key-only') alterations.add(0);
    if (policy === 'sharps' || policy === 'both') alterations.add(1);
    if (policy === 'flats' || policy === 'both') alterations.add(-1);
    for (const accidental of alterations) if (options.legacySpellings || supportedAnswer({ ...natural, accidental })) pool.push(Object.freeze({ ...natural, accidental }));
  }
  if (!pool.length) throw new Error('Range, ledger limits and content produce an empty pool.');
  return Object.freeze({ ...source, accidentals: policy, range: Object.freeze([...source.range]) as readonly [string, string], version: 1, key, pool: Object.freeze(pool) });
}
export const clefs = ['treble','bass','alto','tenor'] as const;
const staffPresets = clefs.flatMap(clef => (['lines','spaces','lines-and-spaces'] as const).map(content => normalizePreset({
  id: `${clef}-${content}`, name: `${clef[0]!.toUpperCase() + clef.slice(1)} — ${content === 'lines-and-spaces' ? 'Lines + Spaces' : content === 'lines' ? 'Lines' : 'Spaces'}`,
  clef, range: [pitchLabel(pitchAt(0, clef)), pitchLabel(pitchAt(8, clef))], content,
})));
const ledgerPresets = clefs.flatMap(clef => ([1,2,4] as const).flatMap(count => (['above','below','both'] as const).filter(side => count !== 4 || side !== 'both').map(side => normalizePreset({
  id: `${clef}-ledger-${count}-${side}`, name: `${clef} — ${count} ledger ${count === 1 ? 'line' : 'lines'} ${side}`,
  clef, range: [pitchLabel(pitchAt(side === 'above' ? 0 : -count * 2, clef)), pitchLabel(pitchAt(side === 'below' ? 8 : 8 + count * 2, clef))], content: 'lines-and-spaces',
}))));
export const instruments = [
  { id: 'flute', name: 'Flute', clef: 'treble', range: ['F4','C5'], expansion: ['C4','C7'], transpose: 0, key: 'F' },
  { id: 'oboe', name: 'Oboe', clef: 'treble', range: ['F4','C5'], expansion: ['F4','C5'], transpose: 0, key: 'F' },
  { id: 'bassoon', name: 'Bassoon', clef: 'bass', range: ['F2','C3'], expansion: ['F2','C3'], transpose: 0, key: 'F' },
  { id: 'keyboards', name: 'Keyboards', clef: 'treble', range: ['C4','G4'], expansion: ['C4','G4'], transpose: 0, key: 'C' },
  { id: 'clarinet-bb', name: 'B♭ Clarinet', clef: 'treble', range: ['C4','G4'], expansion: ['C4','C6'], transpose: 2, key: 'C' },
  { id: 'alto-sax', name: 'Alto saxophone', clef: 'treble', range: ['G4','D5'], expansion: ['D4','F6'], transpose: 9, key: 'G' },
  { id: 'trumpet-bb', name: 'B♭ Trumpet', clef: 'treble', range: ['C4','G4'], expansion: ['F3','C6'], transpose: 2, key: 'C' },
  { id: 'horn-f', name: 'F Horn', clef: 'treble', range: ['C4','G4'], expansion: ['F3','C6'], transpose: 7, key: 'C' },
  { id: 'trombone', name: 'Trombone', clef: 'bass', range: ['B2','F3'], expansion: ['E2','B3'], transpose: 0, key: 'Bb' },
  { id: 'euphonium', name: 'Euphonium (bass clef)', clef: 'bass', range: ['B2','F3'], expansion: ['E2','B3'], transpose: 0, key: 'Bb' },
  { id: 'tuba', name: 'Tuba (bass clef)', clef: 'bass', range: ['B1','F2'], expansion: ['E1','B2'], transpose: 0, key: 'Bb' },
] as const;
export const writtenToConcert = (pitch: WrittenPitch, concertToWritten: number) => chromatic(pitch) - concertToWritten;
export const instrumentPresets = instruments.map(i => normalizePreset({ id: `${i.id}-starter`, name: `${i.name} — Starter`, clef: i.clef, range: i.range, expansion: i.expansion, instrument: i.id, key: keySignature(i.key), content: 'lines-and-spaces' }));
export const presets: readonly Preset[] = Object.freeze([...staffPresets, ...ledgerPresets, ...instrumentPresets]);
export const defaultPreset = presets[2]!;
export function fingerprint(p: Preset) { return JSON.stringify([p.id, p.version, p.clef, keyName(p.key), p.accidentals, p.pool.map(pitchLabel), 'practice', false, 'letters']); }
