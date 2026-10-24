import { figurePlan, generateFigures, profileFigures, rhythmFigures, eligibleFigures } from './figures.ts';
import type { FigureProfile, InstrumentScope, FigureId } from './figures.ts';
import { meters, meterPolicy, syncopated } from './meter.ts';
import type { CountMeter } from './meter.ts';
import { derivePassage, deriveMeasure, duration, note, score } from '../../../music/measure.ts';
import type { RhythmEvent, RhythmMeasure } from '../../../music/measure.ts';
import { add, compare, divide, fraction, multiply, subtract } from '../../../music/fraction.ts';
import type { Fraction } from '../../../music/fraction.ts';
import { readableRestPlacement } from './notation-policy.ts';

export const ingredients = [
  { id: 'quarter', label: 'Quarter notes', event: note('quarter') },
  { id: 'eighth', label: 'Eighth notes', event: note('eighth') },
  { id: 'half', label: 'Half notes', event: note('half') },
  { id: 'dotted-quarter', label: 'Dotted quarter notes', event: note('quarter', { dots: 1 }) },
  { id: 'quarter-rest', label: 'Quarter rests', event: note('quarter', { kind: 'rest' }) },
  { id: 'eighth-rest', label: 'Eighth rests', event: note('eighth', { kind: 'rest' }) },
  { id: 'half-rest', label: 'Half rests', event: note('half', { kind: 'rest' }) },
  { id: 'dotted-quarter-rest', label: 'Dotted quarter rests', event: note('quarter', { dots: 1, kind: 'rest' }) },
  { id: 'sixteenth', label: 'Sixteenth notes', event: note('16th') },
  { id: 'sixteenth-rest', label: 'Sixteenth rests', event: note('16th', { kind: 'rest' }) },
  { id: 'dotted-eighth', label: 'Dotted eighth notes', event: note('eighth', { dots: 1 }) },
  { id: 'triplet-eighth', label: 'Triplet eighth notes', event: note('eighth', { timeModification: [3, 2] }) },
  { id: 'whole', label: 'Whole notes', event: note('whole') },
  { id: 'whole-rest', label: 'Whole rests', event: note('whole', { kind: 'rest' }) },
  { id: 'dotted-half', label: 'Dotted half notes', event: note('half', { dots: 1 }) },
] as const satisfies readonly { id: string; label: string; event: RhythmEvent }[];
export type IngredientId = typeof ingredients[number]['id'];
/** Display vocabulary is derived from the exact authored figure templates. */
export function figureIngredients(profile: FigureProfile): IngredientId[] {
  return [...new Set(profileFigures(profile).flatMap(id => rhythmFigures[id].events.map(event => ingredients.find(i => JSON.stringify(i.event) === JSON.stringify(event))!.id)))];
}
/** Complete quarter-note-beat figures, independent of UIL's verified catalogue. */
export const sixteenthPatterns = [
  { id: '16-16-16-16', label: 'Four sixteenths', events: [note('16th'), note('16th'), note('16th'), note('16th')] },
  { id: '8-16-16', label: 'Eighth plus two sixteenths', events: [note('eighth'), note('16th'), note('16th')] },
  { id: '16-16-8', label: 'Two sixteenths plus eighth', events: [note('16th'), note('16th'), note('eighth')] },
  { id: '16-8-16', label: 'Sixteenth plus eighth plus sixteenth', events: [note('16th'), note('eighth'), note('16th')] },
  { id: 'dotted-8-16', label: 'Dotted eighth plus sixteenth', events: [note('eighth', { dots: 1 }), note('16th')] },
] as const;
export type SixteenthPatternId = typeof sixteenthPatterns[number]['id'];
export function selectedSixteenthPatterns(settings: GenerationSettings): SixteenthPatternId[] {
  if (settings.sixteenthPatterns) return settings.sixteenthPatterns;
  if (settings.figureProfile) {
    const ids: Partial<Record<FigureId, SixteenthPatternId>> = { SSSS: '16-16-16-16', ESS: '8-16-16', 'E.S': 'dotted-8-16' };
    return profileFigures(settings.figureProfile).flatMap(id => ids[id] ? [ids[id]!] : []);
  }
  return sixteenthPatterns.filter(p => p.events.every(event =>
    ingredients.some(i => settings.ingredients.includes(i.id) && JSON.stringify(i.event) === JSON.stringify(event)))).map(p => p.id);
}
/** Maximum silent share of total written exercise duration, not event count. */
export const minimumExerciseAttacks = 4;
export const restDensityCap = fraction(15, 100);
type Atom = { id: string; event: RhythmEvent; events: readonly RhythmEvent[] };
export interface GenerationSettings {
  figureProfile?: FigureProfile;
  sixteenthPatterns?: SixteenthPatternId[];
  /** Read only for migration/rejection of the previous experimental configuration. */
  meterChanges?: number;
  teachingPreset?: { id: string; version: number; customized: boolean; scope?: InstrumentScope };
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
  readonly figures: readonly FigureId[];
}
export function rhythmCapabilities(meter: CountMeter): RhythmCapabilities {
  const compound = meterPolicy(meter).compound;
  return {
    meter,
    figures: compound ? [] : eligibleFigures({ version: 1, level: 4, scope: 'general' }, meter),
    ingredients: ingredients.filter(i => compound ? !['half', 'whole'].includes(i.event.type) && !['sixteenth', 'sixteenth-rest', 'dotted-eighth', 'triplet-eighth'].includes(i.id) : (i.event.type !== 'whole' || meter === '4/4') && (i.id !== 'dotted-half' || meter !== '2/4')).map(i => i.id),
    patterns: compound ? ['no-quarter-rest-beat-one'] : ['uil-figures', 'triplet-eighth', 'paired-eighths', 'no-quarter-rest-beat-one'],
  };
}
// A triplet is an atomic quarter-beat choice, emitted as ordinary written events.
const atomDuration = (ingredient: Atom): Fraction => ingredient.events.reduce((sum, event) => add(sum, duration(event)), fraction(0));

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
  if (settings.sixteenthPatterns && (!Array.isArray(settings.sixteenthPatterns) || settings.sixteenthPatterns.some(id => !sixteenthPatterns.some(p => p.id === id)))) throw new Error('Unknown sixteenth grouping.');
  if (!settings.ingredients.length && !settings.sixteenthPatterns?.length) throw new Error('Select at least one rhythm ingredient.');
  if (settings.restrictions && (typeof settings.restrictions.pairedEighths !== 'boolean' || typeof settings.restrictions.noQuarterRestBeatOne !== 'boolean')) throw new Error('Invalid rhythm pattern restrictions.');
  if (settings.restrictions?.pairedEighths && (policy.compound || settings.ties || settings.syncopation || settings.ingredients.some(id => !['quarter', 'half', 'whole', 'dotted-half', 'eighth', 'quarter-rest', 'half-rest'].includes(id)))) throw new Error('Paired-eighth practice requires simple meters, basic values, and ties/syncopation off.');
  // Retain selections across meters; only generate the supported, readable subset.
  const supported = rhythmCapabilities(meter).ingredients;
  const pool: Atom[] = ingredients.filter(i => settings.ingredients.includes(i.id) &&
    supported.includes(i.id) && !['sixteenth', 'dotted-eighth'].includes(i.id) &&
    !(!policy.compound && !settings.allowUnintuitiveNotation && i.id === 'dotted-quarter-rest')).map(i => ({ ...i, events: Array.from({ length: i.id === 'triplet-eighth' ? 3 : 1 }, () => i.event) }));
  if (!policy.compound) for (const pattern of sixteenthPatterns.filter(p => selectedSixteenthPatterns(settings).includes(p.id))) pool.push({ ...pattern, event: pattern.events[0] });
  const memo = new Map<string, Fraction | null>();
  const barEnd = policy.length;
  const syncAt = (ingredient: typeof pool[number], position: Fraction) => !((ingredient.event as RhythmEvent).kind === 'rest') && syncopated(position, atomDuration(ingredient), policy.pulse);
  const quarterEnd = (position: Fraction) => { const beat = divide(position, fraction(1, 4)); return multiply(fraction(Math.floor(beat[0] / beat[1]) + 1), fraction(1, 4)); };
  const allowedAt = (ingredient: typeof pool[number], position: Fraction, used = 0, bar = 0) =>
    !(bar === 0 && compare(position, fraction(0)) === 0 && ingredient.event.kind === 'rest') &&
    (ingredient.events.length === 1 || divide(position, fraction(1, 4))[1] === 1) &&
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
  const restCost = (atom: Atom) => atom.event.kind === 'rest' ? atomDuration(atom) : fraction(0);
  const budget = multiply(multiply(policy.length, fraction(settings.measures)), restDensityCap);
  // Memoized minimum remaining silence keeps every random choice completable,
  // including sparse custom pools, without retries or replacing selected values.
  const attackCount = (atom: Atom) => atom.events.filter(e => e.kind !== 'rest').length;
  function minimumRest(position: Fraction, used = 0, bar = 0, needed = minimumExerciseAttacks): Fraction | null {
    if (compare(position, barEnd) === 0) return bar + 1 === settings.measures ? needed === 0 ? fraction(0) : null : minimumRest(fraction(0), 0, bar + 1, needed);
    const key = `${position.join('/')}:${used}:${bar}:${needed}`;
    if (!memo.has(key)) {
      let best: Fraction | null = null;
      for (const atom of pool) if (allowedAt(atom, position, used, bar)) {
        const tail = minimumRest(add(position, atomDuration(atom)), used + Number(syncAt(atom, position)), bar, Math.max(0, needed - attackCount(atom)));
        if (tail !== null) {
          const cost = add(restCost(atom), tail);
          if (best === null || compare(cost, best) < 0) best = cost;
          if (compare(best, fraction(0)) === 0) break;
        }
      }
      memo.set(key, best);
    }
    return memo.get(key)!;
  }
  const choicesAt = (position: Fraction, used = 0, bar = 0, remaining = budget, needed = minimumExerciseAttacks) => pool.filter(atom => {
    if (!allowedAt(atom, position, used, bar)) return false;
    const tail = minimumRest(add(position, atomDuration(atom)), used + Number(syncAt(atom, position)), bar, Math.max(0, needed - attackCount(atom)));
    return tail !== null && compare(add(restCost(atom), tail), remaining) <= 0;
  });
  const minimum = minimumRest(fraction(0));
  if (minimum === null || compare(minimum, budget) > 0) throw new Error(`These ingredients cannot fill ${policy.id} with a sounded opening, at least four attacks, and at most 15% rests. Add compatible sounded notes or groupings, or change the notation policy.`);
  return { choicesAt, syncAt, policy, budget, restCost, attackCount };
}
export function generationIssue(settings: GenerationSettings): string | null {
  try {
    if (settings.meterChanges !== undefined && settings.meterChanges !== 0) throw new Error('Practice uses one meter per exercise.');
    if (settings.figureProfile) {
      if (!Number.isInteger(settings.measures) || settings.measures < 1 || settings.measures > 4) throw new Error('Choose an exercise length from 1 to 4 measures.');
      if (JSON.stringify([...settings.ingredients].sort()) !== JSON.stringify(figureIngredients(settings.figureProfile).sort())) throw new Error('Figure profile ingredients do not match. Customize to edit vocabulary.');
      if (settings.allowUnintuitiveNotation || Boolean(settings.syncopation) !== (settings.figureProfile.level >= 4) || settings.restrictions) throw new Error('Figure profile constraints do not match. Customize to change notation or syncopation.');
      if (settings.ties) throw new Error('Verified figure practice is note-only. Customize to enable rests or ties.');
      for (const meter of selectedMeters(settings)) figurePlan(settings.figureProfile, meter);
    } else for (const meter of selectedMeters(settings)) plan(settings, meter);
    return null;
  } catch (error) { return (error as Error).message; }
}
/** Randomness is injected for reproducible tests; source time always comes from written events. */
export function generateExercise(settings: GenerationSettings, random = Math.random) {
  const pool = selectedMeters(settings);
  const issue = generationIssue(settings); if (issue) throw new Error(issue);
  if (settings.figureProfile) return generateFigures(settings.figureProfile, pool, settings.measures, random, minimumExerciseAttacks);
  // generationIssue validated every selected meter before this draw.
  const draw = pool.length > 1 ? random() : 0;
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return a number in [0, 1).');
  const { choicesAt, syncAt, policy, budget, restCost, attackCount } = plan(settings, pool[Math.floor(draw * pool.length)]!);
  let remaining = budget, needed = minimumExerciseAttacks;
  const passage = Array.from({ length: settings.measures }, (_, bar): RhythmMeasure => {
    const events: RhythmEvent[] = [];
    let position = fraction(0), used = 0;
    while (compare(position, policy.length) < 0) {
      const choices = choicesAt(position, used, bar, remaining, needed);
      const draw = random();
      if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return a number in [0, 1).');
      const choice = choices[Math.floor(draw * choices.length)]!;
      events.push(...structuredClone(choice.events));
      remaining = subtract(remaining, restCost(choice));
      needed = Math.max(0, needed - attackCount(choice));
      used += Number(syncAt(choice, position));
      position = add(position, atomDuration(choice));
    }
    return { meter: policy.meter, notes: events };
  });
  if (settings.ties) {
    const refs = passage.flatMap((bar, measure) => deriveMeasure(bar).events.map(event => ({ measure, event: event.index })));
    const candidates: RhythmMeasure[][] = [];
    for (let start = 0; start < refs.length - 1; start++) for (const size of [2, 3]) {
      const chain = refs.slice(start, start + size);
      if (chain.length !== size || chain.some(r => { const m = passage[r.measure]!.notes[r.event]!; return m.kind === 'rest' || m.timeModification; })) continue;
      const candidate = structuredClone(passage);
      chain.slice(0, -1).forEach(r => {
        const bar = candidate[r.measure]!;
        const event = bar.notes[r.event]!;
        (bar.notes as RhythmEvent[])[r.event] = { ...event, tieNext: true };
      });
      const attacks = derivePassage(score(candidate).measures).attacks;
      if (attacks.length < minimumExerciseAttacks) continue;
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
    if (candidates.length && draw < .65) return score(candidates[Math.floor(draw / .65 * candidates.length)]!);
  }
  return score(passage);
}
