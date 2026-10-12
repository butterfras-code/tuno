import { createTimingPanel } from './calibration.ts';
import { el, button, field, numberInput, select } from '../../shared/ui/components.ts';
import { playOptions, playInstructions } from './play-policy.ts';
import type { PlayStyle } from './play-policy.ts';
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
  const howToPlay = select(playOptions, value => {
    options.preferences.playStyle = value as PlayStyle; options.changed(); refreshExercise();
  });
  howToPlay.value = options.preferences.playStyle; howToPlay.dataset.setting = 'how-to-play';
  const playField = field('How to play', howToPlay);
  const playHint = el('p', 'setting-hint', playInstructions[options.preferences.playStyle]);
  playHint.id = 'how-to-play-hint'; howToPlay.setAttribute('aria-describedby', playHint.id); playField.append(playHint);
  const tempoField = field('Tempo (quarter-note BPM)', tempo); tempoField.className = 'score-tempo';
  tempoField.querySelector('.field-label')!.className = 'field-label sr-only';
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<path d="M9 3h6l5 18H4L9 3Z M8 17h8 M12 17l5-11 M14 9l4 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
  const tempoUnit = el('span', 'tempo-unit', '♩ ='); tempoUnit.setAttribute('aria-hidden', 'true');
  const bpm = el('span', 'tempo-bpm', 'BPM'); bpm.setAttribute('aria-hidden', 'true');
  tempoField.prepend(icon, tempoUnit); tempoField.append(bpm);
  function persist() { if (tempo.checkValidity()) options.preferences.bpm = tempo.valueAsNumber; options.preferences.metronome = metronome.checked; options.changed(); }
  tempo.addEventListener('change', persist); metronome.addEventListener('change', persist);
  const status = el('span', 'status', 'Ready'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const countInDisplay = el('span', 'count-in-display'); countInDisplay.hidden = true; countInDisplay.setAttribute('role', 'group');
  let countInDots: HTMLElement[] = [];
  function renderCountIn(plan: Plan) {
    const clicks = plan.pulses.filter(p => p.countIn);
    countInDisplay.setAttribute('aria-label', `Count-in: ${clicks.length} ${pulseLabel()} beats; Ready, Go on the final two`);
    countInDots = clicks.map((click, index) => {
      const item = el('span', 'count-in-beat');
      item.append(el('span', 'count-in-dot', String(click.beat)));
      const cue = index === clicks.length - 2 ? 'Ready' : index === clicks.length - 1 ? 'Go' : '';
      item.append(el('span', 'count-in-cue', cue));
      item.setAttribute('aria-label', `Beat ${click.beat}${cue ? `, ${cue}` : ''}`);
      return item;
    });
    countInDisplay.replaceChildren(...countInDots);
  }
  function clearCountIn() { countInDisplay.hidden = true; countInDots.forEach(dot => { dot.classList.remove('lit'); dot.removeAttribute('aria-current'); }); }
  const pulse = el('span', 'pulse'); pulse.hidden = true; pulse.setAttribute('aria-hidden', 'true');
  const instructions = el('p', '', 'Start gives four audible quarter-note pulses. Use Space while the pad has focus, or hold the pad. Release before the exercise starts. Ties require one uninterrupted hold.'); instructions.id = 'instructions';
  const pad = button(''); pad.className = 'pad'; pad.setAttribute('aria-label', 'Performance pad');
  const padAction = el('span', 'pad-action', 'Start'); pad.append(padAction, countInDisplay, status, pulse); pad.setAttribute('aria-describedby', 'instructions'); pad.setAttribute('aria-pressed', 'false'); pad.disabled = false;
  const stop = button('Stop', () => cancel('Stopped by learner')); stop.disabled = true;
  const download = button('Download timing evidence', () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
    const link = el('a'); link.href = url; link.download = `rhythm-walk-${result.exercise.id}.json`; link.click(); URL.revokeObjectURL(url);
  }); download.hidden = true;
  const actions = el('div', 'pad-tools'); actions.append(stop);
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
  const help = el('div', 'performance-help');
  help.append(instructions, el('p', 'note', 'Timing windows are provisional. Browser and device latency can affect offsets. This prototype reports evidence, without mastery scores. Timing correction is fixed for the session; raw evidence remains available.'));
  const surface = el('div', 'performance-surface'); surface.append(pad, actions);
  main.append(surface, review, dialog);

  function lock(active: boolean) {
    timing.setLocked(active);
    main.classList.toggle('active', active); options.busy(active);
    tempo.disabled = metronome.disabled = howToPlay.disabled = active;
    stop.disabled = !active; pad.disabled = false; padAction.textContent = active ? 'Starting…' : result ? 'Try again' : 'Start'; download.disabled = calibrate.disabled = active;
  }
  function tick(time: number) {
    if (!transport) return;
    const phase = transport.capture.phase(time);
    countInDisplay.hidden = phase !== 'count-in'; pulse.hidden = phase === 'count-in';
    padAction.textContent = phase === 'count-in' ? 'Count In' : transport.capture.playStyle === 'hold' ? 'Tap + Hold' : 'Tap';
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
    const capture = new Capture(options.exercise(), tempo.valueAsNumber, metronome.checked, undefined, timing.current(), options.preferences.playStyle);
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
      result = null; review.replaceChildren(); download.hidden = true;
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
    clearCountIn(); pulse.hidden = true;
    result = record; transport = null; pointer = null; lock(false); pulse.classList.remove('lit'); pad.setAttribute('aria-pressed', 'false');
    download.hidden = false;
    const evaluation = evaluateAttempt(record);
    const evidence = el('details', 'timing-evidence'); evidence.append(el('summary', '', 'Timing evidence'), download);
    review.replaceChildren(el('h2', '', record.status === 'completed' ? 'Completed attempt' : 'Interrupted attempt'), evidence);
    if (evaluation.status === 'interrupted') {
      status.textContent = 'Interrupted'; review.append(el('p', '', `${record.reason}. Timing evidence retained; this attempt is not graded.`)); return;
    }
    status.textContent = 'Reviewing';
    if (record.timingOffset) review.append(el('p', '', `${Math.round(record.timingOffset.seconds * 1000)} ms timing offset subtracted for ${record.timingOffset.input === 'keyboard' ? 'keyboard' : 'touch / mouse'}. This fixed session correction changes neither spacing nor hold lengths. Other input methods remain uncorrected.`));
    const holdStyle = (record.playStyle ?? 'hold') === 'hold';
    review.append(el('p', '', `${holdStyle ? 'Tap + Hold' : 'Tap'} · ${evaluation.matches.length} matched attacks · ${evaluation.missing.length} missing · ${evaluation.extra.length} extra. ${holdStyle ? 'Review attacks, duration and releases below.' : 'Review attacks below. Releases are not graded.'}`));
    const list = el('ol');
    record.plan.notes.forEach((note, i) => {
      const match = evaluation.matches.find(m => m.expected === i);
      const refs = note.sources.map(s => `measure ${s.measure + 1}, note ${s.event + 1}`).join(' → ');
      const text = `${refs}${note.sources.length > 1 ? ' (tied chain)' : ''}: ${match ? `attack ${offset(match.onsetOffset)} (${match.attackAccepted ? 'within provisional tolerance' : 'outside provisional tolerance'})${holdStyle ? `; release ${offset(match.releaseOffset)}; duration ${match.durationFeedback}` : ''}` : 'missing attack'}.`;
      const item = el('li', '', text); item.id = `feedback-note-${i}`; list.append(item);

    });
    record.plan.rests.forEach((rest, i) => {
      const overlaps = evaluation.restOverlaps.filter(o => o.rest === i);
      const attacks = evaluation.restAttacks.filter(o => o.rest === i);
      const text = `Measure ${rest.source.measure + 1}, rest ${rest.source.event + 1}: ${holdStyle ? overlaps.length ? `${overlaps.map(o => `${Math.round((o.end - o.start) * 1000)} ms of input overlap`).join('; ')} (${evaluation.restViolations.some(o => o.rest === i) ? 'release needs attention' : 'within release tolerance'})` : 'silent' : attacks.length ? `${attacks.length} attack(s) during rest` : 'no attacks during rest'}.`;
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
  // Starting is a separate gesture: its release must never enter the capture.
  let startingKey = false;
  let startingPointer: number | null = null;
  pad.addEventListener('click', event => { if (event.detail === 0 && !transport && !starting) void begin(); });
  // Keyboard capture is scoped to focused pad. Repeats and duplicate sources remain raw evidence.
  pad.addEventListener('keydown', event => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (!transport) {
      if (!event.repeat && !starting) { startingKey = true; void begin(); }
      return;
    }
    if (startingKey) return;
    transport.input('down', 'keyboard', event.timeStamp, event.repeat);
    pad.setAttribute('aria-pressed', String(transport.capture.heldBy !== null));
  });
  pad.addEventListener('keyup', event => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (startingKey) { startingKey = false; return; }
    if (!transport) return;
    transport.input('up', 'keyboard', event.timeStamp);
    pad.setAttribute('aria-pressed', String(transport.capture.heldBy !== null));
  });
  let pointer: number | null = null;
  pad.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); pad.focus();
    if (!transport) {
      if (!starting) { startingPointer = e.pointerId; pad.setPointerCapture(e.pointerId); void begin(); }
      return;
    }
    transport.input('down', `pointer:${e.pointerId}`, e.timeStamp);
    if (transport.capture.heldBy === `pointer:${e.pointerId}` && pointer === null) { pointer = e.pointerId; pad.setPointerCapture(e.pointerId); pad.setAttribute('aria-pressed', 'true'); }
  });
  pad.addEventListener('pointerup', e => {
    if (startingPointer === e.pointerId) { startingPointer = null; return; }
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
    tempo.setAttribute('aria-label', `Tempo (${pulseLabel()} BPM)`);
    tempoUnit.textContent = pulseLabel() === 'dotted-quarter' ? '♩. =' : '♩ =';
    const plan = planPassage(options.exercise().measures, options.preferences.bpm, undefined, sourcePolicy(options.exercise().measures[0]!).pulse);
    renderCountIn(plan);
    const count = plan.pulses.filter(p => p.countIn).length;
    playHint.textContent = playInstructions[options.preferences.playStyle];
    instructions.textContent = `Starting the pad gives ${count} audible ${pulseLabel()} pulses. Use Space while the pad has focus, or the pad. Release before the exercise starts. ${playInstructions[options.preferences.playStyle]} ${options.preferences.playStyle === 'hold' ? 'Ties require one uninterrupted hold.' : 'Tied notes need only one tap at the start of the chain.'}`;
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
    tempoField,
    metronomeField: metronomeLabel,
    playField,
    help,
    cancel,
    start: begin,
    record: () => result,
    reset: () => { cancel('Exercise changed'); result = null; review.replaceChildren(); download.hidden = true; padAction.textContent = 'Start'; status.textContent = 'Ready'; options.decorate(null); refreshExercise(); },
  };

}
