import { createAppFooter } from '../../shared/ui/app-footer.ts';
import { prepareOffline } from '../../distribution/offline.ts';
import { createAppHeader } from '../../shared/ui/app-header.ts';
import { createAreaNavigation } from '../../shared/ui/area-navigation.ts';
import { countingProblems, countingScore } from './counting-feedback.ts';
import type { CountId } from '../../music/counting/plan.ts';
import type { RhythmScore } from '../../music/score.ts';
// Copyright (C) 2026 tUno contributors. SPDX-License-Identifier: GPL-3.0-only
import '../../tokens.css';
import '../../shared/ui/fonts.css';
import '../count-writing/styles.css';
import './styles.css';
import './workspace.css';
import { button, el, field, select } from '../../shared/ui/components.ts';
import { Activity, presets as practiceFixtures, preferenceKey, fixtureAccess } from './activity.ts';
import { createPerformance } from './performance.ts';
import type { AttemptRecord } from './capture.ts';
import { timingTimelines, renderTimingTimeline } from './timeline.ts';
import { evaluateAttempt } from './evaluation.ts';
import { createPlanEditor } from '../count-writing/plan-editor.ts';
import { evaluateAnswer as evaluateCountingAnswer, initializeAnswer } from '../../music/counting/answer.ts';
import { createPreferenceSession } from './counting-session.ts';
import { createSettingsPage } from './shared/settings.ts';
import { defaultGeneration, generateExercise, generationIssue } from './shared/generation.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { renderPassageTies } from './shared/notation.ts';
import { teachingPresetLabel } from './shared/teaching-presets.ts';
import { createWritingWorkspace } from './writing-workspace.ts';
import { keepCountingDockClear } from './counting-dock.ts';

let saved: string | null = null;
try { saved = localStorage.getItem(preferenceKey); } catch { /* Memory fallback. */ }
const preferenceSession = createPreferenceSession(saved, location.search);
const preferences = preferenceSession.preferences;
let migratedCounting = false;
try { migratedCounting = Boolean(saved && !JSON.parse(saved)?.counting); } catch { /* malformed preferences use defaults */ }
const testing = fixtureAccess(location.search);
if (testing.fixture) preferences.preset = testing.fixture.id;
let generation = preferences.generation;
let fixtureId = preferences.preset;
const activity = new Activity(preferences, fixtureId === 'generated' ? generateExercise(generationIssue(generation) ? defaultGeneration() : generation) : practiceFixtures.find(f => f.id === fixtureId)!.score);
function persist() {
  Object.assign(preferences, { generation, preset: fixtureId });
  try { localStorage.setItem(preferenceKey, preferenceSession.serialize()); } catch { /* Memory fallback. */ }
}
let editors: ReturnType<typeof createPlanEditor>[] = [];
let tieNotation: ReturnType<typeof renderPassageTies> | null = null;
let currentMeasures: readonly RhythmMeasure[] = [];
const app = document.querySelector<HTMLElement>('#app')!;
const main = el('main', 'rhythm-app'); main.id = 'editor';
const header = createAppHeader('Uno234', 'Practice rhythm with a friend.');
header.append(createAreaNavigation('rhythm'));
const offlineStatus = el('p', 'small'); offlineStatus.id = 'offline-status';
prepareOffline(offlineStatus, { id: 'rhythm', name: 'Uno234' }, { worker: '/rhythm/sw.js', scope: '/rhythm/' });
const pageTitle = el('h2', 'view-title', 'Practice'); pageTitle.id = 'page-title'; pageTitle.tabIndex = -1;
const practiceView = el('section'); practiceView.id = 'practice-view';
practiceView.dataset.phase = 'setup';
const banner = el('p', 'counting-hint');
banner.append(el('span', '', 'Click a box to add counting symbols or use your keyboard.'));
const lineShortcut = el('span', 'counting-shortcut');
lineShortcut.append(el('kbd', '', 'C'), ' — connect counts');
const restShortcut = el('span', 'counting-shortcut'); restShortcut.append(el('kbd', '', 'R'), ' — toggle rest');
banner.append(lineShortcut, restShortcut);
const exerciseSummary = el('p', 'exercise-summary'); exerciseSummary.setAttribute('role', 'status');
const picker = select([{ value: '', label: 'Choose a testing fixture…' }, ...practiceFixtures.map(f => ({ value: f.id, label: f.label }))], chooseFixture);
picker.value = fixtureId; picker.dataset.preset = '';
const customDialog = el('dialog', 'custom-exercise-dialog'); customDialog.id = 'custom-exercise';
customDialog.setAttribute('aria-labelledby', 'custom-exercise-title');
const customTitle = el('h2', '', 'Customize next exercise'); customTitle.id = 'custom-exercise-title';
const customButton = button('Customize…', () => { editors.forEach(editor => editor.suspend()); customDialog.showModal(); });
customButton.setAttribute('aria-haspopup', 'dialog'); customButton.setAttribute('aria-controls', customDialog.id);
const customClose = button('Done', () => customDialog.close());
customDialog.addEventListener('close', () => editors.forEach(editor => editor.resume()));
const customHeader = el('div', 'custom-exercise-header'); customHeader.append(customTitle, customClose);
customDialog.append(customHeader);
customButton.classList.add('level-customize');
customButton.setAttribute('aria-label', 'Customize next exercise');
customButton.title = 'Customize next exercise';
const customLabel = el('span', 'customize-label', 'Customize…');
const customIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
customIcon.setAttribute('viewBox', '0 0 24 24'); customIcon.setAttribute('aria-hidden', 'true');
customIcon.classList.add('customize-icon');
const pencil = document.createElementNS('http://www.w3.org/2000/svg', 'path');
pencil.setAttribute('d', 'M15 5l4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15z');
pencil.setAttribute('fill', 'none'); pencil.setAttribute('stroke', 'currentColor');
pencil.setAttribute('stroke-width', '1.8'); pencil.setAttribute('stroke-linejoin', 'round');
customIcon.append(pencil); customButton.replaceChildren(customLabel, customIcon);
const feedbackSnapshot = el('section', 'feedback-snapshot'); feedbackSnapshot.setAttribute('aria-labelledby', 'feedback-snapshot-title');

