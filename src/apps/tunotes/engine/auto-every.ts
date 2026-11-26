import { note } from '../../../music/measure.ts';
import type { WrittenNote } from '../../../music/score.ts';
import type { WrittenPitch } from '../domain/notation.ts';
import { writtenDuration } from '../../../music/written.ts';
import { quarterPulse } from '../../../music/tempo.ts';
import { divide, toNumber } from '../../../music/fraction.ts';

export const autoValues = [
  { type: 'quarter', dots: 0 },
  { type: 'half', dots: 0 },
  { type: 'half', dots: 1 },
  { type: 'whole', dots: 0 },
] as const;
export type AutoValue = Pick<typeof autoValues[number], 'type' | 'dots'>;
/** Pitch belongs to the written event, so the same event can drive notation and playback. */
export interface PitchedEvent { readonly written: WrittenNote; readonly pitch: WrittenPitch }
export function pitchedEvent(id: string, pitch: WrittenPitch, value: AutoValue): PitchedEvent {
  return { pitch, written: { ...note(value.type,{dots:value.dots}), id } };
}
// A one-beat window must accommodate a 350 ms fingering settle or 300 ms microphone hold.
export const minAutoBpm = 30, maxAutoBpm = 150;
export interface AutoSettings { value: AutoValue; bpm: number; lookahead: boolean; sound: boolean }
export const defaultAuto: AutoSettings = { value: { type: 'whole', dots: 0 }, bpm: 80, lookahead: true, sound: true };
export const quarterBeats = (value: AutoValue) => toNumber(divide(writtenDuration(value.type, value.dots), quarterPulse));
export function validateAuto(input: unknown): AutoSettings {
  const v = input as Partial<AutoSettings> | null;
  const value = autoValues.find(n => n.type === v?.value?.type && n.dots === v.value.dots);
  if (!value || !v || typeof v.bpm !== 'number' || !Number.isInteger(v.bpm) || v.bpm < minAutoBpm || v.bpm > maxAutoBpm || typeof v.lookahead !== 'boolean' || typeof v.sound !== 'boolean') throw new Error('Invalid Auto Every settings.');
  return { value: { type: value.type, dots: value.dots }, bpm: v.bpm, lookahead: v.lookahead, sound: v.sound };
}
