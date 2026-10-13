import { countAt } from './input.ts';
import type { CountingSystem } from './input.ts';
import { sourcePolicy } from './meter.ts';
import { availableCountPositions } from './positions.ts';
import { deriveMeasure } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { add, compare, divide, fraction } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';

/** Explicit prototype policy, NOT the canonical time resolution or a general counting system.
 * Simple-meter binary/thirds and compound-meter eighth grids are presentation policies. */
export function countGrid(source: RhythmMeasure, system: CountingSystem = 'numbers') {
  const policy = sourcePolicy(source);
  const measure = deriveMeasure(source);
  if (measure.beats.some(b => compare(b.duration, policy.pulse)) ||
      source.events.some(([value, m]) => !['H', 'Q', 'E', ...(policy.compound ? [] : ['S', 'W'])].includes(value) || (value === 'W' && (m?.rest || m?.dots)) || (m?.tuplet && (policy.compound || value !== 'E' || m.tuplet[0] !== 3 || m.tuplet[1] !== 2 || m.rest || m.dots || m.tieNext)) || (m?.dots ?? 0) > 1 || (value === 'S' && m?.dots) || (value === 'E' && m?.dots && (policy.compound || m.rest)) || (m?.rest && value === 'H' && m.dots))) {
    throw new Error('Uno234 currently supports 2/4, 3/4, 4/4 and 6/8 reviewed whole/half/quarter/eighth/sixteenth material; only sounded eighth triplets; no whole rests, dotted wholes, dotted sixteenths or dotted-eighth rests.');
  }
  const triplets = measure.events.some(e => e.tupletGroup !== null);
  if (measure.events.some(e => e.tupletGroup !== null && (divide(measure.events[e.tupletGroup]!.start, fraction(1, 4))[1] !== 1 || source.events[e.index - 1]?.[1]?.tieNext))) throw new Error('Triplet groups must start on quarter beats, without ties to/from members.');
  const fine = triplets || (!policy.compound && source.events.some(([v, m]) => v === 'S' || (v === 'E' && m?.dots)));
  const step = fraction(1, triplets ? 48 : fine ? 16 : 8);
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
    const triplet = event.tupletGroup !== null;
    const units = divide(position, fraction(1, triplet ? 12 : 16));
    const subdivision = policy.compound || units[1] !== 1 ? 0 : units[0] % (triplet ? 3 : 4);
    return { position, event, available: policy.compound || available.some(p => !compare(p, position)), onCount: divide(position, policy.countingUnit)[1] === 1, onPulse: beat >= 0, onset: !compare(position, event.start),
      subdivision, triplet,
      symbol: units[1] === 1 || policy.compound ? countAt(position, policy.compound, system, triplet) : '',
      label: policy.compound ? `count ${index + 1}` : `beat ${beatIndex + 1}${beat >= 0 ? '' : !fine ? ' offbeat' : ` ${triplet ? 'triplet' : 'subdivision'} ${subdivision + 1}`}`,
      dottedInternal: !policy.compound && event.written[0] === 'Q' && event.written[1]?.dots === 1 && beat < 0 && divide(position, fraction(1, 8))[1] === 1 && compare(position, event.start) > 0,
    };
  });
  return { slots, events, measure, policy, step, fine, triplets, availableSlots: slots.flatMap((slot, i) => slot.available ? [i] : []) };
}
/** Position-to-layout mapping; indices are answer slots, never musical ticks. */
export const slotX = (index: number, count: number, fine = false) => (fine ? 12 : 16) + index * ((fine ? 80 : 88) / count);

/** Extend a chosen count through following hidden subdivisions within the same event. */
export function durationEndSlot(grid: ReturnType<typeof countGrid>, tick: number): number {
  const event = grid.slots[tick]!.event;
  while (tick + 1 < event.endSlot && !grid.slots[tick + 1]!.available) tick++;
  return tick;
}
