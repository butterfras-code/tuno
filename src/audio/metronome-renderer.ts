import { createTimeline } from '../music/rhythm.ts';
import type { Pulse, Rhythm } from '../music/rhythm.ts';
import type { ClickSound } from '../music/click-sounds.ts';

export type MetronomeSettings = Rhythm & Readonly<{ clickSound: ClickSound; beatAccents: readonly boolean[] }>;
export type ClickSamples = Record<ClickSound, Readonly<{ accent: Float32Array; beat: Float32Array; part: Float32Array }>>;
export type VisualPulse = Pulse & Readonly<{ duration: number; index: number; accented: boolean }>;

/** The audio thread owns time. UI messages only change future settings or read a bounded history. */
export class MetronomeRenderer {
  private timeline: ReturnType<typeof createTimeline>;
  private voices: { data: Float32Array; offset: number }[] = [];
  private history: VisualPulse[] = [];
  private beatIndex = -1;
  private beatDuration = 0;
  private rate: number;
  private samples: ClickSamples;
  settings: MetronomeSettings;

  constructor(rate: number, start: number, samples: ClickSamples, settings: MetronomeSettings) {
    this.rate = rate;
    this.samples = samples;
    this.settings = settings;
    this.timeline = createTimeline(start);
  }

  render(output: Float32Array, start: number) {
    // A discontinuous audio clock must never turn missed beats into a burst.
    // Throwing in process reports processorerror to the controller for an explicit restart.
    if (this.timeline.time < start - 1 / this.rate) throw Error('Metronome audio timeline was interrupted.');
    for (let frame = 0; frame < output.length; frame++) {
      const now = start + frame / this.rate;
      if (this.timeline.time <= now + 0.5 / this.rate) {
        const pulse = this.timeline.next(this.settings);
        const accented = this.settings.beats > 0 && pulse.part === 0 && !!this.settings.beatAccents[pulse.beat];
        const bank = this.samples[this.settings.clickSound];
        this.voices.push({ data: accented ? bank.accent : pulse.part === 0 ? bank.beat : bank.part, offset: 0 });
        if (pulse.part === 0) { this.beatIndex++; this.beatDuration = 60 / this.settings.tempo; }
        this.history.push({ ...pulse, index: this.beatIndex, duration: this.beatDuration, accented });
        // Even with the main thread frozen, memory use stays constant.
        if (this.history.length > 64) this.history.shift();
      }
      let value = 0;
      for (let index = this.voices.length - 1; index >= 0; index--) {
        const voice = this.voices[index]!;
        value += voice.data[voice.offset++] ?? 0;
        if (voice.offset >= voice.data.length) this.voices.splice(index, 1);
      }
      output[frame] = value;
    }
  }

  snapshot() { return this.history.slice(); }
}
