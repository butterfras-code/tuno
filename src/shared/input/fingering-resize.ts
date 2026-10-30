import { el } from '../ui/components.ts';

export function fitFingerArrangement(width: number, height: number, along: number, across: number, spacing: number, requested: number) {
  // Retain full-size pads before compressing the preset spacing on small screens.
  const step = Math.max(64, Math.min(spacing, along ? (width - 64) / along : Infinity, across ? (height - 64) / across : Infinity));
  const baseWidth = 64 + along * step, baseHeight = 64 + across * step;
  const maximum = Math.max(0, Math.min(width / baseWidth, height / baseHeight));
  return { step, scale: Math.min(requested, maximum), maximum, baseWidth, baseHeight };
}

export type FingerPosition = { x: number; y: number };
const bounded = (value: number) => Math.max(0, Math.min(1, value));
export function fingerArrangementOffset(width: number, height: number, handWidth: number, handHeight: number, position: FingerPosition) {
  return { x: (bounded(position.x) - 0.5) * Math.max(0, width - handWidth), y: (bounded(position.y) - 0.5) * Math.max(0, height - handHeight) };
}

/** Presentation-only size/position editing. Input gating and persistence belong to the caller. */
export function fingeringResize(node: HTMLElement, change: (scale: number, commit: boolean, position: FingerPosition) => void) {
  const outline = el('div', 'fingering-resize-outline'); outline.hidden = true; outline.tabIndex = 0;
  outline.setAttribute('role', 'group'); outline.setAttribute('aria-label', 'Finger arrangement position');
  outline.setAttribute('aria-description', 'Drag to reposition. Arrow keys move the controls. Home centers them.');
  outline.title = 'Drag to reposition · Arrow keys move · Home centers';
  const positionHandle = el('span', 'fingering-position-handle', '✥'); positionHandle.setAttribute('aria-hidden', 'true');
  const handle = el('div', 'fingering-resize-handle', '↘'); handle.tabIndex = 0;
  handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', 'Finger arrangement size');
  handle.setAttribute('aria-description', 'Drag to resize. Arrow keys adjust size. Home resets size. End fills available space.');
  handle.title = 'Drag to resize · Arrow keys adjust · Home resets · End fills available space';
  outline.append(positionHandle, handle); node.append(outline);
  let requested = 1, spacing = 84, editing = false, frame = 0;
  let position: FingerPosition = { x: 0.5, y: 0.5 };
  let geometry = fitFingerArrangement(0, 0, 0, 0, spacing, requested);
  let drag: { id: number; target: HTMLElement; mode: 'resize' | 'move'; distance: number; scale: number; x: number; y: number; position: FingerPosition; freeWidth: number; freeHeight: number } | undefined;
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
    const offset = fingerArrangementOffset(rect.width, rect.height, geometry.baseWidth * geometry.scale, geometry.baseHeight * geometry.scale, position);
    node.style.setProperty('--hand-offset-x', `calc(${offset.x}px / var(--play-scale, 1))`);
    node.style.setProperty('--hand-offset-y', `calc(${offset.y}px / var(--play-scale, 1))`);
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
    change(requested, commit, { ...position }); schedule();
  };
  const begin = (event: PointerEvent, target: HTMLElement, mode: 'resize' | 'move') => {
    if (!editing || event.button !== 0 || drag) return;
    event.preventDefault(); event.stopPropagation();
    const rect = outline.getBoundingClientRect(), area = node.getBoundingClientRect();
    const x = mode === 'resize' ? rect.x + rect.width / 2 : event.clientX;
    const y = mode === 'resize' ? rect.y + rect.height / 2 : event.clientY;
    drag = { id: event.pointerId, target, mode, distance: Math.max(1, Math.hypot(event.clientX - x, event.clientY - y)), scale: geometry.scale, x, y, position: { ...position }, freeWidth: Math.max(0, area.width - rect.width), freeHeight: Math.max(0, area.height - rect.height) };
    target.focus({ preventScroll: true }); target.setPointerCapture(event.pointerId);
  };
  handle.addEventListener('pointerdown', event => begin(event, handle, 'resize'));
  outline.addEventListener('pointerdown', event => { if (event.target === outline || event.target === positionHandle) begin(event, outline, 'move'); });
  outline.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    if (drag.mode === 'resize') resize(drag.scale * Math.hypot(event.clientX - drag.x, event.clientY - drag.y) / drag.distance, false);
    else {
      position = { x: drag.freeWidth > 0.5 ? bounded(drag.position.x + (event.clientX - drag.x) / drag.freeWidth) : drag.position.x, y: drag.freeHeight > 0.5 ? bounded(drag.position.y + (event.clientY - drag.y) / drag.freeHeight) : drag.position.y };
      change(requested, false, { ...position }); schedule();
    }
  });
  const finish = () => {
    if (!drag) return;
    const { id, target } = drag; drag = undefined;
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
    change(requested, true, { ...position });
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) outline.addEventListener(type, event => {
    if ((event as PointerEvent).pointerId === drag?.id) finish();
  });
  outline.addEventListener('keydown', event => {
    if (event.target !== outline || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    position = event.key === 'Home' ? { x: 0.5, y: 0.5 } : {
      x: bounded(position.x + (event.key === 'ArrowRight' ? 0.05 : event.key === 'ArrowLeft' ? -0.05 : 0)),
      y: bounded(position.y + (event.key === 'ArrowDown' ? 0.05 : event.key === 'ArrowUp' ? -0.05 : 0)),
    };
    change(requested, true, { ...position }); schedule();
  });
  handle.addEventListener('keydown', event => {
    const direction = ['ArrowRight', 'ArrowUp', '+', '='].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown', '-'].includes(event.key) ? -1 : 0;
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); event.stopPropagation();
    resize(event.key === 'Home' ? 1 : event.key === 'End' ? 20 : geometry.scale + direction * 0.1, true);
  });
  return {
    outline,
    update(scale: number, step: number, placement: FingerPosition = { x: 0.5, y: 0.5 }) { requested = scale; spacing = step; position = { ...placement }; cancelAnimationFrame(frame); frame = 0; fit(); schedule(); },
    edit(value: boolean) {
      editing = value; outline.hidden = !value;
      if (!value) finish();
      schedule();
      if (value) handle.focus({ preventScroll: true });
    },
    dispose() { observer.disconnect(); cancelAnimationFrame(frame); outline.remove(); },
  };
}
