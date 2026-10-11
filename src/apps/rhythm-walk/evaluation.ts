import type { AttemptRecord } from './capture.ts';
export interface Hold { down: number; up: number | null; eventIndex: number; countIn: boolean }
export interface Match { expected: number; hold: number; onsetOffset: number; releaseOffset: number | null }
/** Ordered maximum-cardinality, minimum-total-offset matching within the window.
 * Gaps are independent; release times never influence attack alignment. Stable ties prefer matching. */
export function evaluateAttempt(record: AttemptRecord) {
  if (record.status === 'interrupted') return { status: 'interrupted' as const, reason: record.reason, matches: [] as Match[], missing: [] as number[], extra: [] as number[], restOverlaps: [] as { rest: number; hold: number; start: number; end: number }[], holds: [] as Hold[] };
  const holds: Hold[] = [];
  let active: Hold | undefined;
  record.events.forEach((e, eventIndex) => {
    if (!e.accepted || e.region === 'outside') return;
    if (e.action === 'down') { active = { down: e.time, up: null, eventIndex, countIn: e.region === 'count-in' }; holds.push(active); }
    else if (active) { active.up = e.time; active = undefined; }
  });
  const scored = holds.map((h, i) => ({ h, i })).filter(({ h }) => !h.countIn);
  const expected = record.plan.notes;
  type Alignment = { pairs: [number, number][]; cost: number };
  const table: Alignment[][] = Array.from({ length: expected.length + 1 }, () => Array.from({ length: scored.length + 1 }, () => ({ pairs: [], cost: 0 })));
  const better = (a: Alignment, b: Alignment) => a.pairs.length > b.pairs.length || a.pairs.length === b.pairs.length && a.cost <= b.cost ? a : b;
  for (let i = 1; i <= expected.length; i++) for (let j = 1; j <= scored.length; j++) {
    const delta = scored[j - 1]!.h.down - expected[i - 1]!.start;
    let best = better(table[i - 1]![j]!, table[i]![j - 1]!);
    if (Math.abs(delta) <= record.policy.attackWindow) {
      const previous = table[i - 1]![j - 1]!;
      best = better({ pairs: [...previous.pairs, [i - 1, scored[j - 1]!.i]], cost: previous.cost + Math.abs(delta) }, best);
    }
    table[i]![j] = best;
  }
  const pairs = table[expected.length]![scored.length]!.pairs;
  const matches: Match[] = pairs.map(([e, h]) => ({ expected: e, hold: h, onsetOffset: holds[h]!.down - expected[e]!.start, releaseOffset: holds[h]!.up === null ? null : holds[h]!.up! - expected[e]!.end }));
  const missing = expected.flatMap((_, i) => pairs.some(([e]) => e === i) ? [] : [i]);
  const extra = scored.flatMap(({ i }) => pairs.some(([, h]) => h === i) ? [] : [i]);
  const restOverlaps = record.plan.rests.flatMap((r, rest) => holds.flatMap((h, hold) => {
    const start = Math.max(0, r.start, h.down), end = Math.min(r.end, h.up ?? record.endedAt);
    return end > start ? [{ rest, hold, start, end }] : [];
  }));
  return { status: 'completed' as const, matches, missing, extra, restOverlaps, holds };
}
