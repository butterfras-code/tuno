import type { Assessment } from './assessment.ts';
import type { AttemptRecord } from './capture.ts';

/** Initial teaching defaults, not validated mastery standards. Highest tier first. */
export const rewardPolicy = {
  version: 1,
  rhythm: [90, 75, 60, 40],
  hold: [85, 70, 55, 35],
  tempo: [7, 12, 20, 30],
  steadiness: [7, 12, 20, 30],
} as const;
export type RewardMetric = 'rhythm' | 'hold' | 'tempo' | 'steadiness';
export type Bones = 1 | 2 | 3 | 4 | 5;
export interface RewardCategory { metric: RewardMetric; label: string; bones: Bones | null; reason: string | null }
/** Presentation only: consumes the already computed, confidence-gated assessment. */
export function performanceRewards(record: AttemptRecord, a: Assessment) {
  const eligible = record.status === 'completed' && a.expectedAttacks > 0 && a.capturedAttacks > 0 && a.basis !== 'unavailable';
  const categories: RewardCategory[] = [];
  function add(metric: RewardMetric, label: string, value: number | null | undefined, reason = 'Not enough evidence') {
    let bones: Bones | null = null;
    if (eligible && value != null && Number.isFinite(value)) {
      const tier = rewardPolicy[metric].findIndex(boundary => metric === 'rhythm' || metric === 'hold' ? value >= boundary : Math.abs(value) <= boundary);
      bones = (tier < 0 ? 1 : 5 - tier) as Bones;
    }
    categories.push({ metric, label, bones, reason: bones === null ? reason : null });
  }
  add('rhythm', 'Rhythm', a.rhythm);
  if ((record.playStyle ?? 'hold') === 'hold') add('hold', 'Holding notes', a.hold,
    a.holdReason === 'Hold not assessed—short notes only.' ? 'No long notes to check' : 'Not enough evidence');
  add('tempo', 'Tempo', a.tempo?.differencePercent);
  add('steadiness', 'Steady beat', a.tempo ? a.steadiness : null);
  return { version: rewardPolicy.version, categories };
}

/** Exercise-local completed feedback survives retries and interrupted captures. */
export class TreatBagState {
  completed: { record: AttemptRecord; assessment: Assessment; rewards: ReturnType<typeof performanceRewards> } | null = null;
  previous = false;
  begin() { this.previous = this.completed !== null; }
  finish(record: AttemptRecord, assessment: Assessment) {
    if (record.status !== 'completed') return;
    this.completed = { record, assessment, rewards: performanceRewards(record, assessment) };
    this.previous = false;
  }
  clear() { this.completed = null; this.previous = false; }
}
