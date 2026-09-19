import { LIMITS, METERS, meterInfo } from '../../practice/state.ts';
import type { Meter, PracticeStore } from '../../practice/state.ts';
import { button, el, field, heading, numberInput, row, select, unavailableButton, uno, view } from '../components.ts';

export function createMetronome(store: PracticeStore) {
  const node = view('metronome', 'Metronome');
  const title = heading('Find your rhythm.', 'A steady beat. A familiar friend.');
  const meter = select(METERS, (value) => store.dispatch({ type: 'meter', value: value as Meter }));
  const mode = button('View · Uno', () => store.dispatch({ type: 'numbered', value: !store.get().numbered }));
  const top = el('div', 'metronome-heading');
  top.append(title, row(field('Meter', meter), mode));
  const body = el('div', 'metronome-body');
  const tempo = numberInput(LIMITS.tempo.min, LIMITS.tempo.max, 96);
  tempo.classList.add('tempo-input');
  tempo.setAttribute('aria-label', 'Tempo (BPM)');
  tempo.addEventListener('change', () => {
    if (tempo.reportValidity()) store.dispatch({ type: 'tempo', value: Number(tempo.value) });
  });
  const unit = el('p', 'muted');
  const down = button('−', () => store.dispatch({ type: 'tempo', value: store.get().tempo - 1 }));
  const up = button('+', () => store.dispatch({ type: 'tempo', value: store.get().tempo + 1 }));
  down.setAttribute('aria-label', 'Decrease tempo');
  up.setAttribute('aria-label', 'Increase tempo');
  const transport = el('div', 'tempo-controls');
  transport.append(tempo, unit, row(down, unavailableButton('Tap tempo', 'metronome-availability'), up),
    unavailableButton('Start metronome', 'metronome-availability'));
  const friend = el('div', 'pulse-friend');
  friend.append(el('p', 'eyebrow', 'UNO PULSE'), uno());
  body.append(transport, friend);
  const beats = el('ol', 'beat-grid');
  beats.setAttribute('aria-label', 'Meter preview');
  const beatItems = Array.from({ length: 4 }, (_, index) => {
    const beat = el('li', 'beat');
    beat.append(el('span', 'beat-number', String(index + 1)), el('span', 'eyebrow', index === 0 ? 'DOWNBEAT' : 'BEAT'));
    beats.append(beat);
    return beat;
  });
  const note = el('p', 'small muted', 'Rhythm preview only. Metronome playback and tap tempo arrive in the next slice.');
  note.id = 'metronome-availability';
  node.append(top, beats, body, note);
  store.subscribe((state) => {
    node.hidden = state.focus !== 'metronome';
    const info = meterInfo(state);
    meter.value = state.meter;
    tempo.value = String(state.tempo);
    unit.textContent = `${info.unit} = ${state.tempo} BPM`;
    mode.textContent = `View · ${state.numbered ? 'Numbered' : 'Uno'}`;
    mode.disabled = state.meter === 'free';
    mode.setAttribute('aria-pressed', String(state.numbered));
    node.classList.toggle('metronome--numbered', state.numbered);
    beats.hidden = !state.numbered;
    beats.style.setProperty('--beats', String(info.beats || 4));
    beatItems.forEach((beat, index) => { beat.hidden = index >= info.beats; });
    friend.hidden = !state.showUno;
    down.disabled = state.tempo === LIMITS.tempo.min;
    up.disabled = state.tempo === LIMITS.tempo.max;
    title.querySelector('h2')!.textContent = state.numbered ? 'Make every beat count.' : 'Find your rhythm.';
  });
  return node;
}
