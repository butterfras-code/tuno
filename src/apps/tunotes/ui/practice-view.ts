import { challengeScene } from './challenge-scene.ts';
import { Challenge } from '../engine/challenge.ts';
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
  let shownPresetId = store.data.configuration.presetId;
  const dataUI = localData(store, () => {
    showSetup(); guestContexts.clear(); guestAdaptive = false; guestPreview = undefined; presetsUI.refresh();
    pace = store.data.configuration.continueAfter ?? (store.data.configuration.selfPaced ? 'click' : 'delay'); refreshPacing(); refreshPreferences();
  },() => { if (store.data.configuration.presetId !== shownPresetId) { shownPresetId = store.data.configuration.presetId; presetsUI.refresh(); } refreshPreferences(); });
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
  let resultRecorded = false;
  const scene = challengeScene({
    ready: () => { if (session instanceof Challenge) { session.ready(); resetInput(); render(); scene.focus(); } },
    resume: () => { session?.resume(); resetInput(); inputSince = performance.now(); render(); },
    retry: () => start(), edit: () => showSetup(),
  });
  let presentedState = '';
  const treatProgress = el('p','treat-progress'); treatProgress.hidden = true;
  const dogHome = el('div','practice-companion'); dogHome.append(dog.node,treatProgress);
  const coaching = el('p'); coaching.id = 'recommendation';
  const expansion = el('p'); expansion.id = 'expansion-announcement'; expansion.setAttribute('role','status');
  const accuracy = (s: Practice) => s.accuracy === null ? '—' : `${Math.round(s.accuracy * 100)}%`;
  const showSetup = () => {
    closePreview(); session?.finish(); session = undefined; resetInput();
    dogHome.prepend(dog.node); play.insertBefore(staff,feedback); scene.node.hidden = true; node.classList.remove('challenge-active'); treatProgress.hidden = true; treatUntil = 0;
    setup.hidden = false; play.hidden = true; result.hidden = true; dog.pose('rest'); dog.look(false); dog.tail(0, false); if (!node.hidden) picker.focus();
  };
  const finish = () => {
    if (!session) return;
    if (resultRecorded) return;
    resultRecorded = true; session.finish(); store.record(profileId, session); store.flush(); dataUI.refresh(); resetInput(); play.hidden = true; result.hidden = false;
    resultSummary.textContent = `${session.correct} correct / ${session.attempts} attempts · Accuracy ${accuracy(session)} · Best streak ${session.bestStreak}`;
    const average = session.attempts ? `${(session.responseTotalMs / session.attempts / 1000).toFixed(1)} s` : '—';
    resultTiming.textContent = `${(session.activeMs / 1000).toFixed(1)} s active practice · Average response ${average}. ${session.interrupted ? 'Pauses excluded. ' : ''}${session.attempts ? 'Every note is a step forward. Thanks for practicing!' : 'Ready whenever you are. Try a note next time.'}`;
    resultHeading.textContent = 'Practice results';
    if (session instanceof Challenge) {
      play.hidden = false; result.hidden = true;
      scene.finish(session,profileId ? store.data.profiles.find(p => p.id === profileId)?.name : undefined);
      answers.node.hidden = true; keyboardHelp.hidden = true; feedback.hidden = true; expansion.hidden = true; controls.hidden = true;
    }
    coaching.textContent = recommendation(session.attempts,session.correct,session.learning.notes,session.misses);
    if (performance.now() >= treatUntil) dog.pose(progress.treats ? 'happy' : 'rest'); dog.look(false); dog.tail(0, false);
    if (!(session instanceof Challenge)) resultHeading.focus();
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
    const isChallenge = session instanceof Challenge;
    scene.node.hidden = !isChallenge;
    counts.hidden = isChallenge; heading.hidden = isChallenge;
    answers.node.hidden = waiting || isChallenge && paused; keyboardHelp.hidden = answers.node.hidden;
    feedback.hidden = isChallenge && (waiting || paused); expansion.hidden = isChallenge && (waiting || paused);
    controls.hidden = false; pause.hidden = isChallenge && paused;
    if (session instanceof Challenge) {
      scene.update(session,progress.remaining);
      const state = `${session.session}:${paused ? 'paused' : session.phase}`;
      if (presentedState !== state) {
        presentedState = state;
        if (!paused && !waiting) { inputSince = performance.now(); resetInput(); }
        dog.pose(paused ? 'rest' : waiting ? 'wag' : progress.pose);
        dog.look(false); dog.tail(0,!paused && waiting);
      }
    }
    pause.textContent = paused ? 'Resume' : 'Pause';
    counts.textContent = `${session.correct} correct / ${session.attempts} attempts · Accuracy ${accuracy(session)} · Streak ${session.streak} (best ${session.bestStreak})`;
    const identity = `${session.session}:${session.prompt}`;
    if (renderedPrompt !== identity) {
      inputSince = performance.now(); renderedPrompt = identity; staff.replaceChildren(renderStaff(session.pitch, clefForPitch(session.preset, session.pitch), session.preset.key));
    }
    staff.hidden = !isChallenge && paused;
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
    const reward = progress.update(session.correct, session.streak, session.attempts);
    dog.look(reward.look, -8);
    if (reward.treat || performance.now() >= treatUntil) dog.pose(reward.treat ? 'catch' : reward.pose);
    dog.tail(0, reward.pose === 'wag');
    if (reward.nod) dog.nod();
    treatProgress.textContent = `${progress.remaining} more for a treat`;
    if (reward.treat) { dog.catch(session instanceof Challenge ? scene.treat : counts); treatUntil = performance.now() + 450; }
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
      node.classList.toggle('challenge-active', Boolean(rules));
      if (rules) { scene.notation.append(staff); scene.dogSlot.prepend(dog.node); }
      else { play.insertBefore(staff,feedback); dogHome.prepend(dog.node); }
      treatProgress.hidden = Boolean(rules); treatProgress.textContent = `${progress.remaining} more for a treat`;
      heading.textContent = `${rules ? `${store.profile()?.name ?? 'Player 1'} · ` : ''}${session.preset.name}`; encouragement.textContent = ''; dog.pose('rest'); dog.look(false); dog.tail(0, false);
      setup.hidden = true; result.hidden = true; play.hidden = false; render(); if (rules) scene.focus(); else heading.focus();
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
  play.append(heading, counts, scene.node, staff, feedback, expansion, answers.node, keyboardHelp, encouragement, controls);
  const resultControls = el('div', 'control-row'); resultControls.append(button('Retry', start), button('Edit setup', showSetup), button('Home', showSetup));
  result.append(resultHeading, resultSummary, resultTiming, coaching, resultControls);
  stage.append(setup, play, result, storageNotice); node.append(stage, dogHome);
  const keydown = (event: KeyboardEvent) => {
    const fresh = gate.down(event.code || event.key, event.repeat);
    if (node.hidden || !session || session.state === 'finished' || play.hidden || event.timeStamp < inputSince || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]'))) return;
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
    if (treatUntil && performance.now() >= treatUntil) { dog.pose(session?.state === 'finished' && progress.treats ? 'happy' : progress.pose); treatUntil = 0; }
    if (session?.state === 'finished') finish();
    if (!session || session.state === 'finished' || session.state === 'paused') return;
    if (session.advance(session.token) || session instanceof Challenge) { if ((session as Practice).state === 'finished') finish(); else render(); }
  }, 25);
  const dispose = () => {
    if (disposed) return; disposed = true; closePreview(); answers.reset(); store.flush(); dataUI.dispose(); clearInterval(timer); stopWatching(); dog.dispose();
    document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', resetInput);
  };
  const stopWatching = onUnmount(node, dispose);
  return { node, options, store, dispose, enter: () => { dataUI.refresh(); refreshPreferences(); }, setActivity: (next: 'practice' | 'challenge') => {
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
