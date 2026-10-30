import { stringFingerings } from './string-fingering.ts';
import type { FingerPosition } from '../../../shared/input/held-fingers.ts';
import { chromatic } from './notation.ts';
import type { AnswerSpelling, WrittenPitch } from './notation.ts';

import { OPEN_FINGERING, parseFingering, handCode } from '../../../shared/input/fingering-code.ts';
import type { FingeringCode, FingerName } from '../../../shared/input/fingering-code.ts';
export { OPEN_FINGERING, validFingering } from '../../../shared/input/fingering-code.ts';
export type { FingeringCode } from '../../../shared/input/fingering-code.ts';
export interface FingeringConfiguration {
  readonly instrument: string;
  readonly hand?: 'left' | 'right';
  readonly control?: 'valve' | 'finger';
  /** Array order is the visual arrangement; position identifies an anatomical finger. */
  readonly fingers: readonly FingerPosition[];
  /** Defaults to primary control 1 for each displayed finger. */
  readonly controls?: Partial<Record<FingerName, readonly string[]>>;
  readonly strings?: readonly string[];
  readonly combinations?: Partial<Record<FingerName, readonly (readonly string[])[]>>;
  /** Existing written chromatic pitch numbers, never concert/transposed pitch. */
  readonly pitches: Readonly<Record<number, readonly FingeringCode[]>>;
}
export interface FingeringAnswer { readonly kind: 'fingering'; readonly code: FingeringCode; readonly instrument?: string }
export interface KeyboardAnswer { readonly kind: 'keyboard'; readonly note: number; readonly matchOctave?: boolean }
export type NoteAnswer = AnswerSpelling | FingeringAnswer | KeyboardAnswer;
/** Instrument validation is separate from syntax and pitch acceptance. */
export function validInstrumentFingering(config: FingeringConfiguration, code: FingeringCode): boolean {
  try {
    const state = parseFingering(code);
    if (state.string !== undefined && !config.strings?.includes(state.string)) return false;
    return Object.entries(state.fingers).every(([name, ids]) => {
      const finger = name as FingerName;
      const controls = config.controls?.[finger] ?? (config.fingers.some(f => f.position === finger) ? ['1'] : []);
      const combinations = config.combinations?.[finger];
      return ids.every(id => controls.includes(id)) && (!ids.length || !combinations || combinations.some(choice => choice.length === ids.length && choice.every(id => ids.includes(id))));
    });
  } catch { return false; }
}
export function acceptsFingering(config: FingeringConfiguration, pitch: WrittenPitch, code: FingeringCode, string?: string) {
  if (!validInstrumentFingering(config, code)) return false;
  const input = parseFingering(code);
  if (string !== undefined && input.string !== undefined && input.string !== string) return false;
  const requiredString = string ?? input.string;
  return Boolean(config.pitches[chromatic(pitch)]?.some(choice => validInstrumentFingering(config, choice)
    && (requiredString === undefined || parseFingering(choice).string === requiredString)
    && handCode(choice) === handCode(code)));
}
const codes: Record<string, FingeringCode> = {
  '0': OPEN_FINGERING, '1': '00000|01000', '2': '00000|00100', '3': '00000|00010',
  '12': '00000|01100', '13': '00000|01010', '23': '00000|00110', '123': '00000|01110',
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
    { position: 'rightIndex', label: '1', accessibleLabel: 'Valve 1', key: 'j' },
    { position: 'rightMiddle', label: '2', accessibleLabel: 'Valve 2', key: 'k' },
    { position: 'rightRing', label: '3', accessibleLabel: 'Valve 3', key: 'l' },
  ],
  pitches: Object.fromEntries(chart.map((valves, i) => [54 + i, valves.map(v => codes[v]!)])),
};
export function fingeringFor(instrument?: string, valves: 3 | 4 = 3) {
  if (valves === 4 && instrument === 'euphonium') return euphoniumFourValveFingering;
  if (valves === 4 && instrument === 'tuba') return tubaFourValveFingering;
  return [trumpetFingering, euphoniumFingering, tubaFingering, hornFingering, ...stringFingerings].find(config => config.instrument === instrument);
}

/** Three-valve B♭ bass-clef instruments; written notes are already concert pitch.
 * The same valve series is 14 / 26 semitones below written trumpet pitch.
 * Cross-check: https://olemiss.edu/lowbrass/studio/fingeringcharts/euphbcfingering.pdf
 * and https://www.yamaha.com/en/musical_instrument_guide/tuba/play/play002.html
 */
function bassBrass(instrument: string, offset: number): FingeringConfiguration {
  return { instrument, fingers: trumpetFingering.fingers,
    pitches: Object.fromEntries(Object.entries(trumpetFingering.pitches).map(([note, codes]) => [Number(note) - offset, codes])) };
}
export const euphoniumFingering = bassBrass('euphonium', 14);
export const tubaFingering = bassBrass('tuba', 26);

/** Standard fourth-valve substitutions in the existing range: 4 for 1+3,
 * 2+4 for 1+2+3. These do not enter the model-dependent pedal register.
 * Additional common alternatives (E3, B3, B♭2 on euphonium) are from Everett.
 */
function fourValve(base: FingeringConfiguration, octaveOffset: number): FingeringConfiguration {
  const pitches = Object.fromEntries(Object.entries(base.pitches).map(([pitch, choices]) => {
    const extra = choices.flatMap(code => code === '00000|01010' ? ['00000|00001'] : code === '00000|01110' ? ['00000|00101'] : []);
    const euphoniumPitch = Number(pitch) + octaveOffset;
    if (euphoniumPitch === 52 || euphoniumPitch === 59) extra.push('00000|00101');
    if (euphoniumPitch === 46) extra.push('00000|01001');
    return [pitch, [...new Set([...choices, ...extra])]];
  }));
  return { ...base, fingers: [...base.fingers, { position: 'rightLittle', label: '4', accessibleLabel: 'Valve 4', key: ';' }], pitches };
}
export const euphoniumFourValveFingering = fourValve(euphoniumFingering, 0);
export const tubaFourValveFingering = fourValve(tubaFingering, 12);

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
  instrument: 'horn-f', hand: 'left',
  fingers: [
    { position: 'leftIndex', label: '1', accessibleLabel: 'Valve 1', key: 'e' },
    { position: 'leftMiddle', label: '2', accessibleLabel: 'Valve 2', key: 'w' },
    { position: 'leftRing', label: '3', accessibleLabel: 'Valve 3', key: 'q' },
    { position: 'leftThumb', label: 'T', accessibleLabel: 'Thumb trigger — B♭ side', key: 'v' },
  ],
  pitches: Object.fromEntries(hornChart.map((choices,i) => [36+i, choices.map(choice =>
    `0${choice.includes('3') ? 1 : 0}${choice.includes('2') ? 1 : 0}${choice.includes('1') ? 1 : 0}${choice.includes('T') ? 1 : 0}|00000`)])),
};

/** Keyboard answers use written pitch class unless octave matching is requested. */
export function acceptsKeyboard(pitch: WrittenPitch, answer: KeyboardAnswer): boolean {
  return answer.matchOctave ? chromatic(pitch) === answer.note : chromatic(pitch) % 12 === answer.note % 12;
}
