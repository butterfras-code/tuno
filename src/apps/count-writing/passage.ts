import { derivePassage } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { add, multiply, fraction, toNumber } from '../../music/fraction.ts';
import { countGrid } from './grid.ts';
import type { Span } from './evaluation.ts';

/** Derived answer coordinates only. Authored music stays in RhythmMeasure. */
export function passageGrid(source: readonly RhythmMeasure[]) {
  const derived = derivePassage(source);
  const grids = source.map(countGrid);
  const sounding = derived.attacks.map(attack => ({
    start: toNumber(multiply(attack.start, fraction(8))),
    end: toNumber(multiply(add(attack.start, attack.duration), fraction(8))) - 1,
    tied: attack.sources.length > 1,
    rest: false,
  }));
  grids.forEach((grid, measure) => grid.events.filter(e => e.kind === 'rest').forEach(event => sounding.push({
    start: measure * 8 + event.startSlot, end: measure * 8 + event.endSlot - 1, tied: false, rest: true,
  })));
  const slots = grids.flatMap((grid, measure) => grid.slots.map((slot, index) => {
    const position = measure * 8 + index;
    const sound = sounding.find(s => s.start <= position && s.end >= position)!;
    const attack = sound.start === position;
    const dottedInternal = sound.end - sound.start === 2 && !slot.onBeat && !attack;
    return { ...slot, measure, index, sound, attack, dottedInternal, available: slot.available || dottedInternal };
  }));
  grids.forEach((grid, measure) => {
    grid.slots.forEach((slot, index) => { slot.available = slots[measure * 8 + index]!.available; });
    grid.availableSlots = grid.slots.flatMap((slot, i) => slot.available ? [i] : []);
  });
  const sustained = sounding.filter(sound => sound.tied || slots.some((s, i) => i > sound.start && i <= sound.end && s.onBeat));
  return { grids, slots, sounding, sustained, available: slots.flatMap((s, i) => s.available ? [i] : []) };
}
export type PassageGrid = ReturnType<typeof passageGrid>;
/** End after trailing hidden positions, stopping at the sounding release. */
export function passageDurationEnd(grid: PassageGrid, position: number) {
  const sound = grid.slots[position]!.sound;
  while (position < sound.end && !grid.slots[position + 1]!.available) position++;
  return position;
}
/** Project a logical answer into visual measure pieces; never use these pieces for grading. */
export function spanPieces(span: Span, measures: number) {
  return Array.from({ length: measures }, (_, measure) => ({ measure, start: Math.max(span.start - measure * 8, 0), end: Math.min(span.end - measure * 8, 7), incoming: span.start < measure * 8, outgoing: span.end >= (measure + 1) * 8 })).filter(piece => piece.start <= piece.end && span.end >= piece.measure * 8 && span.start < (piece.measure + 1) * 8);
}
