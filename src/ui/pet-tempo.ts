import type { AudioController } from '../audio/controller.ts';
import { LIMITS, type PracticeStore } from '../practice/state.ts';
import { button } from './components.ts';
import { animatedUno } from './uno.ts';

/** Pointer capture keeps a drag coherent even when the finger leaves the artwork. */
export function petTempo(store: PracticeStore, audio: AudioController) {
  const dog = animatedUno();
  const node = button('Pet Uno to tap tempo. Hold and drag up or down to adjust tempo.');
  node.className = 'pet-tempo';
  node.setAttribute('aria-label', 'Pet Uno to tap tempo. Hold and drag up or down to adjust tempo.');
  node.textContent = '';
  node.append(dog.node);
  let gesture: { id: number; y: number; tempo: number; holding: boolean } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  const hold = () => {
    if (!gesture) return;
    gesture.holding = true;
    dog.look(true);
  };
  const finish = () => {
    clearTimeout(timer);
    const id = gesture?.id;
    gesture = undefined;
    dog.look(false);
    if (id !== undefined && node.hasPointerCapture(id)) node.releasePointerCapture(id);
  };
  node.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || gesture) return;
    event.preventDefault();
    node.focus({ preventScroll: true });
    suppressClick = false;
    gesture = { id: event.pointerId, y: event.clientY, tempo: store.get().tempo, holding: false };
    node.setPointerCapture(event.pointerId);
    timer = setTimeout(hold, 300);
  });
  node.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const distance = gesture.y - event.clientY;
    if (!gesture.holding && Math.abs(distance) >= 8) { clearTimeout(timer); hold(); }
    if (!gesture.holding) return;
    const value = Math.max(LIMITS.tempo.min, Math.min(LIMITS.tempo.max, gesture.tempo + Math.trunc(distance / 4)));
    store.dispatch({ type: 'tempo', value });
    dog.look(true, Math.max(-18, Math.min(18, distance / 6)));
  });
  node.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    suppressClick = gesture.holding;
    finish();
  });
  const cancel = () => { if (gesture) { suppressClick = true; finish(); } };
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('lostpointercapture', cancel);
  node.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { event.preventDefault(); suppressClick = false; return; }
    audio.tapTempo();
  });
  node.addEventListener('keydown', event => {
    if (event.key === 'Escape') cancel();
  });
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  store.subscribe(state => { if (state.focus !== 'metronome' || !state.showUno) cancel(); });
  audio.onTap(() => { if (!gesture?.holding && store.get().showUno && store.get().focus === 'metronome') dog.nod(); });
  audio.onPulseFrame((angle, playing, index) => {
    dog.tail(angle, playing);
    const side = index === null ? '' : index % 2 === 0 ? 'left' : 'right';
    if (node.dataset.beat !== side) node.dataset.beat = side;
  });
  return node;
}
