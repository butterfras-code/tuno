import type { AttemptRecord } from './capture.ts';
import { capturedHolds } from './evidence.ts';
import { median } from './offset.ts';
import { releaseAllowances, legacyEvaluation } from './play-policy.ts';
import { assessmentPolicy } from './assessment-policy.ts';
import type { AssessmentPolicy } from './assessment-policy.ts';
import { planPassage } from './timing.ts';
import { sourcePolicy } from './shared/meter.ts';

type Pair = [number, number];
type Association = { pairs: Pair[]; cost: number; scale: number };
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export function attackWindows(beat: number, p: AssessmentPolicy = assessmentPolicy) {
  return { full: clamp(beat * p.fullBeatRatio, p.fullMinimum, p.fullMaximum), zero: clamp(beat * p.zeroBeatRatio, p.zeroMinimum, p.zeroMaximum) };
}
export function attackCredit(error: number, beat: number, p: AssessmentPolicy = assessmentPolicy) {
  const { full, zero } = attackWindows(beat, p);
  return clamp((zero - Math.abs(error)) / (zero - full), 0, 1);
}
/** Ordered edit alignment. A gap costs 1; matching costs normalized absolute error.
 * Keep two distinct paths when checking ambiguity (including same-tempo ambiguity). */
function associate(expected: number[], actual: number[], scale: number, beat: number, p: AssessmentPolicy, alternatives = false): Association[] {
  const window = attackWindows(beat * scale, p).zero;
  type Path = { pairs: Pair[]; cost: number };
  const table: Path[][][] = Array.from({ length: expected.length + 1 }, () => Array.from({ length: actual.length + 1 }, () => []));
  table[0]![0] = [{ pairs: [], cost: 0 }];
  for (let i = 0; i <= expected.length; i++) for (let j = 0; j <= actual.length; j++) {
    if (!i && !j) continue;
    const paths: Path[] = [];
    if (i) table[i - 1]![j]!.forEach(a => paths.push({ pairs: a.pairs, cost: a.cost + 1 }));
    if (j) table[i]![j - 1]!.forEach(a => paths.push({ pairs: a.pairs, cost: a.cost + 1 }));
    if (i && j) {
      const error = Math.abs(actual[j - 1]! - expected[i - 1]! * scale);
      if (error <= window * p.associationWindowRatio + 1e-9) table[i - 1]![j - 1]!.forEach(a => paths.push({ pairs: [...a.pairs, [i - 1, j - 1]], cost: a.cost + error / window }));
    }
    paths.sort((a, b) => a.cost - b.cost || b.pairs.length - a.pairs.length);
    const unique = paths.filter((a, index) => !paths.slice(0, index).some(b => JSON.stringify(a.pairs) === JSON.stringify(b.pairs)));
    table[i]![j] = unique.slice(0, alternatives ? 2 : 1);
  }
  return table[expected.length]![actual.length]!.map(a => ({ ...a, scale }));
}
/** No intercept: robust median of observed-time / score-time ratios, then reassociate.
 * Search is bounded and independent of the target-relative review matcher. */
function fit(expected: number[], actual: number[], beat: number, p: AssessmentPolicy) {
  const scales = new Set<number>([1]);
  for (let i = 0; i <= p.searchSteps; i++) scales.add(p.minimumScale + (p.maximumScale - p.minimumScale) * i / p.searchSteps);
  for (const e of expected) if (e > 0) for (const a of actual) {
    const scale = a / e;
    if (scale >= p.minimumScale && scale <= p.maximumScale) scales.add(Math.round(scale * 1000) / 1000);
  }
  const candidates: Association[] = [];
  for (const initial of scales) {
    let candidate = associate(expected, actual, initial, beat, p)[0]!;
    for (let iteration = 0; iteration < 2; iteration++) {
      const ratios = candidate.pairs.filter(([e]) => expected[e]! > 0).map(([e, a]) => actual[a]! / expected[e]!);
      if (!ratios.length) break;
      const scale = clamp(median(ratios), p.minimumScale, p.maximumScale);
      candidate = associate(expected, actual, scale, beat, p)[0]!;
    }
    candidates.push(candidate);
  }
  candidates.sort((a, b) => a.cost - b.cost || b.pairs.length - a.pairs.length || Math.abs(a.scale - 1) - Math.abs(b.scale - 1));
  const best = candidates[0]!;
  candidates.push(...associate(expected, actual, best.scale, beat, p, true));
  const margin = Math.max(p.ambiguityCost, p.ambiguityCostPerAttack * Math.max(expected.length, actual.length));
  const ambiguous = candidates.some(c => c.cost <= best.cost + margin && JSON.stringify(c.pairs) !== JSON.stringify(best.pairs));
  return { best, ambiguous, margin };
}

