import { availableCountPositions } from './positions.ts';
import { deriveMeasure } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { compare, fraction, toNumber } from '../../music/fraction.ts';

/** Explicit prototype policy, NOT the canonical time resolution or a general counting system.
 * Only reviewed 4/4 eighth-grid material is currently rendered/graded. */
export function countGrid(source: RhythmMeasure) {
  const measure = deriveMeasure(source);
  if (source.meter[0] !== 4 || source.meter[1] !== 4 || measure.beats.some(b => compare(b.duration, fraction(1, 4))) ||
      source.events.some(([value, m]) => !['H', 'Q', 'E'].includes(value) || m?.tuplet || (m?.dots ?? 0) > 1 || (value === 'E' && m?.dots) || (m?.rest && value === 'H' && m.dots))) {
    throw new Error('Count Writing currently supports 4/4 half/quarter/eighth material, including dotted quarters and rests only.');
  }
  const step = fraction(1, 8);
  const positions = Array.from({ length: toNumber(measure.length) / toNumber(step) }, (_, i) => fraction(i, 8));
  const events = measure.events.map(event => ({
    ...event,
    startSlot: positions.findIndex(p => !compare(p, event.start)),
    endSlot: positions.filter(p => compare(p, event.end) < 0).length,
  }));
  const available = availableCountPositions(source);
  const slots = positions.map(position => {
    const event = events.find(e => compare(position, e.start) >= 0 && compare(position, e.end) < 0)!;
    const beat = measure.beats.findIndex(b => !compare(b.start, position));
    const beatIndex = measure.beats.filter(b => compare(b.start, position) <= 0).length - 1;
    return { position, event, available: available.some(p => !compare(p, position)), onBeat: beat >= 0, onset: !compare(position, event.start),
      symbol: beat >= 0 ? String(beat + 1) : '&',
      label: `beat ${beatIndex + 1}${beat >= 0 ? '' : ' offbeat'}`,
      dottedInternal: event.written[0] === 'Q' && event.written[1]?.dots === 1 && beat < 0 && compare(position, event.start) > 0,
    };
  });
  return { slots, events, measure, availableSlots: slots.flatMap((slot, i) => slot.available ? [i] : []) };
}
/** Position-to-layout mapping; indices are answer slots, never musical ticks. */
export const slotX = (index: number, count: number) => 16 + index * (88 / count);

/** Extend a chosen count through following hidden subdivisions within the same event. */
export function durationEndSlot(grid: ReturnType<typeof countGrid>, tick: number): number {
  const event = grid.slots[tick]!.event;
  while (tick + 1 < event.endSlot && !grid.slots[tick + 1]!.available) tick++;
  return tick;
}
