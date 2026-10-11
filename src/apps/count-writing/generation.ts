import { derivePassage, duration } from '../../music/measure.ts';
import type { RhythmEvent, RhythmMeasure } from '../../music/measure.ts';
import { add, compare, fraction } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';
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
export interface GenerationSettings { measures: number; ingredients: IngredientId[]; allowUnintuitiveNotation: boolean }
export const defaultGeneration = (): GenerationSettings => ({ measures: 2, ingredients: ingredients.filter(i => i.id !== 'dotted-quarter-rest').map(i => i.id), allowUnintuitiveNotation: false });

function plan(settings: GenerationSettings) {
  if (!Number.isInteger(settings.measures) || settings.measures < 1 || settings.measures > 4) throw new Error('Choose an exercise length from 1 to 4 measures.');
  if (settings.ingredients.some(id => !ingredients.some(i => i.id === id))) throw new Error('Unknown rhythm ingredient.');
  if (!settings.allowUnintuitiveNotation && settings.ingredients.includes('dotted-quarter-rest')) throw new Error('Dotted quarter rests in 4/4 require Allow unintuitive notation. Enable it or uncheck dotted quarter rests.');
  const pool = ingredients.filter(i => settings.ingredients.includes(i.id));
  if (!pool.length) throw new Error('Select at least one rhythm ingredient.');
  const memo = new Map<string, boolean>();
  const barEnd = fraction(1);
  const allowedAt = (ingredient: typeof pool[number], position: Fraction) =>
    compare(add(position, duration(ingredient.event)), barEnd) <= 0 &&
    (settings.allowUnintuitiveNotation || readableRestPlacement(ingredient.event, position));
  function fills(position: Fraction): boolean {
    if (compare(position, barEnd) === 0) return true;
    const key = position.join('/');
    if (!memo.has(key)) memo.set(key, pool.some(i => allowedAt(i, position) && fills(add(position, duration(i.event)))));
    return memo.get(key)!;
  }
  const choicesAt = (position: Fraction) => pool.filter(i => allowedAt(i, position) && fills(add(position, duration(i.event))));
  if (!fills(fraction(0))) throw new Error('These ingredients cannot fill 4/4 with the current notation policy. Add quarters, eighths, or halves. Dotted quarters alone cannot complete a bar.');
  // Check that each selection can actually occur in a complete bar under the position policy.
  const usable = new Set<IngredientId>();
  const visited = new Set<string>();
  function visit(position: Fraction) {
    const key = position.join('/');
    if (visited.has(key)) return;
    visited.add(key);
    for (const ingredient of choicesAt(position)) {
      usable.add(ingredient.id);
      visit(add(position, duration(ingredient.event)));
    }
  }
  visit(fraction(0));
  const unusable = pool.filter(i => !usable.has(i.id));
  if (unusable.length) throw new Error(`${unusable.map(i => i.label).join(', ')} cannot fit a complete bar with this selection and notation policy. Add quarters or eighths, or remove those ingredients.`);
  return { choicesAt };
}
export function generationIssue(settings: GenerationSettings): string | null {
  try { plan(settings); return null; } catch (error) { return (error as Error).message; }
}
/** Randomness is injected for reproducible tests; source time always comes from written events. */
export function generateExercise(settings: GenerationSettings, random = Math.random): RhythmMeasure[] {
  const { choicesAt } = plan(settings);
  const passage = Array.from({ length: settings.measures }, (): RhythmMeasure => {
    const events: RhythmEvent[] = [];
    let position = fraction(0);
    while (compare(position, fraction(1)) < 0) {
      const choices = choicesAt(position);
      const draw = random();
      if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return a number in [0, 1).');
      const choice = choices[Math.floor(draw * choices.length)]!;
      events.push(structuredClone(choice.event));
      position = add(position, duration(choice.event));
    }
    return { meter: [4, 4], events };
  });
  derivePassage(passage);
  return passage;
}
