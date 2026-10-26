import { el } from '../../../shared/ui/components.ts';
import type { ChallengeRules } from '../engine/challenge.ts';

export function resultMetric(value: string, label: string, labelFirst = false) {
  const metric = el('p'), number = el('strong','',value), caption = el('span','',label);
  metric.append(...(labelFirst ? [caption,number] : [number,caption]));
  return metric;
}

export function scoreHint(rules?: ChallengeRules) {
  return rules?.goal === 'target' ? 'Time to goal' : rules?.scoring === 'correct' ? 'Correct notes' : 'Points × Accuracy';
}
