import { el } from '../ui/components.ts';

export function fitFingerArrangement(width: number, height: number, along: number, across: number, spacing: number, requested: number) {
  // Retain full-size pads before compressing the preset spacing on small screens.
  const step = Math.max(64, Math.min(spacing, along ? (width - 64) / along : Infinity, across ? (height - 64) / across : Infinity));
  const baseWidth = 64 + along * step, baseHeight = 64 + across * step;
  const maximum = Math.max(0, Math.min(width / baseWidth, height / baseHeight));
  return { step, scale: Math.min(requested, maximum), maximum, baseWidth, baseHeight };
}

/** Presentation-only resize handle. Input gating and persistence belong to the caller. */
export function fingeringResize(node: HTMLElement, change: (scale: number, commit: boolean) => void) {
  const outline = el('div', 'fingering-resize-outline'); outline.hidden = true;
  const handle = el('div', 'fingering-resize-handle', '↘'); handle.tabIndex = 0;
  handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', 'Finger arrangement size');
  handle.setAttribute('aria-description', 'Drag to resize. Arrow keys adjust size. Home resets size. End fills available space.');
  handle.title = 'Drag to resize · Arrow keys adjust · Home resets · End fills available space';
  outline.append(handle); node.append(outline);
  let requested = 1, spacing = 84, editing = false, frame = 0;
  let geometry = fitFingerArrangement(0, 0, 0, 0, spacing, requested);
  let drag: { id: number; distance: number; scale: number; x: number; y: number } | undefined;
  const fit = () => {
    frame = 0;
    if (!node.isConnected) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const style = getComputedStyle(node);
    const widthSpan = Number(style.getPropertyValue('--layout-width'));
    const heightSpan = Number(style.getPropertyValue('--layout-height'));
    geometry = fitFingerArrangement(rect.width, rect.height, widthSpan, heightSpan, spacing, requested);
    node.style.setProperty('--hand-scale', String(geometry.scale));
    node.style.setProperty('--finger-step', `${geometry.step}px`);
    outline.style.width = `calc(${geometry.baseWidth * geometry.scale}px / var(--play-scale, 1))`;
    outline.style.height = `calc(${geometry.baseHeight * geometry.scale}px / var(--play-scale, 1))`;
    handle.setAttribute('aria-valuemin', '75');
    handle.setAttribute('aria-valuemax', String(Math.max(100, Math.round(geometry.maximum * 100))));
    handle.setAttribute('aria-valuenow', String(Math.round(geometry.scale * 100)));
    handle.setAttribute('aria-valuetext', `${Math.round(geometry.scale * 100)} percent`);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
  const observer = new ResizeObserver(schedule); observer.observe(node);
  const resize = (value: number, commit: boolean) => {
    requested = Math.max(0.75, Math.min(20, value));
    change(requested, commit); schedule();
  };
  handle.addEventListener('pointerdown', event => {
    if (!editing || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const rect = node.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    drag = { id: event.pointerId, distance: Math.max(1, Math.hypot(event.clientX - x, event.clientY - y)), scale: geometry.scale, x, y };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    resize(drag.scale * Math.hypot(event.clientX - drag.x, event.clientY - drag.y) / drag.distance, false);
  });
  const finish = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = undefined;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    change(requested, true);
  };
  handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish); handle.addEventListener('lostpointercapture', finish);
  handle.addEventListener('keydown', event => {
    const direction = ['ArrowRight', 'ArrowUp', '+', '='].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown', '-'].includes(event.key) ? -1 : 0;
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); event.stopPropagation();
    resize(event.key === 'Home' ? 1 : event.key === 'End' ? 20 : geometry.scale + direction * 0.1, true);
  });
  return {
    update(scale: number, step: number) { requested = scale; spacing = step; cancelAnimationFrame(frame); frame = 0; fit(); schedule(); },
    edit(value: boolean) {
      editing = value; outline.hidden = !value;
      if (!value && drag) {
        const id = drag.id; drag = undefined;
        if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
        change(requested, true);
      }
      schedule();
      if (value) handle.focus({ preventScroll: true });
    },
    dispose() { observer.disconnect(); cancelAnimationFrame(frame); outline.remove(); },
  };
}
