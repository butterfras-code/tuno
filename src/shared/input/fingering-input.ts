import { el } from '../ui/components.ts';
import { HeldFingers } from './held-fingers.ts';
import type { FingerPosition } from './held-fingers.ts';

/** Rendering and physical input only: no notes, validation, or submission timers. */
export function fingeringInput(fingers: readonly FingerPosition[], change: (mask: string, intentional: boolean) => void) {
  const node = el('div', 'fingering-input'); node.setAttribute('role', 'group'); node.setAttribute('aria-label', 'Held fingers');
  const held = new HeldFingers();
  let enabled = false;
  const pointers = new Map<number, HTMLButtonElement>();
  const buttons = fingers.map(finger => {
    const button = el('button', 'control fingering-valve'); button.type = 'button';
    button.setAttribute('aria-label', finger.accessibleLabel); button.setAttribute('aria-keyshortcuts', finger.key.toUpperCase());
    button.append(el('span', 'fingering-label', finger.label), el('kbd', '', finger.key.toUpperCase()));
    button.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
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
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(held.mask[fingers[i]!.position] === '1')));
    node.dataset.mask = held.mask; change(held.mask, intentional);
  }
  function reset() {
    const captured = [...pointers]; pointers.clear(); held.reset(); notify(false);
    for (const [id, b] of captured) if (b.hasPointerCapture(id)) b.releasePointerCapture(id);
  }
  notify(false);
  return {
    node, reset, get mask() { return held.mask; },
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
