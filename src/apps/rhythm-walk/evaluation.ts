import { assessAttempt } from './assessment.ts';
import { alignAttacks } from './alignment.ts';
import type { TimingOffset } from './offset.ts';
import type { AttemptRecord } from './capture.ts';
import { legacyEvaluation, releaseAllowances } from './play-policy.ts';
export type DurationFeedback = 'unavailable' | 'not-graded' | 'accepted' | 'early' | 'late' | 'short' | 'incomplete';
export type { Hold } from './evidence.ts';
import { capturedHolds } from './evidence.ts';
import type { Hold } from './evidence.ts';
export interface Match { expected: number; hold: number; onsetOffset: number; releaseOffset: number | null; attackAccepted: boolean; durationFeedback: DurationFeedback }
/** Ordered maximum-cardinality, minimum-total-offset matching within the window.
 * Gaps are independent; release times never influence attack alignment. Stable ties prefer matching. */
export function evaluateAttempt(record: AttemptRecord, timingOffset: TimingOffset | null | undefined = record.timingOffset) {
  if (record.status === 'interrupted') return { status: 'interrupted' as const, evidenceAvailable:false, reason: record.reason, matches: [] as Match[], missing: [] as number[], extra: [] as number[], restOverlaps: [] as { rest: number; hold: number; start: number; end: number }[], restAttacks: [] as { rest: number; hold: number }[], restViolations: [] as { rest: number; hold: number }[], holds: [] as Hold[], acceptable: false };
  const policy = record.evaluationPolicy ?? legacyEvaluation;
  // Legacy evidence predates selectable behavior and was explicitly hold-oriented.
  const holdStyle = (record.playStyle ?? 'hold') === 'hold';
  const holds = capturedHolds(record, timingOffset);
  const scored = holds.map((h, i) => ({ h, i })).filter(({ h }) => !h.countIn);
  const expected = record.plan.notes;
  const pairs = alignAttacks(expected.map(n => n.start), scored.map(s => s.h.down), record.policy.attackWindow).pairs.map(([e, h]) => [e, scored[h]!.i] as const);
  const matches: Match[] = pairs.map(([e, h]) => {
    const note = expected[e]!, hold = holds[h]!;
    const onsetOffset = hold.down - note.start;
    const releaseOffset = hold.up === null ? null : hold.up - note.end;
    const adjacent = Math.abs((expected[e + 1]?.start ?? Infinity) - note.end) < 1e-9;
    const allowance = releaseAllowances(note.end - note.start, adjacent, policy, note.finalSegmentDuration);
    const durationFeedback: DurationFeedback = !holdStyle ? 'not-graded' : releaseOffset === null ? 'incomplete'
      : releaseOffset < -allowance.early - 1e-9 ? 'early' : releaseOffset > allowance.late + 1e-9 ? 'late'
      : hold.up! - hold.down < allowance.minimumSustain - 1e-9 ? 'short' : 'accepted';
    return { expected: e, hold: h, onsetOffset, releaseOffset, attackAccepted: Math.abs(onsetOffset) <= policy.attackTolerance + 1e-9, durationFeedback };
  });
  const missing = expected.flatMap((_, i) => pairs.some(([e]) => e === i) ? [] : [i]);
  const extra = scored.flatMap(({ i }) => pairs.some(([, h]) => h === i) ? [] : [i]);
  const restOverlaps = record.plan.rests.flatMap((r, rest) => holds.flatMap((h, hold) => {
    const start = Math.max(0, r.start, h.down), end = Math.min(r.end, h.up ?? (record.endedAt - h.correction));
    return end > start ? [{ rest, hold, start, end }] : [];
  }));
  const restAttacks = record.plan.rests.flatMap((r, rest) => scored.flatMap(({ h, i }) => h.down >= r.start && h.down < r.end ? [{ rest, hold: i }] : []));
  function acceptedEarlyAttack(hold: number, rest: number) {
    const match = matches.find(m => m.hold === hold);
    return !!match?.attackAccepted && Math.abs(expected[match.expected]!.start - record.plan.rests[rest]!.end) < 1e-9;
  }
  const restAttackViolations = restAttacks.filter(o => !acceptedEarlyAttack(o.hold, o.rest));
  // Preserve every overlap as raw derived evidence, but only grade sustain in Hold.
  // An associated note's small late release uses its ordinary allowance once.
  const restViolations = holdStyle ? restOverlaps.filter(o => {
    // An accepted attack leading into the following note uses its attack
    // tolerance once, while its exact intrusion remains in rest evidence.
    if (acceptedEarlyAttack(o.hold, o.rest)) return false;
    const match = matches.find(m => m.hold === o.hold);
    if (!match) return true;
    const note = expected[match.expected]!;
    const rest = record.plan.rests[o.rest]!;
    return Math.abs(note.end - rest.start) > 1e-9 || match.durationFeedback !== 'accepted';
  }) : restAttackViolations;
  if (record.assessmentPolicy?.version === 2 && timingOffset !== null && timingOffset === record.timingOffset) {
    const a = assessAttempt(record);
    const available = a.basis !== 'unavailable' || !expected.length;
    const indices = holds.flatMap((h,i) => h.countIn ? [] : [i]);
    const shared: Match[] = !available ? matches.map(m => ({...m, attackAccepted:true, durationFeedback:'unavailable'})) : a.matches.map(m => {
      const hold = holds[indices[m.actual]!]!, note = expected[m.expected]!;
      const d = m.duration;
      const durationFeedback: DurationFeedback = !holdStyle ? 'not-graded' : hold.up === null ? 'incomplete' : m.holdCredit! >= 1-1e-9 ? 'accepted'
        : d && d.elapsed! < d.minimum ? 'short' : 'late';
      return { expected:m.expected, hold:indices[m.actual]!, onsetOffset:hold.down-note.start, releaseOffset:hold.up === null ? null : hold.up-note.end,
        attackAccepted:m.credit>=1-1e-9, durationFeedback };
    });
    const sharedMissing = !available ? [] : expected.flatMap((_,i)=>shared.some(m=>m.expected===i)?[]:[i]);
    const sharedExtra = !available ? [] : indices.filter(i=>!shared.some(m=>m.hold===i));
    const sharedRests = !available ? [] : holdStyle ? a.restIntrusions.map(r=>({rest:r.rest,hold:r.hold}))
      : restAttacks.filter(r=>sharedExtra.includes(r.hold));
    return {status:'completed' as const,evidenceAvailable:available,matches:shared,missing:sharedMissing,extra:sharedExtra,restOverlaps,restAttacks,restViolations:sharedRests,holds,
      acceptable:available && !sharedMissing.length && !sharedExtra.length && !sharedRests.length && shared.every(m=>m.attackAccepted && ['accepted','not-graded'].includes(m.durationFeedback))};
  }
  const acceptable = !missing.length && !extra.length && !restAttackViolations.length && !restViolations.length
    && matches.every(m => m.attackAccepted && (m.durationFeedback === 'accepted' || m.durationFeedback === 'not-graded'));
  return { status: 'completed' as const, evidenceAvailable:true, matches, missing, extra, restOverlaps, restAttacks, restViolations, holds, acceptable };
}
