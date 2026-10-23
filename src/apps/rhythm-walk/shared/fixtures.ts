import { note, score } from '../../../music/measure.ts';
import type { RhythmEvent, RhythmMeasure } from '../../../music/measure.ts';
export type CountFixture = RhythmMeasure & { readonly id: string; readonly label: string };
function singleFixtures(definitions: readonly CountFixture[]): readonly CountFixture[] {
  return definitions.map(f => ({ ...f, ...score([f]).measures[0]! }));
}
export const countWritingFixtures: readonly CountFixture[] = singleFixtures([
  { id: 'half', label: 'Half • quarter • two eighths', meter: [4, 4], notes: [note('half'), note('quarter'), note('eighth'), note('eighth')] },
  { id: 'dotted-quarter', label: 'Dotted quarter • eighth • half', meter: [4, 4], notes: [note('quarter', { dots: 1 }), note('eighth'), note('half')] },
  { id: 'rest', label: 'Quarter • quarter rest • two eighths • quarter', meter: [4, 4], notes: [note('quarter'), note('quarter', { kind: 'rest' }), note('eighth'), note('eighth'), note('quarter')] },
  { id: 'dotted-half', label: 'Dotted half • quarter', meter: [4, 4], notes: [note('half', { dots: 1 }), note('quarter')] },
  { id: 'whole', label: 'Whole note · four beats', meter: [4, 4], notes: [note('whole')] },
  { id: 'half-rest', label: 'Half rest • quarter • two eighths', meter: [4, 4], notes: [note('half', { kind: 'rest' }), note('quarter'), note('eighth'), note('eighth')] },
  { id: 'two-rests', label: 'Two quarter rests • quarter • two eighths', meter: [4, 4], notes: [note('quarter', { kind: 'rest' }), note('quarter', { kind: 'rest' }), note('quarter'), note('eighth'), note('eighth')] },
]);


