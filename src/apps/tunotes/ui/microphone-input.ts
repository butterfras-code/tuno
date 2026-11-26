import micAsset from '../../../assets/mic.svg';
import { createMicrophoneCapture } from '../../../shared/audio/microphone.ts';
import { noteName } from '../../../music/pitch.ts';
import { el } from '../../../shared/ui/components.ts';
import type { NoteAnswer } from '../domain/fingering.ts';
import { instruments } from '../domain/presets.ts';
import type { PromptToken } from '../engine/practice.ts';
import { MIC_HOLD_MS, MIC_TOLERANCE_CENTS, MicrophoneHold, microphoneTranspositions } from '../engine/microphone.ts';

export type MicSnapshot = Readonly<{
  live: boolean;
  requesting: boolean;
  statusText: string;
  pitchText: string;
  pitchTitle: string;
  cents: number | null;
  transpositionOffset: string;
  transpositionShort: string;
  error: string;
}>;

const shortTransposition = (offset: string) => {
  const item = microphoneTranspositions.find(entry => String(entry.offset) === offset);
  return item ? item.label.split(' — ')[0]! : 'C';
};

export function microphoneInput(
  accept: (answer: NoteAnswer, token: PromptToken) => void,
  onStateChange?: (snapshot: MicSnapshot) => void,
) {
  const node = el('div', 'notes-mic'); node.hidden = true;
  const controls = el('div', 'notes-mic-controls');
  const toggle = el('button', 'control'); toggle.type = 'button'; toggle.setAttribute('aria-pressed', 'false');
  const icon = el('img', 'notes-mic-icon');
  Object.assign(icon, { src: micAsset, alt: '', width: 24, height: 24 }); toggle.append(icon);
  const label = el('label', 'notes-mic-transposition', 'Transposition');
  const select = el('select', 'control'); select.setAttribute('aria-label', 'Microphone transposition');
  for (const item of microphoneTranspositions) {
    const option = el('option', '', item.label); option.value = String(item.offset); select.append(option);
  }
  try { const saved = localStorage.getItem('tunotes:mic-transposition'); if (microphoneTranspositions.some(item => String(item.offset) === saved)) select.value = saved!; } catch { /* Session-only preference. */ }
  let manualTransposition = select.value;
  label.append(select); controls.append(toggle, label);
  const pitch = el('p', 'notes-mic-pitch', '—');
  const meter = el('div', 'notes-mic-meter'); meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-valuemin', '-50'); meter.setAttribute('aria-valuemax', '50');
  meter.style.setProperty('--mic-tolerance', `${MIC_TOLERANCE_CENTS}%`);
  const marker = el('span', 'notes-mic-marker'); meter.append(marker);
  const scale = el('div', 'notes-mic-scale');
  scale.append(el('span', '', 'Flat'), el('span', '', 'In tune'), el('span', '', 'Sharp'));
  let currentCents: number | null = null;
  const setCents = (cents: number | null) => { currentCents = cents; marker.hidden = cents === null; marker.style.left = `${50 + (cents ?? 0)}%`; meter.setAttribute('aria-valuenow', String(cents ?? 0)); };
  setCents(null);
  meter.setAttribute('aria-label', 'Pitch deviation in cents');
  const hold = el('progress', 'notes-mic-hold'); hold.max = 1; hold.value = 0; hold.setAttribute('aria-label', 'Stable pitch hold');
  const status = el('p', 'muted notes-mic-status', `Start mic, then hold a note for ${MIC_HOLD_MS} ms within ±${MIC_TOLERANCE_CENTS} cents.`); status.setAttribute('role', 'status');
  node.append(controls, pitch, scale, meter, hold, status);
  const policy = new MicrophoneHold();
  let attackToken: PromptToken | undefined;
  let active = false, locked = true, token: PromptToken | undefined, identity = '', lastFrame = -1;
  let lastLive = false, lastRequesting = false, lastError = '';
  const getSnapshot = (): MicSnapshot => ({
    live: lastLive,
    requesting: lastRequesting,
    statusText: status.textContent ?? '',
    pitchText: pitch.textContent ?? '—',
    pitchTitle: pitch.title || 'Written pitch',
    cents: currentCents,
    transpositionOffset: select.value,
    transpositionShort: shortTransposition(select.value),
    error: lastError,
  });
  const notify = () => onStateChange?.(getSnapshot());
  const updateStatusMessage = () => {
    const message = lastError || (lastRequesting
      ? 'Allow microphone access to begin.'
      : lastLive
        ? locked
          ? 'Mic is live — play a note to test. Scoring begins when you start.'
          : `Hold a note for ${MIC_HOLD_MS} ms within ±${MIC_TOLERANCE_CENTS} cents. A4 = 440 Hz.`
        : `Start mic, then hold a note for ${MIC_HOLD_MS} ms within ±${MIC_TOLERANCE_CENTS} cents.`);
    if (status.textContent !== message) status.textContent = message;
  };
  const disarm = () => { policy.reset(); hold.value = 0; };
  const stop = () => { policy.clear(); hold.value = 0; audio.stop(); };
  const toggleCapture = () => { if (active) audio.toggle(); };
  const setTransposition = (offset: string) => {
    if (!microphoneTranspositions.some(item => String(item.offset) === offset)) return;
    select.value = offset;
    policy.clear(); hold.value = 0;
    manualTransposition = select.value;
    try { localStorage.setItem('tunotes:mic-transposition', select.value); } catch { /* Session-only preference. */ }
    notify();
  };
  toggle.addEventListener('click', toggleCapture);
  select.addEventListener('change', () => setTransposition(select.value));
  const audio = createMicrophoneCapture(state => {
    const live = ['requesting', 'listening', 'no-signal', 'unreliable'].includes(state.micStatus);
    lastLive = live;
    lastRequesting = state.micStatus === 'requesting';
    lastError = state.audioError;
    toggle.setAttribute('aria-label', live ? 'Stop mic' : 'Start mic'); toggle.title = live ? 'Stop mic' : 'Start mic'; toggle.setAttribute('aria-pressed', String(live));
    if (!live) { policy.clear(); pitch.textContent = '—'; pitch.title = 'Written pitch'; hold.value = 0; setCents(null); }
    updateStatusMessage();
    if (!live) { notify(); return; }
    if (state.pitchUpdatedAt === lastFrame) { notify(); return; }
    lastFrame = state.pitchUpdatedAt;
    const result = policy.update(state.pitchUpdatedAt, state.micStatus === 'listening' ? state.liveHz : null, Number(select.value), active && !locked && !document.hidden);
    if (result.progress === 0) attackToken = token;
    hold.value = result.progress; setCents(result.reading?.cents ?? null);
    pitch.textContent = result.reading ? `${noteName(result.reading.writtenNote)} · ${Math.round(result.reading.cents)}¢` : '—';
    pitch.title = result.reading ? `Written pitch · sounding ${noteName(result.reading.concertNote)}` : 'Written pitch';
    notify();
    if (result.answer !== undefined && attackToken) accept({ kind: 'keyboard', note: result.answer, matchOctave: true }, attackToken);
  });
  const visibility = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', visibility);
  return { node, stop, disarm, toggle: toggleCapture, setTransposition, getSnapshot, focus: () => toggle.focus(),
    setLocked(value: boolean) {
      locked = value;
      if (value) { policy.reset(); hold.value = 0; }
      updateStatusMessage();
      notify();
    },
    setInstrument(instrument: string | undefined) {
      select.value = String(instruments.find(item => item.id === instrument)?.transpose ?? manualTransposition);
      policy.clear(); hold.value = 0; pitch.textContent = '—'; setCents(null);
      notify();
    },
    enable(value: boolean) { if (active && !value) stop(); active = value; node.hidden = !value; notify(); },
    update(next: PromptToken, disabled: boolean, timed: boolean, overlap = false) {
      const key = `${next.session}:${next.prompt}`;
      if (!disabled && (locked || timed && identity !== key && !overlap)) policy.beginWindow();
      if (identity !== key && !overlap || disabled) { policy.reset(); hold.value = 0; }
      identity = key; token = next; locked = disabled;
      updateStatusMessage();
      notify();
    },
    dispose() { audio.dispose(); document.removeEventListener('visibilitychange', visibility); },
  };
}
