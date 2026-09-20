import type { Pulse } from '../music/rhythm.ts';
import type { ClickSound } from '../music/click-sounds.ts';
export type ClickSettings = Readonly<{ accent: boolean; clickVolume: number; clickSound: ClickSound }>;

/** Short synthesized sounds keep both distributions independent of sound files. */
export function scheduleClick(context: BaseAudioContext, pulse: Pulse, settings: ClickSettings) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const accented = pulse.downbeat && settings.accent;
  const beep = settings.clickSound === 'beep';
  const drum = settings.clickSound === 'drum';
  const subdivisionPitch = pulse.part > 0 ? 2 : 1;
  const duration = drum ? 0.06 : 0.04;
  oscillator.type = beep ? 'square' : drum || settings.clickSound === 'wood' ? 'triangle' : 'sine';
  if (drum) {
    // A fast pitch drop gives a tight tom attack; triangle overtones add definition.
    oscillator.frequency.setValueAtTime((accented ? 720 : 480) * subdivisionPitch, pulse.time);
    oscillator.frequency.exponentialRampToValueAtTime((accented ? 240 : 160) * subdivisionPitch, pulse.time + 0.025);
  } else {
    oscillator.frequency.value = (beep ? (accented ? 2080 : 1560) : accented ? 1500 : 1000) * subdivisionPitch;
  }
  // Square waves carry more energy, so reduce their gain to balance the choices.
  const level = settings.clickVolume / 100 * (accented ? 0.3 : pulse.part === 0 ? 0.2 : 0.1) * (beep ? 0.65 : 1);
  gain.gain.setValueAtTime(0, pulse.time);
  gain.gain.linearRampToValueAtTime(level, pulse.time + (beep ? 0.001 : 0.002));
  if (level > 0) gain.gain.exponentialRampToValueAtTime(0.00001, pulse.time + duration - 0.005);
  gain.gain.setValueAtTime(0, pulse.time + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  const cleanup = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.onended = cleanup;
  oscillator.start(pulse.time);
  oscillator.stop(pulse.time + duration);
  return { oscillator, stop() {
    oscillator.onended = null;
    oscillator.stop();
    cleanup();
  } };
}
