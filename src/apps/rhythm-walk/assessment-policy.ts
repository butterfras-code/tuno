/** Versioned initial tuning defaults, not mastery standards. Times are seconds. */
export const assessmentPolicy = Object.freeze({
  version: 1 as const,
  maximumExpectedAttacks: 128, maximumCapturedAttacks: 256,
  minimumScale: 2 / 3, maximumScale: 1.5, searchSteps: 120,
  fullBeatRatio: .1, fullMinimum: .03, fullMaximum: .06,
  zeroBeatRatio: .3, zeroMinimum: .09, zeroMaximum: .18,
  associationWindowRatio: 1.5, ambiguityCost: .12, ambiguityCostPerAttack: .02,
  minimumTempoAttacks: 4, minimumTempoSpan: 3, maximumMedianResidualBeats: .15,
  minimumIntervals: 4, minimumIntervalSpan: 4,
  holdErrorRatio: .25, holdErrorMaximum: .2,
  onTargetPercent: 5, slightTempoPercent: 10, steadyPercent: 5, mostlySteadyPercent: 10,
});
export type AssessmentPolicy = { readonly [K in keyof typeof assessmentPolicy]: K extends 'version' ? 1 : number };
