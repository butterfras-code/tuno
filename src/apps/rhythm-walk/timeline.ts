import { legacyEvaluation, releaseAllowances } from './play-policy.ts';
import type { AttemptRecord } from './capture.ts';
import { evaluateAttempt } from './evaluation.ts';
import { countGrid, slotX } from '../count-writing/grid.ts';
import { musicalSeconds } from './timing.ts';
import type { DurationFeedback } from './evaluation.ts';

export interface SustainSegment {
  x1: number; x2: number; start: number; end: number | null; observedUntil: number;
  continuesBefore: boolean; continuesAfter: boolean; incomplete: boolean;
  feedback: DurationFeedback | 'missing' | 'extra';
  releaseWindow?: { x1: number; x2: number; start: number; end: number };
}

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
    const position = (time: number) => Math.max(0, Math.min(100, slotX((time - start) / duration * grid.slots.length, grid.slots.length, grid.fine)));
    const contains = (time: number) => time >= start && time < end || index === 0 && time < 0 || index === record.exercise.measures.length - 1 && time >= end;
    const expected = record.plan.notes.flatMap((note, i) => note.sources[0]!.measure === index ? [{ x: position(note.start), time: note.start, missing: evaluation.missing.includes(i) }] : []);
    const received = evaluation.holds.flatMap((hold, i) => {
      if (hold.countIn) return [];
      const match = evaluation.matches.find(match => match.hold === i);
      const belongs = match ? record.plan.notes[match.expected]!.sources[0]!.measure === index : contains(hold.down);
      return belongs ? [{ x: position(hold.down), time: hold.down, extra: evaluation.extra.includes(i), attention: match ? !match.attackAccepted : true }] : [];
    });
    // Split intervals in musical time at each measure. The renderer never creates
    // an attack at a clipped segment edge, including automatic system breaks.
    function segment(onset: number, release: number | null, observedUntil: number, feedback: SustainSegment['feedback'], attackMeasure?: number): SustainSegment[] {
      // Keep out-of-score tail inputs as clipped evidence on the final segment,
      // just as attack markers at that edge retain their actual time in titles.
      const last = index === record.exercise.measures.length - 1;
      const anchored = attackMeasure === index;
      if (attackMeasure !== undefined && index < attackMeasure || !anchored && (observedUntil <= start || onset >= end && !last)) return [];
      return [{ x1: position(anchored ? onset : Math.max(start, onset)), x2: position(Math.min(end, observedUntil)), start: onset, end: release, observedUntil,
        continuesBefore: !anchored && onset < start, continuesAfter: observedUntil > end,
        incomplete: release === null, feedback }];
    }
    const showSustain = (record.playStyle ?? 'hold') === 'hold';
    const expectedSustain = showSustain ? record.plan.notes.flatMap((note, i) => {
      const pieces = segment(note.start, note.end, note.end, evaluation.missing.includes(i) ? 'missing' : 'accepted');
      const adjacent = Math.abs((record.plan.notes[i + 1]?.start ?? Infinity) - note.end) < 1e-9;
      if (adjacent) {
        const allowance = releaseAllowances(note.end - note.start, true, record.evaluationPolicy ?? legacyEvaluation, note.finalSegmentDuration);
        const windowStart = note.end - allowance.early;
        // Only the final sounding-chain end permits lifting. Internal ties and
        // barline continuation pieces remain continuous; coordinates stay target-timed.
        const clippedStart = Math.max(start, windowStart), clippedEnd = Math.min(end, note.end);
        if (clippedEnd > clippedStart) pieces.forEach(piece => {
          piece.releaseWindow = { x1: position(clippedStart), x2: position(clippedEnd), start: windowStart, end: note.end };
        });
      }
      return pieces;
    }) : [];
    const receivedSustain = showSustain ? evaluation.holds.flatMap((hold, i) => {
      // Count-in holds may continue sounding across the start: show the observed
      // interval without inventing an attack or a release.
      const match = evaluation.matches.find(m => m.hold === i);
      return segment(hold.down, hold.up, hold.up ?? record.endedAt - hold.correction, match?.durationFeedback ?? 'extra', match ? record.plan.notes[match.expected]!.sources[0]!.measure : undefined);
    }) : [];
    start = end;
    return { expected, received, expectedSustain, receivedSustain, showSustain };
  });
}

