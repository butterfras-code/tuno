// Copyright (C) 2026 tUno contributors. SPDX-License-Identifier: GPL-3.0-only
import '../../tokens.css';
import '../../shared/ui/fonts.css';
import '../count-writing/styles.css';
import './styles.css';
import { button, el, field, select } from '../../shared/ui/components.ts';
import { Activity, presets as practiceFixtures, modeOptions, readPreferences, preferenceKey } from './activity.ts';
import type { Mode } from './activity.ts';
import { createPerformance } from './performance.ts';
import type { AttemptRecord } from './capture.ts';
import { timingTimelines, renderTimingTimeline } from './timeline.ts';
import { evaluateAttempt } from './evaluation.ts';
import { createMeasureEditor } from '../count-writing/editor.ts';
import { createSettingsPage } from './shared/settings.ts';
import { withLinePlacement } from '../count-writing/presentation.ts';
import { defaultGeneration, generateExercise, generationIssue } from './shared/generation.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { evaluatePassage } from '../count-writing/evaluation.ts';
import { passageGrid } from '../count-writing/passage.ts';
import { renderPassageTies } from './shared/notation.ts';
import { createPassageLines } from '../count-writing/passage-lines.ts';
import type { DottedQuarterConvention } from '../count-writing/evaluation.ts';
import type { OffbeatSymbol } from '../count-writing/input.ts';