const activitySurface = el('section', 'card activity-surface'); activitySurface.setAttribute('aria-label', 'Uno234 activity');
const passage = el('section', 'passage'); passage.setAttribute('aria-label', 'Exercise passage');
const passageScroll = el('div', 'score-scroll passage-scroll');
const passageStrip = el('div', 'passage-strip');
passageScroll.append(passageStrip);
passage.append(passageScroll);
const workspace = createWritingWorkspace(passage, passageScroll, passageStrip, () => currentMeasures);
const help = el('div', 'practice-help-popover'); help.id = 'practice-help'; help.popover = 'auto';
help.setAttribute('role', 'dialog'); help.setAttribute('aria-label', 'Practice help');
const helpButton = button('Help', () => {
  const bounds = helpButton.getBoundingClientRect();
  help.style.left = `${Math.max(8, Math.min(bounds.right - 340, innerWidth - 348))}px`;
  const top = Math.min(bounds.bottom + 8, Math.max(8, innerHeight - 360));
  help.style.top = `${top}px`; help.style.maxHeight = `${innerHeight - top - 8}px`;
});
helpButton.classList.add('practice-help-trigger'); helpButton.setAttribute('aria-label', 'Practice help');
helpButton.popoverTargetElement = help; helpButton.setAttribute('aria-controls', help.id);
helpButton.setAttribute('aria-expanded', 'false');
help.addEventListener('toggle', () => helpButton.setAttribute('aria-expanded', String(help.matches(':popover-open'))));
help.append(el('h2', '', 'Practice help'),
  el('p', '', 'Choose Counts to write counts or Perform to tap the same score. Switching panels keeps both responses. New exercise starts a new score and clears both responses.'),
  el('p', '', 'In Counts or Perform, scroll the rhythm or use its overview when it does not fit. Counts restart at each barline. Groups follow written notes, rests and ties. Mark each group with Rest or Connect when appropriate.'),
  el('p', '', 'Select any count in a group. Rest (R) and Connect (C) toggle the entire group. Arrows move between counts; Enter checks. Type t then a/e for ta/te, l for la and i for li.'),
  el('p', '', 'In 6/8, labels use numbers 1–6. Inputs follow the captured subdivision settings. Performance follows two dotted-quarter pulses.'),
  el('p', '', 'Linked counting preferences stay in this session until saved as defaults in Settings. Other preferences are saved in this browser. Exercise settings apply on New exercise. Reloading starts with blank responses.'));
