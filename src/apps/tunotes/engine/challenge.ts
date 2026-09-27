import { Practice } from './practice.ts';
import type { PromptToken } from './practice.ts';
import type { AnswerSpelling } from '../domain/notation.ts';
import type { Preset } from '../domain/presets.ts';

export type ChallengeRules = Readonly<{ goal: 'timed'; seconds: number; scoring: 'adjusted' | 'correct' } | { goal: 'target'; target: number; timeout: number; accuracyFloor: number }>;
export type ChallengeEnd = 'completed' | 'timeout' | 'partial';
export const defaultTimed = Object.freeze({ goal: 'timed', seconds: 60, scoring: 'adjusted' } satisfies ChallengeRules);
export const defaultTarget = Object.freeze({ goal: 'target', target: 10, timeout: 120, accuracyFloor: 80 } satisfies ChallengeRules);
export function validateRules(value: unknown): ChallengeRules {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Challenge rules.');
  const r = value as Record<string, unknown>;
  const integer = (v: unknown, min: number, max: number) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new Error(`Enter a whole number from ${min} to ${max}.`);
    return v;
  };
  if (r.goal === 'timed' && Object.keys(r).every(k => ['goal','seconds','scoring'].includes(k)) && (r.scoring === 'adjusted' || r.scoring === 'correct')) return Object.freeze({ goal: 'timed', seconds: integer(r.seconds,15,300), scoring: r.scoring });
  if (r.goal === 'target' && Object.keys(r).every(k => ['goal','target','timeout','accuracyFloor'].includes(k))) return Object.freeze({ goal: 'target', target: integer(r.target,1,100), timeout: integer(r.timeout,15,600), accuracyFloor: integer(r.accuracyFloor,50,100) });
  throw new Error('Invalid Challenge rules.');
}
export function challengeScore(correct: number, attempts: number) { return attempts ? correct * correct / attempts : 0; }
export function qualifies(rules: ChallengeRules, end: ChallengeEnd, correct: number, attempts: number, interrupted: boolean) {
  return end === 'completed' && attempts > 0 && !interrupted && (rules.goal === 'timed' || correct === rules.target && correct * 100 >= rules.accuracyFloor * attempts);
}
export function describeRules(rules: ChallengeRules) {
  return rules.goal === 'timed' ? `${rules.seconds} seconds · ${rules.scoring === 'adjusted' ? 'Correct Notes × Accuracy' : 'Correct Notes'}` : `${rules.target} correct · ${rules.timeout} second timeout · ${rules.accuracyFloor}% accuracy to qualify`;
}
/** Practice owns answers and feedback; this clock also excludes Ready and count-in. */
export class Challenge extends Practice {
  readonly rules: ChallengeRules;
  phase: 'ready' | 'countdown' | 'playing' = 'ready';
  end: ChallengeEnd | undefined;
  private readonly now: () => number;
  private readonly timeline: { origin?: number };
  private countInEnd = 0;
  private countInRemaining = 3000;
  constructor(preset: Preset, rules: ChallengeRules, clock = () => performance.now(), random = Math.random, options: ConstructorParameters<typeof Practice>[4] = {}) {
    const frozen = validateRules(rules), timeline: { origin?: number } = {};
    super(preset, false, () => timeline.origin === undefined ? 0 : clock() - timeline.origin, random, { ...options, continueAfter: 'delay', activity: 'challenge' });
    this.rules = frozen; this.now = clock; this.timeline = timeline;
  }
  get limitMs() { return (this.rules.goal === 'timed' ? this.rules.seconds : this.rules.timeout) * 1000; }
  override get activeMs() { return Math.min(this.limitMs, super.activeMs); }
  get remainingMs() { return Math.max(0, this.limitMs - this.activeMs); }
  get countdown() { return Math.max(1, Math.ceil((this.state === 'paused' ? this.countInRemaining : this.countInEnd - this.now()) / 1000)); }
  get qualified() { return qualifies(this.rules, this.end ?? 'partial', this.correct, this.attempts, this.interrupted); }
  get score() { return this.rules.goal === 'timed' && this.rules.scoring === 'correct' ? this.correct : challengeScore(this.correct, this.attempts); }
  ready() {
    if (this.phase !== 'ready' || this.state !== 'running') return;
    this.phase = 'countdown'; this.countInEnd = this.now() + 3000;
  }
  tick() {
    if (this.state === 'finished' || this.state === 'paused') return;
    if (this.phase === 'countdown' && this.now() >= this.countInEnd) { this.timeline.origin = this.countInEnd; this.phase = 'playing'; }
    if (this.phase === 'playing' && this.activeMs >= this.limitMs) this.complete(this.rules.goal === 'timed' ? 'completed' : 'timeout');
  }
  private complete(end: ChallengeEnd) { this.end = end; super.finish(); }
  override answer(token: PromptToken, answer: AnswerSpelling) {
    this.tick();
    if (this.phase !== 'playing' || !super.answer(token, answer)) return false;
    if (this.rules.goal === 'target' && this.correct === this.rules.target) this.complete('completed');
    return true;
  }
  override advance(token: PromptToken, explicit = false) { this.tick(); return this.phase === 'playing' && super.advance(token, explicit); }
  override pause() {
    this.tick();
    if (this.state === 'finished' || this.state === 'paused') return;
    if (this.phase === 'countdown') this.countInRemaining = Math.max(0, this.countInEnd - this.now());
    super.pause();
  }
  override resume() {
    if (this.state !== 'paused') return;
    if (this.phase === 'countdown') this.countInEnd = this.now() + this.countInRemaining;
    super.resume();
  }
  override finish() { this.tick(); if (this.state !== 'finished') this.complete('partial'); }
}
