import { derivePassage } from './measure.ts';
import type { RhythmMeasure, NoteValue } from './measure.ts';
import { createScore } from './score.ts';
import type { RhythmScore } from './score.ts';
import type { WrittenType } from './written.ts';
const types: Record<NoteValue, WrittenType> = { W: 'whole', H: 'half', Q: 'quarter', E: 'eighth', S: '16th' };
/** Migration owner: music core. One-way detached snapshot, never an editable mirror.
 * Current callers: foundation tests. Future caller: exercise creation, until generators
 * and fixtures emit RhythmScore directly; then delete this adapter. */
export function scoreFromLegacy(measures: readonly RhythmMeasure[]): RhythmScore {
  derivePassage(measures);
  return createScore({ measures: measures.map((m, mi) => {
    const expected = m.meter[1] === 8 ? [3, 3] : Array(m.meter[0]).fill(1);
    if (m.groups && JSON.stringify(m.groups) !== JSON.stringify(expected)) throw new Error('Custom grouping outside MusicXML profile.');
    if (m.meter[1] !== 4 && m.meter[1] !== 8) throw new Error('Unsupported profile meter.');
    return { meter: [m.meter[0], m.meter[1]], notes: m.events.map(([v, o], ei) => ({
      id: `m${mi + 1}n${ei + 1}`, kind: o?.rest ? 'rest' : 'note', type: types[v], dots: o?.dots ?? 0,
      ...(o?.tuplet ? { timeModification: o.tuplet } : {}), tieNext: o?.tieNext ?? false,
    })) };
  }) });
}
