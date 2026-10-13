import { meters, meterPolicy, syncopated } from './meter.ts';
import type { CountMeter } from './meter.ts';
import { derivePassage, deriveMeasure, duration } from '../../../music/measure.ts';
import type { RhythmEvent, RhythmMeasure } from '../../../music/measure.ts';
import { add, compare, divide, fraction, multiply } from '../../../music/fraction.ts';
import type { Fraction } from '../../../music/fraction.ts';
import { readableRestPlacement } from './notation-policy.ts';

export const ingredients = [
  { id: 'quarter', label: 'Quarter notes', event: ['Q'] },
  { id: 'eighth', label: 'Eighth notes', event: ['E'] },
  { id: 'half', label: 'Half notes', event: ['H'] },
  { id: 'dotted-quarter', label: 'Dotted quarter notes', event: ['Q', { dots: 1 }] },
  { id: 'quarter-rest', label: 'Quarter rests', event: ['Q', { rest: true }] },
  { id: 'eighth-rest', label: 'Eighth rests', event: ['E', { rest: true }] },
  { id: 'half-rest', label: 'Half rests', event: ['H', { rest: true }] },
  { id: 'dotted-quarter-rest', label: 'Dotted quarter rests', event: ['Q', { dots: 1, rest: true }] },
  { id: 'sixteenth', label: 'Sixteenth notes', event: ['S'] },
  { id: 'sixteenth-rest', label: 'Sixteenth rests', event: ['S', { rest: true }] },
  { id: 'dotted-eighth', label: 'Dotted eighth notes', event: ['E', { dots: 1 }] },
  { id: 'triplet-eighth', label: 'Triplet eighth notes', event: ['E', { tuplet: [3, 2] }] },
  { id: 'whole', label: 'Whole notes', event: ['W'] },
  { id: 'whole-rest', label: 'Whole rests', event: ['W', { rest: true }] },
  { id: 'dotted-half', label: 'Dotted half notes', event: ['H', { dots: 1 }] },
] as const satisfies readonly { id: string; label: string; event: RhythmEvent }[];
export type IngredientId = typeof ingredients[number]['id'];
export interface GenerationSettings {
  teachingPreset?: { id: string; version: number; customized: boolean };
  /** Narrow shared figure hooks; values are validated before generation. */
  restrictions?: { pairedEighths: boolean; noQuarterRestBeatOne: boolean };
  meters?: CountMeter[];
  /** Legacy single-meter input; shared preferences migrate it to meters. */
  meter?: CountMeter;
  measures: number;
  ingredients: IngredientId[];
  allowUnintuitiveNotation: boolean;
  ties?: boolean;
  syncopation?: boolean;
}
export const defaultGeneration = (): GenerationSettings => ({ meters: ['4/4'], measures: 2, ingredients: ingredients.filter(i => !['dotted-quarter-rest', 'sixteenth', 'sixteenth-rest', 'dotted-eighth', 'triplet-eighth', 'whole', 'whole-rest', 'dotted-half'].includes(i.id)).map(i => i.id), allowUnintuitiveNotation: false, ties: false, syncopation: false });

/** Shared UI/generation boundary; pattern IDs describe complete supported atoms.
 * UIL resolution may query this without changing definitions or active settings. */
export interface RhythmCapabilities {
  readonly meter: CountMeter;
  readonly ingredients: readonly IngredientId[];
  readonly patterns: readonly string[];
}
export function rhythmCapabilities(meter: CountMeter): RhythmCapabilities {
  const compound = meterPolicy(meter).compound;
  return {
    meter,
    ingredients: ingredients.filter(i => compound ? !['H', 'W'].includes(i.event[0]) && !['sixteenth', 'sixteenth-rest', 'dotted-eighth', 'triplet-eighth'].includes(i.id) : (i.event[0] !== 'W' || meter === '4/4') && (i.id !== 'dotted-half' || meter !== '2/4')).map(i => i.id),
    patterns: compound ? ['no-quarter-rest-beat-one'] : ['triplet-eighth', 'paired-eighths', 'no-quarter-rest-beat-one'],
  };
}
// A triplet is an atomic quarter-beat choice, emitted as ordinary written events.
const atomDuration = (ingredient: typeof ingredients[number]): Fraction => ingredient.id === 'triplet-eighth' ? fraction(1, 4) : duration(ingredient.event);

