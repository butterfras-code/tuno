import { derivePassage } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { countGrid, slotX } from './grid.ts';
const ns = 'http://www.w3.org/2000/svg';
function node(tag: string, attrs: Record<string, string | number>) {
  const element = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}
export function renderMeasure(measure: RhythmMeasure, label = 'Practice rhythm', passage: { first: boolean; last: boolean } = { first: true, last: true }) {
  const grid = countGrid(measure);
  const svg = node('svg', { viewBox: '0 0 800 150', role: 'group', 'aria-label': `${measure.meter.join("/")} rhythm: ${label}`, class: 'notation' });
  const x = (tick: number) => slotX(tick, grid.slots.length) * 8;
  svg.append(node('line', { x1: passage.first ? 80 : 0, x2: passage.last ? 798 : 800, y1: 100, y2: 100, stroke: 'currentColor', 'stroke-width': 2 }));
  for (const bx of passage.first ? [80, passage.last ? 798 : 800] : [passage.last ? 798 : 800]) svg.append(node('line', { x1: bx, x2: bx, y1: 74, y2: 126, stroke: 'currentColor', 'stroke-width': passage.last && bx !== 80 ? 4 : 2 }));
  if (passage.last) svg.append(node('line', { x1: 790, x2: 790, y1: 74, y2: 126, stroke: 'currentColor', 'stroke-width': 2 }));
  if (passage.first) for (const y of [94, 122]) {
    const text = node('text', { x: 46, y, 'font-size': 34, 'font-family': 'serif', 'font-weight': 'bold', 'text-anchor': 'middle' });
    text.textContent = String(measure.meter[y === 94 ? 0 : 1]); svg.append(text);
  }
  grid.events.forEach((event, index) => {
    const nx = x(event.startSlot);
    const group = node('g', { 'data-start': event.startSlot, 'data-duration': (event.endSlot - event.startSlot), 'data-kind': event.kind, 'data-value': event.written[0], 'data-dots': event.written[1]?.dots ?? 0, 'data-tie-next': String(Boolean(event.written[1]?.tieNext)) });
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
        const pairedNext = next?.written[0] === 'E' && next.kind === 'note' && Math.floor(event.startSlot / grid.policy.groupSlots) === Math.floor(next.startSlot / grid.policy.groupSlots) && next.startSlot === event.startSlot + 1;
        const pairedPrevious = previous?.written[0] === 'E' && previous.kind === 'note' && Math.floor(previous.startSlot / grid.policy.groupSlots) === Math.floor(event.startSlot / grid.policy.groupSlots) && event.startSlot === previous.startSlot + 1;
        if (pairedNext) group.append(node('line', { x1: nx + 10, x2: x(next.startSlot) + 10, y1: 42, y2: 42, stroke: 'currentColor', 'stroke-width': 7, 'data-beam': 'true' }));
        else if (!pairedPrevious) group.append(node('path', { d: `M ${nx + 10} 42 C ${nx + 12} 55 ${nx + 33} 56 ${nx + 23} 80 C ${nx + 25} 64 ${nx + 13} 64 ${nx + 10} 61 Z`, fill: 'currentColor' }));
      }
      if (event.written[1]?.dots) group.append(node('circle', { cx: nx + 24, cy: 92, r: 3.5, fill: 'currentColor' }));
    }
    if (event.kind === 'rest' && event.written[1]?.dots) group.append(node('circle', { cx: nx + 24, cy: 92, r: 3.5, fill: 'currentColor' }));
    svg.append(group);

  });
  return svg;
}

/** Engrave ties in screen geometry so adjacent bars share one uninterrupted curve. */
export function renderPassageTies(source: readonly RhythmMeasure[], strip: HTMLElement) {
  const events = derivePassage(source).measures.flatMap((measure, bar) => measure.events.map(event => ({ ...event, bar })));
  const overlay = node('svg', { class: 'passage-ties', 'aria-hidden': 'true' });
  strip.append(overlay);
  const cards = [...strip.querySelectorAll<HTMLElement>('.passage-measure')];
  let frame = 0;
  function refresh() {
    overlay.replaceChildren();
    if (!strip.getClientRects().length) return;
    const origin = strip.getBoundingClientRect();
    const width = Math.max(0, ...cards.map(card => card.getBoundingClientRect().right - origin.left));
    const height = strip.getBoundingClientRect().height;
    overlay.setAttribute('width', String(width)); overlay.setAttribute('height', String(height));
    const head = (bar: number, index: number) => cards[bar]!.querySelectorAll<SVGGElement>('g[data-start]')[index]!.querySelector('ellipse')!.getBoundingClientRect();
    function arc(x1: number, y1: number, x2: number, y2: number, kind: string, bar: number) {
      const length = x2 - x1;
      // Tapered tips, gentle shoulders, and a bounded depth at every responsive width.
      const depth = Math.max(8, Math.min(18, length * .13));
      const c1 = x1 + length * .24, c2 = x2 - length * .24;
      const shoulder = Math.max(y1, y2) + depth;
      overlay.append(node('path', { d: `M ${x1} ${y1} C ${c1} ${shoulder} ${c2} ${shoulder} ${x2} ${y2} C ${c2} ${shoulder - 2.3} ${c1} ${shoulder - 2.3} ${x1} ${y1} Z`, fill: 'currentColor', 'data-tie': kind, 'data-measure': bar + 1 }));
    }
    events.forEach((event, index) => {
      if (!event.written[1]?.tieNext) return;
      const next = events[index + 1]!;
      const from = head(event.bar, event.index), to = head(next.bar, next.index);
      const x1 = from.x + from.width / 2 + 2 - origin.x, x2 = to.x + to.width / 2 - 2 - origin.x;
      const y1 = from.bottom + 3 - origin.y, y2 = to.bottom + 3 - origin.y;
      const wrapped = Math.abs(cards[event.bar]!.getBoundingClientRect().top - cards[next.bar]!.getBoundingClientRect().top) > 1;
      if (wrapped) {
        // Broken ties retain separate tapered hooks rather than dipping into the next system.
        arc(x1, y1, cards[event.bar]!.getBoundingClientRect().right - origin.x - 3, y1, 'outgoing', event.bar);
        arc(cards[next.bar]!.getBoundingClientRect().left - origin.x + 3, y2, x2, y2, 'incoming', next.bar);
      } else arc(x1, y1, x2, y2, event.bar === next.bar ? 'within' : 'across-bar', event.bar);
    });
  }
  const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(refresh); });
  observer.observe(strip); cards.forEach(card => observer.observe(card));
  refresh();
  return { refresh, destroy: () => { cancelAnimationFrame(frame); observer.disconnect(); overlay.remove(); } };
}
