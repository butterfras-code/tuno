import { pianoKeyboard } from '../../shared/input/piano-keyboard.ts';
import { onUnmount } from '../../shared/ui/unmount.ts';
import type { AudioController } from '../../audio/controller.ts';
import { noteName } from '../../music/pitch.ts';
import { TONE_SOUNDS, type ToneSound } from '../../music/tone-sounds.ts';
import boneAsset from '../../assets/pitch-bone.svg';
import firesideBoneAsset from '../../assets/pitch-bone-fireside.svg';
import micAsset from '../../assets/mic.svg';
import { pickAsset } from '../../shared/theme/assets.ts';
import { subscribeTheme } from '../../shared/theme/state.ts';

const pitchBones = { default: boneAsset, fireside: firesideBoneAsset } as const;
import { LIMITS, toneHz, pitchReading } from '../../practice/state.ts';
import type { PracticeStore } from '../../practice/state.ts';
import { button, el, micStatusText, field, select, pitchText, responsiveLabel, row, uno, view, volumePopover, selectorPopover } from '../components.ts';

export function createTone(store: PracticeStore, audio: AudioController) {
  const node = view('tone', 'Reference tone');
  const top = el('div', 'tone-heading');
  const mini = el('div', 'mini-pitch');
  const miniNote = el('p', 'mini-note');
  const miniMic = button('Activate Mic', audio.toggleMic);
  miniMic.classList.add('mini-mic-button');
  const miniMicIcon = el('img', 'control-icon');
  Object.assign(miniMicIcon, { src: micAsset, alt: '' });
  const miniMicLabel = el('span', 'mini-mic-label', 'Activate Mic');
  miniMic.replaceChildren(miniMicIcon, miniMicLabel);
  const miniFeedback = el('p', 'mini-feedback teal');
  const miniReadout = el('div', 'mini-readout');
  miniReadout.append(miniMic, miniNote, miniFeedback);
  const lane = el('div', 'mini-lane');
  lane.setAttribute('aria-hidden', 'true');
  lane.append(el('span', 'mini-flat', '♭'), el('div', 'mini-gradient'), el('div', 'mini-center'), el('span', 'mini-sharp', '♯'));
  for (const cents of [-50, -25, 0, 25, 50]) {
    const tick = el('span', 'mini-tick');
    tick.style.left = `${50 + cents}%`;
    lane.append(tick);
  }
  const marker = el('img', 'mini-marker');
  Object.assign(marker, { src: pickAsset(pitchBones), alt: '' });
  marker.hidden = true;
  const stopBoneTheme = subscribeTheme(theme => { marker.src = pickAsset(pitchBones, theme); });
  lane.append(marker);
  mini.append(el('p', 'eyebrow', 'Uno hears...'), miniReadout, lane);
  const friend = uno('tone-friend mobile-only');
  top.append(mini, friend);
  const sustain = button('Sustain on', () => store.dispatch({ type: 'sustain', value: !store.get().sustain }));
  sustain.classList.add('control--toggle');
  const volume = el('input');
  Object.assign(volume, { type: 'range', min: '0', max: '100', step: '1' });
  volume.addEventListener('input', () => store.dispatch({ type: 'tone-volume', value: Number(volume.value) }));
  const play = button('Play tone', audio.toggleTone, true);
  play.classList.add('tone-play');
  const desktopVolume = volumePopover('Tone volume', volume);
  desktopVolume.node.classList.remove('mobile-only');
  desktopVolume.node.classList.add('desktop-tone-volume');
  const sound = select(TONE_SOUNDS, value => store.dispatch({ type: 'tone-sound', value: value as ToneSound }));
  sound.setAttribute('aria-label', 'Tone sound');
  sound.classList.add('tone-sound');
  const soundField = field('Sound', sound);
  sound.setAttribute('aria-label', 'Tone sound');
  soundField.className = 'tone-sound-field';
  sound.title = 'Sine: pure tone. Triangle: gentle overtones. Rich: stronger overtones for low notes. Sweet: rounded clarinet/sax-like reeds. Clear: bright oboe/trumpet-like overtones.';
  const controls = row(play, sustain, desktopVolume.node, soundField);
  controls.classList.add('tone-controls');
  const notes = selectorPopover('Choose note', Array.from({ length: 73 }, (_, index) => ({ value: 24 + index, label: noteName(24 + index) })), value => { store.dispatch({ type: 'tone-note', value: Number(value) }); void audio.playTone(); });
  notes.popup.classList.add('tone-note-popup');
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
  octavePicker.classList.add('keyboard-octave-picker');
  const keyboardLabel = el('span', 'keyboard-octave-label', 'Keyboard');
  const octaveValue = el('span');
  octavePicker.setAttribute('aria-controls', octaveMenu.popup.id);
  decrease.textContent = '−';
  decrease.setAttribute('aria-label', '− Octave');
  increase.textContent = '+';
  increase.setAttribute('aria-label', '+ Octave');
  keyboardTop.append(selected, row(decrease, octavePicker, increase));

  const sharedKeyboard = pianoKeyboard({
    note: semitone => (store.get().octave + 1) * 12 + semitone,
    sustain: () => store.get().sustain,
    press: note => audio.pressToneKey(note), release: note => audio.releaseToneKey(note),
    label: 'Concert-pitch keyboard',
  });
  const { node: keyboard, scroll, keys } = sharedKeyboard;
  const mobileQuery = window.matchMedia('(max-width: 650px)');
  let hasInitialScroll = false;
  let scrollFrame = 0;
  let pendingCenter = false;
  const scrollSelectedKey = (centerAlways: boolean) => {
    const state = store.get();
    if (state.focus !== 'tone' || !mobileQuery.matches) return false;
    if (!scroll.clientWidth || scroll.scrollWidth <= scroll.clientWidth) return false;
    const semitone = state.toneNote - (state.octave + 1) * 12;
    if (semitone < 0 || semitone >= keys.length) return true;
    const key = keys[semitone]!;
    const scrollRect = scroll.getBoundingClientRect();
    const keyRect = key.getBoundingClientRect();
    if (!keyRect.width) return false;
    const keyLeft = keyRect.left - scrollRect.left + scroll.scrollLeft;
    const keyRight = keyRect.right - scrollRect.left + scroll.scrollLeft;
    const visible = keyLeft >= scroll.scrollLeft + 8 && keyRight <= scroll.scrollLeft + scroll.clientWidth - 8;
    if (centerAlways || !visible) {
      const keyCenter = (keyLeft + keyRight) / 2;
      const maxScroll = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
      scroll.scrollLeft = Math.max(0, Math.min(maxScroll, keyCenter - scroll.clientWidth / 2));
    }
    return true;
  };
  const scheduleScroll = (centerAlways: boolean) => {
    if (scrollSelectedKey(centerAlways)) {
      hasInitialScroll = true;
      return;
    }
    pendingCenter ||= centerAlways;
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const center = pendingCenter;
      pendingCenter = false;
      if (scrollSelectedKey(center)) hasInitialScroll = true;
    });
  };
  const onMobileChange = () => {
    if (mobileQuery.matches && store.get().focus === 'tone') scheduleScroll(true);
  };
  mobileQuery.addEventListener('change', onMobileChange);
  const visibilityChanged = () => { if (document.hidden) sharedKeyboard.reset(); };
  window.addEventListener('blur', sharedKeyboard.reset);
  document.addEventListener('visibilitychange', visibilityChanged);
  onUnmount(node, () => {
    stopBoneTheme();
    sharedKeyboard.reset();
    cancelAnimationFrame(scrollFrame);
    mobileQuery.removeEventListener('change', onMobileChange);
    window.removeEventListener('blur', sharedKeyboard.reset);
    document.removeEventListener('visibilitychange', visibilityChanged);
  });
  const keyboardHint = el('p', 'keyboard-hint small muted');
  const primary = el('div', 'tone-primary');
  primary.append(top, controls, keyboardTop, keyboard, keyboardHint);

  node.append(primary, notes.popup, octaveMenu.popup);

  let lastFocus: ReturnType<PracticeStore['get']>['focus'] | null = null;
  let lastOctave = store.get().octave;
  let lastToneNote = store.get().toneNote;
  store.subscribe((state) => {
    node.hidden = state.focus !== 'tone';

    sustain.textContent = `Sustain ${state.sustain ? 'on' : 'off'}`;
    sustain.setAttribute('aria-pressed', String(state.sustain));
    volume.value = String(state.toneVolume);
    sound.value = state.toneSound;
    desktopVolume.trigger.textContent = `Volume ${state.toneVolume}%`;
    friend.hidden = !state.showUno;
    notes.update(state.toneNote);
    octaveMenu.update(state.octave);
    octaveValue.textContent = `Octave ${state.octave}`;
    octavePicker.replaceChildren(keyboardLabel, octaveValue);
    responsiveLabel(keyboardHint,
      'Choose an octave above · Use − / +',
      `Swipe keys to explore · ${noteName(state.toneNote)} ${state.tonePlaying ? 'keeps sounding' : 'selected'}`);
    play.textContent = state.tonePlaying ? 'Stop tone' : 'Play tone';
    play.setAttribute('aria-pressed', String(state.tonePlaying));
    selectedDetail.textContent = `${toneHz(state).toFixed(1)} Hz`;
    const pitch = pitchText(state);
    miniNote.textContent = pitch.note;
    const listening = ['requesting', 'listening', 'no-signal', 'unreliable'].includes(state.micStatus);
    const micText = state.micStatus !== 'idle' ? micStatusText(state.micStatus) : state.manualHz === null ? 'Activate Mic' : 'Sample';
    miniMicLabel.textContent = micText;
    miniMic.setAttribute('aria-pressed', String(listening));
    miniMic.setAttribute('aria-label', listening ? `Stop microphone (${micText})` : 'Activate Mic');
    miniMic.title = listening ? 'Stop listening' : 'Activate microphone';
    const reading = pitchReading(state);
    miniFeedback.textContent = reading ? pitch.direction : '';
    marker.hidden = !reading;
    if (reading) marker.style.left = `${50 + Math.max(-50, Math.min(50, reading.cents))}%`;
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
    const focusEntered = state.focus === 'tone' && lastFocus !== 'tone';
    const octaveChanged = state.octave !== lastOctave;
    const noteChanged = state.toneNote !== lastToneNote;
    if (state.focus === 'tone' && (!hasInitialScroll || focusEntered || octaveChanged || noteChanged)) {
      scheduleScroll(!hasInitialScroll || focusEntered || octaveChanged);
    }
    lastFocus = state.focus;
    lastOctave = state.octave;
    lastToneNote = state.toneNote;
  });
  return node;
}
