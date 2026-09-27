import { el } from '../../../shared/ui/components.ts';
import { animatedUno } from '../../../shared/ui/uno.ts';
import { onUnmount } from '../../../shared/ui/unmount.ts';
import { NotesStore } from '../persistence/store.ts';
import { presetSetup, localData } from './setup.ts';
import { spelling } from '../domain/notation.ts';
import type { AnswerSpelling, Letter } from '../domain/notation.ts';
import { Practice, PressGate } from '../engine/practice.ts';
import type { PromptToken } from '../engine/practice.ts';
import { NotesProgress } from '../engine/progress.ts';
import { answerControls } from './answers.ts';
import { renderStaff } from './staff.ts';
function button(text: string, action: () => void) {
  const node = el('button', 'control', text); node.type = 'button'; node.addEventListener('click', action); return node;
}
export function practiceView() {
  const node = el('section', 'practice-view');
  node.setAttribute('aria-label', 'Note reading Practice');
  const dog = animatedUno(); dog.pose('rest');
  const stage = el('div', 'practice-stage');
  const storageNotice = el('p', 'muted'); storageNotice.setAttribute('role', 'status');
  const setup = el('section');
  setup.append(el('h2', '', 'Practice'), el('p', '', 'Read one note at a time. Choose its letter with the buttons or A–G keys.'));
  let storage: Storage | undefined; try { storage = window.localStorage; } catch { /* usable without storage */ }
  const store = new NotesStore(storage);
  const presetsUI = presetSetup(store); const picker = presetsUI.picker;
  const selected = presetsUI.selected;
  const paceLabel = el('label', 'pace-option');
  const pace = el('input'); pace.type = 'checkbox'; pace.id = 'self-paced';
  paceLabel.append(pace, document.createTextNode(' Continue after feedback (self-paced)'));
  pace.checked = store.data.configuration.selfPaced;
  const dataUI = localData(store, () => { presetsUI.refresh(); pace.checked = store.data.configuration.selfPaced; });
  setup.append(presetsUI.node, paceLabel, el('p', 'muted', 'Untimed practice. Uno’s treat benchmark starts at 10 correct notes and follows your recent comparable sessions.'));
  const play = el('section'); play.hidden = true;
  const heading = el('h2'); heading.tabIndex = -1;
  const counts = el('p', 'counts'); counts.id = 'practice-counts';
  const staff = el('div', 'staff-panel');
  const feedback = el('p', 'feedback'); feedback.id = 'feedback'; feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
  const encouragement = el('p', 'encouragement'); encouragement.setAttribute('role', 'status');
  const answers = answerControls((answer, token) => submit(answer, token));
  const gate = new PressGate();
  const arrows = new Set<string>();
  let session: Practice | undefined;
  let profileId: string | undefined;
  let progress = new NotesProgress();
  let renderedPrompt = '';
  let inputSince = 0;
  let treatUntil = 0;
  let disposed = false;
  const showModifier = () => answers.modifier(session && !play.hidden && session.state !== 'paused' && session.state !== 'finished' && arrows.size === 1
    ? arrows.has('ArrowUp') ? 1 : arrows.has('ArrowDown') ? -1 : 0 : undefined);
  const result = el('section'); result.hidden = true;
  const resultHeading = el('h2', '', 'Practice results'); resultHeading.tabIndex = -1;
  const resultSummary = el('p'); resultSummary.id = 'result-summary';
  const resultTiming = el('p');
  const accuracy = (s: Practice) => s.accuracy === null ? '—' : `${Math.round(s.accuracy * 100)}%`;
  const showSetup = () => {
    session?.finish(); session = undefined; resetInput();
    setup.hidden = false; play.hidden = true; result.hidden = true; dog.pose('rest'); dog.look(false); dog.tail(0, false); picker.focus();
  };
  const finish = () => {
    if (!session) return;
    if (session.state === 'finished') return;
    session.finish(); store.record(profileId, session); store.flush(); dataUI.refresh(); resetInput(); play.hidden = true; result.hidden = false;
    resultSummary.textContent = `${session.correct} correct / ${session.attempts} attempts · Accuracy ${accuracy(session)} · Best streak ${session.bestStreak}`;
    const average = session.attempts ? `${(session.responseTotalMs / session.attempts / 1000).toFixed(1)} s` : '—';
    resultTiming.textContent = `${(session.activeMs / 1000).toFixed(1)} s active practice · Average response ${average}. ${session.interrupted ? 'Pauses excluded. ' : ''}${session.attempts ? 'Every note is a step forward. Thanks for practicing!' : 'Ready whenever you are. Try a note next time.'}`;
    dog.pose(session.correct >= progress.benchmark ? 'happy' : 'rest'); dog.look(false); dog.tail(0, false); resultHeading.focus();
  };
  const pause = button('Pause', () => {
    if (!session) return;
    resetInput();
    if (session.state === 'paused') { session.resume(); inputSince = performance.now(); } else session.pause();
    render();
  });
  const continueButton = button('Continue', () => { if (session?.advance(session.token, true)) { render(); answers.focus(); } });
  const render = () => {
    if (!session || session.state === 'finished') return;
    const storageMessage = store.durable ? '' : store.message;
    if (storageNotice.textContent !== storageMessage) storageNotice.textContent = storageMessage;
    const paused = session.state === 'paused';
    pause.textContent = paused ? 'Resume' : 'Pause';
    counts.textContent = `${session.correct} correct / ${session.attempts} attempts · Accuracy ${accuracy(session)} · Streak ${session.streak}`;
    const identity = `${session.session}:${session.prompt}`;
    if (renderedPrompt !== identity) {
      inputSince = performance.now(); renderedPrompt = identity; staff.replaceChildren(renderStaff(session.pitch, session.preset.clef, session.preset.key));
    }
    staff.hidden = paused;
    const locked = session.state !== 'running';
    answers.update(session.preset, session.token, locked);
    showModifier();
    continueButton.hidden = !(session.selfPaced && session.state === 'feedback');
    feedback.textContent = paused ? 'Paused. Resume when you’re ready.' : session.state === 'feedback' ? session.last!.correct ? `Correct — ${spelling(session.pitch)}. Nicely read!` : `That note is ${spelling(session.pitch)}. You’ll get another chance to practice it.` : 'Choose a spelling. A–G keys answer natural notes.';
    if (paused) { dog.look(false); dog.tail(0, false); }
  };
  const submit = (answer: AnswerSpelling, token: PromptToken) => {
    if (!session?.answer(token, answer)) return;
    store.observe(profileId, session.preset, session.last!);
    const reward = progress.update(session.correct, session.streak);
    dog.look(reward.look, -8); dog.pose(reward.treat ? 'catch' : reward.pose);
    dog.tail(0, reward.pose === 'wag');
    if (reward.nod) dog.nod();
    if (reward.treat) { dog.catch(counts); treatUntil = performance.now() + 450; }
    if (reward.text) encouragement.textContent = reward.text;
    render();
  };
  const start = () => {
    const preset = selected(); if (!preset) return;
    if (!presetsUI.saveConfiguration(pace.checked)) return;
    profileId = store.profile()?.id;
    session?.finish(); session = new Practice(preset, pace.checked); progress = new NotesProgress(store.benchmark(preset)); resetInput(); treatUntil = 0;
    heading.textContent = session.preset.name; encouragement.textContent = ''; dog.pose('rest'); dog.look(false); dog.tail(0, false);
    setup.hidden = true; result.hidden = true; play.hidden = false; render(); heading.focus();
  };
  const startButton = button('Start Practice', start);
  presetsUI.onChange(() => { startButton.disabled = !selected(); });
  setup.append(startButton, dataUI.node);
  const controls = el('div', 'control-row'); controls.append(pause, continueButton, button('Finish', finish));
  const keyboardHelp = el('p', 'muted keyboard-help', 'Keyboard: A–G = natural · hold ↑ + letter = ♯ · hold ↓ + letter = ♭ · hold → + letter = ♮.');
  play.append(heading, counts, staff, feedback, answers.node, keyboardHelp, encouragement, controls);
  const resultControls = el('div', 'control-row'); resultControls.append(button('Retry', start), button('Edit setup', showSetup), button('Home', showSetup));
  result.append(resultHeading, resultSummary, resultTiming, resultControls);
  stage.append(setup, play, result, storageNotice); node.append(stage, dog.node);
  const keydown = (event: KeyboardEvent) => {
    const fresh = gate.down(event.code || event.key, event.repeat);
    if (!session || play.hidden || event.timeStamp < inputSince || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]'))) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); if (fresh) arrows.add(event.key); showModifier(); return; }
    const letter = event.key.toUpperCase();
    if (/^[A-G]$/.test(letter)) { event.preventDefault(); if (fresh && arrows.size < 2) answers.letter(letter as Letter, arrows.has('ArrowUp') ? 1 : arrows.has('ArrowDown') ? -1 : 0); }
    else if ((event.key === 'Enter' || event.key === ' ') && answers.buttons.includes(event.target as HTMLButtonElement)) {
      event.preventDefault(); if (fresh) answers.focused(event.target as HTMLButtonElement);
    }
  };
  const keyup = (event: KeyboardEvent) => { gate.up(event.code || event.key); arrows.delete(event.key); showModifier(); };
  // Key releases outside the page may never reach document; repeats remain gated.
  const resetInput = () => { gate.reset(); arrows.clear(); answers.reset(); answers.modifier(); };
  const visibility = () => { if (document.hidden) { resetInput(); store.flush(); session?.pause(); render(); } };
  window.addEventListener('blur', resetInput);
  document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup); document.addEventListener('visibilitychange', visibility);
  const timer = setInterval(() => {
    const storageMessage = store.durable ? '' : store.message;
    if (storageNotice.textContent !== storageMessage) storageNotice.textContent = storageMessage;
    if (!session || session.state === 'finished' || session.state === 'paused') return;
    if (treatUntil && performance.now() >= treatUntil) { dog.pose('happy'); treatUntil = 0; }
    if (session.advance(session.token)) render();
  }, 25);
  const dispose = () => {
    if (disposed) return; disposed = true; answers.reset(); store.flush(); dataUI.dispose(); clearInterval(timer); stopWatching(); dog.dispose();
    document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', resetInput);
  };
  const stopWatching = onUnmount(node, dispose);
  return { node, dispose };
}
