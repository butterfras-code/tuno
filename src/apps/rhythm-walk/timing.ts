import { add, fraction, toNumber, divide, compare, multiply } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';
import { derivePassage } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
export interface TimingPolicy { readonly attackWindow: number; readonly releaseGrace: number; readonly leadIn: number }
/** Seconds, provisional engineering defaults, not teaching thresholds. */
export const prototypeTiming: TimingPolicy = { attackWindow: 0.18, releaseGrace: 0.75, leadIn: 0.12 };
export const quarterPulse: Fraction = [1, 4];
/** BPM is in units of pulse, independent of counting labels or measure.groups. */
export function musicalSeconds(time: Fraction, bpm: number, pulse: Fraction = quarterPulse): number {
  if (!Number.isFinite(bpm) || bpm <= 0 || compare(pulse, fraction(0)) <= 0) throw new Error('Invalid tempo/pulse.');
  return toNumber(divide(time, pulse)) * 60 / bpm;
}
export interface Source { measure: number; event: number }
export interface ExpectedNote { start: number; end: number; sources: Source[]; finalSegmentDuration?: number }
export interface ExpectedRest { start: number; end: number; source: Source }
export function planPassage(measures: readonly RhythmMeasure[], bpm: number, policy: TimingPolicy = prototypeTiming, pulse: Fraction = quarterPulse) {
  const passage = derivePassage(measures);
  if (!passage.measures.length) throw new Error('Empty passage.');
  const seconds = (time: Fraction) => musicalSeconds(time, bpm, pulse);
  const notes: ExpectedNote[] = passage.attacks.map(a => {
    const last = a.sources.at(-1)!;
    return { start: seconds(a.start), end: seconds(add(a.start, a.duration)), sources: a.sources,
      finalSegmentDuration: seconds(passage.measures[last.measure]!.events[last.event]!.duration) };
  });
  let offset = fraction(0);
  const rests: ExpectedRest[] = [];
  const pulses: { time: number; downbeat: boolean; countIn: boolean; beat: number }[] = [];
  const firstLength = passage.measures[0]!.length;
  // Whole count-in bars, with at least four performance pulses.
  const countInMeasures = Math.ceil(4 / toNumber(divide(firstLength, pulse)));
  const countIn = seconds(multiply(firstLength, fraction(countInMeasures)));
  function addPulses(start: Fraction, length: Fraction, count: boolean) {
    for (let p = fraction(0), beat = 1; compare(p, length) < 0; p = add(p, pulse), beat++) {
      pulses.push({ time: seconds(add(start, p)) - (count ? countIn : 0), downbeat: compare(p, fraction(0)) === 0, countIn: count, beat });
    }
  }
  for (let bar = 0; bar < countInMeasures; bar++) addPulses(multiply(firstLength, fraction(bar)), firstLength, true);
  passage.measures.forEach((measure, m) => {
    addPulses(offset, measure.length, false);
    measure.events.filter(e => e.kind === 'rest').forEach(e => rests.push({ start: seconds(add(offset, e.start)), end: seconds(add(offset, e.end)), source: { measure: m, event: e.index } }));
    offset = add(offset, measure.length);
  });
  const duration = seconds(passage.length);
  return { notes, rests, pulses, duration, countIn, captureEnd: duration + policy.releaseGrace, pulseSeconds: seconds(pulse) };
}
export type Plan = ReturnType<typeof planPassage>;
/** DOM monotonic timestamp -> AudioContext timeline. No latency correction. */
export function inputAudioTime(timestampMs: number, anchor: { performanceMs: number; audioSeconds: number }): number {
  return anchor.audioSeconds + (timestampMs - anchor.performanceMs) / 1000;
}
