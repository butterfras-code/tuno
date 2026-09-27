import type { UnoPose } from '../../../shared/ui/uno-pose.ts';
export const DEFAULT_BENCHMARK = 10;
export class NotesProgress {
  readonly benchmark: number;
  constructor(benchmark = DEFAULT_BENCHMARK) { this.benchmark = Math.max(10, benchmark); }
  private earned = 0;
  private streaks = new Set<number>();
  update(correct: number, streak: number) {
    const milestone = Math.min(5, Math.floor(correct / this.benchmark * 5));
    const fresh = milestone > this.earned;
    this.earned = Math.max(this.earned, milestone);
    const streakReward = [5, 10, 20].includes(streak) && !this.streaks.has(streak);
    if (streakReward) this.streaks.add(streak);
    const pose: UnoPose = this.earned >= 5 ? 'happy' : this.earned >= 4 ? 'beg' : this.earned >= 2 ? 'wag' : 'rest';
    return { pose, look: fresh && milestone === 1, nod: (fresh && milestone === 3) || streakReward,
      treat: fresh && milestone === 5, text: fresh && milestone === 5 ? 'A treat for Uno! Keep exploring.' : streakReward ? `${streak} in a row! Keep going.` : '' };
  }
}
