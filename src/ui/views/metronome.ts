import type { AudioController } from '../../audio/controller.ts';
import { LIMITS, METERS, meterInfo } from '../../practice/state.ts';
import type { Meter, PracticeStore } from '../../practice/state.ts';
import { button, el, field, heading, responsiveLabel, row, select, uno, view, volumePopover } from '../components.ts';
import { tempoInput } from '../tempo.ts';

export function createMetronome(store: PracticeStore, audio: AudioController) {
  const node = view('metronome', 'Metronome');
  const title = heading('Find your rhythm.', 'A steady beat. A familiar friend.');
  const meter = select(METERS, (value) => store.dispatch({ type: 'meter', value: value as Meter }));
  const mode = button('View · Uno', () => store.dispatch({ type: 'numbered', value: !store.get().numbered }));
  const top = el('div', 'metronome-heading');
  const meterField = field('Meter', meter);
  meterField.classList.add('meter-field');
  mode.classList.add('beat-mode');
  top.append(title, row(meterField, mode));
  const body = el('div', 'metronome-body');
  const tempo = tempoInput(store);
  tempo.classList.add('tempo-input');
  const unit = el('p', 'muted');
  const down = button('−', () => store.dispatch({ type: 'tempo', value: store.get().tempo - 1 }));
  const up = button('+', () => store.dispatch({ type: 'tempo', value: store.get().tempo + 1 }));
  down.setAttribute('aria-label', 'Decrease tempo');
  up.setAttribute('aria-label', 'Increase tempo');
  const transport = el('div', 'tempo-controls');
  const play = button('Start metronome', audio.toggleMetronome);
  const tap = button('Tap tempo', audio.tapTempo);
  responsiveLabel(tap, 'Tap tempo', 'Tap');
  const tempoActions = row(down, tap, up);
  tempoActions.classList.add('tempo-actions');
  play.classList.add('metronome-play');
  transport.append(tempo, unit, tempoActions, play);
  const friend = el('div', 'pulse-friend');
  friend.append(el('p', 'eyebrow', 'UNO PULSE'), uno());
  body.append(transport, friend);
  const beats = el('ol', 'beat-grid');
  beats.setAttribute('aria-label', 'Meter beats');
  const beatItems = Array.from({ length: 4 }, (_, index) => {
    const beat = el('li', 'beat');
    beat.append(el('span', 'beat-number', String(index + 1)), el('span', 'eyebrow', index === 0 ? 'DOWNBEAT' : 'BEAT'));
    beats.append(beat);
    return beat;
  });
  const subdivision = select([
    { value: 1, label: 'Beat only' }, { value: 2, label: '2 per beat' },
    { value: 3, label: '3 per beat' }, { value: 4, label: '4 per beat' },
  ], (value) => store.dispatch({ type: 'subdivision', value: Number(value) }));
  const accent = button('Downbeat accent on', () => store.dispatch({ type: 'accent', value: !store.get().accent }));
  const sound = select([{ value: 'click', label: 'Click' }, { value: 'wood', label: 'Wood' }],
    (value) => store.dispatch({ type: 'click-sound', value: value as 'click' | 'wood' }));
  const volume = el('input');
  Object.assign(volume, { type: 'range', min: '0', max: '100', step: '1' });
  volume.addEventListener('input', () => store.dispatch({ type: 'click-volume', value: Number(volume.value) }));
  const current = el('p', 'current-beat', 'Stopped');
  current.id = 'current-beat';
  const note = el('p', 'small muted', 'Tempo, meter, and subdivisions change at the next unscheduled beat. In 6/8, choose 3 per beat for eighth-note pulses.');
  note.id = 'metronome-availability';
  const subdivisionField = field('Subdivision', subdivision);
  subdivisionField.classList.add('subdivision-field');
  accent.classList.add('accent-control');
  const soundField = field('Click sound', sound);
  soundField.classList.add('sound-field');
  const volumeField = field('Metronome volume', volume);
  volumeField.classList.add('desktop-only');
  const mobileVolume = volume.cloneNode() as HTMLInputElement;
  mobileVolume.addEventListener('input', () => store.dispatch({ type: 'click-volume', value: Number(mobileVolume.value) }));
  const compactVolume = volumePopover('Beat volume', mobileVolume);
  compactVolume.node.classList.add('beat-volume');
  const rhythmControls = row(subdivisionField, accent, soundField, volumeField, compactVolume.node);
  rhythmControls.classList.add('rhythm-controls');
  node.append(top, beats, current, body, rhythmControls, note);
  store.subscribe((state) => {
    node.hidden = state.focus !== 'metronome';
    const info = meterInfo(state);
    responsiveLabel(play, state.metronomePlaying ? 'Stop metronome' : 'Start metronome', state.metronomePlaying ? 'Pause' : 'Start');
    mobileVolume.value = String(state.clickVolume);
    compactVolume.trigger.textContent = `Volume · ${state.clickVolume}%`;
    subdivision.value = String(state.subdivision);
    responsiveLabel(accent, `Downbeat accent ${state.accent ? 'on' : 'off'}`, `Accent · ${state.accent ? '1' : 'Off'}`);
    accent.setAttribute('aria-pressed', String(state.accent));
    accent.disabled = state.meter === 'free';
    sound.value = state.clickSound;
    volume.value = String(state.clickVolume);
    current.textContent = !state.metronomePlaying ? 'Stopped' : state.currentBeat === null ? 'Starting…'
      : `${state.meter === 'free' ? 'Pulse' : `Beat ${state.currentBeat + 1}${state.currentBeat === 0 ? ' · Downbeat' : ''}`} · Pulse ${state.currentPart + 1}`;
    friend.dataset.side = state.currentBeat === null ? '' : state.currentBeat % 2 === 0 ? 'left' : 'right';
    meter.value = state.meter;
    responsiveLabel(unit, `${info.unit} = ${state.tempo} BPM`, `${info.unit} · BPM`);
    mode.textContent = `View · ${state.numbered ? 'Numbered' : 'Uno'}`;
    mode.disabled = state.meter === 'free';
    mode.setAttribute('aria-pressed', String(state.numbered));
    node.classList.toggle('metronome--numbered', state.numbered);
    beats.hidden = !state.numbered;
    beats.style.setProperty('--beats', String(info.beats || 4));
    beatItems.forEach((beat, index) => {
      beat.hidden = index >= info.beats;
      beat.setAttribute('aria-current', String(state.currentBeat === index));
    });
    friend.hidden = !state.showUno;
    down.disabled = state.tempo === LIMITS.tempo.min;
    up.disabled = state.tempo === LIMITS.tempo.max;
    title.querySelector('h2')!.textContent = state.numbered ? 'Make every beat count.' : 'Find your rhythm.';
  });
  return node;
}
