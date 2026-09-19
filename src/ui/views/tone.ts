import type { AudioController } from '../../audio/controller.ts';
import { noteName } from '../../music/pitch.ts';
import { TONE_SOUNDS, type ToneSound } from '../../music/tone-sounds.ts';
import { LIMITS, toneHz } from '../../practice/state.ts';
import type { PracticeStore } from '../../practice/state.ts';
import { button, el, select, heading, pitchText, responsiveLabel, row, uno, view, volumePopover, selectorPopover } from '../components.ts';

export function createTone(store: PracticeStore, audio: AudioController) {
  const node = view('tone', 'Reference tone');
  const top = el('div', 'tone-heading');
  const mini = el('div', 'mini-pitch');
  const miniNote = el('p', 'mini-note');
  const miniStatus = el('p', 'small teal');
  mini.append(el('p', 'eyebrow', 'Uno hears...'), miniNote, miniStatus);
  const friend = uno('tone-friend mobile-only');
  top.append(heading('Find your note.', 'Choose a key. Find a note to practice.'), mini, friend);
  const sustain = button('Sustain on', () => store.dispatch({ type: 'sustain', value: !store.get().sustain }));
  const volume = el('input');
  Object.assign(volume, { type: 'range', min: '0', max: '100', step: '1' });
  volume.addEventListener('input', () => store.dispatch({ type: 'tone-volume', value: Number(volume.value) }));
  const play = button('Play tone', audio.toggleTone);
  const desktopVolume = volumePopover('Tone volume', volume);
  desktopVolume.node.classList.remove('mobile-only');
  desktopVolume.node.classList.add('desktop-tone-volume');
  const sound = select(TONE_SOUNDS, value => store.dispatch({ type: 'tone-sound', value: value as ToneSound }));
  sound.setAttribute('aria-label', 'Tone sound');
  sound.classList.add('tone-sound', 'desktop-only');
  sound.title = 'Sine: pure tone. Triangle: gentle overtones. Rich: stronger overtones for low notes.';
  const controls = row(sustain, desktopVolume.node, sound, play);
  controls.classList.add('tone-controls');
  const notes = selectorPopover('Choose note', Array.from({ length: 12 }, (_, value) => ({ value, label: noteName(60 + value).replace(/\d+$/, '') })), value => { store.dispatch({ type: 'tone-note', value: (store.get().octave + 1) * 12 + Number(value) }); void audio.playTone(); });
  const notePicker = notes.trigger;
  notePicker.classList.add('note-picker-trigger', 'mobile-only');
  notePicker.setAttribute('aria-controls', notes.popup.id);
  controls.prepend(notePicker);

  const selected = el('div', 'selected-tone');
  const selectedName = el('p', 'selected-note');
  const selectedDetail = el('p', 'muted');
  selected.append(selectedName, selectedDetail);
  const decrease = button('− Octave', () => store.dispatch({ type: 'octave', value: store.get().octave - 1 }));
  const increase = button('+ Octave', () => store.dispatch({ type: 'octave', value: store.get().octave + 1 }));
  const keyboardTop = el('div', 'keyboard-heading');
  const octaveMenu = selectorPopover('Browse octave', Array.from({ length: LIMITS.octave.max }, (_, i) => ({ value: i + 1, label: String(i + 1) })), value => store.dispatch({ type: 'octave', value: Number(value) }));
  const octavePicker = octaveMenu.trigger;
  octavePicker.classList.add('mobile-only');
  octavePicker.setAttribute('aria-controls', octaveMenu.popup.id);
  responsiveLabel(decrease, '− Octave', '−');
  responsiveLabel(increase, '+ Octave', '+');
  keyboardTop.append(selected, row(decrease, octavePicker, increase));

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
  const whiteSemitones = [0, 2, 4, 5, 7, 9, 11, 12, 14];
  const keys = Array.from({ length: 15 }, (_, semitone) => {
    const key = button('', () => { audio.pressToneKey((store.get().octave + 1) * 12 + semitone); });
    const whiteIndex = whiteSemitones.indexOf(semitone);
    key.className = `piano-key ${whiteIndex < 0 ? 'piano-key--black' : 'piano-key--white'}`;
    if (semitone > 12) key.classList.add('piano-key--extension');
    if (whiteIndex >= 0) key.style.gridColumn = String(whiteIndex + 1);
    else key.style.left = `calc(${whiteSemitones.filter((value) => value < semitone).length} * 100% / var(--white-key-count, 8))`;
    piano.append(key);
    return key;
  });
  const keyboardHint = el('p', 'keyboard-hint small muted');
  const mobileVolume = volume.cloneNode() as HTMLInputElement;
  mobileVolume.addEventListener('input', () => store.dispatch({ type: 'tone-volume', value: Number(mobileVolume.value) }));
  const compactVolume = volumePopover('Tone output volume', mobileVolume);
  const mobilePlay = button('Play tone', audio.toggleTone);
  const mobileSound = select(TONE_SOUNDS, value => store.dispatch({ type: 'tone-sound', value: value as ToneSound }));
  mobileSound.setAttribute('aria-label', 'Tone output sound');
  mobileSound.classList.add('tone-sound');
  mobileSound.title = sound.title;
  const outputControls = row(compactVolume.node, mobileSound, mobilePlay);
  outputControls.classList.add('tone-output', 'mobile-only');
  const primary = el('div', 'tone-primary');
  primary.append(top, controls, keyboardTop, keyboard, keyboardHint, outputControls);

  node.append(primary, notes.popup, octaveMenu.popup);

  let lastFocus = store.get().focus;
  let lastOctave = store.get().octave;
  store.subscribe((state) => {
    node.hidden = state.focus !== 'tone';

    sustain.textContent = `Sustain ${state.sustain ? 'on' : 'off'}`;
    sustain.setAttribute('aria-pressed', String(state.sustain));
    volume.value = String(state.toneVolume);
    sound.value = mobileSound.value = state.toneSound;
    desktopVolume.trigger.textContent = `Volume ${state.toneVolume}%`;
    selectedName.textContent = noteName(state.toneNote);
    mobileVolume.value = String(state.toneVolume);
    compactVolume.trigger.textContent = `Volume ${state.toneVolume}%`;
    mobilePlay.textContent = state.tonePlaying ? 'Stop tone' : 'Play tone';
    friend.hidden = !state.showUno;
    notes.update(state.toneNote % 12);
    octaveMenu.update(state.octave);
    notePicker.textContent = `Note · ${noteName(state.toneNote)}`;
    octavePicker.textContent = `Octave ${state.octave} ↕`;
    responsiveLabel(keyboardHint,
      'Drag the octave handle · Scroll or use − / +',
      `Swipe keys to explore · ${noteName(state.toneNote)} ${state.tonePlaying ? 'keeps sounding' : 'selected'}`);
    play.textContent = state.tonePlaying ? 'Stop tone' : 'Play tone';
    selectedDetail.textContent = `${state.tonePlaying ? 'Playing' : 'Selected'} · ${toneHz(state).toFixed(1)} Hz`;
    const pitch = pitchText(state);
    miniNote.textContent = pitch.note;
    miniStatus.textContent = state.micStatus !== 'idle' ? `${state.micStatus} · ${pitch.direction}` : state.manualHz === null ? 'No sample' : pitch.direction;
    decrease.disabled = state.octave === LIMITS.octave.min;
    increase.disabled = state.octave === LIMITS.octave.max;
    for (const item of octaves) item.setAttribute('aria-pressed', String(Number(item.textContent) === state.octave));
    keys.forEach((key, semitone) => {
      const note = (state.octave + 1) * 12 + semitone;
      const name = noteName(note);
      responsiveLabel(key, semitone === 0 || semitone === 12 ? name : name.replace(/-?\d+$/, ''), semitone === 0 || semitone === 5 || semitone === 12 ? name : name.replace(/-?\d+$/, ''));
      key.setAttribute('aria-label', `Select ${name}`);
      key.disabled = note > 96;
      key.setAttribute('aria-pressed', String(note === state.toneNote));
    });
    if (state.focus === 'tone' && (lastFocus !== 'tone' || lastOctave !== state.octave) && window.matchMedia('(max-width: 650px)').matches) {
      const semitone = state.toneNote - (state.octave + 1) * 12;
      if (semitone >= 0 && semitone <= 12) {
        const index = whiteSemitones.filter((value) => value <= semitone).length - 1;
        scroll.scrollLeft = Math.max(0, index * 64 - scroll.clientWidth / 2 + 32);
      }
    }
    lastFocus = state.focus;
    lastOctave = state.octave;
  });
  return node;
}
