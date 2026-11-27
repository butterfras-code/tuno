import { musicalSeconds, quarterPulse } from '../../../music/tempo.ts';
import { pitchedEvent, quarterBeats, validateAuto } from './auto-every.ts';
import type { AutoSettings } from './auto-every.ts';
import { handCode, validFingering, canonicalFingering } from '../../../shared/input/fingering-code.ts';
import { acceptsFingering, acceptsKeyboard, fingeringFor } from '../domain/fingering.ts';
import type { FingeringConfiguration, NoteAnswer } from '../domain/fingering.ts';
import { ALGORITHM_VERSION, activePool, initialAdaptive, learn, observe, selectAdaptive } from './adaptive.ts';
import type { Learning, NoteHistory, AdaptiveState } from './adaptive.ts';
import { chromatic, diatonic, pitchLabel, sameAnswer, spelling } from '../domain/notation.ts';
import type { WrittenPitch } from '../domain/notation.ts';
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
  next(eligible: (pitch: WrittenPitch) => boolean = () => true): WrittenPitch {
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
    let index = this.bag.length - 1;
    while (index >= 0 && !eligible(this.bag[index]!)) index--;
    if (index < 0) {
      // Keep deferred cards in the bag; bridge with a different fingering when
      // only the previous fingering remains in this cycle.
      const alternatives = this.pool.filter(eligible);
      if (alternatives.length) {
        const pitch = new ShuffledBag(alternatives, this.random).next();
        this.previous = pitchLabel(pitch); return pitch;
      }
      index = this.bag.length - 1;
    }
    const [pitch] = this.bag.splice(index, 1); this.previous = pitchLabel(pitch!); return pitch!;
  }
}
export interface PromptToken { readonly session: number; readonly prompt: number }
export interface Observation { readonly pitch: WrittenPitch; readonly answer: NoteAnswer | { readonly kind: 'unanswered' }; readonly correct: boolean; readonly responseMs: number; readonly activity: 'practice' | 'challenge'; readonly preset: string }
let nextSession = 0;
export type ContinueAfter = 'instant' | 'delay' | 'click' | 'correct' | 'auto';
export class Practice {
  readonly session = ++nextSession;
  readonly preset: Preset;
  readonly selfPaced: boolean;
  readonly continueAfter: ContinueAfter;
  readonly adaptive: boolean;
  readonly activity: 'practice' | 'challenge';
  preview: { shown: boolean; skipped: boolean; completed: boolean } = { shown: false, skipped: false, completed: false };
  learning: AdaptiveState;
  announcement = '';
  readonly misses: Record<string,number> = {};
  private readonly random: () => number;
  get activePreset(): Preset { return this.adaptive ? { ...this.preset, pool: activePool(this.preset,this.savedLearning) } : this.preset; }
  get savedLearning(): Learning { return { algorithmVersion: ALGORITHM_VERSION, expansionCount: this.learning.expansionCount }; }
  private readonly inputFingering: () => FingeringConfiguration | undefined;
  private nextPitch() {
    const config = this.inputFingering();
    const previous = this.pitch && config?.pitches[chromatic(this.pitch)]?.[0];
    const eligible = (pitch: WrittenPitch) => {
      const next = config?.pitches[chromatic(pitch)]?.[0];
      return previous === undefined || next === undefined || handCode(next) !== handCode(previous);
    };
    if (!this.adaptive) return this.bag.next(eligible);
    const pool = this.activePreset.pool;
    const alternatives = pool.filter(eligible);
    const next = selectAdaptive(this.learning,alternatives.length ? alternatives : pool,this.random); this.learning = next.state; return next.pitch;
  }
  private readonly clock: () => number;
  private readonly bag: ShuffledBag;
  private origin: number;
  private pausedAt = 0;
  private pausedMs = 0;
  readonly auto?: AutoSettings;
  nextPreview?: WrittenPitch;
  private currentFocusPrompt?: boolean;
  private reservePreview() {
    // Drawing the next adaptive pitch advances selection state. Grade the visible pitch with its own focus flag.
    this.currentFocusPrompt = this.learning.focusPrompt;
    this.nextPreview = this.nextPitch();
  }
  get currentEvent() { return this.auto && pitchedEvent(`s${this.session}-n${this.prompt}`,this.pitch,this.auto.value); }
  get upcomingEvent() { return this.auto?.lookahead && this.nextPreview ? pitchedEvent(`s${this.session}-n${this.prompt+1}`,this.nextPreview,this.auto.value) : undefined; }
  // Keep input acceptance separate from the written event and the metronome.
  private earlyAnswer?: { prompt: number; answer: NoteAnswer };
  private get earlyWindowMs() { return this.pulseMs / 2; }
  get inputStartMs() { return this.promptStart - this.earlyWindowMs; }
  get earlyNext() { return !!this.auto && this.activeMs >= this.deadline - this.earlyWindowMs && this.activeMs < this.deadline; }
  get inputToken(): PromptToken { return this.earlyNext ? {session:this.session,prompt:this.prompt+1} : this.token; }
  get inputPitch() {
    if (!this.earlyNext) return this.pitch;
    if (!this.nextPreview) this.reservePreview();
    return this.nextPreview!;
  }
  get inputOpen() {
    if (!this.auto) return this.state === 'running';
    if (this.state === 'paused' || this.state === 'finished') return false;
    return this.earlyNext || this.state === 'running' && this.activeMs >= this.inputStartMs;
  }
  /** Reserve only a matching early response. An unanswered visible note gets first claim. */
  queueAutoAnswer(token: PromptToken, answer: NoteAnswer) {
    if (!this.auto || !this.inputOpen || token.session !== this.session) return false;
    const first = this.countingIn && token.prompt === this.prompt;
    if (!first && !(this.earlyNext && token.prompt === this.prompt + 1)) return false;
    if (!first && this.state === 'running' && this.accepts(this.pitch,answer)) return false;
    if (!this.accepts(first ? this.pitch : this.inputPitch,answer)) return false;
    this.earlyAnswer ??= {prompt:token.prompt,answer:this.normalizedAnswer(answer)};
    return true;
  }
  private accepts(pitch: WrittenPitch, answer: NoteAnswer) {
    if (!('kind' in answer)) return sameAnswer(pitch,answer);
    if (answer.kind === 'keyboard') return Number.isInteger(answer.note) && answer.note >= 12 && answer.note <= 119 && acceptsKeyboard(pitch,answer);
    const config = fingeringFor(answer.instrument ?? this.preset.instrument,4);
    return !!config && validFingering(answer.code) && acceptsFingering(config,pitch,answer.code);
  }
  private normalizedAnswer(answer: NoteAnswer): NoteAnswer {
    if (!('kind' in answer)) return {letter:answer.letter,accidental:answer.accidental};
    if (answer.kind === 'keyboard') return {...answer,matchOctave:answer.matchOctave ?? false};
    return {...answer,code:canonicalFingering(answer.code)};
  }
  private pendingWrong?: NoteAnswer;
  private promptStart = 0;
  readonly beats: number = 0;
  readonly pulseMs: number = 0;
  get beatIndex() { return Math.floor((this.activeMs - this.promptStart) / this.pulseMs); }
  get countingIn() { return !!this.auto && this.activeMs < this.promptStart; }
  get beat() { return ((this.beatIndex % this.beats) + this.beats) % this.beats; }
  get deadline() { return this.promptStart + this.beats * this.pulseMs; }
  private feedbackEnd = 0;
  private resumeState: 'running' | 'feedback' = 'running';
  private records: Observation[] = [];
  state: 'running' | 'feedback' | 'paused' | 'finished' = 'running';
  prompt = 1;
  pitch: WrittenPitch;
  correct = 0;
  first20Correct = 0;
  responseTotalMs = 0;
  private submissions = 0;
  streak = 0;
  bestStreak = 0;
  interrupted = false;
  private endTime: number | undefined;
  constructor(preset: Preset, selfPaced = false, clock = () => performance.now(), random = Math.random, options: { auto?: AutoSettings; inputFingering?: () => FingeringConfiguration | undefined; activity?: 'practice' | 'challenge'; continueAfter?: ContinueAfter; adaptive?: boolean; notes?: NoteHistory; learning?: Learning } = {}) {
    this.inputFingering = options.inputFingering ?? (() => undefined);
    this.activity = options.activity ?? 'practice'; this.adaptive = options.adaptive ?? false; this.random = random; this.learning = initialAdaptive(options.notes,options.learning);
    this.continueAfter = options.continueAfter ?? (selfPaced ? 'click' : 'delay');
    this.preset = preset; this.selfPaced = this.continueAfter === 'click'; this.clock = clock; this.origin = clock();
    this.bag = new ShuffledBag(preset.pool, random); this.pitch = this.nextPitch();
    if (this.continueAfter === 'auto') {
      this.auto = validateAuto(options.auto);
      this.beats = quarterBeats(this.auto.value);
      this.pulseMs = 1000 * musicalSeconds(quarterPulse, this.auto.bpm);
      this.promptStart = this.beats * this.pulseMs;
      if (this.auto.lookahead) this.reservePreview();
    }
  }
  get token(): PromptToken { return { session: this.session, prompt: this.prompt }; }
  get observations(): readonly Observation[] { return this.records; }
  get attempts() { return this.submissions; }
  get accuracy() { return this.attempts ? this.correct / this.attempts : null; }
  get last() { return this.records.at(-1); }
  get activeMs() { return this.endTime ?? (this.state === 'paused' ? this.pausedAt : this.clock()) - this.origin - this.pausedMs; }
  matches(token: PromptToken) { return token.session === this.session && token.prompt === this.prompt; }
  answer(token: PromptToken, answer: NoteAnswer) {
    const overlap = this.earlyNext && token.session === this.session && token.prompt === this.prompt + 1;
    if (this.state !== 'running' || !(this.matches(token) || overlap) || this.auto && (this.countingIn || this.activeMs >= this.deadline)) return false;
    if ('kind' in answer && answer.kind === 'keyboard' && (!Number.isInteger(answer.note) || answer.note < 12 || answer.note > 119)) return false;
    if ('kind' in answer && answer.kind === 'fingering') {
      if (!validFingering(answer.code)) return false;
    }
    const now = this.activeMs;
    const config = fingeringFor('kind' in answer && answer.kind === 'fingering' ? answer.instrument ?? this.preset.instrument : this.preset.instrument, 4);
    if ('kind' in answer && answer.kind === 'fingering' && (!config || !config.pitches[chromatic(this.pitch)])) return false;
    const correct = this.accepts(this.pitch,answer);
    answer = this.normalizedAnswer(answer);
    if (this.auto && !correct) { this.pendingWrong = { ...answer }; return true; }
    this.recordOutcome(answer, correct, now - this.promptStart);
    this.feedbackEnd = now + this.feedbackDuration(correct); this.state = 'feedback'; return true;
  }
  private recordOutcome(answer: Observation['answer'], correct: boolean, responseMs: number) {
    if (!correct) this.misses[pitchLabel(this.pitch)] = (this.misses[pitchLabel(this.pitch)] ?? 0)+1;
    this.records.push(Object.freeze({ pitch: this.pitch, answer: Object.freeze({ ...answer }), correct, responseMs, activity: this.activity, preset: this.preset.id }));
    if (this.adaptive) {
      const previousPool = this.activePreset.pool;
      const next = learn(this.learning,this.records.at(-1)!,this.preset,this.currentFocusPrompt); this.learning = next.state;
      if (next.added.length) {
        const low = Math.min(...previousPool.map(diatonic)), high = Math.max(...previousPool.map(diatonic));
        const notes = next.added.map(pitch => {
          const direction = diatonic(pitch) < low ? 'lower ' : diatonic(pitch) > high ? 'higher ' : '';
          return `a ${direction}${spelling(pitch)}`;
        });
        this.announcement = `New ${notes.length === 1 ? 'Note' : 'Notes'}! Uno added ${notes.join(' and ')}!`;
      }
    } else this.learning = { ...this.learning, notes: observe(this.learning.notes,this.records.at(-1)!) };
    this.submissions++; this.responseTotalMs += responseMs;
    if (correct && this.submissions <= 20) this.first20Correct++;
    if (this.records.length > 100) this.records.shift();
    if (correct) { this.correct++; this.streak++; } else this.streak = 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
  }
  /** Close each elapsed window against its scheduled boundary, including after a delayed frame. */
  advanceAuto(onMiss: () => void, onEarlyCorrect: (previousAnnouncement: string) => void = () => {}) {
    if (!this.auto || this.state === 'paused' || this.state === 'finished') return;
    const now = this.activeMs;
    const applyEarly = () => {
      if (this.earlyAnswer?.prompt !== this.prompt || now < this.promptStart) return;
      const previousAnnouncement = this.announcement;
      this.recordOutcome(this.earlyAnswer.answer,true,0);
      this.earlyAnswer = undefined;
      this.state = 'feedback';
      onEarlyCorrect(previousAnnouncement);
    };
    applyEarly();
    while (now >= this.deadline) {
      if (this.state === 'running') {
        this.recordOutcome(this.pendingWrong ?? { kind: 'unanswered' }, false, this.deadline - this.promptStart);
        onMiss();
      }
      this.promptStart = this.deadline;
      this.pendingWrong = undefined;
      this.pitch = this.nextPreview ?? this.nextPitch();
      this.nextPreview = undefined;
      this.currentFocusPrompt = undefined;
      if (this.auto.lookahead) this.reservePreview();
      this.prompt++;
      this.state = 'running';
      applyEarly();
    }
  }
  protected feedbackDuration(correct: boolean) { return this.continueAfter === 'instant' ? 0 : correct ? 250 : 800; }
  advance(token: PromptToken, explicit = false) {
    if (this.auto || this.state !== 'feedback' || !this.matches(token) || (this.selfPaced ? !explicit : this.activeMs < this.feedbackEnd)) return false;
    if (this.continueAfter !== 'correct' || this.last?.correct) this.pitch = this.nextPitch();
    this.prompt++; this.promptStart = this.activeMs; this.state = 'running'; return true;
  }
  pause() {
    if (this.state !== 'running' && this.state !== 'feedback') return;
    this.earlyAnswer = undefined;
    this.resumeState = this.state; this.pausedAt = this.clock(); this.state = 'paused'; this.interrupted = true;
  }
  resume() {
    if (this.state !== 'paused') return;
    this.pausedMs += this.clock() - this.pausedAt; this.state = this.resumeState;
    if (this.auto) this.promptStart = this.activeMs + this.beats * this.pulseMs;
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
