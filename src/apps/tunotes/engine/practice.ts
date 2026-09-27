import { pitchLabel, sameAnswer } from '../domain/notation.ts';
import type { AnswerSpelling, WrittenPitch } from '../domain/notation.ts';
import type { Preset } from '../domain/presets.ts';
export class ShuffledBag {
  private bag: WrittenPitch[] = [];
  private previous = '';
  private readonly pool: readonly WrittenPitch[];
  private readonly random: () => number;
  constructor(pool: readonly WrittenPitch[], random: () => number = Math.random) {
    if (!pool.length || new Set(pool.map(pitchLabel)).size !== pool.length) throw new Error('Bag requires a nonempty, unique pool.');
    this.pool = [...pool]; this.random = random;
  }
  next() {
    if (!this.bag.length) {
      this.bag = [...this.pool];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const sample = this.random();
        if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('Random sample must be in [0, 1).');
        const j = Math.floor(sample * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j]!, this.bag[i]!];
      }
      const last = this.bag.length - 1;
      if (last > 0 && pitchLabel(this.bag[last]!) === this.previous) [this.bag[0], this.bag[last]] = [this.bag[last]!, this.bag[0]!];
    }
    const pitch = this.bag.pop()!; this.previous = pitchLabel(pitch); return pitch;
  }
}
export interface PromptToken { readonly session: number; readonly prompt: number }
export interface Observation { readonly pitch: WrittenPitch; readonly answer: AnswerSpelling; readonly correct: boolean; readonly responseMs: number; readonly activity: 'practice'; readonly preset: string }
let nextSession = 0;
export class Practice {
  readonly session = ++nextSession;
  readonly preset: Preset;
  readonly selfPaced: boolean;
  private readonly clock: () => number;
  private readonly bag: ShuffledBag;
  private origin: number;
  private pausedAt = 0;
  private pausedMs = 0;
  private promptStart = 0;
  private feedbackEnd = 0;
  private resumeState: 'running' | 'feedback' = 'running';
  private records: Observation[] = [];
  state: 'running' | 'feedback' | 'paused' | 'finished' = 'running';
  prompt = 1;
  pitch: WrittenPitch;
  correct = 0;
  streak = 0;
  bestStreak = 0;
  interrupted = false;
  private endTime: number | undefined;
  constructor(preset: Preset, selfPaced = false, clock = () => performance.now(), random = Math.random) {
    this.preset = preset; this.selfPaced = selfPaced; this.clock = clock; this.origin = clock();
    this.bag = new ShuffledBag(preset.pool, random); this.pitch = this.bag.next();
  }
  get token(): PromptToken { return { session: this.session, prompt: this.prompt }; }
  get observations(): readonly Observation[] { return this.records; }
  get attempts() { return this.records.length; }
  get accuracy() { return this.attempts ? this.correct / this.attempts : null; }
  get last() { return this.records.at(-1); }
  get activeMs() { return this.endTime ?? (this.state === 'paused' ? this.pausedAt : this.clock()) - this.origin - this.pausedMs; }
  matches(token: PromptToken) { return token.session === this.session && token.prompt === this.prompt; }
  answer(token: PromptToken, answer: AnswerSpelling) {
    if (this.state !== 'running' || !this.matches(token)) return false;
    const now = this.activeMs;
    const correct = sameAnswer(this.pitch, answer);
    this.records.push(Object.freeze({ pitch: this.pitch, answer: Object.freeze({ ...answer }), correct, responseMs: now - this.promptStart, activity: 'practice', preset: this.preset.id }));
    if (correct) { this.correct++; this.streak++; } else this.streak = 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.feedbackEnd = now + (correct ? 250 : 800); this.state = 'feedback'; return true;
  }
  advance(token: PromptToken, explicit = false) {
    if (this.state !== 'feedback' || !this.matches(token) || (this.selfPaced ? !explicit : this.activeMs < this.feedbackEnd)) return false;
    this.pitch = this.bag.next(); this.prompt++; this.promptStart = this.activeMs; this.state = 'running'; return true;
  }
  pause() {
    if (this.state !== 'running' && this.state !== 'feedback') return;
    this.resumeState = this.state; this.pausedAt = this.clock(); this.state = 'paused'; this.interrupted = true;
  }
  resume() {
    if (this.state !== 'paused') return;
    this.pausedMs += this.clock() - this.pausedAt; this.state = this.resumeState;
  }
  finish() { if (this.state !== 'finished') { this.endTime = this.activeMs; this.state = 'finished'; } }
}
/** A physical press is consumed even during feedback; repeats cannot answer the next card. */
export class PressGate {
  private held = new Set<string>();
  down(code: string, repeat = false) { if (repeat || this.held.has(code)) return false; this.held.add(code); return true; }
  up(code: string) { this.held.delete(code); }
  reset() { this.held.clear(); }
}
