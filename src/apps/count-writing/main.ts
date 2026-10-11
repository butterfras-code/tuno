// Copyright (C) 2026 tUno contributors. SPDX-License-Identifier: GPL-3.0-only
import '../../tokens.css';
import '../../shared/ui/fonts.css';
import './styles.css';
import uno from '../../assets/uno-happy.svg';
import { button, el, field, select } from '../../shared/ui/components.ts';
import { countWritingFixtures } from './fixtures.ts';
import { countGrid, slotX } from './grid.ts';
import { alphabet, blankAnswer, evaluate } from './evaluation.ts';
import type { CountSymbol, DottedQuarterConvention, Evaluation, Span } from './evaluation.ts';
import { renderMeasure } from './notation.ts';
import { createSettingsPage, dottedConventionOptions } from './settings.ts';
import { defaultPresentation, withLinePlacement } from './presentation.ts';

let presentation = { ...defaultPresentation };
let fixture = countWritingFixtures[0]!;
let grid = countGrid(fixture);
let answer = blankAnswer(fixture);
const positionLabel = (slot: number) => grid.slots[slot]!.label;
const tickX = (slot: number) => slotX(slot, grid.slots.length);
let selected = 0;
let lineStart: number | null = null;
let lineEnd: number | null = null;
let result: Evaluation | null = null;
let changed = false;
let dottedConvention: DottedQuarterConvention = 'review';
const app = document.querySelector<HTMLElement>('#app')!;
const main = el('main'); main.id = 'editor';
const header = el('header');
const mascot = el('img', 'mascot'); mascot.src = uno; mascot.alt = '';
const title = el('div');
const pageTitle = el('h1', '', 'Count Writing'); pageTitle.id = 'page-title'; pageTitle.tabIndex = -1;
const subtitle = el('p', 'subtitle', 'One measure. Read, write, and revise.');
title.append(el('p', 'eyebrow', 'tUno · Teacher review'), pageTitle, subtitle);
header.append(title, mascot);
const banner = el('p', 'review-note', 'Working prototype · Open entry · 4/4 · “&” offbeats. Counting conventions and duration-line endpoints are provisional.');
function chooseFixture(id: string) {
  if (id === fixture.id) return;
  fixture = countWritingFixtures.find(f => f.id === id)!;
  picker.value = id; reset(false);
}
const picker = select(countWritingFixtures.map(f => ({ value: f.id, label: f.label })), chooseFixture);
const convention = select(dottedConventionOptions, value => {
  dottedConvention = value as DottedQuarterConvention; edit();
});
const conventionField = field('Dotted-quarter counting convention', convention);
const card = el('section', 'card'); card.setAttribute('aria-label', 'Editable measure');
const score = el('div', 'score-scroll');
const measure = el('div', 'measure');
const notation = el('div');
const counts = el('div', 'counts'); counts.setAttribute('role', 'group'); counts.setAttribute('aria-label', 'Count positions');
const answerArea = el('div', 'answer-area');
const lines = el('div', 'lines'); lines.setAttribute('aria-label', 'Duration lines');
const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
preview.classList.add('duration-preview'); preview.setAttribute('aria-hidden', 'true');
const previewLine = document.createElementNS(preview.namespaceURI, 'line');
preview.append(previewLine);
let previewCursor: { x: number; y: number } | null = null;

function renderLinePreview() {
  const start = lineStart ?? (lineEnd === null ? null : answer.spans[lineEnd]?.start ?? null);
  const visible = start !== null && !practiceView.hidden;
  preview.style.display = visible ? '' : 'none';
  if (!visible) return;
  const area = answerArea.getBoundingClientRect();
  const anchor = anchors[start]!.getBoundingClientRect();
  const x = anchor.x + anchor.width / 2 - area.x;
  const y = anchor.y + anchor.height / 2 - area.y;
  // Reuse the rendered anchor spacing, including placement offsets and responsive widths.
  const spacing = (tickX(1) - tickX(0)) / 100 * area.width;
  const endX = previewCursor ? previewCursor.x - area.x : Math.min(x + spacing * .85, area.width - 4);
  const endY = previewCursor ? previewCursor.y - area.y : y;
  for (const [name, value] of Object.entries({ x1: x, y1: y, x2: endX, y2: endY })) {
    previewLine.setAttribute(name, String(value));
  }
}
function trackPreviewPointer(event: PointerEvent) {
  previewCursor = event.pointerType === 'mouse' ? { x: event.clientX, y: event.clientY } : null;
  renderLinePreview();
}
document.addEventListener('pointerdown', trackPreviewPointer, true);
document.addEventListener('pointermove', trackPreviewPointer);
document.addEventListener('keydown', () => { previewCursor = null; renderLinePreview(); });
document.addEventListener('scroll', renderLinePreview, true);
new ResizeObserver(renderLinePreview).observe(answerArea);

