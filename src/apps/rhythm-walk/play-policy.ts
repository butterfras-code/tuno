export const playStyles = ['tap', 'hold'] as const;
export type PlayStyle = typeof playStyles[number];
export const playOptions = [
  { value: 'tap', label: 'Tap' },
  { value: 'hold', label: 'Tap + Hold' },
] as const;
export const playInstructions: Record<PlayStyle, string> = {
  tap: 'Tap when each note starts.',
  hold: 'Hold each note for its length. Release for rests.',
};
export interface EvaluationPolicy {
  readonly attackTolerance: number;
  readonly releaseTolerance: number;
  readonly releaseDurationRatio: number;
  readonly articulationRatio: number;
  readonly articulationCeiling: number;
  readonly minimumSustainRatio: number;
}
/** Seconds and duration ratios. Provisional engineering defaults, not teaching thresholds.
 * Association remains the existing wider timing window; release never affects matching. */
export const provisionalEvaluation: Readonly<EvaluationPolicy> = Object.freeze({
  attackTolerance: .08, releaseTolerance: .06, releaseDurationRatio: .1,
  articulationRatio: .15, articulationCeiling: .08, minimumSustainRatio: .7,
});
export function releaseAllowances(duration: number, adjacent: boolean, policy: EvaluationPolicy) {
  const ordinary = Math.min(policy.releaseTolerance, duration * policy.releaseDurationRatio);
  // Replace the ordinary early allowance for adjacency; never add the two allowances.
  const early = adjacent ? Math.min(duration * policy.articulationRatio, policy.articulationCeiling) : ordinary;
  return { early, late: ordinary, minimumSustain: duration * policy.minimumSustainRatio };
}
