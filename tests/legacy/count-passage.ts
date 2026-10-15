/** Historical counting contract regression helper; never imported by the application. */
import type { CountingSystem } from '../../src/apps/count-writing/input.ts';
import { derivePassage } from '../score-test-support.ts';
import type { RhythmMeasure } from '../score-test-support.ts';
import { compare, divide, fraction } from '../../src/music/fraction.ts';
import { countGrid } from '../../src/apps/count-writing/grid.ts';
import type { Span } from './count-evaluation.ts';

/** Derived answer coordinates only. Authored music stays in RhythmMeasure. */
export function passageGrid(source: readonly RhythmMeasure[], system: CountingSystem = 'numbers') {
  const derived = derivePassage(source);
  if (derived.attacks.some(a => a.sources.length > 1 && a.sources.some(r => source[r.measure]!.notes[r.event]!.timeModification))) throw new Error('Uno234 does not support ties involving triplet members.');
  const grids = source.map(m => countGrid(m, system));
  const offsets = grids.map((_, index) => grids.slice(0, index).reduce((sum, grid) => sum + grid.slots.length, 0));
  const sounding = derived.attacks.map(attack => {
    const first = attack.sources[0]!, last = attack.sources.at(-1)!;
    return {
      start: offsets[first.measure]! + grids[first.measure]!.events[first.event]!.startSlot,
      end: offsets[last.measure]! + grids[last.measure]!.events[last.event]!.endSlot - 1,
      duration: attack.duration,
      tied: attack.sources.length > 1,
      rest: false,
    };
  });
  grids.forEach((grid, measure) => grid.events.filter(e => e.kind === 'rest').forEach(event => sounding.push({
    start: offsets[measure]! + event.startSlot, end: offsets[measure]! + event.endSlot - 1, duration: event.duration, tied: false, rest: true,
  })));
  const slots = grids.flatMap((grid, measure) => grid.slots.map((slot, index) => {
    const position = offsets[measure]! + index;
    const sound = sounding.find(s => s.start <= position && s.end >= position)!;
    const attack = sound.start === position;
    const dottedInternal = compare(sound.duration, fraction(3, 8)) === 0 && !slot.onCount && divide(slot.position, fraction(1, 8))[1] === 1 && !attack;
    return { ...slot, measure, index, sound, attack, dottedInternal, available: slot.available || dottedInternal };
  }));
  grids.forEach((grid, measure) => {
    grid.slots.forEach((slot, index) => { slot.available = slots[offsets[measure]! + index]!.available; });
    grid.availableSlots = grid.slots.flatMap((slot, i) => slot.available ? [i] : []);
  });
  const sustained = sounding.filter(sound => sound.tied || slots.some((s, i) => i > sound.start && i <= sound.end && s.onCount));
  return { grids, offsets, slots, sounding, sustained, available: slots.flatMap((s, i) => s.available ? [i] : []) };
}
export type PassageGrid = ReturnType<typeof passageGrid>;
/** End after trailing hidden positions, stopping at the sounding release. */
export function passageDurationEnd(grid: PassageGrid, position: number) {
  const sound = grid.slots[position]!.sound;
  while (position < sound.end && !grid.slots[position + 1]!.available) position++;
  return position;
}
/** Project a logical answer into visual measure pieces; never use these pieces for grading. */
export function spanPieces(span: Span, sizes: readonly number[]) {
  const offsets = sizes.map((_, index) => sizes.slice(0, index).reduce((sum, size) => sum + size, 0));
  const measures = sizes.length;
  return Array.from({ length: measures }, (_, measure) => ({
    measure,
    start: Math.max(span.start - offsets[measure]!, 0),
    end: Math.min(span.end - offsets[measure]!, sizes[measure]! - 1),
    incoming: span.start < offsets[measure]!,
    outgoing: span.end >= offsets[measure]! + sizes[measure]!,
  })).filter(piece => piece.start <= piece.end && span.end >= offsets[piece.measure]! && span.start < offsets[piece.measure]! + sizes[piece.measure]!);
}
