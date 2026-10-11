import { alignAttacks } from './alignment.ts';
import { inputKind } from './offset.ts';
import type { TimingOffset } from './offset.ts';
import type { AttemptRecord } from './capture.ts';
export interface Hold { down: number; up: number | null; eventIndex: number; countIn: boolean; correction: number }
export interface Match { expected: number; hold: number; onsetOffset: number; releaseOffset: number | null }
/** Ordered maximum-cardinality, minimum-total-offset matching within the window.
 * Gaps are independent; release times never influence attack alignment. Stable ties prefer matching. */
export function evaluateAttempt(record: AttemptRecord, timingOffset: TimingOffset | null | undefined = record.timingOffset) {
  if (record.status === 'interrupted') return { status: 'interrupted' as const, reason: record.reason, matches: [] as Match[], missing: [] as number[], extra: [] as number[], restOverlaps: [] as { rest: number; hold: number; start: number; end: number }[], holds: [] as Hold[] };
  const holds: Hold[] = [];
  let active: Hold | undefined;
  record.events.forEach((e, eventIndex) => {
    if (!e.accepted || e.region === 'outside') return;
    const correction = timingOffset?.input === inputKind(e.source) ? timingOffset.seconds : 0;
    const time = e.time - correction;
    if (e.action === 'down') {
      // A measured offset can move an early first attack into its matching window.
      const countIn = timingOffset?.input === inputKind(e.source) ? time < -record.policy.attackWindow : e.region === 'count-in';
      active = { down: time, up: null, eventIndex, countIn, correction }; holds.push(active);
    } else if (active) { active.up = time; active = undefined; }
  });
  const scored = holds.map((h, i) => ({ h, i })).filter(({ h }) => !h.countIn);
  const expected = record.plan.notes;
  const pairs = alignAttacks(expected.map(n => n.start), scored.map(s => s.h.down), record.policy.attackWindow).pairs.map(([e, h]) => [e, scored[h]!.i] as const);
  const matches: Match[] = pairs.map(([e, h]) => ({ expected: e, hold: h, onsetOffset: holds[h]!.down - expected[e]!.start, releaseOffset: holds[h]!.up === null ? null : holds[h]!.up! - expected[e]!.end }));
  const missing = expected.flatMap((_, i) => pairs.some(([e]) => e === i) ? [] : [i]);
  const extra = scored.flatMap(({ i }) => pairs.some(([, h]) => h === i) ? [] : [i]);
  const restOverlaps = record.plan.rests.flatMap((r, rest) => holds.flatMap((h, hold) => {
    const start = Math.max(0, r.start, h.down), end = Math.min(r.end, h.up ?? (record.endedAt - h.correction));
    return end > start ? [{ rest, hold, start, end }] : [];
  }));
  return { status: 'completed' as const, matches, missing, extra, restOverlaps, holds };
}
