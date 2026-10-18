import { button, el } from '../../shared/ui/components.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { compare, divide, subtract } from '../../music/fraction.ts';
import type { Fraction } from '../../music/fraction.ts';
import type { CountingPlan, CountId } from '../../music/counting/plan.ts';
import { enterToken, toggleUnit } from '../../music/counting/answer.ts';
import type { CountingAnswer, CountingEvaluation, UnitAnswer } from '../../music/counting/answer.ts';
import type { CountToken } from '../../music/counting/vocabulary.ts';
import { renderMeasure, responsiveNotation } from '../rhythm-walk/shared/notation.ts';
import { countGrid, slotX } from './grid.ts';
import { paletteSymbols } from './palette.ts';
import { countKey, displayCount, syllableBuffer } from './input.ts';

/** Project full inferred extents into bars. Pieces contain no student state. */
export function unitPieces(plan: CountingPlan, measure: number) {
  const symbols = plan.symbols.filter(s => s.measure === measure);
  const start = symbols[0]!.start, end = symbols.at(-1)!.end;
  return plan.units.filter(u => compare(u.start, end) < 0 && compare(u.end, start) > 0).map(unit => ({
    unit, start: subtract(compare(unit.start, start) < 0 ? start : unit.start, start),
    end: subtract(compare(unit.end, end) > 0 ? end : unit.end, start),
    continuesBefore: compare(unit.start, start) < 0, continuesAfter: compare(unit.end, end) > 0,
  }));
}

