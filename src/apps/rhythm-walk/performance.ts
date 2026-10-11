import { createTimingPanel } from './calibration.ts';
import { el, button, field, numberInput } from '../../shared/ui/components.ts';
import type { Exercise } from './fixtures.ts';
import type { Preferences } from './activity.ts';
import { sourcePolicy } from './shared/meter.ts';
import { Capture } from './capture.ts';
import type { AttemptRecord } from './capture.ts';
import { evaluateAttempt } from './evaluation.ts';
import { planPassage } from './timing.ts';
import type { Plan } from './timing.ts';
import { Transport } from './transport.ts';

export function createPerformance(options: { exercise: () => Exercise; preferences: Preferences; changed: () => void; busy: (active: boolean) => void; decorate: (record: AttemptRecord | null) => void }) {
  const main = el('section', 'tap-response'); main.setAttribute('aria-label', 'Tap Rhythms');
  let audio: AudioContext | undefined;
  let transport: Transport | null = null;
  let starting = false;
  let startCancelled = false;
  let generation = 0;
  let pending: Capture | null = null;
  let result: AttemptRecord | null = null;

  const tempo = numberInput(40, 180, options.preferences.bpm);
  const metronome = el('input'); metronome.type = 'checkbox'; metronome.checked = options.preferences.metronome;
  const metronomeLabel = field('Metronome during exercise', metronome);
  const setup = el('div', 'setup'); const tempoField = field('Tempo (quarter-note BPM)', tempo); setup.append(tempoField, metronomeLabel);
  function persist() { if (tempo.checkValidity()) options.preferences.bpm = tempo.valueAsNumber; options.preferences.metronome = metronome.checked; options.changed(); }
  tempo.addEventListener('change', persist); metronome.addEventListener('change', persist);
  const attemptSummary = el('p', 'attempt-summary'); attemptSummary.hidden = true;
  const status = el('p', 'status', 'Ready'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const countInDisplay = el('div', 'count-in-display'); countInDisplay.setAttribute('role', 'group');
  let countInDots: HTMLElement[] = [];
  function renderCountIn(plan: Plan) {
    const clicks = plan.pulses.filter(p => p.countIn);
    countInDisplay.setAttribute('aria-label', `Count-in: ${clicks.length} ${pulseLabel()} beats; Ready, Go on the final two`);
    countInDots = clicks.map((click, index) => {
      const item = el('div', 'count-in-beat');
      item.append(el('span', 'count-in-dot', String(click.beat)));
      const cue = index === clicks.length - 2 ? 'Ready' : index === clicks.length - 1 ? 'Go' : '';
      item.append(el('span', 'count-in-cue', cue));
      item.setAttribute('aria-label', `Beat ${click.beat}${cue ? `, ${cue}` : ''}`);
      return item;
    });
    countInDisplay.replaceChildren(...countInDots);
  }
  function clearCountIn() { countInDots.forEach(dot => { dot.classList.remove('lit'); dot.removeAttribute('aria-current'); }); }
  const pulse = el('div', 'pulse'); pulse.setAttribute('aria-hidden', 'true');
  const instructions = el('p', '', 'Start gives four audible quarter-note pulses. Use Space while the pad has focus, or hold the pad. Release before the exercise starts. Ties require one uninterrupted hold.'); instructions.id = 'instructions';
  const pad = button('Performance pad'); pad.className = 'pad'; pad.setAttribute('aria-describedby', 'instructions'); pad.setAttribute('aria-pressed', 'false'); pad.disabled = true;
  const start = button('Start count-in', () => { void begin(); });
  const retry = button('Retry same exercise', () => { void begin(); }); retry.hidden = true;
  const stop = button('Stop / Cancel', () => cancel('Stopped by learner')); stop.disabled = true;
  const download = button('Download timing evidence', () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
    const link = el('a'); link.href = url; link.download = `rhythm-walk-${result.exercise.id}.json`; link.click(); URL.revokeObjectURL(url);
  }); download.hidden = true;
  const actions = el('div', 'actions'); actions.append(start, retry, stop, download);
  const review = el('section'); review.setAttribute('aria-label', 'Attempt review');
  const timing = createTimingPanel({
    audio: async () => { audio ??= new AudioContext(); await audio.resume(); return audio; },
    busy: active => { main.classList.toggle('calibrating', active); lock(active); if (active) pad.disabled = true; },
  });
  const dialog = el('dialog', 'timing-dialog'); dialog.setAttribute('aria-label', 'Timing setup');
  const close = button('Close timing setup', () => { timing.cancel(); dialog.close(); });
  dialog.append(timing.panel, close);
  dialog.addEventListener('cancel', () => timing.cancel());
  dialog.addEventListener('close', () => timing.cancel());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { timing.cancel(); dialog.close(); } } });
  const calibrate = button('Calibrate', () => dialog.showModal());
  actions.append(calibrate);
  main.append(pad, actions, el('h2', '', 'Tap Rhythms'), setup, attemptSummary, instructions, status, pulse, review, dialog, el('p', 'note', 'Timing windows are provisional. Browser and device latency can affect offsets. This prototype reports evidence, without mastery scores. Timing correction is fixed for the session; raw evidence remains available.'));

  function lock(active: boolean) {
    timing.setLocked(active);
    main.classList.toggle('active', active); attemptSummary.hidden = !active; options.busy(active);
    tempo.disabled = metronome.disabled = start.disabled = retry.disabled = active;
    stop.disabled = !active; pad.disabled = !active; download.disabled = calibrate.disabled = active;
  }
  function tick(time: number) {
    if (!transport) return;
    const phase = transport.capture.phase(time);
    const next = phase === 'count-in' ? 'Count-in — release before the start' : time >= transport.capture.plan.duration ? 'Performing — capturing final release' : 'Performing';
    if (status.textContent !== next) status.textContent = next;
    const pulses = transport.capture.plan.pulses;
    const latest = [...pulses].reverse().find(p => p.time <= time);
    const countClicks = pulses.filter(p => p.countIn);
    countInDots.forEach((dot, index) => {
      const click = countClicks[index]!;
      const active = time >= click.time && time < click.time + transport!.capture.plan.pulseSeconds && time < 0;
      dot.classList.toggle('lit', active);
      if (active) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
    });
    pulse.classList.toggle('lit', !!latest && time - latest.time < Math.min(.12, transport.capture.plan.pulseSeconds / 3));
  }
  async function begin() {
    if (transport || starting) return;
    if (!tempo.reportValidity()) return;
    // Snapshot before awaiting audio activation, even though controls are locked.
    const capture = new Capture(options.exercise(), tempo.valueAsNumber, metronome.checked, undefined, timing.current());
    attemptSummary.textContent = `${capture.exercise.label} · ${capture.bpm} ${pulseLabel()} BPM · ${capture.metronome ? 'metronome on' : 'metronome off'}`;
    renderCountIn(capture.plan);
    const token = ++generation; pending = capture;
    starting = true; startCancelled = false; lock(true); status.textContent = 'Ready — activating audio';
    try {
      audio ??= new AudioContext(); await audio.resume();
      if (token !== generation) return;
      if (startCancelled || document.hidden || !document.hasFocus()) {
        finish(capture.interrupt('Start cancelled or focus lost', -capture.plan.countIn)); return;
      }
      if (audio.state !== 'running') throw new Error('Audio could not start');
      result = null; review.replaceChildren(); retry.hidden = true; download.hidden = true;
      options.decorate(null);
      transport = new Transport(audio, capture, tick, finish); pad.focus({ preventScroll: true }); tick(transport.time());
    } catch {
      if (token !== generation) return;
      finish(capture.interrupt('Audio could not start. Check browser audio permissions and retry.', -capture.plan.countIn));
    } finally { if (token === generation) { starting = false; pending = null; } }
  }
  function offset(value: number | null) { return value === null ? 'no release observed' : Math.abs(value) < .0005 ? 'on time (0 ms)' : `${Math.round(Math.abs(value) * 1000)} ms ${value < 0 ? 'early' : 'late'}`; }
  function finish(record: AttemptRecord) {
    const correction = record.timingOffset ?? timing.consider(record);
    if (correction) record = { ...record, timingOffset: correction };
    clearCountIn();
    result = record; transport = null; pointer = null; lock(false); pulse.classList.remove('lit'); pad.setAttribute('aria-pressed', 'false');
    retry.hidden = false; download.hidden = false;
    const evaluation = evaluateAttempt(record);
    review.replaceChildren(el('h2', '', record.status === 'completed' ? 'Completed attempt' : 'Interrupted attempt'));
    if (evaluation.status === 'interrupted') {
      status.textContent = 'Interrupted'; review.append(el('p', '', `${record.reason}. Timing evidence retained; this attempt is not graded.`)); return;
    }
    status.textContent = 'Reviewing';
    if (record.timingOffset) review.append(el('p', '', `${Math.round(record.timingOffset.seconds * 1000)} ms timing offset subtracted for ${record.timingOffset.input === 'keyboard' ? 'keyboard' : 'touch / mouse'}. This fixed session correction changes neither spacing nor hold lengths. Other input methods remain uncorrected.`));
    review.append(el('p', '', `${evaluation.matches.length} matched attacks · ${evaluation.missing.length} missing · ${evaluation.extra.length} extra. Review onset, release, and rest evidence below.`));
    const list = el('ol');
    record.plan.notes.forEach((note, i) => {
      const match = evaluation.matches.find(m => m.expected === i);
      const refs = note.sources.map(s => `measure ${s.measure + 1}, note ${s.event + 1}`).join(' → ');
      const text = `${refs}${note.sources.length > 1 ? ' (tied chain)' : ''}: ${match ? `attack ${offset(match.onsetOffset)}; release ${offset(match.releaseOffset)}` : 'missing attack'}.`;
      const item = el('li', '', text); item.id = `feedback-note-${i}`; list.append(item);

    });
    record.plan.rests.forEach((rest, i) => {
      const overlaps = evaluation.restOverlaps.filter(o => o.rest === i);
      const text = `Measure ${rest.source.measure + 1}, rest ${rest.source.event + 1}: ${overlaps.length ? overlaps.map(o => `${Math.round((o.end - o.start) * 1000)} ms of input overlap`).join('; ') : 'silent'}.`;
      const item = el('li', '', text); item.id = `feedback-rest-${i}`; list.append(item);

    });
    evaluation.extra.forEach(i => list.append(el('li', '', `Extra attack at ${evaluation.holds[i]!.down.toFixed(3)} s after exercise start.`)));
    review.append(list); options.decorate(record);
    if (record.timingOffset) {
      const raw = evaluateAttempt(record, null);
      const details = el('details'); details.append(el('summary', '', 'Raw timing before correction'));
      details.append(el('p', '', `${raw.matches.length} matched attacks · ${raw.missing.length} missing · ${raw.extra.length} extra (uncorrected).`));
      const rawList = el('ul');
      raw.matches.forEach(match => rawList.append(el('li', '', `Attack ${match.expected + 1}: ${offset(match.onsetOffset)}; release ${offset(match.releaseOffset)}.`)));
      raw.extra.forEach(i => rawList.append(el('li', '', `Unmatched raw attack at ${raw.holds[i]!.down.toFixed(3)} s.`)));
      details.append(rawList); review.append(details);
    }
    if (record.events.some(e => e.region === 'count-in' && e.action === 'down' && e.accepted)) review.append(el('p', '', 'Count-in presses were retained separately. A hold across the start creates no exercise attack; release it before pressing again.'));
  }
  // Keyboard capture is scoped to focused pad. Repeats and duplicate sources remain raw evidence.
  pad.addEventListener('keydown', e => { if (e.code === 'Space' && transport) { e.preventDefault(); transport.input('down', 'keyboard', e.timeStamp, e.repeat); pad.setAttribute('aria-pressed', String(transport.capture.heldBy !== null)); } });
  pad.addEventListener('keyup', e => { if (e.code === 'Space' && transport) { e.preventDefault(); transport.input('up', 'keyboard', e.timeStamp); pad.setAttribute('aria-pressed', String(transport.capture.heldBy !== null)); } });
  let pointer: number | null = null;
  pad.addEventListener('pointerdown', e => {
    if (!transport || e.button !== 0) return; e.preventDefault(); pad.focus();
    transport.input('down', `pointer:${e.pointerId}`, e.timeStamp);
    if (transport.capture.heldBy === `pointer:${e.pointerId}` && pointer === null) { pointer = e.pointerId; pad.setPointerCapture(e.pointerId); pad.setAttribute('aria-pressed', 'true'); }
  });
  pad.addEventListener('pointerup', e => {
    transport?.input('up', `pointer:${e.pointerId}`, e.timeStamp);
    if (pointer === e.pointerId) { pointer = null; pad.setAttribute('aria-pressed', 'false'); }
  });
  pad.addEventListener('pointercancel', e => { if (pointer === e.pointerId) { pointer = null; transport?.interrupt('Pointer cancelled'); } });
  pad.addEventListener('lostpointercapture', e => { if (pointer === e.pointerId) { pointer = null; transport?.interrupt('Pointer capture lost'); } });
  pad.addEventListener('blur', e => { if (e.relatedTarget === stop) return; if (starting) startCancelled = true; transport?.interrupt('Performance pad lost focus'); });
  window.addEventListener('blur', () => { if (starting) startCancelled = true; transport?.interrupt('Window lost focus'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { startCancelled = true; transport?.interrupt('Page backgrounded'); } });
  window.addEventListener('pagehide', () => transport?.interrupt('Page left'));

  function pulseLabel() { return sourcePolicy(options.exercise().measures[0]!).compound ? 'dotted-quarter' : 'quarter-note'; }
  function refreshExercise() {
    tempoField.querySelector('.field-label')!.textContent = `Tempo (${pulseLabel()} BPM)`;
    const plan = planPassage(options.exercise().measures, options.preferences.bpm, undefined, sourcePolicy(options.exercise().measures[0]!).pulse);
    renderCountIn(plan);
    const count = plan.pulses.filter(p => p.countIn).length;
    instructions.textContent = `Start gives ${count} audible ${pulseLabel()} pulses. Use Space while the pad has focus, or hold the pad. Release before the exercise starts. Ties require one uninterrupted hold.`;
  }
  function cancel(reason: string) {
    timing.cancel();
    if (dialog.open) dialog.close();
    if (starting && pending) {
      const capture = pending; generation++; starting = false; pending = null; startCancelled = true;
      finish(capture.interrupt(reason, -capture.plan.countIn));
    }
    transport?.interrupt(reason);
  }
  refreshExercise();
  return {
    section: main,
    countInDisplay,
    cancel,
    start: begin,
    record: () => result,
    reset: () => { cancel('Exercise changed'); result = null; review.replaceChildren(); retry.hidden = download.hidden = true; status.textContent = 'Ready'; options.decorate(null); refreshExercise(); },
  };

}
