import { el } from '../../../shared/ui/components.ts';
import { animatedUno } from '../../../shared/ui/uno.ts';
import { onUnmount } from '../../../shared/ui/unmount.ts';
import { defaultPreset, presets } from '../domain/presets.ts';
import { pitchLabel, spelling } from '../domain/notation.ts';
import type { Letter } from '../domain/notation.ts';
import { Practice, PressGate } from '../engine/practice.ts';
import type { PromptToken } from '../engine/practice.ts';
import { NotesProgress } from '../engine/progress.ts';
import { renderStaff } from './staff.ts';
function button(text: string, action: () => void) {
  const node = el('button', 'control', text); node.type = 'button'; node.addEventListener('click', action); return node;
}
export function practiceView() {
  const node = el('section', 'practice-view');
  node.setAttribute('aria-label', 'Note reading Practice');
  const dog = animatedUno(); dog.pose('rest');
  const stage = el('div', 'practice-stage');
  const setup = el('section');
  setup.append(el('h2', '', 'Practice'), el('p', '', 'Read one note at a time. Choose its letter with the buttons or A–G keys.'));
  const label = el('label', '', 'Preset ');
  const picker = el('select', 'control'); picker.id = 'preset';
  for (const clef of ['treble', 'bass']) {
    const group = el('optgroup'); group.label = `${clef === 'treble' ? 'Treble' : 'Bass'} clef`;
    for (const preset of presets.filter(p => p.clef === clef)) { const option = el('option', '', preset.name); option.value = preset.id; group.append(option); }
    picker.append(group);
  }
  picker.value = defaultPreset.id; label.append(picker);
  const summary = el('p');
  const selected = () => presets.find(p => p.id === picker.value)!;
  const summarize = () => { const p = selected(); summary.textContent = `C major · ${p.pool.length} notes · ${p.pool.map(pitchLabel).join(', ')} · Adaptive off`; };
  summarize(); picker.addEventListener('change', summarize);
  const paceLabel = el('label', 'pace-option');
  const pace = el('input'); pace.type = 'checkbox'; pace.id = 'self-paced';
  paceLabel.append(pace, document.createTextNode(' Continue after feedback (self-paced)'));
  setup.append(label, summary, paceLabel, el('p', 'muted', 'Untimed, memory-only practice. Uno earns a treat at 10 correct notes.'));
  const play = el('section'); play.hidden = true;
  const heading = el('h2'); heading.tabIndex = -1;
  const counts = el('p', 'counts'); counts.id = 'practice-counts';
  const staff = el('div', 'staff-panel');
  const feedback = el('p', 'feedback'); feedback.id = 'feedback'; feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
  const encouragement = el('p', 'encouragement'); encouragement.setAttribute('role', 'status');
  const answers = el('div', 'answers'); answers.setAttribute('role', 'group'); answers.setAttribute('aria-label', 'Answer letter');
  const answerButtons: HTMLButtonElement[] = [];
  const pointers = new Map<HTMLButtonElement, PromptToken>();
  const gate = new PressGate();
  let session: Practice | undefined;
  let progress = new NotesProgress();
  let renderedPrompt = '';
  let inputSince = 0;
  let treatUntil = 0;
  let disposed = false;
  const result = el('section'); result.hidden = true;
  const resultHeading = el('h2', '', 'Practice results'); resultHeading.tabIndex = -1;
  const resultSummary = el('p'); resultSummary.id = 'result-summary';
  const resultTiming = el('p');
  const accuracy = (s: Practice) => s.accuracy === null ? '—' : `${Math.round(s.accuracy * 100)}%`;
  const showSetup = () => {
    session?.finish(); session = undefined; pointers.clear();
    setup.hidden = false; play.hidden = true; result.hidden = true; dog.pose('rest'); dog.look(false); dog.tail(0, false); picker.focus();
  };
  const finish = () => {
    if (!session) return;
    session.finish(); pointers.clear(); play.hidden = true; result.hidden = false;
    resultSummary.textContent = `${session.correct} correct / ${session.attempts} attempts · Accuracy ${accuracy(session)} · Best streak ${session.bestStreak}`;
    const average = session.attempts ? `${(session.observations.reduce((sum, r) => sum + r.responseMs, 0) / session.attempts / 1000).toFixed(1)} s` : '—';
    resultTiming.textContent = `${(session.activeMs / 1000).toFixed(1)} s active practice · Average response ${average}. ${session.interrupted ? 'Pauses excluded. ' : ''}${session.attempts ? 'Every note is a step forward. Thanks for practicing!' : 'Ready whenever you are. Try a note next time.'}`;
    dog.pose(session.correct >= 10 ? 'happy' : 'rest'); dog.look(false); dog.tail(0, false); resultHeading.focus();
  };
  const pause = button('Pause', () => {
    if (!session) return;
    pointers.clear();
    if (session.state === 'paused') { session.resume(); inputSince = performance.now(); } else session.pause();
    render();
  });
  const continueButton = button('Continue', () => { if (session?.advance(session.token, true)) { render(); answerButtons[0]!.focus(); } });
  const render = () => {
    if (!session || session.state === 'finished') return;
    const paused = session.state === 'paused';
    pause.textContent = paused ? 'Resume' : 'Pause';
    counts.textContent = `${session.correct} correct / ${session.attempts} attempts · Accuracy ${accuracy(session)} · Streak ${session.streak}`;
    const identity = `${session.session}:${session.prompt}`;
    if (renderedPrompt !== identity) {
      inputSince = performance.now(); renderedPrompt = identity; staff.replaceChildren(renderStaff(session.pitch, session.preset.clef, session.preset.key));
    }
    staff.hidden = paused;
    const locked = session.state !== 'running';
    answerButtons.forEach(b => { b.setAttribute('aria-disabled', String(locked)); });
    continueButton.hidden = !(session.selfPaced && session.state === 'feedback');
    feedback.textContent = paused ? 'Paused. Resume when you’re ready.' : session.state === 'feedback' ? session.last!.correct ? `Correct — ${spelling(session.pitch)}. Nicely read!` : `That note is ${spelling(session.pitch)}. You’ll get another chance to practice it.` : 'Choose a letter. A–G keys work too.';
    if (paused) { dog.look(false); dog.tail(0, false); }
  };
  const submit = (letter: Letter, token: PromptToken) => {
    if (!session?.answer(token, { letter, accidental: 0 })) return;
    const reward = progress.update(session.correct, session.streak);
    dog.look(reward.look, -8); dog.pose(reward.treat ? 'catch' : reward.pose);
    dog.tail(0, reward.pose === 'wag');
    if (reward.nod) dog.nod();
    if (reward.treat) { dog.catch(counts); treatUntil = performance.now() + 450; }
    if (reward.text) encouragement.textContent = reward.text;
    render();
  };
  for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const) {
    const b = el('button', 'control answer', letter); b.type = 'button'; b.setAttribute('aria-keyshortcuts', letter);
    b.addEventListener('pointerdown', event => { pointers.delete(b); if (event.timeStamp >= inputSince && session?.state === 'running') pointers.set(b, session.token); });
    b.addEventListener('pointercancel', () => pointers.delete(b));
    b.addEventListener('click', event => {
      if (event.timeStamp < inputSince) return;
      const token = event.detail === 0 ? session?.token : pointers.get(b);
      pointers.delete(b); if (token) submit(letter, token);
    });
    answerButtons.push(b); answers.append(b);
  }
  const start = () => {
    session?.finish(); session = new Practice(selected(), pace.checked); progress = new NotesProgress(); pointers.clear(); treatUntil = 0;
    heading.textContent = session.preset.name; encouragement.textContent = ''; dog.pose('rest'); dog.look(false); dog.tail(0, false);
    setup.hidden = true; result.hidden = true; play.hidden = false; render(); heading.focus();
  };
  setup.append(button('Start Practice', start));
  const controls = el('div', 'control-row'); controls.append(pause, continueButton, button('Finish', finish));
  play.append(heading, counts, staff, feedback, answers, encouragement, controls);
  const resultControls = el('div', 'control-row'); resultControls.append(button('Retry', start), button('Edit setup', showSetup), button('Home', showSetup));
  result.append(resultHeading, resultSummary, resultTiming, resultControls);
  stage.append(setup, play, result); node.append(stage, dog.node);
  const keydown = (event: KeyboardEvent) => {
    const fresh = gate.down(event.code || event.key, event.repeat);
    if (!session || play.hidden || event.timeStamp < inputSince || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]'))) return;
    const letter = event.key.toUpperCase();
    if (/^[A-G]$/.test(letter)) { event.preventDefault(); if (fresh) submit(letter as Letter, session.token); }
    else if ((event.key === 'Enter' || event.key === ' ') && answerButtons.includes(event.target as HTMLButtonElement)) {
      event.preventDefault(); if (fresh) submit((event.target as HTMLButtonElement).textContent as Letter, session.token);
    }
  };
  const keyup = (event: KeyboardEvent) => gate.up(event.code || event.key);
  // Key releases outside the page may never reach document; repeats remain gated.
  const resetInput = () => { gate.reset(); pointers.clear(); };
  const visibility = () => { if (document.hidden) { resetInput(); session?.pause(); render(); } };
  window.addEventListener('blur', resetInput);
  document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup); document.addEventListener('visibilitychange', visibility);
  const timer = setInterval(() => {
    if (!session || session.state === 'finished' || session.state === 'paused') return;
    if (treatUntil && performance.now() >= treatUntil) { dog.pose('happy'); treatUntil = 0; }
    if (session.advance(session.token)) render();
  }, 25);
  const dispose = () => {
    if (disposed) return; disposed = true; clearInterval(timer); stopWatching(); dog.dispose();
    document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', resetInput);
  };
  const stopWatching = onUnmount(node, dispose);
  return { node, dispose };
}
