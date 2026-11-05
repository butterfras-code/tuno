import { MetronomeRenderer } from './metronome-renderer.ts';
import type { ClickSamples, MetronomeSettings } from './metronome-renderer.ts';

// AudioWorklet globals are separate from the DOM library's main-thread types.
declare const sampleRate: number;
declare const currentTime: number;
declare class AudioWorkletProcessor { readonly port: MessagePort; }
type ProcessorOptions = { processorOptions: { samples: ClickSamples; settings: MetronomeSettings } };
declare function registerProcessor(name: string, processor: new (options: ProcessorOptions) => AudioWorkletProcessor): void;

class MetronomeProcessor extends AudioWorkletProcessor {
  private renderer: MetronomeRenderer;
  private active = true;
  constructor(options: ProcessorOptions) {
    super();
    this.renderer = new MetronomeRenderer(sampleRate, currentTime + 0.05, options.processorOptions.samples, options.processorOptions.settings);
    this.port.onmessage = ({ data }) => {
      if (data.type === 'stop') { this.active = false; this.port.close(); }
      if (data.type === 'settings') this.renderer.settings = data.settings;
      // Pull only while visible: no stream of queued UI messages while backgrounded.
      if (data.type === 'position') this.port.postMessage(this.renderer.snapshot());
    };
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    if (!this.active) return false;
    const output = outputs[0]?.[0];
    if (output) this.renderer.render(output, currentTime);
    return true;
  }
}
registerProcessor('tuno-metronome', MetronomeProcessor);
