/** Ordered, one-to-one maximum-cardinality / minimum-offset association. */
export function alignAttacks(expected: readonly number[], actual: readonly number[], window: number, offset = 0) {
  type Alignment = { pairs: [number, number][]; cost: number };
  const table: Alignment[][] = Array.from({ length: expected.length + 1 }, () => Array.from({ length: actual.length + 1 }, () => ({ pairs: [], cost: 0 })));
  const better = (a: Alignment, b: Alignment) => a.pairs.length > b.pairs.length || a.pairs.length === b.pairs.length && a.cost <= b.cost ? a : b;
  for (let i = 1; i <= expected.length; i++) for (let j = 1; j <= actual.length; j++) {
    const delta = actual[j - 1]! - offset - expected[i - 1]!;
    let best = better(table[i - 1]![j]!, table[i]![j - 1]!);
    if (Math.abs(delta) <= window) {
      const previous = table[i - 1]![j - 1]!;
      best = better({ pairs: [...previous.pairs, [i - 1, j - 1]], cost: previous.cost + Math.abs(delta) }, best);
    }
    table[i]![j] = best;
  }
  return table[expected.length]![actual.length]!;
}