export function renderTimingTimeline(data: ReturnType<typeof timingTimelines>[number], corrected: boolean, first: boolean) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('timing-timeline'); svg.setAttribute('viewBox', '0 0 800 64');
  svg.setAttribute('role', 'img');
  const durations = data.receivedSustain.map(s => s.incomplete ? 'Incomplete hold: no release observed; dashed extent ends at capture limit.' : `Hold ${Math.round(s.start * 1000)}–${Math.round(s.end! * 1000)} ms: ${s.feedback}.`).join(' ');
  const attacks = `${data.expected.length} expected; ${data.received.length} received; ${data.expected.filter(h => h.missing).length} missing; ${data.received.filter(h => h.extra).length} extra; ${data.received.filter(h => !h.extra && h.attention).length} matched attacks outside provisional tolerance.`;
  svg.setAttribute('aria-label', `Expected and received attacks${data.showSustain ? ' and held durations' : ' only; releases not graded'}${corrected ? ' after session timing correction' : ''}. ${attacks} ${durations}${data.showSustain ? ' Expected solid sections show sustain; dashed sections permit lifting before the next separate note, at target tempo. Internal ties require uninterrupted holding.' : ''}`);
  function element(name: string, attributes: Record<string, string>, text?: string) {
    const node = document.createElementNS(svg.namespaceURI, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  }
  for (const [row, label, hits, sustain] of [[16, 'Expected', data.expected, data.expectedSustain], [48, 'Received', data.received, data.receivedSustain]] as const) {
    if (first) svg.append(element('text', { x: '4', y: String(row + 5), class: 'timeline-label' }, label));
    svg.append(element('line', { x1: first ? '104' : '0', x2: '800', y1: String(row), y2: String(row), class: 'timeline-rail' }));
    sustain.forEach(s => {
      const attention = !['accepted', 'not-graded'].includes(s.feedback);
      const releaseWindow = s.releaseWindow;
      if (releaseWindow) {
        const optional = element('line', { x1: String(releaseWindow.x1 * 8), x2: String(releaseWindow.x2 * 8), y1: String(row), y2: String(row), class: 'timeline-lift-window' });
        optional.append(element('title', {}, `Release permitted from ${Math.round(releaseWindow.start * 1000)} to ${Math.round(releaseWindow.end * 1000)} ms at target tempo to lift before the next separate note; sustain is still required.`));
        svg.append(optional);
      }
      const bar = element('line', { x1: String(s.x1 * 8), x2: String((releaseWindow?.x1 ?? s.x2) * 8), y1: String(row), y2: String(row),
        class: `timeline-sustain${attention ? ' attention' : ''}${s.incomplete ? ' incomplete' : ''}`, 'data-feedback': s.feedback });
      const description = `${label} duration from ${Math.round(s.start * 1000)} ms; ${s.incomplete ? `no release observed (dashed to capture limit ${Math.round(s.observedUntil * 1000)} ms)` : `release ${Math.round(s.end! * 1000)} ms; ${s.feedback}`}${s.continuesBefore || s.continuesAfter ? '; continues across measure boundary' : ''}`;
      bar.append(element('title', {}, description)); svg.append(bar);
      if (!s.continuesAfter && !s.incomplete) {
        const edge = element('line', { x1: String(s.x2 * 8), x2: String(s.x2 * 8), y1: String(row - 4), y2: String(row + 4), class: `timeline-release${attention ? ' attention' : ''}` });
        edge.append(element('title', {}, description)); svg.append(edge);
      }
    });
    hits.forEach(hit => {
      const marker = element('line', { x1: String(hit.x * 8), x2: String(hit.x * 8), y1: String(row - 8), y2: String(row + 8), class: 'timeline-hit' + ('missing' in hit && hit.missing || 'extra' in hit && hit.extra || 'attention' in hit && hit.attention ? ' unmatched' : '') });
      const feedback = 'missing' in hit && hit.missing ? '; missing attack' : 'extra' in hit && hit.extra ? '; extra attack' : 'attention' in hit && hit.attention ? '; attack outside provisional tolerance' : '';
      marker.append(element('title', {}, `${label} attack at ${Math.round(hit.time * 1000)} ms from exercise start${feedback}${hit.x === 0 || hit.x === 100 ? ' (clipped to score edge)' : ''}`));
      svg.append(marker);
    });
  }
  return svg;
}
