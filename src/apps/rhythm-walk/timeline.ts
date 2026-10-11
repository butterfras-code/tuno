import type { AttemptRecord } from './capture.ts';
import { evaluateAttempt } from './evaluation.ts';
import { countGrid, slotX } from '../count-writing/grid.ts';
import { musicalSeconds } from './timing.ts';

/** Use the engraver's slot spacing, with seconds derived from the captured pulse.
 * Matched attacks use their expected note's measure even when slightly early:
 * the engraving's leading space at a barline represents no additional time. */
export function timingTimelines(record: AttemptRecord) {
  const evaluation = evaluateAttempt(record);
  if (evaluation.status !== 'completed') return [];
  let start = 0;
  return record.exercise.measures.map((measure, index) => {
    const grid = countGrid(measure);
    const duration = musicalSeconds(grid.measure.length, record.bpm, grid.policy.pulse);
    const end = start + duration;
    const position = (time: number) => Math.max(0, Math.min(100, slotX((time - start) / duration * grid.slots.length, grid.slots.length)));
    const contains = (time: number) => time >= start && time < end || index === 0 && time < 0 || index === record.exercise.measures.length - 1 && time >= end;
    const expected = record.plan.notes.flatMap((note, i) => note.sources[0]!.measure === index ? [{ x: position(note.start), time: note.start, missing: evaluation.missing.includes(i) }] : []);
    const received = evaluation.holds.flatMap((hold, i) => {
      if (hold.countIn) return [];
      const match = evaluation.matches.find(match => match.hold === i);
      const belongs = match ? record.plan.notes[match.expected]!.sources[0]!.measure === index : contains(hold.down);
      return belongs ? [{ x: position(hold.down), time: hold.down, extra: evaluation.extra.includes(i) }] : [];
    });
    start = end;
    return { expected, received };
  });
}

export function renderTimingTimeline(data: ReturnType<typeof timingTimelines>[number], corrected: boolean, first: boolean) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('timing-timeline'); svg.setAttribute('viewBox', '0 0 800 64');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Expected hits and received hits${corrected ? ' after session timing correction' : ''}. ${data.expected.length} expected; ${data.received.length} received.`);
  function element(name: string, attributes: Record<string, string>, text?: string) {
    const node = document.createElementNS(svg.namespaceURI, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  }
  for (const [row, label, hits] of [[16, 'Expected', data.expected], [48, 'Received', data.received]] as const) {
    if (first) svg.append(element('text', { x: '4', y: String(row + 5), class: 'timeline-label' }, label));
    svg.append(element('line', { x1: first ? '104' : '0', x2: '800', y1: String(row), y2: String(row), class: 'timeline-rail' }));
    hits.forEach(hit => {
      const marker = element('line', { x1: String(hit.x * 8), x2: String(hit.x * 8), y1: String(row - 8), y2: String(row + 8), class: 'timeline-hit' + ('missing' in hit && hit.missing || 'extra' in hit && hit.extra ? ' unmatched' : '') });
      marker.append(element('title', {}, `${label} attack at ${Math.round(hit.time * 1000)} ms from exercise start${hit.x === 0 || hit.x === 100 ? ' (clipped to score edge)' : ''}`));
      svg.append(marker);
    });
  }
  return svg;
}
