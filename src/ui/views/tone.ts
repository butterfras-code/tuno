import type { AudioController } from '../../audio/controller.ts';
import { noteName } from '../../music/pitch.ts';
import { LIMITS, toneHz } from '../../practice/state.ts';
import type { PracticeStore } from '../../practice/state.ts';
import { button, el, field, heading, pitchText, responsiveLabel, row, uno, view, volumePopover } from '../components.ts';

export function createTone(store: PracticeStore, audio: AudioController) {
  const node = view('tone', 'Reference tone');
  const top = el('div', 'tone-heading');
  const mini = el('div', 'mini-pitch');
  const miniNote = el('p', 'mini-note');
  const miniStatus = el('p', 'small teal');
  mini.append(el('p', 'eyebrow', 'TUNER'), miniNote, miniStatus);
  const friend = uno('tone-friend mobile-only');
  top.append(heading('Find your note.', 'Choose a key. Find a note to practice.'), mini, friend);
  const sustain = button('Sustain on', () => store.dispatch({ type: 'sustain', value: !store.get().sustain }));
  const volume = el('input');
  Object.assign(volume, { type: 'range', min: '0', max: '100', step: '1' });
  volume.addEventListener('input', () => store.dispatch({ type: 'tone-volume', value: Number(volume.value) }));
  const volumeLabel = field('Tone volume', volume);
  volumeLabel.classList.add('volume-control');
  const volumeValue = el('output', 'small');
  volumeLabel.append(volumeValue);
  const play = button('Play tone', audio.toggleTone);
  const controls = row(sustain, play, volumeLabel);
  controls.classList.add('tone-controls');
  const notePicker = button('', () => showPanel('note'));
  notePicker.classList.add('note-picker-trigger', 'mobile-only');
  notePicker.setAttribute('aria-controls', 'tone-note-picker');
  controls.prepend(notePicker);

  const selected = el('div', 'selected-tone');
  const selectedName = el('p', 'selected-note');
  const selectedDetail = el('p', 'muted');
  selected.append(selectedName, selectedDetail);
  const decrease = button('− Octave', () => store.dispatch({ type: 'octave', value: store.get().octave - 1 }));
  const increase = button('+ Octave', () => store.dispatch({ type: 'octave', value: store.get().octave + 1 }));
  const keyboardTop = el('div', 'keyboard-heading');
  const octavePicker = button('', () => showPanel('octave'));
  octavePicker.classList.add('mobile-only');
  octavePicker.setAttribute('aria-controls', 'tone-octave-picker');
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
  const whiteSemitones = [0, 2, 4, 5, 7, 9, 11, 12];
  const keys = Array.from({ length: 13 }, (_, semitone) => {
    const key = button('', () => { store.dispatch({ type: 'tone-note', value: (store.get().octave + 1) * 12 + semitone }); void audio.playTone(); });
    const whiteIndex = whiteSemitones.indexOf(semitone);
    key.className = `piano-key ${whiteIndex < 0 ? 'piano-key--black' : 'piano-key--white'}`;
    if (whiteIndex >= 0) key.style.gridColumn = String(whiteIndex + 1);
    else key.style.left = `${(whiteSemitones.filter((value) => value < semitone).length / 8) * 100}%`;
    piano.append(key);
    return key;
  });
  const keyboardHint = el('p', 'keyboard-hint small muted');
  const mobileVolume = volume.cloneNode() as HTMLInputElement;
  mobileVolume.addEventListener('input', () => store.dispatch({ type: 'tone-volume', value: Number(mobileVolume.value) }));
  const compactVolume = volumePopover('Tone output volume', mobileVolume);
  const mobilePlay = button('Play tone', audio.toggleTone);
  const outputControls = row(compactVolume.node, mobilePlay);
  outputControls.classList.add('tone-output', 'mobile-only');
  const primary = el('div', 'tone-primary');
  primary.append(top, controls, keyboardTop, keyboard, keyboardHint, outputControls);

  const octavePanel = el('section', 'tone-picker octave-picker mobile-only');
  octavePanel.id = 'tone-octave-picker';
  octavePanel.hidden = true;
  const octaveTitle = el('h2', '', 'Choose an octave');
  octaveTitle.tabIndex = -1;
  const sounding = el('p', 'octave-sounding teal');
  const octaveDone = button('Done', () => showPanel(returnPanel));
  const octaveDescription = el('p', 'small muted', 'Browsing keeps your tone playing.');
  const octavePreview = el('div', 'octave-preview');
  const octaveNumber = el('p', 'octave-number');
  const octaveRange = el('p', 'octave-range');
  const octaveFriend = uno();
  octavePreview.append(el('p', 'eyebrow', 'OCTAVE'), octaveNumber, octaveRange, el('p', 'small muted', '4 = middle C'), octaveFriend);
  const mobileRail = el('div', 'mobile-octave-rail');
  mobileRail.setAttribute('role', 'group');
  mobileRail.setAttribute('aria-label', 'Choose an octave');
  const mobileOctaves: HTMLButtonElement[] = [];
  for (let octave = LIMITS.octave.min; octave <= LIMITS.octave.max; octave++) {
    const item = button(String(octave), () => store.dispatch({ type: 'octave', value: octave }));
    item.setAttribute('aria-label', `Browse octave ${octave}`);
    mobileOctaves.push(item);
    mobileRail.append(item);
  }
  octavePanel.append(octaveTitle, sounding, octaveDone, octaveDescription, octavePreview, mobileRail);

  const notePanel = el('section', 'tone-picker note-picker mobile-only');
  notePanel.id = 'tone-note-picker';
  notePanel.hidden = true;
  const noteTitle = el('h2', '', 'Choose your note');
  noteTitle.tabIndex = -1;
  const noteDescription = el('p', 'muted small');
  const noteGrid = el('div', 'chromatic-notes');
  noteGrid.setAttribute('role', 'group');
  noteGrid.setAttribute('aria-label', 'Chromatic notes');
  const noteButtons = Array.from({ length: 12 }, (_, semitone) => {
    const item = button('', () => {
      store.dispatch({ type: 'tone-note', value: (store.get().octave + 1) * 12 + semitone });
      void audio.playTone();
    });
    noteGrid.append(item);
    return item;
  });
  const noteOctave = button('', () => showPanel('octave'));
  const noteDone = button('Done', () => showPanel('keyboard'), true);
  const pickerActions = row(noteOctave, noteDone);
  pickerActions.classList.add('note-picker-actions');
  const noteCaption = el('p', 'note-picker-caption teal');
  const noteFriend = uno('note-picker-friend');
  notePanel.append(noteTitle, noteDescription, noteGrid, pickerActions, noteCaption, noteFriend);
  node.append(primary, octavePanel, notePanel);

  type Panel = 'keyboard' | 'octave' | 'note';
  let panel: Panel = 'keyboard';
  let returnPanel: Panel = 'keyboard';
  function showPanel(next: Panel, focus = true) {
    if (next === 'octave') returnPanel = panel === 'note' ? 'note' : 'keyboard';
    const previous = panel;
    panel = next;
    primary.hidden = next !== 'keyboard';
    octavePanel.hidden = next !== 'octave';
    notePanel.hidden = next !== 'note';
    if (focus) {
      (next === 'octave' ? octaveTitle : next === 'note' ? noteTitle : previous === 'octave' ? octavePicker : notePicker).focus();
      if (next === 'octave') mobileRail.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
    }
  }
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel !== 'keyboard') {
      event.preventDefault();
      showPanel(panel === 'octave' ? returnPanel : 'keyboard');
    }
  });
  window.matchMedia('(max-width: 650px)').addEventListener('change', () => showPanel('keyboard', false));

  let lastFocus = store.get().focus;
  let lastOctave = store.get().octave;
  store.subscribe((state) => {
    node.hidden = state.focus !== 'tone';
    if (node.hidden && panel !== 'keyboard') showPanel('keyboard', false);
    sustain.textContent = `Sustain ${state.sustain ? 'on' : 'off'}`;
    sustain.setAttribute('aria-pressed', String(state.sustain));
    volume.value = String(state.toneVolume);
    volumeValue.textContent = `${state.toneVolume}%`;
    selectedName.textContent = noteName(state.toneNote);
    notePicker.textContent = `Note · ${noteName(state.toneNote)}`;
    octavePicker.textContent = `Octave ${state.octave} ↕`;
    mobileVolume.value = String(state.toneVolume);
    compactVolume.trigger.textContent = `Volume · ${state.toneVolume}%`;
    mobilePlay.textContent = state.tonePlaying ? 'Stop tone' : 'Play tone';
    sounding.textContent = `${state.tonePlaying ? 'Sounding' : 'Selected'}: ${noteName(state.toneNote)}`;
    octaveNumber.textContent = String(state.octave);
    octaveRange.textContent = `C${state.octave} – B${state.octave}`;
    noteDescription.textContent = `Octave ${state.octave} · Sustain ${state.sustain ? 'on' : 'off'}`;
    noteOctave.textContent = `Octave ${state.octave}`;
    noteCaption.textContent = `Play along with ${noteName(state.toneNote)}.`;
    friend.hidden = octaveFriend.hidden = noteFriend.hidden = !state.showUno;
    mobileOctaves.forEach((item) => item.setAttribute('aria-pressed', String(Number(item.textContent) === state.octave)));
    noteButtons.forEach((item, semitone) => {
      const note = (state.octave + 1) * 12 + semitone;
      item.textContent = noteName(note).replace(/-?\d+$/, '');
      item.setAttribute('aria-label', `Play ${noteName(note)}`);
      item.setAttribute('aria-pressed', String(note === state.toneNote));
    });
    responsiveLabel(keyboardHint,
      'Concert-pitch keys · Browsing octaves keeps your selected note. Scroll the keyboard on small screens. Sustain off plays a short 1.2-second tone.',
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
      responsiveLabel(key, name, semitone === 0 || semitone === 5 || semitone === 12 ? name : name.replace(/-?\d+$/, ''));
      key.setAttribute('aria-label', `Select ${name}`);
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