let saved: string | null = null;
try { saved = localStorage.getItem(preferenceKey); } catch { /* Memory fallback. */ }
const preferences = readPreferences(saved);
const requestedFixture = new URLSearchParams(location.search).get('fixture');
if (requestedFixture && practiceFixtures.some(f => f.id === requestedFixture)) preferences.preset = requestedFixture;
let offbeat: OffbeatSymbol = preferences.offbeat;
let presentation = preferences.presentation;
let dottedConvention: DottedQuarterConvention = preferences.convention;
let generation = preferences.generation;
let fixtureId = preferences.preset;
const activity = new Activity(preferences, fixtureId === 'generated' ? generateExercise(generationIssue(generation) ? defaultGeneration() : generation) : practiceFixtures.find(f => f.id === fixtureId)!.measures);
function persist() {
  Object.assign(preferences, { offbeat, presentation, convention: dottedConvention, generation, preset: fixtureId });
  try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch { /* Memory fallback. */ }
}
let editors: ReturnType<typeof createMeasureEditor>[] = [];
let focusNewRhythm = false;
let tieNotation: ReturnType<typeof renderPassageTies> | null = null;
let currentMeasures: RhythmMeasure[] = [];
let lineEditor: ReturnType<typeof createPassageLines> | null = null;
const app = document.querySelector<HTMLElement>('#app')!;
const main = el('main', 'rhythm-app'); main.id = 'editor';
const header = el('header', 'app-header');
const brand = el('div', 'brand');
brand.append(el('h1', 'wordmark', 'Uno234'), el('p', 'tagline', 'Practice rhythm with a friend.'));
header.append(brand);
const pageTitle = el('h2', 'view-title', 'Practice'); pageTitle.id = 'page-title'; pageTitle.tabIndex = -1;
const mode = select(modeOptions, value => switchMode(value as Mode)); mode.value = preferences.mode;
const modeField = field('Mode', mode);
const practiceView = el('section'); practiceView.id = 'practice-view';
const banner = el('p', 'counting-hint');
const exerciseSummary = el('p', 'exercise-summary'); exerciseSummary.setAttribute('role', 'status');
const picker = select([{ value: 'generated', label: 'Generated practice' }, ...practiceFixtures.map(f => ({ value: f.id, label: f.label }))], chooseFixture);
picker.value = fixtureId; picker.dataset.preset = '';
const setup = el('div', 'setup exercise-toolbar'); setup.append(modeField, field('Exercise preset', picker));
const activitySurface = el('section', 'card activity-surface'); activitySurface.setAttribute('aria-label', 'Uno234 activity');
const passage = el('section', 'passage'); passage.setAttribute('aria-label', 'Exercise passage');
const passageScroll = el('div', 'score-scroll passage-scroll');
const passageStrip = el('div', 'passage-strip');
passageScroll.append(passageStrip);
passage.append(passageScroll);
const help = el('div', 'practice-help-popover'); help.id = 'practice-help'; help.popover = 'auto';
help.setAttribute('role', 'dialog'); help.setAttribute('aria-label', 'Practice help');
const helpButton = button('?', () => {
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
  el('p', '', 'Switch modes to write counts, tap rhythms, or try both on the same score. Next exercise starts a new score and clears both responses.'),
  el('p', '', 'Measures fit the available width. Counts restart at each barline. Use one pair of parentheses per written rest, and duration lines for sustained notes and rests.'),
  el('p', '', 'Duration lines: tap a start anchor, then the last covered count. Use Shift + arrows on the keyboard. Select a saved line to change its endpoint or delete it with × or Delete. Escape cancels an edit.'),
  el('p', '', 'In 6/8, write every eighth count: 1 2 3 | 4 5 6. Performance follows two dotted-quarter pulses.'),
  el('p', '', 'Preferences are saved in this browser. Exercise settings apply on Next exercise. Reloading starts with blank responses.'));
const passageFeedback = el('div', 'passage-feedback');
const summary = el('p', 'practice-status'); summary.setAttribute('role', 'status');
const actions = el('div', 'actions write-actions');
const writeResponse = el('section', 'write-response'); writeResponse.setAttribute('aria-label', 'Write Counts');
const showCounts = el('input'); showCounts.type = 'checkbox'; showCounts.checked = preferences.showCounts;
showCounts.addEventListener('change', () => { preferences.showCounts = showCounts.checked; persist(); updateResponseView(); });
const showCountsField = field('Show written counts during performance', showCounts);
let performing = false;
const performance = createPerformance({ exercise: () => activity.exercise, preferences, changed: persist,
  busy: active => {
    performing = active; picker.disabled = next.disabled = active;
    settings.setLocked(active);
    settings.sync(dottedConvention, presentation, offbeat, currentMeasures[0]?.meter[1] === 8);
    if (!active) next.disabled = Boolean(generationIssue(generation));
    if (active) { lineEditor?.cancel(); editors.forEach(e => e.suspend()); }
    updateResponseView();
    if (active) {
      // Settle the entire score/pad into view once, before count-in. No playback scrolling.
      passage.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  },
  decorate: decoratePerformance,
});
function evaluateAnswer() {
  lineEditor?.cancel(); editors.forEach(e => e.suspend());
  const results = evaluatePassage(currentMeasures, editors.map(e => e.getAnswer()), dottedConvention, lineEditor?.spans());
  editors.forEach((editor, index) => editor.showResult(results[index]!));
  const dimensions = results.flatMap(result => Object.values(result));
  summary.textContent = dimensions.some(d => d.verdict === 'revise') ? 'Some answers need correction. Review the measure feedback below the passage, then Retry.' : dimensions.some(d => d.verdict === 'provisional') ? 'Your answer matches with teacher-review items. Review the feedback, then Retry or Next exercise.' : 'All measures match. Choose Next exercise to keep practicing.';
  retry.hidden = false;
}
const check = button('Check', evaluateAnswer, true);
const retry = button('Retry', () => { lineEditor?.cancel(); editors.forEach(editor => { editor.suspend(); editor.retry(); }); summary.textContent = 'Correct your answer, then Check again.'; retry.hidden = true; editors[0]?.focus(); }); retry.hidden = true;
function newExercise(returnToPractice = false) {
  const issue = generationIssue(generation);
  if (issue) { summary.textContent = issue; return; }
  performance.cancel('New exercise');
  activity.preferences.generation = generation; activity.next();
  fixtureId = 'generated'; picker.value = fixtureId; loadExercise(activity.exercise.measures as RhythmMeasure[], !returnToPractice, false);
  if (returnToPractice) { focusNewRhythm = true; location.hash = '#practice'; }
}
const next = button('Next exercise', () => newExercise(Boolean(practiceView.hidden)));
const reset = button('Clear', () => { editors.forEach(editor => editor.reset()); lineEditor?.reset(); summary.textContent = ''; retry.hidden = true; editors[0]?.focus(); });
actions.append(check);
const sharedActions = el('div', 'setup-actions'); sharedActions.append(next);
setup.append(sharedActions);
writeResponse.append(retry, summary, passageFeedback);
help.append(performance.help);
passageScroll.after(performance.section);
practiceView.append(banner, showCountsField, passage, writeResponse);
const settings = createSettingsPage({
  initialGeneration: generation,
  newExercise: () => newExercise(true),
  offbeat: value => { offbeat = value; updateEditors(); },
  placement: value => { presentation = withLinePlacement(presentation, value); updateEditors(); },
  appearance: value => { presentation = { ...presentation, sustainAppearance: value }; updateEditors(); },
  convention: value => { dottedConvention = value; updateEditors(); },
  generation: value => {
    generation = value; persist();
    const issue = generationIssue(generation); next.disabled = Boolean(issue);
    exerciseSummary.textContent = issue ?? 'Length and ingredients updated. Your current answer is kept; Next exercise uses these settings.';
  },
});
const exerciseMeta = el('div', 'exercise-meta'); exerciseMeta.append(exerciseSummary, helpButton);
const sharedControls = el('section', 'shared-controls'); sharedControls.setAttribute('aria-label', 'Shared exercise controls'); sharedControls.append(setup, exerciseMeta);
const nav = el('nav', 'rhythm-nav'); nav.setAttribute('aria-label', 'Rhythm pages');
const practiceLink = el('a', 'control', 'Practice'); practiceLink.href = '#practice';
const settingsLink = el('a', 'control', 'Settings'); settingsLink.href = '#settings'; nav.append(practiceLink, settingsLink);
header.append(nav);
activitySurface.append(pageTitle, sharedControls, practiceView, settings.page);
main.append(header, activitySurface, help); app.append(main);
function chooseFixture(id: string) {
  if (id === fixtureId) return;
  if (id === 'generated' && generationIssue(generation)) { picker.value = fixtureId; settings.sync(dottedConvention, presentation, offbeat, currentMeasures[0]?.meter[1] === 8); return; }
  performance.cancel('Exercise changed');
  fixtureId = id; picker.value = id;
  focusNewRhythm = Boolean(practiceView.hidden);
  loadExercise(id === 'generated' ? generateExercise(generation) : practiceFixtures.find(f => f.id === id)!.measures, !practiceView.hidden);
}
function loadExercise(measures: RhythmMeasure[], focus: boolean, replace = true) {
  performance.cancel('Exercise changed');
  if (replace) { activity.preferences.preset = fixtureId; activity.replace(measures); }
  performance.reset(); persist(); next.disabled = Boolean(generationIssue(generation));
  passage.dataset.exerciseId = activity.exercise.id;
  tieNotation?.destroy(); tieNotation = null;
  lineEditor?.destroy(); lineEditor = null; currentMeasures = activity.exercise.measures as RhythmMeasure[];
  measures = currentMeasures;
  const grid = passageGrid(measures);
  passageStrip.dataset.measures = String(measures.length);
  const tied = measures.some(m => m.events.some(e => e[1]?.tieNext));
  passageStrip.classList.toggle('wrapped', Boolean(practiceFixtures.find(f => f.id === fixtureId)?.wrap));
  editors.forEach(editor => editor.destroy()); editors = []; passageStrip.replaceChildren(); passageFeedback.replaceChildren();
  measures.forEach((measure, index) => {
    const editor = createMeasureEditor(measure, index + 1, {
      scroller: passageScroll, lastMeasure: index === measures.length - 1,
      grid: grid.grids[index], externalLines: tied,
      offbeat, presentation, convention: dottedConvention, hidden: () => Boolean(practiceView.hidden) || preferences.mode === 'tap' || performing,
      edited: () => { summary.textContent = 'Answer or counting rule changed. Check again for updated feedback.'; },
      check: evaluateAnswer,
      navigate: (delta, clear) => { const target = editors[index + delta]; if (!target) return false; if (clear) target.backspace(); else target.focus(delta < 0); return true; },
    });
    editors.push(editor); passageStrip.append(editor.card); passageFeedback.append(editor.feedback); editor.mount();
  });
  editors.forEach((editor, index) => {
    const row = el('div', 'score-actions');
    if (index === 0) row.append(reset);
    if (index === editors.length - 1) row.append(actions);
    editor.card.querySelector('.answer-area')!.append(row);
  });
  tieNotation = renderPassageTies(measures, passageStrip);
  if (tied) lineEditor = createPassageLines(passageScroll, grid, editors);
  exerciseSummary.textContent = `${fixtureId === 'generated' ? 'Generated practice' : 'Review fixture'} · ${measures.length} ${measures.length === 1 ? 'measure' : 'measures'} · ${measures[0]!.meter.join("/")}`;
  summary.textContent = ''; retry.hidden = true;
  const compound = measures[0]!.meter[1] === 8;
  banner.textContent = compound ? 'Count 1 2 3 | 4 5 6 · Two dotted-quarter pulses per bar.' : 'Count quarter beats and eighth offbeats · Restart at each barline.';
  updateEditors(); updateResponseView();
  if (focus && preferences.mode !== 'tap') editors[0]?.focus();
}
function updateEditors() {
  persist();
  lineEditor?.cancel();
  editors.forEach(editor => editor.update(offbeat, presentation, dottedConvention));
  settings.sync(dottedConvention, presentation, offbeat, currentMeasures[0]?.meter[1] === 8);
}
function showPage(focus = true) {
  lineEditor?.cancel();
  editors.forEach(editor => editor.suspend());
  performance.cancel('Page changed');
  const isSettings = location.hash === '#settings';
  main.dataset.view = isSettings ? 'settings' : 'practice';
  practiceView.hidden = isSettings; settings.page.hidden = !isSettings;
  practiceLink.removeAttribute('aria-current'); settingsLink.removeAttribute('aria-current');
  (isSettings ? settingsLink : practiceLink).setAttribute('aria-current', 'page');
  pageTitle.textContent = isSettings ? 'Settings' : 'Practice';
  pageTitle.classList.toggle('sr-only', !isSettings); helpButton.hidden = isSettings;
  document.title = `${pageTitle.textContent} — Uno234`;
  updateEditors(); updateResponseView(); editors.forEach(editor => editor.resume()); tieNotation?.refresh();
  if (!isSettings && focusNewRhythm && preferences.mode !== 'tap') { focusNewRhythm = false; editors[0]?.focus(); }
  else if (focus) { pageTitle.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
window.addEventListener('hashchange', () => { if (['', '#settings', '#practice'].includes(location.hash)) showPage(); });
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey || event.repeat || practiceView.hidden || preferences.mode === 'tap' || performing) return;
  if ((event.target as Element).closest('button, a, input, select, textarea, [role="button"], [contenteditable], .count-popover')) return;
  event.preventDefault(); evaluateAnswer();
});

function switchMode(value: Mode) {
  performance.cancel('Mode changed');
  lineEditor?.cancel(); editors.forEach(e => e.suspend());
  activity.setMode(value); persist(); updateResponseView();
  editors.forEach(e => e.resume()); tieNotation?.refresh();
}
function updateResponseView() {
  const writing = preferences.mode !== 'tap';
  writeResponse.hidden = !writing || performing;
  performance.section.hidden = preferences.mode === 'write';
  showCountsField.hidden = preferences.mode !== 'both';
  passage.querySelectorAll<HTMLElement>('.score-actions').forEach(row => { row.hidden = !writing || performing; });
  const hideCounts = !writing || (performing && !preferences.showCounts);
  passage.classList.toggle('counts-hidden', hideCounts);
  passage.classList.toggle('counts-readonly', performing);
  passageStrip.querySelectorAll<SVGGElement>('g[data-event]').forEach(glyph => {
    glyph.setAttribute('role', writing && !performing ? 'button' : 'group'); glyph.setAttribute('tabindex', writing && !performing ? '0' : '-1');
    if (writing && !performing) { glyph.setAttribute('aria-label', glyph.dataset.entryLabel!); glyph.setAttribute('aria-haspopup', 'dialog'); }
    else { glyph.setAttribute('aria-label', `${glyph.dataset.kind} ${Number(glyph.dataset.event) + 1}`); glyph.removeAttribute('aria-haspopup'); }
  });
  passageStrip.querySelectorAll<HTMLElement>('.answer-area').forEach(area => { area.hidden = hideCounts; area.inert = performing || !writing; });
  decoratePerformance(preferences.mode === 'tap' || (preferences.mode === 'both' && !performing) ? performance.record() : null);
  tieNotation?.refresh();
}
function decoratePerformance(record: AttemptRecord | null) {
  passage.querySelectorAll('.timing-timeline').forEach(node => node.remove());
  if (record && record.status === 'completed' && preferences.mode !== 'write') {
    timingTimelines(record).forEach((data, index) => editors[index]?.card.append(renderTimingTimeline(data, Boolean(record.timingOffset), index === 0)));
  }
  passageStrip.querySelectorAll<SVGElement>('g[data-event]').forEach(glyph => { glyph.removeAttribute('data-feedback'); glyph.removeAttribute('aria-describedby'); glyph.querySelector('title')!.textContent = `${glyph.dataset.kind} ${Number(glyph.dataset.event) + 1}`; });
  if (!record || record.status !== 'completed' || preferences.mode === 'write') return;
  const evaluation = evaluateAttempt(record);
  function annotate(measure: number, event: number, feedback: string, text: string, description: string) {
    const glyph = editors[measure]?.card.querySelector<SVGElement>(`g[data-event="${event}"]`);
    if (glyph) { glyph.dataset.feedback = feedback; glyph.setAttribute('aria-describedby', description); glyph.querySelector('title')!.textContent = text; }
  }
  record.plan.notes.forEach((note, index) => {
    const match = evaluation.matches.find(m => m.expected === index);
    note.sources.forEach(source => annotate(source.measure, source.event, match ? 'matched' : 'missing', match ? `Attack ${Math.round(match.onsetOffset * 1000)} ms; release ${match.releaseOffset === null ? 'not observed' : Math.round(match.releaseOffset * 1000) + ' ms'}` : 'Missing attack', `feedback-note-${index}`));
  });
  record.plan.rests.forEach((rest, index) => {
    const overlaps = evaluation.restOverlaps.filter(o => o.rest === index);
    annotate(rest.source.measure, rest.source.event, overlaps.length ? 'overlap' : 'silent', overlaps.length ? 'Input overlaps this rest' : 'Silent', `feedback-rest-${index}`);
  });
}
loadExercise(activity.exercise.measures as RhythmMeasure[], false, false);
showPage(false);
if (!practiceView.hidden && preferences.mode !== 'tap') editors[0]?.focus();
