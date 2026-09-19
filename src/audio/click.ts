import type { Pulse } from '../music/rhythm.ts';
export type ClickSettings = Readonly<{ accent: boolean; clickVolume: number; clickSound: 'click' | 'wood' }>;

/** Short synthesized sounds keep both distributions independent of sound files. */
export function scheduleClick(context: BaseAudioContext, pulse: Pulse, settings: ClickSettings) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const accented = pulse.downbeat && settings.accent;
  oscillator.type = settings.clickSound === 'wood' ? 'triangle' : 'sine';
  oscillator.frequency.value = accented ? 1500 : pulse.part === 0 ? 1000 : 750;
  const level = settings.clickVolume / 100 * (accented ? 0.3 : pulse.part === 0 ? 0.2 : 0.1);
  gain.gain.setValueAtTime(0, pulse.time);
  gain.gain.linearRampToValueAtTime(level, pulse.time + 0.002);
  if (level > 0) gain.gain.exponentialRampToValueAtTime(0.00001, pulse.time + 0.035);
  else gain.gain.setValueAtTime(0, pulse.time + 0.035);
  oscillator.connect(gain);
  gain.connect(context.destination);
  const cleanup = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.onended = cleanup;
  oscillator.start(pulse.time);
  oscillator.stop(pulse.time + 0.04);
  return { oscillator, stop() {
    oscillator.onended = null;
    oscillator.stop();
    cleanup();
  } };
}
