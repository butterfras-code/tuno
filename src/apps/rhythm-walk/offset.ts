import { alignAttacks } from './alignment.ts';
import type { AttemptRecord } from './capture.ts';
export type InputKind = 'keyboard' | 'pointer';
export interface TimingOffset { version: 1; seconds: number; input: InputKind; method: 'estimated' | 'tap'; samples: number; spread: number }
export type OffsetResult = { ok: true; offset: TimingOffset } | { ok: false; reason: string };
export const inputKind = (source: string): InputKind => source === 'keyboard' ? 'keyboard' : 'pointer';
export const median = (values: readonly number[]) => { const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2; };
function assess(deltas: number[], input: InputKind, method: TimingOffset['method']): OffsetResult {
  const seconds = median(deltas);
  const errors = deltas.map(d => Math.abs(d - seconds)).sort((a, b) => a - b);
  const spread = errors[Math.ceil(errors.length * .9) - 1]!;
  const half = Math.floor(deltas.length / 2);
  if (spread > .08 || Math.abs(median(deltas.slice(0, half)) - median(deltas.slice(-half))) > .06)
    return { ok: false, reason: 'Timing varies or drifts too much to infer a constant offset. Try tap-along calibration.' };
  return { ok: true, offset: { version: 1, seconds, input, method, samples: deltas.length, spread } };
}
/** Estimate only from completed, sufficiently dense, consistent and unambiguous patterns. */
export function estimateOffset(record: AttemptRecord): OffsetResult {
  const fail = (reason: string): OffsetResult => ({ ok: false, reason });
  if (record.status !== 'completed') return fail('Complete an exercise before estimating timing.');
  const downs = record.events.filter(e => e.accepted && e.action === 'down' && e.region !== 'outside' && e.time >= -.4);
  if (new Set(downs.map(e => inputKind(e.source))).size !== 1) return fail('Use one input method, then calibrate it.');
  const expected = record.plan.notes.map(n => n.start), actual = downs.map(e => e.time);
  if (Math.min(expected.length, actual.length) < 6) return fail('Not enough attacks to estimate timing. Use Quarter steps or tap-along calibration.');
  if (Math.min(expected.length, actual.length) / Math.max(expected.length, actual.length) < .8) return fail('Too many missing or extra taps to estimate timing. Try tap-along calibration.');
  const candidates: { offset: number; pairs: [number, number][]; cost: number }[] = [];
  for (const e of expected) for (const a of actual) {
    const initial = a - e;
    if (Math.abs(initial) > .4) continue;
    const first = alignAttacks(expected, actual, .08, initial);
    if (!first.pairs.length) continue;
    const offset = median(first.pairs.map(([i, j]) => actual[j]! - expected[i]!));
    const aligned = alignAttacks(expected, actual, .08, offset);
    candidates.push({ offset, ...aligned });
  }
  candidates.sort((a, b) => b.pairs.length - a.pairs.length || a.cost - b.cost);
  const best = candidates[0];
  if (!best || best.pairs.length < 6 || best.pairs.length / Math.max(expected.length, actual.length) < .8)
    return fail('Too few taps follow the expected pattern. Try tap-along calibration.');
  if (candidates.some(c => Math.abs(c.offset - best.offset) > .1 && c.pairs.length >= best.pairs.length - 1 && c.cost / c.pairs.length <= best.cost / best.pairs.length + .02))
    return fail('More than one timing alignment fits. Try tap-along calibration.');
  return assess(best.pairs.map(([i, j]) => actual[j]! - expected[i]!), inputKind(downs[0]!.source), 'estimated');
}
export const calibrationPulse = .75;
export const calibrationWarmup = 4;
export const calibrationCount = 16;
/** Taps are seconds relative to the first click; four warm-up clicks are ignored. */
export function estimateTapOffset(taps: readonly number[], input: InputKind): OffsetResult {
  const groups = new Map<number, number[]>();
  for (const tap of taps) {
    const beat = Math.round(tap / calibrationPulse), delta = tap - beat * calibrationPulse;
    if (beat < calibrationWarmup || beat >= calibrationCount) continue;
    const group = groups.get(beat) ?? []; group.push(delta); groups.set(beat, group);
  }
  const deltas = [...groups].sort(([a], [b]) => a - b).filter(([, values]) => values.length === 1 && Math.abs(values[0]!) <= .35).map(([, values]) => values[0]!);
  if (deltas.length < 9) return { ok: false, reason: 'Tap once per click through the whole sequence. At least nine clear taps are needed; try again.' };
  return assess(deltas, input, 'tap');
}
export function readOffset(value: string | null): TimingOffset | undefined {
  try {
    const x = JSON.parse(value ?? 'null') as TimingOffset | null;
    if (x?.version === 1 && ['keyboard', 'pointer'].includes(x.input) && ['estimated', 'tap'].includes(x.method) && Number.isFinite(x.seconds) && Math.abs(x.seconds) <= .4 && Number.isInteger(x.samples) && x.samples >= 6 && Number.isFinite(x.spread) && x.spread >= 0 && x.spread <= .08) return x;
  } catch { /* Invalid or unavailable session data leaves timing uncalibrated. */ }
  return undefined;
}
