import { scheduleClick } from '../../audio/click.ts';
import { inputAudioTime } from './timing.ts';
import { Capture } from './capture.ts';
import type { AttemptRecord } from './capture.ts';
/** Schedules the entire bounded fixture on the audio clock. UI polling never schedules music. */
export class Transport {
  readonly capture: Capture;
  readonly context: AudioContext;
  readonly exerciseStart: number;
  readonly anchor: { performanceMs: number; audioSeconds: number };
  private clicks: ReturnType<typeof scheduleClick>[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private stateChanged: () => void;
  constructor(context: AudioContext, capture: Capture, onTick: (time: number) => void, onEnd: (record: AttemptRecord) => void) {
    this.context = context; this.capture = capture;
    this.anchor = { performanceMs: performance.now(), audioSeconds: context.currentTime };
    this.exerciseStart = context.currentTime + capture.policy.leadIn + capture.plan.countIn;
    capture.setClockEvidence({ ...this.anchor, exerciseStart: this.exerciseStart, sampleRate: context.sampleRate, baseLatency: context.baseLatency, outputLatency: context.outputLatency });
    capture.plan.pulses.forEach(p => {
      if (p.countIn || capture.metronome) this.clicks.push(scheduleClick(context, { time: this.exerciseStart + p.time, downbeat: p.downbeat, part: 0, beat: 0 }, { accent: true, clickVolume: 55, clickSound: 'wood' }));
    });
    const finish = (record: AttemptRecord) => { this.dispose(); onEnd(record); };
    this.finish = finish;
    this.stateChanged = () => { if (context.state !== 'running') this.interrupt('Audio clock interrupted'); };
    context.addEventListener('statechange', this.stateChanged);
    this.timer = setInterval(() => {
      const time = this.time();
      if (context.state !== 'running') { finish(capture.interrupt('Audio clock interrupted', time)); return; }
      const result = capture.advance(time);
      if (result) finish(result); else onTick(time);
    }, 20);
  }
  private finish: (record: AttemptRecord) => void;
  time() { return this.context.currentTime - this.exerciseStart; }
  input(action: 'down' | 'up', source: string, timestampMs: number, repeat = false) {
    if (this.disposed) return;
    // Legacy epoch DOM timestamps are normalized to performance.timeOrigin.
    const monotonic = timestampMs > 1e12 ? timestampMs - performance.timeOrigin : timestampMs;
    this.capture.input(action, source, inputAudioTime(monotonic, this.anchor) - this.exerciseStart, timestampMs, repeat);
  }
  interrupt(reason: string) { if (!this.disposed) this.finish(this.capture.interrupt(reason, this.time())); }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    this.context.removeEventListener('statechange', this.stateChanged);
    this.clicks.forEach(c => c.stop()); this.clicks = [];
  }
}
