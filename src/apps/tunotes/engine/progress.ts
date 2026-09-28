import type { UnoPose } from '../../../shared/ui/uno-pose.ts';
export const DEFAULT_BENCHMARK = 10;
const RECENT_ANSWERS = 20;
const MIN_TREAT_GAP = 3;
export class NotesProgress {
  readonly benchmark: number;
  constructor(benchmark = DEFAULT_BENCHMARK) {
    if (!Number.isInteger(benchmark) || benchmark < 1) throw new Error('Reward benchmark must be a positive integer.');
    this.benchmark = benchmark;
  }
  private earned = 0;
  private streaks = new Set<number>();
  private recent: { streak: number; wrong: boolean }[] = [];
  private correct = 0;
  private attempts = 0;
  private previousStreak = 0;
  private lastTreat = 0;
  private count = 0;
  get treats() { return this.count; }
  /** Recent peak uses ongoing streak lengths, so a 60-note streak still counts as 60. */
  get interval() {
    const peak = Math.max(this.benchmark,...this.recent.map(answer => answer.streak));
    const wrongs = this.recent.filter(answer => answer.wrong).length;
    return Math.max(MIN_TREAT_GAP, Math.ceil(peak / 5) - Math.ceil(wrongs / 4));
  }
  get remaining() { return Math.max(1, this.count ? this.interval - (this.correct - this.lastTreat) : this.benchmark - this.correct); }
  get pose(): UnoPose { return this.earned >= 5 ? 'happy' : this.earned >= 4 ? 'beg' : this.earned >= 2 ? 'wag' : 'rest'; }
  update(correct: number, streak: number, attempts = this.attempts + (correct > this.correct || streak !== this.previousStreak ? 1 : 0)) {
    let fresh = false, streakReward = false, treat = false, milestone = this.earned;
    if (attempts > this.attempts) {
      const answeredCorrectly = correct > this.correct;
      this.recent.push({ streak, wrong: !answeredCorrectly });
      if (this.recent.length > RECENT_ANSWERS) this.recent.shift();
      this.correct = correct; this.attempts = attempts; this.previousStreak = streak;
      milestone = Math.min(5, Math.floor(correct / this.benchmark * 5));
      fresh = milestone > this.earned; this.earned = Math.max(this.earned,milestone);
      streakReward = answeredCorrectly && [5,10,20].includes(streak) && !this.streaks.has(streak);
      if (streakReward) this.streaks.add(streak);
      // A miss may bring the next treat closer, but only a correct answer can earn it.
      treat = answeredCorrectly && (this.count ? correct - this.lastTreat >= this.interval : correct >= this.benchmark);
      if (treat) { this.count++; this.lastTreat = correct; }
    }
    return { pose: this.pose, look: fresh && milestone === 1, nod: (fresh && milestone === 3) || streakReward,
      treat, text: treat ? 'A treat for Uno! Keep exploring.' : streakReward ? `${streak} in a row! Keep going.` : '' };
  }
}
