import { identifyPitch } from '../../../music/pitch.ts';

/** Concert-to-written offsets include the instrument's octave displacement. */
export const microphoneTranspositions = [
  { offset: 0, label: 'C — Concert pitch' },
  { offset: 2, label: 'B♭ — Trumpet, Clarinet, Soprano Sax' },
  { offset: 7, label: 'F — Horn' },
  { offset: 9, label: 'E♭ — Alto Sax' },
  { offset: 14, label: 'B♭ — Bass Clarinet, Tenor Sax, Euphonium TC' },
  { offset: 21, label: 'E♭ — Baritone Sax' },
] as const;
export const MIC_HOLD_MS = 300;
export const MIC_TOLERANCE_CENTS = 40;

/** Raw evidence only: smoothing must never bridge a missing or out-of-tune frame. */
export class MicrophoneHold {
  private note: number | undefined;
  private since = 0;
  private last = -Infinity;
  private submitted: number | undefined;
  reset() { this.note = undefined; this.last = -Infinity; }
  clear() { this.reset(); this.submitted = undefined; }
  update(now: number, frequency: number | null, offset: number, enabled = true) {
    const reading = frequency !== null && Number.isFinite(frequency) && frequency > 0 ? identifyPitch(frequency, 440, offset) : null;
    if (!reading || reading.writtenNote !== this.submitted) this.submitted = undefined;
    // Allow floating-point roundoff at the inclusive cents boundary.
    if (!enabled || !reading || Math.abs(reading.cents) > MIC_TOLERANCE_CENTS + 1e-8) {
      this.reset(); return { reading, progress: 0, answer: undefined };
    }
    if (this.note !== reading.writtenNote || now - this.last > 200 || now < this.last) {
      this.note = reading.writtenNote; this.since = now;
    }
    this.last = now;
    const progress = Math.min(1, (now - this.since) / MIC_HOLD_MS);
    const answer = progress === 1 && this.submitted !== this.note ? this.note : undefined;
    if (answer !== undefined) this.submitted = answer;
    return { reading, progress, answer };
  }
}
