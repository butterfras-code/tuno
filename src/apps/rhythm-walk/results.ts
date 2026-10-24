import { countingScore, countingProblems, type CountingFeedbackContext } from './counting-feedback.ts';
import { el, button } from '../../shared/ui/components.ts';
import type { Assessment } from './assessment.ts';
import type { AttemptRecord } from './capture.ts';
import { rewardPolicy, type TreatBagState } from './rewards.ts';

export function tempoDescription(difference: number, _a: Assessment) {
  const amount = Math.abs(difference);
  return amount <= rewardPolicy.tempo[0] ? 'On target' : `${amount <= rewardPolicy.tempo[1] ? 'Slightly ' : ''}${difference < 0 ? 'slower' : 'faster'}`.replace(/^./, c => c.toUpperCase());
}
export function steadinessDescription(variation: number, _a: Assessment) {
  return variation <= rewardPolicy.steadiness[0] ? 'Steady' : variation <= rewardPolicy.steadiness[1] ? 'Mostly steady' : 'Uneven';
}
/** One evidence-backed summary and at most one concrete musical suggestion. */
export function musicalFeedback(record: AttemptRecord, a: Assessment) {
  if (record.status !== 'completed') return {summary:'This attempt was interrupted.', suggestion:'Try again when you’re ready.'};
  const holdStyle = (record.playStyle ?? 'hold') === 'hold';
  const restIssue = a.capturedAttacks>0 || (holdStyle && a.restIntrusions.length>0);
  if (!a.expectedAttacks) return {summary:restIssue ? 'There was input during this rest exercise.' : 'You left the rests silent.', suggestion:restIssue ? 'Leave silence in the rests.' : null};
  if (a.rhythm === null) return {summary:'We couldn’t clearly assess this attempt.',suggestion:'Try again with one tap for each note.'};
  if (!a.matchedNotes) return {summary:'We didn’t hear the written notes clearly.',suggestion:'Try tapping once when each note starts.'};
  if (a.basis === 'target') return {summary:'There are only a few notes to assess.',suggestion:(a.missing ?? 0)>0 ? 'Try tapping once for each note.' : null};
  const lastMatched = Math.max(-1, ...a.matches.map(m => m.expected));
  if (a.tempo && a.tempo.differencePercent < -rewardPolicy.tempo[0] && lastMatched < a.expectedAttacks - 1 && (a.missing ?? 0) > 0)
    return { summary: 'You fell behind the beat.', suggestion: 'Try a slower tempo.' };
  const poorHolds = holdStyle ? a.matches.filter(m=>m.holdCredit !== null && m.holdCredit < .8) : [];
  let suggestion: string | null = null;
  const restAttack = a.restIntrusions.some(r=>r.attack);
  const sustainedRestIssue = holdStyle && (a.restIntrusions.some(r=>r.credit<.5) || a.restIntrusions.length>=2);
  if (restAttack || sustainedRestIssue) suggestion='Leave a little more silence in the rests.';
  else if (poorHolds.length>=2 || poorHolds.some(m=>m.holdCredit!<.4)) suggestion=poorHolds.some(m=>m.duration?.elapsed === null) ? 'Release when the note ends.' : poorHolds.some(m=>m.duration && m.duration.elapsed!>m.duration.maximum) ? 'Release when the note ends.' : 'Try holding the longer notes a little more.';
  else if (a.steadiness !== null && a.steadiness>rewardPolicy.steadiness[1]) suggestion='Keep the same pace through the whole exercise.';
  else if ((a.missing ?? 0)+(a.extra ?? 0)>0 || a.rhythm<85) suggestion='Try tapping once when each note starts.';
  const summary = a.rhythm>=rewardPolicy.rhythm[0] ? a.tempo && Math.abs(a.tempo.differencePercent)>rewardPolicy.tempo[0] ? 'You kept the rhythm at a different pace.' : 'You kept the rhythm!' : 'You played some of the written rhythm.';
  return {summary,suggestion};
}
export function createResults(record: AttemptRecord, retry: () => void, next: () => void, nextIssue: string | null) {
  const panel = el('section', 'performance-results'); panel.setAttribute('aria-labelledby', 'performance-results-heading');
  const heading = el('h2', 'sr-only', record.status === 'completed' ? 'Performance results' : 'Interrupted attempt'); heading.id = 'performance-results-heading'; heading.tabIndex = -1;
  panel.append(heading);
  if (record.status === 'interrupted') panel.append(el('p', '', `${record.reason}. This attempt is not graded. Try again when ready.`));
  const actions = el('div', 'result-actions');
  const nextButton = button('Next exercise', next); nextButton.disabled = Boolean(nextIssue);
  actions.append(button('Try again', retry), nextButton); panel.append(actions);
  const issue = el('p', 'note', nextIssue ?? ''); issue.hidden = !nextIssue; panel.append(issue);
  return { panel, heading, sync: (message: string | null) => { nextButton.disabled = Boolean(message); issue.textContent = message ?? ''; issue.hidden = !message; } };
}

