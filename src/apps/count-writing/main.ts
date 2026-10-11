// Copyright (C) 2026 tUno contributors. SPDX-License-Identifier: GPL-3.0-only
import '../../tokens.css';
import '../../shared/ui/fonts.css';
import './styles.css';
import uno from '../../assets/uno-happy.svg';
import { button, el, field, select } from '../../shared/ui/components.ts';
import { countWritingFixtures } from './fixtures.ts';
import { countGrid, durationEndSlot, slotX } from './grid.ts';
import { blankAnswer, evaluate } from './evaluation.ts';
import type { CountSymbol, DottedQuarterConvention, Evaluation, Span } from './evaluation.ts';
import { renderMeasure } from './notation.ts';
import { countKey, displayCount } from './input.ts';
import type { OffbeatSymbol } from './input.ts';
import { createCountPopover } from './count-popover.ts';
import { createSettingsPage, dottedConventionOptions } from './settings.ts';
import { defaultPresentation, withLinePlacement } from './presentation.ts';

let offbeat: OffbeatSymbol = '&';
let presentation = { ...defaultPresentation };
let fixture = countWritingFixtures[0]!;
let grid = countGrid(fixture);
let answer = blankAnswer(fixture);
const positionLabel = (slot: number) => grid.slots[slot]!.label;
const tickX = (slot: number) => slotX(slot, grid.slots.length);
let selected = 0;
let focusNewRhythm = false;
let lineStart: number | null = null;
let lineEnd: number | null = null;
let keyboardLine: (Span & { editing?: number }) | null = null;
let restStart: number | null = null;
let restDraft: Span | null = null;
let hoveredRest: number | null = null;
let mouseEntry = false;
let ghostTick = 0;
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
  picker.value = id;
  focusNewRhythm = Boolean(practiceView.hidden);
  reset(!practiceView.hidden);
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
const restMarks = el('div', 'rest-marks');
const restTargets = el('div', 'rest-targets');
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
  anchors.forEach((anchor, tick) => anchor.classList.toggle('duration-target', visible && start !== null && tick > start));
  if (!visible) return;
  const area = answerArea.getBoundingClientRect();
  const anchor = anchors[start]!.getBoundingClientRect();
  const x = anchor.x + anchor.width / 2 - area.x;
  const y = anchor.y + anchor.height / 2 - area.y;
  // Reuse the rendered anchor spacing, including placement offsets and responsive widths.
  const next = grid.availableSlots.find(tick => tick > start);
  const spacing = (next === undefined ? 88 / grid.slots.length : tickX(next) - tickX(start)) / 100 * area.width;
  const endX = keyboardLine ? tickX(durationEndSlot(grid, keyboardLine.end)) / 100 * area.width : previewCursor ? previewCursor.x - area.x : Math.min(x + spacing * .85, area.width - 4);
  const endY = !keyboardLine && previewCursor ? previewCursor.y - area.y : y;
  for (const [name, value] of Object.entries({ x1: x, y1: y, x2: endX, y2: endY })) {
    previewLine.setAttribute(name, String(value));
  }
}
function trackPreviewPointer(event: PointerEvent) {
  const mouse = event.pointerType === 'mouse';
  if (mouseEntry !== mouse) { mouseEntry = mouse; if (!mouse) hoveredRest = null; renderRestTargets(); }
  previewCursor = event.pointerType === 'mouse' ? { x: event.clientX, y: event.clientY } : null;
  renderLinePreview();
}
document.addEventListener('pointerdown', trackPreviewPointer, true);
document.addEventListener('pointermove', trackPreviewPointer);
document.addEventListener('keydown', () => { mouseEntry = false; hoveredRest = null; previewCursor = null; renderLinePreview(); renderRestTargets(); });
document.addEventListener('scroll', renderLinePreview, true);
new ResizeObserver(() => { renderLinePreview(); renderRestMarks(); }).observe(answerArea);

