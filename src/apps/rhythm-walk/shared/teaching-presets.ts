import { eligibleFigures } from './figures.ts';
import type { InstrumentScope } from './figures.ts';
import { generationCapabilities } from './capabilities.ts';
import type { GenerationCapabilities } from './capabilities.ts';
import { generationIssue, ingredients, figureIngredients } from './generation.ts';
import type { GenerationSettings } from './generation.ts';
import type { CountMeter } from './meter.ts';

const sourceUrl = 'https://www.uiltexas.org/music/concert-sight-reading/band-sight-reading-criteria';
const figureRoot = 'https://www.uiltexas.org/files/music/music-notations/';
export const criteriaSource = { url: sourceUrl, revision: 'Revised 2022', retrieved: '2026-10-14' } as const;
export interface TeachingPresetIdentity { id: string; version: number; customized: boolean; scope?: InstrumentScope }
export interface TeachingPresetDefinition {
  id: string;
  version: number;
  label: string;
  source: typeof criteriaSource | null;
  /** Independently inspected figures, not all permutations of their note values. */
  figures: readonly { events: readonly string[]; url: string; scope: 'general' | 'percussion' }[];
  officialMeters: readonly string[];
  meterChanges: number;
  restrictions: readonly string[];
  unresolved: readonly string[];
  recommended: GenerationSettings;
  required: { ingredients: readonly string[]; patterns: readonly string[]; meters: readonly CountMeter[] };
}
const figure = (file: string, events: string[], scope: 'general' | 'percussion' = 'general') => ({ events, url: `${figureRoot}${file}.jpg`, scope });
const basic = [figure('Rquarter', ['Q']), figure('Rhalf', ['H']), figure('Rdothalf', ['H.']), figure('Rwhole', ['W']), figure('R2eighth', ['E', 'E'])];
const percussion = [figure('R8-16-16', ['E', 'S', 'S'], 'percussion'), figure('R4-16', ['S', 'S', 'S', 'S'], 'percussion')];
const dottedQuarter = figure('Rdot4-8', ['Q.', 'E']);
const dottedEighth = figure('Rdot8-s', ['E.', 'S']);
const syncopated = figure('R8-4-8', ['E', 'Q', 'E']);
const levels = ['I', 'II', 'III', 'IV'] as const;
export const teachingPresets: readonly (TeachingPresetDefinition & { source: typeof criteriaSource })[] = levels.map((level, index) => {
  const number = index + 1;
  const suggested: CountMeter[] = number < 3 ? ['4/4'] : ['2/4', '3/4', '4/4'];
  const figures = number < 3 ? [...basic, ...percussion] : number === 3 ? [...basic, dottedQuarter, ...percussion, { ...dottedEighth, scope: 'percussion' as const }] : [...basic, dottedQuarter, syncopated, dottedEighth, figure('R4-16', ['S', 'S', 'S', 'S']), figure('R8-16-16', ['E', 'S', 'S'])];
  return {
    id: `uil-${number}`, version: 3, label: `UIL ${level}`, source: criteriaSource,
    figures, officialMeters: suggested,
    meterChanges: number < 4 ? 0 : number - 3,
    restrictions: [
      'Use the listed figures; note-value permutations are not independently authorized.',
      ...(number < 3 ? ['No quarter rest on beat 1; no eighth rests.', 'Sixteenth figures are percussion-only.'] : number === 3 ? ['Sixteenth and dotted-eighth figures are percussion-only.', 'The 2023 meter-change exception is not a standing rule.'] : []),
      'No general permission for ties, tuplet rests or other tuplets is stated in these criteria.',
    ],
    unresolved: ['Rest vocabulary beyond the explicit Level I prohibitions and tie permissions require clarification.'],
    recommended: { meters: suggested, measures: 2,
      figureProfile: { version: 1, level: number, scope: 'general' },
      ingredients: figureIngredients({ version: 1, level: number, scope: 'general' }),
      allowUnintuitiveNotation: false, ties: false, syncopation: number >= 4 },
    required: { ingredients: figureIngredients({ version: 1, level: number, scope: 'general' }), patterns: ['uil-figures'], meters: suggested },
  };
});
/** User-defined Uno configurations; independent of official UIL figure criteria. */
const unoConfigurations: Omit<GenerationSettings, 'measures'>[] = [
  { meters: ['4/4'], ingredients: ['whole', 'half', 'quarter', 'eighth', 'quarter-rest', 'half-rest'], ties: false, syncopation: false, allowUnintuitiveNotation: false },
  { meters: ['4/4', '2/4', '3/4'], ingredients: ['whole', 'half', 'quarter', 'eighth', 'quarter-rest', 'half-rest', 'dotted-half', 'dotted-quarter'], ties: true, syncopation: false, allowUnintuitiveNotation: false },
  { meters: ['4/4', '2/4', '3/4', '6/8'], ingredients: ['whole', 'half', 'quarter', 'eighth', 'quarter-rest', 'half-rest', 'dotted-half', 'dotted-quarter', 'sixteenth', 'eighth-rest', 'triplet-eighth', 'dotted-eighth'], ties: true, syncopation: true, allowUnintuitiveNotation: false },
  { meters: ['4/4', '2/4', '3/4', '6/8'], ingredients: ingredients.map(i => i.id), ties: true, syncopation: true, allowUnintuitiveNotation: true },
];
export const unoPresets: readonly TeachingPresetDefinition[] = unoConfigurations.map((configuration, index) => {
  const recommended: GenerationSettings = { ...configuration, measures: 2 };
  return {
    id: `uno-${index + 1}`, version: 1, label: `Uno${index + 1}`, source: null,
    figures: [], officialMeters: [], meterChanges: 0, restrictions: [], unresolved: [], recommended,
    required: { ingredients: recommended.ingredients, patterns: [], meters: recommended.meters! },
  };
});
/** One learner-facing catalogue; UIL definitions retain their separately tested scope. */
export const generationLevels = [...unoPresets, ...teachingPresets];
export function teachingPresetLabel(identity?: TeachingPresetIdentity): string {
  const definition = generationLevels.find(p => p.id === identity?.id);
  return definition ? `${definition.label}${identity?.customized ? ' · customized' : definition.source ? ` · ${identity?.scope ?? 'general'} · note-only practice` : ''}` : identity && ['uil-5', 'uil-6'].includes(identity.id) ? `UIL ${identity.id === 'uil-5' ? 'V' : 'VI'} · customized · deferred level` : 'Custom';
}
export type PresetResolution = { supported: true; settings: GenerationSettings } | { supported: false; reasons: string[] };
export function matchesTeachingPreset(settings: GenerationSettings, definition: TeachingPresetDefinition): boolean {
  const controlled = (g: GenerationSettings) => JSON.stringify({ meters: [...(g.meters ?? [g.meter ?? '4/4'])].sort(), ingredients: [...g.ingredients].sort(), allowUnintuitiveNotation: g.allowUnintuitiveNotation, ties: Boolean(g.ties), syncopation: Boolean(g.syncopation), pairedEighths: Boolean(g.restrictions?.pairedEighths), noQuarterRestBeatOne: Boolean(g.restrictions?.noQuarterRestBeatOne), figureProfile: g.figureProfile });
  return controlled(settings) === controlled(scopedSettings(definition, settings.teachingPreset?.scope ?? 'general')) && (settings.meterChanges ?? 0) === 0;
}
function scopedSettings(definition: TeachingPresetDefinition, scope: InstrumentScope): GenerationSettings {
  const settings = structuredClone(definition.recommended);
  if (settings.figureProfile) {
    settings.figureProfile.scope = scope;
    settings.ingredients = figureIngredients(settings.figureProfile);
  }
  return settings;
}
export function resolveTeachingPreset(definition: TeachingPresetDefinition, capabilities = generationCapabilities(), scope: InstrumentScope = 'general'): PresetResolution {
  const reasons: string[] = [];
  for (const id of definition.required.ingredients) if (!capabilities.ingredients.includes(id)) reasons.push(`Missing ingredient: ${id}.`);
  for (const id of definition.required.patterns) if (!capabilities.patterns.includes(id)) reasons.push(`Missing pattern support: ${id}.`);
  for (const meter of definition.required.meters) if (!capabilities.meters.includes(meter)) reasons.push(`Unsupported meter: ${meter}.`);
  if (capabilities.byMeter) {
    // Ingredient pools are intentionally meter-compatible subsets (e.g. whole
    // notes only in 4/4). Every required ingredient must actually be available
    // in at least one selected meter, not merely in the global catalogue.
    for (const id of definition.required.ingredients) {
      if (!definition.required.meters.some(meter => capabilities.byMeter![meter]?.ingredients.includes(id))) reasons.push(`Missing ingredient in selected meters: ${id}.`);
    }
    for (const meter of definition.required.meters) {
      if (!capabilities.byMeter[meter]) reasons.push(`Missing capability description for ${meter}.`);
      for (const id of definition.required.patterns) if (!capabilities.byMeter[meter]?.patterns.includes(id)) reasons.push(`Missing pattern support in ${meter}: ${id}.`);
    }
  }
  const settings = scopedSettings(definition, scope);
  for (const id of settings.ingredients) if (!capabilities.ingredients.includes(id) || !definition.required.meters.some(meter => capabilities.byMeter ? capabilities.byMeter[meter]?.ingredients.includes(id) : capabilities.ingredients.includes(id))) reasons.push(`Missing ingredient in selected meters: ${id}.`);
  if (settings.figureProfile && capabilities.byMeter) for (const meter of definition.required.meters) {
    for (const id of eligibleFigures(settings.figureProfile, meter)) if (!capabilities.byMeter[meter]?.figures?.includes(id)) reasons.push(`Missing figure in ${meter}: ${id}.`);
  }
  const issue = generationIssue(settings);
  if (issue) reasons.push(issue);
  return reasons.length ? { supported: false, reasons } : { supported: true, settings };
}
/** Pure pending-settings operation. Never replaces an exercise or touches responses. */
export function applyTeachingPreset(current: GenerationSettings, definition: TeachingPresetDefinition, capabilities?: GenerationCapabilities, scope: InstrumentScope = current.teachingPreset?.scope ?? 'general'): PresetResolution {
  const result = resolveTeachingPreset(definition, capabilities, scope);
  if (!result.supported) return result;
  const settings = { ...result.settings, measures: current.measures, teachingPreset: { id: definition.id, version: definition.version, customized: false, ...(definition.source ? { scope } : {}) } };
  const issue = generationIssue(settings);
  return issue ? { supported: false, reasons: [issue] } : { supported: true, settings };
}
/** Length is an independent preference; all other generation fields customize attribution. */
export function customizeTeachingPreset(settings: GenerationSettings): GenerationSettings {
  if (!settings.teachingPreset) return settings;
  const { restrictions: _restrictions, figureProfile: _profile, meterChanges: _changes, ...current } = settings;
  return { ...current, teachingPreset: { ...settings.teachingPreset, customized: true } };
}
