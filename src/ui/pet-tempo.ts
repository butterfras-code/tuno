import { TAIL_RAISED_ANGLE, type AudioController } from '../audio/controller.ts';
import type { PracticeStore } from '../practice/state.ts';
import { button, el } from './components.ts';
import { animatedUno } from './uno.ts';

export function petTempo(store: PracticeStore, audio: AudioController) {
  const dog = animatedUno();
  const node = el('div', 'pet-tempo');
  const head = button('Tap Uno’s head to set tempo');
  head.className = 'pet-head';
  const body = button('Double-tap Uno’s body to switch tail motion');
  body.className = 'pet-body';
  for (const target of [head, body]) {
    target.setAttribute('aria-label', target.textContent!);
    target.textContent = '';
  }
  node.append(dog.node, head, body);
  let sideToSide = false;
  let looking = false;
  let lastTap: { time: number; x: number; y: number } | undefined;
  let contact: { id: number; x: number; y: number; moved: boolean } | undefined;
  node.dataset.tailMotion = 'bounce';
  const toggleTailMotion = () => {
    sideToSide = !sideToSide;
    node.dataset.tailMotion = sideToSide ? 'sides' : 'bounce';
  };
  // Head taps have no double-tap ambiguity: update tempo and nod on contact.
  head.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    head.focus({ preventScroll: true });
    lastTap = undefined;
    audio.tapTempo();
  });
  head.addEventListener('click', event => { if (event.detail === 0) audio.tapTempo(); });
  body.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || contact) return;
    event.preventDefault();
    body.focus({ preventScroll: true });
    contact = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    body.setPointerCapture(event.pointerId);
  });
  body.addEventListener('pointermove', event => {
    if (contact?.id === event.pointerId && Math.hypot(event.clientX - contact.x, event.clientY - contact.y) >= 8) contact.moved = true;
  });
  body.addEventListener('pointerup', event => {
    if (contact?.id !== event.pointerId) return;
    if (!contact.moved) {
      if (lastTap && event.timeStamp - lastTap.time <= 300 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24) {
        toggleTailMotion();
        lastTap = undefined;
      } else lastTap = { time: event.timeStamp, x: event.clientX, y: event.clientY };
    } else lastTap = undefined;
    contact = undefined;
    if (body.hasPointerCapture(event.pointerId)) body.releasePointerCapture(event.pointerId);
  });
  body.addEventListener('click', event => { if (event.detail === 0) toggleTailMotion(); });
  const cancel = () => {
    const id = contact?.id;
    contact = undefined;
    lastTap = undefined;
    if (id !== undefined && body.hasPointerCapture(id)) body.releasePointerCapture(id);
  };
  body.addEventListener('pointercancel', cancel);
  body.addEventListener('lostpointercapture', () => { if (contact) cancel(); });
  body.addEventListener('keydown', event => { if (event.key === 'Escape') cancel(); });
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  store.subscribe(state => { if (state.focus !== 'metronome' || !state.showUno) cancel(); });
  audio.onTap(() => { if (!looking && store.get().showUno && store.get().focus === 'metronome') dog.nod(); });
  audio.onPulseFrame((angle, playing, index) => {
    const mirrored = sideToSide && index !== null && index % 2 === 0;
    dog.tail(sideToSide && playing ? TAIL_RAISED_ANGLE : angle, playing, mirrored);
    const side = index === null ? '' : index % 2 === 0 ? 'left' : 'right';
    if (node.dataset.beat !== side) node.dataset.beat = side;
  });
  return {
    node,
    look(holding: boolean, angle = 0) { looking = holding; dog.look(holding, angle); },
  };
}
