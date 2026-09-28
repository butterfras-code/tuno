import { supportedAnswer } from './answer-layout.ts';
import { diatonic, parsePitch, pitchAt, staffPosition, keySignature, keyAccidental, keyName, pitchLabel, chromatic, ledgerPositions, spelling } from './notation.ts';
import type { Accidental, Clef, KeySignature, WrittenPitch } from './notation.ts';
export type Content = 'lines' | 'spaces' | 'lines-and-spaces';
export type Policy = 'key-only' | 'sharps' | 'flats' | 'both';
export type Modifier = 'key' | 'flat' | 'natural' | 'sharp';
export interface PresetSource {
  readonly editorVersion?: 2; readonly modifiers?: readonly Modifier[]; readonly availableClefs?: readonly Clef[]; readonly endpointClefs?: readonly [Clef, Clef];
  readonly id: string; readonly name: string; readonly clef: Clef; readonly range: readonly [string, string]; readonly content: Content;
  readonly key?: KeySignature; readonly accidentals?: Policy; readonly ledgerBelow?: number; readonly ledgerAbove?: number;
  readonly instrument?: string; readonly expansion?: readonly [string, string];
}
export interface Preset extends PresetSource { readonly version: 1; readonly key: KeySignature; readonly pool: readonly WrittenPitch[] }
export function normalizePreset(source: PresetSource, options: { legacySpellings?: boolean } = {}): Preset {
  if (!source.id || !source.name || !['treble', 'bass', 'alto', 'tenor'].includes(source.clef)) throw new Error('Preset needs an ID, name and supported clef.');
  if (!['lines', 'spaces', 'lines-and-spaces'].includes(source.content)) throw new Error('Choose lines, spaces or both.');
  const low = parsePitch(source.range[0]), high = parsePitch(source.range[1]);
  if (diatonic(low) > diatonic(high) || source.editorVersion === 2 && chromatic(low) > chromatic(high)) throw new Error('Lowest note must not be above highest note.');
  if (source.editorVersion === undefined && (low.accidental || high.accidental)) throw new Error('Use ascending natural range boundaries.');
  if (source.editorVersion !== undefined && source.editorVersion !== 2) throw new Error('Unsupported custom editor version.');
  if (source.editorVersion === 2) {
    if (!source.modifiers?.length || new Set(source.modifiers).size !== source.modifiers.length || source.modifiers.some(m => !['key','flat','natural','sharp'].includes(m))) throw new Error('Select at least one modifier.');
    if (!source.availableClefs?.length || new Set(source.availableClefs).size !== source.availableClefs.length || source.availableClefs.some(c => !clefs.includes(c))) throw new Error('Select at least one available clef.');
    if (!source.endpointClefs || source.endpointClefs.length !== 2 || source.endpointClefs.some(c => !clefs.includes(c))) throw new Error('Choose two endpoint clefs.');
    if (source.ledgerBelow !== undefined || source.ledgerAbove !== undefined) throw new Error('Graphical ranges do not use ledger limits.');
  } else if (source.modifiers || source.availableClefs || source.endpointClefs) throw new Error('Graphical settings require editor version 2.');
  const selectedKey = source.key ?? keySignature('C');
  const key = source.editorVersion === 2 && !source.modifiers!.includes('key') ? keySignature('C') : selectedKey, policy = source.accidentals ?? 'key-only';
  if (!Number.isInteger(selectedKey.fifths) || Math.abs(selectedKey.fifths) > 7 || selectedKey.mode !== 'major' || keySignature(keyName(selectedKey)).tonic.letter !== selectedKey.tonic.letter || keySignature(keyName(selectedKey)).tonic.accidental !== selectedKey.tonic.accidental) throw new Error('Invalid major key.');
  if (!options.legacySpellings && key.fifths === -7) throw new Error('C♭ major is unavailable in this answer layout. Choose another key.');
  if (!['key-only','sharps','flats','both'].includes(policy)) throw new Error('Invalid accidental policy.');
  for (const limit of [source.ledgerBelow, source.ledgerAbove]) if (limit !== undefined && (!Number.isInteger(limit) || limit < 0 || limit > 4)) throw new Error('Ledger limits must be 0–4.');
  const pool: WrittenPitch[] = [];
  for (let p = staffPosition(low, source.clef); p <= staffPosition(high, source.clef); p++) {
    if (source.ledgerBelow !== undefined && p < -2 * source.ledgerBelow - 1 || source.ledgerAbove !== undefined && p > 9 + 2 * source.ledgerAbove) continue;
    const natural = pitchAt(p, source.clef);
    const position = staffPosition(natural, clefForPitch(source, natural));
    if (source.content !== 'lines-and-spaces' && Math.abs(position % 2) !== (source.content === 'lines' ? 0 : 1)) continue;
    const alterations = new Set<Accidental>([keyAccidental(natural.letter, key)]);
    if (policy !== 'key-only') alterations.add(0);
    if (policy === 'sharps' || policy === 'both') alterations.add(1);
    if (policy === 'flats' || policy === 'both') alterations.add(-1);
    if (source.editorVersion === 2) {
      alterations.clear();
      if (source.modifiers!.includes('key')) alterations.add(keyAccidental(natural.letter, key));
      if (source.modifiers!.includes('flat')) alterations.add(-1);
      if (source.modifiers!.includes('natural')) alterations.add(0);
      if (source.modifiers!.includes('sharp')) alterations.add(1);
    }
    for (const accidental of alterations) {
      const pitch = { ...natural, accidental };
      if (source.editorVersion === 2 && (chromatic(pitch) < chromatic(low) || chromatic(pitch) > chromatic(high))) continue;
      if (options.legacySpellings || supportedAnswer(pitch)) pool.push(Object.freeze(pitch));
    }
  }
  if (!pool.length) throw new Error('These settings produce an empty pool. Widen the range or change content or modifiers.');
  const graphical = source.editorVersion === 2 ? { modifiers: Object.freeze([...source.modifiers!]), availableClefs: Object.freeze([...source.availableClefs!]), endpointClefs: Object.freeze([...source.endpointClefs!]) as readonly [Clef,Clef] } : {};
  return Object.freeze({ ...source, ...graphical, accidentals: policy, range: Object.freeze([...source.range]) as readonly [string, string], version: 1, key, pool: Object.freeze(pool) });
}
export const clefs = ['treble','bass','alto','tenor'] as const;
/** Stable assignment keeps each note in the most readable enabled clef. */
export function clefForPitch(source: PresetSource, pitch: WrittenPitch): Clef {
  const enabled = source.availableClefs ?? [source.clef];
  return clefs.filter(c => enabled.includes(c)).sort((a,b) => {
    const pa = staffPosition(pitch,a), pb = staffPosition(pitch,b);
    return ledgerPositions(pa).length - ledgerPositions(pb).length || Math.abs(pa-4) - Math.abs(pb-4);
  })[0] ?? source.clef;
}
export function modifiersFor(source: PresetSource): readonly Modifier[] {
  if (source.modifiers) return source.modifiers;
  return ['key', ...(source.accidentals && source.accidentals !== 'key-only' ? ['natural' as const] : []), ...(source.accidentals === 'flats' || source.accidentals === 'both' ? ['flat' as const] : []), ...(source.accidentals === 'sharps' || source.accidentals === 'both' ? ['sharp' as const] : [])];
}
/** Stable default label; modifier order follows the configurator, not click order. */
export function generatedPresetName(source: PresetSource): string {
  const range = source.range.map(p => pitchLabel(parsePitch(p))).join('–');
  const content = source.content === 'lines' ? 'Line' : source.content === 'spaces' ? 'Space' : 'Both';
  const modifiers = modifiersFor(source);
  const key = modifiers.includes('key') ? ` in ${spelling((source.key ?? keySignature('C')).tonic)} major` : '';
  const accidentals = ([['flat','♭'],['natural','♮'],['sharp','♯']] as const).filter(([id]) => modifiers.includes(id)).map(([,symbol]) => symbol).join(' ');
  return `${range} ${content}${key}${accidentals ? ` + ${accidentals}` : ''}`;
}
const staffPresets = clefs.flatMap(clef => (['lines','spaces','lines-and-spaces'] as const).map(content => normalizePreset({
  id: `${clef}-${content}`, name: `${clef[0]!.toUpperCase() + clef.slice(1)} — ${content === 'lines-and-spaces' ? 'Lines + Spaces' : content === 'lines' ? 'Lines' : 'Spaces'}`,
  clef, range: [pitchLabel(pitchAt(0, clef)), pitchLabel(pitchAt(8, clef))], content,
})));
const ledgerPresets = clefs.flatMap(clef => ([1,2,4] as const).flatMap(count => (['above','below','both'] as const).filter(side => count !== 4 || side !== 'both').map(side => normalizePreset({
  id: `${clef}-ledger-${count}-${side}`, name: `${clef} — ${count} ledger ${count === 1 ? 'line' : 'lines'} ${side}`,
  clef, range: [pitchLabel(pitchAt(side === 'above' ? 0 : -count * 2, clef)), pitchLabel(pitchAt(side === 'below' ? 8 : 8 + count * 2, clef))], content: 'lines-and-spaces',
}))));
type InstrumentLevel = { readonly id: string; readonly name: string; readonly range: readonly [string, string]; readonly key: string };
type InstrumentDefinition = {
  readonly id: string; readonly name: string; readonly clef: Clef; readonly transpose: number;
  readonly ranges: { readonly start: { readonly range: readonly [string, string]; readonly key: string }; readonly full: readonly [string, string]; readonly levels?: readonly InstrumentLevel[] };
};
// Ranges use written, natural note boundaries. Each level owns its key; full is the
// adaptive limit, not an extra picker choice. Level IDs are unique per instrument.
export const instruments = [
  { id: 'flute', name: 'Flute', clef: 'treble', transpose: 0, ranges: {
    start: { range: ['F4','C5'], key: 'F' }, full: ['B3','B5'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['F4','F5'], key: 'F' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['B3','F5'], key: 'F' },
      { id: 'two-octaves', name: '2 octaves', range: ['B3','B5'], key: 'F' },
    ],
  } },
  { id: 'oboe', name: 'Oboe', clef: 'treble', transpose: 0, ranges: {
    start: { range: ['F4','C5'], key: 'F' }, full: ['B3','B5'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['F4','F5'], key: 'F' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['B3','F5'], key: 'F' },
      { id: 'two-octaves', name: '2 octaves', range: ['B3','B5'], key: 'F' },
    ],
  } },
  { id: 'bassoon', name: 'Bassoon', clef: 'bass', transpose: 0, ranges: {
    start: { range: ['F2','C3'], key: 'F' }, full: ['B1','B3'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['F2','F3'], key: 'F' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['B1','F3'], key: 'F' },
      { id: 'two-octaves', name: '2 octaves', range: ['B1','B3'], key: 'F' },
    ],
  } },
  { id: 'keyboards', name: 'Keyboards', clef: 'treble', transpose: 0, ranges: {
    start: { range: ['C4','G4'], key: 'C' }, full: ['F3','F5'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['C4','C5'], key: 'C' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['F3','C5'], key: 'C' },
      { id: 'two-octaves', name: '2 octaves', range: ['F3','F5'], key: 'C' },
    ],
  } },
  { id: 'clarinet-bb', name: 'B♭ Clarinet', clef: 'treble', transpose: 2, ranges: {
    start: { range: ['C4','G4'], key: 'C' }, full: ['F3','F5'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['C4','C5'], key: 'C' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['F3','C5'], key: 'C' },
      { id: 'two-octaves', name: '2 octaves', range: ['F3','F5'], key: 'C' },
    ],
  } },
  { id: 'alto-sax', name: 'Alto saxophone', clef: 'treble', transpose: 9, ranges: {
    start: { range: ['G4','D5'], key: 'G' }, full: ['C4','C6'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['G4','G5'], key: 'G' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['C4','G5'], key: 'G' },
      { id: 'two-octaves', name: '2 octaves', range: ['C4','C6'], key: 'G' },
    ],
  } },
  { id: 'trumpet-bb', name: 'B♭ Trumpet', clef: 'treble', transpose: 2, ranges: {
    start: { range: ['C4','G4'], key: 'C' }, full: ['F3','F5'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['C4','C5'], key: 'C' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['F3','C5'], key: 'C' },
      { id: 'two-octaves', name: '2 octaves', range: ['F3','F5'], key: 'C' },
    ],
  } },
  { id: 'horn-f', name: 'F Horn', clef: 'treble', transpose: 7, ranges: {
    start: { range: ['C4','G4'], key: 'C' }, full: ['F3','F5'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['C4','C5'], key: 'C' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['F3','C5'], key: 'C' },
      { id: 'two-octaves', name: '2 octaves', range: ['F3','F5'], key: 'C' },
    ],
  } },
  { id: 'trombone', name: 'Trombone', clef: 'bass', transpose: 0, ranges: {
    start: { range: ['B2','F3'], key: 'Bb' }, full: ['E2','E4'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['B2','B3'], key: 'Bb' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['E2','B3'], key: 'Bb' },
      { id: 'two-octaves', name: '2 octaves', range: ['E2','E4'], key: 'Bb' },
    ],
  } },
  { id: 'euphonium', name: 'Euphonium (bass clef)', clef: 'bass', transpose: 0, ranges: {
    start: { range: ['B2','F3'], key: 'Bb' }, full: ['E2','E4'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['B2','B3'], key: 'Bb' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['E2','B3'], key: 'Bb' },
      { id: 'two-octaves', name: '2 octaves', range: ['E2','E4'], key: 'Bb' },
    ],
  } },
  { id: 'tuba', name: 'Tuba (bass clef)', clef: 'bass', transpose: 0, ranges: {
    start: { range: ['B1','F2'], key: 'Bb' }, full: ['E1','E3'], levels: [
      { id: 'one-octave', name: '1 octave', range: ['B1','B2'], key: 'Bb' },
      { id: 'one-and-half-octaves', name: '1.5 octaves', range: ['E1','B2'], key: 'Bb' },
      { id: 'two-octaves', name: '2 octaves', range: ['E1','E3'], key: 'Bb' },
    ],
  } },
] as const satisfies readonly InstrumentDefinition[];
export const writtenToConcert = (pitch: WrittenPitch, concertToWritten: number) => chromatic(pitch) - concertToWritten;
function instrumentPreset(i: InstrumentDefinition, level: InstrumentLevel): Preset {
  const fullLow = parsePitch(i.ranges.full[0]), fullHigh = parsePitch(i.ranges.full[1]);
  const low = parsePitch(level.range[0]), high = parsePitch(level.range[1]);
  if (diatonic(low) < diatonic(fullLow) || diatonic(high) > diatonic(fullHigh)) throw new Error(`${i.id}-${level.id} exceeds its full range.`);
  return normalizePreset({ id: `${i.id}-${level.id}`, name: `${i.name} — ${level.name}`, clef: i.clef, range: level.range, expansion: i.ranges.full, instrument: i.id, key: keySignature(level.key), content: 'lines-and-spaces' });
}
const instrumentIds = new Set<string>();
for (const i of instruments) {
  if (!/^[a-z0-9-]+$/.test(i.id) || instrumentIds.has(i.id)) throw new Error(`Duplicate or invalid instrument ID: ${i.id}`);
  instrumentIds.add(i.id);
  const fullLow = parsePitch(i.ranges.full[0]), fullHigh = parsePitch(i.ranges.full[1]);
  if (fullLow.accidental || fullHigh.accidental || diatonic(fullLow) > diatonic(fullHigh)) throw new Error(`Invalid full range: ${i.id}`);
  const levelIds = new Set(['starter']);
  for (const level of i.ranges.levels ?? []) {
    if (!/^[a-z0-9-]+$/.test(level.id) || levelIds.has(level.id)) throw new Error(`Duplicate or invalid range ID: ${i.id}-${level.id}`);
    levelIds.add(level.id);
  }
}
export const instrumentPresets = instruments.map(i => instrumentPreset(i,{ id: 'starter', name: 'Starter', ...i.ranges.start }));
export const instrumentRangePresets = instruments.flatMap(i => (i.ranges.levels ?? []).map(level => instrumentPreset(i,level)));
export const presets: readonly Preset[] = Object.freeze([...staffPresets, ...ledgerPresets, ...instrumentPresets, ...instrumentRangePresets]);
if (new Set(presets.map(p => p.id)).size !== presets.length) throw new Error('Duplicate catalog preset IDs.');
export const defaultPreset = presets[2]!;
export function fingerprint(p: Preset, adaptive = false, activity: 'practice' | 'challenge' = 'practice') {
  const parts: unknown[] = [p.id, p.version, p.clef, keyName(p.key), p.accidentals, p.pool.map(pitchLabel), activity, adaptive, 'letters'];
  if (p.editorVersion === 2) parts.push({ version: 2, clefs: clefs.filter(c => p.availableClefs!.includes(c)), modifiers: ['key','flat','natural','sharp'].filter(m => p.modifiers!.includes(m as Modifier)) });
  return JSON.stringify(parts);
}
