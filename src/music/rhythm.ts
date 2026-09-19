export type Rhythm = Readonly<{ tempo: number; beats: number; subdivision: number }>;
export type Pulse = Readonly<{ time: number; beat: number; part: number; downbeat: boolean }>;

/** Times are AudioContext seconds. Settings are sampled at each beat boundary. */
export function createTimeline(start: number) {
  let time = start;
  let beat = 0;
  let part = 0;
  let rhythm: Rhythm | undefined;
  return {
    get time() { return time; },
    next(settings: Rhythm): Pulse {
      if (!rhythm || part === 0) {
        if (!rhythm || settings.beats !== rhythm.beats) beat = 0;
        rhythm = { ...settings };
      }
      const pulse = { time, beat, part, downbeat: rhythm.beats > 0 && beat === 0 && part === 0 };
      time += 60 / rhythm.tempo / rhythm.subdivision;
      part++;
      if (part === rhythm.subdivision) {
        part = 0;
        beat = (beat + 1) % (rhythm.beats || 2);
      }
      return pulse;
    },
  };
}

/** Median recent intervals tolerates a stray tap. A long pause starts a new set. */
export function createTapTempo() {
  let taps: number[] = [];
  return (now: number): number | null => {
    if (taps.length && now - taps[taps.length - 1]! > 2000) taps = [];
    if (taps.length && now - taps[taps.length - 1]! < 100) return null;
    taps.push(now);
    taps = taps.slice(-5);
    if (taps.length < 2) return null;
    const intervals = taps.slice(1).map((time, index) => time - taps[index]!).sort((a, b) => a - b);
    const middle = Math.floor(intervals.length / 2);
    const interval = intervals.length % 2 ? intervals[middle]! : (intervals[middle - 1]! + intervals[middle]!) / 2;
    return Math.max(30, Math.min(240, Math.round(60000 / interval)));
  };
}
