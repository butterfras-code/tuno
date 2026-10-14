import { sourcePolicy } from './shared/meter.ts';
import { add, fraction, toNumber, divide, compare } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';
import { derivePassage } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
export interface TimingPolicy { readonly attackWindow: number; readonly releaseGrace: number; readonly leadIn: number }
/** Seconds, provisional engineering defaults, not teaching thresholds. */
export const prototypeTiming: TimingPolicy = { attackWindow: 0.18, releaseGrace: 0.30, leadIn: 0.12 };
export const quarterPulse: Fraction = [1, 4];
/** BPM is in units of pulse, independent of counting labels or measure.groups. */
export function musicalSeconds(time: Fraction, bpm: number, pulse: Fraction = quarterPulse): number {
  if (!Number.isFinite(bpm) || bpm <= 0 || compare(pulse, fraction(0)) <= 0) throw new Error('Invalid tempo/pulse.');
  return toNumber(divide(time, pulse)) * 60 / bpm;
}
export interface Source { measure: number; event: number }
export interface ExpectedNote { start: number; end: number; sources: Source[]; finalSegmentDuration?: number }
export interface ExpectedRest { start: number; end: number; source: Source }
export function planPassage(measures: readonly RhythmMeasure[], bpm: number, policy: TimingPolicy = prototypeTiming, pulse?: Fraction) {
  const passage = derivePassage(measures);
  if (!passage.measures.length) throw new Error('Empty passage.');
  const first = sourcePolicy(measures[0]!);
  pulse ??= first.pulse;
  // Preserve explicit pulse callers for uniform passages; meter changes use the
  // local pulse at constant pulse BPM. Musical positions remain exact fractions.
  const localPulses = measures.map(m => sourcePolicy(m).id === first.id ? pulse : sourcePolicy(m).pulse);
  const starts: number[] = [], lengths: number[] = [];
  let duration = 0;
  passage.measures.forEach((m, i) => { starts.push(duration); const length = musicalSeconds(m.length, bpm, localPulses[i]!); lengths.push(length); duration += length; });
  const at = (measure: number, position: Fraction) => starts[measure]! + musicalSeconds(position, bpm, localPulses[measure]!);
  const notes: ExpectedNote[] = passage.attacks.map(a => {
    const first = a.sources[0]!, last = a.sources.at(-1)!;
    const firstEvent = passage.measures[first.measure]!.events[first.event]!;
    const lastEvent = passage.measures[last.measure]!.events[last.event]!;
    return { start: at(first.measure, firstEvent.start), end: at(last.measure, lastEvent.end), sources: a.sources,
      finalSegmentDuration: musicalSeconds(lastEvent.duration, bpm, localPulses[last.measure]!) };
  });
  const rests: ExpectedRest[] = [];
  const pulses: { time: number; downbeat: boolean; countIn: boolean; beat: number }[] = [];
  const firstLength = passage.measures[0]!.length;
  const countInMeasures = Math.ceil(4 / toNumber(divide(firstLength, pulse)));
  const countIn = lengths[0]! * countInMeasures;
  function addPulses(start: number, length: Fraction, localPulse: Fraction, count: boolean) {
    for (let p = fraction(0), beat = 1; compare(p, length) < 0; p = add(p, localPulse), beat++) {
      pulses.push({ time: start + musicalSeconds(p, bpm, localPulse), downbeat: compare(p, fraction(0)) === 0, countIn: count, beat });
    }
  }
  for (let bar = 0; bar < countInMeasures; bar++) addPulses(bar * lengths[0]! - countIn, firstLength, pulse, true);
  passage.measures.forEach((measure, m) => {
    addPulses(starts[m]!, measure.length, localPulses[m]!, false);
    measure.events.filter(e => e.kind === 'rest').forEach(e => rests.push({ start: at(m, e.start), end: at(m, e.end), source: { measure: m, event: e.index } }));
  });
  return { notes, rests, pulses, duration, countIn, captureEnd: duration + policy.releaseGrace, pulseSeconds: 60 / bpm };
}
export type Plan = ReturnType<typeof planPassage>;
/** DOM monotonic timestamp -> AudioContext timeline. No latency correction. */
export function inputAudioTime(timestampMs: number, anchor: { performanceMs: number; audioSeconds: number }): number {
  return anchor.audioSeconds + (timestampMs - anchor.performanceMs) / 1000;
}
