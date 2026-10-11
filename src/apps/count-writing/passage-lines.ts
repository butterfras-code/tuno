import { button, el, field, select } from '../../shared/ui/components.ts';
import { passageDurationEnd, spanPieces } from './passage.ts';
import type { PassageGrid } from './passage.ts';
import type { Span } from './evaluation.ts';
import type { createMeasureEditor } from './editor.ts';
import { slotX } from './grid.ts';

/** One saved logical span, projected into notation systems only for display. */
export function createPassageLines(root: HTMLElement, grid: PassageGrid, editors: ReturnType<typeof createMeasureEditor>[]) {
  const lifecycle = new AbortController();
  let spans: Span[] = [];
  let draft: (Span & { editing?: number; keyboard?: boolean }) | null = null;
  const label = (position: number) => `measure ${Math.floor(position / 8) + 1}, ${grid.slots[position]!.label}`;
  const controls = el('section', 'passage-line-controls'); controls.setAttribute('aria-label', 'Passage duration line editor');
  const status = el('p', 'setting-hint'); status.setAttribute('role', 'status');
  const choices = grid.available.map(position => ({ value: String(position), label: label(position) }));
  const start = select(choices, value => { if (draft) { draft.start = Number(value); draft.end = Math.max(draft.start, draft.end); } else draft = { start: Number(value), end: Number(value) }; render(); });
  const end = select(choices, value => { if (!draft) draft = { start: Number(start.value), end: Number(value) }; else draft.end = Number(value); render(); });
  const begin = button('Start passage duration line', () => { draft = { start: Number(start.value), end: Number(end.value) }; render(); });
  const save = button('Save duration line', commit);
  const cancel = button('Cancel line edit', () => { draft = null; render(); });
  const remove = button('Remove duration line', () => { if (draft?.editing !== undefined) { spans.splice(draft.editing, 1); editors.forEach(e => e.markEdited()); } draft = null; render(); });
  controls.append(el('p', 'setting-hint', 'Tied chains use one duration line across measures. Tap a start anchor, then its final covered count; or hold Shift and use arrows, then release Shift. Tap an existing line to edit. Escape cancels and keeps the saved answer.'), field('Passage line start', start), field('Passage line end', end), begin, save, cancel, remove, status);
  root.after(controls);
  function commit() {
    if (!draft || draft.end < draft.start) return;
    const span = { start: draft.start, end: passageDurationEnd(grid, draft.end) };
    if (draft.editing === undefined) spans.push(span); else spans[draft.editing] = span;
    draft = null; editors.forEach(e => e.markEdited()); render();
  }
  function positionFor(target: Element) {
    const card = target.closest<HTMLElement>('[data-measure]');
    if (!card) return null;
    const tick = [...card.querySelectorAll('.duration-anchor')].indexOf(target);
    const count = [...card.querySelectorAll('.count-slot')].indexOf(target);
    return (tick < 0 && count < 0) ? null : (Number(card.dataset.measure) - 1) * 8 + Math.max(tick, count);
  }
  function tap(position: number) {
    if (draft) { draft.end = position; commit(); }
    else {
      const editing = spans.findIndex(span => span.start <= position && span.end >= position);
      draft = editing < 0 ? { start: position, end: position } : { ...spans[editing]!, end: lastAvailable(spans[editing]!.end), editing };
      render();
    }
  }
  function lastAvailable(position: number) { return grid.available.filter(p => p <= position).at(-1)!; }
  function move(position: number, delta: number, minimum = 0) {
    const positions = grid.available.filter(p => p >= minimum);
    return positions[Math.max(0, Math.min(positions.length - 1, positions.indexOf(position) + delta))]!;
  }
  root.addEventListener('click', event => {
    const target = event.target as Element;
    const position = positionFor(target);
    if (position === null || (!target.classList.contains('duration-anchor') && !draft)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    editors.forEach(e => e.suspend());
    tap(position);
  }, { capture: true, signal: lifecycle.signal });
  root.addEventListener('pointermove', event => {
    if (!draft || draft.keyboard || event.pointerType !== 'mouse' || !(event.target as Element).closest('.answer-area')) return;
    const nearest = grid.available.reduce((best, position) => {
      const anchor = editors[Math.floor(position / 8)]!.card.querySelectorAll('.duration-anchor')[position % 8]!;
      const bounds = anchor.getBoundingClientRect();
      const distance = Math.hypot(bounds.x + bounds.width / 2 - event.clientX, bounds.y + bounds.height / 2 - event.clientY);
      return distance < best.distance ? { position, distance } : best;
    }, { position: draft.end, distance: Infinity });
    if (nearest.position !== draft.end) { draft.end = nearest.position; render(); }
  }, { signal: lifecycle.signal });
  root.addEventListener('pointerdown', event => {
    if (draft && (event.target as Element).classList.contains('count-slot')) event.stopImmediatePropagation();
  }, { capture: true, signal: lifecycle.signal });
  root.addEventListener('keydown', event => {
    const position = positionFor(event.target as Element);
    if (event.key === 'Escape' && draft) { event.preventDefault(); event.stopImmediatePropagation(); draft = null; render(); return; }
    if (draft?.keyboard && !['Shift', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) { draft = null; render(); }
    if (position === null || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Shift' || (event.shiftKey && ['ArrowLeft', 'ArrowRight'].includes(event.key))) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!draft) {
        editors.forEach(e => e.suspend());
        const editing = spans.findIndex(span => span.start <= position && span.end >= position);
        draft = editing < 0 ? { start: position, end: position, keyboard: true } : { ...spans[editing]!, end: lastAvailable(spans[editing]!.end), editing, keyboard: true };
      }
      if (event.key !== 'Shift') {
        draft.end = move(draft.end, event.key === 'ArrowLeft' ? -1 : 1, draft.start);
        editors[Math.floor(draft.end / 8)]!.focusPosition(draft.end % 8);
      }
      render();
    } else if (draft && event.key === 'Enter') { event.preventDefault(); event.stopImmediatePropagation(); draft.end = position; commit(); }
  }, { capture: true, signal: lifecycle.signal });
  document.addEventListener('keyup', event => {
    if (event.key === 'Shift' && draft?.keyboard) {
      if (draft.end > draft.start || draft.editing !== undefined) commit(); else { draft = null; render(); }
    }
  }, { signal: lifecycle.signal });
  controls.addEventListener('keydown', event => { if (event.key === 'Escape') { draft = null; render(); } });
  window.addEventListener('blur', () => { draft = null; render(); }, { signal: lifecycle.signal });
  function render() {
    const all = spans.map(span => ({ ...span, draft: false }));
    if (draft) all.push({ start: draft.start, end: passageDurationEnd(grid, Math.max(draft.start, draft.end)), draft: true });
    const lanes: Span[][] = [];
    const laneFor = all.map(span => {
      let lane = lanes.findIndex(items => items.every(other => span.start > other.end || span.end < other.start));
      if (lane < 0) { lane = lanes.length; lanes.push([]); }
      lanes[lane]!.push(span);
      return lane;
    });
    editors.forEach((editor, measure) => {
      const pieces = spans.flatMap(span => spanPieces(span, editors.length)).filter(p => p.measure === measure);
      editor.projectLines(pieces.map(p => ({ start: p.incoming ? -1 : p.start, end: p.end })));
      const area = editor.card.querySelector<HTMLElement>('.answer-area')!;
      area.style.paddingBottom = `${Math.max(0, lanes.length - 1) * 44}px`;
      const layer = editor.card.querySelector('.lines')!; layer.replaceChildren();
      all.forEach((span, index) => spanPieces(span, editors.length).filter(p => p.measure === measure).forEach(piece => {
        const track = el('div', `duration-line passage-duration${span.draft ? ' draft-line' : ''}`);
        track.dataset.line = String(index); track.dataset.incoming = String(piece.incoming); track.dataset.outgoing = String(piece.outgoing);
        const x1 = piece.incoming ? 0 : slotX(piece.start, 8), x2 = piece.outgoing ? 100 : slotX(piece.end, 8);
        track.style.left = `${x1}%`; track.style.width = `${x2 - x1}%`; track.style.top = `calc(var(--anchor-y) + ${laneFor[index]! * 44}px)`;
        if (!span.draft) {
          const body = button('', () => { draft = { ...spans[index]!, end: lastAvailable(spans[index]!.end), editing: index }; render(); });
          body.className = 'duration-body'; body.setAttribute('aria-label', `Edit passage line ${index + 1}: ${label(span.start)} to ${label(span.end)}`); track.append(body);
          if (!piece.outgoing) {
            const handle = button('', () => { draft = { ...spans[index]!, end: lastAvailable(spans[index]!.end), editing: index }; render(); });
            handle.className = 'line-handle end'; handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', `Passage line ${index + 1} end`);
            handle.setAttribute('aria-valuemin', String(span.start)); handle.setAttribute('aria-valuemax', String(grid.slots.length - 1)); handle.setAttribute('aria-valuenow', String(span.end)); handle.setAttribute('aria-valuetext', label(span.end));
            handle.addEventListener('keydown', event => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next = event.key === 'Home' ? span.start : event.key === 'End' ? grid.available.at(-1)! : move(lastAvailable(span.end), event.key === 'ArrowLeft' ? -1 : 1, span.start);
                spans[index]!.end = passageDurationEnd(grid, next); editors.forEach(e => e.markEdited()); render();
                const updated = root.querySelector<HTMLElement>(`[aria-label="Passage line ${index + 1} end"]`);
                updated?.focus({ preventScroll: true }); updated?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
              }
            });
            track.append(handle);
          }
        }
        layer.append(track);
      }));
      editor.resume();
    });
    if (draft) { start.value = String(draft.start); end.value = String(draft.end); }
    save.disabled = !draft || draft.end < draft.start; cancel.disabled = !draft; remove.disabled = draft?.editing === undefined;
    status.textContent = draft ? `Line from ${label(draft.start)} to ${label(draft.end)}. Save or choose an endpoint; Escape cancels.` : 'Saved lines are kept while an endpoint edit is pending.';
  }
  render();
  return {
    spans: () => spans,
    cancel: () => { draft = null; render(); },
    reset: () => { spans = []; draft = null; render(); },
    destroy: () => { lifecycle.abort(); controls.remove(); },
  };
}