/** Each bar is a view of the same passage plan/answer. No measure-local answers. */
export function createPlanEditor(source: RhythmMeasure, measureIndex: number, options: {
  plan: CountingPlan; answer: () => CountingAnswer; result: () => CountingEvaluation | null;
  change: (answer: CountingAnswer) => void; palette: HTMLElement; activated: () => void;
  hidden: () => boolean; check: () => void; navigate: (id: CountId, delta: number) => void;
  reveal: (target: HTMLElement) => void;
}) {
  const plan = options.plan, prefs = plan.preferences;
  const counts = plan.counts.filter(c => c.measure === measureIndex);
  // Temporary engraving geometry only. Never use the lattice for answers or rule interpretation.
  const grid = countGrid(source);
  const x = (position: Fraction) => { const slot = divide(position, grid.step); return slotX(slot[0] / slot[1], grid.slots.length, grid.fine); };
  const card = el('section', 'passage-measure plan-measure'); card.dataset.measure = String(measureIndex + 1);
  card.classList.toggle('fine-grid', grid.fine); card.setAttribute('aria-label', `Editable measure ${measureIndex + 1}`);
  const heading = el('h2', 'measure-heading', String(measureIndex + 1)); heading.setAttribute('aria-label', `Measure ${measureIndex + 1}`);
  const measure = el('div', 'measure'); const score = el('div', 'measure-editor');
  const parentheses = prefs.includeRests && prefs.restAppearance === 'parentheses';
  // Parentheses enclose the token inside its 44px target. Reserve a 4px
  // gutter between targets instead of empty space for external brackets.
  const restExtent = 22;
  const spacing = counts.slice(1).map((c, i) => {
    const previous = counts[i]!;
    return Math.ceil(100 * 48 / (x(c.localPosition) - x(previous.localPosition)));
  });
  const edgeWidths = parentheses && counts.length
    ? [100 * restExtent / x(counts[0]!.localPosition), 100 * restExtent / (100 - x(counts.at(-1)!.localPosition))]
    : [];
  // Size the entire measure so the passage owns scrolling, not individual bars.
  const minimumWidth = Math.ceil(Math.max(280, ...spacing, ...edgeWidths));
  card.style.setProperty('--count-measure-width', `${minimumWidth}px`);
  const notation = renderMeasure(source, `Measure ${measureIndex + 1}`, { first: measureIndex === 0, last: measureIndex === plan.source.measures.length - 1 });
  const area = el('div', 'answer-area plan-answer'); area.dataset.placement = prefs.linePlacement; area.dataset.appearance = prefs.internalAppearance;
  const positions = el('div', 'counts'); positions.setAttribute('role', 'group'); positions.setAttribute('aria-label', 'Count positions');
  const marks = el('div', 'unit-marks'); marks.setAttribute('aria-hidden', 'true');
  const feedback = el('section', 'feedback'); feedback.setAttribute('aria-label', `Answer feedback measure ${measureIndex + 1}`); feedback.setAttribute('aria-live', 'polite');
  const buffer = syllableBuffer(); let selected: CountId | null = null; let active = false;
  const buttons = new Map<CountId, HTMLButtonElement>();
  function commit(token: CountToken) {
    if (!selected || options.hidden()) return;
    active = true; options.activated();
    buffer.clear(); options.change(enterToken(plan, options.answer(), selected, token));
    options.navigate(selected, 1);
  }
  function toggle(control: keyof UnitAnswer) {
    buffer.clear();
    if (!selected || options.hidden()) return;
    active = true; options.activated();
    if (selected) options.change(toggleUnit(plan, options.answer(), selected, control));
  }
  function key(event: KeyboardEvent) {
    if (options.hidden() || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 'd') { event.preventDefault(); buffer.clear(); if (!event.repeat) toggle(event.key.toLowerCase() === 'r' ? 'restMarked' : 'durationIndicated'); return; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); buffer.clear(); if (selected) options.navigate(selected, event.key === 'ArrowLeft' ? -1 : 1); return; }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); buffer.clear(); const c = event.key === 'Home' ? counts[0] : counts.at(-1); if (c) focusPosition(c.id); return; }
    if (event.key === 'Enter') { event.preventDefault(); options.check(); return; }
    if (event.key === 'Escape') { event.preventDefault(); buffer.clear(); suspend(); return; }
    if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); if (buffer.active()) buffer.clear(); else if (selected) options.change(enterToken(plan, options.answer(), selected, '')); return; }
    if (prefs.vocabulary === 'syllables' && event.key === 't') { event.preventDefault(); buffer.key('t'); status.textContent = 'Type a or e to complete ta or te.'; return; }
    const token = buffer.active() ? buffer.key(event.key) : countKey(event.key);
    if (token !== null) { event.preventDefault(); if (!event.repeat) commit(token); }
  }
  const status = el('p', 'sr-only'); status.setAttribute('role', 'status');
  function palette() {
    if (!active || !selected) return;
    const count = plan.counts.find(c => c.id === selected)!;
    const unit = plan.units.find(u => u.id === count.unitId)!;
    const state = options.answer().units[unit.id]!;
    // Vocabulary choices are entry tools, never inferred requirements.
    const tokens = paletteSymbols(source.meter[0], source.meter[1] === 8, prefs.vocabulary, {
      sixteenths: plan.symbols.some(s => s.source.type === '16th' || s.source.type === 'eighth' && s.source.dots > 0),
      triplets: plan.symbols.some(s => s.source.timeModification !== undefined),
    });
    const title = el('p', 'palette-context', `${count.label.split(', offset')[0]} · arrows move · Enter checks`);
    const row = el('div', 'plan-token-palette');
    tokens.forEach(token => { const b = button(displayCount(token, prefs.offbeat), () => commit(token)); b.setAttribute('aria-label', `Enter ${displayCount(token, prefs.offbeat)}`); row.append(b); });
    const controls = el('div', 'plan-unit-controls');
    for (const [control, name, shortcut, applicable] of [['restMarked', 'Rest', 'r', unit.restApplicable], ['durationIndicated', 'Duration', 'd', unit.durationApplicable]] as const) {
      if (!applicable) continue;
      const b = button(`${name} (${shortcut.toUpperCase()})`, () => { toggle(control); buttons.get(selected!)?.focus({ preventScroll: true }); });
      b.dataset.unitControl = control; b.setAttribute('aria-pressed', String(state[control])); b.setAttribute('aria-keyshortcuts', shortcut); b.setAttribute('aria-label', `${name} for entire unit at ${unit.counts[0]!.label}`); controls.append(b);
    }
    const clear = button('Clear count', () => { if (selected) options.change(enterToken(plan, options.answer(), selected, '')); }); controls.append(clear);
    const restoreFocus = options.palette.contains(options.palette.ownerDocument.activeElement);
    options.palette.replaceChildren(title, row, controls, el('p', 'setting-hint', 'Rest (R) and Duration (D) affect the whole written unit, including tied notes.'));
    // Refresh removes palette buttons. Keep keyboard entry alive, including at
    // the last count where commit has no next position to focus.
    if (restoreFocus) buttons.get(selected)?.focus({ preventScroll: true });
    options.palette.onkeydown = event => {
      // Space/Enter activate the focused palette button normally.
      if (event.key !== 'Enter' && event.key !== ' ') key(event);
    };
  }
  function focusPosition(id: CountId) {
    if (!buttons.has(id) || options.hidden()) return;
    buffer.clear(); selected = id; active = true; options.activated(); refresh();
    const b = buttons.get(id)!; b.focus({ preventScroll: true }); options.reveal(b);
  }
  function suspend() { active = false; buffer.clear(); }
  counts.forEach(count => {
    const b = button('', () => focusPosition(count.id)); b.className = 'count-slot'; b.dataset.countId = count.id; b.dataset.unitId = count.unitId;
    b.style.left = `${x(count.localPosition)}%`; b.setAttribute('aria-keyshortcuts', 'r d');
    b.addEventListener('focus', () => { if (!active || selected !== count.id) { selected = count.id; active = true; options.activated(); refresh(); } options.reveal(b); });
    b.addEventListener('keydown', key); buttons.set(count.id, b); positions.append(b);
  });
  if (!counts.length) positions.append(el('p', 'no-counts', 'No count inputs in this measure.'));
  notation.querySelectorAll<SVGGElement>('g[data-event]').forEach(glyph => {
    const symbol = plan.symbols.find(s => s.measure === measureIndex && s.event === Number(glyph.dataset.event));
    const unit = plan.units.find(u => u.id === symbol?.unitId);
    const target = symbol?.counts[0] ?? unit?.counts.find(c => c.measure === measureIndex) ?? unit?.counts[0];
    if (!target) return;
    glyph.dataset.entryLabel = `Enter ${target.label}`; glyph.setAttribute('aria-label', glyph.dataset.entryLabel); glyph.setAttribute('role', 'button'); glyph.setAttribute('tabindex', '0');
    glyph.addEventListener('click', () => { if (!options.hidden()) options.navigate(target.id, 0); }); glyph.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!options.hidden()) options.navigate(target.id, 0); } });
  });
  area.append(marks, positions); measure.append(notation, area); score.append(measure); card.append(heading, score, status);
  function refresh() {
    const answer = options.answer(), result = options.result();
    counts.forEach(count => {
      const b = buttons.get(count.id)!, unit = plan.units.find(u => u.id === count.unitId)!, state = answer.units[unit.id]!;
      const token = displayCount(answer.counts[count.id]!, prefs.offbeat);
      b.textContent = token || '·'; b.setAttribute('aria-label', `${count.label}, ${token || 'empty'}${state.restMarked ? ', marked as rest' : ''}${state.durationIndicated ? ', duration indicated' : ''}`);
      b.setAttribute('aria-pressed', String(active && selected === count.id));
      b.classList.toggle('sustained', state.durationIndicated && count.id !== unit.counts[0]!.id);
      b.classList.toggle('rest-slashed', state.restMarked && prefs.restAppearance === 'slashes');
      const item = result?.tokens.items.find(i => i.id === count.id); if (item) b.dataset.verdict = item.verdict; else delete b.dataset.verdict;
    });
    marks.replaceChildren();
    unitPieces(plan, measureIndex).forEach(piece => {
      if (piece.unit.counts.at(-1)!.measure < measureIndex) return;
      const continuesAfter = piece.unit.counts.at(-1)!.measure > measureIndex;
      const state = answer.units[piece.unit.id]!;
      const members = counts.filter(c => c.unitId === piece.unit.id);
      const first = members[0], last = members.at(-1);
      const left = piece.continuesBefore ? 2 : x(first?.localPosition ?? piece.start);
      const right = continuesAfter ? 98 : x(last?.localPosition ?? piece.start);
      if (state.durationIndicated && prefs.showDurationLine) {
        const line = el('div', 'inferred-duration'); line.dataset.unitId = piece.unit.id;
        line.dataset.continuesBefore = String(piece.continuesBefore); line.dataset.continuesAfter = String(continuesAfter);
        line.style.left = `${left}%`; line.style.width = `${Math.max(1, right - left)}%`; marks.append(line);
      }
      if (state.restMarked && prefs.restAppearance === 'parentheses') {
        const rest = el('div', 'inferred-rest'); rest.dataset.unitId = piece.unit.id;
        rest.style.left = piece.continuesBefore || !first ? '0%' : `calc(${x(first.localPosition)}% - var(--rest-extent, 40px))`;
        rest.style.right = continuesAfter || !last ? '0%' : `calc(${100 - x(last.localPosition)}% - var(--rest-extent, 40px))`;
        rest.append(el('span', '', piece.continuesBefore ? '⋯' : '('), el('span', '', continuesAfter ? '⋯' : ')')); marks.append(rest);
      }
    });
    feedback.replaceChildren();
    if (result) for (const [dimension, name] of [['tokens', 'Count symbols'], ['rests', 'Rest identification'], ['duration', 'Duration indication']] as const) {
      const items = result[dimension].items.filter(i => i.countIds.some(id => counts.some(c => c.id === id)));
      const applicable = items.filter(i => i.verdict !== 'not-applicable');
      const wrong = applicable.filter(i => i.verdict === 'incorrect');
      const block = el('div', `dimension ${wrong.length ? 'revise' : 'correct'}`);
      block.append(el('strong', '', `Measure ${measureIndex + 1} · ${name}: ${!applicable.length ? 'Not applicable' : wrong.length ? 'Needs correction' : 'Correct'}`));
      if (wrong.length) block.append(el('p', '', wrong.map(i => i.labels.join(', ')).join('; ')));
      feedback.append(block);
    }
    palette();
  }
  const layoutNotation = responsiveNotation(notation);
  const gaps = counts.slice(1).map((c, i) => (x(c.localPosition) - x(counts[i]!.localPosition)) / 100);
  const closest = Math.min(1, ...gaps);
  const layoutObserver = new ResizeObserver(() => {
    const width = measure.getBoundingClientRect().width;
    if (!width) return;
    const desktop = window.matchMedia('(min-width: 1000px)').matches;
    // Compact mouse/keyboard targets share the available subdivision spacing.
    // Touch layouts retain 44px targets and passage-level scrolling.
    const target = desktop ? Math.min(36, width * closest - 1) : 44;
    card.style.setProperty('--count-target-width', `${target}px`);
    card.style.setProperty('--count-font-size', `${Math.min(22, Math.max(10, target * .65))}px`);
    card.style.setProperty('--rest-extent', `${target / 2}px`);
    card.style.setProperty('--rest-bracket-width', `${target * .22}px`);
    layoutNotation(width, .6);
  });
  layoutObserver.observe(measure);
  refresh();
  return { card, feedback, refresh, focusPosition, focus: (last = false) => { const c = last ? counts.at(-1) : counts[0]; if (c) focusPosition(c.id); }, suspend, resume: refresh, destroy: () => { layoutObserver.disconnect(); card.remove(); feedback.remove(); } };
}
