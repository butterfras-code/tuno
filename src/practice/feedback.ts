/** Presentation timing, deliberately independent of pitch detection and display smoothing. */
export type FeedbackEvidence = { note: number; cents: number } | null;
export type UnoPose = 'rest' | 'wag' | 'beg' | 'catch' | 'happy';
export function createTunerFeedback() {
  let previous: number | null = null;
  let zone = false;
  let held = 0;
  let badSince: number | null = null;
  let outSince: number | null = null;
  let silentSince: number | null = null;
  let note: number | null = null;
  let noteSince = 0;
  let rewardedNote: number | null = null;
  let caughtAt: number | null = null;
  let pose: UnoPose = 'rest';
  let wasGood = false;
  let reward = 0;
  return {
    reset() {
      previous = null; zone = false; held = 0; badSince = silentSince = outSince = null;
      note = rewardedNote = caughtAt = null; pose = 'rest'; wasGood = false;
    },
    update(now: number, evidence: FeedbackEvidence, silent = false, toleranceScale = 1) {
      const dt = previous === null ? 0 : Math.max(0, now - previous);
      previous = now;
      if (dt > 250) { held = 0; wasGood = false; }
      if (evidence && evidence.note !== note) {
        note = evidence.note; noteSince = now; held = 0; zone = false; wasGood = false;
      }
      if (evidence === null) noteSince = now;
      if (silent) silentSince ??= now;
      else silentSince = null;
      zone = evidence !== null && Math.abs(evidence.cents) <= (zone ? 8 : 5) * toleranceScale;
      if (evidence !== null && !zone) outSince ??= now;
      else outSince = null;
      if (zone) {
        if (badSince !== null && now - badSince > 150) held = 0;
        if (wasGood) held += dt;
        badSince = null;
      } else {
        badSince ??= now;
        if (now - badSince > 150) held = 0;
      }
      wasGood = zone;
      if (rewardedNote !== null && (
        (silentSince !== null && now - silentSince >= 500)
        || (outSince !== null && now - outSince >= 700)
        || (evidence !== null && evidence.note !== rewardedNote && now - noteSince >= 250)
      )) { rewardedNote = null; held = 0; }
      if (caughtAt !== null && now - caughtAt < 1100) pose = 'catch';
      else {
        caughtAt = null;
        if (rewardedNote !== null && zone) pose = 'happy';
        else if (zone && held >= 2500 && rewardedNote === null) {
          rewardedNote = note; caughtAt = now; pose = 'catch'; reward++;
        } else if (zone && held >= 1200) pose = 'beg';
        else if (zone && held >= 250) pose = 'wag';
        else if (badSince !== null && now - badSince >= 400) pose = 'rest';
      }
      return { pose, progress: rewardedNote !== null && zone ? 1 : Math.min(1, held / 2500), reward };
    },
  };
}
