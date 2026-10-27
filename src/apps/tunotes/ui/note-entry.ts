import { keyboardAnswers } from './keyboard-answers.ts';
import { fingeringInput } from '../../../shared/input/fingering-input.ts';
import { FingeringPolicy } from '../engine/fingering-policy.ts';
import { fingeringFor } from '../domain/fingering.ts';
import type { NoteAnswer } from '../domain/fingering.ts';
import { chromatic } from '../domain/notation.ts';
import { el } from '../../../shared/ui/components.ts';
import { missingAccidentalHint } from '../domain/keyboard-guidance.ts';
import { spelling } from '../domain/notation.ts';
import type { Accidental, Letter } from '../domain/notation.ts';
import type { Practice, PromptToken } from '../engine/practice.ts';
import { answerControls } from './answers.ts';
import { answerFeedback } from './answer-feedback.ts';

export const keyboardGuidanceKey = 'tunotes:keyboard-accidental-guidance';

/** Shared entry surface and feedback lifecycle for every note-reading mode. */
export function noteEntry(accept: (answer: NoteAnswer, token: PromptToken) => void, options: {
  concurrentPointers?: boolean;
  fingering?: boolean;
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
  let valveCount: 3 | 4 = 3;
  let lastUpdate: Parameters<typeof answers.update> | undefined;
  const node = el('div', 'note-entry');
  const methodLabel = el('label', 'fingering-method');
  const methodSelect = el('select', 'control'); methodSelect.setAttribute('aria-label', 'Answer method');
  for (const [value, title] of [['names', 'Note names'], ['keyboard', 'Musical keyboard'], ['fingering', 'Fingering']]) {
    const option = el('option', '', title); option.value = value!; methodSelect.append(option);
  }
  methodLabel.append(document.createTextNode('Answer method '), methodSelect); methodLabel.hidden = true;
  const policy = new FingeringPolicy((mask, token) => accept({ kind: 'fingering', mask }, token));
  let configuration: ReturnType<typeof fingeringFor>;
  let fingers = fingeringInput([], (mask, intentional) => policy.change(mask, intentional));
  const keyboard = keyboardAnswers(accept);
  const fingeringPanel = el('div', 'fingering-panel'); fingeringPanel.hidden = true;
  const open = el('button', 'control fingering-open', 'Open (Space)'); open.type = 'button'; open.setAttribute('aria-keyshortcuts','Space');
  open.addEventListener('click', () => policy.open());
  open.addEventListener('keydown', e => { if (e.repeat && (e.key === ' ' || e.key === 'Enter')) e.preventDefault(); });
  const fingeringHelp = el('p', 'muted fingering-help');
  const side = el('p','muted horn-side','F side'); side.hidden = true;
  const valveSelect = el('select','control'); valveSelect.setAttribute('aria-label','Valve configuration');
  for (const count of [3,4]) { const option = el('option','',`${count} valves`); option.value = String(count); valveSelect.append(option); }
  valveSelect.hidden = true;
  valveSelect.addEventListener('change', () => {
    reset(); feedback.clear(); options.onMethodChange?.();
    valveCount = valveSelect.value === '4' ? 4 : 3;
    if (lastUpdate) update(...lastUpdate);
  });
  const fingeringActions = el('div','fingering-actions'); fingeringActions.append(side,open,valveSelect);
  fingeringPanel.append(fingers.node, fingeringActions, fingeringHelp);
  const reset = () => { answers.reset(); fingers.reset(); keyboard.reset(); policy.cancel(); };
  const refreshMethod = () => {
    const active = supported && method === 'fingering';
    answers.node.hidden = active || method === 'keyboard'; fingeringPanel.hidden = !active;
    keyboard.node.hidden = method !== 'keyboard'; keyboard.enable(method === 'keyboard');
    fingers.enable(active); node.dataset.inputMethod = active ? 'fingering' : method;
  };
  methodSelect.addEventListener('change', () => { reset(); feedback.clear(); dismiss.hidden = true; method = methodSelect.value; options.onMethodChange?.(); refreshMethod(); });
  node.append(methodLabel, answers.node, fingeringPanel, keyboard.node);

  function update(...args: Parameters<typeof answers.update>) {
    lastUpdate = args;
    const [preset, token, locked] = args;
    valveSelect.hidden = !['tuba','euphonium'].includes(preset.instrument ?? '');
    const config = options.fingering ? fingeringFor(preset.instrument,valveCount) : undefined;
    supported = Boolean(config && preset.pool.every(p => config.pitches[chromatic(p)]));
    if (configuration !== config) {
      fingers.reset(); configuration = config;
      const previous = fingers.node;
      fingers = fingeringInput(config?.fingers ?? [], (mask, intentional) => {
        policy.change(mask,intentional);
        side.textContent = mask[3] === '1' ? 'B♭ side — trigger held' : 'F side';
      });
      previous.replaceWith(fingers.node);
      fingers.node.dataset.instrument = config?.instrument ?? '';
      side.hidden = config?.instrument !== 'horn-f';
      fingeringHelp.textContent = config?.instrument === 'horn-f'
        ? 'J K L = valves · N = B♭ trigger. Space = F-side open.'
        : config?.fingers.length === 4 ? 'Hold J K L ; for valves 1–4. For no valves, press Space.'
        : 'Hold valves or J K L. For no valves, press Space.';
    }
    const fingeringOption = methodSelect.querySelector<HTMLOptionElement>('option[value="fingering"]')!;
    fingeringOption.hidden = !supported; fingeringOption.disabled = !supported;
    if (!supported && method === 'fingering') { method = 'names'; methodSelect.value = method; }
    methodLabel.hidden = !options.fingering;
    keyboard.update(token,locked,preset.pool[0]!.octave);
    policy.update(token, locked);
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
    get isMusicalKeyboard() { return method === 'keyboard'; },
    get isFingering() { return supported && method === 'fingering'; },
    heldKeydown(event: KeyboardEvent) {
      if (!supported || method !== 'fingering') return false;
      // Space is the flashcard Open action even when a valve has focus.
      // Leave unrelated buttons (Pause, Finish, etc.) their native activation.
      const button = event.target instanceof HTMLElement ? event.target.closest('button') : null;
      if (event.key === ' ' && (!button || fingeringPanel.contains(button))) {
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
      if (method === 'keyboard' || supported && method === 'fingering') return;
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
