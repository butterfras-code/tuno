import { countGrid } from './grid.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
export const alphabet = ['1', '2', '3', '4', '&', 'e', 'a'] as const;
export type CountSymbol = typeof alphabet[number] | '';
export interface Span { start: number; end: number }
export interface CountAnswer { symbols: CountSymbol[]; spans: Span[]; rests: boolean[] }
export type Verdict = 'correct' | 'revise' | 'provisional';
export interface Dimension { verdict: Verdict; issues: string[] }
export interface Evaluation { counts: Dimension; spans: Dimension; rests: Dimension }
export const blankAnswer = (measure: RhythmMeasure): CountAnswer => {
  const size = countGrid(measure).slots.length;
  return { symbols: Array<CountSymbol>(size).fill(''), spans: [], rests: Array<boolean>(size).fill(false) };
};
/** Replaceable review policy, not a finalized school grading contract.
 * Extra valid subdivisions, line endpoints and rest grouping are provisional.
 * Dotted-quarter internal & is accepted both present and absent pending review.
 */
export type DottedQuarterConvention = 'review' | 'required' | 'optional';
export function evaluate(measure: RhythmMeasure, answer: CountAnswer, dottedConvention: DottedQuarterConvention = 'review'): Evaluation {
  const counts: Dimension = { verdict: 'correct', issues: [] };
  const spans: Dimension = { verdict: 'correct', issues: [] };
  const rests: Dimension = { verdict: 'correct', issues: [] };
  const grid = countGrid(measure);
  if (answer.symbols.length !== grid.slots.length || answer.rests.length !== grid.slots.length) throw new Error('Answer does not match count grid.');
  const hasDottedQuarter = grid.slots.some(s => s.dottedInternal);
  let countReview = hasDottedQuarter && dottedConvention === 'review';
  for (let tick = 0; tick < grid.slots.length; tick++) {
    const slot = grid.slots[tick]!;
    const { event, dottedInternal } = slot;
    const required = slot.onset || slot.onBeat || (dottedInternal && dottedConvention === 'required');
    const symbol = answer.symbols[tick];
    if ((required || symbol) && symbol !== slot.symbol) counts.issues.push(`Check the count at ${slot.label}.`);
    if (!required && symbol && !(dottedInternal && dottedConvention === 'optional')) countReview = true;
    if (answer.rests[tick] !== (event.kind === 'rest' && (required || Boolean(symbol)))) rests.issues.push(`Check parentheses at ${slot.label}.`);
  }
  const sustained = grid.events.filter(e => e.kind === 'note' && grid.slots.some(s => s.event === e && s.onBeat && !s.onset));
  const expected = sustained.map(e => ({ start: e.startSlot, end: e.endSlot - 1 }));
  const exact = expected.length === answer.spans.length && expected.every(span => answer.spans.some(s => s.start === span.start && s.end === span.end));
  if (!exact) spans.issues.push('Review duration lines: start the line at the note onset. Its ending position is still provisional.');
  const outsideSustain = answer.spans.some(s => !sustained.some(e => s.start >= e.startSlot && s.end < e.endSlot));
  const wrongLineCount = answer.spans.length !== sustained.length || sustained.some(e => answer.spans.filter(s => s.start >= e.startSlot && s.end < e.endSlot).length !== 1);
  const wrongAnchor = answer.spans.some(s => sustained.some(e => s.start >= e.startSlot && s.end < e.endSlot && s.start !== e.startSlot));
  const invalidSpan = answer.spans.some(s => !Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < 0 || s.end >= grid.slots.length || s.start > s.end);
  spans.verdict = exact ? 'correct' : invalidSpan || outsideSustain || wrongLineCount || wrongAnchor ? 'revise' : 'provisional';
  if (spans.verdict === 'revise') spans.issues = ['Start each duration line at its note onset and keep it within that note. Use one line per sustained note; ending positions remain provisional.'];
  counts.verdict = counts.issues.length ? 'revise' : countReview ? 'provisional' : 'correct';
  if (countReview && !counts.issues.length) counts.issues.push(hasDottedQuarter ? 'The dotted-quarter internal & is teacher-dependent. Select a convention, or review both variants provisionally.' : 'Extra valid subdivisions are accepted provisionally pending teacher review.');
  rests.verdict = rests.issues.length ? 'revise' : 'correct';
  return { counts, spans, rests };
}
