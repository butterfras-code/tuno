import type { ToneSound } from '../music/tone-sounds.ts';

export function setToneSound(context: BaseAudioContext, oscillator: OscillatorNode, sound: ToneSound) {
  if (sound === 'rich') {
    if (oscillator.type === 'custom') return;
    // Keep a strong fundamental with a few audible upper partials for low notes.
    oscillator.setPeriodicWave(context.createPeriodicWave(
      new Float32Array(5), new Float32Array([0, 1, 0.5, 0.25, 0.125]),
    ));
  } else if (oscillator.type !== sound) oscillator.type = sound;
}

/** Shared by the live controller and offline audio-render regression checks. */
export function createReferenceTone(context: BaseAudioContext, frequency: number, sound: ToneSound = 'sine') {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0;
  oscillator.frequency.value = frequency;
  setToneSound(context, oscillator, sound);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  return { oscillator, gain };
}