const slots: HTMLButtonElement[] = [];
const anchors: HTMLButtonElement[] = [];
const restClosers: HTMLButtonElement[] = [];
const restOpener = button('(', () => beginRest(ghostTick));
restOpener.className = 'rest-target rest-opening';
restTargets.append(restOpener);
restOpener.addEventListener('pointerenter', event => {
  if (event.pointerType === 'mouse') { hoveredRest = ghostTick; renderRestTargets(); }
});
restOpener.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse' && !slots.includes(event.relatedTarget as HTMLButtonElement)) { hoveredRest = null; renderRestTargets(); }
});
const live = el('p', 'sr-only'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
function edit() { if (result) changed = true; refresh(); }
function nearestSlot(index: number, min = 0, max = grid.slots.length - 1) {
  const candidates = grid.availableSlots.filter(tick => tick >= min && tick <= max);
  return candidates.reduce((best, tick) => Math.abs(tick - index) < Math.abs(best - index) ? tick : best, candidates[0]!);
}
function adjacentSlot(index: number, delta: number, min = 0, max = grid.slots.length - 1) {
  const candidates = grid.availableSlots.filter(tick => tick >= min && tick <= max);
  const next = candidates.indexOf(index) + delta;
  return candidates[Math.max(0, Math.min(candidates.length - 1, next))]!;
}
function focusSlot(index: number) { selected = nearestSlot(index); refresh(); slots[selected]!.focus({ preventScroll: true }); slots[selected]!.scrollIntoView({ block: 'nearest', inline: 'nearest' }); if (selected === 0) score.scrollLeft = 0; }
function put(symbol: CountSymbol) { answer.symbols[selected] = symbol; edit(); }
function submitCount(symbol: CountSymbol): boolean {
  put(symbol);
  const next = grid.availableSlots.find(tick => tick > selected);
  if (next === undefined) { slots[selected]!.focus({ preventScroll: true }); return false; }
  focusSlot(next); return true;
}
const countPopover = createCountPopover({
  select: tick => { selected = tick; refresh(); slots[tick]!.focus({ preventScroll: true }); },
  label: () => `Count for ${positionLabel(selected)}`,
  anchor: () => {
    const bounds = slots[selected]!.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.bottom };
  },
  focus: () => slots[selected]!.focus({ preventScroll: true }),
  submit: submitCount,
  display: symbol => displayCount(symbol, offbeat),
  keydown: countNavigation,
});
function cancelKeyboardLine() {
  if (!keyboardLine) return;
  keyboardLine = null; lineStart = null; refresh();
}
function startKeyboardLine() {
  if (restStart !== null || lineStart !== null || lineEnd !== null) return;
  const index = answer.spans.findIndex(span => selected >= span.start && selected <= span.end);
  keyboardLine = index < 0 ? { start: selected, end: selected } : { start: answer.spans[index]!.start, end: durationEndCount(answer.spans[index]!.end), editing: index };
  lineStart = keyboardLine.start; previewCursor = null; refresh();
}
document.addEventListener('keyup', event => {
  if (event.key !== 'Shift' || !keyboardLine) return;
  const span = keyboardLine;
  keyboardLine = null; lineStart = null;
  if (span.editing !== undefined || span.end > span.start) { storeDuration({ start: span.start, end: durationEndSlot(grid, span.end) }, span.editing); edit(); renderLines(); }
  else refresh();
});
window.addEventListener('blur', cancelKeyboardLine);
document.addEventListener('pointerdown', cancelKeyboardLine, true);
function countNavigation(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) { cancelKeyboardLine(); return false; }
  if (event.key === 'Enter' && keyboardLine) { event.preventDefault(); return true; }
  if (event.key === 'Shift') { if (!event.repeat) startKeyboardLine(); return true; }
  const arrow = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
  if (arrow && event.shiftKey && restStart === null) {
    if (!keyboardLine) startKeyboardLine();
    if (keyboardLine) {
      event.preventDefault(); countPopover.dismiss(true);
      keyboardLine.end = adjacentSlot(keyboardLine.end, event.key === 'ArrowLeft' ? -1 : 1, keyboardLine.start, durationLimit(keyboardLine.start, keyboardLine.editing));
      refresh(); return true;
    }
  }
  cancelKeyboardLine(); // Shift+Tab and shifted symbols retain their normal behavior.
  if (event.key === '(') { event.preventDefault(); if (!event.repeat) beginRest(); return true; }
  if ((event.key === 'Enter' || event.key === ')') && restStart !== null) { event.preventDefault(); closeRest(selected); return true; }
  if (event.key === 'Enter' && slots.includes(event.target as HTMLButtonElement)) {
    event.preventDefault();
    if (lineStart !== null || lineEnd !== null) lineTap(selected);
    else evaluateAnswer();
    return true;
  }
  if (arrow && restStart !== null) {
    event.preventDefault();
    const max = Math.min(grid.slots.length - 1, ...answer.rests.filter(group => group.start > restStart!).map(group => group.start - 1));
    focusSlot(adjacentSlot(selected, event.key === 'ArrowLeft' ? -1 : 1, restStart, max));
    return true;
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    if (event.key === 'Backspace' && !answer.symbols[selected]) focusSlot(adjacentSlot(selected, -1));
    put(''); slots[selected]!.focus({ preventScroll: true }); countPopover.update();
    return true;
  }
  if (event.key === 'Tab' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const next = adjacentSlot(selected, event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1);
    // Preserve a way out of the editor instead of trapping keyboard focus.
    if (event.key === 'Tab' && next === selected) { countPopover.dismiss(); slots[selected]!.focus({ preventScroll: true }); return false; }
    event.preventDefault(); focusSlot(next); countPopover.update(); return true;
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault(); focusSlot(event.key === 'Home' ? 0 : grid.slots.length - 1); countPopover.update(); return true;
  }
  return false;
}
function activateCount(tick: number, event: MouseEvent) {
  if (countPopover.consumeClick(event)) return;
  if (lineStart !== null || lineEnd !== null) { lineTap(tick); return; }
  const bounds = slots[tick]!.getBoundingClientRect();
  countPopover.open(tick, event.detail ? { x: event.clientX, y: event.clientY } : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
}
function beginRest(tick = selected) {
  cancelKeyboardLine();
  countPopover.dismiss();
  lineStart = null; lineEnd = null;
  if (restStart === tick) { restStart = null; restDraft = null; refresh(); return; }
  const group = answer.rests.find(r => tick >= r.start && tick <= r.end);
  if (group) return; // Existing groups expose their own opening; never offer nested groups.
  selected = tick; restStart = tick; restDraft = null;
  refresh();
}
function editRest(group: Span) {
  countPopover.dismiss();
  answer.rests = answer.rests.filter(r => r !== group);
  selected = group.start; restStart = group.start; restDraft = { ...group };
  lineStart = null; lineEnd = null; edit();
}
function removeRest(group: Span) {
  answer.rests = answer.rests.filter(r => r !== group);
  restStart = null; restDraft = null; edit();
}
function removeOpenRest() { restStart = null; restDraft = null; refresh(); }
function closeRest(tick: number) {
  if (!grid.slots[tick]?.available || restStart === null || tick < restStart || answer.rests.some(r => r.start <= tick && r.end >= restStart!)) return;
  const group = { start: restStart, end: tick };
  answer.rests.push(group);
  restStart = null; restDraft = null; selected = tick; edit();
  slots[tick]!.focus({ preventScroll: true });
}
function durationLimit(start: number, editing?: number) {
  return Math.min(grid.slots.length - 1, ...answer.spans.flatMap((span, index) => index !== editing && span.start > start ? [span.start - 1] : []));
}
function storeDuration(span: Span, editing?: number) {
  // Keep one duration line at each covered position, including implied subdivisions.
  span.end = Math.min(span.end, durationLimit(span.start, editing));
  const duplicate = answer.spans.findIndex((other, index) => index !== editing && span.start >= other.start && span.start <= other.end);
  if (duplicate >= 0) { answer.spans[duplicate]!.end = Math.min(span.end, durationLimit(answer.spans[duplicate]!.start, duplicate)); return; }
  if (editing === undefined) answer.spans.push(span);
  else answer.spans[editing] = span;
}
function editDuration(index: number, tick = durationEndCount(answer.spans[index]!.end)) {
  countPopover.dismiss(); lineStart = null; restStart = null; restDraft = null;
  lineEnd = index; focusSlot(tick);
}
function removeDuration(index: number) {
  const start = answer.spans[index]!.start;
  answer.spans.splice(index, 1); keyboardLine = null; lineStart = null; lineEnd = null;
  countPopover.dismiss(); edit(); renderLines(); focusSlot(start);
}
function lineTap(tick: number) {
  if (!grid.slots[tick]?.available) return;
  countPopover.dismiss();
  restStart = null; restDraft = null;
  selected = nearestSlot(tick);
  if (lineEnd !== null) {
    const span = answer.spans[lineEnd]!;
    storeDuration({ start: span.start, end: Math.max(span.start, durationEndSlot(grid, tick)) }, lineEnd); lineEnd = null;
    edit(); renderLines();
  } else if (lineStart === null) {
    const index = answer.spans.findIndex(span => tick >= span.start && tick <= span.end);
    if (index >= 0) {
      if (tick === answer.spans[index]!.start) removeDuration(index);
      else editDuration(index, tick);
    } else { lineStart = tick; refresh(); }
  }
  else if (lineStart !== tick) {
    storeDuration({ start: Math.min(lineStart, tick), end: durationEndSlot(grid, Math.max(lineStart, tick)) });
    lineStart = null; edit(); renderLines();
  }
}
function renderSlots() {
  slots.length = 0; anchors.length = 0; restClosers.length = 0; counts.replaceChildren(); restTargets.replaceChildren(restOpener);
  for (let tick = 0; tick < grid.slots.length; tick++) {
    const slot = button('');
    slot.addEventListener('click', event => activateCount(tick, event));
    slot.addEventListener('pointerdown', event => {
      if (lineStart === null && lineEnd === null) countPopover.startPointer(event, tick);
    });
    slot.setAttribute('aria-haspopup', 'dialog'); slot.setAttribute('aria-controls', 'count-popover');
    slot.hidden = !grid.slots[tick]!.available;
    slot.className = 'count-slot'; slot.style.left = `${tickX(tick)}%`;
    slot.addEventListener('focus', () => { selected = tick; refresh(); });
    slot.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') { hoveredRest = tick; renderRestTargets(); }
    });
    slot.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse' && event.relatedTarget !== restOpener) { hoveredRest = null; renderRestTargets(); }
    });
    slot.addEventListener('keydown', event => {
      if (countNavigation(event)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const symbol = countKey(event.key);
      if (symbol !== null) { event.preventDefault(); if (!event.repeat) countPopover.submit(symbol); }
      else if (event.key === ')') { event.preventDefault(); closeRest(selected); }
      else if (event.key === 'Escape') { countPopover.dismiss(); lineStart = null; lineEnd = null; restStart = null; restDraft = null; refresh(); }
    });
    const anchor = button('', () => lineTap(tick));
    anchor.hidden = !grid.slots[tick]!.available;
    anchor.className = 'duration-anchor';
    anchor.setAttribute('aria-label', `Duration line anchor at ${positionLabel(tick)}`);
    anchor.style.left = `${tickX(tick)}%`;
    anchors.push(anchor);
    slots.push(slot); counts.append(slot);
    const closer = button(')', () => closeRest(tick));
    closer.className = 'rest-target rest-closing';
    closer.setAttribute('aria-label', `Close rest parentheses at ${positionLabel(tick)}`);
    restClosers.push(closer); restTargets.append(closer);
  }
  counts.append(...anchors);
}
answerArea.addEventListener('keydown', event => {
  if (event.key === 'Escape') { lineStart = null; lineEnd = null; restStart = null; restDraft = null; refresh(); }
});
answerArea.append(counts, lines, restMarks, restTargets, preview); measure.append(notation, answerArea); score.append(measure);
const feedback = el('section', 'feedback'); feedback.setAttribute('aria-label', 'Answer feedback'); feedback.setAttribute('aria-live', 'polite');
const actions = el('div', 'actions');
function evaluateAnswer() { countPopover.dismiss(); result = evaluate(fixture, answer, dottedConvention); changed = false; refresh(); }
const check = button('Check', evaluateAnswer, true);
const resetButton = button('Reset answer', () => reset(true));
actions.append(check, resetButton);
card.append(field('Review fixture', picker), conventionField, score, live, actions, feedback);
const practiceView = el('section'); practiceView.id = 'practice-view';
practiceView.append(banner, card, el('p', 'footer-note', 'Review entry point only. No saved progress. Fixture switching starts a blank answer.'));
const settings = createSettingsPage({
  offbeat: value => {
    offbeat = value;
    banner.textContent = `Working prototype · Open entry · 4/4 · “${value}” offbeats. Counting conventions and duration-line endpoints are provisional.`;
    refresh(); countPopover.update();
  },
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
  cancelKeyboardLine();
  countPopover.dismiss();
  const isSettings = location.hash === '#settings';
  practiceView.hidden = isSettings; settings.page.hidden = !isSettings;
  practiceLink.toggleAttribute('aria-current', !isSettings); settingsLink.toggleAttribute('aria-current', isSettings);
  (isSettings ? settingsLink : practiceLink).setAttribute('aria-current', 'page');
  pageTitle.textContent = isSettings ? 'Rhythm settings' : 'Count Writing';
  subtitle.textContent = isSettings ? 'Counting, content, and what comes next.' : 'One measure. Read, write, and revise.';
  document.title = `${isSettings ? 'Rhythm settings' : 'Count Writing'} — tUno prototype`;
  settings.sync(fixture.id, dottedConvention, presentation, offbeat);
  renderLinePreview(); renderRestMarks();
  if (!isSettings && focusNewRhythm) { focusNewRhythm = false; focusSlot(grid.availableSlots[0]!); }
  else if (focus) { pageTitle.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
window.addEventListener('hashchange', () => {
  if (['', '#settings', '#practice'].includes(location.hash)) showPage();
});
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey || event.repeat || practiceView.hidden) return;
  const target = event.target as Element;
  // Native controls and popover choices keep their own Enter action.
  if (target.closest('button, a, input, select, textarea, [role="button"], [contenteditable], .count-popover')) return;
  if (restStart !== null || lineStart !== null || lineEnd !== null || keyboardLine) return;
  event.preventDefault(); evaluateAnswer();
});
app.append(main);
function reset(focus: boolean) {
  countPopover.dismiss();
  keyboardLine = null;
  grid = countGrid(fixture); answer = blankAnswer(fixture); selected = 0; hoveredRest = null; lineStart = null; lineEnd = null; restStart = null; restDraft = null; result = null; changed = false;
  renderSlots(); notation.replaceChildren(renderMeasure(fixture));
  notation.querySelectorAll<SVGGElement>('g[data-start]').forEach(mark => {
    const tick = Number(mark.dataset.start);
    const bounds = mark.getBBox();
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hit.setAttribute('x', String(bounds.x - 8)); hit.setAttribute('y', String(bounds.y - 8));
    hit.setAttribute('width', String(Math.max(44, bounds.width + 16))); hit.setAttribute('height', String(Math.max(44, bounds.height + 16)));
    hit.setAttribute('fill', 'transparent'); hit.setAttribute('pointer-events', 'all');
    mark.prepend(hit);
    mark.setAttribute('role', 'button'); mark.setAttribute('tabindex', '0');
    mark.setAttribute('aria-label', `Enter count at ${positionLabel(tick)}`);
    mark.setAttribute('aria-haspopup', 'dialog'); mark.setAttribute('aria-controls', 'count-popover');
    mark.addEventListener('click', event => activateCount(tick, event));
    mark.addEventListener('pointerdown', event => {
      if (lineStart === null && lineEnd === null) countPopover.startPointer(event, tick);
    });
    mark.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); mark.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });
  }); renderLines(); refresh();
  if (focus) focusSlot(0);
}
function refresh() {
  answerArea.dataset.placement = presentation.linePlacement;
  answerArea.dataset.appearance = presentation.sustainAppearance;
  settings.sync(fixture.id, dottedConvention, presentation, offbeat);
  answerArea.classList.toggle('line-selecting', lineStart !== null || lineEnd !== null);
  anchors.forEach((anchor, tick) => anchor.setAttribute('aria-pressed', String(lineStart === tick)));
  conventionField.hidden = !grid.slots.some(s => s.dottedInternal);
  slots.forEach((slot, tick) => {
    const symbol = displayCount(answer.symbols[tick]!, offbeat);
    slot.textContent = symbol || '·';
    slot.setAttribute('aria-label', `${positionLabel(tick)}, ${symbol || 'empty'}${answer.rests.some(r => tick >= r.start && tick <= r.end) ? ', parenthesized' : ''}`);
    slot.setAttribute('aria-pressed', String(selected === tick));
    slot.classList.toggle('sustained', answer.spans.some(s => tick > s.start && tick <= s.end));
    slot.classList.toggle('line-pending', lineStart === tick);
  });
  live.textContent = lineStart === null ? `Selected: ${positionLabel(selected)}.` : `Line starts at ${positionLabel(lineStart)}. Select the last covered position; Escape cancels.`;
  if (keyboardLine) live.textContent = `Duration line from ${positionLabel(keyboardLine.start)} to ${positionLabel(keyboardLine.end)}. Use Shift+arrows; release Shift to finish. Escape cancels.`;
  if (lineEnd !== null) live.textContent = `Changing line ${lineEnd + 1}: tap its new ending position. Escape cancels.`;
  if (restStart !== null) live.textContent = `Rest parentheses start at ${positionLabel(restStart)}. Arrows choose the closing parenthesis at ${positionLabel(selected)}; Enter closes it. Escape cancels.`;
  countPopover.update();
  renderRestMarks();
  renderFeedback();
  renderLinePreview();
}
function renderRestTargets() {
  if (!slots.length || practiceView.hidden) return;
  const area = answerArea.getBoundingClientRect();
  const positionTarget = (target: HTMLElement, tick: number) => {
    target.style.left = `${tickX(tick)}%`;
    target.style.top = `${slots[tick]!.getBoundingClientRect().top - area.top}px`;
  };
  const opening = restStart ?? hoveredRest ?? selected;
  ghostTick = opening;
  positionTarget(restOpener, opening);
  const inGroup = answer.rests.some(r => opening >= r.start && opening <= r.end);
  restOpener.hidden = inGroup || restDraft !== null || (mouseEntry && hoveredRest === null && restStart === null);
  restOpener.setAttribute('aria-label', `${restStart === null ? 'Start' : 'Remove open'} rest parentheses at ${positionLabel(opening)}`);
  restOpener.setAttribute('aria-pressed', String(restStart !== null));
  restOpener.classList.toggle('rest-pending', restStart !== null);
  restClosers.forEach((closer, tick) => {
    const overlaps = restStart !== null && answer.rests.some(r => r.start <= tick && r.end >= restStart!);
    closer.hidden = restStart === null || tick < restStart || !grid.slots[tick]!.available || overlaps;
    closer.classList.toggle('keyboard-target', restStart !== null && tick === selected);
    if (!closer.hidden) positionTarget(closer, tick);
  });
}
function renderRestMarks() {
  if (!slots.length || practiceView.hidden) return;
  renderRestTargets();
  const area = answerArea.getBoundingClientRect();
  restMarks.replaceChildren();
  const drawGroup = (group: Span, pending = false) => {
    const covered = grid.availableSlots.filter(tick => tick >= group.start && tick <= group.end);
    const rectangles = covered.map(tick => slots[tick]!.getBoundingClientRect());
    let left = Math.min(...rectangles.map(r => r.left)) - area.left - 16;
    let right = Math.max(...rectangles.map(r => r.right)) - area.left + 16;
    let top = Math.min(...rectangles.map(r => r.top)) - area.top - 4;
    let bottom = Math.max(...rectangles.map(r => r.bottom)) - area.top + 4;
    answer.spans.forEach((span, index) => {
      if (span.start < group.start || span.start > group.end) return;
      const lastCount = grid.availableSlots.filter(t => t <= span.end).at(-1)!;
      if (lastCount > group.end) return;
      const line = lines.children[index]?.getBoundingClientRect();
      if (!line) return;
      left = Math.min(left, line.left - area.left - 16);
      right = Math.max(right, line.right - area.left + 16);
      top = Math.min(top, line.top - area.top - 12);
      bottom = Math.max(bottom, line.bottom - area.top + 12);
    });
    const outline = el('div', pending ? 'rest-open-group' : 'rest-group');
    outline.dataset.start = String(group.start); outline.dataset.end = String(group.end);
    Object.assign(outline.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    for (const side of (pending ? ['opening'] : ['opening', 'closing'])) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 16 100'); svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true'); svg.classList.add(`rest-${side}`);
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', side === 'opening' ? 'M14 2 Q0 50 14 98' : 'M2 2 Q16 50 2 98');
      svg.append(path);
      const handle = button('', () => side === 'closing' ? editRest(group) : pending ? removeOpenRest() : removeRest(group));
      handle.className = `rest-existing-${side}`;
      handle.title = side === 'closing' ? 'Change the closing position' : 'Remove rest parentheses';
      handle.setAttribute('aria-label', `${side === 'closing' ? 'Edit' : pending ? 'Remove open' : 'Remove'} rest parentheses at ${positionLabel(group.start)}`);
      handle.append(svg); outline.append(handle);
    }
    restMarks.append(outline);
  };
  answer.rests.forEach(group => drawGroup(group));
  if (restDraft) drawGroup(restDraft, true);
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
function durationEndCount(end: number) {
  return grid.availableSlots.filter(tick => tick <= end).at(-1)!;
}
function renderLines() {
  lines.replaceChildren();
  const lanes: Span[][] = [];
  answer.spans.forEach((span, index) => {
    let lane = lanes.findIndex(items => items.every(s => span.start > s.end || span.end < s.start));
    if (lane < 0) { lane = lanes.length; lanes.push([]); }
    lanes[lane]!.push(span);
    const track = el('div', 'duration-line');
    track.style.left = `${tickX(span.start)}%`;
    track.style.width = `${tickX(span.end) - tickX(span.start)}%`;
    track.style.top = `calc(var(--anchor-y) + ${lane * 44}px)`;
    const body = button('', () => editDuration(index));
    body.className = 'duration-body'; body.setAttribute('aria-label', `Edit line ${index + 1} endpoint`); track.append(body);
    for (const endpoint of ['start', 'end'] as const) {
      const handle = el('button', `line-handle ${endpoint}`); handle.type = 'button';
      handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', `Line ${index + 1} ${endpoint}`);
      handle.setAttribute('aria-valuemin', String(endpoint === 'start' ? 0 : span.start));
      handle.setAttribute('aria-valuemax', String(endpoint === 'start' ? span.end : grid.slots.length - 1));
      const update = (isEdit = true) => {
        handle.setAttribute('aria-valuenow', String(span[endpoint]));
        handle.setAttribute('aria-valuetext', positionLabel(endpoint === 'end' ? durationEndCount(span.end) : span.start));
        track.style.left = `${tickX(span.start)}%`; track.style.width = `${tickX(span.end) - tickX(span.start)}%`;
        handle.setAttribute('aria-valuemin', String(endpoint === 'start' ? 0 : span.start));
        handle.setAttribute('aria-valuemax', String(endpoint === 'start' ? span.end : grid.slots.length - 1));
        track.querySelectorAll<HTMLElement>('.line-handle').forEach(other => {
          const side = other.classList.contains('start') ? 'start' : 'end';
          other.setAttribute('aria-valuemin', String(side === 'start' ? 0 : span.start));
          other.setAttribute('aria-valuemax', String(side === 'start' ? span.end : grid.slots.length - 1));
        });
        if (isEdit) edit();
        renderRestMarks();
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
        const minStart = Math.max(0, ...answer.spans.flatMap((other, otherIndex) => otherIndex !== index && other.end < span.start ? [other.end + 1] : []));
        span[endpoint] = endpoint === 'start' ? nearestSlot(tick, minStart, span.end) : durationEndSlot(grid, nearestSlot(tick, span.start, durationLimit(span.start, index)));
        update();
      });
      handle.addEventListener('pointerup', () => { dragging = false; });
      handle.addEventListener('click', () => {
        if (moved) return;
        if (endpoint === 'start') removeDuration(index);
        else editDuration(index);
      });
      handle.addEventListener('pointercancel', () => { dragging = false; moved = true; Object.assign(span, original); update(false); refresh(); });
      handle.addEventListener('keydown', event => {
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault(); removeDuration(index); return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const min = endpoint === 'start' ? Math.max(0, ...answer.spans.flatMap((other, otherIndex) => otherIndex !== index && other.end < span.start ? [other.end + 1] : [])) : span.start, max = endpoint === 'start' ? span.end : durationLimit(span.start, index);
        const current = endpoint === 'start' ? span.start : durationEndCount(span.end);
        const tick = event.key === 'Home' ? min : event.key === 'End' ? nearestSlot(max, min, max) : adjacentSlot(current, event.key === 'ArrowLeft' ? -1 : 1, min, max);
        span[endpoint] = endpoint === 'start' ? tick : durationEndSlot(grid, tick);
        update();
      });
      track.append(handle);
    }
    lines.append(track);

  });
  answerArea.style.paddingBottom = `${Math.max(0, lanes.length - 1) * 44}px`;
  renderRestMarks();
}
reset(false);
showPage(false);
if (!practiceView.hidden) focusSlot(grid.availableSlots[0]!);
