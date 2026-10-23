import type { RhythmEvent, RhythmMeasure } from '../../../music/measure.ts';
import { duration, score, note } from '../../../music/measure.ts';
import { add, compare, divide, fraction } from '../../../music/fraction.ts';
import type { Fraction } from '../../../music/fraction.ts';
import { meterPolicy } from './meter.ts';
import type { CountMeter } from './meter.ts';

export type InstrumentScope = 'general' | 'percussion';
export interface FigureProfile { version: 1; level: number; scope: InstrumentScope }
const events = {
  Q: [note('quarter')], H: [note('half')], 'H.': [note('half', { dots: 1 })], W: [note('whole')],
  EE: [note('eighth'), note('eighth')], 'Q.E': [note('quarter', { dots: 1 }), note('eighth')],
  EQE: [note('eighth'), note('quarter'), note('eighth')], 'E.S': [note('eighth', { dots: 1 }), note('16th')],
  ESS: [note('eighth'), note('16th'), note('16th')], SSSS: Array.from({ length: 4 }, () => note('16th')),
} satisfies Record<string, RhythmEvent[]>;
export type FigureId = keyof typeof events;
export const rhythmFigures = Object.fromEntries(Object.entries(events).map(([id, written]) => [id, {
  id: id as FigureId, events: written as readonly RhythmEvent[],
  duration: written.reduce((sum, event) => add(sum, duration(event as RhythmEvent)), fraction(0)),
}])) as Record<FigureId, { id: FigureId; events: readonly RhythmEvent[]; duration: Fraction }>;
export function profileFigures(profile: FigureProfile): FigureId[] {
  if (profile.version !== 1 || !Number.isInteger(profile.level) || profile.level < 1 || profile.level > 4 || !['general', 'percussion'].includes(profile.scope)) throw new Error('Invalid UIL figure profile.');
  return ['Q', 'H', 'H.', 'W', 'EE', ...(profile.level >= 3 ? ['Q.E'] : []),
    ...(profile.level >= 4 ? ['EQE', 'E.S', 'ESS', 'SSSS'] : profile.scope === 'percussion' ? ['ESS', 'SSSS', ...(profile.level === 3 ? ['E.S'] : [])] : [])] as FigureId[];
}
/** Conservative teaching placements, separate from the source's figure inventory. */
export function figureAllowedAt(id: FigureId, meter: CountMeter, position: Fraction): boolean {
  const p = meterPolicy(meter);
  if (compare(add(position, rhythmFigures[id].duration), p.length) > 0) return false;
  if (p.compound) return false;
  return divide(position, fraction(1, 4))[1] === 1;
}
export function figurePlan(profile: FigureProfile, meter: CountMeter) {
  const pool = profileFigures(profile).map(id => rhythmFigures[id]);
  if (profile.level < 3 && meter !== '4/4' || meter === '6/8') throw new Error(`Meter ${meter} is outside this UIL profile. Customize to use another meter.`);
  const policy = meterPolicy(meter), memo = new Map<string, boolean>();
  function fills(position: Fraction): boolean {
    if (!compare(position, policy.length)) return true;
    const key = position.join('/');
    if (!memo.has(key)) memo.set(key, pool.some(f => figureAllowedAt(f.id, meter, position) && fills(add(position, f.duration))));
    return memo.get(key)!;
  }
  const choicesAt = (position: Fraction) => pool.filter(f => figureAllowedAt(f.id, meter, position) && fills(add(position, f.duration)));
  if (!fills(fraction(0))) throw new Error(`UIL figures cannot fill ${meter}.`);
  return { choicesAt, policy };
}
/** Reachable repertoire uses exactly the complete-bar planner's placement rules. */
export function eligibleFigures(profile: FigureProfile, meter: CountMeter): FigureId[] {
  const plan = figurePlan(profile, meter), visited = new Set<string>(), found = new Set<FigureId>();
  function visit(position: Fraction) {
    const key = position.join('/'); if (visited.has(key)) return; visited.add(key);
    for (const choice of plan.choicesAt(position)) { found.add(choice.id); visit(add(position, choice.duration)); }
  }
  visit(fraction(0)); return [...found];
}
export function drawIndex(length: number, random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Random source must return a number in [0, 1).');
  return Math.floor(value * length);
}
export function generateFigures(profile: FigureProfile, pool: CountMeter[], measures: number, random: () => number) {
  const plans = new Map(pool.map(m => [m, figurePlan(profile, m)]));
  const meter = pool[pool.length === 1 ? 0 : drawIndex(pool.length, random)]!;
  const passage = Array.from({ length: measures }, (): RhythmMeasure => {
    const plan = plans.get(meter)!, written: RhythmEvent[] = [];
    for (let position = fraction(0); compare(position, plan.policy.length) < 0;) {
      const choices = plan.choicesAt(position), choice = choices[drawIndex(choices.length, random)]!;
      written.push(...structuredClone(choice.events)); position = add(position, choice.duration);
    }
    return { meter: plan.policy.meter, notes: written };
  });
  return score(passage);
}
