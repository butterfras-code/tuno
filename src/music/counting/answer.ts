import { immutable } from '../written.ts';
import type { CountingPlan, CountId, UnitId, CountPosition } from './plan.ts';
import { alphabet } from './vocabulary.ts';
import type { CountToken } from './vocabulary.ts';
export interface UnitAnswer { readonly restMarked: boolean; readonly durationIndicated: boolean }
export interface CountingAnswer {
  readonly counts: Readonly<Record<CountId, CountToken>>;
  readonly units: Readonly<Record<UnitId, UnitAnswer>>;
}
export type Verdict = 'correct' | 'incorrect' | 'not-applicable';
export interface FeedbackItem {
  readonly id: CountId | UnitId;
  readonly verdict: Verdict;
  readonly countIds: readonly CountId[];
  readonly symbolIds: readonly string[];
  readonly labels: readonly string[];
}
export interface EvaluationDimension { readonly verdict: Verdict; readonly items: readonly FeedbackItem[] }
export interface CountingEvaluation { readonly tokens: EvaluationDimension; readonly rests: EvaluationDimension; readonly duration: EvaluationDimension }
/** Discard foreign keys and normalize suppressed controls; missing evidence remains blank/false. */
export function normalizeAnswer(plan: CountingPlan, answer: CountingAnswer): CountingAnswer {
  return immutable({
    counts: Object.fromEntries(plan.counts.map(c => {
      const token = answer.counts[c.id] ?? '';
      if (token !== '' && !(alphabet as readonly string[]).includes(token)) throw new Error('Invalid atomic count token.');
      return [c.id, token];
    })),
    units: Object.fromEntries(plan.units.map(u => [u.id, { restMarked: u.restApplicable && answer.units[u.id]?.restMarked === true, durationIndicated: u.durationApplicable && answer.units[u.id]?.durationIndicated === true }])),
  });
}
export const initializeAnswer = (plan: CountingPlan): CountingAnswer => normalizeAnswer(plan, { counts: {}, units: {} });
function target(plan: CountingPlan, countId: CountId): CountPosition {
  const count = plan.counts.find(c => c.id === countId);
  if (!count) throw new Error('Unknown count position.');
  return count;
}
export function enterToken(plan: CountingPlan, answer: CountingAnswer, countId: CountId, token: CountToken | '+'): CountingAnswer {
  target(plan, countId);
  return normalizeAnswer(plan, { ...answer, counts: { ...answer.counts, [countId]: token === '+' ? '&' : token } });
}
export function toggleUnit(plan: CountingPlan, answer: CountingAnswer, countId: CountId, control: keyof UnitAnswer): CountingAnswer {
  if (control !== 'restMarked' && control !== 'durationIndicated') throw new Error('Unknown unit control.');
  const { unitId } = target(plan, countId), current = normalizeAnswer(plan, answer);
  return normalizeAnswer(plan, { ...current, units: { ...current.units, [unitId]: { ...current.units[unitId]!, [control]: !current.units[unitId]![control] } } });
}
function dimension(items: FeedbackItem[]): EvaluationDimension {
  const applicable = items.filter(i => i.verdict !== 'not-applicable');
  return { verdict: !applicable.length ? 'not-applicable' : applicable.some(i => i.verdict === 'incorrect') ? 'incorrect' : 'correct', items };
}
export function evaluateAnswer(plan: CountingPlan, input: CountingAnswer): CountingEvaluation {
  const answer = normalizeAnswer(plan, input);
  const tokens = dimension(plan.counts.map(c => ({ id: c.id, verdict: answer.counts[c.id] === c.expectedToken ? 'correct' : 'incorrect', countIds: [c.id], symbolIds: [c.symbolId], labels: [c.label] })));
  const unitDimension = (control: keyof UnitAnswer) => dimension(plan.units.map(u => {
    const applicable = control === 'restMarked' ? u.restApplicable : u.durationApplicable;
    const expected = control === 'restMarked' ? u.expectedRest : true;
    return { id: u.id, verdict: !applicable ? 'not-applicable' : answer.units[u.id]![control] === expected ? 'correct' : 'incorrect', countIds: u.counts.map(c => c.id), symbolIds: u.symbolIds, labels: u.counts.map(c => c.label) };
  }));
  return immutable({ tokens, rests: unitDimension('restMarked'), duration: unitDimension('durationIndicated') });
}
