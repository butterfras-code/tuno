import { createAudioController } from '../../../audio/controller.ts';
import { createPracticeStore } from '../../../practice/state.ts';
import { noteName } from '../../../music/pitch.ts';
import { el } from '../../../shared/ui/components.ts';
import type { NoteAnswer } from '../domain/fingering.ts';
import type { PromptToken } from '../engine/practice.ts';
import { MicrophoneHold, microphoneTranspositions } from '../engine/microphone.ts';

export function microphoneInput(accept: (answer: NoteAnswer, token: PromptToken) => void) {
  const node = el('div', 'notes-mic'); node.hidden = true;
  const controls = el('div', 'notes-mic-controls');
  const toggle = el('button', 'control', 'Start mic'); toggle.type = 'button'; toggle.setAttribute('aria-pressed', 'false');
  const label = el('label', 'notes-mic-transposition', 'Transposition');
  const select = el('select', 'control'); select.setAttribute('aria-label', 'Microphone transposition');
  for (const item of microphoneTranspositions) {
    const option = el('option', '', item.label); option.value = String(item.offset); select.append(option);
  }
  try { const saved = localStorage.getItem('tunotes:mic-transposition'); if (microphoneTranspositions.some(item => String(item.offset) === saved)) select.value = saved!; } catch { /* Session-only preference. */ }
  label.append(select); controls.append(toggle, label);
  const pitch = el('p', 'notes-mic-pitch', '—');
  const meter = el('div', 'notes-mic-meter'); meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-valuemin', '-50'); meter.setAttribute('aria-valuemax', '50');
  const marker = el('span', 'notes-mic-marker'); meter.append(marker);
  const scale = el('div', 'notes-mic-scale');
  scale.append(el('span', '', 'Flat'), el('span', '', 'In tune'), el('span', '', 'Sharp'));
  const setCents = (cents: number | null) => { marker.hidden = cents === null; marker.style.left = `${50 + (cents ?? 0)}%`; meter.setAttribute('aria-valuenow', String(cents ?? 0)); };
  setCents(null);
  meter.setAttribute('aria-label', 'Pitch deviation in cents');
  const hold = el('progress', 'notes-mic-hold'); hold.max = 1; hold.value = 0; hold.setAttribute('aria-label', 'Stable pitch hold');
  const status = el('p', 'muted notes-mic-status', 'Start mic, then hold a note for 300 ms within ±25 cents.'); status.setAttribute('role', 'status');
  node.append(controls, pitch, scale, meter, hold, status);
  const store = createPracticeStore(), audio = createAudioController(store), policy = new MicrophoneHold();
  let active = false, locked = true, token: PromptToken | undefined, identity = '', lastFrame = -1;
  const stop = () => { policy.clear(); audio.stopMic(); };
  toggle.addEventListener('click', () => { if (active) audio.toggleMic(); });
  select.addEventListener('change', () => {
    policy.clear(); hold.value = 0;
    try { localStorage.setItem('tunotes:mic-transposition', select.value); } catch { /* Session-only preference. */ }
  });
  const unsubscribe = store.subscribe(state => {
    const live = ['requesting', 'listening', 'no-signal', 'unreliable'].includes(state.micStatus);
    toggle.textContent = live ? 'Stop mic' : 'Start mic'; toggle.setAttribute('aria-pressed', String(live));
    if (!live) { policy.clear(); pitch.textContent = '—'; hold.value = 0; setCents(null); }
    const message = state.audioError || (state.micStatus === 'requesting' ? 'Allow microphone access to begin.' : live ? 'Hold a note for 300 ms within ±25 cents. A4 = 440 Hz.' : 'Start mic, then hold a note for 300 ms within ±25 cents.');
    if (status.textContent !== message) status.textContent = message;
    if (!live || state.pitchUpdatedAt === lastFrame) return;
    lastFrame = state.pitchUpdatedAt;
    const result = policy.update(state.pitchUpdatedAt, state.micStatus === 'listening' ? state.liveHz : null, Number(select.value), active && !locked && !document.hidden);
    hold.value = result.progress; setCents(result.reading?.cents ?? null);
    pitch.textContent = result.reading ? `${noteName(result.reading.writtenNote)} · ${Math.round(result.reading.cents)}¢` : '—';
    pitch.title = result.reading ? `Written pitch · sounding ${noteName(result.reading.concertNote)}` : 'Written pitch';
    if (result.answer !== undefined && token) accept({ kind: 'keyboard', note: result.answer, matchOctave: true }, token);
  });
  const visibility = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', visibility);
  return { node, stop, focus: () => toggle.focus(),
    enable(value: boolean) { if (active && !value) stop(); active = value; node.hidden = !value; },
    update(next: PromptToken, disabled: boolean) {
      const key = `${next.session}:${next.prompt}`;
      if (identity !== key || disabled) { policy.reset(); hold.value = 0; }
      identity = key; token = next; locked = disabled;
    },
    dispose() { unsubscribe(); audio.dispose(); document.removeEventListener('visibilitychange', visibility); },
  };
}
