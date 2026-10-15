import { buildCountingPlan } from '../../music/counting/plan.ts';
import type { CountingPlan } from '../../music/counting/plan.ts';
import { initializeAnswer } from '../../music/counting/answer.ts';
import type { CountingAnswer, CountingEvaluation } from '../../music/counting/answer.ts';
import { defaultCountingPreferences, captureCountingPreferences } from '../../music/counting/preferences.ts';
import type { CountingPreferences } from '../../music/counting/preferences.ts';
import { createScore } from '../../music/score.ts';
import type { RhythmScore } from '../../music/score.ts';
import { defaultGeneration, generateExercise, generationIssue, ingredients } from './shared/generation.ts';
import type { GenerationSettings } from './shared/generation.ts';
import type { PassageFixture } from './shared/fixtures.ts';
import { practiceFixtures } from './shared/fixtures.ts';
import { exercises } from './fixtures.ts';
import type { Exercise } from './fixtures.ts';
import { defaultPresentation, linePlacementOptions, sustainAppearanceOptions } from '../count-writing/presentation.ts';
import type { CountPresentation } from '../count-writing/presentation.ts';
// Legacy preference fields below exist only for v1 browser migration and historical tests.
type DottedQuarterConvention = 'review' | 'required' | 'optional';
import type { OffbeatSymbol, CountingSystem } from '../count-writing/input.ts';
import { meters } from './shared/meter.ts';
import { playStyles } from './play-policy.ts';
import type { PlayStyle } from './play-policy.ts';
import { generationLevels, matchesTeachingPreset, resolveTeachingPreset } from './shared/teaching-presets.ts';

export const modes = ['write', 'tap', 'both'] as const;
export type Mode = typeof modes[number];
export const modeOptions = [{ value: 'write', label: 'Write Counts' }, { value: 'tap', label: 'Tap Rhythms' }, { value: 'both', label: 'Both' }];
/** One catalogue for every mode, including all historical review exercises. */
export const presets: readonly PassageFixture[] = [
  ...practiceFixtures,
  ...exercises,
];
export function fixtureAccess(search: string) {
  const params = new URLSearchParams(search);
  const fixture = presets.find(f => f.id === params.get('fixture'));
  return { enabled: params.get('testing') === '1' || Boolean(fixture), fixture };
}
export interface Preferences {
  counting: CountingPreferences;
  version: 1; mode: Mode; generation: GenerationSettings; preset: string;
  countingSystem: CountingSystem; offbeat: OffbeatSymbol; presentation: CountPresentation; convention: DottedQuarterConvention;
  bpm: number; metronome: boolean; showCounts: boolean; wrapped: boolean; playStyle: PlayStyle;
}
export const preferenceKey = 'tuno.rhythm-walk.preferences.v1';
export const defaultPreferences = (): Preferences => ({ counting: defaultCountingPreferences, version: 1, mode: 'write', generation: defaultGeneration(), preset: 'generated', countingSystem: 'numbers', offbeat: '&', presentation: { ...defaultPresentation }, convention: 'review', bpm: 80, metronome: true, showCounts: false, wrapped: false, playStyle: 'tap' });
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
    // Legacy fields are read only for migration; rules with no exact equivalent use shared defaults.
    defaults.counting = captureCountingPreferences({ ...defaultCountingPreferences,
      vocabulary: defaults.countingSystem, offbeat: defaults.offbeat,
      ...(linePlacementOptions.some(o => o.value === p.presentation?.linePlacement) ? { linePlacement: p.presentation!.linePlacement } : {}),
      ...(sustainAppearanceOptions.some(o => o.value === p.presentation?.sustainAppearance) ? { internalAppearance: p.presentation!.sustainAppearance } : {}),
    });
    if (p.counting) { try { defaults.counting = captureCountingPreferences(p.counting); } catch { /* Invalid nested version uses migrated defaults. */ } }
    const g = p.generation;
    const selected = g?.meters ?? (g?.meter ? [g.meter] : undefined);
    if (g && Array.isArray(selected) && selected.every(meter => meters.includes(meter)) && Number.isInteger(g.measures) && g.measures >= 1 && g.measures <= 4 && Array.isArray(g.ingredients) && g.ingredients.every(id => ingredients.some(i => i.id === id)) && typeof g.allowUnintuitiveNotation === 'boolean' && (g.ties === undefined || typeof g.ties === 'boolean') && (g.syncopation === undefined || typeof g.syncopation === 'boolean')) {
      defaults.generation = { meters: [...new Set(selected)], measures: g.measures, ingredients: [...g.ingredients], allowUnintuitiveNotation: g.allowUnintuitiveNotation, ties: g.ties, syncopation: g.syncopation };
      if (g.restrictions && typeof g.restrictions.pairedEighths === 'boolean' && typeof g.restrictions.noQuarterRestBeatOne === 'boolean') defaults.generation.restrictions = { pairedEighths: g.restrictions.pairedEighths, noQuarterRestBeatOne: g.restrictions.noQuarterRestBeatOne };
      const identity = g.teachingPreset;
      const definition = generationLevels.find(p => p.id === identity?.id && p.version === identity?.version);
      if (definition && typeof identity?.customized === 'boolean') {
        // Exact attribution requires both engine support and matching controlled fields.
        defaults.generation.teachingPreset = { id: definition.id, version: definition.version, customized: identity.customized || !resolveTeachingPreset(definition).supported || !matchesTeachingPreset(defaults.generation, definition) };
      }
      if (!defaults.generation.teachingPreset || defaults.generation.teachingPreset.customized) delete defaults.generation.restrictions;
    }
  } catch { /* Missing, malformed or unavailable storage uses defaults. */ }
  return defaults;
}
/** Exercise identity changes only on replacement, never on response-mode changes. */
export class Activity {
  exercise: Exercise;
  countingPlan!: CountingPlan;
  countingAnswer!: CountingAnswer;
  countingResult: CountingEvaluation | null = null;
  /** Configuration captured at replacement, distinct from pending preferences. */
  exerciseGeneration!: GenerationSettings;
  private serial = 0;
  preferences: Preferences;
  constructor(preferences: Preferences, source: RhythmScore) { this.preferences = preferences; this.exercise = this.create(source); }
  private create(source: RhythmScore): Exercise {
    const score = createScore(source);
    this.countingPlan = buildCountingPlan(score, this.preferences.counting);
    this.countingAnswer = initializeAnswer(this.countingPlan);
    this.countingResult = null;
    this.exerciseGeneration = structuredClone(generationIssue(this.preferences.generation) ? defaultGeneration() : this.preferences.generation);
    return { id: `exercise-${++this.serial}`, label: presets.find(p => p.id === this.preferences.preset)?.label ?? 'Generated practice', description: 'Read the score. Choose how to respond.', score };
  }
  setMode(mode: Mode) { this.preferences.mode = mode; }
  replace(source: RhythmScore) { this.exercise = this.create(source); return this.exercise; }
  next(random = Math.random) {
    const measures = generateExercise(this.preferences.generation, random);
    this.preferences.preset = 'generated';
    return this.replace(measures);
  }
}
