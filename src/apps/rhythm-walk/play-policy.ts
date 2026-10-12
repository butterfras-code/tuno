export const playStyles = ['tap', 'hold'] as const;
export type PlayStyle = typeof playStyles[number];
export const playOptions = [
  { value: 'tap', label: 'Tap' },
  { value: 'hold', label: 'Tap + Hold' },
] as const;
export const playInstructions: Record<PlayStyle, string> = {
  tap: 'Tap when each note starts.',
  hold: 'Hold each note for its length. Lift briefly between separate notes; hold through ties. Release for rests.',
};
export interface EvaluationPolicy {
  readonly version?: 1 | 2;
  readonly attackTolerance: number;
  readonly releaseTolerance: number;
  readonly releaseDurationRatio: number;
  readonly articulationRatio: number;
  readonly articulationCeiling: number;
  readonly minimumSustainRatio: number;
}
/** Seconds and duration ratios. Provisional engineering defaults, not teaching thresholds.
 * Association remains the existing wider timing window; release never affects matching. */
export const legacyEvaluation: Readonly<EvaluationPolicy> = Object.freeze({
  version: 1,
  attackTolerance: .08, releaseTolerance: .06, releaseDurationRatio: .1,
  articulationRatio: .15, articulationCeiling: .08, minimumSustainRatio: .7,
});
/** Current lift allowance. Old records use their snapshot or the v1 fallback. */
export const provisionalEvaluation: Readonly<EvaluationPolicy> = Object.freeze({
  ...legacyEvaluation, version: 2, articulationRatio: .25, articulationCeiling: .18,
});
export function releaseAllowances(duration: number, adjacent: boolean, policy: EvaluationPolicy, finalSegmentDuration = duration) {
  const ordinary = Math.min(policy.releaseTolerance, duration * policy.releaseDurationRatio);
  // V2 also retains the final written segment of a tie: the lift band must not
  // reach an internal tie boundary. V1 snapshots keep their original allowance.
  // Replace the ordinary early allowance for adjacency; never add the two allowances.
  const early = adjacent ? Math.min(duration * policy.articulationRatio, policy.articulationCeiling, policy.version === 2 ? finalSegmentDuration * policy.articulationRatio : Infinity) : ordinary;
  return { early, late: ordinary, minimumSustain: duration * policy.minimumSustainRatio };
}
