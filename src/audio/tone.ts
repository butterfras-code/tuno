import type { ToneSound } from '../music/tone-sounds.ts';

const partials = {
  rich: [0, 1, 0.5, 0.25, 0.125],
  // Rounded reed blend: prominent odd harmonics, softer even harmonics and a gentle rolloff.
  sweet: [0, 1, 0.18, 0.48, 0.10, 0.20, 0.045, 0.08, 0.02, 0.025],
  // Brighter reed/brass blend: a fuller series with more upper-harmonic presence.
  clear: [0, 1, 0.25, 0.37, 0.38, 0.28, 0.19, 0.22, 0.27, 0.035],
} as const;

const oscillatorSounds = new WeakMap<OscillatorNode, ToneSound>();

export function setToneSound(context: BaseAudioContext, oscillator: OscillatorNode, sound: ToneSound) {
  if (oscillatorSounds.get(oscillator) === sound) return;
  if (sound === 'sine' || sound === 'triangle') {
    oscillator.type = sound;
  } else {
    const harmonics = partials[sound];
    // Browser normalization bounds the peak; PeriodicWave also band-limits high notes.
    oscillator.setPeriodicWave(context.createPeriodicWave(
      new Float32Array(harmonics.length), new Float32Array(harmonics),
    ));
  }
  oscillatorSounds.set(oscillator, sound);
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
