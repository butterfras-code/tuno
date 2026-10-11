import { derivePassage } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { toNumber, divide } from '../../music/fraction.ts';
const ns = 'http://www.w3.org/2000/svg';
function svgNode(tag: string, attrs: Record<string, string | number>, text = '') {
  const n = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v))); n.textContent = text; return n;
}
/** Independent fixed-fixture engraving, based only on exact derived written positions. */
export function notation(measures: readonly RhythmMeasure[]) {
  const root = document.createElement('div'); root.className = 'score';
  const passage = derivePassage(measures);
  passage.measures.forEach((bar, m) => {
    const svg = svgNode('svg', { viewBox: '0 0 480 150', role: 'group', 'aria-label': `Measure ${m + 1}, 4/4` });
    const x = (position: typeof bar.length) => 80 + 360 * toNumber(divide(position, bar.length));
    svg.append(svgNode('text', { x: 12, y: 20, 'font-size': 14 }, `Measure ${m + 1}`));
    svg.append(svgNode('line', { x1: 50, x2: 465, y1: 95, y2: 95, stroke: 'currentColor' }));
    [50, 465].forEach(bx => svg.append(svgNode('line', { x1: bx, x2: bx, y1: 70, y2: 120, stroke: 'currentColor', 'stroke-width': 2 })));
    [88, 113].forEach(y => svg.append(svgNode('text', { x: 22, y, 'font-size': 28, 'font-family': 'serif' }, '4')));
    bar.events.forEach(e => {
      const nx = x(e.start), label = `Measure ${m + 1}, event ${e.index + 1}: ${e.written[0] === 'H' ? 'half' : e.written[0] === 'E' ? 'eighth' : 'quarter'} ${e.kind}${e.written[1]?.tieNext ? ', tied forward' : ''}`;
      const g = svgNode('g', { id: `written-${m}-${e.index}`, tabindex: 0, role: 'img', 'aria-label': label, 'data-source': `${m}:${e.index}` });
      g.append(svgNode('title', {}, label));
      if (e.kind === 'rest') g.append(svgNode('path', { d: 'M -4 -24 L 8 -12 L 0 -2 L 10 12 C -7 4 -12 16 -2 24 C -22 17 -16 0 0 4 L -12 -10 Z', transform: `translate(${nx} 95)`, fill: 'currentColor' }));
      else {
        g.append(svgNode('ellipse', { cx: nx, cy: 95, rx: 10, ry: 7, transform: `rotate(-20 ${nx} 95)`, fill: e.written[0] === 'H' ? 'var(--color-surface)' : 'currentColor', stroke: 'currentColor', 'stroke-width': 2 }));
        g.append(svgNode('line', { x1: nx + 9, x2: nx + 9, y1: 94, y2: 40, stroke: 'currentColor', 'stroke-width': 2 }));
        if (e.written[0] === 'E') {
          const next = bar.events[e.index + 1], previous = bar.events[e.index - 1];
          const pairNext = next?.written[0] === 'E' && next.kind === 'note' && Math.abs(toNumber(e.start) * 4 % 1) < 1e-9;
          const pairPrevious = previous?.written[0] === 'E' && previous.kind === 'note' && Math.abs(toNumber(previous.start) * 4 % 1) < 1e-9;
          if (pairNext) g.append(svgNode('line', { x1: nx + 9, x2: x(next.start) + 9, y1: 40, y2: 40, stroke: 'currentColor', 'stroke-width': 6 }));
          else if (!pairPrevious) g.append(svgNode('path', { d: `M ${nx + 9} 40 Q ${nx + 38} 55 ${nx + 22} 76 Q ${nx + 25} 59 ${nx + 9} 57 Z`, fill: 'currentColor' }));
        }
      }
      if (e.written[1]?.tieNext) g.append(svgNode('path', { d: `M ${nx} 110 Q ${(nx + 460) / 2} 135 460 113`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'data-tie': 'outgoing' }));
      if (e.index === 0 && m && measures[m - 1]!.events.at(-1)?.[1]?.tieNext) g.append(svgNode('path', { d: `M 55 113 Q 65 130 ${nx} 110`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'data-tie': 'incoming' }));
      svg.append(g);
    });
    root.append(svg);
  });
  return root;
}
