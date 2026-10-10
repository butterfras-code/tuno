import { duration } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
export const alphabet = ['1', '2', '3', '4', '&', 'e', 'a'] as const;
export type CountSymbol = typeof alphabet[number] | '';
export interface Span { start: number; end: number }
export interface CountAnswer { symbols: CountSymbol[]; spans: Span[]; rests: boolean[] }
export type Verdict = 'correct' | 'revise' | 'provisional';
export interface Dimension { verdict: Verdict; issues: string[] }
export interface Evaluation { counts: Dimension; spans: Dimension; rests: Dimension }
export const blankAnswer = (): CountAnswer => ({ symbols: Array<CountSymbol>(8).fill(''), spans: [], rests: Array<boolean>(8).fill(false) });
export const positionLabel = (tick: number) => `beat ${Math.floor(tick / 2) + 1}${tick % 2 ? ' offbeat' : ''}`;
export const expectedSymbol = (tick: number): CountSymbol => tick % 2 ? '&' : String(tick / 2 + 1) as CountSymbol;
/** Replaceable review policy, not a finalized school grading contract.
 * Extra valid subdivisions, line endpoints and rest grouping are provisional.
 * Dotted-quarter internal & is accepted both present and absent pending review.
 */
export type DottedQuarterConvention = 'review' | 'required' | 'optional';
export function evaluate(measure: RhythmMeasure, answer: CountAnswer, dottedConvention: DottedQuarterConvention = 'review'): Evaluation {
  const counts: Dimension = { verdict: 'correct', issues: [] };
  const spans: Dimension = { verdict: 'correct', issues: [] };
  const rests: Dimension = { verdict: 'correct', issues: [] };
  let countReview = measure.id === 'dotted-quarter' && dottedConvention === 'review';
  for (let tick = 0; tick < 8; tick++) {
    const event = measure.events.find(e => tick >= e.start && tick < e.start + duration(e))!;
    const dottedInternal = measure.id === 'dotted-quarter' && tick === 1;
    const required = tick === event.start || tick % 2 === 0 || (dottedInternal && dottedConvention === 'required');
    const symbol = answer.symbols[tick];
    if ((required || symbol) && symbol !== expectedSymbol(tick)) counts.issues.push(`Check the count at ${positionLabel(tick)}.`);
    if (!required && symbol && !(dottedInternal && dottedConvention === 'optional')) countReview = true;
    if (answer.rests[tick] !== (event.kind === 'rest' && (required || Boolean(symbol)))) rests.issues.push(`Check parentheses at ${positionLabel(tick)}.`);
  }
  const expected = measure.events.filter(e => e.kind === 'note' && duration(e) > 2)
    .map(e => ({ start: e.start + 1, end: e.start + duration(e) - 1 }));
  const exact = expected.length === answer.spans.length && expected.every(span => answer.spans.some(s => s.start === span.start && s.end === span.end));
  if (!exact) spans.issues.push('Review duration lines: the trial span covers internal positions through the last subdivision before the next note. Exact endpoints need teacher approval.');
  const sustained = measure.events.filter(e => e.kind === 'note' && duration(e) > 2);
  const outsideSustain = answer.spans.some(s => !sustained.some(e => s.start >= e.start && s.end < e.start + duration(e)));
  const wrongLineCount = answer.spans.length !== sustained.length || sustained.some(e => answer.spans.filter(s => s.start >= e.start && s.end < e.start + duration(e)).length !== 1);
  const invalidSpan = answer.spans.some(s => !Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < 0 || s.end > 7 || s.start > s.end);
  spans.verdict = exact ? 'correct' : invalidSpan || outsideSustain || wrongLineCount ? 'revise' : 'provisional';
  if (spans.verdict === 'revise') spans.issues = ['Use one duration line per sustained note; keep each line within that note. Exact internal endpoints remain provisional.'];
  counts.verdict = counts.issues.length ? 'revise' : countReview ? 'provisional' : 'correct';
  if (countReview && !counts.issues.length) counts.issues.push(measure.id === 'dotted-quarter' ? 'The dotted-quarter internal & is teacher-dependent. Select a convention, or review both variants provisionally.' : 'Extra valid subdivisions are accepted provisionally pending teacher review.');
  rests.verdict = rests.issues.length ? 'revise' : 'correct';
  return { counts, spans, rests };
}
