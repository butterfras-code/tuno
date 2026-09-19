import { LIMITS, type PracticeStore } from '../practice/state.ts';
import { numberInput } from './components.ts';

/** One tempo control for the full views and the compact tool strip. */
export function tempoInput(store: PracticeStore, label = 'Tempo (BPM)') {
  const { min, max } = LIMITS.tempo;
  const input = numberInput(min, max, store.get().tempo);
  input.classList.add('tempo-adjust');
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', label);
  input.title = 'Tap to edit. Drag up or right, or scroll up, to increase tempo.';
  let gesture: { id: number; x: number; y: number; tempo: number; dragged: boolean } | undefined;
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
  input.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || gesture) return;
    event.preventDefault();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, tempo: store.get().tempo, dragged: false };
    input.setPointerCapture(event.pointerId);
  });
  input.addEventListener('pointermove', (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = gesture.y - event.clientY;
    const distance = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (!gesture.dragged && Math.abs(distance) < 6) return;
    gesture.dragged = true;
    adjust(gesture.tempo + Math.trunc(distance / 6));
  });
  input.addEventListener('pointerup', (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const { dragged } = gesture;
    gesture = undefined;
    input.releasePointerCapture(event.pointerId);
    if (!dragged) { input.focus(); input.select(); }
  });
  const cancel = () => { gesture = undefined; };
  input.addEventListener('pointercancel', cancel);
  input.addEventListener('lostpointercapture', cancel);
  // Suppress the native click after a drag, which otherwise opens the keyboard.
  input.addEventListener('click', (event) => event.preventDefault());
  input.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.deltaY === 0) return;
    event.preventDefault();
    adjust(store.get().tempo - Math.sign(event.deltaY));
  }, { passive: false });
  store.subscribe((state) => {
    if (document.activeElement !== input) input.value = String(state.tempo);
  });
  return input;
}
