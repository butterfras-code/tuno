import { Challenge, describeRules } from '../engine/challenge.ts';
import { challengeSetup } from './challenge-setup.ts';
import { activePool, recommendation } from '../engine/adaptive.ts';
import { notePreview } from './note-preview.ts';
import { beginnerPreview } from '../engine/preview.ts';
import type { PreviewExposure } from './note-preview.ts';
import { fingerprint } from '../domain/presets.ts';
import type { Context } from '../persistence/store.ts';
import { el } from '../../../shared/ui/components.ts';
import { animatedUno } from '../../../shared/ui/uno.ts';
import { onUnmount } from '../../../shared/ui/unmount.ts';
import { NotesStore } from '../persistence/store.ts';
import { presetSetup, localData } from './setup.ts';
import { clefForPitch } from '../domain/presets.ts';
import { spelling } from '../domain/notation.ts';
import type { AnswerSpelling, Letter } from '../domain/notation.ts';
import { Practice, PressGate } from '../engine/practice.ts';
import { segments } from './range-editor.ts';
import type { ContinueAfter, PromptToken } from '../engine/practice.ts';
import { NotesProgress } from '../engine/progress.ts';
import { answerControls } from './answers.ts';
import { renderStaff } from './staff.ts';
function button(text: string, action: () => void) {
  const node = el('button', 'control', text); node.type = 'button'; node.addEventListener('click', action); return node;
}
export function practiceView() {
  let activity: 'practice' | 'challenge' = 'practice';
  const rulesUI = challengeSetup();
  const node = el('section', 'practice-view');
  node.setAttribute('aria-label', 'Note reading Practice');
  const dog = animatedUno(); dog.pose('rest');
  const stage = el('div', 'practice-stage');
  const storageNotice = el('p', 'muted'); storageNotice.setAttribute('role', 'status');
  const setup = el('section');
  setup.className = 'practice-setup';
  let storage: Storage | undefined; try { storage = window.localStorage; } catch { /* usable without storage */ }
  const store = new NotesStore(storage);
  const presetsUI = presetSetup(store); const picker = presetsUI.picker;
  const selected = presetsUI.selected;
  const options = el('section', 'notes-options'); options.hidden = true;
  options.append(el('h2', '', 'Options'));
  let pace: ContinueAfter = store.data.configuration.continueAfter ?? (store.data.configuration.selfPaced ? 'click' : 'delay');
  const pacingControls: ReturnType<typeof segments<ContinueAfter>>[] = [];
  const refreshPacing = () => pacingControls.forEach(control => control.update([pace]));
  const pacingSetting = () => {
    const pacing = segments<ContinueAfter>('Continue After', [['instant','Instant'],['delay','Delay'],['click','Click/Tap'],['correct','Correct']], value => {
      pace = value; refreshPacing();
      store.update(data => { data.configuration.continueAfter = pace; data.configuration.selfPaced = pace === 'click'; });
    });
    pacingControls.push(pacing); pacing.update([pace]);
    const field = el('div','setting pacing-setting'); field.append(el('span','setting-label','Continue After:'),pacing.node);
    return field;
  };
  options.append(pacingSetting());
  let guestAdaptive = false, guestPreview: boolean | undefined;
  const guestContexts = new Map<string, Context>();
  let useAdaptation = false, showIntro = false;
  const adaptiveHelp = el('p','muted adaptive-help', 'We’ll practice notes you miss and add new ones when you’re ready.');
  adaptiveHelp.id = 'adaptive-help'; adaptiveHelp.popover = 'auto'; adaptiveHelp.setAttribute('role','tooltip');
  const adaptiveGroup = el('div','adaptive-control');
  let helpPinned = false;
  const hideHelp = () => { helpPinned = false; adaptiveHelp.hidePopover(); };
  const showHelp = () => {
    const rect = help.getBoundingClientRect();
    adaptiveHelp.style.left = `${Math.max(8,Math.min(rect.left,innerWidth - 308))}px`;
    adaptiveHelp.style.top = `${Math.max(8,Math.min(rect.bottom + 8,innerHeight - 120))}px`;
    adaptiveHelp.showPopover();
  };
  const help = button('?', () => { if (helpPinned) hideHelp(); else { showHelp(); helpPinned = true; } });
  help.classList.add('adaptive-help-trigger'); help.setAttribute('aria-label','About Adapt Range');
  help.setAttribute('aria-controls','adaptive-help'); help.setAttribute('aria-expanded','false'); help.setAttribute('aria-describedby','adaptive-help');
  help.addEventListener('pointerenter',event => { if (event.pointerType === 'mouse') showHelp(); });
  help.addEventListener('focus',showHelp);
  adaptiveGroup.addEventListener('pointerleave',() => { if (!helpPinned && document.activeElement !== help) hideHelp(); });
  adaptiveGroup.addEventListener('focusout',() => { queueMicrotask(() => { if (!adaptiveGroup.contains(document.activeElement)) hideHelp(); }); });
  adaptiveHelp.addEventListener('toggle',() => {
    const open = adaptiveHelp.matches(':popover-open'); help.setAttribute('aria-expanded',String(open)); if (!open) helpPinned = false;
  });
  const adaptive = button('Adapt Range', () => {
    useAdaptation = !useAdaptation;
    const p = store.profile();
    if (p) store.update(data => { data.profiles.find(v => v.id === p.id)!.adaptive = useAdaptation; }); else guestAdaptive = useAdaptation;
    refreshPreferences();
  }); adaptive.id = 'adaptive';
  const previewToggle = button('Show Intro', () => {
    showIntro = !showIntro;
    const p = store.profile();
    if (p) store.update(data => { data.profiles.find(v => v.id === p.id)!.preview = showIntro; }); else guestPreview = showIntro;
    refreshPreferences();
  }); previewToggle.id = 'meet-notes';
  const refreshPreferences = () => {
    const p = store.profile(); useAdaptation = p ? p.adaptive ?? false : guestAdaptive;
    showIntro = (p ? p.preview : guestPreview) ?? (selected() ? beginnerPreview(selected()!) : false);
    adaptive.setAttribute('aria-pressed',String(useAdaptation)); previewToggle.setAttribute('aria-pressed',String(showIntro));
    adaptiveGroup.classList.toggle('selected',useAdaptation);
  };
  refreshPreferences();
  const dataUI = localData(store, () => {
    showSetup(); guestContexts.clear(); guestAdaptive = false; guestPreview = undefined; presetsUI.refresh();
    pace = store.data.configuration.continueAfter ?? (store.data.configuration.selfPaced ? 'click' : 'delay'); refreshPacing(); refreshPreferences();
  },refreshPreferences);
  options.append(dataUI.node);
  adaptiveGroup.append(adaptive,help,adaptiveHelp);
  const toggles = el('div','control-row practice-toggles'); toggles.append(adaptiveGroup,previewToggle);
  const practicePacing = pacingSetting();
  setup.append(presetsUI.node, toggles, practicePacing, rulesUI.node);
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
  let introduction: ReturnType<typeof notePreview> | undefined;
  const closePreview = () => { introduction?.dispose(); introduction?.node.remove(); introduction = undefined; dog.node.hidden = false; node.classList.remove('previewing'); };
  let profileId: string | undefined;
  let progress = new NotesProgress();
  let renderedPrompt = '';
  let inputSince = 0;
  let treatUntil = 0;
  let encouragementUntil = 0;
  let disposed = false;
  const showModifier = () => answers.modifier(session && !play.hidden && session.state !== 'paused' && session.state !== 'finished' && arrows.size === 1
    ? arrows.has('ArrowUp') ? 1 : arrows.has('ArrowDown') ? -1 : 0 : undefined);
  const result = el('section'); result.hidden = true;
  const resultHeading = el('h2', '', 'Practice results'); resultHeading.tabIndex = -1;
  const resultSummary = el('p'); resultSummary.id = 'result-summary';
  const resultTiming = el('p');
  const resultChallenge = el('p'); resultChallenge.id = 'challenge-result';
  let resultRecorded = false;
  const roundStatus = el('p','counts'); roundStatus.id = 'challenge-status';
  const roundRules = el('p','muted');
  const ready = button('Ready', () => { if (session instanceof Challenge) { session.ready(); resetInput(); render(); heading.focus(); } });
  const coaching = el('p'); coaching.id = 'recommendation';
  const expansion = el('p'); expansion.id = 'expansion-announcement'; expansion.setAttribute('role','status');
  const accuracy = (s: Practice) => s.accuracy === null ? '—' : `${Math.round(s.accuracy * 100)}%`;
  const showSetup = () => {
    closePreview(); session?.finish(); session = undefined; resetInput();
    setup.hidden = false; play.hidden = true; result.hidden = true; dog.pose('rest'); dog.look(false); dog.tail(0, false); if (!node.hidden) picker.focus();
  };
  const finish = () => {
    if (!session) return;
    if (resultRecorded) return;
    resultRecorded = true; session.finish(); store.record(profileId, session); store.flush(); dataUI.refresh(); resetInput(); play.hidden = true; result.hidden = false;
    resultSummary.textContent = `${session.correct} correct / ${session.attempts} attempts · Accuracy ${accuracy(session)} · Best streak ${session.bestStreak}`;
    const average = session.attempts ? `${(session.responseTotalMs / session.attempts / 1000).toFixed(1)} s` : '—';
    resultTiming.textContent = `${(session.activeMs / 1000).toFixed(1)} s active practice · Average response ${average}. ${session.interrupted ? 'Pauses excluded. ' : ''}${session.attempts ? 'Every note is a step forward. Thanks for practicing!' : 'Ready whenever you are. Try a note next time.'}`;
    resultHeading.textContent = session instanceof Challenge ? 'Challenge results' : 'Practice results';
    resultChallenge.hidden = !(session instanceof Challenge);
    if (session instanceof Challenge) {
      const qualified = session.qualified;
      const value = session.rules.goal === 'timed' ? `Score ${session.score.toFixed(2)}` : `Time ${(Math.floor(session.activeMs) / 1000).toFixed(2)} s`;
      const message = session.end === 'timeout' ? 'Nice practice — try another round.' : session.end === 'partial' ? 'Round ended early. Thanks for practicing!' : session.interrupted ? 'Interrupted run. Thanks for practicing!' : !session.attempts ? 'Ready whenever you are. Try a note next time.' : !qualified ? 'Nice run! Improve your accuracy to make finals.' : 'Nice run! Challenge complete.';
      resultChallenge.textContent = `${profileId ? store.data.profiles.find(p => p.id === profileId)?.name ?? 'Player 1' : 'Player 1'} · ${qualified ? 'Rank 1 · Qualified' : 'Unranked'} · ${value} · ${session.end === 'timeout' ? `${session.correct}/${session.rules.goal === 'target' ? session.rules.target : ''} correct · ` : ''}${message}`;
      resultTiming.textContent = `${describeRules(session.rules)} · ${(Math.floor(session.activeMs) / 1000).toFixed(2)} s active time · ${session.end}${session.interrupted ? ' · Interrupted (pauses excluded)' : ''}`;
    }
    coaching.textContent = recommendation(session.attempts,session.correct,session.learning.notes,session.misses);
    dog.pose(session.correct >= progress.benchmark ? 'happy' : 'rest'); dog.look(false); dog.tail(0, false); resultHeading.focus();
  };
  const pause = button('Pause', () => {
    if (!session) return;
    resetInput();
    if (session.state === 'paused') { session.resume(); inputSince = performance.now(); } else session.pause();
    if (session.state === 'finished') finish(); else render();
  });
  const continueButton = button('Continue', () => { if (session?.advance(session.token, true)) { render(); answers.focus(); } });
  const render = () => {
    if (!session || session.state === 'finished') return;
    const storageMessage = store.durable ? '' : store.message;
    if (storageNotice.textContent !== storageMessage) storageNotice.textContent = storageMessage;
    const paused = session.state === 'paused';
    const waiting = session instanceof Challenge && session.phase !== 'playing';
    roundStatus.hidden = !(session instanceof Challenge); roundRules.hidden = !(session instanceof Challenge);
    ready.hidden = !(session instanceof Challenge && session.phase === 'ready' && !paused);
    answers.node.hidden = waiting; keyboardHelp.hidden = waiting;
    if (session instanceof Challenge) {
      roundRules.textContent = describeRules(session.rules);
      roundStatus.textContent = paused ? 'Paused — this run is unranked.' : session.phase === 'ready' ? 'Ready when you are.' : session.phase === 'countdown' ? `Starting in ${session.countdown}…` : `${(session.remainingMs / 1000).toFixed(1)} s remaining${session.rules.goal === 'target' ? ` · ${session.correct}/${session.rules.target} correct` : ` · Score ${session.score.toFixed(2)}`}`;
    }
    pause.textContent = paused ? 'Resume' : 'Pause';
    counts.textContent = `${session.correct} correct / ${session.attempts} attempts · Accuracy ${accuracy(session)} · Streak ${session.streak} (best ${session.bestStreak})`;
    const identity = `${session.session}:${session.prompt}`;
    if (renderedPrompt !== identity) {
      inputSince = performance.now(); renderedPrompt = identity; staff.replaceChildren(renderStaff(session.pitch, clefForPitch(session.preset, session.pitch), session.preset.key));
    }
    staff.hidden = paused || waiting;
    const locked = session.state !== 'running' || waiting;
    expansion.textContent = session.announcement;
    answers.update(session.activePreset, session.token, locked);
    showModifier();
    continueButton.hidden = !(session.selfPaced && session.state === 'feedback');
    feedback.textContent = paused ? 'Paused. Resume when you’re ready.' : session.state === 'feedback' ? session.last!.correct ? `Correct — ${spelling(session.pitch)}. Nicely read!` : session.continueAfter === 'correct' ? 'Not quite. Try again.' : `That note is ${spelling(session.pitch)}. You’ll get another chance to practice it.` : '';
    if (paused) { dog.look(false); dog.tail(0, false); }
  };
  const submit = (answer: AnswerSpelling, token: PromptToken) => {
    if (!session?.answer(token, answer)) { if (session?.state === 'finished') finish(); return; }
    store.observe(profileId, session.preset, session.last!, session.adaptive, session.savedLearning);
    if (!profileId) {
      const fp = fingerprint(session.preset,session.adaptive,session.activity);
      guestContexts.delete(fp);
      guestContexts.set(fp,{ fingerprint: fp, version: 1, updated: Date.now(), notes: structuredClone(session.learning.notes) as Context['notes'], ...(session.adaptive ? { learning: session.savedLearning } : {}) });
      if (guestContexts.size > 128) guestContexts.delete(guestContexts.keys().next().value!);
    }
    const reward = progress.update(session.correct, session.streak);
    dog.look(reward.look, -8); dog.pose(reward.treat ? 'catch' : reward.pose);
    dog.tail(0, reward.pose === 'wag');
    if (reward.nod) dog.nod();
    if (reward.treat) { dog.catch(counts); treatUntil = performance.now() + 450; }
    if (!session.last!.correct) { encouragement.textContent = ''; encouragementUntil = 0; }
    else if (reward.text) { encouragement.textContent = reward.text; encouragementUntil = performance.now() + 2200; }
    if (session.continueAfter === 'instant') session.advance(session.token);
    if (session.state === 'finished') finish(); else render();
  };
  const start = () => {
    hideHelp();
    const preset = selected(); if (!preset) return;
    const rules = activity === 'challenge' ? rulesUI.read() : undefined;
    if (activity === 'challenge' && !rules) return;
    if (!presetsUI.saveConfiguration(pace === 'click')) return;
    profileId = store.profile()?.id;
    closePreview(); session?.finish(); session = undefined;
    const useAdaptive = useAdaptation;
    const context = store.profile()?.contexts.find(c => c.fingerprint === fingerprint(preset,useAdaptive,activity)) ?? (!profileId ? guestContexts.get(fingerprint(preset,useAdaptive,activity)) : undefined);
    const begin = (exposure: PreviewExposure) => {
      if (disposed) return;
      closePreview();
      resultRecorded = false;
      session = rules ? new Challenge(preset, rules, () => performance.now(), Math.random, { adaptive: useAdaptive, notes: context?.notes, learning: context?.learning }) : new Practice(preset, pace === 'click', () => performance.now(), Math.random, { continueAfter: pace, adaptive: useAdaptive, notes: context?.notes, learning: context?.learning });
      session.preview = exposure;
      progress = new NotesProgress(rules ? store.challengeBenchmark(preset,useAdaptive,rules) : store.benchmark(preset,useAdaptive)); resetInput(); treatUntil = 0;
      heading.textContent = `${rules ? `${store.profile()?.name ?? 'Player 1'} · ` : ''}${session.preset.name}`; encouragement.textContent = ''; dog.pose('rest'); dog.look(false); dog.tail(0, false);
      setup.hidden = true; result.hidden = true; play.hidden = false; render(); heading.focus();
    };
    if (showIntro && activity === 'practice') {
      setup.hidden = true; result.hidden = true; play.hidden = true; dog.node.hidden = true; node.classList.add('previewing'); resetInput();
      introduction = notePreview({ ...preset, pool: useAdaptive ? activePool(preset,context?.learning) : preset.pool },begin);
      stage.append(introduction.node); introduction.start();
    } else begin({ shown: false, skipped: false, completed: false });
  };
  const startButton = button('Start Practice', start); startButton.disabled = !selected();
  presetsUI.onChange(() => { startButton.disabled = !selected(); refreshPreferences(); });
  startButton.classList.add('control--primary'); setup.append(startButton);
  const controls = el('div', 'control-row'); controls.append(pause, continueButton, button('Finish', finish));
  const keyboardHelp = el('p', 'muted keyboard-help', 'Keyboard: A–G = natural · hold ↑ + letter = ♯ · hold ↓ + letter = ♭ · hold → + letter = ♮.');
  play.append(heading, roundRules, roundStatus, ready, counts, staff, feedback, expansion, answers.node, keyboardHelp, encouragement, controls);
  const resultControls = el('div', 'control-row'); resultControls.append(button('Retry', start), button('Edit setup', showSetup), button('Home', showSetup));
  result.append(resultHeading, resultSummary, resultChallenge, resultTiming, coaching, resultControls);
  stage.append(setup, play, result, storageNotice); node.append(stage, dog.node);
  const keydown = (event: KeyboardEvent) => {
    const fresh = gate.down(event.code || event.key, event.repeat);
    if (node.hidden || !session || play.hidden || event.timeStamp < inputSince || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]'))) return;
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
  const visibility = () => { if (document.hidden) { resetInput(); store.flush(); session?.pause(); if (session?.state === 'finished') finish(); else render(); } };
  window.addEventListener('blur', resetInput);
  document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup); document.addEventListener('visibilitychange', visibility);
  const timer = setInterval(() => {
    const storageMessage = store.durable ? '' : store.message;
    if (storageNotice.textContent !== storageMessage) storageNotice.textContent = storageMessage;
    if (encouragementUntil && performance.now() >= encouragementUntil) { encouragement.textContent = ''; encouragementUntil = 0; }
    if (session?.state === 'finished') finish();
    if (!session || session.state === 'finished' || session.state === 'paused') return;
    if (treatUntil && performance.now() >= treatUntil) { dog.pose('happy'); treatUntil = 0; }
    if (session.advance(session.token) || session instanceof Challenge) { if ((session as Practice).state === 'finished') finish(); else render(); }
  }, 25);
  const dispose = () => {
    if (disposed) return; disposed = true; closePreview(); answers.reset(); store.flush(); dataUI.dispose(); clearInterval(timer); stopWatching(); dog.dispose();
    document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', resetInput);
  };
  const stopWatching = onUnmount(node, dispose);
  return { node, options, dispose, setActivity: (next: 'practice' | 'challenge') => {
    if (next === activity) return;
    if (session && !resultRecorded) finish();
    activity = next; showSetup();
    node.setAttribute('aria-label', next === 'challenge' ? 'Note reading Challenge' : 'Note reading Practice');
    rulesUI.node.hidden = next !== 'challenge'; practicePacing.hidden = next === 'challenge'; previewToggle.hidden = next === 'challenge';
    startButton.textContent = next === 'challenge' ? 'Start Challenge' : 'Start Practice';
  }, leave: () => {
    hideHelp(); resetInput(); store.flush();
    if (introduction) showSetup();
    session?.pause(); if (session?.state === 'finished') finish(); else render();
  } };
}
