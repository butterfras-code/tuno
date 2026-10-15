import { note, score } from '../../music/measure.ts';
import type { RhythmScore } from '../../music/score.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
export interface Exercise { readonly id: string; readonly label: string; readonly description: string; readonly score: RhythmScore }
/** Curated prototype fixtures, reviewed for exact bars and hold/rest semantics; not difficulty presets. */
function fixtures(definitions: readonly { id: string; label: string; description: string; measures: readonly RhythmMeasure[] }[]): readonly Exercise[] {
  return definitions.map(({measures, ...metadata}) => ({ ...metadata, score: score(measures) }));
}
export const exercises: readonly Exercise[] = fixtures([
  { id: 'quarters', label: 'Quarter steps', description: 'Eight quarter notes. Release and press again for each note.', measures: [
    { meter: [4, 4], notes: [note('quarter'), note('quarter'), note('quarter'), note('quarter')] },
    { meter: [4, 4], notes: [note('quarter'), note('quarter'), note('quarter'), note('quarter')] },
  ] },
  { id: 'mixed', label: 'Hold, rest, and eighths', description: 'Hold the half notes; stay silent through rests; press and release each eighth.', measures: [
    { meter: [4, 4], notes: [note('half'), note('quarter'), note('eighth'), note('eighth')] },
    { meter: [4, 4], notes: [note('quarter'), note('quarter', { kind: 'rest' }), note('eighth'), note('eighth'), note('quarter')] },
  ] },
  { id: 'tie', label: 'Across the barline', description: 'The tied quarters are one continuous hold across the barline, followed by a rest.', measures: [
    { meter: [4, 4], notes: [note('half'), note('quarter', { kind: 'rest' }), note('quarter', { tieNext: true })] },
    { meter: [4, 4], notes: [note('quarter'), note('quarter', { kind: 'rest' }), note('half')] },
  ] },
]);
