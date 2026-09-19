import type { AudioController } from '../audio/controller.ts';
import { LIMITS, type PracticeStore } from '../practice/state.ts';
import { button } from './components.ts';
import { animatedUno } from './uno.ts';

/** Pointer capture keeps a drag coherent even when the finger leaves the artwork. */
export function petTempo(store: PracticeStore, audio: AudioController) {
  const dog = animatedUno();
  const instructions = 'Pet Uno to tap tempo. Hold and drag up or down to adjust tempo. Double-click or double-tap to switch the tail motion.';
  const node = button(instructions);
  node.className = 'pet-tempo';
  node.setAttribute('aria-label', instructions);
  node.textContent = '';
  node.append(dog.node);
  let gesture: { id: number; y: number; tempo: number; holding: boolean } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tapTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  let sideToSide = false;
  let lastTouchEnd = 0;
  node.dataset.tailMotion = 'bounce';
  const toggleTailMotion = () => {
    sideToSide = !sideToSide;
    node.dataset.tailMotion = sideToSide ? 'sides' : 'bounce';
  };
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
    if (!gesture.holding && event.pointerType === 'touch') {
      if (event.timeStamp - lastTouchEnd <= 300) {
        clearTimeout(tapTimer);
        suppressClick = true;
        lastTouchEnd = 0;
        toggleTailMotion();
      } else lastTouchEnd = event.timeStamp;
    }
    finish();
  });
  const cancel = () => { if (gesture) { suppressClick = true; finish(); } };
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('lostpointercapture', cancel);
  node.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { event.preventDefault(); suppressClick = false; return; }
    if (event.detail === 0) { audio.tapTempo(); return; }
    clearTimeout(tapTimer);
    if (event.detail > 1) {
      event.preventDefault();
      if (event.detail === 2) toggleTailMotion();
      return;
    }
    // Wait out the browser's multi-click window so a double-click is not also two tempo taps.
    tapTimer = setTimeout(audio.tapTempo, 300);
  });
  node.addEventListener('keydown', event => {
    if (event.key === 'Escape') cancel();
  });
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  store.subscribe(state => {
    if (state.focus !== 'metronome' || !state.showUno) {
      cancel();
      clearTimeout(tapTimer);
    }
  });
  audio.onTap(() => { if (!gesture?.holding && store.get().showUno && store.get().focus === 'metronome') dog.nod(); });
  audio.onPulseFrame((angle, playing, index) => {
    const mirrored = sideToSide && index !== null && index % 2 === 1;
    dog.tail(sideToSide && playing ? -25 : angle, playing, mirrored);
    const side = index === null ? '' : index % 2 === 0 ? 'left' : 'right';
    if (node.dataset.beat !== side) node.dataset.beat = side;
  });
  return node;
}
