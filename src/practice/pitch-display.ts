/** Display-only rolling median. Raw microphone readings remain the reward evidence. */
export class PitchDisplay {
  private samples: { time: number; frequency: number }[] = [];

  reset(): void {
    this.samples = [];
  }

  frame(now: number, frequency: number | null): number | null {
    if (frequency === null || !Number.isFinite(frequency) || frequency <= 0) {
      this.reset();
      return null;
    }
    this.samples = this.samples.filter((sample) => now > sample.time && now - sample.time <= 250);
    this.samples.push({ time: now, frequency });
    this.samples = this.samples.slice(-3);
    if (this.samples.length < 3) return null;
    return this.samples.map((sample) => sample.frequency).sort((a, b) => a - b)[1]!;
  }
}
