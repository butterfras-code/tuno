import { scheduleClick } from './click.ts';
import { CLICK_SOUNDS } from '../music/click-sounds.ts';
import type { ClickSamples, MetronomeSettings } from './metronome-renderer.ts';

/** Render the existing synth once per sound/role, preserving its timbre and envelope. */
async function renderSamples(rate: number): Promise<ClickSamples> {
  const entries = await Promise.all(CLICK_SOUNDS.map(async ({ value: sound }) => {
    const roles = await Promise.all(['accent', 'beat', 'part'].map(async role => {
      const ac = new OfflineAudioContext(1, Math.ceil(rate * 0.061), rate);
      scheduleClick(ac, { time: 0, downbeat: role === 'accent', part: role === 'part' ? 1 : 0, beat: 0 },
        { accent: true, clickVolume: 100, clickSound: sound });
      return [role, (await ac.startRendering()).getChannelData(0)] as const;
    }));
    return [sound, Object.fromEntries(roles)] as const;
  }));
  return Object.fromEntries(entries) as ClickSamples;
}

export async function prepareMetronome(context: AudioContext) {
  if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') {
    throw Error('This browser cannot run the metronome audio engine. Please use a current browser.');
  }
  const [, samples] = await Promise.all([
    context.audioWorklet.addModule('/tune/metronome-worklet.js'), renderSamples(context.sampleRate),
  ]);
  return (settings: MetronomeSettings) => new AudioWorkletNode(context, 'tuno-metronome', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { samples, settings },
  });
}
