import { keyboardAnswers } from './keyboard-answers.ts';
import { fingeringInput } from '../../../shared/input/fingering-input.ts';
import { fingerSpacing, spacingPresets } from '../../../shared/input/fingering-layout.ts';
import type { FingerSpacing } from '../../../shared/input/fingering-layout.ts';
import { FingeringPolicy } from '../engine/fingering-policy.ts';
import { fingeringFor, OPEN_FINGERING } from '../domain/fingering.ts';
import type { NoteAnswer } from '../domain/fingering.ts';
import { chromatic } from '../domain/notation.ts';
import { el } from '../../../shared/ui/components.ts';
import { missingAccidentalHint } from '../domain/keyboard-guidance.ts';
import { spelling } from '../domain/notation.ts';
import type { Accidental, Letter, WrittenPitch } from '../domain/notation.ts';
import type { Practice, PromptToken } from '../engine/practice.ts';
import { answerControls } from './answers.ts';
import { answerFeedback } from './answer-feedback.ts';

export const keyboardGuidanceKey = 'tunotes:keyboard-accidental-guidance';

/** Shared entry surface and feedback lifecycle for every note-reading mode. */
export function noteEntry(accept: (answer: NoteAnswer, token: PromptToken) => void, options: {
  concurrentPointers?: boolean;
  fingering?: boolean;
  currentPitch?: () => WrittenPitch | undefined;
  onMethodChange?: () => void;
  guidance: () => boolean;
  showKeySignature: () => boolean | undefined;
  disableGuidance: () => void;
}) {
  const answers = answerControls(accept, options.concurrentPointers);
  const feedback = answerFeedback();
  const status = el('p', 'feedback'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const statusText = el('span');
  const dismiss = el('button', 'control keyboard-guidance-dismiss', 'Dismiss accidental reminders');
  dismiss.type = 'button'; dismiss.hidden = true;
  dismiss.addEventListener('click', () => { options.disableGuidance(); dismiss.hidden = true; feedback.clear(); });
  status.append(statusText, dismiss);
  let prompt = '';
  let method = 'names';
  let supported = false;
  const instruments = [
    ...['violin','viola','cello','double-bass'].map(instrument => ({value: instrument, label: instrument === 'double-bass' ? 'Double bass' : instrument[0]!.toUpperCase() + instrument.slice(1), instrument, valves: 3 as const})),
    { value: 'piano', label: 'Piano', instrument: undefined, valves: 3 as const },
    { value: 'trumpet-bb', label: 'B♭ Trumpet', instrument: 'trumpet-bb', valves: 3 as const },
    { value: 'horn-f', label: 'Horn in F (Dbl)', instrument: 'horn-f', valves: 3 as const },
    { value: 'euphonium-3', label: 'Euphonium – 3V', instrument: 'euphonium', valves: 3 as const },
    { value: 'euphonium-4', label: 'Euphonium – 4V', instrument: 'euphonium', valves: 4 as const },
    { value: 'tuba-3', label: 'B♭ Tuba – 3V', instrument: 'tuba', valves: 3 as const },
    { value: 'tuba-4', label: 'B♭ Tuba – 4V', instrument: 'tuba', valves: 4 as const },
  ];
  const pianoInstrument = instruments.find(item => item.value === 'piano')!;
  let selectedInstrument = pianoInstrument;
  let presetInstrument: string | undefined;
  let initialized = false;
  let instrumentChosen = false;
  let lastUpdate: Parameters<typeof answers.update> | undefined;
  const node = el('div', 'note-entry');
  const interaction = el('section', 'input-workspace');
  interaction.setAttribute('aria-label', 'Note answer input');
  const methodSelector = el('div', 'interaction-selector');
  methodSelector.setAttribute('role', 'group'); methodSelector.setAttribute('aria-label', 'Answer method');
  const methodButtons = new Map<string, HTMLButtonElement>();
  for (const [value, title] of [['names', 'Note Names'], ['instrument', 'Instrument']] as const) {
    const button = el('button', 'control', title); button.type = 'button';
    button.addEventListener('click', () => {
      if (value === 'instrument') {
        reset();
        if (instrumentPicker.matches(':popover-open')) instrumentPicker.hidePopover();
        else {
          const bounds = button.getBoundingClientRect();
          instrumentPicker.style.width = `${Math.min(320, innerWidth - 16)}px`;
          instrumentPicker.style.left = `${Math.max(8, Math.min(bounds.right - 320, innerWidth - 328))}px`;
          instrumentPicker.showPopover();
          const height = instrumentPicker.getBoundingClientRect().height;
          instrumentPicker.style.top = `${Math.max(8, bounds.top - height - 8)}px`;
          (instrumentPicker.querySelector<HTMLButtonElement>('[aria-pressed="true"]:not(:disabled)') ?? instrumentPicker.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
        }
        return;
      }
      const next = 'names';
      if (method === next) return;
      reset(); feedback.clear(); dismiss.hidden = true; method = next;
      options.onMethodChange?.(); refreshMethod();
    });
    methodButtons.set(value, button); methodSelector.append(button);
  }
  const interactionBody = el('div', 'interaction-body');
  const policy = new FingeringPolicy((mask, token) => accept({ kind: 'fingering', mask, instrument: selectedInstrument.instrument }, token));
  let configuration: ReturnType<typeof fingeringFor>;
  let fingers = fingeringInput([], (mask, intentional) => policy.change(mask, intentional));
  const keyboard = keyboardAnswers(accept);
  const fingeringPanel = el('div', 'fingering-panel'); fingeringPanel.hidden = true;
  const open = el('button', 'control fingering-open', 'Open (Space)'); open.type = 'button'; open.setAttribute('aria-keyshortcuts','Space');
  open.addEventListener('click', () => policy.open());
  open.addEventListener('keydown', e => { if (e.repeat && (e.key === ' ' || e.key === 'Enter')) e.preventDefault(); });
  const fingeringHelp = el('p', 'muted fingering-help');
  const side = el('p','muted horn-side','F side'); side.hidden = true;
  const instrumentPicker = el('div', 'instrument-picker');
  instrumentPicker.setAttribute('popover', 'auto');
  instrumentPicker.setAttribute('role', 'dialog'); instrumentPicker.setAttribute('aria-label', 'Choose instrument');
  const instrumentButton = methodButtons.get('instrument')!;
  instrumentButton.setAttribute('aria-haspopup', 'dialog');
  instrumentButton.setAttribute('aria-expanded', 'false');
  instrumentPicker.addEventListener('beforetoggle', event => instrumentButton.setAttribute('aria-expanded', String((event as ToggleEvent).newState === 'open')));
  const instrumentChoices = new Map<string, HTMLButtonElement>();
  for (const item of instruments) {
    const choice = el('button', 'control', item.label); choice.type = 'button';
    choice.dataset.instrument = item.value;
    choice.addEventListener('click', () => {
      reset(); feedback.clear(); dismiss.hidden = true;
      selectedInstrument = item; instrumentChosen = true;
      method = item.instrument ? 'fingering' : 'keyboard';
      options.onMethodChange?.();
      instrumentPicker.hidePopover();
      if (lastUpdate) update(...lastUpdate);
      // Resume playing without Space reactivating the instrument menu.
      if (method === 'keyboard') keyboard.focus();
      else fingers.node.querySelector('button')?.focus();
    });
    instrumentChoices.set(item.value, choice); instrumentPicker.append(choice);
  }
  const move = el('button', 'control fingering-move', 'Move'); move.type = 'button';
  const flip = el('button', 'control fingering-flip', 'Flip'); flip.type = 'button';
  const spacing = el('button', 'control fingering-spacing', 'Spacing'); spacing.type = 'button';
  const layoutTools = el('div', 'fingering-layout-tools'); layoutTools.append(move, flip, spacing);
  type Position = 'left' | 'bottom' | 'right';
  let position: Position = 'bottom', flipped = false;
  let selectedSpacing: FingerSpacing = 'regular';
  const spacings = new Map<string, FingerSpacing>();
  const spacingKey = () => `tunotes:finger-spacing:${selectedInstrument.value}`;
  const layouts = new Map<string, { position: Position; flipped: boolean }>();
  const orientation = matchMedia('(orientation: landscape)');
  const layoutKey = () => `tunotes:grip:${selectedInstrument.value}:${orientation.matches ? 'landscape' : 'portrait'}`;
  function applyLayout() {
    node.dataset.gripPosition = position;
    fingers.node.dataset.flipped = String(flipped);
    fingers.node.dataset.spacing = selectedSpacing;
    fingers.node.style.setProperty('--finger-spacing', `${fingerSpacing[selectedSpacing]}px`);
    const nextSpacing = spacingPresets[(spacingPresets.indexOf(selectedSpacing) + 1) % spacingPresets.length]!;
    const label = selectedSpacing[0]!.toUpperCase() + selectedSpacing.slice(1);
    spacing.setAttribute('aria-label', `Spacing: ${label}. Change to ${nextSpacing}`);
    spacing.title = `Spacing: ${label}`;
    const next = positions[(positions.indexOf(position) + 1) % positions.length]!;
    move.setAttribute('aria-label', `Move input: ${position}. Move to ${next}`);
    move.title = `Input on ${position}; move to ${next}`;
    flip.setAttribute('aria-label', 'Flip finger order');
    flip.setAttribute('aria-pressed', String(flipped));
    flip.title = 'Reverse finger order';
  }
  const positions: readonly Position[] = ['left', 'bottom', 'right'];
  function loadLayout() {
    fingers.reset(); policy.cancel();
    const key = layoutKey();
    let saved = layouts.get(key);
    if (!saved) try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (value && positions.includes(value.position) && typeof value.flipped === 'boolean') saved = value;
    } catch { /* Session-only layout if storage is unavailable. */ }
    position = saved?.position ?? (orientation.matches && matchMedia('(pointer: coarse)').matches
      ? configuration?.instrument === 'horn-f' ? 'left' : 'right' : 'bottom');
    flipped = saved?.flipped ?? false;
    const sessionSpacing = spacings.get(spacingKey());
    selectedSpacing = sessionSpacing ?? 'regular';
    if (!sessionSpacing) try {
      const value = localStorage.getItem(spacingKey());
      if (spacingPresets.includes(value as FingerSpacing)) selectedSpacing = value as FingerSpacing;
    } catch { /* Session-only spacing if storage is unavailable. */ }
    applyLayout();
  }
  function saveLayout() {
    const value = { position, flipped }; layouts.set(layoutKey(), value);
    try { localStorage.setItem(layoutKey(), JSON.stringify(value)); } catch { /* Session-only preference. */ }
    applyLayout();
  }
  move.addEventListener('click', () => {
    reset(); position = positions[(positions.indexOf(position) + 1) % positions.length]!; saveLayout();
  });
  flip.addEventListener('click', () => { reset(); flipped = !flipped; saveLayout(); });
  spacing.addEventListener('click', () => {
    reset(); selectedSpacing = spacingPresets[(spacingPresets.indexOf(selectedSpacing) + 1) % spacingPresets.length]!;
    spacings.set(spacingKey(), selectedSpacing);
    try { localStorage.setItem(spacingKey(), selectedSpacing); } catch { /* Session-only preference. */ }
    applyLayout();
  });
  for (const button of [move, flip, spacing]) button.addEventListener('pointerdown', () => reset());
  if (options.fingering) orientation.addEventListener('change', loadLayout);
  const fingeringActions = el('div','fingering-actions'); fingeringActions.append(side,open,layoutTools);
  fingeringPanel.append(fingers.node, fingeringActions, fingeringHelp);
  const reset = () => { answers.reset(); fingers.reset(); keyboard.reset(); policy.cancel(); };
  const refreshMethod = () => {
    const active = supported && method === 'fingering';
    answers.node.hidden = active || method === 'keyboard'; fingeringPanel.hidden = !active;
    keyboard.node.hidden = method !== 'keyboard'; keyboard.enable(method === 'keyboard');
    for (const [value, button] of methodButtons) button.setAttribute('aria-pressed', String(value === (method === 'names' ? 'names' : 'instrument')));
    instrumentButton.textContent = instrumentChosen ? selectedInstrument.label : 'Instrument';
    instrumentButton.setAttribute('aria-label', instrumentChosen ? `Choose instrument: ${selectedInstrument.label}` : 'Choose instrument');
    fingers.enable(active); node.dataset.inputMethod = active ? 'fingering' : method;
  };
  if (options.fingering) {
    interactionBody.append(answers.node, fingeringPanel, keyboard.node);
    interaction.append(methodSelector, interactionBody, instrumentPicker); node.append(interaction);
  } else node.append(answers.node);

  function update(...args: Parameters<typeof answers.update>) {
    lastUpdate = args;
    const [preset, token, locked] = args;
    if (!initialized || presetInstrument !== preset.instrument) {
      initialized = true; presetInstrument = preset.instrument;
      selectedInstrument = instruments.find(item => item.instrument === preset.instrument) ?? pianoInstrument;
    }
    for (const item of instruments) {
      const choice = instrumentChoices.get(item.value)!;
      const chart = fingeringFor(item.instrument, item.valves);
      choice.disabled = Boolean(item.instrument && (!chart || !preset.pool.every(p => chart.pitches[chromatic(p)])));
      choice.textContent = item.label + (choice.disabled ? ' (outside note range)' : '');
    }
    if (instrumentChoices.get(selectedInstrument.value)!.disabled) selectedInstrument = pianoInstrument;
    for (const item of instruments) instrumentChoices.get(item.value)!.setAttribute('aria-pressed', String(item === selectedInstrument));
    if (method !== 'names') method = selectedInstrument.instrument ? 'fingering' : 'keyboard';
    const config = options.fingering ? fingeringFor(selectedInstrument.instrument, selectedInstrument.valves) : undefined;
    supported = Boolean(config && preset.pool.every(p => config.pitches[chromatic(p)]));
    if (configuration !== config) {
      fingers.reset(); configuration = config;
      const previous = fingers.node;
      fingers = fingeringInput(config?.fingers ?? [], (mask, intentional) => {
        policy.change(mask,intentional);
        side.textContent = mask[3] === '1' ? 'B♭ side — trigger held' : 'F side';
      }, config?.instrument === 'horn-f' ? { index: 3, anchor: 0, along: -0.75, across: 1 } : undefined);
      previous.replaceWith(fingers.node);
      fingers.node.dataset.instrument = config?.instrument ?? '';
      fingers.node.dataset.hand = config?.hand ?? 'right';
      fingers.node.dataset.control = config?.control ?? 'valve';
      loadLayout();
      side.hidden = config?.instrument !== 'horn-f';
      fingeringHelp.textContent = config?.control === 'finger'
        ? 'F D S A = fingers 1–4 · Space = Open. Lower fingers may stay held.'
        : config?.instrument === 'horn-f'
        ? 'E W Q = valves · V = B♭ trigger. Space = F-side open.'
        : config?.fingers.length === 4 ? 'Hold J K L ; for valves 1–4. For no valves, press Space.'
        : 'Hold valves or J K L. For no valves, press Space.';
    }
    if (!supported && method === 'fingering') method = 'names';
    keyboard.update(token,locked,preset.pool[0]!.octave);
    const pitch = options.currentPitch?.();
    policy.update(token, locked, Boolean(pitch && config?.pitches[chromatic(pitch)]?.[0] === OPEN_FINGERING));
    open.disabled = locked;
    refreshMethod();
    const identity = `${token.session}:${token.prompt}`;
    if (identity !== prompt || locked) dismiss.hidden = true;
    prompt = identity;
    answers.update(...args);
  }

  // Keep controls and their live announcement together in every mode.
  node.append(feedback.node);
  return {
    ...answers, node, feedback, status, reset,
    dispose() { reset(); orientation.removeEventListener('change', loadLayout); },
    get isMusicalKeyboard() { return method === 'keyboard'; },
    get isFingering() { return supported && method === 'fingering'; },
    heldKeydown(event: KeyboardEvent) {
      if (!supported || method !== 'fingering' || instrumentPicker.matches(':popover-open')) return false;
      // Space is the flashcard Open action even when a valve has focus.
      // Leave unrelated buttons (Pause, Finish, etc.) their native activation.
      const button = event.target instanceof HTMLElement ? event.target.closest('button') : null;
      if (event.key === ' ' && (!button || button === open || fingers.node.contains(button))) {
        event.preventDefault();
        if (!event.repeat) policy.open();
        return true;
      }
      return fingers.keydown(event);
    },
    heldKeyup(event: KeyboardEvent) { fingers.keyup(event); },
    focus() { if (method === 'keyboard') keyboard.focus(); else if (supported && method === 'fingering') fingers.node.querySelector('button')?.focus(); else answers.focus(); },
    update,
    paused(paused: boolean) {
      if (paused) reset();
      statusText.textContent = paused ? 'Paused. Resume when you’re ready.' : '';
    },
    focusedKey(event: KeyboardEvent, fresh: boolean) {
      if (method === 'keyboard' || supported && method === 'fingering') return false;
      if ((event.key !== 'Enter' && event.key !== ' ') || !answers.buttons.includes(event.target as HTMLButtonElement)) return false;
      event.preventDefault();
      if (fresh) answers.focused(event.target as HTMLButtonElement);
      return true;
    },
    keyboard(letter: Letter, accidental: Accidental, explicit: boolean, session: Practice, shortcut?: (hint: string) => string) {
      if (instrumentPicker.matches(':popover-open') || method === 'keyboard' || supported && method === 'fingering') return;
      const hint = !explicit && options.guidance() && session.state === 'running'
        ? missingAccidentalHint(letter, session.pitch, session.preset, options.showKeySignature()) : undefined;
      if (hint) {
        answers.reset(); dismiss.hidden = false;
        feedback.show(shortcut ? shortcut(hint) : hint, false, 2500);
      } else answers.letter(letter, accidental);
    },
    respond(session: Practice, reward: { treat: boolean; text: string }, previousAnnouncement?: string) {
      if (session.last!.correct) feedback.celebrate(reward, session.announcement !== previousAnnouncement ? session.announcement : '');
      else feedback.show(session.continueAfter === 'correct' ? 'Try again' : `That note is ${spelling(session.pitch)}.`, false);
      // Toasts keep their own lifetime while the next prompt is immediately usable.
      if (session.continueAfter === 'instant') session.advance(session.token);
    },
  };
}