const summary = el('p', 'practice-status'); summary.setAttribute('role', 'status');
const actions = el('div', 'actions write-actions');
const writeResponse = el('section', 'write-response'); writeResponse.setAttribute('aria-label', 'Write Counts');
const showCounts = el('input'); showCounts.type = 'checkbox'; showCounts.checked = preferences.showCounts;
showCounts.addEventListener('change', () => { preferences.showCounts = showCounts.checked; persist(); updateResponseView(); });
const showCountsField = field('Show written counts during performance', showCounts);
let performing = false;
let responsePanel: 'counts' | 'perform' = preferences.mode === 'tap' ? 'perform' : 'counts';
let responseOptionsOpen = false;
const mobileInput = window.matchMedia('(max-width: 760px)');
// Legacy Both preferences open Counts; the selected panel now owns the response context.
activity.setMode(responsePanel === 'perform' ? 'tap' : 'write');
const interaction = el('section', 'shared-interaction'); interaction.setAttribute('aria-label', 'Exercise interaction');
const panelSelector = el('div', 'interaction-selector'); panelSelector.setAttribute('role', 'group'); panelSelector.setAttribute('aria-label', 'Choose response');
const countsButton = button('Counts', () => selectResponsePanel('counts'));
const performButton = button('Perform', () => selectResponsePanel('perform'));
const optionsButton = button('Options', () => {
  responseOptionsOpen = true;
  performance.cancel('Response options opened');
  editors.forEach(editor => editor.suspend());
  updateResponseView();
  optionsButton.focus({ preventScroll: true });
});
// Keep pad blur from moving the panel between pointer down and click.
optionsButton.addEventListener('pointerdown', event => { if (event.button === 0) event.preventDefault(); });
optionsButton.hidden = !mobileInput.matches;
panelSelector.append(countsButton, performButton, optionsButton);
const interactionBody = el('div', 'interaction-body');
const countPalette = el('section', 'count-palette-host'); countPalette.id = 'count-palette'; countPalette.setAttribute('aria-label', 'Counting input palette');
countsButton.setAttribute('aria-controls', countPalette.id);
const paletteEmpty = el('p', 'palette-empty', 'Select a count box above to enter counts or toggle Rest and Connect for its group.'); countPalette.append(paletteEmpty);
const performanceSetup = el('div', 'performance-setup');
const responseOptions = el('section', 'response-options');
responseOptions.id = 'response-options'; responseOptions.hidden = true;
responseOptions.setAttribute('aria-label', 'Input options');
optionsButton.setAttribute('aria-controls', responseOptions.id);

