import { onUnmount } from '../shared/ui/unmount.ts';
import { TAIL_RAISED_ANGLE, type AudioController } from '../audio/controller.ts';
import type { PracticeStore } from '../practice/state.ts';
import { button, el } from './components.ts';
import { animatedUno } from './uno.ts';

export function petTempo(store: PracticeStore, audio: AudioController) {
  const dog = animatedUno();
  const node = el('div', 'pet-tempo');
  const head = button('Tap Uno’s head to set tempo');
  head.className = 'pet-head';
  const body = button('Double-tap Uno’s body to switch visualization');
  body.className = 'pet-body';
  for (const target of [head, body]) {
    target.setAttribute('aria-label', target.textContent!);
    target.textContent = '';
  }
  node.append(dog.node, head, body);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motions = ['bounce', 'sides', 'edges'] as const;
  const labels = { bounce: 'Vertical wag', sides: 'Horizontal wag', edges: 'Green edges' };
  let motion: typeof motions[number] = reduced.matches ? 'edges' : 'bounce';
  let chosen = false;
  let looking = false;
  let lastTap: { time: number; x: number; y: number } | undefined;
  let contact: { id: number; x: number; y: number; moved: boolean } | undefined;
  const updateMotion = () => {
    node.dataset.tailMotion = motion;
    body.setAttribute('aria-label', `${labels[motion]}. Double-tap Uno’s body or press Enter or Space to switch visualization`);
  };
  const motionChanged = () => {
    if (!chosen) {
      motion = reduced.matches ? 'edges' : 'bounce';
      updateMotion();
    }
  };
  updateMotion();
  reduced.addEventListener('change', motionChanged);
  const cycleVisualization = () => {
    chosen = true;
    motion = motions[(motions.indexOf(motion) + 1) % motions.length]!;
    updateMotion();
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
        cycleVisualization();
        lastTap = undefined;
      } else lastTap = { time: event.timeStamp, x: event.clientX, y: event.clientY };
    } else lastTap = undefined;
    contact = undefined;
    if (body.hasPointerCapture(event.pointerId)) body.releasePointerCapture(event.pointerId);
  });
  body.addEventListener('click', event => { if (event.detail === 0) cycleVisualization(); });
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
  const visibilityChanged = () => { if (document.hidden) cancel(); };
  document.addEventListener('visibilitychange', visibilityChanged);
  const unsubscribe = store.subscribe(state => { if (state.focus !== 'metronome' || !state.showUno) cancel(); });
  const untap = audio.onTap(() => { if (!looking && store.get().showUno && store.get().focus === 'metronome') dog.nod(); });
  const unpulse = audio.onPulseFrame((angle, playing, index, accent) => {
    dog.accent(motion === 'edges' ? 0 : accent);
    const sideToSide = motion === 'sides';
    const mirrored = sideToSide && index !== null && index % 2 === 0;
    dog.tail(motion === 'edges' ? 0 : sideToSide && playing ? TAIL_RAISED_ANGLE : angle, playing, mirrored, motion !== 'edges');
    const side = index === null ? '' : index % 2 === 0 ? 'left' : 'right';
    if (node.dataset.beat !== side) node.dataset.beat = side;
  });
  onUnmount(node, () => {
    cancel(); unsubscribe(); untap(); unpulse(); dog.dispose();
    reduced.removeEventListener('change', motionChanged);
    window.removeEventListener('blur', cancel);
    document.removeEventListener('visibilitychange', visibilityChanged);
  });
  return {
    node,
    look(holding: boolean, angle = 0) { looking = holding; dog.look(holding, angle); },
  };
}
