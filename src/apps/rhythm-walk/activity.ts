import { defaultGeneration, generateExercise, generationIssue, ingredients } from './shared/generation.ts';
import type { GenerationSettings } from './shared/generation.ts';
import type { PassageFixture } from './shared/fixtures.ts';
import { practiceFixtures } from './shared/fixtures.ts';
import { exercises } from './fixtures.ts';
import type { Exercise } from './fixtures.ts';
import { defaultPresentation, linePlacementOptions, sustainAppearanceOptions } from '../count-writing/presentation.ts';
import type { CountPresentation } from '../count-writing/presentation.ts';
import type { DottedQuarterConvention } from '../count-writing/evaluation.ts';
import type { OffbeatSymbol, CountingSystem } from '../count-writing/input.ts';
import { meters } from './shared/meter.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { derivePassage } from '../../music/measure.ts';
import { playStyles } from './play-policy.ts';
import type { PlayStyle } from './play-policy.ts';
import { generationLevels, matchesTeachingPreset, resolveTeachingPreset } from './shared/teaching-presets.ts';

export const modes = ['write', 'tap', 'both'] as const;
export type Mode = typeof modes[number];
export const modeOptions = [{ value: 'write', label: 'Write Counts' }, { value: 'tap', label: 'Tap Rhythms' }, { value: 'both', label: 'Both' }];
/** One catalogue for every mode, including all historical review exercises. */
export const presets: readonly PassageFixture[] = [
  ...practiceFixtures,
  ...exercises.map(e => ({ ...e, measures: structuredClone(e.measures) as RhythmMeasure[] })),
];
export function fixtureAccess(search: string) {
  const params = new URLSearchParams(search);
  const fixture = presets.find(f => f.id === params.get('fixture'));
  return { enabled: params.get('testing') === '1' || Boolean(fixture), fixture };
}
export interface Preferences {
  version: 1; mode: Mode; generation: GenerationSettings; preset: string;
  countingSystem: CountingSystem; offbeat: OffbeatSymbol; presentation: CountPresentation; convention: DottedQuarterConvention;
  bpm: number; metronome: boolean; showCounts: boolean; wrapped: boolean; playStyle: PlayStyle;
}
export const preferenceKey = 'tuno.rhythm-walk.preferences.v1';
export const defaultPreferences = (): Preferences => ({ version: 1, mode: 'write', generation: defaultGeneration(), preset: 'generated', countingSystem: 'numbers', offbeat: '&', presentation: { ...defaultPresentation }, convention: 'review', bpm: 80, metronome: true, showCounts: false, wrapped: false, playStyle: 'tap' });
/** Restore known, structurally valid fields; keep invalid ingredient combinations editable. */
export function readPreferences(raw: string | null): Preferences {
  const defaults = defaultPreferences();
  try {
    const p = JSON.parse(raw ?? 'null') as Partial<Preferences> | null;
    if (!p || p.version !== 1) return defaults;
    if (modes.includes(p.mode!)) defaults.mode = p.mode!;
    if (playStyles.includes(p.playStyle!)) defaults.playStyle = p.playStyle!;
    // Fixed fixture access requires an explicit URL opt-in, never saved preferences.
    if (p.countingSystem === 'numbers' || p.countingSystem === 'syllables') defaults.countingSystem = p.countingSystem;
    if (p.offbeat === '&' || p.offbeat === '+') defaults.offbeat = p.offbeat;
    if (['review', 'required', 'optional'].includes(p.convention!)) defaults.convention = p.convention!;
    if (linePlacementOptions.some(o => o.value === p.presentation?.linePlacement) && sustainAppearanceOptions.some(o => o.value === p.presentation?.sustainAppearance)) defaults.presentation = { ...p.presentation! };
    if (Number.isFinite(p.bpm) && p.bpm! >= 40 && p.bpm! <= 180) defaults.bpm = p.bpm!;
    for (const key of ['metronome', 'showCounts', 'wrapped'] as const) if (typeof p[key] === 'boolean') defaults[key] = p[key]!;
    const g = p.generation;
    const selected = g?.meters ?? (g?.meter ? [g.meter] : undefined);
    if (g && Array.isArray(selected) && selected.every(meter => meters.includes(meter)) && Number.isInteger(g.measures) && g.measures >= 1 && g.measures <= 4 && Array.isArray(g.ingredients) && g.ingredients.every(id => ingredients.some(i => i.id === id)) && typeof g.allowUnintuitiveNotation === 'boolean' && (g.ties === undefined || typeof g.ties === 'boolean') && (g.syncopation === undefined || typeof g.syncopation === 'boolean')) {
      defaults.generation = { meters: [...new Set(selected)], measures: g.measures, ingredients: [...g.ingredients], allowUnintuitiveNotation: g.allowUnintuitiveNotation, ties: g.ties, syncopation: g.syncopation };
      if (g.restrictions && typeof g.restrictions.pairedEighths === 'boolean' && typeof g.restrictions.noQuarterRestBeatOne === 'boolean') defaults.generation.restrictions = { pairedEighths: g.restrictions.pairedEighths, noQuarterRestBeatOne: g.restrictions.noQuarterRestBeatOne };
      const identity = g.teachingPreset;
      const definition = generationLevels.find(p => p.id === identity?.id);
      if (definition && typeof identity?.customized === 'boolean' && (identity.version === definition.version || definition.source && identity.version === 1)) {
        const scope = identity.scope === 'percussion' ? 'percussion' : 'general';
        if (identity.version === definition.version && g.figureProfile?.version === 1 && g.figureProfile.level === Number(definition.id.slice(4)) && g.figureProfile.scope === scope) {
          defaults.generation.figureProfile = { version: 1, level: g.figureProfile.level, scope };
          defaults.generation.meterChanges = Number.isInteger(g.meterChanges) && g.meterChanges! >= 0 && g.meterChanges! <= definition.meterChanges ? g.meterChanges : 0;
        }
        defaults.generation.teachingPreset = { id: definition.id, version: definition.version, customized: identity.customized || identity.version !== definition.version || Boolean(definition.source && !['general', 'percussion'].includes(identity.scope!)) || (g.meterChanges !== undefined && (!Number.isInteger(g.meterChanges) || g.meterChanges < 0 || g.meterChanges > definition.meterChanges)), ...(definition.source ? { scope } : {}) };
        defaults.generation.teachingPreset.customized ||= !resolveTeachingPreset(definition, undefined, scope).supported || !matchesTeachingPreset(defaults.generation, definition);
        if (defaults.generation.teachingPreset.customized) { delete defaults.generation.figureProfile; delete defaults.generation.meterChanges; }
      }

    }
  } catch { /* Missing, malformed or unavailable storage uses defaults. */ }
  return defaults;
}
/** Exercise identity changes only on replacement, never on response-mode changes. */
export class Activity {
  exercise: Exercise;
  /** Configuration captured at replacement, distinct from pending preferences. */
  exerciseGeneration!: GenerationSettings;
  private serial = 0;
  preferences: Preferences;
  constructor(preferences: Preferences, measures: readonly RhythmMeasure[]) { this.preferences = preferences; this.exercise = this.create(measures); }
  private create(measures: readonly RhythmMeasure[]): Exercise {
    derivePassage(measures);
    this.exerciseGeneration = structuredClone(generationIssue(this.preferences.generation) ? defaultGeneration() : this.preferences.generation);
    return { id: `exercise-${++this.serial}`, label: presets.find(p => p.id === this.preferences.preset)?.label ?? 'Generated practice', description: 'Read the score. Choose how to respond.', measures: structuredClone(measures) };
  }
  setMode(mode: Mode) { this.preferences.mode = mode; }
  replace(measures: readonly RhythmMeasure[]) { this.exercise = this.create(measures); return this.exercise; }
  next(random = Math.random) {
    const measures = generateExercise(this.preferences.generation, random);
    this.preferences.preset = 'generated';
    return this.replace(measures);
  }
}
