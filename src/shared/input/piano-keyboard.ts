import { el } from '../ui/components.ts';

/** Shared tUno keyboard geometry and physical key interactions. Owners supply pitch and effects. */
export function pianoKeyboard(options: {
  note: (semitone: number) => number;
  press: (note: number) => void;
  release: (note: number) => void;
  sustain?: () => boolean;
  enabled?: () => boolean;
  label: string;
}) {
  const keyboard = el('div', 'keyboard-layout');
  const scroll = el('div', 'piano-scroll');
  const piano = el('div', 'piano');
  piano.setAttribute('role', 'group');
  piano.setAttribute('aria-label', options.label);
  scroll.append(piano);
  keyboard.append(scroll);
  // One octave of keys, kept mounted so selection changes preserve keyboard focus.
  const whiteSemitones = [0, 2, 4, 5, 7, 9, 11, 12, 14];
  const releases: (() => void)[] = [];
  const keys = Array.from({ length: 15 }, (_, semitone) => {
    let activeNote: number | undefined;
    let suppressClick = false;
    const note = () => options.note(semitone);
    const press = () => {
      activeNote = note();
      options.press(activeNote);
    };
    const release = () => {
      if (activeNote !== undefined) options.release(activeNote);
      activeNote = undefined;
    };
    const key = el('button'); key.type = 'button';
    key.addEventListener('click', event => {
      if (options.enabled?.() === false) return;
      if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
      options.press(note());
    });
    key.addEventListener('pointerdown', event => {
      if (options.enabled?.() === false || event.button !== 0 || options.sustain?.()) return;
      suppressClick = true;
      key.setPointerCapture(event.pointerId);
      press();
    });
    key.addEventListener('pointerup', release);
    key.addEventListener('pointercancel', release);
    key.addEventListener('lostpointercapture', release);
    key.addEventListener('blur', release);
    releases.push(release);
    key.addEventListener('contextmenu', event => event.preventDefault());
    key.addEventListener('keydown', event => {
      if (options.sustain?.() || (event.key !== ' ' && event.key !== 'Enter')) return;
      event.preventDefault();
      if (options.enabled?.() === false || event.repeat || activeNote !== undefined) return;
      suppressClick = true;
      press();
    });
    key.addEventListener('keyup', event => {
      if (event.key === ' ' || event.key === 'Enter') release();
    });
    const whiteIndex = whiteSemitones.indexOf(semitone);
    key.className = `piano-key ${whiteIndex < 0 ? 'piano-key--black' : 'piano-key--white'}`;
    if (semitone > 12) key.classList.add('piano-key--extension');
    if (whiteIndex >= 0) key.style.gridColumn = String(whiteIndex + 1);
    else key.style.left = `calc(${whiteSemitones.filter((value) => value < semitone).length} * 100% / var(--white-key-count, 8))`;
    piano.append(key);
    return key;
  });
  return { node: keyboard, scroll, keys, whiteSemitones, reset: () => releases.forEach(release => release()) };
}
