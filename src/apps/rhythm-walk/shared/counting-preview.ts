import { note, score } from '../../../music/measure.ts';
import { divide } from '../../../music/fraction.ts';
import { buildCountingPlan } from '../../../music/counting/plan.ts';
import type { CountingPreferences } from '../../../music/counting/preferences.ts';
import { countGrid, slotX } from '../../count-writing/grid.ts';
import { displayCount } from '../../count-writing/input.ts';
import { el } from '../../../shared/ui/components.ts';
import { renderMeasure, responsiveNotation } from './notation.ts';

/** One authored passage, independent of generation settings and the active exercise. */
export const countingPreviewScore = score([
  { meter: [4, 4], notes: [note('half'), ...Array.from({ length: 4 }, () => note('eighth'))] },
  { meter: [4, 4], notes: [note('quarter', { dots: 1 }), note('eighth'), note('half', { kind: 'rest' })] },
  { meter: [4, 4], notes: [...Array.from({ length: 4 }, () => note('16th')), note('half', { dots: 1 })] },
]);
const ns = 'http://www.w3.org/2000/svg';
function svgNode(tag: string, attributes: Record<string, string | number>, text?: string) {
  const result = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, String(value));
  if (text) result.textContent = text;
  return result;
}

// Static examples need less horizontal spacing than editable answer targets.
const measureWidth = 480;
const horizontalScale = measureWidth / 800;

/** Answered notation, using shared glyphs and counting with compact preview spacing. */
export function renderCountingPreview(preferences: CountingPreferences) {
  const source = countingPreviewScore;
  const plan = buildCountingPlan(source, preferences);
  const strip = el('div', 'counting-preview-strip');
  strip.setAttribute('role', 'img');
  strip.setAttribute('aria-label', source.measures.map((_, i) => `Measure ${i + 1}: ${plan.counts.filter(c => c.measure === i).map(c => displayCount(c.expectedToken, preferences.offbeat)).join(' ') || 'no counts'}`).join('. '));
  source.measures.forEach((measure, index) => {
    const grid = countGrid(measure);
    const x = (position: readonly [number, number]) => {
      const slot = divide(position, grid.step);
      return slotX(slot[0] / slot[1], grid.slots.length, grid.fine) * 8 * horizontalScale;
    };
    const svg = renderMeasure(measure, 'Counting preview', { first: index === 0, last: index === source.measures.length - 1 });
    responsiveNotation(svg)(measureWidth, 1);
    svg.style.removeProperty('height');
    svg.setAttribute('viewBox', `0 24 ${measureWidth} 170`);
    svg.setAttribute('class', 'counting-preview-notation');
    svg.setAttribute('aria-hidden', 'true');
    svg.removeAttribute('role'); svg.removeAttribute('aria-label');
    const fontSize = 32;
    plan.units.filter(u => u.counts[0]?.measure === index).forEach(unit => {
      const first = unit.counts[0]!, last = unit.counts.at(-1)!;
      if (unit.durationApplicable && preferences.showDurationLine) {
        const y = preferences.linePlacement === 'above' ? 112 : preferences.linePlacement === 'below' ? 182 : 148;
        svg.append(svgNode('line', { x1: x(first.localPosition) + (preferences.linePlacement === 'beside' ? 20 : 0), x2: x(last.localPosition) + 20, y1: y, y2: y, stroke: 'currentColor', 'stroke-width': 3 }));
      }
      unit.counts.forEach((count, ci) => {
        const internal = ci > 0 && unit.durationApplicable;
        const y = internal && preferences.internalAppearance !== 'unchanged' ? (preferences.internalAppearance === 'raised' ? 140 : 170) : 158;
        const token = displayCount(count.expectedToken, preferences.offbeat);
        svg.append(svgNode('text', { x: x(count.localPosition), y, 'font-size': internal && preferences.internalAppearance !== 'unchanged' ? fontSize * .78 : fontSize, 'text-anchor': 'middle', fill: 'currentColor', stroke: 'var(--notation-surface, var(--color-surface))', 'stroke-width': 5, 'paint-order': 'stroke' }, token));
        if (unit.expectedRest && preferences.restAppearance === 'slashes') svg.append(svgNode('line', { x1: x(count.localPosition) - 13, x2: x(count.localPosition) + 13, y1: y + 4, y2: y - 26, stroke: 'currentColor', 'stroke-width': 3 }));
      });
      if (unit.expectedRest && preferences.restAppearance === 'parentheses') {
        for (const [position, text, offset] of [[first.localPosition, '(', -24], [last.localPosition, ')', 24]] as const) svg.append(svgNode('text', { x: x(position) + offset, y: 161, 'font-size': fontSize + 4, 'text-anchor': 'middle', fill: 'currentColor' }, text));
      }
    });
    strip.append(svg);
  });
  return strip;
}

