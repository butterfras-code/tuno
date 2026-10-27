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
export interface KeyboardAnswer { readonly kind: 'keyboard'; readonly note: number }
export type NoteAnswer = AnswerSpelling | FingeringAnswer | KeyboardAnswer;
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
  ['2'], ['0','13'], ['23'], ['12','3'], ['1'], ['2'], ['0'],
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
export function fingeringFor(instrument?: string) { return [trumpetFingering, euphoniumFingering, tubaFingering, hornFingering].find(config => config.instrument === instrument); }

/** Three-valve B♭ bass-clef instruments; written notes are already concert pitch.
 * The same valve series is 14 / 26 semitones below written trumpet pitch.
 * Cross-check: https://olemiss.edu/lowbrass/studio/fingeringcharts/euphbcfingering.pdf
 * and https://www.yamaha.com/en/musical_instrument_guide/tuba/play/play002.html
 */
function bassBrass(instrument: string, offset: number): FingeringConfiguration {
  return { instrument, fingers: trumpetFingering.fingers,
    pitches: Object.fromEntries(Object.entries(trumpetFingering.pitches).map(([note, masks]) => [Number(note) - offset, masks])) };
}
export const euphoniumFingering = bassBrass('euphonium', 14);
export const tubaFingering = bassBrass('tuba', 26);

// Written C2–G5, F/B♭ double horn resting in F. T selects the B♭ side.
// Common choices and alternates checked against Colin Dorman's double-horn chart:
// https://colindorman.com/french-horn-exercises/fingering_charts/#double
const hornChart = [
  ['0','T13'], ['T23'], ['T12','T3'], ['T1'], ['T2'], ['T0'],
  ['123'], ['13'], ['23'], ['12','3'], ['1'], ['2'],
  ['0','T13'], ['T23','123'], ['T12','T3','13'], ['T1','23'], ['T2','12','3'], ['1','T0'],
  ['2','123'], ['0','13'], ['23','T23'], ['12','3','T12'], ['1','T1'], ['2','T2'],
  ['0','T0'], ['12','T23'], ['1','T12'], ['2','T1'], ['0','T2'], ['1','T0'],
  ['2','T12'], ['0','T1'], ['T23','23'], ['T12','12','3'], ['T1','1'], ['T2','2'],
  ['T0','0'], ['T23','12','2'], ['T12','1','0'], ['T1','2'], ['T2','0'], ['T0','1'],
  ['T2','T12','2'], ['T0','0','T1'],
];
export const hornFingering: FingeringConfiguration = {
  instrument: 'horn-f',
  fingers: [
    { position: 0, label: '1', accessibleLabel: 'Valve 1', key: 'j' },
    { position: 1, label: '2', accessibleLabel: 'Valve 2', key: 'k' },
    { position: 2, label: '3', accessibleLabel: 'Valve 3', key: 'l' },
    { position: 3, label: 'T', accessibleLabel: 'Thumb trigger — B♭ side', key: 't' },
  ],
  pitches: Object.fromEntries(hornChart.map((choices,i) => [36+i, choices.map(choice =>
    `${choice.includes('1') ? 1 : 0}${choice.includes('2') ? 1 : 0}${choice.includes('3') ? 1 : 0}${choice.includes('T') ? 1 : 0}0000`)])),
};
