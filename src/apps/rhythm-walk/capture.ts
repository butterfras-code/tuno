import { createScore } from '../../music/score.ts';
import { assessmentPolicy, holdPolicy } from './assessment-policy.ts';
import type { AssessmentPolicy, HoldPolicy } from './assessment-policy.ts';
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
  readonly assessmentPolicy?: AssessmentPolicy;
  readonly holdPolicy?: HoldPolicy;
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
  readonly assessmentPolicy: AssessmentPolicy;
  constructor(exercise: Exercise, bpm: number, metronome: boolean, policy = prototypeTiming, timingOffset?: TimingOffset, playStyle: PlayStyle = 'tap', evaluationPolicy: EvaluationPolicy = provisionalEvaluation, scoringPolicy: AssessmentPolicy = assessmentPolicy) {
    this.assessmentPolicy = { ...scoringPolicy };
    this.playStyle = playStyle; this.evaluationPolicy = { ...evaluationPolicy };
    this.exercise = { ...exercise, score: createScore(exercise.score) }; this.policy = { ...policy };
    this.timingOffset = timingOffset ? { ...timingOffset } : undefined;
    this.bpm = bpm; this.metronome = metronome;
    this.plan = planPassage(this.exercise.score.measures, bpm, this.policy, sourcePolicy(this.exercise.score.measures[0]!).pulse);
    // Finish at the written ending plus a short release/calibration allowance.
    // Analytical tempo fitting must never extend the recording deadline.
    this.plan.captureEnd = this.plan.duration + this.policy.releaseGrace + Math.max(0, timingOffset?.seconds ?? 0);
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
    this.result = structuredClone({ version: 1 as const, assessmentPolicy: this.assessmentPolicy, ...(this.assessmentPolicy.version === 2 ? { holdPolicy: { ...holdPolicy } } : {}), playStyle: this.playStyle, evaluationPolicy: this.evaluationPolicy, ...(this.timingOffset ? { timingOffset: this.timingOffset } : {}), ...(this.clock ? { clock: this.clock } : {}), exercise: this.exercise, policy: this.policy, plan: this.plan, bpm: this.bpm, metronome: this.metronome, events: this.events, status, endedAt, ...(reason ? { reason } : {}) });
  }
}
