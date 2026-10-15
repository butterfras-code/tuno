import { button, el, field, select } from '../../shared/ui/components.ts';
import { scheduleClick } from '../../audio/click.ts';
import { inputAudioTime } from './timing.ts';
import { calibrationCount, calibrationPulse, calibrationWarmup, estimateOffset, estimateTapOffset, readOffset } from './offset.ts';
import type { InputKind, TimingOffset } from './offset.ts';
import type { AttemptRecord } from './capture.ts';
const storageKey = 'tuno.rhythm-walk.timing.v1';
/** Session correction is explicit evidence, never silently refitted on Retry. */
export function createTimingPanel(options: { audio: () => Promise<AudioContext>; busy: (active: boolean) => void }) {
  let offset: TimingOffset | undefined;
  try { offset = readOffset(sessionStorage.getItem(storageKey)); } catch { /* In-memory fallback. */ }
  const panel = el('section', 'calibration'); panel.setAttribute('aria-label', 'Timing setup');
  const message = el('p'); message.setAttribute('aria-live', 'polite');
  const automatic = el('input'); automatic.type = 'checkbox'; automatic.checked = true;
  const input = select([{ value: 'pointer', label: 'Touch / mouse' }, { value: 'keyboard', label: 'Keyboard (Space)' }]);
  input.value = offset?.input ?? (matchMedia('(pointer: coarse)').matches ? 'pointer' : 'keyboard');
  const calibrate = button('Tap-along calibration', () => { void begin(); });
  const reset = button('Reset timing', () => { offset = undefined; persist(); describe(); });
  const cancel = button('Cancel calibration', () => stop('Calibration cancelled. Previous timing kept.')); cancel.hidden = true;
  const pad = button('Calibration pad'); pad.className = 'pad'; pad.hidden = true; pad.setAttribute('aria-pressed', 'false');
  const progress = el('p'); progress.setAttribute('aria-live', 'polite'); progress.hidden = true;
  const controls = el('div', 'actions'); controls.append(field('Calibration input', input), calibrate, reset, cancel);
  panel.append(el('h2', '', 'Timing setup'), message, field('Estimate offset automatically from a consistent performance', automatic), controls,
    el('p', 'note', 'One measurement per session. Use the same input and audio output. Recalibrate after changing headphones, speakers, or input method. An estimate includes your tapping tendency as well as device delay.'), progress, pad);
  let active = false, generation = 0, held: string | null = null;
  let taps: number[] = [], firstClick = 0, context: AudioContext | undefined;
  let anchor = { performanceMs: 0, audioSeconds: 0 };
  let clicks: ReturnType<typeof scheduleClick>[] = [], timer: ReturnType<typeof setInterval> | undefined;
  let externalLock = false;
  function persist() { try { if (offset) sessionStorage.setItem(storageKey, JSON.stringify(offset)); else sessionStorage.removeItem(storageKey); } catch { /* Session memory remains usable. */ } }
  function describe() {
    reset.disabled = !offset || active || externalLock;
    message.textContent = offset ? `${offset.method === 'estimated' ? 'Estimated' : 'Tap-along'} timing offset: ${Math.round(offset.seconds * 1000)} ms for ${offset.input === 'keyboard' ? 'keyboard' : 'touch / mouse'}. Saved for this session; other input methods use raw timing.` : 'No timing offset saved. Play a steady exercise to estimate it automatically, or use tap-along calibration.';
  }
  function stop(text: string) {
    if (!active) return;
    active = false; generation++; held = null; clearInterval(timer); clicks.forEach(c => c.stop()); clicks = [];
    context?.removeEventListener('statechange', audioChanged);
    cancel.hidden = pad.hidden = progress.hidden = true; pad.setAttribute('aria-pressed', 'false');
    options.busy(false); setLocked(false); describe(); message.textContent += ` ${text}`;
  }
  function audioChanged() { if (context?.state !== 'running') stop('Audio interrupted. Please try again.'); }
  async function begin() {
    if (active || externalLock) return;
    active = true; const token = ++generation; taps = []; held = null;
    options.busy(true); setLocked(true); cancel.hidden = false; message.textContent = 'Starting calibration…';
    try {
      context = await options.audio();
      if (!active || token !== generation) return;
      if (context.state !== 'running' || document.hidden || !document.hasFocus()) { stop('Calibration could not start. Return to this page and try again.'); return; }
      anchor = { performanceMs: performance.now(), audioSeconds: context.currentTime };
      firstClick = context.currentTime + .25;
      for (let i = 0; i < calibrationCount; i++) clicks.push(scheduleClick(context, { time: firstClick + i * calibrationPulse, downbeat: i % 4 === 0, part: 0, beat: 0 }, { accent: true, clickVolume: 55, clickSound: 'wood' }));
      context.addEventListener('statechange', audioChanged);
      message.textContent = 'Listen to four warm-up clicks, then tap once with each click. Follow the sound rather than waiting for the text to change.';
      pad.hidden = progress.hidden = false; pad.focus();
      timer = setInterval(() => {
        const time = context!.currentTime - firstClick;
        const beat = Math.floor(time / calibrationPulse);
        const text = beat < calibrationWarmup ? `Listen: ${Math.max(0, beat + 1)} / ${calibrationWarmup}` : `Tap along: ${Math.min(12, beat - calibrationWarmup + 1)} / 12`;
        if (progress.textContent !== text) progress.textContent = text;
        if (time >= (calibrationCount - 1) * calibrationPulse + .4) {
          const estimated = estimateTapOffset(taps, input.value as InputKind);
          if (estimated.ok) { offset = estimated.offset; persist(); }
          stop(estimated.ok ? 'Calibration complete. Start an exercise when ready.' : estimated.reason);
        }
      }, 25);
    } catch { stop('Audio could not start. Please try again.'); }
  }
  function down(source: string, timestamp: number) {
    if (!active || !context || held) return;
    held = source; pad.setAttribute('aria-pressed', 'true');
    const monotonic = timestamp > 1e12 ? timestamp - performance.timeOrigin : timestamp;
    taps.push(inputAudioTime(monotonic, anchor) - firstClick);
  }
  function up(source: string) { if (held === source) { held = null; pad.setAttribute('aria-pressed', 'false'); } }
  pad.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (input.value === 'keyboard' && !e.repeat) down('keyboard', e.timeStamp); } });
  pad.addEventListener('keyup', e => { if (e.code === 'Space') { e.preventDefault(); up('keyboard'); } });
  pad.addEventListener('pointerdown', e => { if (input.value !== 'pointer' || e.button !== 0) return; e.preventDefault(); down(`pointer:${e.pointerId}`, e.timeStamp); if (held === `pointer:${e.pointerId}`) pad.setPointerCapture(e.pointerId); });
  pad.addEventListener('pointerup', e => up(`pointer:${e.pointerId}`));
  pad.addEventListener('pointercancel', () => stop('Touch interrupted. Please try again.'));
  pad.addEventListener('lostpointercapture', e => { if (held === `pointer:${e.pointerId}`) stop('Touch interrupted. Please try again.'); });
  pad.addEventListener('blur', e => { if (e.relatedTarget !== cancel) stop('Calibration lost focus. Please try again.'); });
  window.addEventListener('blur', () => stop('Calibration lost focus. Please try again.'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop('Calibration interrupted. Please try again.'); });
  window.addEventListener('pagehide', () => stop('Calibration interrupted.'));
  function setLocked(locked: boolean) {
    externalLock = locked;
    automatic.disabled = input.disabled = calibrate.disabled = locked;
    reset.disabled = locked || !offset;
  }
  describe();
  return {
    panel, setLocked,
    cancel: () => stop('Calibration cancelled. Previous timing kept.'),
    current: () => offset ? { ...offset } : undefined,
    consider: (record: AttemptRecord): TimingOffset | undefined => {
      if (offset || !automatic.checked || record.status !== 'completed') return offset;
      const estimated = estimateOffset(record);
      if (estimated.ok) { offset = estimated.offset; input.value = offset.input; persist(); describe(); }
      else message.textContent = estimated.reason;
      return offset;
    },
  };
}
