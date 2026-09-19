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
