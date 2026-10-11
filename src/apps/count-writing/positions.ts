import { deriveMeasure } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { add, compare, divide, fraction } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';

/** Available input positions are a presentation policy, independent of required answers. */
export function availableCountPositions(source: RhythmMeasure): Fraction[] {
  const measure = deriveMeasure(source);
  const base = fraction(1, source.meter[1]);
  const positions = new Map<string, Fraction>();
  const include = (position: Fraction) => positions.set(position.join('/'), position);
  measure.beats.forEach(beat => include(beat.start));
  measure.events.forEach(event => {
    include(event.start);
    // Dots require the smallest component of the written value; tuplets retain exact time.
    const unit = divide(event.duration, fraction(2 ** ((event.written[1]?.dots ?? 0) + 1) - 1));
    const step = !event.written[1]?.tuplet && !event.written[1]?.dots && compare(event.duration, base) > 0
      ? divide(event.duration, fraction(2)) : unit;
    measure.beats.forEach(beat => {
      const end = add(beat.start, beat.duration);
      if (compare(event.start, end) >= 0 || compare(event.end, beat.start) <= 0) return;
      // Find the exact common lattice, e.g. quarter-note triplets need thirds of a beat.
      const ratio = divide(beat.duration, step);
      const subdivision = divide(beat.duration, fraction(ratio[0]));
      for (let p = beat.start; compare(p, end) < 0; p = add(p, subdivision)) include(p);
    });
  });
  return [...positions.values()].sort(compare);
}
