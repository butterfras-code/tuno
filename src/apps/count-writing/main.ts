// Copyright (C) 2026 tUno contributors. SPDX-License-Identifier: GPL-3.0-only
import '../../tokens.css';
import '../../shared/ui/fonts.css';
import './styles.css';
import uno from '../../assets/uno-happy.svg';
import { button, el, field, select } from '../../shared/ui/components.ts';
import { countWritingFixtures } from './fixtures.ts';
import { createMeasureEditor } from './editor.ts';
import { createSettingsPage, dottedConventionOptions } from './settings.ts';
import { defaultPresentation, withLinePlacement } from './presentation.ts';
import { defaultGeneration, generateExercise, generationIssue } from './generation.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import type { DottedQuarterConvention } from './evaluation.ts';
import type { OffbeatSymbol } from './input.ts';

let offbeat: OffbeatSymbol = '&';
let presentation = { ...defaultPresentation };
let dottedConvention: DottedQuarterConvention = 'review';
let generation = defaultGeneration();
let fixtureId = new URLSearchParams(location.search).get('fixture') ?? 'generated';
if (!countWritingFixtures.some(f => f.id === fixtureId)) fixtureId = 'generated';
let editors: ReturnType<typeof createMeasureEditor>[] = [];
let focusNewRhythm = false;
const app = document.querySelector<HTMLElement>('#app')!;
const main = el('main'); main.id = 'editor';
const header = el('header');
const mascot = el('img', 'mascot'); mascot.src = uno; mascot.alt = '';
const title = el('div');
const pageTitle = el('h1', '', 'Count Writing'); pageTitle.id = 'page-title'; pageTitle.tabIndex = -1;
const subtitle = el('p', 'subtitle', 'Read, write, check, and revise.');
title.append(el('p', 'eyebrow', 'tUno · Count practice'), pageTitle, subtitle); header.append(title, mascot);
const practiceView = el('section'); practiceView.id = 'practice-view';
const banner = el('p', 'review-note', 'Open entry · 4/4. Counting conventions and duration-line endpoints retain their teacher-review options.');
const exerciseSummary = el('p'); exerciseSummary.setAttribute('role', 'status');
const picker = select([{ value: 'generated', label: 'Generated practice' }, ...countWritingFixtures.map(f => ({ value: f.id, label: f.label }))], chooseFixture);
picker.value = fixtureId;
const convention = select(dottedConventionOptions, value => { dottedConvention = value as DottedQuarterConvention; updateEditors(); });
const conventionField = field('Dotted-quarter counting convention', convention);
const setup = el('div', 'card'); setup.append(field('Review fixture', picker), conventionField);
const passage = el('div', 'passage');
const summary = el('p', 'practice-status'); summary.setAttribute('role', 'status');
const actions = el('div', 'actions');
function evaluateAnswer() {
  const results = editors.map(editor => editor.check());
  const dimensions = results.flatMap(result => Object.values(result));
  summary.textContent = dimensions.some(d => d.verdict === 'revise') ? 'Some answers need correction. Review the feedback under each measure, then Retry.' : dimensions.some(d => d.verdict === 'provisional') ? 'Your answer matches with teacher-review items. Review the feedback, then Retry or Next exercise.' : 'All measures match. Choose Next exercise to keep practicing.';
  retry.hidden = false;
}
const check = button('Check', evaluateAnswer, true);
const retry = button('Retry', () => { editors.forEach(editor => { editor.suspend(); editor.retry(); }); summary.textContent = 'Correct your answer, then Check again.'; retry.hidden = true; editors[0]?.focus(); }); retry.hidden = true;
const next = button('Next exercise', () => {
  const issue = generationIssue(generation);
  if (issue) { summary.textContent = issue; return; }
  fixtureId = 'generated'; picker.value = fixtureId; loadExercise(generateExercise(generation), true);
});
const reset = button('Reset answer', () => { editors.forEach(editor => editor.reset()); summary.textContent = ''; retry.hidden = true; editors[0]?.focus(); });
actions.append(check, retry, next, reset);
practiceView.append(banner, setup, exerciseSummary, passage, actions, summary, el('p', 'footer-note', 'Settings for length and ingredients apply on Next exercise. Answers and preferences last in this tab only. Review fixtures are available for regression checks.'));
const settings = createSettingsPage({
  offbeat: value => { offbeat = value; updateEditors(); },
  placement: value => { presentation = withLinePlacement(presentation, value); updateEditors(); },
  appearance: value => { presentation = { ...presentation, sustainAppearance: value }; updateEditors(); },
  fixture: chooseFixture,
  convention: value => { dottedConvention = value; convention.value = value; updateEditors(); },
  generation: value => {
    generation = value;
    const issue = generationIssue(generation); next.disabled = Boolean(issue);
    exerciseSummary.textContent = issue ?? 'Length and ingredients updated. Your current answer is kept; Next exercise uses these settings.';
  },
});
const nav = el('nav', 'rhythm-nav'); nav.setAttribute('aria-label', 'Rhythm pages');
const practiceLink = el('a', 'control', 'Count Writing'); practiceLink.href = '#practice';
const settingsLink = el('a', 'control', 'Settings'); settingsLink.href = '#settings'; nav.append(practiceLink, settingsLink);
main.append(header, nav, practiceView, settings.page); app.append(main);
function chooseFixture(id: string) {
  if (id === fixtureId) return;
  if (id === 'generated' && generationIssue(generation)) { picker.value = fixtureId; settings.sync(fixtureId, dottedConvention, presentation, offbeat); return; }
  fixtureId = id; picker.value = id;
  focusNewRhythm = Boolean(practiceView.hidden);
  loadExercise(id === 'generated' ? generateExercise(generation) : [countWritingFixtures.find(f => f.id === id)!], !practiceView.hidden);
}
function loadExercise(measures: RhythmMeasure[], focus: boolean) {
  editors.forEach(editor => editor.destroy()); editors = []; passage.replaceChildren();
  measures.forEach((measure, index) => {
    const editor = createMeasureEditor(measure, index + 1, {
      offbeat, presentation, convention: dottedConvention, hidden: () => Boolean(practiceView.hidden),
      edited: () => { summary.textContent = 'Answer or counting rule changed. Check again for updated feedback.'; },
      check: evaluateAnswer,
      navigate: (delta, clear) => { const target = editors[index + delta]; if (!target) return false; if (clear) target.backspace(); else target.focus(delta < 0); return true; },
    });
    editors.push(editor); passage.append(editor.card); editor.mount();
  });
  exerciseSummary.textContent = `${fixtureId === 'generated' ? 'Generated practice' : 'Review fixture'} · ${measures.length} ${measures.length === 1 ? 'measure' : 'measures'} · 4/4`;
  summary.textContent = ''; retry.hidden = true;
  updateEditors();
  if (focus) editors[0]?.focus();
}
function updateEditors() {
  editors.forEach(editor => editor.update(offbeat, presentation, dottedConvention));
  settings.sync(fixtureId, dottedConvention, presentation, offbeat);
}
function showPage(focus = true) {
  editors.forEach(editor => editor.suspend());
  const isSettings = location.hash === '#settings';
  practiceView.hidden = isSettings; settings.page.hidden = !isSettings;
  practiceLink.removeAttribute('aria-current'); settingsLink.removeAttribute('aria-current');
  (isSettings ? settingsLink : practiceLink).setAttribute('aria-current', 'page');
  pageTitle.textContent = isSettings ? 'Rhythm settings' : 'Count Writing';
  subtitle.textContent = isSettings ? 'Counting, content, and what comes next.' : 'Read, write, check, and revise.';
  document.title = `${pageTitle.textContent} — tUno prototype`;
  updateEditors(); editors.forEach(editor => editor.resume());
  if (!isSettings && focusNewRhythm) { focusNewRhythm = false; editors[0]?.focus(); }
  else if (focus) { pageTitle.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
window.addEventListener('hashchange', () => { if (['', '#settings', '#practice'].includes(location.hash)) showPage(); });
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey || event.repeat || practiceView.hidden) return;
  if ((event.target as Element).closest('button, a, input, select, textarea, [role="button"], [contenteditable], .count-popover')) return;
  event.preventDefault(); evaluateAnswer();
});
loadExercise(fixtureId === 'generated' ? generateExercise(generation) : [countWritingFixtures.find(f => f.id === fixtureId)!], false);
showPage(false);
if (!practiceView.hidden) editors[0]?.focus();
