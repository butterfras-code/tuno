import { countGrid } from './grid.ts';
import { passageGrid } from './passage.ts';
import { derivePassage } from '../../music/measure.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
export const alphabet = ['1', '2', '3', '4', '5', '6', '&', 'e', 'a'] as const;
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
function evaluateMeasure(measure: RhythmMeasure, answer: CountAnswer, dottedConvention: DottedQuarterConvention = 'review'): Evaluation {
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
    const required = slot.onset || slot.onCount || (dottedInternal && dottedConvention === 'required');
    const symbol = answer.symbols[tick];
    if ((required || symbol) && symbol !== slot.symbol) counts.issues.push(`Check the count at ${slot.label}.`);
    if (!required && symbol && !(dottedInternal && dottedConvention === 'optional')) countReview = true;

  }
  const sustained = grid.events.filter(e => grid.slots.some(s => s.event === e && s.onCount && !s.onset));
  const expectedRests = grid.events.filter(e => e.kind === 'rest').map(e => ({
    start: e.startSlot,
    end: grid.slots.flatMap((slot, tick) => slot.event === e && (slot.onset || slot.onCount || (slot.dottedInternal && dottedConvention === 'required') || Boolean(answer.symbols[tick])) ? [tick] : []).at(-1)!,
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
  spans.verdict = exact ? 'correct' : grid.policy.compound || invalidSpan || outsideSustain || wrongLineCount || wrongAnchor ? 'revise' : 'provisional';
  if (spans.verdict === 'revise') spans.issues = [grid.policy.compound ? 'Use one duration line per sustained note/rest from its onset through its last numbered count before release.' : 'Start each duration line at its note/rest onset and keep it within that note or rest. Use one line per sustained note or rest; ending positions remain provisional.'];
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

/** Single-bar entry validates complete tie chains, too. */
export function evaluate(measure: RhythmMeasure, answer: CountAnswer, convention: DottedQuarterConvention = 'review'): Evaluation {
  if (measure.events.some(e => e[1]?.tieNext)) return evaluatePassage([measure], [answer], convention)[0]!;
  return evaluateMeasure(measure, answer, convention);
}

/** Rest pairs stay measure-local. Duration spans may use passage-wide derived positions. */
export function evaluatePassage(measures: readonly RhythmMeasure[], answers: readonly CountAnswer[], convention: DottedQuarterConvention = 'review', passageSpans?: readonly Span[]): Evaluation[] {
  derivePassage(measures);
  if (answers.length !== measures.length) throw new Error('Provide one answer per measure.');
  const results = measures.map((measure, index) => evaluateMeasure(measure, answers[index]!, convention));
  if (measures.some(m => m.events.some(e => e[1]?.tieNext)) || passageSpans) {
    const grid = passageGrid(measures);
    const lines = passageSpans ?? answers.flatMap((answer, measure) => answer.spans.map(span => ({ start: span.start + grid.offsets[measure]!, end: span.end + grid.offsets[measure]! })));
    results.forEach(result => { result.counts = { verdict: 'correct', issues: [] }; result.spans = { verdict: 'correct', issues: [] }; });
    grid.slots.forEach(slot => {
      const counts = results[slot.measure]!.counts;
      const symbol = answers[slot.measure]!.symbols[slot.index];
      const required = slot.attack || slot.onCount || (slot.dottedInternal && convention === 'required');
      if ((required || symbol) && symbol !== slot.symbol) {
        const reason = slot.attack && !slot.sound.rest ? 'attack count' : !slot.attack && !slot.sound.rest ? 'sustained continuation count' : 'rest count';
        counts.issues.push(`${symbol ? 'Incorrect' : 'Missing'} ${reason} at ${slot.label}${slot.sound.tied && !slot.attack ? '; this is a continuation, not a new attack' : ''}.`);
        counts.verdict = 'revise';
      } else if ((slot.dottedInternal && convention === 'review') || (!required && symbol && !(slot.dottedInternal && convention === 'optional'))) {
        if (counts.verdict !== 'revise') counts.verdict = 'provisional';
        if (!counts.issues.includes('Internal offbeat counts retain the selected dotted-quarter or optional-subdivision teacher-review convention.')) counts.issues.push('Internal offbeat counts retain the selected dotted-quarter or optional-subdivision teacher-review convention.');
      }
    });
    const issue = (measure: number, message: string, verdict: Verdict = 'revise') => {
      const dimension = results[measure]!.spans;
      dimension.issues.push(message);
      if (dimension.verdict !== 'revise') dimension.verdict = verdict;
    };
    grid.sustained.forEach(sound => {
      const anchored = lines.filter(line => line.start === sound.start);
      const measure = grid.slots[sound.start]!.measure;
      const label = grid.slots[sound.start]!.label;
      if (anchored.length !== 1) issue(measure, `Use one continuous duration line at ${label}${sound.tied ? ' for the entire tied chain' : ''}.`);
      else if (anchored[0]!.end !== sound.end && anchored[0]!.end >= sound.start && anchored[0]!.end < sound.end) {
        const compound = grid.grids[measure]!.policy.compound;
        issue(measure, `${compound ? 'Complete' : 'Review'} the duration line at ${label}; ${compound ? 'it must continue' : 'the trial line continues'} through measure ${grid.slots[sound.end]!.measure + 1}, ${grid.slots[sound.end]!.label}.`, compound ? 'revise' : 'provisional');
      }
    });
    lines.forEach(line => {
      const sound = grid.sustained.find(s => s.start === line.start);
      const measure = Math.max(0, Math.min(measures.length - 1, grid.slots[line.start]?.measure ?? 0));
      if (!Number.isInteger(line.start) || !Number.isInteger(line.end) || line.start < 0 || line.end >= grid.slots.length || line.end < line.start) issue(measure, 'Duration line leaves the exercise or has invalid endpoints.');
      else if (!sound) issue(measure, grid.slots[line.start]!.attack ? `Remove the extra duration line at ${grid.slots[line.start]!.label}; this note/rest does not require a line.` : `Start the duration line at the sounding attack/rest onset, not a tied continuation (${grid.slots[line.start]!.label}).`);
      else if (line.end > sound.end) issue(measure, `Incorrectly extended duration line at ${grid.slots[line.start]!.label}: stop before the next attack or rest, in measure ${grid.slots[sound.end]!.measure + 1}.`);
    });
  }
  results.forEach((result, index) => {
    for (const dimension of Object.values(result)) dimension.issues = dimension.issues.map((issue: string) => `Measure ${index + 1}: ${issue}`);
  });
  return results;
}
