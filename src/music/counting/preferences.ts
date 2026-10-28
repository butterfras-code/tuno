import { immutable } from '../written.ts';
import type { CountingSystem } from './vocabulary.ts';
export const countingPreferenceOptions = immutable({
  linePlacement: ['below', 'above', 'beside'],
  internalAppearance: ['raised', 'lowered', 'unchanged'],
  restAppearance: ['parentheses', 'slashes'],
  vocabulary: ['numbers', 'syllables'],
  offbeat: ['&', '+'],
} as const);
export interface CountingPreferences {
  readonly version: 1;
  readonly longNotes: boolean;
  readonly dotted: boolean;
  readonly includeRests: boolean;
  readonly showDurationLine: boolean;
  readonly linePlacement: 'below' | 'above' | 'beside';
  readonly internalAppearance: 'raised' | 'lowered' | 'unchanged';
  readonly restAppearance: 'parentheses' | 'slashes';
  readonly vocabulary: CountingSystem;
  readonly offbeat: '&' | '+';
}
export const defaultCountingPreferences: CountingPreferences = immutable({ version: 1, longNotes: true, dotted: false, includeRests: true, showDurationLine: true, linePlacement: 'beside', internalAppearance: 'raised', restAppearance: 'parentheses', vocabulary: 'numbers', offbeat: '+' });
/** Complete contract validation; persistence/URL migration belongs to the settings slice. */
export function captureCountingPreferences(value: CountingPreferences): CountingPreferences {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== Object.keys(defaultCountingPreferences).length || value.version !== 1 ||
      ['longNotes', 'dotted', 'includeRests', 'showDurationLine'].some(k => typeof value[k as keyof CountingPreferences] !== 'boolean') ||
      !countingPreferenceOptions.linePlacement.includes(value.linePlacement) || !countingPreferenceOptions.internalAppearance.includes(value.internalAppearance) ||
      !countingPreferenceOptions.restAppearance.includes(value.restAppearance) || !countingPreferenceOptions.vocabulary.includes(value.vocabulary) || !countingPreferenceOptions.offbeat.includes(value.offbeat)) throw new Error('Invalid counting preferences/version.');
  return immutable({ ...value });
}
