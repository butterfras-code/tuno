import type { AudioController } from '../../audio/controller.ts';
import { noteName } from '../../music/pitch.ts';
import { TONE_SOUNDS, type ToneSound } from '../../music/tone-sounds.ts';
import { LIMITS, toneHz } from '../../practice/state.ts';
import type { PracticeStore } from '../../practice/state.ts';
import { button, el, field, select, pitchText, responsiveLabel, row, uno, view, volumePopover, selectorPopover } from '../components.ts';

export function createTone(store: PracticeStore, audio: AudioController) {
  const node = view('tone', 'Reference tone');
  const top = el('div', 'tone-heading');
  const mini = el('div', 'mini-pitch');
  const miniNote = el('p', 'mini-note');
  const miniStatus = el('p', 'small teal');
  mini.append(el('p', 'eyebrow', 'Uno hears...'), miniNote, miniStatus);
  const friend = uno('tone-friend mobile-only');
  top.append(mini, friend);
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
  sound.classList.add('tone-sound');
  const soundField = field('Sound', sound);
  sound.setAttribute('aria-label', 'Tone sound');
  soundField.className = 'tone-sound-field';
  sound.title = 'Sine: pure tone. Triangle: gentle overtones. Rich: stronger overtones for low notes.';
  const controls = row(play, sustain, desktopVolume.node, soundField);
  controls.classList.add('tone-controls');
  const notes = selectorPopover('Choose note', Array.from({ length: 12 }, (_, value) => ({ value, label: noteName(60 + value).replace(/\d+$/, '') })), value => { store.dispatch({ type: 'tone-note', value: (store.get().octave + 1) * 12 + Number(value) }); void audio.playTone(); });
  const notePicker = notes.trigger;
  notePicker.classList.add('note-picker-trigger');
  notePicker.setAttribute('aria-controls', notes.popup.id);

  const selected = el('div', 'selected-tone');
  const selectedDetail = el('p', 'muted');
  selected.append(notePicker, selectedDetail);
  const decrease = button('− Octave', () => store.dispatch({ type: 'octave', value: store.get().octave - 1 }));
  const increase = button('+ Octave', () => store.dispatch({ type: 'octave', value: store.get().octave + 1 }));
  const keyboardTop = el('div', 'keyboard-heading');
  const octaveMenu = selectorPopover('Browse octave', Array.from({ length: LIMITS.octave.max }, (_, i) => ({ value: i + 1, label: String(i + 1) })), value => store.dispatch({ type: 'octave', value: Number(value) }));
  const octavePicker = octaveMenu.trigger;
  octavePicker.setAttribute('aria-controls', octaveMenu.popup.id);
  decrease.textContent = '−';
  decrease.setAttribute('aria-label', '− Octave');
  increase.textContent = '+';
  increase.setAttribute('aria-label', '+ Octave');
  keyboardTop.append(selected, row(decrease, octavePicker, increase));

  const keyboard = el('div', 'keyboard-layout');
  const scroll = el('div', 'piano-scroll');
  const piano = el('div', 'piano');
  piano.setAttribute('role', 'group');
  piano.setAttribute('aria-label', 'Concert-pitch keyboard');
  scroll.append(piano);
  keyboard.append(scroll);
  // One octave of keys, kept mounted so selection changes preserve keyboard focus.
  const whiteSemitones = [0, 2, 4, 5, 7, 9, 11, 12, 14];
  const keys = Array.from({ length: 15 }, (_, semitone) => {
    let activeNote: number | undefined;
    let suppressClick = false;
    const note = () => (store.get().octave + 1) * 12 + semitone;
    const press = () => {
      activeNote = note();
      audio.pressToneKey(activeNote);
    };
    const release = () => {
      if (activeNote !== undefined) audio.releaseToneKey(activeNote);
      activeNote = undefined;
    };
    const key = button('', () => {
      if (suppressClick) { suppressClick = false; return; }
      audio.pressToneKey(note());
    });
    key.addEventListener('pointerdown', event => {
      if (event.button !== 0 || store.get().sustain) return;
      suppressClick = true;
      key.setPointerCapture(event.pointerId);
      press();
    });
    key.addEventListener('pointerup', release);
    key.addEventListener('pointercancel', release);
    key.addEventListener('contextmenu', event => event.preventDefault());
    key.addEventListener('keydown', event => {
      if (store.get().sustain || event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
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
  const keyboardHint = el('p', 'keyboard-hint small muted');
  const primary = el('div', 'tone-primary');
  primary.append(top, controls, keyboardTop, keyboard, keyboardHint);

  node.append(primary, notes.popup, octaveMenu.popup);

  let lastFocus = store.get().focus;
  let lastOctave = store.get().octave;
  store.subscribe((state) => {
    node.hidden = state.focus !== 'tone';

    sustain.textContent = `Sustain ${state.sustain ? 'on' : 'off'}`;
    sustain.setAttribute('aria-pressed', String(state.sustain));
    volume.value = String(state.toneVolume);
    sound.value = state.toneSound;
    desktopVolume.trigger.textContent = `Volume ${state.toneVolume}%`;
    friend.hidden = !state.showUno;
    notes.update(state.toneNote % 12, noteName(state.toneNote));
    octaveMenu.update(state.octave);
    octavePicker.textContent = `Octave ${state.octave}`;
    responsiveLabel(keyboardHint,
      'Choose an octave above · Use − / +',
      `Swipe keys to explore · ${noteName(state.toneNote)} ${state.tonePlaying ? 'keeps sounding' : 'selected'}`);
    play.textContent = state.tonePlaying ? 'Stop tone' : 'Play tone';
    selectedDetail.textContent = `${toneHz(state).toFixed(1)} Hz`;
    const pitch = pitchText(state);
    miniNote.textContent = pitch.note;
    miniStatus.textContent = state.micStatus !== 'idle' ? `${state.micStatus} · ${pitch.direction}` : state.manualHz === null ? 'No sample' : pitch.direction;
    decrease.disabled = state.octave === LIMITS.octave.min;
    increase.disabled = state.octave === LIMITS.octave.max;
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