/** The pool chooses one meter for the whole exercise, never one per measure. */
export function selectedMeters(settings: GenerationSettings): CountMeter[] {
  const pool = settings.meters ?? [settings.meter ?? '4/4'];
  if (!pool.length) throw new Error('Select at least one time signature.');
  if (pool.some(meter => !meters.includes(meter))) throw new Error('Choose supported time signatures: 2/4, 3/4, 4/4 or 6/8.');
  return [...new Set(pool)];
}
/** Enabling a meter also enables its basic fill ingredient, without removing others. */
export function enableMeter(settings: GenerationSettings, meter: CountMeter): GenerationSettings {
  const { meter: _legacy, ...current } = settings;
  return { ...current, meters: [...new Set([...(settings.meters ?? [settings.meter ?? '4/4']), meter])], ingredients: [...new Set<IngredientId>([...settings.ingredients, meter === '6/8' ? 'eighth' : 'quarter'])] };
}
function plan(settings: GenerationSettings, meter: CountMeter) {
  const policy = meterPolicy(meter);
  if (!Number.isInteger(settings.measures) || settings.measures < 1 || settings.measures > 4) throw new Error('Choose an exercise length from 1 to 4 measures.');
  if (settings.ingredients.some(id => !ingredients.some(i => i.id === id))) throw new Error('Unknown rhythm ingredient.');
  if (!settings.ingredients.length) throw new Error('Select at least one rhythm ingredient.');
  if (settings.restrictions && (typeof settings.restrictions.pairedEighths !== 'boolean' || typeof settings.restrictions.noQuarterRestBeatOne !== 'boolean')) throw new Error('Invalid rhythm pattern restrictions.');
  if (settings.restrictions?.pairedEighths && (policy.compound || settings.ties || settings.syncopation || settings.ingredients.some(id => !['quarter', 'half', 'whole', 'dotted-half', 'eighth', 'quarter-rest', 'half-rest'].includes(id)))) throw new Error('Paired-eighth practice requires simple meters, basic values, and ties/syncopation off.');
  // Retain selections across meters; only generate the supported, readable subset.
  const supported = rhythmCapabilities(meter).ingredients;
  const pool = ingredients.filter(i => settings.ingredients.includes(i.id) &&
    supported.includes(i.id) &&
    !(!policy.compound && !settings.allowUnintuitiveNotation && i.id === 'dotted-quarter-rest'));
  const memo = new Map<string, boolean>();
  const barEnd = policy.length;
  const syncAt = (ingredient: typeof pool[number], position: Fraction) => !(ingredient.event as RhythmEvent)[1]?.rest && syncopated(position, atomDuration(ingredient), policy.pulse);
  const quarterEnd = (position: Fraction) => { const beat = divide(position, fraction(1, 4)); return multiply(fraction(Math.floor(beat[0] / beat[1]) + 1), fraction(1, 4)); };
  const allowedAt = (ingredient: typeof pool[number], position: Fraction, used = 0) =>
    (ingredient.id !== 'triplet-eighth' || divide(position, fraction(1, 4))[1] === 1) &&
    // Eighths form complete beat-aligned pairs: an offbeat can only finish the pair.
    (!settings.restrictions?.pairedEighths || divide(position, fraction(1, 4))[1] === 1 || ingredient.id === 'eighth') &&
    (!settings.restrictions?.noQuarterRestBeatOne || ingredient.id !== 'quarter-rest' || compare(position, fraction(0)) !== 0) &&
    // Readable short values stay inside quarter groups; dotted eighths start on a beat.
    (policy.compound || settings.allowUnintuitiveNotation || compare(atomDuration(ingredient), fraction(1, 4)) >= 0 ||
      (compare(add(position, atomDuration(ingredient)), quarterEnd(position)) <= 0 &&
       (ingredient.id !== 'dotted-eighth' || divide(position, fraction(1, 4))[1] === 1))) &&
    (!syncAt(ingredient, position) || (settings.syncopation && used === 0)) && compare(add(position, atomDuration(ingredient)), barEnd) <= 0 &&
    (settings.allowUnintuitiveNotation || readableRestPlacement(ingredient.event, position, policy.id));
  function fills(position: Fraction, used = 0): boolean {
    if (compare(position, barEnd) === 0) return true;
    const key = position.join('/') + ':' + used;
    if (!memo.has(key)) memo.set(key, pool.some(i => allowedAt(i, position, used) && fills(add(position, atomDuration(i)), used + Number(syncAt(i, position)))));
    return memo.get(key)!;
  }
  const choicesAt = (position: Fraction, used = 0) => pool.filter(i => allowedAt(i, position, used) && fills(add(position, atomDuration(i)), used + Number(syncAt(i, position))));
  if (!fills(fraction(0))) throw new Error(`These ingredients cannot fill ${policy.id} with the current notation and pulse policy. Add compatible quarters/eighths, enable syncopation, or remove incompatible ingredients.`);
  return { choicesAt, syncAt, policy };
}
export function generationIssue(settings: GenerationSettings): string | null {
  try { for (const meter of selectedMeters(settings)) plan(settings, meter); return null; } catch (error) { return (error as Error).message; }
}
/** Randomness is injected for reproducible tests; source time always comes from written events. */
export function generateExercise(settings: GenerationSettings, random = Math.random): RhythmMeasure[] {
  const pool = selectedMeters(settings);
  // Validate every selected meter before drawing; none are silently omitted.
  for (const meter of pool) plan(settings, meter);
  const draw = pool.length > 1 ? random() : 0;
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return a number in [0, 1).');
  const { choicesAt, syncAt, policy } = plan(settings, pool[Math.floor(draw * pool.length)]!);
  const passage = Array.from({ length: settings.measures }, (): RhythmMeasure => {
    const events: RhythmEvent[] = [];
    let position = fraction(0), used = 0;
    while (compare(position, policy.length) < 0) {
      const choices = choicesAt(position, used);
      const draw = random();
      if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return a number in [0, 1).');
      const choice = choices[Math.floor(draw * choices.length)]!;
      for (let member = 0; member < (choice.id === 'triplet-eighth' ? 3 : 1); member++) events.push(structuredClone(choice.event));
      used += Number(syncAt(choice, position));
      position = add(position, atomDuration(choice));
    }
    return { meter: policy.meter, events };
  });
  if (settings.ties) {
    const refs = passage.flatMap((bar, measure) => deriveMeasure(bar).events.map(event => ({ measure, event: event.index })));
    const candidates: RhythmMeasure[][] = [];
    for (let start = 0; start < refs.length - 1; start++) for (const size of [2, 3]) {
      const chain = refs.slice(start, start + size);
      if (chain.length !== size || chain.some(r => { const m = passage[r.measure]!.events[r.event]![1]; return m?.rest || m?.tuplet; })) continue;
      const candidate = structuredClone(passage);
      chain.slice(0, -1).forEach(r => {
        const bar = candidate[r.measure]!;
        const event = bar.events[r.event]!;
        (bar.events as RhythmEvent[])[r.event] = [event[0], { ...event[1], tieNext: true }];
      });
      const attacks = derivePassage(candidate).attacks;
      const syncs = Array<number>(passage.length).fill(0);
      for (const attack of attacks) {
        if (syncopated(attack.start, attack.duration, policy.pulse)) syncs[attack.sources[0]!.measure]!++;
      }
      if ((!settings.syncopation && syncs.some(Boolean)) || syncs.some(n => n > 1)) continue;
      candidates.push(candidate);
    }
    // Bounded draw: at most one chain, never retry until success.
    const draw = random();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return a number in [0, 1).');
    if (candidates.length && draw < .65) return candidates[Math.floor(draw / .65 * candidates.length)]!;
  }
  derivePassage(passage);
  return passage;
}
