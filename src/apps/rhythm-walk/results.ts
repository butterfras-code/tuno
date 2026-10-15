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
export function createResults(record: AttemptRecord, a: Assessment, retry: () => void, next: () => void, nextIssue: string | null) {
  const panel = el('section', 'performance-results'); panel.setAttribute('aria-labelledby', 'performance-results-heading');
  const heading = el('h2', '', record.status === 'completed' ? 'Performance results' : 'Interrupted attempt'); heading.id = 'performance-results-heading'; heading.tabIndex = -1;
  panel.append(heading);
  if (record.status === 'interrupted') panel.append(el('p', '', `${record.reason}. This attempt is not graded. Try again when ready.`));
  else {
    const details = el('details'); details.append(el('summary', '', 'Details'));
    const metrics = el('div', 'result-metrics');
    const rhythmLabel = a.basis === 'performed' ? 'Rhythm accuracy at performed tempo' : a.basis === 'target' ? 'Rhythm accuracy at target tempo' : 'Rhythm accuracy';
    metrics.append(el('p', '', `${rhythmLabel}: ${a.rhythm === null ? 'Unavailable' : `${Math.round(a.rhythm)}%`}`));
    if ((record.playStyle ?? 'hold') === 'hold') metrics.append(el('p', '', a.hold === null ? `Hold accuracy: Unavailable · ${a.holdReason}` : `Hold accuracy: ${Math.round(a.hold)}% across ${a.matches.filter(m => m.holdCredit !== null).length} assessed notes`));
    if (a.tempo) {
      const difference = a.tempo.differencePercent;
      metrics.append(el('p', '', `Performed tempo: ${Math.round(a.tempo.bpm)} BPM · target ${a.targetBpm} · ${Math.round(Math.abs(difference))}% ${Math.abs(difference) < .000001 ? 'difference' : difference < 0 ? 'slower' : 'faster'} · ${tempoDescription(difference, a)}`));
    } else metrics.append(el('p', '', `Performed tempo: Not enough evidence · target ${a.targetBpm} BPM`));
    metrics.append(el('p', '', a.steadiness === null ? 'Pulse steadiness: Not enough evidence' : `Pulse steadiness: ${steadinessDescription(a.steadiness, a)} · typical pace variation ${Math.round(a.steadiness)}%`));
    details.append(metrics);
    if (a.reason) details.append(el('p', 'note', a.reason));
    details.append(el('p', 'note', record.assessmentPolicy?.version === 2 ? 'Expected bars use target time; received positions are actual input. Accepted colors use the labeled assessment tempo and elapsed sustain. Target tempo is an explicit fallback when spacing evidence is insufficient.' : 'This saved attempt retains its legacy assessment. Score and timeline colors use target-relative attack/release feedback; pattern metrics use the labeled tempo basis.'));
    details.append(el('p','',`Assessment policy ${a.policy.version}${a.holdPolicy ? ` · hold policy ${a.holdPolicy.version}` : ' · legacy saved release policy'}`));
    const durations = el('ul');
    a.matches.forEach(m => {
      const d = m.duration;
      if (!d) return;
      const elapsed = d.elapsed === null ? 'no release observed' : `held ${Math.round(d.elapsed*1000)} ms`;
      const sustain = !d.eligible ? 'hold not assessed (short note)' : `full sustain credit from ${Math.round(d.minimum*1000)} to ${Math.round(d.maximum*1000)} ms`;
      const optional = d.waivedFinalDuration ? ` · final tied member optional (${Math.round(d.waivedFinalDuration*1000)} ms)` : '';
      const credit = m.holdCredit !== null ? ` · hold credit ${Math.round(m.holdCredit*100)}% including musical rest checks` : '';
      durations.append(el('li','',`Note ${m.expected+1}: ${elapsed} · intended ${Math.round(d.expectedDuration*1000)} ms · ${sustain}${optional}${credit}.`));
    });
    if (durations.childElementCount) details.append(durations);
    if (a.startingDisplacement !== null) details.append(el('p','',`Analytical starting displacement: ${Math.round(a.startingDisplacement*1000)} ms. Its source cannot be determined; it is not session calibration.`));
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

/** A single accessible text rating; the five reusable SVG slots are decorative. */
function boneIcon(earned: boolean) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 20'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `bone-slot${earned ? ' earned' : ''}`);
  svg.innerHTML = '<path d="M8 6C7 1 1 1 1 5c0 2 1 3 3 5-2 2-3 3-3 5 0 4 6 4 7-1h16c1 5 7 5 7 1 0-2-1-3-3-5 2-2 3-3 3-5 0-4-6-4-7 1Z"/>';
  return svg;
}
export function renderTreatBag(host: HTMLElement, state: TreatBagState, interrupted = false) {
  const heading = el('h2', '', 'Treat Bag: Earn Treats for Uno'); heading.id = 'feedback-snapshot-title';
  host.replaceChildren(heading);
  if (!state.completed) {
    host.append(el('p', '', interrupted ? 'This attempt was interrupted. Play again when you’re ready to earn treats for Uno.' : 'Play the rhythm to earn bone treats for Uno!'));
    return;
  }
  const { record, assessment, rewards } = state.completed;
  host.dataset.exerciseId = record.exercise.id;
  host.append(el('p', 'treat-attempt', `${state.previous ? 'Previous completed attempt' : 'Completed attempt'} · ${(record.playStyle ?? 'hold') === 'hold' ? 'Tap + Hold' : 'Tap'}`));
  const list = el('ul', 'treat-ratings');
  for (const category of rewards.categories) {
    const item = el('li');
    if (category.bones === null) item.append(el('span', '', category.label), el('span', 'treat-unrated', category.reason!));
    else {
      item.append(el('span', 'sr-only', `${category.label}: ${category.bones} out of 5 bones`));
      const label = el('span', '', category.label); label.setAttribute('aria-hidden', 'true');
      const slots = el('span', 'bone-slots'); slots.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 5; i++) slots.append(boneIcon(i < category.bones));
      item.append(label, slots);
    }
    list.append(item);
  }
  host.append(list);
  const feedback = musicalFeedback(record, assessment);
  host.append(el('p', 'result-summary', feedback.summary));
  if (feedback.suggestion) host.append(el('p', 'result-suggestion', feedback.suggestion));
}
