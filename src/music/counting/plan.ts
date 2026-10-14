import { add, compare, divide, fraction, multiply, subtract } from '../fraction.ts';
import type { Fraction } from '../fraction.ts';
import { createScore, deriveScore } from '../score.ts';
import type { RhythmScore, ScoreSymbol } from '../score.ts';
import { immutable, writtenDenominators } from '../written.ts';
import { captureCountingPreferences, defaultCountingPreferences } from './preferences.ts';
import type { CountingPreferences } from './preferences.ts';
import { countAt } from './vocabulary.ts';
import type { CountToken } from './vocabulary.ts';
export type CountId = `count:${number}:${number}/${number}`;
export type UnitId = `unit:${string}`;
export type CountReason = 'attack' | 'rest-onset' | 'long-note' | 'written-dot';
export interface CountPosition {
  readonly id: CountId;
  readonly position: Fraction;
  readonly localPosition: Fraction;
  readonly measure: number;
  readonly symbolId: string;
  readonly unitId: UnitId;
  readonly expectedToken: CountToken;
  readonly label: string;
  readonly reasons: readonly CountReason[];
}
export interface NotationSymbol extends ScoreSymbol {
  readonly unitId: UnitId | null;
  readonly counts: readonly CountPosition[];
}
export interface InferredUnit {
  readonly id: UnitId;
  readonly symbolIds: readonly string[];
  readonly start: Fraction;
  readonly end: Fraction;
  readonly duration: Fraction;
  readonly counts: readonly CountPosition[];
  readonly expectedRest: boolean;
  readonly restApplicable: boolean;
  readonly durationApplicable: boolean;
}
export interface CountingPlan {
  readonly source: RhythmScore;
  readonly preferences: CountingPreferences;
  readonly symbols: readonly NotationSymbol[];
  readonly units: readonly InferredUnit[];
  /** This is both the required and the available input set. */
  readonly counts: readonly CountPosition[];
  readonly subdivisionSymbolIds: readonly string[];
}
function assertCountingCapability(source: RhythmScore, symbols: readonly ScoreSymbol[]) {
  for (const s of symbols) {
    const n = s.source, compound = source.measures[s.measure]!.meter[1] === 8;
    const triplet = n.timeModification;
    if (n.dots > 1 || (n.type === 'whole' && (n.dots || source.measures[s.measure]!.meter[0] !== 4)) ||
        (n.type === '16th' && (compound || n.dots)) || (n.type === 'eighth' && n.dots && (compound || n.kind === 'rest')) ||
        (compound && n.type === 'half' && n.dots !== 1) ||
        (!compound && n.type === 'half' && n.dots && n.kind === 'rest') ||
        (triplet && (compound || n.type !== 'eighth' || n.dots || n.kind === 'rest' || triplet[0] !== 3 || triplet[1] !== 2 || n.tieNext || s.tiedToPrevious))) throw new Error(`Unsupported counting notation: ${n.id}`);
    if (s.tupletGroup === n.id && divide(s.localStart, fraction(1, 4))[1] !== 1) throw new Error('Counting triplets must start on quarter beats.');
    if (s.tiedToPrevious) {
      const prev = symbols[symbols.indexOf(s) - 1]!;
      if (source.measures[prev.measure]!.meter.join('/') !== source.measures[s.measure]!.meter.join('/')) throw new Error('Mixed-meter counting tie chains are unsupported.');
    }
  }
}
/** Only rule interpreter. Single bars are simply one-element passages. */
export function buildCountingPlan(input: RhythmScore, preferences: CountingPreferences = defaultCountingPreferences): CountingPlan {
  const source = createScore(input), prefs = captureCountingPreferences(preferences);
  const derived = deriveScore(source);
  assertCountingCapability(source, derived.symbols);
  const groups: ScoreSymbol[][] = [];
  for (const symbol of derived.symbols) {
    if (symbol.source.kind === 'rest' && !prefs.includeRests) continue;
    if (symbol.tiedToPrevious) groups.at(-1)!.push(symbol);
    else groups.push([symbol]);
  }
  const counts: CountPosition[] = [], units: InferredUnit[] = [], marked = new Set<string>();
  for (const members of groups) {
    const first = members[0]!, last = members.at(-1)!;
    const id: UnitId = `unit:${first.source.id}`, duration = subtract(last.end, first.start);
    const pulse = source.measures[first.measure]!.meter[1] === 8 ? fraction(3, 8) : fraction(1, 4);
    const positions = new Map<string, { position: Fraction; reasons: Set<CountReason> }>();
    const include = (position: Fraction, reason: CountReason) => {
      const key = position.join('/'), item = positions.get(key) ?? { position, reasons: new Set<CountReason>() };
      item.reasons.add(reason); positions.set(key, item);
    };
    const rest = first.source.kind === 'rest';
    include(first.start, rest ? 'rest-onset' : 'attack');
    if (prefs.longNotes && compare(duration, multiply(pulse, fraction(2))) >= 0) {
      members.forEach(s => marked.add(s.source.id));
      for (let p = add(first.start, pulse); compare(p, last.end) < 0; p = add(p, pulse)) include(p, 'long-note');
    }
    if (prefs.dotted) for (const member of members) {
      const n = member.source, compound = source.measures[member.measure]!.meter[1] === 8;
      if (n.dots !== 1 || (compound && n.type !== 'quarter')) continue;
      marked.add(n.id);
      const step = fraction(1, writtenDenominators[n.type] * 2);
      for (let p = member.start; compare(p, member.end) < 0; p = add(p, step)) include(p, 'written-dot');
    }
    const unitCounts: CountPosition[] = [...positions.values()].sort((a, b) => compare(a.position, b.position)).map(({ position, reasons }) => {
      const symbol = members.find(s => compare(position, s.start) >= 0 && compare(position, s.end) < 0)!;
      const localPosition = add(symbol.localStart, subtract(position, symbol.start));
      const compound = source.measures[symbol.measure]!.meter[1] === 8;
      const expectedToken = countAt(localPosition, compound, prefs.vocabulary, !!symbol.source.timeModification);
      if (!expectedToken) throw new Error('Unsupported counting position.');
      const countId: CountId = `count:${symbol.measure}:${localPosition[0]}/${localPosition[1]}`;
      const beat = divide(localPosition, fraction(1, compound ? 8 : 4));
      return { id: countId, position, localPosition, measure: symbol.measure, symbolId: symbol.source.id, unitId: id, expectedToken,
        label: `Measure ${symbol.measure + 1}, ${compound ? 'count' : 'beat'} ${Math.floor(beat[0] / beat[1]) + 1}, offset ${localPosition.join('/')} whole notes (${expectedToken})`, reasons: [...reasons].sort() };
    });
    counts.push(...unitCounts);
    units.push({ id, symbolIds: members.map(s => s.source.id), start: first.start, end: last.end, duration, counts: unitCounts, expectedRest: rest, restApplicable: prefs.includeRests,
      durationApplicable: unitCounts.length > 1 && (prefs.showDurationLine || prefs.internalAppearance !== 'unchanged') });
  }
  const symbols = derived.symbols.map(s => ({ ...s, unitId: units.find(u => u.symbolIds.includes(s.source.id))?.id ?? null, counts: counts.filter(c => c.symbolId === s.source.id) }));
  return immutable({ source, preferences: prefs, symbols, counts, units, subdivisionSymbolIds: [...marked] });
}
