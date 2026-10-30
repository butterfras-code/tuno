import type { FingeringCode } from './fingering-code.ts';
import { fingerHeld } from './fingering-code.ts';
import { el } from '../ui/components.ts';
import { HeldFingers } from './held-fingers.ts';
import type { FingerPosition } from './held-fingers.ts';
import { fingerLayout } from './fingering-layout.ts';
import type { ThumbPlacement } from './fingering-layout.ts';

/** Rendering and physical input only: no notes, validation, or submission timers. */
export function fingeringInput(fingers: readonly FingerPosition[], change: (code: FingeringCode, intentional: boolean) => void, thumb?: ThumbPlacement) {
  const node = el('div', 'fingering-input'); node.setAttribute('role', 'group'); node.setAttribute('aria-label', 'Held fingers');
  const layout = fingerLayout(fingers.length, thumb);
  node.style.setProperty('--span-along', String(layout.along));
  node.style.setProperty('--span-across', String(layout.across));
  const held = new HeldFingers();
  let enabled = false;
  // Fingers may land in the gaps or shift while held. Keep browser gestures
  // out of this whole playing surface, without disabling zoom elsewhere.
  const preventGesture = (event: Event) => { if (enabled && event.cancelable) event.preventDefault(); };
  for (const type of ['touchstart', 'touchmove', 'gesturestart', 'gesturechange']) {
    node.addEventListener(type, preventGesture, { passive: false });
  }
  const pointers = new Map<number, HTMLButtonElement>();
  const buttons = fingers.map((finger, index) => {
    const button = el('button', 'control fingering-valve'); button.type = 'button';
    button.style.setProperty('--along', String(layout.points[index]!.along));
    button.style.setProperty('--across', String(layout.points[index]!.across));
    button.setAttribute('aria-label', finger.accessibleLabel); button.setAttribute('aria-keyshortcuts', finger.key.toUpperCase());
    const shape = el('span', 'valve-outline'); shape.setAttribute('aria-hidden', 'true');
    const moving = el('span', 'valve-moving');
    const cap = el('span', 'valve-cap', finger.label);
    moving.append(el('span', 'valve-stem'), cap);
    shape.append(moving, el('span', 'valve-casing'));
    button.classList.toggle('fingering-trigger', index === thumb?.index);
    button.append(shape, el('kbd', '', finger.key.toUpperCase()));
    button.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('pointerdown', e => {
      if (!enabled || e.button !== 0) return;
      e.preventDefault(); pointers.set(e.pointerId, button); button.setPointerCapture(e.pointerId);
      if (held.down(`pointer:${e.pointerId}`, finger.position)) notify(true);
    });
    const release = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      const changed = held.up(`pointer:${e.pointerId}`);
      if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
      if (changed || e.type !== 'pointerup') notify(e.type === 'pointerup');
    };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    button.addEventListener('blur', reset);
    node.append(button); return button;
  });
  function notify(intentional: boolean) {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(fingerHeld(held.code, fingers[i]!.position))));
    node.dataset.code = held.code; change(held.code, intentional);
  }
  function reset() {
    const captured = [...pointers]; pointers.clear(); held.reset(); notify(false);
    for (const [id, b] of captured) if (b.hasPointerCapture(id)) b.releasePointerCapture(id);
  }
  notify(false);
  return {
    node, reset, get code() { return held.code; },
    enable(value: boolean) { if (enabled && !value) reset(); enabled = value; buttons.forEach(b => { b.disabled = !value; }); },
    keydown(event: KeyboardEvent) {
      const focused = buttons.indexOf(event.target as HTMLButtonElement);
      const finger = focused >= 0 && (event.key === ' ' || event.key === 'Enter') ? fingers[focused] : fingers.find(f => f.key === event.key.toLowerCase());
      if (!enabled || !finger) return false;
      event.preventDefault();
      if (!event.repeat && held.down(`key:${event.code || event.key}`, finger.position)) notify(true);
      return true;
    },
    keyup(event: KeyboardEvent) { if (held.up(`key:${event.code || event.key}`)) notify(true); },
  };
}
