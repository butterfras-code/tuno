import { bool, choice, list, record, text, canonical } from '../../shared/sharing/activity-link.ts';
import type { ActivityAdapter } from '../../shared/sharing/activity-link.ts';
import { normalizePreset, generatedPresetName, presets } from './domain/presets.ts';
import type { Preset, PresetSource } from './domain/presets.ts';
import { expansionPlan } from './engine/adaptive.ts';
import { pitchLabel, parsePitch } from './domain/notation.ts';
import { defaultTimed, validateRules } from './engine/challenge.ts';
import type { ChallengeRules } from './engine/challenge.ts';
import type { Format } from './engine/multiplayer.ts';

export interface RangeSelection { source: PresetSource; pool: string[]; expansionPools: string[][]; adaptive: boolean; showKeySignature: boolean }
export interface NotesActivity {
  mode: 'practice' | 'challenge' | 'multiplayer';
  ranges: RangeSelection[];
  pace: 'instant' | 'correct';
  intro: boolean;
  rules: ChallengeRules;
  format: Format;
}
const sourceKeys = ['id','name','clef','range','content','key','keyless','exactRange','accidentals','ledgerBelow','ledgerAbove','editorVersion','modifiers','availableClefs','endpointClefs','instrument','expansion'];
/** One resolved value for built-ins, custom selections, and incoming links. */
export function resolveSharedPreset(source: PresetSource): Preset {
  const normalized = normalizePreset(source);
  return presets.find(p => JSON.stringify(canonical(p)) === JSON.stringify(canonical(normalized))) ?? normalized;
}
export function captureRange(preset: Preset, adaptive: boolean, showKeySignature: boolean): RangeSelection {
  const source = Object.fromEntries(sourceKeys.filter(k => preset[k as keyof Preset] !== undefined).map(k => [k,structuredClone(preset[k as keyof Preset])])) as unknown as PresetSource;
  const builtin = presets.find(p => p.id === preset.id);
  const portable = builtin ? source : {...source,id:'custom-shared',name:generatedPresetName(source)};
  return validateRange({source:portable,pool:preset.pool.map(pitchLabel),expansionPools:expansionPlan(preset).map(pool => pool.map(pitchLabel)),adaptive,showKeySignature});
}
export function validateRange(input: unknown): RangeSelection {
  const raw = record(input,['source','pool','expansionPools','adaptive','showKeySignature']);
  const s = record(raw.source,sourceKeys); text(s.id,80); text(s.name,80);
  if (!/^[a-zA-Z0-9_-]+$/.test(s.id as string)) throw new Error('Invalid range identity.');
  if (list(s.range,2).length !== 2) throw new Error('A range needs two boundaries.');
  list(s.range,2).forEach(v => text(v,3));
  if (s.expansion !== undefined) { if (list(s.expansion,2).length !== 2) throw new Error('Invalid range expansion.'); list(s.expansion,2).forEach(v => parsePitch(text(v,3))); }
  if (s.instrument !== undefined) text(s.instrument,80);
  const key = record(s.key,['tonic','fifths','mode']); record(key.tonic,['letter','accidental','octave']);
  const preset = resolveSharedPreset(s as unknown as PresetSource);
  const pool = list(raw.pool,189).map(v => text(v,5));
  if (JSON.stringify(pool) !== JSON.stringify(preset.pool.map(pitchLabel))) throw new Error('This range definition is no longer supported with the same notes.');
  const expansionPools = list(raw.expansionPools,64).map(pool => list(pool,189).map(v => text(v,5)));
  if (JSON.stringify(expansionPools) !== JSON.stringify(expansionPlan(preset).map(pool => pool.map(pitchLabel)))) throw new Error('This adaptive range is no longer supported with the same expansion.');
  return {expansionPools,source:structuredClone(s) as unknown as PresetSource,pool,adaptive:bool(raw.adaptive),showKeySignature:bool(raw.showKeySignature)};
}
export const notesAdapter: ActivityAdapter<NotesActivity> = {
  app:'tunotes',version:1,path:() => '/notes/',
  validate(input) {
    const raw = record(input,['mode','ranges','pace','intro','rules','format']);
    const mode = choice(raw.mode,['practice','challenge','multiplayer']);
    const ranges = list(raw.ranges,8).map(validateRange);
    if (!ranges.length || mode !== 'multiplayer' && ranges.length !== 1) throw new Error('Invalid number of player ranges.');
    // Current multiplayer uses one adaptation and notation choice for the round.
    if (mode === 'multiplayer' && ranges.some(r => r.adaptive !== ranges[0]!.adaptive || r.showKeySignature !== ranges[0]!.showKeySignature)) throw new Error('Unsupported per-player round settings.');
    const rules = validateRules(raw.rules);
    return {mode,ranges,pace:choice(raw.pace,['instant','correct']),intro:bool(raw.intro),rules:mode === 'practice' ? defaultTimed : rules,format:choice(raw.format,['turns','pairs','head-to-head'])};
  },
  describe(value) {
    const range = value.ranges[0]!;
    return [value.mode === 'multiplayer' ? `${value.ranges.length} players · ${{turns:'Pass and Play',pairs:'Side by Side','head-to-head':'Head to Head'}[value.format]}` : value.mode === 'challenge' ? 'Challenge' : 'Practice',range.source.name,range.adaptive ? 'Adaptive' : 'Fixed range',value.mode === 'practice' ? value.pace === 'correct' ? 'Correct Only' : 'Normal' : value.rules.goal === 'timed' ? `${value.rules.seconds} seconds` : `${value.rules.target} correct`].join(' · ');
  },
};
