// Copyright (C) 2026 tUno contributors. SPDX-License-Identifier: GPL-3.0-only
import '../../tokens.css';
import '../../shared/ui/fonts.css';
import './styles.css';
import uno from '../../assets/uno-happy.svg';
import { button, el, field, select } from '../../shared/ui/components.ts';
import { countWritingFixtures } from '../../music/measure.ts';
import { alphabet, blankAnswer, evaluate, positionLabel } from './evaluation.ts';
import type { CountSymbol, DottedQuarterConvention, Evaluation, Span } from './evaluation.ts';
import { renderMeasure, tickX } from './notation.ts';

let fixture = countWritingFixtures[0]!;
let answer = blankAnswer();
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
title.append(el('p', 'eyebrow', 'tUno · Teacher review'), el('h1', '', 'Count Writing'), el('p', 'subtitle', 'One measure. Read, write, and revise.'));
header.append(title, mascot);
const banner = el('p', 'review-note', 'Working prototype · Open entry · 4/4 · “&” offbeats. Counting conventions and duration-line endpoints are provisional.');
const picker = select(countWritingFixtures.map(f => ({ value: f.id, label: f.label })), id => {
  fixture = countWritingFixtures.find(f => f.id === id)!;
  reset(false);
});
const convention = select([{ value: 'review', label: 'Teacher review — accept both provisionally' }, { value: 'required', label: 'Require internal &' }, { value: 'optional', label: 'Internal & is optional' }], value => {
  dottedConvention = value as DottedQuarterConvention; edit();
});
const conventionField = field('Dotted-quarter counting convention', convention);
const card = el('section', 'card'); card.setAttribute('aria-label', 'Editable measure');
const score = el('div', 'score-scroll');
const measure = el('div', 'measure');
const notation = el('div');
const counts = el('div', 'counts'); counts.setAttribute('role', 'group'); counts.setAttribute('aria-label', 'Count positions');
const lines = el('div', 'lines'); lines.setAttribute('aria-label', 'Duration lines');
const slots: HTMLButtonElement[] = [];
const live = el('p', 'selection'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
const instructions = el('p', 'instructions', 'Select a position, then type or tap a symbol. ← → move; Backspace/Delete erase; ( or ) toggles parentheses. Tab reaches all controls.');
instructions.id = 'instructions';
function edit() { if (result) changed = true; refresh(); }
function focusSlot(index: number) { selected = Math.max(0, Math.min(7, index)); refresh(); slots[selected]!.focus({ preventScroll: true }); slots[selected]!.scrollIntoView({ block: 'nearest', inline: 'nearest' }); if (selected === 0) score.scrollLeft = 0; }
function put(symbol: CountSymbol) { answer.symbols[selected] = symbol; edit(); }
function toggleRest() { answer.rests[selected] = !answer.rests[selected]; edit(); }
function lineTap(tick: number) {
  if (lineStart === null) { lineStart = tick; refresh(); }
  else {
    answer.spans.push({ start: Math.min(lineStart, tick), end: Math.max(lineStart, tick) });
    lineStart = null; edit(); renderLines();
  }
}
for (let tick = 0; tick < 8; tick++) {
  const slot = button('', () => {
    selected = tick;
    if (lineEnd !== null) {
      const span = answer.spans[lineEnd]!;
      span.end = Math.max(span.start, tick); lineEnd = null;
      edit(); renderLines();
    } else if (lineStart !== null) lineTap(tick); else refresh();
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
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); focusSlot(event.key === 'Home' ? 0 : 7); }
    else if (event.key === 'Escape') { lineStart = null; lineEnd = null; refresh(); }
  });
  slots.push(slot); counts.append(slot);
}
measure.append(notation, counts, lines); score.append(measure);
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
const lineHelp = el('p', 'instructions', 'Start a line at the note onset (for example, 1), then tap its ending position. To change its length, use Shorten / Lengthen below, or Set end and tap a position. You can also drag the endpoint dots. Scroll the measure sideways on small screens; keyboard handles use ← →.');
const lineControls = el('div', 'line-controls');
const feedback = el('section', 'feedback'); feedback.setAttribute('aria-label', 'Answer feedback'); feedback.setAttribute('aria-live', 'polite');
const actions = el('div', 'actions');
const check = button('Check', () => { result = evaluate(fixture, answer, dottedConvention); changed = false; refresh(); }, true);
const resetButton = button('Reset answer', () => reset(true));
actions.append(check, resetButton);
card.append(field('Review fixture', picker), conventionField, score, instructions, live, keypad, lineButton, lineHelp, lineControls, actions, feedback);
main.append(header, banner, card, el('p', 'footer-note', 'Review entry point only. No saved progress. Fixture switching starts a blank answer.'));
app.append(main);
function reset(focus: boolean) {
  answer = blankAnswer(); selected = 0; lineStart = null; lineEnd = null; result = null; changed = false;
  notation.replaceChildren(renderMeasure(fixture)); renderLines(); refresh();
  if (focus) focusSlot(0);
}
function refresh() {
  conventionField.hidden = fixture.id !== 'dotted-quarter';
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
    track.style.width = `${(span.end - span.start) * 11}%`;
    track.style.top = `${lane * 44 + 2}px`;
    for (const endpoint of ['start', 'end'] as const) {
      const handle = el('button', `line-handle ${endpoint}`); handle.type = 'button';
      handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', `Line ${index + 1} ${endpoint}`);
      handle.setAttribute('aria-valuemin', String(endpoint === 'start' ? 0 : span.start));
      handle.setAttribute('aria-valuemax', String(endpoint === 'start' ? span.end : 7));
      const update = (isEdit = true) => {
        handle.setAttribute('aria-valuenow', String(span[endpoint]));
        handle.setAttribute('aria-valuetext', positionLabel(span[endpoint]));
        track.style.left = `${tickX(span.start)}%`; track.style.width = `${(span.end - span.start) * 11}%`;
        handle.setAttribute('aria-valuemin', String(endpoint === 'start' ? 0 : span.start));
        handle.setAttribute('aria-valuemax', String(endpoint === 'start' ? span.end : 7));
        const input = lineControls.querySelector<HTMLSelectElement>(`[aria-label="Line ${index + 1} ${endpoint} position"]`);
        if (input) input.value = String(span[endpoint]);
        const panel = lineControls.children[index];
        const heading = panel?.querySelector('.line-title');
        if (heading) heading.textContent = `Line ${index + 1} · ends at ${positionLabel(span.end)}`;
        const lengthButtons = panel?.querySelectorAll<HTMLButtonElement>('.line-touch-controls button');
        if (lengthButtons) { lengthButtons[0]!.disabled = span.end === span.start; lengthButtons[1]!.disabled = span.end === 7; }
        track.querySelectorAll<HTMLElement>('.line-handle').forEach(other => {
          const side = other.classList.contains('start') ? 'start' : 'end';
          other.setAttribute('aria-valuemin', String(side === 'start' ? 0 : span.start));
          other.setAttribute('aria-valuemax', String(side === 'start' ? span.end : 7));
        });
        if (isEdit) edit();
      };
      update(false);
      let dragging = false, original: Span;
      handle.addEventListener('pointerdown', event => {
        dragging = true; original = { ...span }; handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', event => {
        if (!dragging) return;
        const rect = measure.getBoundingClientRect();
        const tick = Math.round(((event.clientX - rect.left) / rect.width * 100 - 16) / 11);
        span[endpoint] = Math.max(endpoint === 'start' ? 0 : span.start, Math.min(endpoint === 'start' ? span.end : 7, tick));
        update();
      });
      handle.addEventListener('pointerup', () => { dragging = false; });
      handle.addEventListener('pointercancel', () => { dragging = false; Object.assign(span, original); update(false); refresh(); });
      handle.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const min = endpoint === 'start' ? 0 : span.start, max = endpoint === 'start' ? span.end : 7;
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
      span.end = Math.max(span.start, Math.min(7, span.end + delta));
      edit(); renderLines();
      const next = [...lineControls.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === name && !b.disabled);
      if (next) next.focus({ preventScroll: true });
      else lineControls.querySelector<HTMLSelectElement>(`[aria-label="Line ${index + 1} end position"]`)?.focus({ preventScroll: true });
    };
    const shorter = button(`Shorten line ${index + 1}`, () => changeLength(-1, `Shorten line ${index + 1}`));
    const longer = button(`Lengthen line ${index + 1}`, () => changeLength(1, `Lengthen line ${index + 1}`));
    shorter.disabled = span.end === span.start; longer.disabled = span.end === 7;
    const setEnd = button(`Set line ${index + 1} end`, () => {
      lineStart = null; lineEnd = index; refresh();
      score.scrollIntoView({ block: 'nearest' });
    });
    touchControls.append(shorter, longer, setEnd); control.append(touchControls);
    for (const endpoint of ['start', 'end'] as const) {
      const input = select(Array.from({ length: 8 }, (_, tick) => ({ value: tick, label: positionLabel(tick) })), value => {
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
  lines.style.height = `${Math.max(1, lanes.length) * 44}px`;
}
reset(false);
