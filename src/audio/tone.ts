/** Shared by the live controller and offline audio-render regression checks. */
export function createReferenceTone(context: BaseAudioContext, frequency: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  return { oscillator, gain };
}
