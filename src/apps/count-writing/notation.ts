import type { RhythmMeasure } from '../../music/measure.ts';
import { countGrid, slotX } from './grid.ts';
const ns = 'http://www.w3.org/2000/svg';
function node(tag: string, attrs: Record<string, string | number>) {
  const element = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}
export function renderMeasure(measure: RhythmMeasure, label = 'Practice rhythm') {
  const grid = countGrid(measure);
  const svg = node('svg', { viewBox: '0 0 800 150', role: 'group', 'aria-label': `4/4 rhythm: ${label}`, class: 'notation' });
  const x = (tick: number) => slotX(tick, grid.slots.length) * 8;
  svg.append(node('line', { x1: 80, x2: 788, y1: 100, y2: 100, stroke: 'currentColor', 'stroke-width': 2 }));
  for (const bx of [80, 788]) svg.append(node('line', { x1: bx, x2: bx, y1: 74, y2: 126, stroke: 'currentColor', 'stroke-width': 2 }));
  for (const y of [94, 122]) {
    const text = node('text', { x: 46, y, 'font-size': 34, 'font-family': 'serif', 'font-weight': 'bold', 'text-anchor': 'middle' });
    text.textContent = '4'; svg.append(text);
  }
  grid.events.forEach((event, index) => {
    const nx = x(event.startSlot);
    const group = node('g', { 'data-start': event.startSlot, 'data-duration': (event.endSlot - event.startSlot), 'data-kind': event.kind });
    if (event.kind === 'rest') {
      if (event.written[0] === 'H') {
        group.append(node('rect', { x: nx - 12, y: 90, width: 24, height: 10, fill: 'currentColor', 'data-rest': 'half' }));
      } else if (event.written[0] === 'E') {
        group.append(node('path', { d: 'M -6 20 L 8 -18 M 6 -12 C -8 -2 -14 -18 -3 -18 C 5 -18 7 -12 6 -12 Z', transform: `translate(${nx} 100)`, fill: 'currentColor', stroke: 'currentColor', 'stroke-width': 3, 'data-rest': 'eighth' }));
      } else
      group.append(node('path', { d: 'M -4 -26 L 9 -12 L 0 -2 L 10 12 C -7 4 -12 16 -2 24 C -22 17 -16 0 0 4 L -12 -10 L -4 -18 Z', transform: `translate(${nx} 100)`, fill: 'currentColor' }));
    } else {
      const hollow = event.written[0] === 'H';
      group.append(node('ellipse', { cx: nx, cy: 100, rx: 11, ry: 7.5, transform: `rotate(-20 ${nx} 100)`, fill: hollow ? 'var(--color-surface)' : 'currentColor', stroke: 'currentColor', 'stroke-width': hollow ? 2.6 : 1 }));
      group.append(node('line', { x1: nx + 10, x2: nx + 10, y1: 98, y2: 42, stroke: 'currentColor', 'stroke-width': 2.5 }));
      if (event.written[0] === 'E') {
        const previous = grid.events[index - 1], next = grid.events[index + 1];
        const pairedNext = next?.written[0] === 'E' && next.kind === 'note' && grid.slots[event.startSlot]!.onBeat && next.startSlot === event.startSlot + 1;
        const pairedPrevious = previous?.written[0] === 'E' && previous.kind === 'note' && grid.slots[previous.startSlot]!.onBeat && event.startSlot === previous.startSlot + 1;
        if (pairedNext) group.append(node('line', { x1: nx + 10, x2: x(next.startSlot) + 10, y1: 42, y2: 42, stroke: 'currentColor', 'stroke-width': 7 }));
        else if (!pairedPrevious) group.append(node('path', { d: `M ${nx + 10} 42 C ${nx + 12} 55 ${nx + 33} 56 ${nx + 23} 80 C ${nx + 25} 64 ${nx + 13} 64 ${nx + 10} 61 Z`, fill: 'currentColor' }));
      }
      if (event.written[1]?.dots) group.append(node('circle', { cx: nx + 24, cy: 92, r: 3.5, fill: 'currentColor' }));
    }
    if (event.kind === 'rest' && event.written[1]?.dots) group.append(node('circle', { cx: nx + 24, cy: 92, r: 3.5, fill: 'currentColor' }));
    svg.append(group);
  });
  return svg;
}
