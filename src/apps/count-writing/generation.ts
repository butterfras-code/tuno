import { derivePassage, duration } from '../../music/measure.ts';
import type { RhythmEvent, RhythmMeasure } from '../../music/measure.ts';
import { compare, fraction, subtract } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';

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
export interface GenerationSettings { measures: number; ingredients: IngredientId[] }
export const defaultGeneration = (): GenerationSettings => ({ measures: 2, ingredients: ingredients.map(i => i.id) });

function plan(settings: GenerationSettings) {
  if (!Number.isInteger(settings.measures) || settings.measures < 1 || settings.measures > 4) throw new Error('Choose an exercise length from 1 to 4 measures.');
  if (settings.ingredients.some(id => !ingredients.some(i => i.id === id))) throw new Error('Unknown rhythm ingredient.');
  const pool = ingredients.filter(i => settings.ingredients.includes(i.id));
  if (!pool.length) throw new Error('Select at least one rhythm ingredient.');
  const memo = new Map<string, boolean>();
  function fills(remaining: Fraction): boolean {
    if (compare(remaining, fraction(0)) === 0) return true;
    if (compare(remaining, fraction(0)) < 0) return false;
    const key = remaining.join('/');
    if (!memo.has(key)) memo.set(key, pool.some(i => fills(subtract(remaining, duration(i.event)))));
    return memo.get(key)!;
  }
  if (!fills(fraction(1))) throw new Error('These ingredients cannot fill 4/4. Add quarters, eighths, or halves. Dotted quarters alone cannot complete a bar.');
  // An allowed ingredient must be usable somewhere in a completed bar. Never silently discard it.
  const unusable = pool.filter(i => !fills(subtract(fraction(1), duration(i.event))));
  if (unusable.length) throw new Error(`${unusable.map(i => i.label).join(', ')} cannot fit a complete bar with this selection. Add quarters or eighths, or remove those ingredients.`);
  return { pool, fills };
}
export function generationIssue(settings: GenerationSettings): string | null {
  try { plan(settings); return null; } catch (error) { return (error as Error).message; }
}
/** Randomness is injected for reproducible tests; source time always comes from written events. */
export function generateExercise(settings: GenerationSettings, random = Math.random): RhythmMeasure[] {
  const { pool, fills } = plan(settings);
  const passage = Array.from({ length: settings.measures }, (): RhythmMeasure => {
    const events: RhythmEvent[] = [];
    let remaining = fraction(1);
    while (compare(remaining, fraction(0)) > 0) {
      const choices = pool.filter(i => fills(subtract(remaining, duration(i.event))));
      const draw = random();
      if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return a number in [0, 1).');
      const choice = choices[Math.floor(draw * choices.length)]!;
      events.push(structuredClone(choice.event));
      remaining = subtract(remaining, duration(choice.event));
    }
    return { meter: [4, 4], events };
  });
  derivePassage(passage);
  return passage;
}