/** A single accessible text rating; the five reusable SVG slots are decorative. */
function boneIcon(earned: boolean) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 20'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `bone-slot${earned ? ' earned' : ''}`);
  svg.innerHTML = '<path d="M8 6C7 1 1 1 1 5c0 2 1 3 3 5-2 2-3 3-3 5 0 4 6 4 7-1h16c1 5 7 5 7 1 0-2-1-3-3-5 2-2 3-3 3-5 0-4-6-4-7 1Z"/>';
  return svg;
}
const rewardDimensions = [
  { metric: 'rhythm', label: 'Rhythm', short: 'Rhythm' },
  { metric: 'hold', label: 'Holding notes', short: 'Hold' },
  { metric: 'tempo', label: 'Tempo', short: 'Tempo' },
  { metric: 'steadiness', label: 'Steady beat', short: 'Steady' },
] as const;

export function renderTreatBag(host: HTMLElement, state: TreatBagState, interrupted = false, counting?: CountingFeedbackContext) {
  host.dataset.scored = String(counting && counting.mode !== 'tap' ? Boolean(counting.result) : Boolean(state.completed));
  const wasOpen = host.querySelector<HTMLDetailsElement>('.treat-details')?.open ?? false;
  const heading = el('h2', '', 'Treat Bag: Earn Treats for Uno'); heading.id = 'feedback-snapshot-title';
  const list = el('ul', 'treat-ratings');
  const details = el('details', 'treat-details'); details.open = wasOpen;
  details.append(el('summary', '', 'Feedback'));
  host.replaceChildren(heading, list, details);
  if (counting && counting.mode !== 'tap') {
    const score = counting.result ? countingScore(counting.result) : null;
    const problems = countingProblems(counting.plan, counting.result, counting.checked, counting.answer);
    const edited = problems.some(p => p.state === 'edited');
    const item = el('li', 'counting-rating'); item.dataset.metric = 'counting';
    item.dataset.bones = score?.bones == null ? '' : String(score.bones);
    item.append(el('strong', '', 'Counting'));
    const totals = score ? `${score.correct}/${score.total} · ${score.percent === null ? 'Not applicable' : `${Math.round(score.percent)}%`}` : 'Not yet checked';
    item.append(el('span', 'counting-totals', totals));
    const compact = el('span', 'bone-count'); compact.append(el('span', '', score?.bones == null ? '—' : `${score.bones}/5`), boneIcon(score?.bones != null));
    const bones = el('span', score?.bones == null ? 'counting-unrated' : 'bone-slots counting-bones');
    bones.setAttribute('aria-hidden', 'true');
    if (score?.bones != null) item.append(el('span', 'sr-only', `${score.bones} out of 5 bones`));
    if (score?.bones != null) for (let i = 0; i < 5; i++) bones.append(boneIcon(i < score.bones));
    bones.setAttribute('aria-label', score?.bones == null ? 'Not rated' : `${score.bones} out of 5 bones`);
    item.append(compact, bones); list.append(item);
    const status = el('p', 'counting-confirmation', !score ? 'Check your counts when ready.' : edited ? 'Last checked score · Edits awaiting Check Again.' : score.correct === score.total ? 'All applicable answers are correct. Well done!' : 'Select a marked position, make corrections, then Check Again.');
    host.insertBefore(status, details);
    for (const problem of problems) {
      const id = problem.item.countIds[0];
      if (!id) continue;
      const count = counting.plan.counts.find(c => c.id === id)!;
      const link = button(`${count.label.split(', offset')[0]} · ${problem.message}`, () => counting.navigate(id));
      link.classList.add('counting-problem-link'); details.append(link);
    }
    if (!problems.length) details.append(el('p', '', score ? 'No unresolved counting problems.' : 'Count symbols, rest markings and connected counts are checked independently.'));
    if (counting.result) {
      const diagnostic = el('details', 'counting-diagnostics'); diagnostic.append(el('summary', '', 'Technical counting evidence'));
      diagnostic.append(el('pre', '', JSON.stringify(counting.result, null, 2))); details.append(diagnostic);
    }
  }
  for (const dimension of counting?.mode === 'write' ? [] : rewardDimensions) {
    const category = state.completed?.rewards.categories.find(c => c.metric === dimension.metric);
    const bones = category?.bones ?? null;
    const reason = !state.completed ? 'Not yet scored' : category?.reason ?? 'Not assessed in Tap';
    const item = el('li'); item.dataset.metric = dimension.metric;
    item.dataset.bones = bones === null ? '' : String(bones);
    item.append(el('span', 'sr-only', `${dimension.label}: ${bones === null ? reason : `${bones} out of 5 bones`}`));
    const label = el('span', 'treat-label'); label.setAttribute('aria-hidden', 'true');
    label.append(el('span', 'treat-label-full', dimension.label), el('span', 'treat-label-short', dimension.short));
    const compact = el('span', 'bone-count'); compact.setAttribute('aria-hidden', 'true');
    compact.append(el('span', '', bones === null ? '—' : String(bones)), boneIcon(bones !== null));
    const rating = el('span', bones === null ? 'treat-unrated' : 'bone-slots'); rating.setAttribute('aria-hidden', 'true');
    if (bones === null) rating.textContent = reason;
    else for (let i = 0; i < 5; i++) rating.append(boneIcon(i < bones));
    item.title = `${dimension.label}: ${bones === null ? reason : `${bones} out of 5 bones`}`;
    item.append(label, compact, rating); list.append(item);
  }
  if (counting?.mode === 'write') return;
  if (!state.completed) {
    details.append(el('p', '', interrupted ? 'This attempt was interrupted. Play again when you’re ready to earn treats for Uno.' : 'Play the rhythm to earn bone treats for Uno!'));
    return;
  }
  const { record, assessment } = state.completed;
  host.dataset.exerciseId = record.exercise.id;
  details.append(el('p', 'treat-attempt', `${state.previous ? 'Previous completed attempt' : 'Completed attempt'} · ${(record.playStyle ?? 'hold') === 'hold' ? 'Tap + Hold' : 'Tap'}`));
  const feedback = musicalFeedback(record, assessment);
  details.append(el('p', 'result-summary', feedback.summary));
  if (feedback.suggestion) details.append(el('p', 'result-suggestion', feedback.suggestion));
  // Same assessment snapshot as the performance review, never re-score for layout.
  const metrics = el('ul', 'treat-assessment');
  metrics.append(el('li', '', `Rhythm: ${assessment.rhythm === null ? 'Unavailable' : `${Math.round(assessment.rhythm)}%`} · ${assessment.basis === 'performed' ? 'performed tempo' : assessment.basis === 'target' ? 'target tempo' : 'not enough evidence'}`));
  metrics.append(el('li', '', (record.playStyle ?? 'hold') === 'tap' ? 'Holding notes: Not assessed in Tap' : assessment.hold === null ? `Holding notes: ${assessment.holdReason ?? 'Not enough evidence'}` : `Holding notes: ${Math.round(assessment.hold)}%`));
  metrics.append(el('li', '', assessment.tempo ? `Tempo: ${Math.round(assessment.tempo.bpm)} BPM · target ${assessment.targetBpm} · ${tempoDescription(assessment.tempo.differencePercent, assessment)}` : 'Tempo: Not enough evidence'));
  metrics.append(el('li', '', assessment.steadiness === null || !assessment.tempo ? 'Steady beat: Not enough evidence' : `Steady beat: ${steadinessDescription(assessment.steadiness, assessment)} · ${Math.round(assessment.steadiness)}% typical variation`));
  details.append(metrics);
}