/** Pure assessment from canonical music and captured evidence. Does not mutate timelines,
 * raw events, calibration or target-relative review. Replaying uses the attempt policy. */
export function assessAttempt(record: AttemptRecord) {
  const policy = record.assessmentPolicy ?? assessmentPolicy;
  const target = planPassage(record.exercise.measures, record.bpm, record.policy, sourcePolicy(record.exercise.measures[0]!).pulse);
  const holds = capturedHolds(record).filter(h => !h.countIn);
  const expected = target.notes.map(n => n.start), actual = holds.map(h => h.down);
  const base = { version: 1 as const, policy, targetBpm: record.bpm, expectedAttacks: expected.length, capturedAttacks: actual.length };
  const unavailable = (reason: string) => ({ ...base, basis: 'unavailable' as const, rhythm: null, hold: null, tempo: null, steadiness: null, reason, tempoReason: reason, steadinessReason: reason, holdReason: reason, matchedNotes: 0, missing: null, extra: null, matches: [] as { expected: number; actual: number; error: number; credit: number; holdCredit: number | null }[], usableIntervals: 0, intervalSpan: 0, performedBeat: null as number | null, residualMedian: null as number | null });
  if (expected.length > policy.maximumExpectedAttacks || actual.length > policy.maximumCapturedAttacks) return unavailable('Too much input for a reliable bounded assessment. Raw evidence is retained.');
  if (record.status !== 'completed') return unavailable('Interrupted attempts are not graded.');
  if (!expected.length) return unavailable(actual.length ? 'Rest exercise: attacks were received during silence. Review the rest evidence.' : 'Rest exercise: no attacks received. Review the rest evidence.');
  const { best, ambiguous } = fit(expected, actual, target.pulseSeconds, policy);
  const pairs = best.pairs;
  const span = pairs.length > 1 ? (expected[pairs.at(-1)![0]]! - expected[pairs[0]![0]]!) / target.pulseSeconds : 0;
  if (ambiguous && Math.min(expected.length, actual.length) >= policy.minimumTempoAttacks && span >= policy.minimumTempoSpan) return unavailable('Several timing interpretations fit similarly. Rhythm accuracy is unavailable.');
  const residualMedian = pairs.length ? median(pairs.map(([e, a]) => Math.abs(actual[a]! - expected[e]! * best.scale))) : null;
  const confident = pairs.length >= policy.minimumTempoAttacks && span >= policy.minimumTempoSpan - 1e-9 && residualMedian! <= target.pulseSeconds * best.scale * policy.maximumMedianResidualBeats;
  // Only sparse evidence receives a labeled target-tempo fallback. Dense incoherent
  // evidence cannot earn a relative-pattern percentage by silently choosing target.
  const sparse = Math.min(expected.length, actual.length) < policy.minimumTempoAttacks || span < policy.minimumTempoSpan;
  if (!confident && !sparse && actual.length && pairs.length) return unavailable('Timing does not establish a consistent tempo. Rhythm accuracy is unavailable.');
  const basis = confident ? 'performed' as const : 'target' as const;
  const scale = confident ? best.scale : 1;
  const chosen = confident ? best : associate(expected, actual, 1, target.pulseSeconds, policy, true)[0]!;
  if (!confident && actual.length) {
    const alternatives = associate(expected, actual, 1, target.pulseSeconds, policy, true);
    if (alternatives[1] && alternatives[1].cost <= chosen.cost + policy.ambiguityCost && JSON.stringify(alternatives[1].pairs) !== JSON.stringify(chosen.pairs)) return unavailable('Several target-time associations fit similarly. Rhythm accuracy is unavailable.');
  }
  const beat = target.pulseSeconds * scale;
  const holdStyle = (record.playStyle ?? 'hold') === 'hold';
  const matches = chosen.pairs.map(([e, a]) => {
    const note = target.notes[e]!, h = holds[a]!;
    const duration = (note.end - note.start) * scale;
    const adjacent = Math.abs((target.notes[e + 1]?.start ?? Infinity) - note.end) < 1e-9;
    const allowance = releaseAllowances(duration, adjacent, record.evaluationPolicy ?? legacyEvaluation, (note.finalSegmentDuration ?? note.end - note.start) * scale);
    let holdCredit: number | null = null;
    if (holdStyle) {
      if (h.up === null) holdCredit = 0;
      else {
        const release = h.up - note.end * scale;
        const excess = Math.max(0, -release - allowance.early, release - allowance.late);
        const releaseCredit = clamp(1 - excess / Math.min(duration * policy.holdErrorRatio, policy.holdErrorMaximum), 0, 1);
        // Sustain cap: proportional credit below the meaningful-sustain minimum.
        holdCredit = Math.min(releaseCredit, clamp((h.up - h.down) / allowance.minimumSustain, 0, 1));
      }
    }
    const error = h.down - note.start * scale;
    return { expected: e, actual: a, error, credit: attackCredit(error, beat, policy), holdCredit };
  });
  const extra = actual.length - matches.length;
  const rhythm = 100 * matches.reduce((sum, m) => sum + m.credit, 0) / (expected.length + extra);
  const hold = holdStyle && matches.length ? 100 * matches.reduce((sum, m) => sum + m.holdCredit!, 0) / matches.length : null;
  const tempo = confident ? { bpm: record.bpm / scale, differencePercent: 100 * (1 / scale - 1) } : null;
  const intervals: { duration: number; beats: number }[] = [];
  if (confident) for (let i = 1; i < matches.length; i++) {
    const previous = matches[i - 1]!, current = matches[i]!;
    if (current.expected !== previous.expected + 1 || current.actual !== previous.actual + 1) continue;
    const beats = (expected[current.expected]! - expected[previous.expected]!) / target.pulseSeconds;
    const elapsed = actual[current.actual]! - actual[previous.actual]!;
    if (beats > 0 && elapsed > 0) intervals.push({ duration: elapsed / beats, beats });
  }
  const intervalSpan = intervals.reduce((sum, i) => sum + i.beats, 0);
  let steadiness: number | null = null;
  if (intervals.length >= policy.minimumIntervals && intervalSpan >= policy.minimumIntervalSpan - 1e-9) {
    const typical = median(intervals.map(i => i.duration));
    const sorted = intervals.map(i => i.duration).sort((a, b) => a - b);
    const quantile = (q: number) => { const index = (sorted.length - 1) * q; const lo = Math.floor(index); return sorted[lo]! + (sorted[Math.ceil(index)]! - sorted[lo]!) * (index - lo); };
    // IQR guards against MAD collapsing to zero for alternating repeated values
    // when the interval count is odd. Both are robust normal-scale estimates.
    const spread = Math.max(1.4826 * median(intervals.map(i => Math.abs(i.duration - typical))), (quantile(.75) - quantile(.25)) / 1.349);
    steadiness = 100 * spread / typical;
  }
  return { ...base, basis, rhythm, hold, tempo, steadiness, reason: confident ? null : actual.length ? 'Not enough evidence for performed tempo; rhythm uses target tempo.' : 'No attacks received.', tempoReason: tempo ? null : 'Not enough evidence: need four matched attacks spanning three performance beats with a clear tempo fit.', steadinessReason: steadiness === null ? 'Not enough evidence: need a clear tempo and four uninterrupted intervals spanning four performance beats.' : null, holdReason: hold === null ? 'No matched played notes.' : null, matchedNotes: matches.length, missing: expected.length - matches.length, extra, matches, usableIntervals: intervals.length, intervalSpan, performedBeat: confident ? beat : null, residualMedian };
}
export type Assessment = ReturnType<typeof assessAttempt>;
