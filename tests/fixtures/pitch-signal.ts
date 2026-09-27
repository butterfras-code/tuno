/** Deterministic mixtures; amplitudes are peak values, not RMS or measured room SNR. */
export function pitchSignal({
  frequency = 440,
  sampleRate = 48000,
  amplitude = 0.2,
  noise = 0,
  hum = 0,
  phase = 0,
  harmonics = [1],
  seed = 7,
}: {
  frequency?: number;
  sampleRate?: number;
  amplitude?: number;
  noise?: number;
  hum?: number;
  phase?: number;
  harmonics?: number[];
  seed?: number;
} = {}): Float32Array {
  return Float32Array.from({ length: 4096 }, (_, i) => {
    seed = (seed * 16807) % 2147483647;
    const angle = (2 * Math.PI * frequency * i) / sampleRate + phase;
    return (
      amplitude *
        harmonics.reduce(
          (sum, gain, h) => sum + gain * Math.sin(angle * (h + 1)),
          0,
        ) +
      noise * ((2 * seed) / 2147483647 - 1) +
      hum * Math.sin((2 * Math.PI * 100 * i) / sampleRate)
    );
  });
}

/** Continuous phase/envelope fixtures, sliced like trailing analyser windows. */
export function pitchSequence(kind: 'attack' | 'step' | 'vibrato' | 'decay', sampleRate = 48000) {
  const data = new Float32Array(sampleRate * 2);
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const frequency = kind === 'step' && t >= 0.7 ? 659.255 :
      kind === 'vibrato' ? 440 * 2 ** (20 * Math.sin(2 * Math.PI * 5 * t) / 1200) : 440;
    phase += 2 * Math.PI * frequency / sampleRate;
    const amplitude = t < 0.14 || t >= 1.54 ? 0 : kind === 'attack' ? 0.2 * Math.min(1, (t - 0.14) / 0.1) :
      kind === 'decay' ? 0.2 * Math.exp(-(t - 0.14) * 3) : 0.2;
    data[i] = amplitude * (0.5 * Math.sin(phase) + Math.sin(phase * 2) + 0.4 * Math.sin(phase * 3));
  }
  return Array.from({ length: 28 }, (_, i) => {
    const time = (i + 1) * 70;
    const end = Math.round(time * sampleRate / 1000);
    const signal = new Float32Array(4096);
    const start = Math.max(0, end - signal.length);
    signal.set(data.subarray(start, end), Math.max(0, signal.length - end));
    return { time, signal };
  });
}
