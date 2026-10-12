import { alignAttacks } from './alignment.ts';
import type { TimingOffset } from './offset.ts';
import type { AttemptRecord } from './capture.ts';
import { provisionalEvaluation, releaseAllowances } from './play-policy.ts';
export type DurationFeedback = 'not-graded' | 'accepted' | 'early' | 'late' | 'short' | 'incomplete';
export type { Hold } from './evidence.ts';
import { capturedHolds } from './evidence.ts';
import type { Hold } from './evidence.ts';
export interface Match { expected: number; hold: number; onsetOffset: number; releaseOffset: number | null; attackAccepted: boolean; durationFeedback: DurationFeedback }
/** Ordered maximum-cardinality, minimum-total-offset matching within the window.
 * Gaps are independent; release times never influence attack alignment. Stable ties prefer matching. */
export function evaluateAttempt(record: AttemptRecord, timingOffset: TimingOffset | null | undefined = record.timingOffset) {
  if (record.status === 'interrupted') return { status: 'interrupted' as const, reason: record.reason, matches: [] as Match[], missing: [] as number[], extra: [] as number[], restOverlaps: [] as { rest: number; hold: number; start: number; end: number }[], restAttacks: [] as { rest: number; hold: number }[], restViolations: [] as { rest: number; hold: number }[], holds: [] as Hold[], acceptable: false };
  const policy = record.evaluationPolicy ?? provisionalEvaluation;
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
    const allowance = releaseAllowances(note.end - note.start, adjacent, policy);
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
  const acceptable = !missing.length && !extra.length && !restAttackViolations.length && !restViolations.length
    && matches.every(m => m.attackAccepted && (m.durationFeedback === 'accepted' || m.durationFeedback === 'not-graded'));
  return { status: 'completed' as const, matches, missing, extra, restOverlaps, restAttacks, restViolations, holds, acceptable };
}
