import { fingeringInput } from '../../../shared/input/fingering-input.ts';
import { FingeringPolicy } from '../engine/fingering-policy.ts';
import { fingeringFor, trumpetFingering } from '../domain/fingering.ts';
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
  const node = el('div', 'note-entry');
  const methodLabel = el('label', 'fingering-method');
  const methodSelect = el('select', 'control'); methodSelect.setAttribute('aria-label', 'Answer method');
  for (const [value, title] of [['names', 'Note names'], ['fingering', 'Fingering']]) {
    const option = el('option', '', title); option.value = value!; methodSelect.append(option);
  }
  methodLabel.append(document.createTextNode('Answer method '), methodSelect); methodLabel.hidden = true;
  const policy = new FingeringPolicy((mask, token) => accept({ kind: 'fingering', mask }, token));
  const fingers = fingeringInput(trumpetFingering.fingers, (mask, intentional) => policy.change(mask, intentional));
  const fingeringPanel = el('div', 'fingering-panel'); fingeringPanel.hidden = true;
  const open = el('button', 'control fingering-open', 'Open (0)'); open.type = 'button';
  open.addEventListener('click', () => policy.open());
  open.addEventListener('keydown', e => { if (e.repeat && (e.key === ' ' || e.key === 'Enter')) e.preventDefault(); });
  fingeringPanel.append(fingers.node, open, el('p', 'muted fingering-help', 'Hold valves or J K L. For no valves, choose Open (0).'));
  const reset = () => { answers.reset(); fingers.reset(); policy.cancel(); };
  const refreshMethod = () => {
    const active = supported && method === 'fingering';
    answers.node.hidden = active; fingeringPanel.hidden = !active;
    fingers.enable(active); node.dataset.inputMethod = active ? 'fingering' : 'names';
  };
  methodSelect.addEventListener('change', () => { reset(); feedback.clear(); dismiss.hidden = true; method = methodSelect.value; options.onMethodChange?.(); refreshMethod(); });
  node.append(methodLabel, answers.node, fingeringPanel);

  // Keep controls and their live announcement together in every mode.
  node.append(feedback.node);
  return {
    ...answers, node, feedback, status, reset,
    get isFingering() { return supported && method === 'fingering'; },
    heldKeydown(event: KeyboardEvent) { return supported && method === 'fingering' && fingers.keydown(event); },
    heldKeyup(event: KeyboardEvent) { fingers.keyup(event); },
    focus() { if (supported && method === 'fingering') fingers.node.querySelector('button')?.focus(); else answers.focus(); },
    update(...args: Parameters<typeof answers.update>) {
      const [preset, token, locked] = args;
      const config = options.fingering ? fingeringFor(preset.instrument) : undefined;
      supported = Boolean(config && preset.pool.every(p => config.pitches[chromatic(p)]));
      methodLabel.hidden = !supported;
      policy.update(token, locked);
      open.disabled = locked;
      refreshMethod();
      const identity = `${token.session}:${token.prompt}`;
      if (identity !== prompt || locked) dismiss.hidden = true;
      prompt = identity;
      answers.update(...args);
    },
    paused(paused: boolean) {
      if (paused) reset();
      statusText.textContent = paused ? 'Paused. Resume when you’re ready.' : '';
    },
    focusedKey(event: KeyboardEvent, fresh: boolean) {
      if (supported && method === 'fingering') return false;
      if ((event.key !== 'Enter' && event.key !== ' ') || !answers.buttons.includes(event.target as HTMLButtonElement)) return false;
      event.preventDefault();
      if (fresh) answers.focused(event.target as HTMLButtonElement);
      return true;
    },
    keyboard(letter: Letter, accidental: Accidental, explicit: boolean, session: Practice, shortcut?: (hint: string) => string) {
      if (supported && method === 'fingering') return;
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
