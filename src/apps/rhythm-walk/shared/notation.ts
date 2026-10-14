import { divide } from '../../../music/fraction.ts';
import { derivePassage } from '../../../music/measure.ts';
import type { RhythmEvent, RhythmMeasure } from '../../../music/measure.ts';
import { countGrid, slotX } from '../../count-writing/grid.ts';
const ns = 'http://www.w3.org/2000/svg';
function node(tag: string, attrs: Record<string, string | number>) {
  const element = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}
function timeSignatureDigits(meter: RhythmMeasure['meter'], x: number, top: number, gap: number) {
  return meter.map((value, index) => {
    const text = node('text', { x, y: top + index * gap, 'font-size': 34, 'font-family': 'serif', 'font-weight': 'bold', 'text-anchor': 'middle', fill: 'currentColor' });
    text.textContent = String(value);
    return text;
  });
}
/** Decorative preview; the enclosing control supplies the accessible meter label. */
export function renderTimeSignature(meter: RhythmMeasure['meter']) {
  const svg = node('svg', { viewBox: '0 0 48 72', class: 'time-signature-preview', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(...timeSignatureDigits(meter, 24, 30, 30));
  return svg;
}
function writtenSymbol(written: RhythmEvent, nx: number) {
  const group = node('g', {});
  if (written[1]?.rest) {
    if (['W', 'H'].includes(written[0])) {
      group.append(node('rect', { x: nx - 12, y: written[0] === 'W' ? 100 : 90, width: 24, height: 10, fill: 'currentColor', 'data-rest': written[0] === 'W' ? 'whole' : 'half' }));
    } else if (['E', 'S'].includes(written[0])) {
      if (written[0] === 'S') group.append(node('path', { d: 'M -9 7 C -20 17 -24 1 -13 1 C -5 1 -5 7 -9 7 Z M -8 30 L 8 -18', transform: `translate(${nx} 100)`, fill: 'currentColor', stroke: 'currentColor', 'stroke-width': 3, 'data-rest': 'sixteenth' }));
      group.append(node('path', { d: 'M -6 20 L 8 -18 M 6 -12 C -8 -2 -14 -18 -3 -18 C 5 -18 7 -12 6 -12 Z', transform: `translate(${nx} 100)`, fill: 'currentColor', stroke: 'currentColor', 'stroke-width': 3, 'data-rest': 'eighth' }));
    } else
    group.append(node('path', { d: 'M -4 -26 L 9 -12 L 0 -2 L 10 12 C -7 4 -12 16 -2 24 C -22 17 -16 0 0 4 L -12 -10 L -4 -18 Z', transform: `translate(${nx} 100)`, fill: 'currentColor' }));
  } else {
    const whole = written[0] === 'W';
    const hollow = whole || written[0] === 'H';
    group.append(node('ellipse', { cx: nx, cy: 100, rx: whole ? 14 : 11, ry: whole ? 8.5 : 7.5, transform: `rotate(${whole ? 0 : -20} ${nx} 100)`, fill: hollow ? 'var(--notation-surface, var(--color-surface))' : 'currentColor', stroke: 'currentColor', 'stroke-width': hollow ? 2.6 : 1, 'data-hollow': String(hollow) }));
    if (!whole) group.append(node('line', { x1: nx + 10, x2: nx + 10, y1: 98, y2: 42, stroke: 'currentColor', 'stroke-width': 2.5 }));
  }
  if (written[1]?.dots) group.append(node('circle', { cx: nx + 24, cy: 92, r: 3.5, fill: 'currentColor' }));
  return group;
}
function appendFlags(group: Element, written: RhythmEvent, nx: number) {
  for (let level = 0; level < (written[0] === 'S' ? 2 : 1); level++) {
    const y = 42 + level * 12;
    group.append(node('path', { d: `M ${nx + 10} ${y} C ${nx + 12} ${y + 13} ${nx + 33} ${y + 14} ${nx + 23} ${y + 38} C ${nx + 25} ${y + 22} ${nx + 13} ${y + 22} ${nx + 10} ${y + 19} Z`, fill: 'currentColor', 'data-flag': level + 1 }));
  }
}
/** Ingredient previews reuse the score glyphs; enclosing labels provide their names. */
export function renderRhythmSymbol(written: RhythmEvent) {
  const triplet = Boolean(written[1]?.tuplet);
  const svg = node('svg', { viewBox: triplet ? '0 0 136 136' : '0 24 72 112', class: 'rhythm-symbol-preview', 'aria-hidden': 'true', focusable: 'false' });
  for (const x of triplet ? [22, 62, 102] : [26]) {
    const group = writtenSymbol(written, x);
    if (!triplet && !written[1]?.rest && ['E', 'S'].includes(written[0])) appendFlags(group, written, x);
    if (written[1]?.rest && ['W', 'H'].includes(written[0])) group.append(node('line', { x1: x - 16, x2: x + 16, y1: 100, y2: 100, stroke: 'currentColor', 'stroke-width': 2 }));
    svg.append(group);
  }
  if (triplet) {
    svg.append(node('line', { x1: 32, x2: 112, y1: 42, y2: 42, stroke: 'currentColor', 'stroke-width': 7 }));
    const number = node('text', { x: 72, y: 28, 'font-size': 30, 'font-family': 'serif', 'font-style': 'italic', 'text-anchor': 'middle', fill: 'currentColor' });
    number.textContent = '3'; svg.append(number);
  }
  return svg;
}
export function renderMeasure(measure: RhythmMeasure, label = 'Practice rhythm', passage: { first: boolean; last: boolean } = { first: true, last: true }) {
  const grid = countGrid(measure);
  const svg = node('svg', { viewBox: '0 0 800 150', role: 'group', 'aria-label': `${measure.meter.join("/")} rhythm: ${label}`, class: 'notation' });
  const groupOf = (event: typeof grid.events[number]) => { const p = divide(event.start, grid.policy.pulse); return Math.floor(p[0] / p[1]); };
  const short = (event: typeof grid.events[number] | undefined) => event && ['E', 'S'].includes(event.written[0]);
  const x = (tick: number) => slotX(tick, grid.slots.length, grid.fine) * 8;
  svg.append(node('line', { x1: passage.first ? 80 : 0, x2: passage.last ? 798 : 800, y1: 100, y2: 100, stroke: 'currentColor', 'stroke-width': 2 }));
  for (const bx of passage.first ? [80, passage.last ? 798 : 800] : [passage.last ? 798 : 800]) svg.append(node('line', { x1: bx, x2: bx, y1: 74, y2: 126, stroke: 'currentColor', 'stroke-width': passage.last && bx !== 80 ? 4 : 2 }));
  if (passage.last) svg.append(node('line', { x1: 790, x2: 790, y1: 74, y2: 126, stroke: 'currentColor', 'stroke-width': 2 }));
  if (passage.first) svg.append(...timeSignatureDigits(measure.meter, 46, 94, 28));
  grid.events.forEach((event, index) => {
    const nx = x(event.startSlot);
    const group = node('g', { 'data-event': index, 'data-start': event.startSlot, 'data-duration': (event.endSlot - event.startSlot), 'data-kind': event.kind, 'data-value': event.written[0], 'data-dots': event.written[1]?.dots ?? 0, 'data-tuplet-group': event.tupletGroup ?? '', 'data-tie-next': String(Boolean(event.written[1]?.tieNext)) });
    group.append(...writtenSymbol(event.written, nx).childNodes);
    if (event.kind === 'note') {
      if (short(event)) {
        // Primary beams connect short-note groups, including intervening written rests.
        const members = grid.events.filter(e => short(e) && groupOf(e) === groupOf(event));
        const run = members.filter(e => !grid.events.some(barrier => barrier.index > Math.min(e.index, event.index) && barrier.index < Math.max(e.index, event.index) && !short(barrier)));
        const notes = run.filter(e => e.kind === 'note');
        const at = notes.indexOf(event), previous = notes[at - 1], next = notes[at + 1];
        if (next) group.append(node('line', { x1: nx + 10, x2: x(next.startSlot) + 10, y1: 42, y2: 42, stroke: 'currentColor', 'stroke-width': 7, 'data-beam': 'true' }));
        if (event.written[0] === 'S' && notes.length > 1) {
          const joinedNext = next?.written[0] === 'S' && next.index === event.index + 1;
          const joinedPrevious = previous?.written[0] === 'S' && previous.index === event.index - 1;
          if (joinedNext || !joinedPrevious) {
            const end = joinedNext ? x(next.startSlot) + 10 : nx + 10 + (next ? 20 : -20);
            group.append(node('line', { x1: nx + 10, x2: end, y1: 54, y2: 54, stroke: 'currentColor', 'stroke-width': 6, 'data-beam': joinedNext ? 'secondary' : 'partial' }));
          }
        }
        if (notes.length === 1) appendFlags(group, event.written, nx);
      }
    }
    const title = node('title', {}); title.textContent = `${event.kind} ${index + 1}${event.tupletGroup === null ? '' : ', eighth-note triplet, three in the time of two'}`; group.setAttribute('data-music-label', title.textContent!); group.append(title);
    svg.append(group);

  });
  for (const event of grid.events.filter(e => e.tupletGroup === e.index)) {
    const members = grid.events.filter(e => e.tupletGroup === event.index);
    const text = node('text', { x: (x(event.startSlot) + x(members.at(-1)!.startSlot)) / 2 + 10, y: 28, 'font-size': 30, 'font-family': 'serif', 'font-style': 'italic', 'text-anchor': 'middle', 'data-tuplet': event.tupletGroup! });
    text.textContent = '3'; svg.append(text);
  }
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
      const fromCard = cards[event.bar]!.getBoundingClientRect(), toCard = cards[next.bar]!.getBoundingClientRect();
      const rawFrom = from.x + from.width / 2 + 2, rawTo = to.x + to.width / 2 - 2;
      if (event.bar === next.bar && (rawTo < fromCard.left || rawFrom > fromCard.right)) return;
      const x1 = Math.max(fromCard.left + 2, Math.min(fromCard.right - 2, rawFrom)) - origin.x;
      const x2 = Math.max(toCard.left + 2, Math.min(toCard.right - 2, rawTo)) - origin.x;
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
  strip.addEventListener('scroll', refresh, true);
  refresh();
  return { refresh, destroy: () => { cancelAnimationFrame(frame); observer.disconnect(); strip.removeEventListener('scroll', refresh, true); overlay.remove(); } };
}
