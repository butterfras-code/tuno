import { assessLegacyAttempt } from './legacy-assessment.ts';
import type { AttemptRecord } from './capture.ts';
import { capturedHolds } from './evidence.ts';
import { median } from './offset.ts';
import { assessmentPolicy, holdPolicy, legacyHoldPolicy } from './assessment-policy.ts';
import type { AssessmentPolicy } from './assessment-policy.ts';
import { duration as writtenDuration } from '../../music/measure.ts';
import { planPassage, musicalSeconds } from './timing.ts';
import { sourcePolicy } from './shared/meter.ts';

type TempoFit = { scale: number; displacement: number; displacementBound: number; matched: number; span: number; medianResidual: number | null; ambiguous: boolean; withinBounds: boolean };
type RestIntrusion = { rest: number; actual: number; hold: number; seconds: number; credit: number; attack: boolean };
type Pair = [number, number];
type Association = { pairs: Pair[]; cost: number; scale: number; displacement: number };
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
function associate(expected: number[], actual: number[], scale: number, beat: number, p: AssessmentPolicy, alternatives = false, displacement = 0): Association[] {
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
      const error = Math.abs(actual[j - 1]! - expected[i - 1]! * scale - displacement);
      if (error <= window * p.associationWindowRatio + 1e-9) table[i - 1]![j - 1]!.forEach(a => paths.push({ pairs: [...a.pairs, [i - 1, j - 1]], cost: a.cost + error / window }));
    }
    paths.sort((a, b) => a.cost - b.cost || b.pairs.length - a.pairs.length);
    if (!alternatives) { table[i]![j] = paths.slice(0,1); continue; }
    const unique = paths.filter((a, index) => !paths.slice(0, index).some(b => JSON.stringify(a.pairs) === JSON.stringify(b.pairs)));
    table[i]![j] = unique.slice(0, alternatives ? 2 : 1);
  }
  return table[expected.length]![actual.length]!.map(a => ({ ...a, scale, displacement }));
}
/** Bounded affine fit. Pairwise slopes use musical spacing, including rests.
 * Displacement is analytical evidence only, never a correction to received input. */
