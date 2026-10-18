import type { CountingAnswer, CountingEvaluation, FeedbackItem } from '../../music/counting/answer.ts';
import type { CountingPlan, CountId, UnitId } from '../../music/counting/plan.ts';
import { rewardPolicy, type Bones } from './rewards.ts';

export const countingDimensions = ['tokens', 'rests', 'duration'] as const;
export type CountingDimension = typeof countingDimensions[number];
/** Each evaluator item is one point; a tied unit is never counted per bar. */
export function countingScore(result: CountingEvaluation) {
  const points = countingDimensions.flatMap(d => result[d].items.filter(i => i.verdict !== 'not-applicable'));
  const total = points.length, correct = points.filter(i => i.verdict === 'correct').length;
  const percent = total ? correct / total * 100 : null;
  const tier = percent === null ? -1 : rewardPolicy.rhythm.findIndex(boundary => percent >= boundary);
  return { correct, total, percent, bones: percent === null ? null : (tier < 0 ? 1 : 5 - tier) as Bones };
}
export function pointChanged(dimension: CountingDimension, item: FeedbackItem, checked: CountingAnswer, current: CountingAnswer) {
  return dimension === 'tokens' ? checked.counts[item.id as CountId] !== current.counts[item.id as CountId]
    : checked.units[item.id as UnitId]?.[dimension === 'rests' ? 'restMarked' : 'durationIndicated'] !== current.units[item.id as UnitId]?.[dimension === 'rests' ? 'restMarked' : 'durationIndicated'];
}
export function countingProblems(plan: CountingPlan, result: CountingEvaluation | null, checked: CountingAnswer | null, current: CountingAnswer) {
  if (!result || !checked) return [];
  return countingDimensions.flatMap(dimension => result[dimension].items.flatMap(item => {
    if (item.verdict === 'not-applicable') return [];
    const edited = pointChanged(dimension, item, checked, current);
    if (item.verdict === 'correct' && !edited) return [];
    const unit = plan.units.find(u => u.id === item.id);
    const missing = dimension === 'tokens' ? !checked.counts[item.id as CountId]
      : dimension === 'duration' || unit?.expectedRest;
    const state = edited ? 'edited' : missing ? 'missing' : 'incorrect';
    const name = dimension === 'tokens' ? 'Count' : dimension === 'rests' ? 'Rest' : 'Duration';
    const message = edited ? `${name}: edited, awaiting check.` : dimension === 'tokens'
      ? missing ? 'Add a count at this position.' : 'Check the count at this position.'
      : dimension === 'rests' ? 'Review the rest marking for this group.'
      : unit && unit.symbolIds.length > 1 ? 'Review the duration of this tied note.' : 'Review the duration indication for this group.';
    return [{ dimension, item, state, name, message }];
  }));
}
export interface CountingFeedbackContext {
  plan: CountingPlan; answer: CountingAnswer; checked: CountingAnswer | null; result: CountingEvaluation | null;
  mode: 'write' | 'tap' | 'both'; navigate: (id: CountId) => void;
}
