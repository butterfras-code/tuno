/** Adapted from pitch-tracker 75214e7 src/domain/pitch.ts; see docs/dependencies.md. */
export type PitchEvidence = Readonly<{ frequency: number | null; rms: number; quality: number }>;
export function detectPitch(
  buf: Float32Array,
  sr: number,
  gate: number,
): PitchEvidence {
  if (buf.length < 32 || !Number.isFinite(sr) || sr < 4000) return { frequency: null, rms: 0, quality: 0 };
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i]! * buf[i]!;
  rms = Math.sqrt(rms / buf.length);
  if (!Number.isFinite(rms) || rms < gate) return { frequency: null, rms, quality: 0 };
  // A target-independent low-pass reduces broadband energy before YIN. Keep
  // the original RMS gate: filtering must not turn up quiet sounds. Discard
  // filter startup so it cannot look like a low-frequency note.
  const filtered = lowPass(buf, sr);
  const samples = filtered.subarray(Math.floor(sr * 0.003));
  const min = Math.max(1, Math.floor(sr / 1760) - 1),
    max = Math.min(Math.ceil(sr / 55) + 2, Math.floor(samples.length / 2) - 1),
    count = samples.length - max - 1,
    diff = new Float32Array(max + 1);
  let total = 0;
  for (let t = 1; t <= max; t++) {
    let sum = 0;
    for (let j = 0; j < count; j++) {
      const delta = samples[j]! - samples[j + t]!;
      sum += delta * delta;
    }
    total += sum;
    diff[t] = total ? (sum * t) / total : 1;
  }
  // A loud overtone can already satisfy the absolute YIN threshold. Compare
  // all period candidates before choosing the shortest comparably good one;
  // the true fundamental explains the weaker harmonics as well.
  let best = 1;
  for (let t = min + 1; t < max; t++) best = Math.min(best, diff[t]!);
  const threshold = Math.min(0.18, best + 0.02);
  let tau = -1;
  for (let t = min + 1; t < max; t++) {
    if (
      diff[t]! < threshold &&
      diff[t]! < diff[t - 1]! &&
      diff[t]! <= diff[t + 1]!
    ) {
      tau = t;
      break;
    }
  }
  if (tau < 0) return { frequency: null, rms, quality: 0 };
  const left = diff[tau - 1]!,
    mid = diff[tau]!,
    right = diff[tau + 1]!,
    den = left - 2 * mid + right,
    offset = den ? (left - right) / (2 * den) : 0,
    f = sr / (tau + offset);
  return { frequency: Number.isFinite(f) && f >= 54.99 && f <= 1766 ? f : null, rms, quality: 1 - mid };
}

/** Two-pole Butterworth, 2 kHz cutoff; no target note or retained device state. */
function lowPass(buf: Float32Array, sr: number): Float32Array {
  const w = (2 * Math.PI * Math.min(2000, sr * 0.4)) / sr,
    cos = Math.cos(w),
    alpha = Math.sin(w) / Math.SQRT2,
    a0 = 1 + alpha,
    b0 = (1 - cos) / (2 * a0),
    b1 = 2 * b0,
    a1 = (-2 * cos) / a0,
    a2 = (1 - alpha) / a0,
    out = new Float32Array(buf.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i]!,
      y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

