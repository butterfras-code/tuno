import { autoControls } from './auto-controls.ts';
import { defaultAuto, quarterBeats } from '../engine/auto-every.ts';
import { scheduleClick } from '../../../audio/click.ts';
import type { NoteAnswer } from '../domain/fingering.ts';
import { captureRange, resolveSharedPreset } from '../sharing.ts';
import type { NotesActivity } from '../sharing.ts';
import { resultReward } from './result-reward.ts';
import { resultMetric, scoreHint as resultScoreHint } from './results.ts';
import { activitySetup } from './activity-setup.ts';
import { challengeScene } from './challenge-scene.ts';
import { defaultTimed, Challenge } from '../engine/challenge.ts';
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
import type { NotesStore } from '../persistence/store.ts';
import { presetSetup, localData } from './setup.ts';
import { clefForPitch } from '../domain/presets.ts';
import { pitchLabel } from '../domain/notation.ts';
import type { Letter } from '../domain/notation.ts';
import { Practice, PressGate } from '../engine/practice.ts';
import type { ContinueAfter, PromptToken } from '../engine/practice.ts';
import { NotesProgress } from '../engine/progress.ts';
import { noteEntry, keyboardGuidanceKey } from './note-entry.ts';
import { renderStaff } from './staff.ts';
function button(text: string, action: () => void) {
  const node = el('button', 'control', text); node.type = 'button'; node.addEventListener('click', action); return node;
}
export function practiceView(store: NotesStore, shared = false) {
  let activity: 'practice' | 'challenge' = 'practice';
  const rulesUI = challengeSetup('Challenge Mode',true);
  const node = el('section', 'practice-view');
  node.dataset.activity = 'practice';
  node.dataset.screen = 'setup';
  node.setAttribute('aria-label', 'Note reading Practice');
  const dog = animatedUno(); dog.pose('rest');
  const stage = el('div', 'practice-stage');
  let storage: Storage | undefined; try { storage = window.localStorage; } catch { /* usable without storage */ }
  if (shared) store.beginSharedSession();
  const presetsUI = presetSetup(store); const picker = presetsUI.rangeTrigger;
  presetsUI.setupPresentation(true);
  presetsUI.rangeContext('Practice');
  const selected = presetsUI.selected;
  const options = el('section', 'notes-options'); options.hidden = true;
  options.append(el('h2', '', 'Options'));
  const savedPace = () => store.data.configuration.continueAfter === 'auto' ? 'auto' : store.data.configuration.continueAfter === 'correct' ? 'correct' : 'instant';
  let auto = store.data.configuration.auto ?? defaultAuto;
  let audio: AudioContext | undefined;
  const enableAudio = () => {
    if (!auto.sound || !window.AudioContext) return;
    audio ??= new AudioContext(); void audio.resume().catch(() => {});
  };
  let scheduledClick: ReturnType<typeof scheduleClick> | undefined;
  let scheduledAt = -Infinity;
  const stopClick = () => { scheduledClick?.stop(); scheduledClick = undefined; scheduledAt = -Infinity; };
  const saveAuto = () => {
    if (!shared) store.update(data => { data.configuration.auto = auto; data.configuration.continueAfter = pace; data.configuration.selfPaced = false; });
  };
  let pace: ContinueAfter = savedPace();
  const practiceMode = el('section','visual-content-section practice-mode-section mode-pill-selector');
  practiceMode.setAttribute('aria-label','Practice Mode');
  const modeChoices = el('div','practice-mode-choices'); modeChoices.setAttribute('role','group'); modeChoices.setAttribute('aria-label','Practice Mode');
  const modeButtons = (['instant','correct'] as const).map(value => {
    const label = value === 'instant' ? 'Normal' : 'Correct Only';
    const choice = button('',() => {
      pace = value; refreshPacing();
      store.update(data => { data.configuration.continueAfter = pace; data.configuration.selfPaced = false; });
    });
    choice.classList.add('range-content-button'); choice.setAttribute('aria-label',label);
    choice.append(el('span','',label));
    return {value,choice};
  });
  const automatic = autoControls(() => {
    pace = 'auto'; refreshPacing(); saveAuto();
  }, changes => {
    auto = {...auto,...changes}; refreshPacing(); saveAuto();
  });
  modeChoices.append(modeButtons[0]!.choice,automatic.node,modeButtons[1]!.choice);
  practiceMode.append(el('h3','','Practice Mode'),modeChoices,automatic.prefs);
  const refreshPacing = () => {
    automatic.update(pace === 'auto',auto);
    modeButtons.forEach(({value,choice}) => choice.setAttribute('aria-pressed',String(pace===value)));
  };
  refreshPacing();
  const guidanceKey = keyboardGuidanceKey;
  let keyboardGuidance = true;
  try { keyboardGuidance = storage?.getItem(guidanceKey) !== 'false'; } catch { /* Session-only preference. */ }
  const guidanceLabel = el('label', 'setting');
  const guidanceSetting = el('input'); guidanceSetting.type = 'checkbox'; guidanceSetting.checked = keyboardGuidance;
  guidanceLabel.append(guidanceSetting, document.createTextNode(' Keyboard accidental guidance'));
  const guidanceDescription = el('p', 'muted', 'Show a shortcut hint instead of scoring a matching letter entered without its required accidental. Saved on this device.');
  const guidanceGroup = el('section', 'keyboard-guidance-settings'); guidanceGroup.append(guidanceLabel, guidanceDescription); options.append(guidanceGroup);
  const setGuidance = (enabled: boolean) => {
    answerNotice.clear();
    keyboardGuidance = enabled; guidanceSetting.checked = enabled;
    try { if (!shared) storage?.setItem(guidanceKey, String(enabled)); } catch { /* Still works without storage. */ }
  };
  guidanceSetting.addEventListener('change', () => setGuidance(guidanceSetting.checked));
  let guestAdaptive = false;
  const guestContexts = new Map<string, Context>();
  let useAdaptation = false, showIntro = false;
  let linkedIntro: boolean | undefined;
  const setAdaptation = (enabled: boolean) => {
    useAdaptation = enabled;
    const p = store.profile();
    if (p && !shared) store.update(data => { data.profiles.find(v => v.id === p.id)!.adaptive = useAdaptation; }); else guestAdaptive = useAdaptation;
    refreshPreferences(); refreshSettingsSummary();
  };
  presetsUI.onAdaptiveChoice(setAdaptation);
  const refreshPreferences = () => {
    const p = store.profile(); useAdaptation = p && !shared ? p.adaptive ?? false : guestAdaptive;
    showIntro = linkedIntro ?? (selected() ? beginnerPreview(selected()!) : false);
  };
  const settings = el('section','practice-settings');
  const setupUI = activitySetup(presetsUI.node,settings,'activity',presetsUI.rangeTrigger);
  const setup = setupUI.node; setupUI.practiceLayout(true); setup.append(practiceMode,rulesUI.node);
  function refreshSettingsSummary() {
    const pacingLabel = { instant: 'Instant', delay: 'Delay', click: 'Click/Tap', correct: 'Until correct', auto: `Every ${quarterBeats(auto.value)} beats at ${auto.bpm} BPM` }[pace];
    const preset = selected();
    setupUI.summary([...(preset ? [`${pitchLabel(preset.pool[0]!)}–${pitchLabel(preset.pool.at(-1)!)}`] : []), ...(activity === 'challenge' ? [rulesUI.summary()] : [pacingLabel, showIntro ? 'Intro on' : 'Intro off']), ...(useAdaptation ? ['Adaptive'] : [])].join(' · '));
  }
  refreshPreferences(); refreshSettingsSummary();
  let shownPresetId = store.data.configuration.presetId;
  const dataUI = localData(store, () => {
    showSetup(); guestContexts.clear(); guestAdaptive = false; presetsUI.refresh();
    pace = savedPace(); auto = store.data.configuration.auto ?? defaultAuto; refreshPacing(); refreshPreferences();
  },() => { if (store.data.configuration.presetId !== shownPresetId) { shownPresetId = store.data.configuration.presetId; presetsUI.refresh(); } refreshPreferences(); });
  options.append(dataUI.node);
  rulesUI.onChange(refreshSettingsSummary);
  const play = el('section','practice-play'); play.hidden = true;
  const playHeader = el('div','practice-play-header');
  const heading = el('h2'); heading.tabIndex = -1;
  const beats = el('span','practice-beats');
  playHeader.append(heading,beats);
  const counts = el('p', 'counts'); counts.id = 'practice-counts';
  const stats = el('span');
  counts.append(stats);
  const staff = el('div', 'staff-panel');
  const answers = noteEntry((answer, token) => submit(answer, token), {
    fingering: true, onMethodChange: () => resetInput(),
    currentPitch: () => session?.inputPitch, timedPrompts: () => Boolean(session?.auto),
    guidance: () => { try { return storage ? storage.getItem(guidanceKey) !== 'false' : keyboardGuidance; } catch { return keyboardGuidance; } }, showKeySignature: () => store.data.configuration.showKeySignature,
    disableGuidance: () => setGuidance(false),
  });
  const answerNotice = answers.feedback;
  const feedback = answers.status; feedback.id = 'feedback';
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
  let disposed = false;
  const showModifier = () => answers.modifier(session && !play.hidden && session.state !== 'paused' && session.state !== 'finished' && arrows.size === 1
    ? arrows.has('ArrowUp') ? 1 : arrows.has('ArrowDown') ? -1 : 0 : undefined);
  const result = el('section','practice-results session-results'); result.hidden = true;
  const resultHeading = el('h2', '', 'Practice results'); resultHeading.tabIndex = -1;
  const resultSummary = el('div','practice-result-metrics'); resultSummary.id = 'result-summary';
  const resultScore = el('strong'); resultScore.id = 'practice-result-score';
  const scoreValue = el('p','scoreboard-value'); scoreValue.append(resultScore,el('span','','points'));
  const scoreHint = el('p','practice-result-score-hint',resultScoreHint());
  scoreHint.id = 'practice-score-hint'; resultScore.setAttribute('aria-describedby',scoreHint.id);
  const resultStats = el('div','practice-result-stats'); resultStats.append(scoreValue,scoreHint);
  const resultOverview = el('div','practice-result-overview');
  const resultTiming = el('p');
  const rewardSummary = resultReward();
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
  const accuracy = (s: Practice) => s.accuracy === null ? '—' : `${Math.round(s.accuracy * 100)}%`;
  const showSetup = () => {
    stopClick(); setupUI.select('notes');
    closePreview(); answerNotice.clear(); if (session) { session.finish(); store.endRound(session); } session = undefined; resetInput();
    presetsUI.companion.prepend(dog.node); play.insertBefore(staff,feedback); scene.node.hidden = true; node.classList.remove('challenge-active'); treatProgress.hidden = true; treatUntil = 0;
    node.dataset.screen = 'setup';
    setup.hidden = false; play.hidden = true; result.hidden = true; dog.pose('rest'); dog.look(false); dog.tail(0, false); if (!node.hidden) picker.focus();
  };
  const finish = () => {
    if (!session) return;
    if (resultRecorded) return;
    node.dataset.screen = 'results';
    answerNotice.clear();
    syncAuto(); stopClick(); resultRecorded = true; session.finish(); store.record(profileId, session); store.flush(); dataUI.refresh(); resetInput(); play.hidden = true; result.hidden = false;
    resultScore.textContent = (session.correct * (session.accuracy ?? 0)).toFixed(2);
    resultSummary.replaceChildren(
      resultMetric(String(session.correct),` correct / ${session.attempts} attempts`),
      resultMetric(accuracy(session),'Accuracy ',true),
      resultMetric(String(session.bestStreak),'Best streak ',true),
    );
    const average = session.attempts ? `${(session.responseTotalMs / session.attempts / 1000).toFixed(1)} s` : '—';
    const timing = session.auto ? `${session.beats} ${session.beats === 1 ? 'beat' : 'beats'} per note at ${session.auto.bpm} BPM` : `Average response ${average}`;
    resultTiming.textContent = `${(session.activeMs / 1000).toFixed(1)} s active practice · ${timing}. ${session.interrupted ? 'Pauses excluded. ' : ''}${session.attempts ? 'Every note is a step forward. Thanks for practicing!' : 'Ready whenever you are. Try a note next time.'}`;
    resultHeading.textContent = 'Practice results';
    rewardSummary.update(progress.treats,session.attempts ? 'treat' : 'rest');
    if (session instanceof Challenge) {
      play.hidden = false; result.hidden = true;
      scene.finish(session,progress.treats,profileId ? store.data.profiles.find(p => p.id === profileId)?.name : undefined);
      answers.node.hidden = true; keyboardHelp.hidden = true; feedback.hidden = true; controls.hidden = true;
    }
    coaching.textContent = session.attempts ? recommendation(session.attempts,session.correct,session.learning.notes,session.misses) : 'Ready when you are. Try a note next time.';
    if (performance.now() >= treatUntil) dog.pose(progress.treats ? 'happy' : 'rest'); dog.look(false); dog.tail(0, false);
    if (!(session instanceof Challenge)) resultHeading.focus();
  };
  const pause = button('Pause', () => {
    if (!session) return;
    resetInput();
    if (session.state === 'paused') { if (session.auto) enableAudio(); session.resume(); inputSince = performance.now(); } else { syncAuto(); stopClick(); session.pause(); }
    if (session.state === 'finished') finish(); else render();
  });
  const continueButton = button('Continue', () => { if (session?.advance(session.token, true)) { render(); answers.focus(); } });
  const updateBeat = (s: Practice) => {
    beats.hidden = !s.auto;
    if (s.auto) {
      beats.dataset.countingIn = String(s.countingIn);
      beats.replaceChildren(el('span','practice-beats-label',s.countingIn ? 'Count in' : 'Beat'));
      for (let i = 0; i < s.beats; i++) {
        const mark = el('b','',String(i+1)); mark.setAttribute('aria-current',String(i === s.beat));
        beats.append(mark);
      }
    }
  };
  const promptIdentity = (s: Practice) => [s.session,s.prompt,store.data.configuration.showKeySignature ?? false,s.countingIn].join(':');
  const render = () => {
    if (!session || session.state === 'finished') return;
    const paused = session.state === 'paused';
    const waiting = session instanceof Challenge && session.phase !== 'playing';
    const isChallenge = session instanceof Challenge;
    scene.node.hidden = !isChallenge;
    playHeader.hidden = isChallenge;
    counts.hidden = isChallenge; heading.hidden = isChallenge;
    answers.node.hidden = waiting || isChallenge && paused; keyboardHelp.hidden = answers.node.hidden;
    feedback.hidden = isChallenge && (waiting || paused);
    controls.hidden = false; pause.hidden = isChallenge && paused;
    if (session instanceof Challenge) {
      scene.update(session,progress.remaining,store.data.configuration.showKeySignature);
      const state = `${session.session}:${paused ? 'paused' : session.phase}`;
      if (presentedState !== state) {
        presentedState = state;
        if (!paused && !waiting) { inputSince = performance.now(); resetInput(); }
        dog.pose(paused ? 'rest' : waiting ? 'wag' : progress.pose);
        dog.look(false); dog.tail(0,!paused && waiting);
      }
    }
    pause.textContent = paused ? 'Resume' : 'Pause';
    soundButton.hidden = !session.auto;
    soundButton.setAttribute('aria-label',auto.sound ? 'Metronome on' : 'Metronome off');
    soundButton.setAttribute('aria-pressed',String(auto.sound));
    updateBeat(session);
    stats.textContent = `${session.correct} correct / ${session.attempts} attempts · Accuracy ${accuracy(session)} · Streak ${session.streak} (best ${session.bestStreak})`;
    const identity = promptIdentity(session);
    if (renderedPrompt !== identity) {
      inputSince = performance.now() - (session.auto ? session.activeMs - session.inputStartMs : 0);
      renderedPrompt = identity;
      const clef = clefForPitch(session.preset, session.pitch);
      const upcoming = session.upcomingEvent && !session.countingIn ? session.upcomingEvent : undefined;
      const upcomingClef = upcoming ? clefForPitch(session.preset, upcoming.pitch) : undefined;
      const sameClefUpcoming = upcoming && upcomingClef === clef ? { pitch: upcoming.pitch, clef: upcomingClef, value: upcoming.written } : undefined;
      staff.replaceChildren(renderStaff(session.pitch, clef, session.preset.key, session.preset.keyless, store.data.configuration.showKeySignature, session.currentEvent?.written, sameClefUpcoming));
      if (upcoming && upcomingClef && upcomingClef !== clef) {
        const preview = renderStaff(upcoming.pitch, upcomingClef, session.preset.key, session.preset.keyless, store.data.configuration.showKeySignature, upcoming.written);
        preview.classList.add('upcoming-note'); preview.setAttribute('aria-label','Next note, ' + preview.getAttribute('aria-label'));
        staff.append(preview);
      }
    }
    const countingInLocked = Boolean(session.auto && session.countingIn && !session.inputOpen);
    staff.classList.toggle('staff-counting-in', countingInLocked);
    answers.hint(countingInLocked ? 'Count in — get ready…' : undefined);
    answerNotice.mount(staff.querySelector('svg')!);
    if (paused || waiting) answerNotice.clear();
    staff.hidden = !isChallenge && paused;
    const locked = !session.inputOpen || waiting;
    answers.update(session.activePreset, session.inputToken, locked, session.earlyNext);
    showModifier();
    continueButton.hidden = !(session.selfPaced && session.state === 'feedback');
    answers.paused(paused);
    if (paused) { dog.look(false); dog.tail(0, false); }
  };
  const persistOutcome = () => {
    if (!session) return;
    store.observe(profileId, session.preset, session.last!, session.adaptive, session.savedLearning, session);
    if (!profileId) {
      const fp = fingerprint(session.preset,session.adaptive,session.activity);
      guestContexts.delete(fp);
      guestContexts.set(fp,{ fingerprint: fp, version: 1, updated: Date.now(), notes: structuredClone(session.learning.notes) as Context['notes'], ...(session.adaptive ? { learning: session.savedLearning } : {}) });
      if (guestContexts.size > 128) guestContexts.delete(guestContexts.keys().next().value!);
    }
  };
  const syncAuto = () => session?.advanceAuto(() => {
    persistOutcome();
    if (session) progress.update(session.correct,session.streak,session.attempts);
  }, previousAnnouncement => { render(); showAnswer(previousAnnouncement); });
  const showAnswer = (previousAnnouncement?: string) => {
    if (!session) return;
    persistOutcome();
    const reward = progress.update(session.correct, session.streak, session.attempts);
    dog.look(reward.look, -8);
    if (reward.treat || performance.now() >= treatUntil) dog.pose(reward.treat ? 'catch' : reward.pose);
    dog.tail(0, reward.pose === 'wag');
    if (reward.nod) dog.nod();
    treatProgress.textContent = `${progress.remaining} to a treat`;
    if (reward.treat) { dog.catch(session instanceof Challenge ? scene.treat : counts); treatUntil = performance.now() + 450; }
    answers.respond(session, reward, previousAnnouncement);
    if (session.state === 'finished') finish(); else render();
  };
  const submit = (answer: NoteAnswer, token: PromptToken) => {
    const previousAnnouncement = session?.announcement;
    syncAuto();
    if (session?.queueAutoAnswer(token,answer)) return;
    if (!session?.answer(token, answer)) { if (session?.state === 'finished') finish(); return; }
    if (session.auto && session.state === 'running') { answerNotice.show('Try again',false); return; }
    showAnswer(previousAnnouncement);
  };
  const start = async () => {
    if (startButton.disabled) return;
    if (activity === 'practice' && pace === 'auto') {
      if (!automatic.bpm.reportValidity()) { automatic.bpm.focus(); return; }
      enableAudio();
    }
    startButton.disabled = true;
    await store.refresh();
    startButton.disabled = false;
    if (disposed) return;
    const preset = selected(); if (!preset) return;
    const rules = activity === 'challenge' ? rulesUI.read() : undefined;
    if (activity === 'challenge' && !rules) return;
    if (!presetsUI.saveConfiguration(pace === 'click')) return;
    profileId = store.profile()?.id;
    closePreview(); answerNotice.clear(); if (session) { session.finish(); store.endRound(session); } session = undefined;
    const useAdaptive = useAdaptation;
    const context = store.profile()?.contexts.find(c => c.fingerprint === fingerprint(preset,useAdaptive,activity)) ?? (!profileId ? guestContexts.get(fingerprint(preset,useAdaptive,activity)) : undefined);
    const begin = (exposure: PreviewExposure) => {
      if (disposed) return;
      closePreview();
      resultRecorded = false;
      session = rules ? new Challenge(preset, rules, () => performance.now(), Math.random, { inputFingering: () => answers.inputFingering, adaptive: useAdaptive, notes: context?.notes, learning: context?.learning }) : new Practice(preset, pace === 'click', () => performance.now(), Math.random, { inputFingering: () => answers.inputFingering, continueAfter: pace, auto, adaptive: useAdaptive, notes: context?.notes, learning: context?.learning });
      store.beginRound(session, profileId);
      session.preview = exposure;
      progress = new NotesProgress(rules ? store.challengeBenchmark(preset,useAdaptive,rules) : store.benchmark(preset,useAdaptive)); resetInput(); treatUntil = 0;
      node.classList.toggle('challenge-active', Boolean(rules));
      if (rules) { scene.notation.append(staff); scene.dogSlot.prepend(dog.node); }
      else { play.insertBefore(staff,feedback); dogHome.prepend(dog.node); }
      treatProgress.hidden = Boolean(rules); treatProgress.textContent = `${progress.remaining} to a treat`;
      heading.textContent = `${rules ? `${store.profile()?.name ?? 'Player 1'} · ` : ''}${session.preset.name}`; dog.pose('rest'); dog.look(false); dog.tail(0, false);
      node.dataset.screen = 'playing';
      setup.hidden = true; result.hidden = true; play.hidden = false; render(); if (rules) scene.focus(); else heading.focus();
    };
    if (showIntro && activity === 'practice') {
      node.dataset.screen = 'intro';
      setup.hidden = true; result.hidden = true; play.hidden = true; dog.node.hidden = true; node.classList.add('previewing'); resetInput();
      introduction = notePreview({ ...preset, pool: useAdaptive ? activePool(preset,context?.learning) : preset.pool },begin,store.data.configuration.showKeySignature,showSetup);
      stage.append(introduction.node); introduction.start();
    } else begin({ shown: false, skipped: false, completed: false });
  };
  const startButton = button('Start Practice', start); startButton.disabled = !selected();
  presetsUI.onChange(() => { startButton.disabled = !selected(); refreshPreferences(); refreshSettingsSummary(); });
  startButton.classList.add('control--primary'); setupUI.action(startButton);
  const soundButton = button('', () => {
    auto = {...auto,sound:!auto.sound}; saveAuto(); refreshPacing();
    if (auto.sound) enableAudio(); else stopClick();
    render();
  });
  soundButton.classList.add('practice-sound-toggle');
  const soundDot = el('span','practice-sound-dot'); soundDot.setAttribute('aria-hidden','true');
  soundButton.append(soundDot,el('span','','Metronome'));
  const controls = el('div', 'control-row'); controls.append(pause, soundButton, continueButton, button('Finish', finish));
  const keyboardHelp = el('details', 'practice-help');
  keyboardHelp.append(el('summary','','How to answer'),el('p', 'muted keyboard-help', 'Strings: F/D/S/A = fingers 1–4 (index to little finger). Fingering: hold J/K/L (horn: E/W/Q) for valves 1/2/3, Space = Open, V = horn trigger. Note names: A–G = natural · hold ↑ + letter = ♯ · hold ↓ + letter = ♭ · hold → + letter = ♮.'));
  controls.append(keyboardHelp);
  play.append(playHeader, counts, scene.node, staff, feedback, answers.node, controls);
  const resultControls = el('div', 'control-row result-controls');
  const retry = button('Retry',start); retry.classList.add('control--primary');
  resultControls.append(retry, button('Edit setup', showSetup));
  const resultDetails = el('details','practice-result-details');
  resultDetails.append(el('summary','','Session details'),resultTiming);
  resultOverview.append(resultStats,rewardSummary.node);
  result.append(resultHeading, resultOverview, resultSummary, coaching, resultControls, resultDetails);
  stage.append(setup, play, result); node.append(stage, dogHome);
  presetsUI.companion.append(dog.node);
  const keydown = (event: KeyboardEvent) => {
    const fresh = gate.down(event.code || event.key, event.repeat);
    if (node.hidden || !session || session.state === 'finished' || play.hidden || event.timeStamp < inputSince || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]'))) return;
    if (answers.isMusicalKeyboard) return;
    if (answers.isFingering) { if (session.state !== 'paused') answers.heldKeydown(event); return; }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); if (fresh) arrows.add(event.key); showModifier(); return; }
    const letter = event.key.toUpperCase();
    if (/^[A-G]$/.test(letter)) {
      event.preventDefault();
      if (!fresh || arrows.size >= 2) return;
      if (session.inputOpen && (!(session instanceof Challenge) || session.phase === 'playing')) {
        answers.keyboard(letter as Letter, arrows.has('ArrowUp') ? 1 : arrows.has('ArrowDown') ? -1 : 0, arrows.size > 0, session);
      }
    } else answers.focusedKey(event, fresh);
  };
  const keyup = (event: KeyboardEvent) => { answers.heldKeyup(event); gate.up(event.code || event.key); arrows.delete(event.key); showModifier(); };
  // Key releases outside the page may never reach document; repeats remain gated.
  const resetInput = () => { gate.reset(); arrows.clear(); answers.reset(); answers.modifier(); };
  const visibility = () => { if (document.hidden) { resetInput(); store.flush(); syncAuto(); stopClick(); session?.pause(); if (session?.state === 'finished') finish(); else render(); } };
  window.addEventListener('blur', resetInput);
  document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup); document.addEventListener('visibilitychange', visibility);
  let displayedBeat = '', inputWindow = '';
  const tickAuto = (s: Practice) => {
    syncAuto();
    const index = s.beatIndex;
    const window = [s.inputToken.session,s.inputToken.prompt,s.inputOpen].join('/');
    const key = [s.session,s.prompt,index].join('/');
    if (window !== inputWindow || renderedPrompt !== promptIdentity(s)) render();
    else if (key !== displayedBeat) updateBeat(s);
    inputWindow = window;
    displayedBeat = key;
    if (!auto.sound || audio?.state !== 'running') return;
    const start = s.deadline - s.beats * s.pulseMs;
    const now = s.activeMs;
    // Schedule the next pulse ahead on the audio clock. On start play the current pulse once.
    const next = start + (index + 1) * s.pulseMs;
    const target = next - now <= 100 ? next : start + index * s.pulseMs;
    if (target <= scheduledAt + 0.1 || now - target > 100) return;
    const beat = next === target ? (s.beat+1) % s.beats : s.beat;
    scheduledAt = target;
    scheduledClick = scheduleClick(audio,{time:audio.currentTime + Math.max(0,target-now)/1000,beat,part:0,downbeat:beat===0},{accent:true,clickVolume:45,clickSound:'wood'});
  };
  const timer = setInterval(() => {
    if (treatUntil && performance.now() >= treatUntil) { dog.pose(session?.state === 'finished' && progress.treats ? 'happy' : progress.pose); treatUntil = 0; }
    if (session?.state === 'finished') finish();
    if (!session || session.state === 'finished' || session.state === 'paused') return;
    if (session.auto) { tickAuto(session); return; }
    if (session.advance(session.token) || session instanceof Challenge) { if ((session as Practice).state === 'finished') finish(); else render(); }
  }, 25);
  const dispose = () => {
    if (disposed) return; disposed = true; stopClick(); if (audio) void audio.close(); answerNotice.clear(); closePreview(); answers.dispose(); store.flush(); dataUI.dispose(); clearInterval(timer); stopWatching(); dog.dispose();
    document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', resetInput);
  };
  const stopWatching = onUnmount(node, dispose);
  return { node, options, store, dispose,
    captureActivity: (): NotesActivity => {
      const preset = setup.hidden && session ? session.preset : selected();
      if (!preset) throw new Error('Apply a valid note range before sharing.');
      const rules = activity === 'practice' ? defaultTimed : setup.hidden && session instanceof Challenge ? session.rules : rulesUI.read();
      if (!rules) throw new Error('Fix the challenge rules before sharing.');
      const selectedPace = setup.hidden && session ? session.continueAfter : pace;
      const automatic = activity === 'practice' && selectedPace === 'auto';
      return {mode:activity,ranges:[captureRange(preset,session && setup.hidden ? session.adaptive : useAdaptation,store.data.configuration.showKeySignature ?? false)],...(automatic ? {auto} : {}),pace:automatic ? 'auto' : selectedPace === 'correct' ? 'correct' : 'instant',intro:showIntro,rules,format:'turns'};
    },
    loadActivity: (value: NotesActivity) => {
      const range = value.ranges[0]!;
      const source = {...range.source,id: range.source.id === 'custom-shared' ? 'custom-shared-solo' : range.source.id};
      if (source.id.startsWith('custom-shared')) store.transientPreset(source.id);
      presetsUI.loadRange(resolveSharedPreset(source));
      store.data.configuration.showKeySignature = range.showKeySignature;
      guestAdaptive = range.adaptive; linkedIntro = value.intro; pace = value.pace; auto = value.auto ?? auto;
      rulesUI.load(value.rules); refreshPreferences(); refreshPacing(); refreshSettingsSummary();
    }, enter: () => { presetsUI.refreshNotation(); dataUI.refresh(); refreshPreferences(); refreshSettingsSummary(); }, setActivity: (next: 'practice' | 'challenge') => {
    if (next === activity) return;
    if (session && !resultRecorded) finish();
    activity = next; node.dataset.activity = next; presetsUI.rangeContext(next === 'challenge' ? 'Challenge' : 'Practice'); showSetup();
    node.setAttribute('aria-label', next === 'challenge' ? 'Note reading Challenge' : 'Note reading Practice');
    rulesUI.node.hidden = next !== 'challenge'; practiceMode.hidden = next === 'challenge';
    startButton.textContent = next === 'challenge' ? 'Start Challenge' : 'Start Practice';
    refreshSettingsSummary();
  }, leave: () => {
    resetInput(); store.flush();
    if (introduction) showSetup();
    syncAuto(); stopClick(); session?.pause(); if (session?.state === 'finished') finish(); else render();
  } };
}