function fit(expected: number[], actual: number[], beat: number, p: AssessmentPolicy) {
  const candidates: Association[] = [];
  const bound = Math.min(p.displacementMaximum ?? .150, beat * (p.displacementBeatRatio ?? .30));
  for (let i = 0; i <= p.searchSteps; i++) {
    const initial = p.minimumScale + (p.maximumScale - p.minimumScale) * i / p.searchSteps;
    for (const seed of [-bound, 0, bound]) {
      let c = associate(expected, actual, initial, beat, p, false, seed)[0]!;
      for (let iteration = 0; iteration < 3; iteration++) {
        const slopes: number[] = [];
        for (let x = 0; x < c.pairs.length; x++) for (let y = x + 1; y < c.pairs.length; y++) {
          const [e1,a1] = c.pairs[x]!, [e2,a2] = c.pairs[y]!;
          if (expected[e2]! > expected[e1]!) slopes.push((actual[a2]! - actual[a1]!) / (expected[e2]! - expected[e1]!));
        }
        if (!slopes.length) break;
        const scale = clamp(median(slopes), p.minimumScale, p.maximumScale);
        const displacement = clamp(median(c.pairs.map(([e,a]) => actual[a]! - expected[e]! * scale)), -bound, bound);
        c = associate(expected, actual, scale, beat, p, false, displacement)[0]!;
      }
      candidates.push(c);
    }
  }
  candidates.sort((a,b) => a.cost-b.cost || b.pairs.length-a.pairs.length || Math.abs(a.scale-1)-Math.abs(b.scale-1) || Math.abs(a.displacement)-Math.abs(b.displacement));
  const best = candidates[0]!;
  candidates.push(...associate(expected, actual, best.scale, beat, p, true, best.displacement));
  const margin = Math.max(p.ambiguityCost, p.ambiguityCostPerAttack * Math.max(expected.length, actual.length));
  return { best, ambiguous: candidates.some(c => c.cost <= best.cost + margin && JSON.stringify(c.pairs) !== JSON.stringify(best.pairs)), margin };
}
export function sustainEvidence(duration: number, elapsed: number | null, adjacent: boolean, finalMember: number, p = holdPolicy, precedingMember = duration - finalMember) {
  const threshold = p.version === 4 ? p.holdThresholdSeconds ?? .400 : 0;
  // The tiny epsilon only absorbs floating-point conversion at an exact boundary.
  const eligible = duration + 1e-9 >= threshold;
  const waivedFinalDuration = eligible && finalMember + 1e-9 < duration && finalMember + 1e-9 < threshold ? finalMember : 0;
  const assessedDuration = duration - waivedFinalDuration;
  // Remove only the final member. The preceding member keeps its normal sustain
  // requirement, even if it too is short; never recursively waive a tied tail.
  const requiredFinalMember = waivedFinalDuration ? precedingMember : finalMember;
  const ratio = adjacent ? p.adjacentRatio : p.restFinalRatio;
  const finalMinimum = Math.max(requiredFinalMember * p.minimumRatio, requiredFinalMember * ratio - p.shortAllowance, Math.min(p.minimumSeconds, requiredFinalMember));
  const minimum = Math.min(assessedDuration, Math.max(p.minimumSeconds, assessedDuration * p.minimumRatio, assessedDuration * ratio - p.shortAllowance,
    assessedDuration - requiredFinalMember + finalMinimum));
  // Optional sustain still belongs to the written sound. Neither its endpoint nor
  // the overhold/rest boundary moves earlier when the final member is waived.
  const maximum = duration + Math.min(p.overholdMaximum, duration * p.overholdRatio);
  const credit = elapsed === null ? 0 : elapsed < minimum ? Math.max(0, 1 - (minimum - elapsed) / (minimum * p.shortPenaltyRatio))
    : elapsed > maximum ? Math.max(0, 1 - (elapsed - maximum) / (duration * p.longPenaltyRatio)) : 1;
  const finalCredit = elapsed === null ? 0 : clamp((elapsed - (assessedDuration-requiredFinalMember)) / finalMinimum, 0, 1);
  return { elapsed, expectedDuration: duration, eligible, assessedDuration, waivedFinalDuration, minimum, maximum, finalMember, credit: eligible ? Math.min(credit, finalCredit) : null };
}

/** Pure assessment from canonical music and captured evidence. Does not mutate timelines,
 * raw events, calibration or target-relative review. Replaying uses the attempt policy. */