const performance = createPerformance({
  follow: (clock, duration) => clock ? workspace.startFollowing(clock, duration) : workspace.stopFollowing(),
  treatBag: feedbackSnapshot,
  countingFeedback: () => ({ plan: activity.countingPlan, answer: activity.countingAnswer, checked: activity.checkedCountingAnswer, result: activity.countingResult, mode: preferences.mode, navigate: focusProblem }), exercise: () => activity.exercise, preferences, changed: persist,
  busy: active => {
    performing = active; picker.disabled = next.disabled = customButton.disabled = active;
    settings.setLocked(active);
    settings.sync(preferences.counting);
    if (!active) next.disabled = Boolean(generationIssue(generation));
    if (active) { editors.forEach(e => e.suspend()); }
    updateResponseView();
    if (active) {
      // Settle the entire score/pad into view once, before count-in. Horizontal playback following stays inside the score.
      passage.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  },
  decorate: decoratePerformance,
  next: () => newExercise(),
  nextIssue: () => generationIssue(generation),
});
function focusCounts() { const first = activity.countingPlan.counts[0]; if (first) editors[first.measure]?.focusPosition(first.id); }
function focusProblem(id: CountId) {
  const details = feedbackSnapshot.querySelector<HTMLDetailsElement>('.treat-details');
  if (details) details.open = false;
  selectResponsePanel('counts');
  const count = activity.countingPlan.counts.find(c => c.id === id);
  if (count) editors[count.measure]?.focusPosition(id);
  const bounds = passage.getBoundingClientRect();
  if (bounds.top < 0 || bounds.bottom > innerHeight) passage.scrollIntoView({ block: 'start', behavior: 'instant' });
}
function evaluateAnswer() {
  practiceView.dataset.phase = 'review';
  activity.countingResult = evaluateCountingAnswer(activity.countingPlan, activity.countingAnswer);
  activity.checkedCountingAnswer = activity.countingAnswer;
  refreshCounting();
  const problems = countingProblems(activity.countingPlan, activity.countingResult, activity.checkedCountingAnswer, activity.countingAnswer);
  const first = activity.countingPlan.counts.find(c => problems.some(p => p.item.countIds.includes(c.id)));
  if (first) focusProblem(first.id);
  else if (!completionNext.hidden && !completionNext.disabled) completionNext.focus();
}
function refreshCounting() {
  editors.forEach(editor => editor.refresh());
  check.textContent = activity.countingResult ? 'Check Again' : 'Check';
  const score = activity.countingResult ? countingScore(activity.countingResult) : null;
  completionNext.disabled = Boolean(generationIssue(generation));
  completionNext.hidden = !score || score.correct !== score.total || activity.checkedCountingAnswer !== activity.countingAnswer;
  performance.refreshFeedback();
}
const check = button('Check', evaluateAnswer, true);
const completionNext = button('Next Exercise', () => newExercise()); completionNext.hidden = true;
function newExercise(returnToPractice = false) {
  migratedCounting = false;
  const issue = generationIssue(generation);
  if (issue) { summary.textContent = issue; return; }
  performance.cancel('New exercise');
  fixtureId = 'generated'; picker.value = '';
  activity.preferences.generation = generation; activity.next();
  loadExercise(activity.exercise.score, !returnToPractice, false);
  if (customDialog.open) customDialog.close();
  practiceView.dataset.phase = 'input';
  if (returnToPractice) location.hash = '#practice';
}
const next = button('New exercise', () => newExercise(Boolean(practiceView.hidden)));
const erase = button('Erase', () => editors.find(editor => editor.card.classList.contains('active-count-measure'))?.erase());
const reset = button('Erase All', () => { activity.countingAnswer = initializeAnswer(activity.countingPlan); refreshCounting(); focusCounts(); });
const eraseActions = el('div', 'count-erase-actions'); eraseActions.append(erase, reset);
actions.append(check, completionNext, eraseActions);
const sharedActions = el('div', 'setup-actions'); sharedActions.append(next);

writeResponse.append(summary);
help.append(performance.help);
performanceSetup.append(performance.tempoField);
function placeResponseOptions() {
  const container = mobileInput.matches ? responseOptions : performanceSetup;
  container.append(performance.playField, performance.metronomeField, showCountsField);
  optionsButton.hidden = !mobileInput.matches;
  panelSelector.classList.toggle('has-options', mobileInput.matches);
  if (!mobileInput.matches) responseOptionsOpen = false;
}
placeResponseOptions();
mobileInput.addEventListener('change', () => { placeResponseOptions(); updateResponseView(); });
performance.section.prepend(performanceSetup);
performance.section.id = 'performance-panel'; performButton.setAttribute('aria-controls', performance.section.id);
interactionBody.append(countPalette, actions, performance.section, responseOptions); interaction.append(panelSelector, interactionBody);
help.append(banner);
const playArea = el('div', 'practice-workspace');
playArea.append(passage, interaction);
keepCountingDockClear(playArea, passage, interaction);
practiceView.append(playArea, writeResponse);
const settings = createSettingsPage({
  initialGeneration: generation,
  newExercise: () => newExercise(true),
  initialCounting: preferences.counting,
  isLinked: preferenceSession.isLinked,
  saveCountingDefaults: () => preferenceSession.saveAsDefaults(raw => localStorage.setItem(preferenceKey, raw)),
  counting: value => { preferences.counting = value; persist(); updateExerciseSummary(); },
  generation: value => {
    generation = value; persist();
    const issue = generationIssue(generation); next.disabled = completionNext.disabled = Boolean(issue); performance.syncResults();
    updateExerciseSummary();
  },
});
customDialog.append(settings.exerciseControls, settings.levelDetails);
settings.levelField.append(customButton, sharedActions);
const exerciseRow = el('div', 'exercise-overview-row');
exerciseRow.append(settings.levelField, feedbackSnapshot);
practiceView.prepend(exerciseRow);
if (testing.enabled) {
  const fixtures = el('details', 'testing-fixtures');
  fixtures.append(el('summary', '', 'Developer / testing fixtures'), el('p', 'setting-hint', 'Testing access enabled. Selecting a fixed fixture replaces the exercise and clears both responses. New exercise returns to generated practice.'), field('Testing fixture', picker));
  customDialog.append(fixtures);
}
practiceView.append(exerciseSummary);
const nav = el('nav', 'rhythm-nav'); nav.setAttribute('aria-label', 'Rhythm pages');
const practiceLink = el('a', 'control', 'Practice'); practiceLink.href = '#practice';
const settingsLink = el('a', 'control', 'Settings'); settingsLink.href = '#settings'; nav.append(practiceLink, settingsLink, helpButton);
activitySurface.append(nav, pageTitle, practiceView, settings.page);
const footer = createAppFooter({ app: { id: 'rhythm', name: 'Uno234' }, status: offlineStatus });
main.append(header, activitySurface, footer, help, customDialog); app.append(main);
function chooseFixture(id: string) {
  if (!testing.enabled || !practiceFixtures.some(f => f.id === id)) return;
  fixtureId = id; picker.value = id;
  loadExercise(practiceFixtures.find(f => f.id === id)!.score, !practiceView.hidden);
}
function loadExercise(score: RhythmScore, focus: boolean, replace = true) {
  performance.cancel('Exercise changed');
  if (replace) { activity.preferences.preset = fixtureId; activity.replace(score); }
  performance.reset(); persist(); next.disabled = Boolean(generationIssue(generation));
  passage.dataset.exerciseId = activity.exercise.id;
  tieNotation?.destroy(); tieNotation = null;
  currentMeasures = activity.exercise.score.measures;
  const measures = currentMeasures;
  passageStrip.dataset.measures = String(measures.length);
  passageStrip.style.setProperty('--measure-count', String(measures.length));
  passageStrip.classList.toggle('wrapped', Boolean(practiceFixtures.find(f => f.id === fixtureId)?.wrap));
  editors.forEach(editor => editor.destroy()); editors = []; passageStrip.replaceChildren();
  countPalette.onkeydown = null;
  countPalette.replaceChildren(el('p', 'palette-empty', activity.countingPlan.counts.length ? 'Select a count box to enter counts or toggle its unit.' : 'This exercise has no count inputs with the current settings.'));
  measures.forEach((measure, index) => {
    const editor = createPlanEditor(measure, index, {
      plan: activity.countingPlan, answer: () => activity.countingAnswer, result: () => responsePanel === 'counts' ? activity.countingResult : null, checked: () => activity.checkedCountingAnswer,
      palette: countPalette, activated: () => {
        editors.forEach((other, otherIndex) => { other.card.classList.toggle('active-count-measure', otherIndex === index); if (otherIndex !== index) other.suspend(); });
        selectResponsePanel('counts');
      },
      hidden: () => Boolean(practiceView.hidden) || responsePanel === 'perform' || performing || responseOptionsOpen,
      reveal: target => workspace.reveal(target),
      change: answer => { if (practiceView.dataset.phase === 'review') practiceView.dataset.phase = 'input'; activity.countingAnswer = answer; refreshCounting(); },
      check: evaluateAnswer,
      navigate: (id, delta) => {
        const counts = activity.countingPlan.counts, target = counts[counts.findIndex(c => c.id === id) + delta];
        if (target) editors[target.measure]!.focusPosition(target.id);
      },
    });
    editors.push(editor); passageStrip.append(editor.card);
  });
  // Use the densest bar's required width throughout the passage. Independent
  // minima scale the notation differently and misalign adjacent staffs/inputs.
  const measureWidth = Math.max(280, ...editors.map(editor =>
    Number.parseFloat(editor.card.style.getPropertyValue('--count-measure-width'))));
  passageStrip.style.setProperty('--passage-measure-width', `${measureWidth}px`);
  tieNotation = renderPassageTies(measures, passageStrip);
  workspace.reset();
  updateExerciseSummary();
  summary.textContent = ''; refreshCounting();
  updateEditors(); updateResponseView();
  if (focus && responsePanel === 'counts') focusCounts();
}
function updateExerciseSummary() {
  const source = activity.exerciseGeneration.teachingPreset;
  const label = teachingPresetLabel(source);
  exerciseSummary.textContent = `Current exercise: ${fixtureId === 'generated' ? label : `Testing fixture · ${activity.exercise.label}`} · ${currentMeasures.length} ${currentMeasures.length === 1 ? 'measure' : 'measures'} · ${currentMeasures[0]!.meter.join('/')}.`;
  if (JSON.stringify(preferences.counting) !== JSON.stringify(activity.countingPlan.preferences) || fixtureId !== 'generated' || JSON.stringify(generation) !== JSON.stringify(activity.exerciseGeneration)) exerciseSummary.textContent += ' Pending settings apply on New exercise; current responses are kept.';
  const issue = generationIssue(generation);
  if (preferenceSession.notice) exerciseSummary.textContent += ` ${preferenceSession.notice}`;
  if (migratedCounting) exerciseSummary.textContent += ' Counting updated: groups are inferred; long-note subdivision is on and dotted subdivision is off. Review Settings.';
  if (issue) exerciseSummary.textContent += ` New exercise unavailable: ${issue}`;
}
function updateEditors() {
  persist();
  settings.sync(preferences.counting);
}
function showPage(focus = true) {
  editors.forEach(editor => editor.suspend());
  performance.cancel('Page changed');
  const isSettings = location.hash === '#settings';
  main.dataset.view = isSettings ? 'settings' : 'practice';
  practiceView.hidden = isSettings; settings.page.hidden = !isSettings;
  practiceLink.removeAttribute('aria-current'); settingsLink.removeAttribute('aria-current');
  (isSettings ? settingsLink : practiceLink).setAttribute('aria-current', 'page');
  pageTitle.textContent = isSettings ? 'Settings' : 'Practice';
  pageTitle.classList.toggle('sr-only', !isSettings);
  document.title = `${pageTitle.textContent} — Uno234`;
  updateEditors(); updateResponseView(); editors.forEach(editor => editor.resume()); tieNotation?.refresh();
  if (!isSettings && responsePanel === 'counts') {
    focusCounts();
    if (focus) window.scrollTo(0, 0);
  }
  else if (focus) { pageTitle.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
window.addEventListener('hashchange', () => { if (['', '#settings', '#practice'].includes(location.hash)) showPage(); });
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey || event.repeat || practiceView.hidden || responsePanel === 'perform' || performing || responseOptionsOpen) return;
  if ((event.target as Element).closest('button, a, input, select, textarea, [role="button"], [contenteditable], .count-popover')) return;
  event.preventDefault(); evaluateAnswer();
});