export interface PassageFixture { id: string; label: string; score: import('../../../music/score.ts').RhythmScore; wrap?: boolean }
function fixtures(definitions: readonly { id: string; label: string; measures: readonly RhythmMeasure[]; wrap?: boolean }[]): PassageFixture[] {
  return definitions.map(({ measures, ...metadata }) => ({ ...metadata, score: score(measures) }));
}
export const tieFixtures: readonly PassageFixture[] = fixtures([
  { id: 'tie-within-beat', label: 'Tie within a beat · two eighths', measures: [{ meter: [4, 4], notes: [note('eighth', { tieNext: true }), note('eighth'), note('quarter'), note('half')] }] },
  { id: 'tie-across-beat', label: 'Tie across a beat · two quarters', measures: [{ meter: [4, 4], notes: [note('quarter', { tieNext: true }), note('quarter'), note('half')] }] },
  { id: 'tie-across-bar', label: 'Tie across a barline', measures: [{ meter: [4, 4], notes: [note('half'), note('quarter'), note('quarter', { tieNext: true })] }, { meter: [4, 4], notes: [note('quarter'), note('half'), note('quarter')] }] },
  { id: 'tie-dotted', label: 'Quarter tied to eighth · same sound as dotted quarter', measures: [{ meter: [4, 4], notes: [note('quarter', { tieNext: true }), note('eighth'), note('eighth'), note('half')] }] },
  { id: 'tie-chain', label: 'Three written segments · one half-note sound', measures: [{ meter: [4, 4], notes: [note('eighth', { tieNext: true }), note('eighth', { tieNext: true }), note('quarter'), note('half')] }] },
  { id: 'tie-offbeat', label: 'Offbeat attack tied through the next beat', measures: [{ meter: [4, 4], notes: [note('eighth'), note('eighth', { tieNext: true }), note('quarter'), note('half')] }] },
  { id: 'syncopation', label: 'Untied offbeat quarter sustained across beat 2', measures: [{ meter: [4, 4], notes: [note('eighth'), note('quarter'), note('eighth'), note('half')] }] },
  { id: 'tie-rests', label: 'Tied notes between separate rests', measures: [{ meter: [4, 4], notes: [note('quarter', { kind: 'rest' }), note('eighth', { tieNext: true }), note('eighth'), note('quarter', { kind: 'rest' }), note('quarter')] }] },
  { id: 'tie-wrap', label: 'Barline tie across a wrapped system', wrap: true, measures: [{ meter: [4, 4], notes: [note('half'), note('quarter'), note('quarter', { tieNext: true })] }, { meter: [4, 4], notes: [note('quarter'), note('half'), note('quarter')] }] },
]);
export const meterFixtures: readonly PassageFixture[] = fixtures([
  { id: 'six-dotted-half', label: '6/8 · written dotted half', measures: [{ meter: [6, 8], notes: [note('half', { dots: 1 })] }] },
  { id: 'six-dotted-tie', label: '6/8 · two tied written dotted quarters', measures: [{ meter: [6, 8], notes: [note('quarter', { dots: 1, tieNext: true }), note('quarter', { dots: 1 })] }] },
  { id: 'all-rests', label: 'All rests · optional empty counting surface', measures: [{ meter: [4, 4], notes: [note('half', { kind: 'rest' }), note('half', { kind: 'rest' })] }] },
  { id: 'meter-2', label: '2/4 · quarter and eighths', measures: [{ meter: [2, 4], notes: [note('quarter'), note('eighth'), note('eighth')] }] },
  { id: 'meter-3', label: '3/4 · quarters and eighths', measures: [{ meter: [3, 4], notes: [note('quarter'), note('eighth'), note('eighth'), note('quarter')] }] },
  { id: 'six-eighths', label: '6/8 · six eighths in two groups', measures: [{ meter: [6, 8], notes: [note('eighth'), note('eighth'), note('eighth'), note('eighth'), note('eighth'), note('eighth')] }] },
  { id: 'six-dotted', label: '6/8 · two dotted quarters', measures: [{ meter: [6, 8], notes: [note('quarter', { dots: 1 }), note('quarter', { dots: 1 })] }] },
  { id: 'six-quarter-eighth', label: '6/8 · quarter + eighth in each group', measures: [{ meter: [6, 8], notes: [note('quarter'), note('eighth'), note('quarter'), note('eighth')] }] },
  { id: 'six-eighth-quarter', label: '6/8 · eighth + quarter in each group', measures: [{ meter: [6, 8], notes: [note('eighth'), note('quarter'), note('eighth'), note('quarter')] }] },
  { id: 'six-rest-first', label: '6/8 · first group dotted-quarter rest', measures: [{ meter: [6, 8], notes: [note('quarter', { dots: 1, kind: 'rest' }), note('quarter', { dots: 1 })] }] },
  { id: 'six-rest-second', label: '6/8 · second group dotted-quarter rest', measures: [{ meter: [6, 8], notes: [note('quarter', { dots: 1 }), note('quarter', { dots: 1, kind: 'rest' })] }] },
  { id: 'six-rest-boundary', label: '6/8 · silence split at the middle boundary', measures: [{ meter: [6, 8], notes: [note('eighth'), note('quarter', { kind: 'rest' }), note('eighth', { kind: 'rest' }), note('quarter')] }] },
  { id: 'six-adjacent-rests', label: '6/8 · separate adjacent rests', measures: [{ meter: [6, 8], notes: [note('quarter', { kind: 'rest' }), note('eighth', { kind: 'rest' }), note('quarter', { dots: 1 })] }] },
  { id: 'six-tied-quarters', label: '6/8 · tied quarter equivalents', measures: [{ meter: [6, 8], notes: [note('eighth', { tieNext: true }), note('eighth'), note('eighth'), note('eighth', { tieNext: true }), note('eighth'), note('eighth')] }] },
  { id: 'six-tied', label: '6/8 · tied dotted-quarter equivalents', measures: [{ meter: [6, 8], notes: [note('quarter', { tieNext: true }), note('eighth'), note('eighth', { tieNext: true }), note('quarter')] }] },
  { id: 'six-bar-tie', label: '6/8 · tie across barline', measures: [{ meter: [6, 8], notes: [note('quarter', { dots: 1 }), note('quarter', { dots: 1, tieNext: true })] }, { meter: [6, 8], notes: [note('quarter', { dots: 1 }), note('quarter', { dots: 1 })] }] },
  { id: 'six-wrap', label: '6/8 · barline tie with visual wrap', wrap: true, measures: [{ meter: [6, 8], notes: [note('quarter', { dots: 1 }), note('quarter', { dots: 1, tieNext: true })] }, { meter: [6, 8], notes: [note('quarter', { dots: 1 }), note('quarter', { dots: 1 })] }] },
  { id: 'six-syncopation', label: '6/8 · count 3 attack across pulse 4', measures: [{ meter: [6, 8], notes: [note('quarter'), note('quarter'), note('quarter')] }] },
]);
/** Independent written review examples; expectations are recorded in sixteenths.md. */
export const sixteenthFixtures: readonly PassageFixture[] = fixtures([
  { id: 'four-sixteenths', label: 'Four sixteenths · mixed vocabulary', measures: [{ meter: [4, 4], notes: [note('16th'), note('16th'), note('16th'), note('16th'), note('quarter'), note('half')] }] },
  { id: 'eighth-two-sixteenths', label: 'Eighth + two sixteenths', measures: [{ meter: [2, 4], notes: [note('eighth'), note('16th'), note('16th'), note('quarter')] }] },
  { id: 'two-sixteenths-eighth', label: 'Two sixteenths + eighth', measures: [{ meter: [2, 4], notes: [note('16th'), note('16th'), note('eighth'), note('quarter')] }] },
  { id: 'dotted-eighth-sixteenth', label: 'Dotted eighth + sixteenth', measures: [{ meter: [3, 4], notes: [note('eighth', { dots: 1 }), note('16th'), note('quarter'), note('quarter')] }] },
  { id: 'sixteenth-rests', label: 'Sixteenth rests at all four subdivisions', measures: [{ meter: [4, 4], notes: Array.from({ length: 16 }, (_, i) => note('16th', { kind: (Math.floor(i / 4) === i % 4 ) ? 'rest' : 'note'})) }] },
  { id: 'sixteenth-all-rests', label: 'Sixteenth rests · adjacent pairs', measures: [{ meter: [4, 4], notes: Array.from({ length: 16 }, () => note('16th', { kind: 'rest' })) }] },
  { id: 'sixteenth-tie', label: 'Sixteenth tie within a beat', measures: [{ meter: [2, 4], notes: [note('16th', { tieNext: true }), note('16th'), note('eighth'), note('quarter')] }] },
  { id: 'sixteenth-bar-tie', label: 'Sixteenth tie across a barline/system', wrap: true, measures: [{ meter: [2, 4], notes: [note('quarter'), note('eighth'), note('16th'), note('16th', { tieNext: true })] }, { meter: [2, 4], notes: [note('16th'), note('16th'), note('eighth'), note('quarter')] }] },
  { id: 'dense-sixteenths', label: 'Dense sixteenths · four bars', measures: Array.from({ length: 4 }, () => ({ meter: [4, 4] as const, notes: Array.from({ length: 16 }, () => note('16th')) })) },
]);

