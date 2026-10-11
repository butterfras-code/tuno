import { derivePassage } from '../../../music/measure.ts';
import type { RhythmMeasure } from '../../../music/measure.ts';
export type CountFixture = RhythmMeasure & { readonly id: string; readonly label: string };
export const countWritingFixtures: readonly CountFixture[] = [
  { id: 'half', label: 'Half • quarter • two eighths', meter: [4, 4], events: [['H'], ['Q'], ['E'], ['E']] },
  { id: 'dotted-quarter', label: 'Dotted quarter • eighth • half', meter: [4, 4], events: [['Q', { dots: 1 }], ['E'], ['H']] },
  { id: 'rest', label: 'Quarter • quarter rest • two eighths • quarter', meter: [4, 4], events: [['Q'], ['Q', { rest: true }], ['E'], ['E'], ['Q']] },
  { id: 'dotted-half', label: 'Dotted half • quarter', meter: [4, 4], events: [['H', { dots: 1 }], ['Q']] },
  { id: 'half-rest', label: 'Half rest • quarter • two eighths', meter: [4, 4], events: [['H', { rest: true }], ['Q'], ['E'], ['E']] },
  { id: 'two-rests', label: 'Two quarter rests • quarter • two eighths', meter: [4, 4], events: [['Q', { rest: true }], ['Q', { rest: true }], ['Q'], ['E'], ['E']] },
];
countWritingFixtures.forEach(f => derivePassage([f]));

export interface PassageFixture { id: string; label: string; measures: RhythmMeasure[]; wrap?: boolean }
export const tieFixtures: readonly PassageFixture[] = [
  { id: 'tie-within-beat', label: 'Tie within a beat · two eighths', measures: [{ meter: [4, 4], events: [['E', { tieNext: true }], ['E'], ['Q'], ['H']] }] },
  { id: 'tie-across-beat', label: 'Tie across a beat · two quarters', measures: [{ meter: [4, 4], events: [['Q', { tieNext: true }], ['Q'], ['H']] }] },
  { id: 'tie-across-bar', label: 'Tie across a barline', measures: [{ meter: [4, 4], events: [['H'], ['Q'], ['Q', { tieNext: true }]] }, { meter: [4, 4], events: [['Q'], ['H'], ['Q']] }] },
  { id: 'tie-dotted', label: 'Quarter tied to eighth · same sound as dotted quarter', measures: [{ meter: [4, 4], events: [['Q', { tieNext: true }], ['E'], ['E'], ['H']] }] },
  { id: 'tie-chain', label: 'Three written segments · one half-note sound', measures: [{ meter: [4, 4], events: [['E', { tieNext: true }], ['E', { tieNext: true }], ['Q'], ['H']] }] },
  { id: 'tie-offbeat', label: 'Offbeat attack tied through the next beat', measures: [{ meter: [4, 4], events: [['E'], ['E', { tieNext: true }], ['Q'], ['H']] }] },
  { id: 'syncopation', label: 'Untied offbeat quarter sustained across beat 2', measures: [{ meter: [4, 4], events: [['E'], ['Q'], ['E'], ['H']] }] },
  { id: 'tie-rests', label: 'Tied notes between separate rests', measures: [{ meter: [4, 4], events: [['Q', { rest: true }], ['E', { tieNext: true }], ['E'], ['Q', { rest: true }], ['Q']] }] },
  { id: 'tie-wrap', label: 'Barline tie across a wrapped system', wrap: true, measures: [{ meter: [4, 4], events: [['H'], ['Q'], ['Q', { tieNext: true }]] }, { meter: [4, 4], events: [['Q'], ['H'], ['Q']] }] },
];
export const meterFixtures: readonly PassageFixture[] = [
  { id: 'meter-2', label: '2/4 · quarter and eighths', measures: [{ meter: [2, 4], events: [['Q'], ['E'], ['E']] }] },
  { id: 'meter-3', label: '3/4 · quarters and eighths', measures: [{ meter: [3, 4], events: [['Q'], ['E'], ['E'], ['Q']] }] },
  { id: 'six-eighths', label: '6/8 · six eighths in two groups', measures: [{ meter: [6, 8], events: [['E'], ['E'], ['E'], ['E'], ['E'], ['E']] }] },
  { id: 'six-dotted', label: '6/8 · two dotted quarters', measures: [{ meter: [6, 8], events: [['Q', { dots: 1 }], ['Q', { dots: 1 }]] }] },
  { id: 'six-quarter-eighth', label: '6/8 · quarter + eighth in each group', measures: [{ meter: [6, 8], events: [['Q'], ['E'], ['Q'], ['E']] }] },
  { id: 'six-eighth-quarter', label: '6/8 · eighth + quarter in each group', measures: [{ meter: [6, 8], events: [['E'], ['Q'], ['E'], ['Q']] }] },
  { id: 'six-rest-first', label: '6/8 · first group dotted-quarter rest', measures: [{ meter: [6, 8], events: [['Q', { dots: 1, rest: true }], ['Q', { dots: 1 }]] }] },
  { id: 'six-rest-second', label: '6/8 · second group dotted-quarter rest', measures: [{ meter: [6, 8], events: [['Q', { dots: 1 }], ['Q', { dots: 1, rest: true }]] }] },
  { id: 'six-rest-boundary', label: '6/8 · silence split at the middle boundary', measures: [{ meter: [6, 8], events: [['E'], ['Q', { rest: true }], ['E', { rest: true }], ['Q']] }] },
  { id: 'six-adjacent-rests', label: '6/8 · separate adjacent rests', measures: [{ meter: [6, 8], events: [['Q', { rest: true }], ['E', { rest: true }], ['Q', { dots: 1 }]] }] },
  { id: 'six-tied-quarters', label: '6/8 · tied quarter equivalents', measures: [{ meter: [6, 8], events: [['E', { tieNext: true }], ['E'], ['E'], ['E', { tieNext: true }], ['E'], ['E']] }] },
  { id: 'six-tied', label: '6/8 · tied dotted-quarter equivalents', measures: [{ meter: [6, 8], events: [['Q', { tieNext: true }], ['E'], ['E', { tieNext: true }], ['Q']] }] },
  { id: 'six-bar-tie', label: '6/8 · tie across barline', measures: [{ meter: [6, 8], events: [['Q', { dots: 1 }], ['Q', { dots: 1, tieNext: true }]] }, { meter: [6, 8], events: [['Q', { dots: 1 }], ['Q', { dots: 1 }]] }] },
  { id: 'six-wrap', label: '6/8 · barline tie with visual wrap', wrap: true, measures: [{ meter: [6, 8], events: [['Q', { dots: 1 }], ['Q', { dots: 1, tieNext: true }]] }, { meter: [6, 8], events: [['Q', { dots: 1 }], ['Q', { dots: 1 }]] }] },
  { id: 'six-syncopation', label: '6/8 · count 3 attack across pulse 4', measures: [{ meter: [6, 8], events: [['Q'], ['Q'], ['Q']] }] },
];
export const practiceFixtures: readonly PassageFixture[] = [
  ...countWritingFixtures.map(f => ({ id: f.id, label: f.label, measures: [f] })), ...tieFixtures, ...meterFixtures,
];
practiceFixtures.forEach(f => derivePassage(f.measures));
