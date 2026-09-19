import { noteName } from '../../music/pitch.ts';
import { LIMITS, toneHz } from '../../practice/state.ts';
import type { PracticeStore } from '../../practice/state.ts';
import { button, el, field, heading, pitchText, row, unavailableButton, view } from '../components.ts';

export function createTone(store: PracticeStore) {
  const node = view('tone', 'Reference tone');
  const top = el('div', 'tone-heading');
  const mini = el('div', 'mini-pitch');
  const miniNote = el('p', 'mini-note');
  const miniStatus = el('p', 'small teal');
  mini.append(el('p', 'eyebrow', 'SAMPLE TUNER'), miniNote, miniStatus);
  top.append(heading('Find your note.', 'Choose a key. Find a note to practice.'), mini);
  const sustain = button('Sustain on', () => store.dispatch({ type: 'sustain', value: !store.get().sustain }));
  const volume = el('input');
  Object.assign(volume, { type: 'range', min: '0', max: '100', step: '1' });
  volume.addEventListener('input', () => store.dispatch({ type: 'tone-volume', value: Number(volume.value) }));
  const volumeLabel = field('Tone volume', volume);
  volumeLabel.classList.add('volume-control');
  const volumeValue = el('output', 'small');
  volumeLabel.append(volumeValue);
  const controls = row(sustain, unavailableButton('Play tone', 'audio-availability'), volumeLabel);

  const selected = el('div', 'selected-tone');
  const selectedName = el('p', 'selected-note');
  const selectedDetail = el('p', 'muted');
  selected.append(selectedName, selectedDetail);
  const decrease = button('− Octave', () => store.dispatch({ type: 'octave', value: store.get().octave - 1 }));
  const increase = button('+ Octave', () => store.dispatch({ type: 'octave', value: store.get().octave + 1 }));
  const keyboardTop = el('div', 'keyboard-heading');
  keyboardTop.append(selected, row(decrease, increase));

  const keyboard = el('div', 'keyboard-layout');
  const scroll = el('div', 'piano-scroll');
  const piano = el('div', 'piano');
  piano.setAttribute('role', 'group');
  piano.setAttribute('aria-label', 'Concert-pitch keyboard');
  scroll.append(piano);
  const rail = el('div', 'octave-rail');
  rail.setAttribute('role', 'group');
  rail.setAttribute('aria-label', 'Browse octaves');
  rail.append(el('p', 'eyebrow', 'OCTAVE'));
  const octaves: HTMLButtonElement[] = [];
  for (let octave = LIMITS.octave.max; octave >= LIMITS.octave.min; octave--) {
    const item = button(String(octave), () => store.dispatch({ type: 'octave', value: octave }));
    item.setAttribute('aria-label', `Octave ${octave}`);
    octaves.push(item);
    rail.append(item);
  }
  keyboard.append(scroll, rail);
  // One octave of keys, kept mounted so selection changes preserve keyboard focus.
  const whiteSemitones = [0, 2, 4, 5, 7, 9, 11, 12];
  const keys = Array.from({ length: 13 }, (_, semitone) => {
    const key = button('', () => store.dispatch({ type: 'tone-note', value: (store.get().octave + 1) * 12 + semitone }));
    const whiteIndex = whiteSemitones.indexOf(semitone);
    key.className = `piano-key ${whiteIndex < 0 ? 'piano-key--black' : 'piano-key--white'}`;
    if (whiteIndex >= 0) key.style.gridColumn = String(whiteIndex + 1);
    else key.style.left = `${(whiteSemitones.filter((value) => value < semitone).length / 8) * 100}%`;
    piano.append(key);
    return key;
  });
  node.append(top, controls, keyboardTop, keyboard,
    el('p', 'small muted', 'Concert-pitch keys · Browsing octaves keeps your selected note. Scroll the keyboard on small screens. Playback is coming next.'));

  store.subscribe((state) => {
    node.hidden = state.focus !== 'tone';
    sustain.textContent = `Sustain ${state.sustain ? 'on' : 'off'}`;
    sustain.setAttribute('aria-pressed', String(state.sustain));
    volume.value = String(state.toneVolume);
    volumeValue.textContent = `${state.toneVolume}%`;
    selectedName.textContent = noteName(state.toneNote);
    selectedDetail.textContent = `Selected · ${toneHz(state).toFixed(1)} Hz`;
    const pitch = pitchText(state);
    miniNote.textContent = pitch.note;
    miniStatus.textContent = state.manualHz === null ? 'No sample' : pitch.direction;
    decrease.disabled = state.octave === LIMITS.octave.min;
    increase.disabled = state.octave === LIMITS.octave.max;
    for (const item of octaves) item.setAttribute('aria-pressed', String(Number(item.textContent) === state.octave));
    keys.forEach((key, semitone) => {
      const note = (state.octave + 1) * 12 + semitone;
      const name = noteName(note);
      key.textContent = name;
      key.setAttribute('aria-label', `Select ${name}`);
      key.setAttribute('aria-pressed', String(note === state.toneNote));
    });
  });
  return node;
}
