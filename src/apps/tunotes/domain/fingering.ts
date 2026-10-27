import type { FingerPosition } from '../../../shared/input/held-fingers.ts';
import { chromatic } from './notation.ts';
import type { AnswerSpelling, WrittenPitch } from './notation.ts';

/** LLLLRRRR, left to right. Leading zeros are part of the representation. */
export type FingeringMask = string;
export const OPEN_FINGERING: FingeringMask = '00000000';
export interface FingeringConfiguration {
  readonly instrument: string;
  /** Array order is the visual arrangement; position indexes the eight-bit mask. */
  readonly fingers: readonly FingerPosition[];
  /** Existing written chromatic pitch numbers, never concert/transposed pitch. */
  readonly pitches: Readonly<Record<number, readonly FingeringMask[]>>;
}
export interface FingeringAnswer { readonly kind: 'fingering'; readonly mask: FingeringMask }
export type NoteAnswer = AnswerSpelling | FingeringAnswer;
export function validMask(mask: string) { return /^[01]{8}$/.test(mask); }
export function acceptsFingering(config: FingeringConfiguration, pitch: WrittenPitch, mask: FingeringMask) {
  return validMask(mask) && Boolean(config.pitches[chromatic(pitch)]?.includes(mask));
}
const masks: Record<string, FingeringMask> = {
  '0': OPEN_FINGERING, '1': '00001000', '2': '00000100', '3': '00000010',
  '12': '00001100', '13': '00001010', '23': '00000110', '123': '00001110',
};
// F♯3 through C6, in semitone order. Includes the alternate fingerings in
// Yamaha's chart: https://www.yamaha.com/en/musical_instrument_guide/common/images/trumpet/fingering.pdf
// Enharmonic spellings share written chromatic pitch, but octaves remain distinct.
const chart = [
  ['123'], ['13'], ['23'], ['12','3'], ['1'], ['2'],
  ['0'], ['123'], ['13'], ['23'], ['12','3'], ['1'],
  ['2'], ['0','13'], ['23'], ['12','3'], ['1'], ['2'],
  ['0','23'], ['12'], ['1','13'], ['2','23'], ['0','12','3'], ['1'],
  ['2'], ['0','13'], ['23'], ['12','3'], ['12'], ['2'], ['0'],
];
export const trumpetFingering: FingeringConfiguration = {
  instrument: 'trumpet-bb',
  fingers: [
    { position: 4, label: '1', accessibleLabel: 'Valve 1', key: 'j' },
    { position: 5, label: '2', accessibleLabel: 'Valve 2', key: 'k' },
    { position: 6, label: '3', accessibleLabel: 'Valve 3', key: 'l' },
  ],
  pitches: Object.fromEntries(chart.map((valves, i) => [54 + i, valves.map(v => masks[v]!)])),
};
export function fingeringFor(instrument?: string) { return instrument === trumpetFingering.instrument ? trumpetFingering : undefined; }