/** Shared written sources; the canonical compiler supplies all tuplet group IDs. */
const triplet = (): RhythmEvent[] => Array.from({ length: 3 }, () => note('eighth', { timeModification: [3, 2] }));
const mixedTripletBar = (): RhythmMeasure => ({ meter: [4, 4], notes: [...triplet(), note('eighth'), note('eighth'), ...triplet(), note('16th'), note('16th'), note('16th'), note('16th')] });
export const tripletFixtures: readonly PassageFixture[] = fixtures([
  { id: 'triplet-isolated', label: 'Triplet · quarter · half', measures: [{ meter: [4, 4], notes: [...triplet(), note('quarter'), note('half')] }] },
  { id: 'triplet-consecutive', label: '2/4 · consecutive triplets', measures: [{ meter: [2, 4], notes: [...triplet(), ...triplet()] }] },
  { id: 'triplet-beat-two', label: '3/4 · triplet on beat 2', measures: [{ meter: [3, 4], notes: [note('quarter'), ...triplet(), note('quarter')] }] },
  { id: 'triplet-mixed', label: 'Triplets beside eighths and sixteenths', measures: [mixedTripletBar()] },
  { id: 'triplet-rest-tie', label: 'Triplets beside rest and ordinary tie', measures: [{ meter: [4, 4], notes: [...triplet(), note('quarter', { kind: 'rest' }), note('eighth', { tieNext: true }), note('eighth'), note('quarter')] }] },
  ...[2, 3, 4].map(length => ({ id: `triplet-mixed-${length}`, label: `Mixed triplets · ${length} bars`, measures: Array.from({ length }, mixedTripletBar) })),
]);

const uilFixtures = singleFixtures([
  { id: 'uil-percussion', label: 'UIL percussion · eighth and sixteenth figures', meter: [4, 4], notes: [note('eighth'), note('16th'), note('16th'), note('16th'), note('16th'), note('16th'), note('16th'), note('half')] },
  { id: 'uil-figures', label: 'UIL IV · dotted and syncopated figures', meter: [4, 4], notes: [note('eighth'), note('quarter'), note('eighth'), note('eighth', { dots: 1 }), note('16th'), note('eighth'), note('16th'), note('16th')] },
]);

export const practiceFixtures: readonly PassageFixture[] = [
  ...countWritingFixtures.map(f => ({ id: f.id, label: f.label, score: score([f]) })), ...tieFixtures, ...meterFixtures, ...sixteenthFixtures, ...tripletFixtures,
  ...uilFixtures.map(f => ({ id: f.id, label: f.label, score: score([f]) })),
];
