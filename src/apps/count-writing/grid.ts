import { sourcePolicy } from './meter.ts';
import { availableCountPositions } from './positions.ts';
import { deriveMeasure } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { add, compare, divide, fraction } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';

/** Explicit prototype policy, NOT the canonical time resolution or a general counting system.
 * Supported simple and compound eighth-grid material is currently rendered/graded. */
export function countGrid(source: RhythmMeasure) {
  const policy = sourcePolicy(source);
  const measure = deriveMeasure(source);
  if (measure.beats.some(b => compare(b.duration, policy.pulse)) ||
      source.events.some(([value, m]) => !['H', 'Q', 'E'].includes(value) || m?.tuplet || (m?.dots ?? 0) > 1 || (value === 'E' && m?.dots) || (m?.rest && value === 'H' && m.dots))) {
    throw new Error('Rhythm Walk currently supports 2/4, 3/4, 4/4 and 6/8 half/quarter/eighth material, including dotted quarters and rests only.');
  }
  const step = fraction(1, 8);
  const positions: Fraction[] = [];
  for (let position = fraction(0); compare(position, measure.length) < 0; position = add(position, step)) positions.push(position);
  const events = measure.events.map(event => ({
    ...event,
    startSlot: positions.findIndex(p => !compare(p, event.start)),
    endSlot: positions.filter(p => compare(p, event.end) < 0).length,
  }));
  const available = availableCountPositions(source);
  const slots = positions.map((position, index) => {
    const event = events.find(e => compare(position, e.start) >= 0 && compare(position, e.end) < 0)!;
    const beat = measure.beats.findIndex(b => !compare(b.start, position));
    const beatIndex = measure.beats.filter(b => compare(b.start, position) <= 0).length - 1;
    return { position, event, available: policy.compound || available.some(p => !compare(p, position)), onCount: divide(position, policy.countingUnit)[1] === 1, onPulse: beat >= 0, onset: !compare(position, event.start),
      symbol: policy.compound ? String(index + 1) : beat >= 0 ? String(beat + 1) : '&',
      label: policy.compound ? `count ${index + 1}` : `beat ${beatIndex + 1}${beat >= 0 ? '' : ' offbeat'}`,
      dottedInternal: !policy.compound && event.written[0] === 'Q' && event.written[1]?.dots === 1 && beat < 0 && compare(position, event.start) > 0,
    };
  });
  return { slots, events, measure, policy, availableSlots: slots.flatMap((slot, i) => slot.available ? [i] : []) };
}
/** Position-to-layout mapping; indices are answer slots, never musical ticks. */
export const slotX = (index: number, count: number) => 16 + index * (88 / count);

/** Extend a chosen count through following hidden subdivisions within the same event. */
export function durationEndSlot(grid: ReturnType<typeof countGrid>, tick: number): number {
  const event = grid.slots[tick]!.event;
  while (tick + 1 < event.endSlot && !grid.slots[tick + 1]!.available) tick++;
  return tick;
}
