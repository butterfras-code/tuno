import type { AudioController } from '../../audio/controller.ts';
import { animatedUno } from '../uno.ts';
import { createTunerFeedback } from '../../practice/feedback.ts';
import micAsset from '../../assets/mic.svg';
import boneAsset from '../../assets/pitch-bone.svg';
import { displayedHz, LIMITS, pitchReading, rawPitchReading, TRANSPOSITIONS, TUNER_ACCURACIES } from '../../practice/state.ts';
import type { PracticeStore } from '../../practice/state.ts';
import { button, el, field, numberInput, pitchText, responsiveLabel, row, view } from '../components.ts';

export function createTuner(store: PracticeStore, openSettings: () => void, audio: AudioController) {
  const node = view('tuner', 'Tuner');
  const transpose = button('Concert pitch', openSettings);
  const calibration = button('A4 = 440 Hz', openSettings);
  const display = button('Display', openSettings);
  responsiveLabel(display, 'Display', 'View');
  const listen = button('Start listening', audio.toggleMic);
  listen.classList.add('tuner-mic');
  const micIcon = el('img', 'control-icon');
  Object.assign(micIcon, { src: micAsset, alt: '' });
  listen.replaceChildren(micIcon);
  const options = row(transpose, calibration, listen, display);
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
  marker.hidden = true;
  lane.append(marker);

  const friend = el('div', 'tuner-friend');
  const encouragement = el('p', 'hold-feedback mobile-only teal', 'Ready when you are.');
  const holdCaption = el('p', 'hold-caption muted', 'Play a note to begin.');
  holdCaption.setAttribute('role', 'status');
  const hold = el('progress', 'hold-progress');
  hold.max = 1;
  hold.value = 0;
  hold.setAttribute('aria-label', 'Steady pitch hold');
  const dog = animatedUno();
  dog.pose('rest');
  friend.append(encouragement, dog.node, el('p', 'friend-caption', 'A little practice. A good friend.'), holdCaption, hold);
  const animation = createTunerFeedback();
  let frame = 0;
  let lastReward = 0;
  let wasLive = false;
  let calibrationKey = '';
  function animate(now: number) {
    frame = 0;
    const state = store.get();
    const reading = pitchReading(state);
    const rawReading = rawPitchReading(state);
    const live = ['listening', 'unreliable', 'no-signal'].includes(state.micStatus);
    const fresh = now - state.pitchUpdatedAt < 250;
    const reliable = live && fresh && state.micStatus === 'listening' && rawReading !== null;
    const accuracy = TUNER_ACCURACIES.find((option) => option.value === state.tunerAccuracy)!;
    const key = `${state.a4}:${state.transposition}:${state.tunerAccuracy}`;
    if (live !== wasLive || key !== calibrationKey) animation.reset();
    wasLive = live; calibrationKey = key;
    const result = animation.update(now, reliable ? { note: rawReading.concertNote, cents: rawReading.cents } : null,
      live && fresh && state.micStatus === 'no-signal', accuracy.scale);
    dog.pose(result.pose);
    hold.value = live ? result.progress : 0;
    const encouragementText = reading && Math.abs(reading.cents) <= 8 * accuracy.scale ? 'Hold steady.'
      : reading ? (reading.cents > 0 ? 'A little lower.' : 'A little higher.') : 'Ready when you are.';
    if (encouragement.textContent !== encouragementText) encouragement.textContent = encouragementText;
    const holdText = !live ? 'Hold a note to give Uno a treat'
      : state.micStatus === 'unreliable' || !fresh ? 'Listening…'
      : state.micStatus === 'no-signal' ? 'Play a note'
      : result.progress === 1 ? 'Nicely done!' : result.progress > 0 ? 'A treat is on its way…' : 'Hold your note steady.';
    if (holdCaption.textContent !== holdText) holdCaption.textContent = holdText;
    marker.hidden = !reading;
    if (reading) marker.style.top = `${50 - reading.cents}%`;
    if (result.reward !== lastReward) { lastReward = result.reward; dog.catch(marker); }
    if (!document.hidden && live) frame = requestAnimationFrame(animate);
  }
  const wake = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(animate); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; animation.reset(); }
    else wake();
  });
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
    const listening = ['requesting', 'listening', 'no-signal', 'unreliable'].includes(state.micStatus);
    listen.setAttribute('aria-label', listening ? 'Stop listening' : 'Start listening');
    listen.setAttribute('aria-pressed', String(listening));
    listen.title = listening ? 'Stop listening' : 'Start listening';
    hint.textContent = state.micStatus === 'idle' ? 'Start listening or explore a sample pitch.' : `${state.micStatus === 'no-signal' ? 'Play a note' : state.micStatus} · Level ${state.rms.toFixed(3)} · Pitch quality ${state.quality.toFixed(2)}`;
    caption.textContent = state.micStatus !== 'idle' ? 'Uno hears...' : state.manualHz === null ? 'TUNER' : 'SAMPLE PITCH';
    note.textContent = text.note;
    responsiveLabel(detail, text.detail, displayedHz(state) === null ? 'No pitch yet' : `${displayedHz(state)!.toFixed(1)} Hz`);
    const reading = pitchReading(state);
    const centered = reading !== null && Math.abs(reading.cents) <= 8 * TUNER_ACCURACIES.find(option => option.value === state.tunerAccuracy)!.scale;
    const cents = reading ? `${reading.cents < 0 ? '−' : reading.cents > 0 ? '+' : ''}${Math.abs(reading.cents).toFixed(0)}` : '';
    responsiveLabel(feedback, centered ? 'Right there. Hold steady.' : text.direction, centered ? `${cents} cents · In tune` : text.direction);
    summary.textContent = state.micStatus === 'idle' ? text.summary : 'Stop listening to explore manual samples.';
    input.disabled = check.disabled = clear.disabled = state.micStatus !== 'idle';
    transpose.textContent = TRANSPOSITIONS.find((option) => option.value === state.transposition)!.label;
    responsiveLabel(calibration, `A4 = ${state.a4} Hz`, `${state.a4} Hz`);
    friend.hidden = !state.showUno;
    body.classList.toggle('tuner-body--no-friend', !state.showUno);
    // Missing evidence clears immediately, without waiting for the next paint.
    if (!pitchReading(state)) marker.hidden = true;
    wake();
  });
  return node;
}
