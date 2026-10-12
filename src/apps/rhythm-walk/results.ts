import { el, button } from '../../shared/ui/components.ts';
import type { Assessment } from './assessment.ts';
import type { AttemptRecord } from './capture.ts';

export function tempoDescription(difference: number, a: Assessment) {
  const amount = Math.abs(difference);
  return amount <= a.policy.onTargetPercent + 1e-9 ? 'On target' : `${amount <= a.policy.slightTempoPercent + 1e-9 ? 'Slightly ' : ''}${difference < 0 ? 'slower' : 'faster'}`.replace(/^./, c => c.toUpperCase());
}
export function steadinessDescription(variation: number, a: Assessment) {
  return variation <= a.policy.steadyPercent + 1e-9 ? 'Steady' : variation <= a.policy.mostlySteadyPercent + 1e-9 ? 'Mostly steady' : 'Uneven';
}
export function createResults(record: AttemptRecord, a: Assessment, retry: () => void, next: () => void, nextIssue: string | null) {
  const panel = el('section', 'performance-results'); panel.setAttribute('aria-labelledby', 'performance-results-heading');
  const heading = el('h2', '', record.status === 'completed' ? 'Performance results' : 'Interrupted attempt'); heading.id = 'performance-results-heading'; heading.tabIndex = -1;
  panel.append(heading);
  if (record.status === 'interrupted') panel.append(el('p', '', `${record.reason}. This attempt is not graded. Try again when ready.`));
  else {
    const metrics = el('div', 'result-metrics');
    const rhythmLabel = a.basis === 'performed' ? 'Rhythm accuracy at performed tempo' : a.basis === 'target' ? 'Rhythm accuracy at target tempo' : 'Rhythm accuracy';
    metrics.append(el('p', '', `${rhythmLabel}: ${a.rhythm === null ? 'Unavailable' : `${Math.round(a.rhythm)}%`}`));
    if ((record.playStyle ?? 'hold') === 'hold') metrics.append(el('p', '', a.hold === null ? `Hold accuracy: Unavailable · ${a.holdReason}` : `Hold accuracy: ${Math.round(a.hold)}% across ${a.matchedNotes} played notes`));
    if (a.tempo) {
      const difference = a.tempo.differencePercent;
      metrics.append(el('p', '', `Performed tempo: ${Math.round(a.tempo.bpm)} BPM · target ${a.targetBpm} · ${Math.round(Math.abs(difference))}% ${Math.abs(difference) < .000001 ? 'difference' : difference < 0 ? 'slower' : 'faster'} · ${tempoDescription(difference, a)}`));
    } else metrics.append(el('p', '', `Performed tempo: Not enough evidence · target ${a.targetBpm} BPM`));
    metrics.append(el('p', '', a.steadiness === null ? 'Pulse steadiness: Not enough evidence' : `Pulse steadiness: ${steadinessDescription(a.steadiness, a)} · typical pace variation ${Math.round(a.steadiness)}%`));
    panel.append(metrics);
    if (a.reason) panel.append(el('p', 'note', a.reason));
    panel.append(el('p', 'note', 'Pattern accuracy uses the labeled tempo basis. The score feedback and received timeline below remain relative to target time.'));
    const details = el('details'); details.append(el('summary', '', 'Assessment details'));
    details.append(el('p', '', `${a.expectedAttacks} expected attacks · ${a.capturedAttacks} received attacks. ${a.basis === 'unavailable' ? 'Association counts unavailable.' : `${a.matchedNotes} matched · ${a.missing} missing · ${a.extra} extra · ${a.usableIntervals} usable pace intervals spanning ${Number(a.intervalSpan.toFixed(2))} performance beats.`}`));
    if (a.tempoReason) details.append(el('p', '', a.tempoReason));
    if (a.steadinessReason) details.append(el('p', '', a.steadinessReason));
    details.append(el('p', '', 'Pulse steadiness measures typical variation; it does not mean every beat was correct. These are initial tuning defaults, not mastery standards.'));
    panel.append(details);
  }
  const actions = el('div', 'result-actions');
  const nextButton = button('Next exercise', next); nextButton.disabled = Boolean(nextIssue);
  actions.append(button('Try again', retry), nextButton); panel.append(actions);
  const issue = el('p', 'note', nextIssue ?? ''); issue.hidden = !nextIssue; panel.append(issue);
  return { panel, heading, sync: (message: string | null) => { nextButton.disabled = Boolean(message); issue.textContent = message ?? ''; issue.hidden = !message; } };
}
