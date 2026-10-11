import { meterPolicy, syncopated } from './meter.ts';
import type { CountMeter } from './meter.ts';
import { derivePassage, deriveMeasure, duration } from '../../../music/measure.ts';
import type { RhythmEvent, RhythmMeasure } from '../../../music/measure.ts';
import { add, compare, divide, fraction } from '../../../music/fraction.ts';
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
] as const satisfies readonly { id: string; label: string; event: RhythmEvent }[];
export type IngredientId = typeof ingredients[number]['id'];
export interface GenerationSettings { meter?: CountMeter; measures: number; ingredients: IngredientId[]; allowUnintuitiveNotation: boolean; ties?: boolean; syncopation?: boolean }
export const defaultGeneration = (): GenerationSettings => ({ meter: '4/4', measures: 2, ingredients: ingredients.filter(i => i.id !== 'dotted-quarter-rest').map(i => i.id), allowUnintuitiveNotation: false, ties: false, syncopation: false });

function plan(settings: GenerationSettings) {
  const policy = meterPolicy(settings.meter);
  if (!Number.isInteger(settings.measures) || settings.measures < 1 || settings.measures > 4) throw new Error('Choose an exercise length from 1 to 4 measures.');
  if (settings.ingredients.some(id => !ingredients.some(i => i.id === id))) throw new Error('Unknown rhythm ingredient.');
  if (!policy.compound && !settings.allowUnintuitiveNotation && settings.ingredients.includes('dotted-quarter-rest')) throw new Error('Dotted quarter rests in simple meters require Allow unintuitive notation. Enable it or uncheck dotted quarter rests.');
  const pool = ingredients.filter(i => settings.ingredients.includes(i.id));
  if (!pool.length) throw new Error('Select at least one rhythm ingredient.');
  const memo = new Map<string, boolean>();
  const barEnd = policy.length;
  const syncAt = (ingredient: typeof pool[number], position: Fraction) => !(ingredient.event as RhythmEvent)[1]?.rest && syncopated(position, duration(ingredient.event), policy.pulse);
  const allowedAt = (ingredient: typeof pool[number], position: Fraction, used = 0) =>
    (!syncAt(ingredient, position) || (settings.syncopation && used === 0)) && compare(add(position, duration(ingredient.event)), barEnd) <= 0 &&
    (settings.allowUnintuitiveNotation || readableRestPlacement(ingredient.event, position, policy.id));
  function fills(position: Fraction, used = 0): boolean {
    if (compare(position, barEnd) === 0) return true;
    const key = position.join('/') + ':' + used;
    if (!memo.has(key)) memo.set(key, pool.some(i => allowedAt(i, position, used) && fills(add(position, duration(i.event)), used + Number(syncAt(i, position)))));
    return memo.get(key)!;
  }
  const choicesAt = (position: Fraction, used = 0) => pool.filter(i => allowedAt(i, position, used) && fills(add(position, duration(i.event)), used + Number(syncAt(i, position))));
  if (!fills(fraction(0))) throw new Error(`These ingredients cannot fill ${policy.id} with the current notation and pulse policy. Add compatible quarters/eighths, enable syncopation, or remove incompatible ingredients.`);
  // Check that each selection can actually occur in a complete bar under the position policy.
  const usable = new Set<IngredientId>();
  const visited = new Set<string>();
  let canSync = false, canTie = false, canTiedSync = false;
  function visit(position: Fraction, used = 0) {
    const key = position.join('/') + ':' + used;
    if (visited.has(key)) return;
    visited.add(key);
    for (const ingredient of choicesAt(position, used)) {
      usable.add(ingredient.id);
      const note = !(ingredient.event as RhythmEvent)[1]?.rest;
      const end = add(position, duration(ingredient.event));
      const nextUsed = used + Number(syncAt(ingredient, position));
      const offbeat = divide(position, policy.pulse)[1] !== 1;
      if (note && (!offbeat || settings.syncopation)) {
        const nextNotes = (compare(end, barEnd) === 0 && settings.measures > 1 ? choicesAt(fraction(0)) : choicesAt(end, nextUsed)).filter(i => !(i.event as RhythmEvent)[1]?.rest);
        if (nextNotes.length && (!offbeat || used === 0)) {
          canTie = true;
          canTiedSync ||= nextNotes.some(next => syncopated(position, add(duration(ingredient.event), duration(next.event)), policy.pulse));
        }
      }
      canSync ||= syncAt(ingredient, position);
      visit(add(position, duration(ingredient.event)), used + Number(syncAt(ingredient, position)));
    }
  }
  visit(fraction(0));
  const unusable = pool.filter(i => !usable.has(i.id));
  if (unusable.length) throw new Error(`${unusable.map(i => i.label).join(', ')} cannot fit a complete bar with this selection and notation policy. Add quarters or eighths, or remove those ingredients.`);
  if (settings.ties && !canTie) throw new Error('Ties require adjacent enabled note segments in a complete exercise under these settings. Add quarter/eighth notes, enable syncopation, or disable ties.');
  if (settings.syncopation && !canSync && !(settings.ties && canTiedSync)) throw new Error('Syncopation needs a reachable off-pulse sustained note crossing the next pulse: enable eighth notes and a longer note, or eighth notes with ties.');
  return { choicesAt, syncAt, policy };
}
export function generationIssue(settings: GenerationSettings): string | null {
  try { plan(settings); return null; } catch (error) { return (error as Error).message; }
}
/** Randomness is injected for reproducible tests; source time always comes from written events. */
export function generateExercise(settings: GenerationSettings, random = Math.random): RhythmMeasure[] {
  const { choicesAt, syncAt, policy } = plan(settings);
  const passage = Array.from({ length: settings.measures }, (): RhythmMeasure => {
    const events: RhythmEvent[] = [];
    let position = fraction(0), used = 0;
    while (compare(position, policy.length) < 0) {
      const choices = choicesAt(position, used);
      const draw = random();
      if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return a number in [0, 1).');
      const choice = choices[Math.floor(draw * choices.length)]!;
      events.push(structuredClone(choice.event));
      used += Number(syncAt(choice, position));
      position = add(position, duration(choice.event));
    }
    return { meter: policy.meter, events };
  });
  if (settings.ties) {
    const refs = passage.flatMap((bar, measure) => deriveMeasure(bar).events.map(event => ({ measure, event: event.index })));
    const candidates: RhythmMeasure[][] = [];
    for (let start = 0; start < refs.length - 1; start++) for (const size of [2, 3]) {
      const chain = refs.slice(start, start + size);
      if (chain.length !== size || chain.some(r => passage[r.measure]!.events[r.event]![1]?.rest)) continue;
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
