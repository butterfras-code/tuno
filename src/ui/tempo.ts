import { LIMITS, type PracticeStore } from '../practice/state.ts';
import { numberInput } from './components.ts';

/** One tempo control for the full views and the compact tool strip. */
export function tempoInput(store: PracticeStore, label = 'Tempo (BPM)', onDrag?: (active: boolean, angle?: number) => void) {
  const { min, max } = LIMITS.tempo;
  const input = numberInput(min, max, store.get().tempo);
  input.classList.add('tempo-adjust');
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', label);
  input.title = 'Tap to edit. Drag up or right, or scroll up, to increase tempo.';
  const adjust = (value: number) => {
    store.dispatch({ type: 'tempo', value: Math.max(min, Math.min(max, value)) });
    input.value = String(store.get().tempo);
  };
  const commit = () => {
    if (input.value !== '' && input.validity.valid) adjust(Number(input.value));
    else input.value = String(store.get().tempo);
  };
  input.addEventListener('change', commit);
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { commit(); input.blur(); }
    if (event.key === 'Escape') { input.value = String(store.get().tempo); input.blur(); }
  });
  const isDragging = tempoDrag(input, store, onDrag, () => { input.focus(); input.select(); });
  // Suppress the native click after a drag, which otherwise opens the keyboard.
  input.addEventListener('click', (event) => event.preventDefault());
  input.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.deltaY === 0) return;
    event.preventDefault();
    adjust(store.get().tempo - Math.sign(event.deltaY));
  }, { passive: false });
  store.subscribe((state) => {
    if (document.activeElement !== input || isDragging()) input.value = String(state.tempo);
  });
  return input;
}

/** Shared pointer gesture for the number and the generous target beside its drag marker. */
export function tempoDrag(target: HTMLElement, store: PracticeStore, onDrag?: (active: boolean, angle?: number) => void, onTap?: () => void) {
  let gesture: { id: number; x: number; y: number; tempo: number; dragged: boolean; focus: string } | undefined;
  const finish = () => {
    const current = gesture;
    gesture = undefined;
    if (current?.dragged) onDrag?.(false);
    if (current && target.hasPointerCapture(current.id)) target.releasePointerCapture(current.id);
  };
  target.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || gesture) return;
    event.preventDefault();
    if (!(target instanceof HTMLInputElement)) target.focus({ preventScroll: true });
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, tempo: store.get().tempo, dragged: false, focus: store.get().focus };
    target.setPointerCapture(event.pointerId);
  });
  target.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = gesture.y - event.clientY;
    const distance = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (!gesture.dragged && Math.abs(distance) < 6) return;
    gesture.dragged = true;
    onDrag?.(true, Math.max(-18, Math.min(18, distance / 6)));
    store.dispatch({ type: 'tempo', value: Math.max(LIMITS.tempo.min, Math.min(LIMITS.tempo.max, gesture.tempo + Math.trunc(distance / 6))) });
  });
  target.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const tapped = !gesture.dragged;
    finish();
    if (tapped) onTap?.();
  });
  target.addEventListener('pointercancel', finish);
  target.addEventListener('lostpointercapture', finish);
  target.addEventListener('keydown', event => { if (event.key === 'Escape') finish(); });
  window.addEventListener('blur', finish);
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  store.subscribe(state => { if (gesture && state.focus !== gesture.focus) finish(); });
  return () => Boolean(gesture?.dragged);
}