const slots: HTMLButtonElement[] = [];
const anchors: HTMLButtonElement[] = [];
const live = el('p', 'selection'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
const instructions = el('p', 'instructions', 'Select a position, then type or tap a symbol. ← → move; Backspace/Delete erase; ( or ) toggles parentheses. Tab reaches all controls.');
instructions.id = 'instructions';
function edit() { if (result) changed = true; refresh(); }
function focusSlot(index: number) { selected = Math.max(0, Math.min(grid.slots.length - 1, index)); refresh(); slots[selected]!.focus({ preventScroll: true }); slots[selected]!.scrollIntoView({ block: 'nearest', inline: 'nearest' }); if (selected === 0) score.scrollLeft = 0; }
function put(symbol: CountSymbol) { answer.symbols[selected] = symbol; edit(); }
function toggleRest() { answer.rests[selected] = !answer.rests[selected]; edit(); }
function lineTap(tick: number) {
  selected = tick;
  if (lineEnd !== null) {
    const span = answer.spans[lineEnd]!;
    span.end = Math.max(span.start, tick); lineEnd = null;
    edit(); renderLines();
  } else if (lineStart === null) { lineStart = tick; refresh(); }
  else if (lineStart !== tick) {
    answer.spans.push({ start: Math.min(lineStart, tick), end: Math.max(lineStart, tick) });
    lineStart = null; edit(); renderLines();
  }
}
function renderSlots() {
  slots.length = 0; anchors.length = 0; counts.replaceChildren();
  for (let tick = 0; tick < grid.slots.length; tick++) {
    const slot = button('', () => {
      selected = tick;
      if (lineEnd !== null || lineStart !== null) lineTap(tick); else refresh();
    });
    slot.className = 'count-slot'; slot.style.left = `${tickX(tick)}%`;
    slot.setAttribute('aria-describedby', 'instructions');
    slot.addEventListener('focus', () => { selected = tick; refresh(); });
    slot.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if ((alphabet as readonly string[]).includes(event.key)) { event.preventDefault(); put(event.key as CountSymbol); }
      else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); put(''); }
      else if (event.key === '(' || event.key === ')') { event.preventDefault(); toggleRest(); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); focusSlot(selected + (event.key === 'ArrowLeft' ? -1 : 1)); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); focusSlot(event.key === 'Home' ? 0 : grid.slots.length - 1); }
      else if (event.key === 'Escape') { lineStart = null; lineEnd = null; refresh(); }
    });
    const anchor = button('', () => lineTap(tick));
    anchor.className = 'duration-anchor';
    anchor.setAttribute('aria-label', `Duration line anchor at ${positionLabel(tick)}`);
    anchor.setAttribute('aria-describedby', 'line-instructions');
    anchor.style.left = `${tickX(tick)}%`;
    anchors.push(anchor);
    slots.push(slot); counts.append(slot);
  }
  counts.append(...anchors);
}
answerArea.addEventListener('keydown', event => {
  if (event.key === 'Escape') { lineStart = null; lineEnd = null; refresh(); }
});
answerArea.append(counts, lines, preview); measure.append(notation, answerArea); score.append(measure);
const keypad = el('div', 'keypad'); keypad.setAttribute('role', 'group'); keypad.setAttribute('aria-label', 'Symbol keypad');
for (const symbol of alphabet) keypad.append(button(symbol, () => put(symbol)));
keypad.append(button('Erase', () => put('')));
const restButton = button('( ) Rest', toggleRest); restButton.setAttribute('aria-pressed', 'false');
keypad.append(restButton);
const lineButton = button('Start duration line', () => {
  if (lineStart !== null || lineEnd !== null) { lineStart = null; lineEnd = null; }
  else lineStart = selected;
  refresh();
});
const lineHelp = el('p', 'instructions', 'Click or tap a duration-line dot at the note onset (for example, 1), then another dot to finish the line. Escape cancels. To change its length, use Shorten / Lengthen below, or Set end and tap a position. You can also drag the endpoint dots. Scroll the measure sideways on small screens; keyboard handles use ← →.');
lineHelp.id = 'line-instructions';
const lineControls = el('div', 'line-controls');
const feedback = el('section', 'feedback'); feedback.setAttribute('aria-label', 'Answer feedback'); feedback.setAttribute('aria-live', 'polite');
const actions = el('div', 'actions');
const check = button('Check', () => { result = evaluate(fixture, answer, dottedConvention); changed = false; refresh(); }, true);
const resetButton = button('Reset answer', () => reset(true));
actions.append(check, resetButton);
card.append(field('Review fixture', picker), conventionField, score, instructions, live, keypad, lineButton, lineHelp, lineControls, actions, feedback);
const practiceView = el('section'); practiceView.id = 'practice-view';
practiceView.append(banner, card, el('p', 'footer-note', 'Review entry point only. No saved progress. Fixture switching starts a blank answer.'));
const settings = createSettingsPage({
  placement: value => { presentation = withLinePlacement(presentation, value); refresh(); },
  appearance: value => { presentation = { ...presentation, sustainAppearance: value }; refresh(); },
  fixture: chooseFixture,
  convention: value => { dottedConvention = value; convention.value = value; edit(); },
});
const nav = el('nav', 'rhythm-nav'); nav.setAttribute('aria-label', 'Rhythm pages');
const practiceLink = el('a', 'control', 'Count Writing'); practiceLink.href = '#practice';
const settingsLink = el('a', 'control', 'Settings'); settingsLink.href = '#settings';
nav.append(practiceLink, settingsLink);
main.append(header, nav, practiceView, settings.page);
function showPage(focus = true) {
  const isSettings = location.hash === '#settings';
  practiceView.hidden = isSettings; settings.page.hidden = !isSettings;
  practiceLink.toggleAttribute('aria-current', !isSettings); settingsLink.toggleAttribute('aria-current', isSettings);
  (isSettings ? settingsLink : practiceLink).setAttribute('aria-current', 'page');
  pageTitle.textContent = isSettings ? 'Rhythm settings' : 'Count Writing';
  subtitle.textContent = isSettings ? 'Counting, content, and what comes next.' : 'One measure. Read, write, and revise.';
  document.title = `${isSettings ? 'Rhythm settings' : 'Count Writing'} — tUno prototype`;
  settings.sync(fixture.id, dottedConvention, presentation);
  renderLinePreview();
  if (focus) { pageTitle.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
window.addEventListener('hashchange', () => {
  if (['', '#settings', '#practice'].includes(location.hash)) showPage();
});
app.append(main);
function reset(focus: boolean) {
  grid = countGrid(fixture); answer = blankAnswer(fixture); selected = 0; lineStart = null; lineEnd = null; result = null; changed = false;
  renderSlots(); notation.replaceChildren(renderMeasure(fixture)); renderLines(); refresh();
  if (focus) focusSlot(0);
}
function refresh() {
  answerArea.dataset.placement = presentation.linePlacement;
  answerArea.dataset.appearance = presentation.sustainAppearance;
  settings.sync(fixture.id, dottedConvention, presentation);
  answerArea.classList.toggle('line-selecting', lineStart !== null || lineEnd !== null);
  anchors.forEach((anchor, tick) => anchor.setAttribute('aria-pressed', String(lineStart === tick)));
  conventionField.hidden = !grid.slots.some(s => s.dottedInternal);
  slots.forEach((slot, tick) => {
    const symbol = answer.symbols[tick]!;
    slot.textContent = answer.rests[tick] ? `(${symbol || '·'})` : symbol || '·';
    slot.setAttribute('aria-label', `${positionLabel(tick)}, ${symbol || 'empty'}${answer.rests[tick] ? ', parenthesized' : ''}`);
    slot.setAttribute('aria-pressed', String(selected === tick));
    slot.classList.toggle('sustained', answer.spans.some(s => tick > s.start && tick <= s.end));
    slot.classList.toggle('line-pending', lineStart === tick);
  });
  live.textContent = lineStart === null ? `Selected: ${positionLabel(selected)}.` : `Line starts at ${positionLabel(lineStart)}. Select the last covered position; Escape cancels.`;
  if (lineEnd !== null) live.textContent = `Changing line ${lineEnd + 1}: tap its new ending position. Escape cancels.`;
  lineButton.textContent = lineStart === null && lineEnd === null ? 'Start duration line' : 'Cancel duration line';
  restButton.setAttribute('aria-pressed', String(answer.rests[selected]));
  renderFeedback();
  renderLinePreview();
}
function renderFeedback() {
  feedback.replaceChildren();
  if (!result) return;
  feedback.append(el('p', '', changed ? 'Answer edited. Check again for updated feedback.' : 'Your answer is kept. Edit any position or marking, then check again.'));
  for (const [key, label] of [['counts', 'Count symbols'], ['spans', 'Duration lines'], ['rests', 'Rest parentheses']] as const) {
    const dimension = result[key];
    const block = el('div', `dimension ${dimension.verdict}`);
    block.append(el('strong', '', `${label}: ${dimension.verdict === 'correct' ? 'Matches trial convention' : dimension.verdict === 'revise' ? 'Needs correction' : 'Teacher review'}`));
    if (dimension.issues.length) { const list = el('ul'); dimension.issues.forEach(issue => list.append(el('li', '', issue))); block.append(list); }
    feedback.append(block);
  }
}
function renderLines() {
  lines.replaceChildren(); lineControls.replaceChildren();
  const lanes: Span[][] = [];
  answer.spans.forEach((span, index) => {
    let lane = lanes.findIndex(items => items.every(s => span.start > s.end || span.end < s.start));
    if (lane < 0) { lane = lanes.length; lanes.push([]); }
    lanes[lane]!.push(span);
    const track = el('div', 'duration-line');
    track.style.left = `${tickX(span.start)}%`;
    track.style.width = `${tickX(span.end) - tickX(span.start)}%`;
    track.style.top = `calc(var(--anchor-y) + ${lane * 44}px)`;
    for (const endpoint of ['start', 'end'] as const) {
      const handle = el('button', `line-handle ${endpoint}`); handle.type = 'button';
      handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', `Line ${index + 1} ${endpoint}`);
      handle.setAttribute('aria-valuemin', String(endpoint === 'start' ? 0 : span.start));
      handle.setAttribute('aria-valuemax', String(endpoint === 'start' ? span.end : grid.slots.length - 1));
      const update = (isEdit = true) => {
        handle.setAttribute('aria-valuenow', String(span[endpoint]));
        handle.setAttribute('aria-valuetext', positionLabel(span[endpoint]));
        track.style.left = `${tickX(span.start)}%`; track.style.width = `${tickX(span.end) - tickX(span.start)}%`;
        handle.setAttribute('aria-valuemin', String(endpoint === 'start' ? 0 : span.start));
        handle.setAttribute('aria-valuemax', String(endpoint === 'start' ? span.end : grid.slots.length - 1));
        const input = lineControls.querySelector<HTMLSelectElement>(`[aria-label="Line ${index + 1} ${endpoint} position"]`);
        if (input) input.value = String(span[endpoint]);
        const panel = lineControls.children[index];
        const heading = panel?.querySelector('.line-title');
        if (heading) heading.textContent = `Line ${index + 1} · ends at ${positionLabel(span.end)}`;
        const lengthButtons = panel?.querySelectorAll<HTMLButtonElement>('.line-touch-controls button');
        if (lengthButtons) { lengthButtons[0]!.disabled = span.end === span.start; lengthButtons[1]!.disabled = span.end === grid.slots.length - 1; }
        track.querySelectorAll<HTMLElement>('.line-handle').forEach(other => {
          const side = other.classList.contains('start') ? 'start' : 'end';
          other.setAttribute('aria-valuemin', String(side === 'start' ? 0 : span.start));
          other.setAttribute('aria-valuemax', String(side === 'start' ? span.end : grid.slots.length - 1));
        });
        if (isEdit) edit();
      };
      update(false);
      let dragging = false, moved = false, original: Span;
      let pointerX = 0, pointerY = 0;
      handle.addEventListener('pointerdown', event => {
        dragging = true; moved = false; pointerX = event.clientX; pointerY = event.clientY; original = { ...span }; handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', event => {
        if (!dragging) return;
        moved ||= Math.hypot(event.clientX - pointerX, event.clientY - pointerY) > 4;
        if (!moved) return;
        const rect = measure.getBoundingClientRect();
        const anchorOffset = parseFloat(getComputedStyle(answerArea).getPropertyValue('--anchor-x'));
        const tick = Math.round(((event.clientX - rect.left - anchorOffset) / rect.width * 100 - 16) / (88 / grid.slots.length));
        span[endpoint] = Math.max(endpoint === 'start' ? 0 : span.start, Math.min(endpoint === 'start' ? span.end : grid.slots.length - 1, tick));
        update();
      });
      handle.addEventListener('pointerup', () => { dragging = false; });
      handle.addEventListener('click', () => { if (!moved) lineTap(span[endpoint]); });
      handle.addEventListener('pointercancel', () => { dragging = false; moved = true; Object.assign(span, original); update(false); refresh(); });
      handle.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const min = endpoint === 'start' ? 0 : span.start, max = endpoint === 'start' ? span.end : grid.slots.length - 1;
        span[endpoint] = event.key === 'Home' ? min : event.key === 'End' ? max : Math.max(min, Math.min(max, span[endpoint] + (event.key === 'ArrowLeft' ? -1 : 1)));
        update();
      });
      track.append(handle);
    }
    lines.append(track);
    const control = el('div', 'line-edit');
    control.append(el('strong', 'line-title', `Line ${index + 1} · ends at ${positionLabel(span.end)}`));
    const touchControls = el('div', 'line-touch-controls');
    const changeLength = (delta: number, name: string) => {
      span.end = Math.max(span.start, Math.min(grid.slots.length - 1, span.end + delta));
      edit(); renderLines();
      const next = [...lineControls.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === name && !b.disabled);
      if (next) next.focus({ preventScroll: true });
      else lineControls.querySelector<HTMLSelectElement>(`[aria-label="Line ${index + 1} end position"]`)?.focus({ preventScroll: true });
    };
    const shorter = button(`Shorten line ${index + 1}`, () => changeLength(-1, `Shorten line ${index + 1}`));
    const longer = button(`Lengthen line ${index + 1}`, () => changeLength(1, `Lengthen line ${index + 1}`));
    shorter.disabled = span.end === span.start; longer.disabled = span.end === grid.slots.length - 1;
    const setEnd = button(`Set line ${index + 1} end`, () => {
      lineStart = null; lineEnd = index; refresh();
      score.scrollIntoView({ block: 'nearest' });
    });
    touchControls.append(shorter, longer, setEnd); control.append(touchControls);
    for (const endpoint of ['start', 'end'] as const) {
      const input = select(Array.from({ length: grid.slots.length }, (_, tick) => ({ value: tick, label: positionLabel(tick) })), value => {
        span[endpoint] = Number(value);
        if (span.start > span.end) span[endpoint === 'start' ? 'end' : 'start'] = span[endpoint];
        edit(); renderLines();
        lineControls.querySelector<HTMLSelectElement>(`[aria-label="Line ${index + 1} ${endpoint} position"]`)?.focus();
      });
      input.value = String(span[endpoint]);
      control.append(field(`Line ${index + 1} ${endpoint} position`, input));
    }
    control.append(button(`Remove line ${index + 1}`, () => { answer.spans.splice(index, 1); lineEnd = null; edit(); renderLines(); lineButton.focus(); }));
    lineControls.append(control);
  });
  answerArea.style.paddingBottom = `${Math.max(0, lanes.length - 1) * 44}px`;
}
reset(false);
showPage(false);
