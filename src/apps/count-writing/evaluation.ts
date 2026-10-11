import { countGrid } from './grid.ts';
import { derivePassage } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
export const alphabet = ['1', '2', '3', '4', '&', 'e', 'a'] as const;
export type CountSymbol = typeof alphabet[number] | '';
export interface Span { start: number; end: number }
export interface CountAnswer { symbols: CountSymbol[]; spans: Span[]; rests: Span[] }
export type Verdict = 'correct' | 'revise' | 'provisional';
export interface Dimension { verdict: Verdict; issues: string[] }
export interface Evaluation { counts: Dimension; spans: Dimension; rests: Dimension }
export const blankAnswer = (measure: RhythmMeasure): CountAnswer => {
  const size = countGrid(measure).slots.length;
  return { symbols: Array<CountSymbol>(size).fill(''), spans: [], rests: [] };
};
/** Replaceable review policy, not a finalized school grading contract.
 * Extra valid subdivisions and line endpoints are provisional.
 * Each written rest requires one complete enclosing pair.
 * Dotted-quarter internal & is accepted both present and absent pending review.
 */
export type DottedQuarterConvention = 'review' | 'required' | 'optional';
export function evaluate(measure: RhythmMeasure, answer: CountAnswer, dottedConvention: DottedQuarterConvention = 'review'): Evaluation {
  const counts: Dimension = { verdict: 'correct', issues: [] };
  const spans: Dimension = { verdict: 'correct', issues: [] };
  const rests: Dimension = { verdict: 'correct', issues: [] };
  const grid = countGrid(measure);
  if (answer.symbols.length !== grid.slots.length) throw new Error('Answer does not match count grid.');
  const hasDottedQuarter = grid.slots.some(s => s.dottedInternal);
  let countReview = hasDottedQuarter && dottedConvention === 'review';
  for (let tick = 0; tick < grid.slots.length; tick++) {
    const slot = grid.slots[tick]!;
    const { dottedInternal } = slot;
    const required = slot.onset || slot.onBeat || (dottedInternal && dottedConvention === 'required');
    const symbol = answer.symbols[tick];
    if ((required || symbol) && symbol !== slot.symbol) counts.issues.push(`Check the count at ${slot.label}.`);
    if (!required && symbol && !(dottedInternal && dottedConvention === 'optional')) countReview = true;

  }
  const sustained = grid.events.filter(e => grid.slots.some(s => s.event === e && s.onBeat && !s.onset));
  const expectedRests = grid.events.filter(e => e.kind === 'rest').map(e => ({
    start: e.startSlot,
    end: grid.slots.flatMap((slot, tick) => slot.event === e && (slot.onset || slot.onBeat || (slot.dottedInternal && dottedConvention === 'required') || Boolean(answer.symbols[tick])) ? [tick] : []).at(-1)!,
  }));
  const groupedRestsMatch = expectedRests.length === answer.rests.length && expectedRests.every(expected =>
    answer.rests.some(group => group.start === expected.start && group.end === expected.end));
  if (!groupedRestsMatch) {
    expectedRests.forEach(expected => {
      if (answer.rests.filter(group => group.start === expected.start && group.end === expected.end).length !== 1)
        rests.issues.push(`Enclose the written rest at ${grid.slots[expected.start]!.label} in one complete pair through ${grid.slots[expected.end]!.label}. Keep adjacent rests in separate pairs.`);
    });
    if (answer.rests.some(group => !expectedRests.some(expected => group.start === expected.start && group.end === expected.end)))
      rests.issues.push('Remove extra or misplaced rest pairs. Each pair must enclose exactly one written rest within this measure.');
  }
  const expected = sustained.map(e => ({ start: e.startSlot, end: e.endSlot - 1 }));
  const exact = expected.length === answer.spans.length && expected.every(span => answer.spans.some(s => s.start === span.start && s.end === span.end));
  if (!exact) spans.issues.push('Review duration lines: start the line at the note/rest onset. Its ending position is still provisional.');
  const outsideSustain = answer.spans.some(s => !sustained.some(e => s.start >= e.startSlot && s.end < e.endSlot));
  const wrongLineCount = answer.spans.length !== sustained.length || sustained.some(e => answer.spans.filter(s => s.start >= e.startSlot && s.end < e.endSlot).length !== 1);
  const wrongAnchor = answer.spans.some(s => sustained.some(e => s.start >= e.startSlot && s.end < e.endSlot && s.start !== e.startSlot));
  const invalidSpan = answer.spans.some(s => !Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < 0 || s.end >= grid.slots.length || s.start > s.end);
  spans.verdict = exact ? 'correct' : invalidSpan || outsideSustain || wrongLineCount || wrongAnchor ? 'revise' : 'provisional';
  if (spans.verdict === 'revise') spans.issues = ['Start each duration line at its note/rest onset and keep it within that note or rest. Use one line per sustained note or rest; ending positions remain provisional.'];
  if (!exact) {
    sustained.forEach(event => {
      if (!answer.spans.some(span => span.start === event.startSlot && span.end === event.endSlot - 1))
        spans.issues.push(`Check the duration line at ${grid.slots[event.startSlot]!.label}: cover this note/rest from its onset through its final position before the next event or barline.`);
    });
  }
  counts.verdict = counts.issues.length ? 'revise' : countReview ? 'provisional' : 'correct';
  if (countReview && !counts.issues.length) counts.issues.push(hasDottedQuarter ? 'The dotted-quarter internal & is teacher-dependent. Select a convention, or review both variants provisionally.' : 'Extra valid subdivisions are accepted provisionally pending teacher review.');
  rests.verdict = rests.issues.length ? 'revise' : 'correct';
  return { counts, spans, rests };
}

/** Answers are measure-local; no answer range can connect two bars. */
export function evaluatePassage(measures: readonly RhythmMeasure[], answers: readonly CountAnswer[], convention: DottedQuarterConvention = 'review'): Evaluation[] {
  derivePassage(measures);
  if (answers.length !== measures.length) throw new Error('Provide one answer per measure.');
  return measures.map((measure, index) => {
    const result = evaluate(measure, answers[index]!, convention);
    for (const dimension of Object.values(result)) dimension.issues = dimension.issues.map((issue: string) => `Measure ${index + 1}: ${issue}`);
    return result;
  });
}
