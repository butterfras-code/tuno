import { answerLayout, supportedAnswer } from '../domain/answer-layout.ts';
import { el } from '../../../shared/ui/components.ts';
import { keyAccidental, spelling } from '../domain/notation.ts';
import type { Accidental, AnswerSpelling, Letter } from '../domain/notation.ts';
import type { Preset } from '../domain/presets.ts';
import type { PromptToken } from '../engine/practice.ts';

/** One spelling model for tap targets and keyboard answers. */
export function answerControls(accept: (answer: AnswerSpelling, token: PromptToken) => void, allowConcurrentPointers = false) {
  const node = el('div', 'answer-input');
  const rows = el('div', 'answer-rows');
  const hints = el('div', 'answer-key-hints');
  const keycaps = ([['↑', 1, 'Hold Up for sharps'], ['→', 0, 'Hold Right for naturals'], ['↓', -1, 'Hold Down for flats']] as const).map(([arrow, accidental, label]) => {
    const cap = el('kbd', 'answer-keycap', arrow);
    cap.dataset.accidental = String(accidental); cap.title = label;
    cap.setAttribute('aria-label', label); hints.append(cap);
    return cap;
  });
  const scroll = el('div', 'answer-scroll');
  const grid = el('div', 'answers'); grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Answer spelling');
  const preview = el('p', 'answer-preview', 'Tap a note to answer.');
  const buttons: HTMLButtonElement[] = [];
  const values = new Map<HTMLButtonElement, AnswerSpelling>();
  let available = new Set<string>();
  let preset: Preset | undefined;
  let token: PromptToken | undefined;
  let locked = true;
  let since = 0;
  let gesture: { id: number; origin: HTMLButtonElement; token: PromptToken } | undefined;
  let pending: HTMLButtonElement | undefined;
  const enabled = (b: HTMLButtonElement) => !locked && values.has(b);
  const highlight = (b?: HTMLButtonElement) => {
    pending?.classList.remove('answer-pending'); pending = b;
    pending?.classList.add('answer-pending');
  };
  const reset = () => {
    const old = gesture; gesture = undefined; highlight();
    if (old?.origin.hasPointerCapture(old.id)) old.origin.releasePointerCapture(old.id);
  };
  const at = (event: PointerEvent) => {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('button');
    return target instanceof HTMLButtonElement && values.has(target) && enabled(target) ? target : undefined;
  };
  const submit = (answer: AnswerSpelling, captured = token) => {
    if (!locked && captured && supportedAnswer(answer)) accept(answer, captured);
  };
  const build = (next: Preset) => {
    reset(); grid.replaceChildren(); buttons.length = 0; values.clear();
    for (const target of answerLayout(next.key)) {
      const value = target.answer;
      const { letter, accidental } = value;
      const b = el('button', `control answer answer-${accidental === 1 ? 'sharp' : accidental === -1 ? 'flat' : 'natural'}`, spelling(value));
      b.style.gridColumn = `${target.column} / span 2`; b.style.gridRow = String(target.row);
      b.dataset.repeat = String(target.repeat);
      b.type = 'button'; b.dataset.letter = letter; b.dataset.accidental = String(accidental);
      values.set(b, value); buttons.push(b); grid.append(b);
      // All displayed spellings accept guesses, including notes outside the exercise pool.
      b.addEventListener('pointerdown', event => {
        if (gesture || event.button !== 0 || !allowConcurrentPointers && !event.isPrimary || locked || !token || event.timeStamp < since) return;
        event.preventDefault();
        gesture = { id: event.pointerId, origin: b, token };
        b.setPointerCapture(event.pointerId); highlight(enabled(b) ? b : undefined);
      });
      // Leaving the pressed target cancels the tap; dragging cannot select another note.
      b.addEventListener('pointermove', event => {
        if (gesture?.id === event.pointerId && at(event) !== gesture.origin) reset();
      });
      b.addEventListener('pointerup', event => {
        if (gesture?.id !== event.pointerId) return;
        const captured = gesture.token, origin = gesture.origin, target = at(event); reset();
        if (target === origin) submit(values.get(origin)!, captured);
      });
      b.addEventListener('pointercancel', event => { if (gesture?.id === event.pointerId) reset(); });
      b.addEventListener('lostpointercapture', event => { if (gesture?.id === event.pointerId) reset(); });
      // Pointer submission happens on release; only assistive/programmatic clicks use this path.
      b.addEventListener('click', event => { if (event.detail === 0 && event.timeStamp >= since) submit(value); });
    }
  };
  scroll.append(grid); rows.append(hints, scroll); node.append(rows, preview);
  return {
    node, buttons, reset,
    modifier(accidental?: Accidental) {
      for (const b of buttons) b.classList.toggle('answer-modifier', values.get(b)!.accidental === accidental);
      for (const cap of keycaps) cap.classList.toggle('keycap-held', cap.dataset.accidental === String(accidental));
    },
    update(next: Preset, nextToken: PromptToken, nextLocked: boolean) {
      if (!preset || preset.key.fifths !== next.key.fifths) build(next);
      const changed = token?.session !== nextToken.session || token?.prompt !== nextToken.prompt;
      if (changed || nextLocked) reset();
      if (changed || locked && !nextLocked) since = performance.now();
      const nextAvailable = new Set(next.pool.map(spelling));
      const sameSession = token?.session === nextToken.session;
      preset = next; token = nextToken; locked = nextLocked;
      for (const b of buttons) {
        const value = values.get(b)!;
        const active = nextAvailable.has(spelling(value));
        if (sameSession && active && !available.has(spelling(value))) {
          b.classList.remove('answer-added'); void b.offsetWidth; b.classList.add('answer-added');
        } else if (!sameSession) b.classList.remove('answer-added');
        b.classList.toggle('answer-unavailable', !active);
        b.classList.toggle('answer-default', value.accidental === keyAccidental(value.letter, next.key));
        b.setAttribute('aria-disabled', String(locked));
        b.tabIndex = locked ? -1 : 0;
        if (value.accidental === 0) b.setAttribute('aria-keyshortcuts', value.letter);
        else b.removeAttribute('aria-keyshortcuts');
      }
      available = nextAvailable;
    },
    letter(letter: Letter, accidental: Accidental = 0) {
      if (preset) submit({ letter, accidental });
    },
    focused(button: HTMLButtonElement) { const value = values.get(button); if (value) submit(value); },
    focus() { buttons.find(enabled)?.focus(); },
  };
}
