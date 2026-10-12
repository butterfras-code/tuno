import { sourcePolicy } from './shared/meter.ts';
import type { TimingOffset } from './offset.ts';
import { planPassage, prototypeTiming } from './timing.ts';
import type { Plan, TimingPolicy } from './timing.ts';
import type { Exercise } from './fixtures.ts';
import { provisionalEvaluation } from './play-policy.ts';
import type { PlayStyle, EvaluationPolicy } from './play-policy.ts';
export type Phase = 'ready' | 'count-in' | 'performing' | 'reviewing' | 'interrupted';
export interface InputEvent {
  readonly action: 'down' | 'up'; readonly source: string; readonly timestampMs: number;
  readonly time: number; readonly region: 'count-in' | 'exercise' | 'tail' | 'outside';
  readonly accepted: boolean; readonly reason?: string;
}
export interface ClockEvidence {
  readonly performanceMs: number; readonly audioSeconds: number; readonly exerciseStart: number;
  readonly sampleRate: number; readonly baseLatency: number; readonly outputLatency?: number;
}
export interface AttemptRecord {
  readonly playStyle?: PlayStyle;
  readonly evaluationPolicy?: EvaluationPolicy;
  readonly timingOffset?: TimingOffset;
  readonly version: 1; readonly clock?: ClockEvidence;
  readonly exercise: Exercise; readonly bpm: number; readonly metronome: boolean; readonly policy: TimingPolicy;
  readonly plan: Plan; readonly events: readonly InputEvent[]; readonly status: 'completed' | 'interrupted';
  readonly reason?: string; readonly endedAt: number;
}
/** Pure capture state machine. All times are seconds relative to exercise start. */
export class Capture {
  readonly exercise: Exercise; readonly policy: TimingPolicy; readonly plan: Plan;
  readonly bpm: number; readonly metronome: boolean;
  readonly timingOffset?: TimingOffset;
  private events: InputEvent[] = [];
  private clock: ClockEvidence | undefined;
  private owner: string | null = null;
  private result: AttemptRecord | null = null;
  readonly playStyle: PlayStyle;
  readonly evaluationPolicy: EvaluationPolicy;
  constructor(exercise: Exercise, bpm: number, metronome: boolean, policy = prototypeTiming, timingOffset?: TimingOffset, playStyle: PlayStyle = 'tap', evaluationPolicy: EvaluationPolicy = provisionalEvaluation) {
    this.playStyle = playStyle; this.evaluationPolicy = { ...evaluationPolicy };
    this.exercise = structuredClone(exercise); this.policy = { ...policy };
    this.timingOffset = timingOffset ? { ...timingOffset } : undefined;
    this.bpm = bpm; this.metronome = metronome;
    this.plan = planPassage(this.exercise.measures, bpm, this.policy, sourcePolicy(this.exercise.measures[0]!).pulse);
    this.plan.captureEnd += Math.max(0, timingOffset?.seconds ?? 0);
  }
  setClockEvidence(clock: ClockEvidence) { this.clock = { ...clock }; }
  get heldBy() { return this.owner; }
  phase(time: number): Phase { return this.result ? this.result.status === 'completed' ? 'reviewing' : 'interrupted' : time < 0 ? 'count-in' : 'performing'; }
  advance(time: number): AttemptRecord | null {
    if (!this.result && time >= this.plan.captureEnd) this.end('completed', this.plan.captureEnd);
    return this.result;
  }
  input(action: 'down' | 'up', source: string, time: number, timestampMs: number, repeat = false): void {
    this.advance(time);
    const region = time < -this.plan.countIn || this.result ? 'outside' : time < 0 ? 'count-in' : time < this.plan.duration ? 'exercise' : 'tail';
    const reason = region === 'outside' ? 'outside capture' : repeat ? 'keyboard repeat' : action === 'down' && this.owner !== null ? 'already held' : action === 'up' && this.owner !== source ? 'not owner' : undefined;
    this.events.push({ action, source, time, timestampMs, region, accepted: !reason, ...(reason ? { reason } : {}) });
    if (!reason) this.owner = action === 'down' ? source : null;
  }
  interrupt(reason: string, time: number): AttemptRecord {
    // A completed capture remains completed even if focus is lost during review.
    if (!this.result) this.end('interrupted', time, reason);
    return this.result!;
  }
  private end(status: AttemptRecord['status'], endedAt: number, reason?: string) {
    this.result = structuredClone({ version: 1 as const, playStyle: this.playStyle, evaluationPolicy: this.evaluationPolicy, ...(this.timingOffset ? { timingOffset: this.timingOffset } : {}), ...(this.clock ? { clock: this.clock } : {}), exercise: this.exercise, policy: this.policy, plan: this.plan, bpm: this.bpm, metronome: this.metronome, events: this.events, status, endedAt, ...(reason ? { reason } : {}) });
  }
}
