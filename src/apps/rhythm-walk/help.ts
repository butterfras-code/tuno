import { el } from '../../shared/ui/components.ts';

export function createHelpPage() {
  const page = el('section', 'rhythm-help'); page.id = 'help-view'; page.setAttribute('aria-label', 'Help');
  page.append(el('p', '', 'Learn a rhythm by counting it, then try playing it. You can go back to Practice whenever you are ready. Your answers will still be there.'));
  function section(title: string, ...paragraphs: string[]) {
    const content = el('section');
    content.append(el('h3', '', title), ...paragraphs.map(text => el('p', '', text)));
    page.append(content);
    return content;
  }
  const start = section('Start here');
  const steps = el('ol');
  for (const text of [
    'Open Practice. Use Choose rhythms to pick a rhythm level. If your teacher sent you a link, start with the rhythm it opens.',
    'Choose Counts to write the counts under the music, or Perform to tap the rhythm.',
    'Look at Feedback to see how you did. Try again, or choose Next Exercise for a new rhythm.',
  ]) steps.append(el('li', '', text));
  start.append(steps);
  section('Write the counts',
    'Choose Counts, then tap or click a box under the music. Choose a number or counting sound from the buttons, or type it on your keyboard.',
    'Start counting at 1 again after each barline (the upright line that divides the music). If the rhythm is wider than the screen, scroll sideways to see more.',
    'A rest means silence. When the Rest button is shown, use it to mark the counts that belong to a rest. Connect joins the counts for a long note or notes joined by a tie. A tie is a curved line that joins notes into one longer sound. These buttons change the whole note, rest, or tied group you selected. Press the button again to undo it.',
    'Choose Check to check your work. You can fix your answers and check again. Erase clears the selected count box. Erase All clears all your written answers.');
  const perform = section('Play the rhythm',
    'Choose Perform. Tempo controls how fast the music goes. Try a slower tempo while you learn. On a small screen, open Options to find How to play and the metronome (a steady click that helps you keep the beat).',
    'In Tap, tap once when each note starts. Notes joined by a tie need just one tap at the start. In Tap + Hold, keep pressing for the whole note, then lift before the next note. Keep holding through a tie. Do not tap during rests.');
  const performanceInstructions = el('div'); perform.append(performanceInstructions);
  perform.append(el('p', '', 'Choose Stop if you need a break. Opening Settings or Help also stops the performance. Go back to Practice when you want to try again.'));
  section('See how you did',
    'Open Feedback to review your counts or your tapping. Mistakes are clues about what to practice next. Try the same rhythm again and see what improves!',
    'Switching between Counts and Perform keeps your work. Next Exercise starts a new rhythm and clears both answers. Reloading the page also clears your answers.');
  section('Change your settings',
    'Open Settings to choose how to write counts. The example shows what your choices look like. Use the counting sounds your teacher has taught you.',
    'Subdivide means adding counts inside a long note or rest to help you keep your place. Dotted subdivision does this for dotted notes. Other choices change how rests and connected counts look.',
    'Choose Save to use your counting choices in Practice. Answers that still fit are kept; some boxes may need to be filled in again.',
    'Share settings shares your counting choices, including changes you have not saved yet. It does not share your current rhythm. If you opened shared settings, choose Save as my defaults only if you want to keep those choices for next time.');
  section('Keyboard tips',
    'Select a count box, then type your answer. Use the arrow keys to move between boxes and Enter to check. R marks a rest and C connects counts when those choices are available. Backspace or Delete clears the selected count.',
    'For counting sounds, type t then a for ta, or t then e for te. Type l for la and i for li.',
    'To play with a keyboard, use Tab to move to the performance pad, then use the Space bar to start and play.');
  return { page, performanceInstructions };
}
