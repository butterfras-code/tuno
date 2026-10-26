import { el } from '../../../shared/ui/components.ts';
import { missingAccidentalHint } from '../domain/keyboard-guidance.ts';
import { spelling } from '../domain/notation.ts';
import type { Accidental, AnswerSpelling, Letter } from '../domain/notation.ts';
import type { Practice, PromptToken } from '../engine/practice.ts';
import { answerControls } from './answers.ts';
import { answerFeedback } from './answer-feedback.ts';

export const keyboardGuidanceKey = 'tunotes:keyboard-accidental-guidance';

/** Shared entry surface and feedback lifecycle for every note-reading mode. */
export function noteEntry(accept: (answer: AnswerSpelling, token: PromptToken) => void, options: {
  concurrentPointers?: boolean;
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

  // Keep controls and their live announcement together in every mode.
  answers.node.append(feedback.node);
  return {
    ...answers, feedback, status,
    update(...args: Parameters<typeof answers.update>) {
      const [, token, locked] = args;
      const identity = `${token.session}:${token.prompt}`;
      if (identity !== prompt || locked) dismiss.hidden = true;
      prompt = identity;
      answers.update(...args);
    },
    paused(paused: boolean) {
      statusText.textContent = paused ? 'Paused. Resume when you’re ready.' : '';
    },
    focusedKey(event: KeyboardEvent, fresh: boolean) {
      if ((event.key !== 'Enter' && event.key !== ' ') || !answers.buttons.includes(event.target as HTMLButtonElement)) return false;
      event.preventDefault();
      if (fresh) answers.focused(event.target as HTMLButtonElement);
      return true;
    },
    keyboard(letter: Letter, accidental: Accidental, explicit: boolean, session: Practice, shortcut?: (hint: string) => string) {
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
