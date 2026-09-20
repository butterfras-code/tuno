import type { AudioController } from '../../audio/controller.ts';
import { CLICK_SOUNDS, type ClickSound } from '../../music/click-sounds.ts';
import { LIMITS, METERS, meterInfo } from '../../practice/state.ts';
import type { Meter, PracticeStore } from '../../practice/state.ts';
import { button, el, field, heading, responsiveLabel, row, select, view, volumePopover } from '../components.ts';
import { petTempo } from '../pet-tempo.ts';
import { tempoInput } from '../tempo.ts';
import dragHintAsset from '../../assets/tempo-drag-hint.svg';

export function createMetronome(store: PracticeStore, audio: AudioController) {
  const node = view('metronome', 'Metronome');
  const title = heading('Find your rhythm.', 'A steady beat. A familiar friend.');
  const meter = select(METERS.map(item => ({ ...item, label: `Meter: ${item.beats || 1}` })), (value) => store.dispatch({ type: 'meter', value: value as Meter }));
  const mode = button('View · Uno', () => store.dispatch({ type: 'numbered', value: !store.get().numbered }));
  const top = el('div', 'metronome-heading');
  const meterField = field('Meter', meter);
  meterField.classList.add('meter-field');
  mode.classList.add('beat-mode');
  top.append(title, row(meterField, mode));
  const body = el('div', 'metronome-body');
  const tempo = tempoInput(store);
  tempo.classList.add('tempo-input');
  const unit = el('p', 'muted', 'BPM');
  const reading = el('div', 'tempo-reading');
  reading.append(tempo, unit);
  const nudge = (amount: number) => button(`${amount > 0 ? '+' : '−'}${Math.abs(amount)}`, () => {
    const { min, max } = LIMITS.tempo;
    store.dispatch({ type: 'tempo', value: Math.max(min, Math.min(max, store.get().tempo + amount)) });
  });
  const down1 = nudge(-1);
  const down5 = nudge(-5);
  const up1 = nudge(1);
  const up5 = nudge(5);
  const increase = row(up1, up5);
  const decrease = row(down1, down5);
  increase.classList.add('tempo-nudges', 'tempo-nudges--increase');
  decrease.classList.add('tempo-nudges', 'tempo-nudges--decrease');
  const transport = el('div', 'tempo-controls');
  const play = button('Start metronome', audio.toggleMetronome);
  play.classList.add('metronome-play');
  transport.append(increase, reading, decrease);
  const friend = el('div', 'pulse-friend');
  friend.append(petTempo(store, audio));
  const petHint = el('p', 'tempo-pet-hint');
  responsiveLabel(petHint, 'Pet Uno to tap tempo', 'Pet Uno: Head to tap tempo, 2 on body changes tail');
  const sharedTempo = el('div', 'tempo-and-uno');
  const dragHint = el('img', 'tempo-drag-hint') as HTMLImageElement;
  Object.assign(dragHint, { src: dragHintAsset, alt: '', draggable: false });
  sharedTempo.append(transport, dragHint, friend);
  body.append(sharedTempo, petHint);
  const beatHint = el('p', 'beat-hint muted', 'Touch to toggle accents');
  const beats = el('ol', 'beat-grid');
  beats.setAttribute('aria-label', 'Meter beats');
  const beatItems = Array.from({ length: 4 }, (_, index) => {
    const beat = el('li', 'beat');
    const toggle = button(String(index + 1), () => store.dispatch({ type: 'beat-accent', value: index }));
    toggle.classList.add('beat-number');
    toggle.setAttribute('aria-label', `Accent beat ${index + 1}`);
    beat.append(toggle);
    beats.append(beat);
    return beat;
  });
  const subdivision = select([
    ...Array.from({ length: 7 }, (_, i) => ({ value: i + 1, label: `Subdiv: ${i + 1}` })),
  ], (value) => store.dispatch({ type: 'subdivision', value: Number(value) }));
  const sound = select(CLICK_SOUNDS,
    (value) => store.dispatch({ type: 'click-sound', value: value as ClickSound }));
  const mobile = matchMedia('(max-width: 650px)');
  const syncLabels = () => {
    [...subdivision.options].forEach(option => { option.textContent = `${mobile.matches ? 'Subdiv' : 'Subdivision'}: ${option.value}`; });
    [...sound.options].forEach(option => { option.textContent = `${mobile.matches ? '' : 'Sound · '}${CLICK_SOUNDS.find(sound => sound.value === option.value)!.label}`; });
  };
  mobile.addEventListener('change', syncLabels);
  syncLabels();
  const volume = el('input');
  Object.assign(volume, { type: 'range', min: '0', max: '100', step: '1' });
  volume.addEventListener('input', () => store.dispatch({ type: 'click-volume', value: Number(volume.value) }));
  const current = el('p', 'current-beat', 'Stopped');
  current.id = 'current-beat';
  const note = el('p', 'small muted', 'Tempo, meter, and subdivisions change at the next unscheduled beat. In 6/8, choose 3 per beat for eighth-note pulses.');
  note.id = 'metronome-availability';
  const subdivisionField = field('Subdivision', subdivision);
  subdivisionField.classList.add('subdivision-field');
  const soundField = field('Click sound', sound);
  soundField.classList.add('sound-field');
  const compactVolume = volumePopover('Beat volume', volume);
  compactVolume.node.classList.add('beat-volume');
  const rhythmControls = row(play, subdivisionField, soundField, compactVolume.node);
  rhythmControls.classList.add('rhythm-controls');
  node.append(top, beatHint, beats, current, body, rhythmControls, note);
  store.subscribe((state) => {
    node.hidden = state.focus !== 'metronome';
    const info = meterInfo(state);
    responsiveLabel(play, state.metronomePlaying ? 'Stop' : 'Start', state.metronomePlaying ? 'Pause' : 'Start');
    play.setAttribute('aria-label', state.metronomePlaying ? 'Stop metronome' : 'Start metronome');
    compactVolume.trigger.textContent = `Volume · ${state.clickVolume}%`;
    subdivision.value = String(state.subdivision);
    sound.value = state.clickSound;
    volume.value = String(state.clickVolume);
    current.textContent = !state.metronomePlaying ? 'Stopped' : state.currentBeat === null ? 'Starting…'
      : `${state.meter === 'free' ? 'Pulse' : `Beat ${state.currentBeat + 1}${state.currentBeat === 0 ? ' · Downbeat' : ''}`} · Pulse ${state.currentPart + 1}`;

    meter.value = state.meter;
    unit.textContent = 'BPM';
    tempo.classList.toggle('tempo-input--three', state.tempo >= 100);
    responsiveLabel(mode, `View · ${state.numbered ? 'Numbered' : 'Uno'}`, `View · ${state.numbered ? 'Numbers' : 'Uno'}`);
    mode.setAttribute('aria-pressed', String(state.numbered));
    node.classList.toggle('metronome--numbered', state.numbered);
    beats.hidden = beatHint.hidden = !state.numbered;
    beatHint.textContent = state.meter === 'free' ? 'One steady pulse' : 'Touch to toggle accents';
    beats.style.setProperty('--beats', String(info.beats || 4));
    beatItems.forEach((beat, index) => {
      beat.hidden = index >= (info.beats || 1);
      beat.setAttribute('aria-current', String(state.meter === 'free' ? state.currentBeat !== null && index === 0 : state.currentBeat === index));
      beat.querySelector('button')!.disabled = state.meter === 'free';
      beat.querySelector('button')!.setAttribute('aria-pressed', String(state.beatAccents[index]));
    });
    friend.hidden = !state.showUno;
    down1.disabled = state.tempo === LIMITS.tempo.min;
    down5.disabled = state.tempo === LIMITS.tempo.min;
    up1.disabled = state.tempo === LIMITS.tempo.max;
    up5.disabled = state.tempo === LIMITS.tempo.max;
    title.querySelector('h2')!.textContent = state.numbered ? 'Make every beat count.' : 'Find your rhythm.';
  });
  return node;
}
