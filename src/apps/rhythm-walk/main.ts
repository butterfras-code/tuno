import '../../tokens.css';
import './styles.css';
import { el, button, field, select, numberInput } from '../../shared/ui/components.ts';
import { exercises } from './fixtures.ts';
import { notation } from './notation.ts';
import { Capture } from './capture.ts';
import type { AttemptRecord } from './capture.ts';
import { evaluateAttempt } from './evaluation.ts';
import { Transport } from './transport.ts';
const app = document.querySelector<HTMLElement>('#app')!;
const main = el('main');
main.append(el('p', 'eyebrow', 'tUno · Development prototype'), el('h1', '', 'Rhythm Walk'), el('p', '', 'Read the rhythm. Press, hold, release. Stay silent for rests.'));
let exercise = exercises[0]!;
let audio: AudioContext | undefined;
let transport: Transport | null = null;
let starting = false;
let startCancelled = false;
let result: AttemptRecord | null = null;
let score = notation(exercise.measures);
const picker = select(exercises.map(e => ({ value: e.id, label: e.label })), id => {
  exercise = exercises.find(e => e.id === id)!; result = null;
  const next = notation(exercise.measures); score.replaceWith(next); score = next;
  description.textContent = exercise.description; review.replaceChildren(); retry.hidden = true; download.hidden = true; status.textContent = 'Ready';
});
const tempo = numberInput(40, 180, 80);
const metronome = el('input'); metronome.type = 'checkbox'; metronome.checked = true;
const metronomeLabel = field('Metronome during exercise', metronome);
const setup = el('div', 'setup'); setup.append(field('Exercise', picker), field('Tempo (quarter-note BPM)', tempo), metronomeLabel);
const description = el('p', '', exercise.description);
const attemptSummary = el('p', 'attempt-summary'); attemptSummary.hidden = true;
const status = el('p', 'status', 'Ready'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
const pulse = el('div', 'pulse'); pulse.setAttribute('aria-hidden', 'true');
const instructions = el('p', '', 'Start gives four audible quarter-note pulses. Use Space while the pad has focus, or hold the pad. Release before the exercise starts. Ties require one uninterrupted hold.'); instructions.id = 'instructions';
const pad = button('Performance pad'); pad.className = 'pad'; pad.setAttribute('aria-describedby', 'instructions'); pad.setAttribute('aria-pressed', 'false'); pad.disabled = true;
const start = button('Start count-in', () => { void begin(); });
const retry = button('Retry same exercise', () => { void begin(); }); retry.hidden = true;
const stop = button('Stop / Cancel', () => {
  if (starting) { startCancelled = true; return; }
  transport?.interrupt('Stopped by learner');
}); stop.disabled = true;
const download = button('Download timing evidence', () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
  const link = el('a'); link.href = url; link.download = `rhythm-walk-${result.exercise.id}.json`; link.click(); URL.revokeObjectURL(url);
}); download.hidden = true;
const actions = el('div', 'actions'); actions.append(start, retry, stop, download);
const review = el('section'); review.setAttribute('aria-label', 'Attempt review');
main.append(setup, description, attemptSummary, score, instructions, status, pulse, pad, actions, review, el('p', 'note', 'Timing windows are provisional. Browser and device latency can affect offsets. This prototype reports evidence, without scores or automatic calibration.'));
app.append(main);
function lock(active: boolean) {
  main.classList.toggle('active', active); attemptSummary.hidden = !active;
  picker.disabled = tempo.disabled = metronome.disabled = start.disabled = retry.disabled = active;
  stop.disabled = !active; pad.disabled = !active; download.disabled = active;
}
function tick(time: number) {
  if (!transport) return;
  const phase = transport.capture.phase(time);
  const next = phase === 'count-in' ? 'Count-in — release before the start' : time >= transport.capture.plan.duration ? 'Performing — capturing final release' : 'Performing';
  if (status.textContent !== next) status.textContent = next;
  const pulses = transport.capture.plan.pulses;
  const latest = [...pulses].reverse().find(p => p.time <= time);
  pulse.classList.toggle('lit', !!latest && time - latest.time < Math.min(.12, transport.capture.plan.pulseSeconds / 3));
}
async function begin() {
  if (transport || starting) return;
  if (!tempo.reportValidity()) return;
  // Snapshot before awaiting audio activation, even though controls are locked.
  const capture = new Capture(exercise, tempo.valueAsNumber, metronome.checked);
  attemptSummary.textContent = `${capture.exercise.label} · ${capture.bpm} quarter-note BPM · ${capture.metronome ? 'metronome on' : 'metronome off'}`;
  starting = true; startCancelled = false; lock(true); status.textContent = 'Ready — activating audio';
  try {
    audio ??= new AudioContext(); await audio.resume();
    if (startCancelled || document.hidden || !document.hasFocus()) {
      finish(capture.interrupt('Start cancelled or focus lost', -capture.plan.countIn)); return;
    }
    if (audio.state !== 'running') throw new Error('Audio could not start');
    result = null; review.replaceChildren(); retry.hidden = true; download.hidden = true;
    score.replaceWith(score = notation(exercise.measures));
    transport = new Transport(audio, capture, tick, finish); pad.focus(); tick(transport.time());
  } catch {
    finish(capture.interrupt('Audio could not start. Check browser audio permissions and retry.', -capture.plan.countIn));
  } finally { starting = false; }
}
function offset(value: number | null) { return value === null ? 'no release observed' : Math.abs(value) < .0005 ? 'on time (0 ms)' : `${Math.round(Math.abs(value) * 1000)} ms ${value < 0 ? 'early' : 'late'}`; }
function finish(record: AttemptRecord) {
  result = record; transport = null; pointer = null; lock(false); pulse.classList.remove('lit'); pad.setAttribute('aria-pressed', 'false');
  retry.hidden = false; download.hidden = false;
  const evaluation = evaluateAttempt(record);
  review.replaceChildren(el('h2', '', record.status === 'completed' ? 'Completed attempt' : 'Interrupted attempt'));
  if (evaluation.status === 'interrupted') {
    status.textContent = 'Interrupted'; review.append(el('p', '', `${record.reason}. Timing evidence retained; this attempt is not graded.`)); return;
  }
  status.textContent = 'Reviewing';
  review.append(el('p', '', `${evaluation.matches.length} matched attacks · ${evaluation.missing.length} missing · ${evaluation.extra.length} extra. Review onset, release, and rest evidence below.`));
  const list = el('ol');
  record.plan.notes.forEach((note, i) => {
    const match = evaluation.matches.find(m => m.expected === i);
    const refs = note.sources.map(s => `measure ${s.measure + 1}, note ${s.event + 1}`).join(' → ');
    const text = `${refs}${note.sources.length > 1 ? ' (tied chain)' : ''}: ${match ? `attack ${offset(match.onsetOffset)}; release ${offset(match.releaseOffset)}` : 'missing attack'}.`;
    const item = el('li', '', text); item.id = `feedback-note-${i}`; list.append(item);
    note.sources.forEach(s => {
      const glyph = document.getElementById(`written-${s.measure}-${s.event}`)!;
      glyph.setAttribute('aria-describedby', item.id); glyph.setAttribute('data-feedback', match ? 'matched' : 'missing');
      glyph.querySelector('title')!.textContent = text;
    });
  });
  record.plan.rests.forEach((rest, i) => {
    const overlaps = evaluation.restOverlaps.filter(o => o.rest === i);
    const text = `Measure ${rest.source.measure + 1}, rest ${rest.source.event + 1}: ${overlaps.length ? overlaps.map(o => `${Math.round((o.end - o.start) * 1000)} ms of input overlap`).join('; ') : 'silent'}.`;
    const item = el('li', '', text); item.id = `feedback-rest-${i}`; list.append(item);
    const glyph = document.getElementById(`written-${rest.source.measure}-${rest.source.event}`)!;
    glyph.setAttribute('aria-describedby', item.id); glyph.setAttribute('data-feedback', overlaps.length ? 'overlap' : 'silent'); glyph.querySelector('title')!.textContent = text;
  });
  evaluation.extra.forEach(i => list.append(el('li', '', `Extra attack at ${evaluation.holds[i]!.down.toFixed(3)} s after exercise start.`)));
  review.append(list);
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
