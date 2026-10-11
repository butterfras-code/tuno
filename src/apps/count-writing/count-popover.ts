import { button, el } from '../../shared/ui/components.ts';
import { countKey } from './input.ts';
import { alphabet } from './evaluation.ts';
import type { CountSymbol } from './evaluation.ts';

export function createCountPopover(actions: {
  id?: string;
  symbols?: readonly CountSymbol[];
  display: (symbol: CountSymbol) => string;
  keydown: (event: KeyboardEvent) => boolean;
  select: (tick: number) => void;
  submit: (symbol: CountSymbol) => boolean;
  label: () => string;
  anchor: () => { x: number; y: number };
  focus: () => void;
}) {
  const lifecycle = new AbortController();
  function listen<K extends keyof WindowEventMap>(target: Document | Window | VisualViewport, name: K, handler: (event: WindowEventMap[K]) => void, capture = false) {
    target.addEventListener(name, handler as EventListener, { capture, signal: lifecycle.signal });
  }
  const popup = el('div', 'count-popover');
  popup.id = actions.id ?? 'count-popover'; popup.hidden = true;
  popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', 'Enter a count');
  const heading = el('span', 'count-popover-heading');
  const close = button('×', () => dismiss(true)); close.className = 'count-popover-dismiss';
  close.setAttribute('aria-label', 'Dismiss count choices');
  const header = el('div', 'count-popover-header'); header.append(heading, close);
  const beats = el('div', 'count-popover-row'); beats.setAttribute('role', 'group'); beats.setAttribute('aria-label', 'Beat counts');
  const subdivisions = el('div', 'count-popover-row'); subdivisions.setAttribute('role', 'group'); subdivisions.setAttribute('aria-label', 'Subdivision counts');
  if (actions.symbols?.length === 6) {
    beats.style.gridTemplateColumns = 'repeat(3, 1fr)';
    beats.setAttribute('aria-label', 'Numbered eighth counts');
    subdivisions.hidden = true;
  }
  for (const symbol of actions.symbols ?? alphabet) {
    const choice = button(symbol, () => submit(symbol));
    choice.className = 'count-popover-symbol'; choice.dataset.symbol = symbol;
    choice.setAttribute('aria-label', `Enter count ${symbol}`);
    (/^\d+$/.test(symbol) ? beats : subdivisions).append(choice);
  }
  popup.append(header, beats, subdivisions); document.body.append(popup);
  let offsetX = 0;
  let gesture: { id: number; target: Element; choice: HTMLButtonElement | null } | null = null;
  let ignoredClick: { target: Element; until: number } | null = null;
  function update() {
    heading.textContent = actions.label();
    popup.querySelectorAll<HTMLButtonElement>('[data-symbol]').forEach(choice => {
      const label = actions.display(choice.dataset.symbol as CountSymbol);
      choice.textContent = label; choice.setAttribute('aria-label', `Enter count ${label}`);
    });
    position();
  }
  function position() {
    if (popup.hidden) return;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? innerWidth), bottom = top + (viewport?.height ?? innerHeight);
    popup.style.maxHeight = `${Math.max(48, bottom - top - 80)}px`;
    const { width, height } = popup.getBoundingClientRect();
    let anchor = actions.anchor();
    // Prefer space below the active box; a compact page may have no scroll room.
    const overflow = anchor.y + 12 + height - (bottom - 8);
    if (overflow > 0) { window.scrollBy(0, overflow); anchor = actions.anchor(); }
    popup.style.left = `${Math.max(left + 8, Math.min(right - width - 8, anchor.x + offsetX - width / 2))}px`;
    const below = anchor.y + 12;
    const above = anchor.y - 48 - 12 - height;
    popup.style.top = `${Math.max(top + 8, Math.min(bottom - height - 8, below + height <= bottom - 8 ? below : above))}px`;
  }

  function open(tick: number, location: { x: number; y: number }) {
    actions.select(tick);
    const anchor = actions.anchor(); offsetX = location.x - anchor.x;
    popup.hidden = false; update();
  }
  function dismiss(focus = false) {
    popup.hidden = true;
    gesture?.choice?.classList.remove('slide-selected'); gesture = null;
    if (focus) actions.focus();
  }
  function submit(symbol: CountSymbol) {
    if (actions.submit(symbol)) { offsetX = 0; update(); } else dismiss();
  }
  function startPointer(event: PointerEvent, tick: number) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    event.preventDefault();
    const target = event.currentTarget as Element;
    ignoredClick = { target, until: performance.now() + 1000 };
    open(tick, { x: event.clientX, y: event.clientY });
    gesture = { id: event.pointerId, target, choice: null };
    target.setPointerCapture(event.pointerId);
  }
  function consumeClick(event: MouseEvent) {
    if (event instanceof PointerEvent && event.pointerType === 'mouse') return false;
    if (!ignoredClick || performance.now() > ignoredClick.until || !ignoredClick.target.contains(event.target as Node)) return false;
    ignoredClick = null; return true;
  }
  listen(document, 'pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('.count-popover-symbol') ?? null;
    gesture.choice?.classList.remove('slide-selected'); gesture.choice = hit;
    hit?.classList.add('slide-selected');
  });
  listen(document, 'pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const choice = gesture.choice;
    gesture = null; choice?.classList.remove('slide-selected');
    if (choice) submit(choice.dataset.symbol as CountSymbol);
  });
  listen(document, 'pointercancel', event => { if (gesture?.id === event.pointerId) dismiss(); });
  listen(document, 'pointerdown', event => {
    ignoredClick = null; // A new gesture must remain usable after opening the popover.
    if (!popup.hidden && !popup.contains(event.target as Node)) dismiss();
  }, true);
  // Opening can scroll the page before touch release. Suppress the gesture's
  // synthetic click even if scrolling moves a duration anchor under the finger.
  listen(document, 'click', event => {
    if (!ignoredClick || performance.now() > ignoredClick.until || event.detail === 0 ||
        (event instanceof PointerEvent && event.pointerType === 'mouse')) return;
    ignoredClick = null;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  listen(document, 'keydown', event => {
    if (popup.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); dismiss(true); }
    else if (popup.contains(event.target as Node) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (actions.keydown(event)) return;
      const symbol = countKey(event.key);
      if (symbol !== null) { event.preventDefault(); if (!event.repeat) submit(symbol); }

    }
  });
  listen(window, 'resize', position);
  listen(document, 'scroll', position, true);
  if (window.visualViewport) listen(window.visualViewport, 'resize', position);
  if (window.visualViewport) listen(window.visualViewport, 'scroll', position);
  return { destroy: () => { lifecycle.abort(); popup.remove(); }, open, dismiss, update, submit, startPointer, consumeClick };
}