function selectResponsePanel(panel: 'counts' | 'perform') {
  responseOptionsOpen = false;
  if (panel !== responsePanel) {
    performance.cancel('Response panel changed');
    editors.forEach(editor => editor.suspend());
    responsePanel = panel;
    if (panel === 'counts') practiceView.dataset.phase = activity.countingResult ? 'review' : 'input';
    activity.setMode(panel === 'perform' ? 'tap' : 'write');
    persist();
  }
  updateResponseView();
}
function updateResponseView() {
  performance.refreshFeedback();
  const writing = responsePanel === 'counts';
  writeResponse.hidden = !writing || performing || responseOptionsOpen;
  const showPerformance = responsePanel === 'perform';
  performance.section.hidden = !showPerformance || responseOptionsOpen;
  countPalette.hidden = showPerformance || responseOptionsOpen;
  responseOptions.hidden = !responseOptionsOpen;
  erase.disabled = !editors.some(editor => editor.card.classList.contains('active-count-measure')) || !activity.countingPlan.counts.length;
  playArea.classList.toggle('editing-counts', !showPerformance && !performing && !responseOptionsOpen);
  actions.hidden = showPerformance || performing || responseOptionsOpen;
  workspace.setEnabled(true, writing && !performing && !responseOptionsOpen ? 'writing' : 'performance');
  countsButton.setAttribute('aria-pressed', String(!showPerformance && !responseOptionsOpen)); performButton.setAttribute('aria-pressed', String(showPerformance && !responseOptionsOpen));
  optionsButton.setAttribute('aria-pressed', String(responseOptionsOpen));
  banner.hidden = responsePanel === 'perform';
  const hideCounts = !writing && !preferences.showCounts;
  passage.classList.toggle('counts-hidden', hideCounts);
  passage.classList.toggle('counts-readonly', !writing || performing);
  passageStrip.querySelectorAll<SVGGElement>('g[data-event]').forEach(glyph => {
    glyph.setAttribute('role', writing && !performing && !responseOptionsOpen && glyph.dataset.entryLabel ? 'button' : 'group'); glyph.setAttribute('tabindex', writing && !performing && !responseOptionsOpen && glyph.dataset.entryLabel ? '0' : '-1');
    if (writing && !performing && !responseOptionsOpen && glyph.dataset.entryLabel) { glyph.setAttribute('aria-label', glyph.dataset.entryLabel!); glyph.removeAttribute('aria-haspopup'); glyph.setAttribute('aria-controls', countPalette.id); }
    else { glyph.setAttribute('aria-label', glyph.dataset.musicLabel ?? `${glyph.dataset.kind} ${Number(glyph.dataset.event) + 1}`); glyph.removeAttribute('aria-haspopup'); }
  });
  passageStrip.querySelectorAll<HTMLElement>('.answer-area').forEach(area => { area.hidden = hideCounts; area.inert = performing || !writing || responseOptionsOpen; });
  editors.forEach(editor => editor.refresh());
  decoratePerformance(showPerformance && !performing ? performance.record() : null);
  tieNotation?.refresh();
}
function decoratePerformance(record: AttemptRecord | null) {
  if (responsePanel === 'perform') practiceView.dataset.phase = performing ? 'input' : record?.status === 'completed' ? 'review' : 'setup';
  if (responsePanel !== 'perform') record = null;
  passage.querySelectorAll('.timing-timeline').forEach(node => node.remove());
  if (record && record.status === 'completed') {
    timingTimelines(record).forEach((data, index) => editors[index]?.card.querySelector('.measure')!.append(renderTimingTimeline(data, Boolean(record.timingOffset), index === 0)));
  }
  passageStrip.querySelectorAll<SVGElement>('g[data-event]').forEach(glyph => { glyph.removeAttribute('data-feedback'); glyph.removeAttribute('aria-describedby'); glyph.querySelector('title')!.textContent = `${glyph.dataset.kind} ${Number(glyph.dataset.event) + 1}`; });
  if (!record || record.status !== 'completed') return;
  const evaluation = evaluateAttempt(record);
  function annotate(measure: number, event: number, feedback: string, text: string, description: string) {
    const glyph = editors[measure]?.card.querySelector<SVGElement>(`g[data-event="${event}"]`);
    if (glyph) { glyph.dataset.feedback = feedback; glyph.setAttribute('aria-describedby', description); glyph.querySelector('title')!.textContent = text; }
  }
  record.plan.notes.forEach((note, index) => {
    const match = evaluation.matches.find(m => m.expected === index);
    const accepted = match?.attackAccepted && ['accepted', 'not-graded', 'unavailable'].includes(match.durationFeedback);
    note.sources.forEach(source => annotate(source.measure, source.event, match?.durationFeedback === 'unavailable' ? 'unavailable' : match ? accepted ? 'matched' : 'overlap' : evaluation.missing.includes(index) ? 'missing' : 'unavailable', match ? `Target-relative attack ${Math.round(match.onsetOffset * 1000)} ms${match.durationFeedback === 'not-graded' ? '; release not graded' : `; duration ${match.durationFeedback}; release ${match.releaseOffset === null ? 'not observed' : Math.round(match.releaseOffset * 1000) + ' ms'}`}` : evaluation.evidenceAvailable ? 'Missing attack' : 'Insufficient evidence for musical assessment', `feedback-note-${index}`));
  });
  record.plan.rests.forEach((rest, index) => {
    const violations = evaluation.restViolations.filter(o => o.rest === index);
    const early = evaluation.restAttacks.some(o => o.rest === index);
    annotate(rest.source.measure, rest.source.event, !evaluation.evidenceAvailable ? 'unavailable' : violations.length ? 'overlap' : 'silent', !evaluation.evidenceAvailable ? 'Insufficient evidence for musical rest assessment; raw intersections retained' : violations.length ? 'Leave more silence in this rest' : record.playStyle === 'tap' ? early ? 'Raw target-relative rest intersection retained; musical timing accepted' : 'No attacks during rest' : 'Silent or within attack/release tolerance', `feedback-rest-${index}`);
  });
}
loadExercise(activity.exercise.score, false, false);
showPage(false);
