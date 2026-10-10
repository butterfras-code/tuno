import { derivePassage } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
export type CountFixture = RhythmMeasure & { readonly id: string; readonly label: string };
export const countWritingFixtures: readonly CountFixture[] = [
  { id: 'half', label: 'Half • quarter • two eighths', meter: [4, 4], events: [['H'], ['Q'], ['E'], ['E']] },
  { id: 'dotted-quarter', label: 'Dotted quarter • eighth • half', meter: [4, 4], events: [['Q', { dots: 1 }], ['E'], ['H']] },
  { id: 'rest', label: 'Quarter • quarter rest • two eighths • quarter', meter: [4, 4], events: [['Q'], ['Q', { rest: true }], ['E'], ['E'], ['Q']] },
  { id: 'dotted-half', label: 'Dotted half • quarter', meter: [4, 4], events: [['H', { dots: 1 }], ['Q']] },
];
countWritingFixtures.forEach(f => derivePassage([f]));
