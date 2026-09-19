import boneAsset from '../../assets/pitch-bone.svg';
import { LIMITS, pitchReading, TRANSPOSITIONS } from '../../practice/state.ts';
import type { PracticeStore } from '../../practice/state.ts';
import { button, el, field, numberInput, pitchText, row, uno, view } from '../components.ts';

export function createTuner(store: PracticeStore, openSettings: () => void) {
  const node = view('tuner', 'Tuner');
  const transpose = button('Concert pitch', openSettings);
  const calibration = button('A4 = 440 Hz', openSettings);
  const display = button('Display', openSettings);
  node.append(row(transpose, calibration, display));

  const body = el('div', 'tuner-body');
  const readout = el('div', 'pitch-readout');
  const caption = el('h2', 'eyebrow', 'TUNER');
  const note = el('p', 'pitch-note', '—');
  const detail = el('p', 'pitch-detail muted');
  const feedback = el('p', 'pitch-feedback');
  const hint = el('p', 'muted small', 'Microphone listening is coming next.');
  readout.append(caption, note, detail, feedback, hint);

  const lane = el('div', 'pitch-lane');
  lane.setAttribute('aria-hidden', 'true');
  lane.append(el('span', 'lane-label lane-label--sharp', 'SHARP'), el('div', 'lane-gradient'));
  for (const cents of [50, 25, 0, -25, -50]) {
    const tick = el('div', cents === 0 ? 'lane-tick lane-tick--center' : 'lane-tick');
    tick.style.top = `${((50 - cents) / 100) * 100}%`;
    tick.append(el('span', '', cents > 0 ? `+${cents}` : String(cents).replace('-', '−')));
    lane.append(tick);
  }
  lane.append(el('div', 'lane-center'), el('span', 'lane-label lane-label--flat', 'FLAT'));
  const marker = el('img', 'pitch-marker');
  Object.assign(marker, { src: boneAsset, width: 114, height: 30, alt: '' });
  lane.append(marker);

  const friend = el('div', 'tuner-friend');
  friend.append(uno(), el('p', 'friend-caption', 'A little practice. A good friend.'));
  body.append(readout, lane, friend);
  node.append(body);

  const explorer = el('details', 'sample-panel');
  explorer.append(el('summary', '', 'Explore a sample pitch'));
  const form = el('form', 'sample-form');
  form.id = 'pitch-form';
  const input = numberInput(LIMITS.frequency.min, LIMITS.frequency.max, 440, 'any');
  input.id = 'frequency';
  const check = button('Check pitch');
  check.type = 'submit';
  const clear = button('Clear sample', () => store.dispatch({ type: 'pitch', value: null }));
  form.append(field('Frequency (Hz)', input), check, clear);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (form.reportValidity()) store.dispatch({ type: 'pitch', value: Number(input.value) });
  });
  const summary = el('p', 'small muted');
  summary.id = 'pitch-result';
  summary.setAttribute('role', 'status');
  explorer.append(el('p', 'small muted', 'Manual input only. This does not use your microphone.'), form, summary);
  node.append(explorer);

  store.subscribe((state) => {
    node.hidden = state.focus !== 'tuner';
    const text = pitchText(state);
    caption.textContent = state.manualHz === null ? 'TUNER' : 'SAMPLE PITCH';
    note.textContent = text.note;
    detail.textContent = text.detail;
    feedback.textContent = text.direction;
    summary.textContent = text.summary;
    transpose.textContent = TRANSPOSITIONS.find((option) => option.value === state.transposition)!.label;
    calibration.textContent = `A4 = ${state.a4} Hz`;
    friend.hidden = !state.showUno;
    body.classList.toggle('tuner-body--no-friend', !state.showUno);
    const reading = pitchReading(state);
    marker.hidden = !reading;
    if (reading) marker.style.top = `${50 - reading.cents}%`;
  });
  return node;
}
