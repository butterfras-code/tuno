import { button, el } from '../../shared/ui/components.ts';
import { passageDurationEnd, spanPieces } from './passage.ts';
import type { PassageGrid } from './passage.ts';
import type { Span } from './evaluation.ts';
import type { createMeasureEditor } from './editor.ts';
import { slotX } from './grid.ts';

/** One saved logical span, projected into notation systems only for display. */
export function createPassageLines(root: HTMLElement, grid: PassageGrid, editors: ReturnType<typeof createMeasureEditor>[], promptHost: HTMLElement = root) {
  const lifecycle = new AbortController();
  let spans: Span[] = [];
  let draft: (Span & { editing?: number; keyboard?: boolean }) | null = null;
  const label = (position: number) => `measure ${grid.slots[position]!.measure + 1}, ${grid.slots[position]!.label}`;
  const status = el('span', 'sr-only'); status.setAttribute('role', 'status'); root.append(status);
  const prompt = el('div', 'endpoint-prompt'); prompt.hidden = true;
  const message = el('span', '', 'Tap where the line ends');
  prompt.append(message, button('Cancel', () => { draft = null; render(); })); promptHost.append(prompt);
  root.addEventListener('start-duration', event => {
    const card = event.target as HTMLElement;
    const position = grid.offsets[Number(card.dataset.measure) - 1]! + (event as CustomEvent<number>).detail;
    editors.forEach(e => e.suspend());
    draft = { start: position, end: position }; render();
  }, { signal: lifecycle.signal });
  function removeSaved(index: number) {
    spans.splice(index, 1); draft = null; editors.forEach(editor => editor.markEdited()); render();
  }
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
    return (tick < 0 && count < 0) ? null : grid.offsets[Number(card.dataset.measure) - 1]! + Math.max(tick, count);
  }
  function tap(position: number) {
    if (draft) { if (position < draft.start) return; draft.end = position; commit(); }
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
      const anchor = editors[grid.slots[position]!.measure]!.card.querySelectorAll('.duration-anchor')[grid.slots[position]!.index]!;
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
    // Shift belongs to rest entry while a pair is open (including typing `)`).
    if ((event.key === 'Shift' || (event.shiftKey && ['ArrowLeft', 'ArrowRight'].includes(event.key))) && !editors.some(editor => editor.editingRest())) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!draft) {
        editors.forEach(e => e.suspend());
        const editing = spans.findIndex(span => span.start <= position && span.end >= position);
        draft = editing < 0 ? { start: position, end: position, keyboard: true } : { ...spans[editing]!, end: lastAvailable(spans[editing]!.end), editing, keyboard: true };
      }
      if (event.key !== 'Shift') {
        draft.end = move(draft.end, event.key === 'ArrowLeft' ? -1 : 1, draft.start);
        editors[grid.slots[draft.end]!.measure]!.focusPosition(grid.slots[draft.end]!.index);
      }
      render();
    } else if (draft && event.key === 'Enter') { event.preventDefault(); event.stopImmediatePropagation(); draft.end = position; commit(); }
  }, { capture: true, signal: lifecycle.signal });
  // Rendering an edited line replaces its focused button; Escape must still
  // cancel when focus has consequently returned to the document body.
  document.addEventListener('keydown', event => {
    if (draft?.editing !== undefined && ['Delete', 'Backspace'].includes(event.key) && (event.target === document.body || root.contains(event.target as Node))) {
      event.preventDefault(); event.stopImmediatePropagation(); removeSaved(draft.editing);
    } else if (event.key === 'Escape' && draft) {
      event.preventDefault(); event.stopImmediatePropagation(); draft = null; render();
    }
  }, { capture: true, signal: lifecycle.signal });
  document.addEventListener('keyup', event => {
    if (event.key === 'Shift' && draft?.keyboard) {
      if (draft.end > draft.start || draft.editing !== undefined) commit(); else { draft = null; render(); }
    }
  }, { signal: lifecycle.signal });
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
      const pieces = spans.flatMap(span => spanPieces(span, grid.grids.map(g => g.slots.length))).filter(p => p.measure === measure);
      editor.projectLines(pieces.map(p => ({ start: p.incoming ? -1 : p.start, end: p.end })));
      const area = editor.card.querySelector<HTMLElement>('.answer-area')!;
      area.style.paddingBottom = `${Math.max(0, lanes.length - 1) * 44}px`;
      const layer = editor.card.querySelector('.lines')!; layer.replaceChildren();
      all.forEach((span, index) => spanPieces(span, grid.grids.map(g => g.slots.length)).filter(p => p.measure === measure).forEach(piece => {
        const track = el('div', `duration-line passage-duration${span.draft ? ' draft-line' : ''}`);
        track.dataset.line = String(index); track.dataset.incoming = String(piece.incoming); track.dataset.outgoing = String(piece.outgoing);
        const x1 = piece.incoming ? 0 : slotX(piece.start, grid.grids[measure]!.slots.length, grid.grids[measure]!.fine), x2 = piece.outgoing ? 100 : slotX(piece.end, grid.grids[measure]!.slots.length, grid.grids[measure]!.fine);
        track.style.left = `${x1}%`; track.style.width = `${x2 - x1}%`; track.style.top = `calc(var(--anchor-y) + var(--subdivision-row, 0px) * ${grid.grids[measure]!.slots[piece.start]?.subdivision ?? 0} + ${laneFor[index]! * 44}px)`;
        if (!span.draft) {
          const body = button('', () => { draft = { ...spans[index]!, end: lastAvailable(spans[index]!.end), editing: index }; render(); });
          body.addEventListener('keydown', event => { if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); removeSaved(index); } });
          body.className = 'duration-body'; body.setAttribute('aria-label', `Edit passage line ${index + 1}: ${label(span.start)} to ${label(span.end)}`); track.append(body);
          if (!piece.outgoing) {
            const handle = button('', () => { draft = { ...spans[index]!, end: lastAvailable(spans[index]!.end), editing: index }; render(); });
            handle.className = 'line-handle end'; handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', `Passage line ${index + 1} end`);
            handle.setAttribute('aria-valuemin', String(span.start)); handle.setAttribute('aria-valuemax', String(grid.slots.length - 1)); handle.setAttribute('aria-valuenow', String(span.end)); handle.setAttribute('aria-valuetext', label(span.end));
            handle.addEventListener('keydown', event => {
              if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); removeSaved(index); return; }
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
        if (span.draft && draft?.editing !== undefined && !piece.outgoing) {
          const remove = button('×', () => { if (draft?.editing !== undefined) removeSaved(draft.editing); });
          remove.className = 'line-handle end line-delete'; remove.setAttribute('aria-label', 'Delete duration line'); track.append(remove);
        }
        layer.append(track);
      }));
      editor.resume();
      editor.card.querySelectorAll<HTMLButtonElement>('.count-slot').forEach((slot, index) => {
        if (draft && !draft.keyboard) slot.classList.toggle('endpoint-choice', !slot.hidden && grid.offsets[measure]! + index >= draft.start);
        else if (!editor.editingRest()) slot.classList.remove('endpoint-choice');
      });
    });
    prompt.hidden = !draft || Boolean(draft.keyboard);
    status.textContent = draft ? `Line from ${label(draft.start)} to ${label(draft.end)}. Choose an endpoint to save; Escape cancels. Delete removes a selected saved line.` : '';
  }
  render();
  return {
    spans: () => spans,
    cancel: () => { draft = null; render(); },
    reset: () => { spans = []; draft = null; render(); },
    destroy: () => { lifecycle.abort(); status.remove(); prompt.remove(); },
  };
}
