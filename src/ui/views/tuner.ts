import type { AudioController } from '../../audio/controller.ts';
import boneAsset from '../../assets/pitch-bone.svg';
import { displayedHz, LIMITS, pitchReading, TRANSPOSITIONS } from '../../practice/state.ts';
import type { PracticeStore } from '../../practice/state.ts';
import { button, el, field, numberInput, pitchText, responsiveLabel, row, uno, view } from '../components.ts';

export function createTuner(store: PracticeStore, openSettings: () => void, audio: AudioController) {
  const node = view('tuner', 'Tuner');
  const transpose = button('Concert pitch', openSettings);
  const calibration = button('A4 = 440 Hz', openSettings);
  const display = button('Display', openSettings);
  responsiveLabel(display, 'Display', 'View');
  const listen = button('Start listening', audio.toggleMic);
  listen.classList.add('desktop-only');
  const options = row(transpose, calibration, display, listen);
  options.classList.add('tuner-options');
  node.append(options);

  const body = el('div', 'tuner-body');
  const readout = el('div', 'pitch-readout');
  const caption = el('h2', 'eyebrow', 'TUNER');
  const note = el('p', 'pitch-note', '—');
  const detail = el('p', 'pitch-detail muted');
  const feedback = el('p', 'pitch-feedback');
  const hint = el('p', 'muted small', 'Start listening or explore a sample pitch.');
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
  const encouragement = el('p', 'hold-feedback mobile-only teal', 'Ready when you are.');
  const holdCaption = el('p', 'hold-caption mobile-only muted', 'Play a note to begin.');
  const hold = el('progress', 'hold-progress mobile-only');
  hold.max = 1;
  hold.value = 0;
  hold.setAttribute('aria-label', 'Steady pitch hold');
  friend.append(encouragement, uno(), el('p', 'friend-caption', 'A little practice. A good friend.'), holdCaption, hold);
  let steadySince: number | null = null;
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
    listen.textContent = ['requesting', 'listening', 'no-signal', 'unreliable'].includes(state.micStatus) ? 'Stop listening' : 'Start listening';
    hint.textContent = state.micStatus === 'idle' ? 'Start listening or explore a sample pitch.' : `${state.micStatus === 'no-signal' ? 'Play a note' : state.micStatus} · Level ${state.rms.toFixed(3)} · Pitch quality ${state.quality.toFixed(2)}`;
    caption.textContent = state.micStatus !== 'idle' ? 'LIVE TUNER' : state.manualHz === null ? 'TUNER' : 'SAMPLE PITCH';
    note.textContent = text.note;
    responsiveLabel(detail, text.detail, displayedHz(state) === null ? 'No pitch yet' : `${displayedHz(state)!.toFixed(1)} Hz`);
    feedback.textContent = text.direction;
    summary.textContent = state.micStatus === 'idle' ? text.summary : 'Stop listening to explore manual samples.';
    input.disabled = check.disabled = clear.disabled = state.micStatus !== 'idle';
    transpose.textContent = TRANSPOSITIONS.find((option) => option.value === state.transposition)!.label;
    responsiveLabel(calibration, `A4 = ${state.a4} Hz`, `${state.a4} Hz`);
    friend.hidden = !state.showUno;
    body.classList.toggle('tuner-body--no-friend', !state.showUno);
    const reading = pitchReading(state);
    const steady = reading !== null && Math.abs(reading.cents) <= 5;
    if (steady && state.micStatus !== 'idle') steadySince ??= performance.now();
    else steadySince = null;
    hold.value = steadySince === null ? 0 : Math.min(1, (performance.now() - steadySince) / 2000);
    encouragement.textContent = steady ? 'Hold steady.' : reading ? (reading.cents > 0 ? 'A little lower.' : 'A little higher.') : 'Ready when you are.';
    holdCaption.textContent = hold.value === 1 ? 'Nicely done!' : steadySince !== null ? 'A treat is on its way…' : 'Play a note to begin.';
    marker.hidden = !reading;
    if (reading) marker.style.top = `${50 - reading.cents}%`;
  });
  return node;
}
