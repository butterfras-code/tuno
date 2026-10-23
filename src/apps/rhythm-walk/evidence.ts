import { inputKind } from './offset.ts';
import type { TimingOffset } from './offset.ts';
import type { AttemptRecord } from './capture.ts';
export interface Hold { down: number; up: number | null; eventIndex: number; countIn: boolean; correction: number }
/** Input-specific fixed correction only; raw events and durations remain untouched. */
export function capturedHolds(record: AttemptRecord, timingOffset: TimingOffset | null | undefined = record.timingOffset): Hold[] {
  const holds: Hold[] = [];
  let active: Hold | undefined;
  record.events.forEach((e, eventIndex) => {
    if (!e.accepted || e.region === 'outside') return;
    const correction = timingOffset?.input === inputKind(e.source) ? timingOffset.seconds : 0;
    const time = e.time - correction;
    if (e.action === 'down') {
      // A measured offset can move an early first attack into its matching window.
      const countIn = timingOffset?.input === inputKind(e.source) ? time < -record.policy.attackWindow : e.region === 'count-in';
      active = { down: time, up: null, eventIndex, countIn, correction }; holds.push(active);
    } else if (active) { active.up = time; active = undefined; }
  });
  return holds;
}