export function assessAttempt(record: AttemptRecord) {
  if ((record.assessmentPolicy?.version ?? 1) === 1) {
    const legacy = assessLegacyAttempt(record);
    return { ...legacy, startingDisplacement: null, tempoFit: null as TempoFit | null, holdPolicy: null, restIntrusions: [] as RestIntrusion[],
      matches: legacy.matches.map(m => ({ ...m, duration: null as ReturnType<typeof sustainEvidence> | null })) };
  }
  const policy = record.assessmentPolicy ?? assessmentPolicy;
  const hp = record.holdPolicy ?? legacyHoldPolicy;
  const target = planPassage(record.exercise.measures, record.bpm, record.policy, sourcePolicy(record.exercise.measures[0]!).pulse);
  const allHolds = capturedHolds(record);
  const holds = allHolds.filter(h => !h.countIn);
  const expected = target.notes.map(n => n.start), actual = holds.map(h => h.down);
  const base = { version: 2 as const, policy, holdPolicy: hp, tempoFit: null as TempoFit | null, startingDisplacement: null as number | null, restIntrusions: [] as RestIntrusion[], targetBpm: record.bpm, expectedAttacks: expected.length, capturedAttacks: actual.length };
  const unavailable = (reason: string) => ({ ...base, basis: 'unavailable' as const, rhythm: null, hold: null, tempo: null, steadiness: null, reason, tempoReason: reason, steadinessReason: reason, holdReason: reason, matchedNotes: 0, missing: null, extra: null, matches: [] as { expected: number; actual: number; error: number; credit: number; holdCredit: number | null; duration: ReturnType<typeof sustainEvidence> | null }[], usableIntervals: 0, intervalSpan: 0, performedBeat: null as number | null, residualMedian: null as number | null });
  if (expected.length > policy.maximumExpectedAttacks || actual.length > policy.maximumCapturedAttacks) return unavailable('Too much input for a reliable bounded assessment. Raw evidence is retained.');
  if (record.status !== 'completed') return unavailable('Interrupted attempts are not graded.');
  if (!expected.length) {
    const result = unavailable(actual.length ? 'Rest exercise: attacks were received during silence. Review the rest evidence.' : 'Rest exercise: no attacks received. Review the rest evidence.');
    result.restIntrusions = target.rests.flatMap((r,rest)=>allHolds.flatMap((h,hold)=>{
      const seconds=Math.max(0,Math.min(r.end,h.up ?? record.endedAt-h.correction)-Math.max(r.start,h.down));
      return seconds>0 ? [{rest,actual:holds.indexOf(h),hold,seconds,credit:0,attack:!h.countIn && h.down>=r.start && h.down<r.end}] : [];
    }));
    return result;
  }
  const { best, ambiguous } = fit(expected, actual, target.pulseSeconds, policy);
  const pairs = best.pairs;
  const span = pairs.length > 1 ? (expected[pairs.at(-1)![0]]! - expected[pairs[0]![0]]!) / target.pulseSeconds : 0;
  const residualMedian = pairs.length ? median(pairs.map(([e, a]) => Math.abs(actual[a]! - expected[e]! * best.scale - best.displacement))) : null;
  const slopes: number[] = [];
  for (let i=0;i<pairs.length;i++) for (let j=i+1;j<pairs.length;j++) {
    const [e1,a1]=pairs[i]!,[e2,a2]=pairs[j]!;
    slopes.push((actual[a2]!-actual[a1]!)/(expected[e2]!-expected[e1]!));
  }
  const rawScale = slopes.length ? median(slopes) : best.scale;
  const bound = Math.min(policy.displacementMaximum ?? .150, target.pulseSeconds*(policy.displacementBeatRatio ?? .30));
  const rawDisplacement = pairs.length ? median(pairs.map(([e,a])=>actual[a]!-expected[e]!*best.scale)) : 0;
  const withinBounds = rawScale>=policy.minimumScale-1e-9 && rawScale<=policy.maximumScale+1e-9 && Math.abs(rawDisplacement)<=bound+1e-9;
  base.tempoFit = {scale:best.scale, displacement:best.displacement, displacementBound:bound, matched:pairs.length, span, medianResidual:residualMedian, ambiguous, withinBounds};
  if (ambiguous && Math.min(expected.length, actual.length) >= policy.minimumTempoAttacks && span >= policy.minimumTempoSpan) return unavailable('Several timing interpretations fit similarly. Rhythm accuracy is unavailable.');
  const confident = withinBounds && !ambiguous && pairs.length >= policy.minimumTempoAttacks && span >= policy.minimumTempoSpan - 1e-9 && residualMedian! <= target.pulseSeconds * best.scale * policy.maximumMedianResidualBeats;
  // Only sparse evidence receives a labeled target-tempo fallback. Dense incoherent
  // evidence cannot earn a relative-pattern percentage by silently choosing target.
  const sparse = Math.min(expected.length, actual.length) < policy.minimumTempoAttacks || span < policy.minimumTempoSpan;
  if (!confident && !sparse && actual.length && pairs.length) return unavailable(withinBounds ? 'Timing does not establish a consistent tempo. Rhythm accuracy is unavailable.' : 'Timing lies outside the bounded tempo or starting displacement fit. Rhythm accuracy is unavailable.');
  const basis = confident ? 'performed' as const : 'target' as const;
  const scale = confident ? best.scale : 1;
  const chosen = confident ? best : associate(expected, actual, 1, target.pulseSeconds, policy, true)[0]!;
  if (!confident && actual.length) {
    const alternatives = associate(expected, actual, 1, target.pulseSeconds, policy, true);
    if (alternatives[1] && alternatives[1].cost <= chosen.cost + policy.ambiguityCost && JSON.stringify(alternatives[1].pairs) !== JSON.stringify(chosen.pairs)) return unavailable('Several target-time associations fit similarly. Rhythm accuracy is unavailable.');
  }
  const beat = target.pulseSeconds * scale;
  const displacement = confident ? best.displacement : 0;
  const restIntrusions = target.rests.flatMap((r,rest) => allHolds.flatMap((h,hold) => {
    const actual = holds.indexOf(h);
    const start = displacement + r.start * scale, end = displacement + r.end * scale;
    const seconds = Math.max(0, Math.min(end, h.up ?? record.endedAt - h.correction) - Math.max(start,h.down));
    const allowance = Math.min(hp.restAllowanceMaximum, (end-start)*hp.restAllowanceRatio);
    const match = chosen.pairs.find(([,a]) => a === actual);
    if (match && Math.abs(target.notes[match[0]]!.start-r.end)<1e-9 && attackCredit(h.down-end,beat,policy) >= 1-1e-9) return [];
    const extraRestAttack = actual >= 0 && !match && h.down >= start && h.down < end;
    return seconds > allowance + 1e-9 || extraRestAttack ? [{rest,actual,hold,seconds,attack:extraRestAttack,credit:clamp(1-(seconds-allowance)/((end-start)*hp.restPenaltyRatio),0,1)}] : [];
  }));
  const holdStyle = (record.playStyle ?? 'hold') === 'hold';
  const matches = chosen.pairs.map(([e, a]) => {
    const note = target.notes[e]!, h = holds[a]!;
    const duration = (note.end - note.start) * scale;
    const adjacent = Math.abs((target.notes[e + 1]?.start ?? Infinity) - note.end) < 1e-9;
    const preceding = note.sources.at(-2);
    const precedingMember = preceding ? musicalSeconds(writtenDuration(record.exercise.measures[preceding.measure]!.events[preceding.event]!), record.bpm, sourcePolicy(record.exercise.measures[0]!).pulse) * scale : 0;
    const durationEvidence = holdStyle ? sustainEvidence(duration, h.up === null ? null : h.up-h.down, adjacent, (note.finalSegmentDuration ?? note.end-note.start)*scale, hp, precedingMember) : null;
    // One hold credit: use the strongest duration/rest issue, never add penalties.
    const holdCredit = durationEvidence?.credit != null ? Math.min(durationEvidence.credit, ...restIntrusions.filter(r=>r.actual===a).map(r=>r.credit)) : null;
    const error = h.down - note.start * scale - displacement;
    return { expected: e, actual: a, error, credit: attackCredit(error, beat, policy), holdCredit, duration: durationEvidence };
  });
  const extra = actual.length - matches.length;
  const rhythm = 100 * matches.reduce((sum, m) => sum + m.credit, 0) / (expected.length + extra);
  const gradedHolds = matches.filter(m => m.holdCredit !== null);
  const hold = gradedHolds.length ? 100 * gradedHolds.reduce((sum, m) => sum + m.holdCredit!, 0) / gradedHolds.length : null;
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
  const holdReason = hold !== null ? null : !holdStyle ? 'Tap assesses attacks only.'
    : matches.length ? 'Hold not assessed—short notes only.' : 'No matched played notes.';
  return { ...base, startingDisplacement: confident ? displacement : null, restIntrusions, basis, rhythm, hold, tempo, steadiness, reason: confident ? null : actual.length ? 'Not enough evidence for performed tempo; rhythm uses target tempo.' : 'No attacks received.', tempoReason: tempo ? null : 'Not enough evidence: need four matched attacks spanning three performance beats with a clear tempo fit.', steadinessReason: steadiness === null ? 'Not enough evidence: need a clear tempo and four uninterrupted intervals spanning four performance beats.' : null, holdReason, matchedNotes: matches.length, missing: expected.length - matches.length, extra, matches, usableIntervals: intervals.length, intervalSpan, performedBeat: confident ? beat : null, residualMedian };
}
export type Assessment = ReturnType<typeof assessAttempt>;
