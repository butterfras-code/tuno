import type { RhythmMeasure } from '../../music/measure.ts';
export interface Exercise { readonly id: string; readonly label: string; readonly description: string; readonly measures: readonly RhythmMeasure[] }
/** Curated prototype fixtures, reviewed for exact bars and hold/rest semantics; not difficulty presets. */
export const exercises: readonly Exercise[] = [
  { id: 'quarters', label: 'Quarter steps', description: 'Eight quarter notes. Release and press again for each note.', measures: [
    { meter: [4, 4], events: [['Q'], ['Q'], ['Q'], ['Q']] },
    { meter: [4, 4], events: [['Q'], ['Q'], ['Q'], ['Q']] },
  ] },
  { id: 'mixed', label: 'Hold, rest, and eighths', description: 'Hold the half notes; stay silent through rests; press and release each eighth.', measures: [
    { meter: [4, 4], events: [['H'], ['Q'], ['E'], ['E']] },
    { meter: [4, 4], events: [['Q'], ['Q', { rest: true }], ['E'], ['E'], ['Q']] },
  ] },
  { id: 'tie', label: 'Across the barline', description: 'The tied quarters are one continuous hold across the barline, followed by a rest.', measures: [
    { meter: [4, 4], events: [['H'], ['Q', { rest: true }], ['Q', { tieNext: true }]] },
    { meter: [4, 4], events: [['Q'], ['Q', { rest: true }], ['H']] },
  ] },
];
