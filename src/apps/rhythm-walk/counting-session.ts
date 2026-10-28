import { readCountingLink } from '../../music/counting/link.ts';
import { captureCountingPreferences } from '../../music/counting/preferences.ts';
import type { Preferences } from './activity.ts';
import { readPreferences } from './activity.ts';

/** Pending settings, saved counting defaults, and Activity's captured plan have separate ownership. */
export function createPreferenceSession(raw: string | null, search: string, fullActivity?: Partial<Preferences>) {
  const preferences = readPreferences(raw);
  const baseline = structuredClone(preferences);
  let savedCounting = preferences.counting;
  const link = readCountingLink(search);
  let linked = Boolean(link.counting);
  if (link.counting) preferences.counting = link.counting;
  if (fullActivity) Object.assign(preferences,fullActivity);
  function serialize(counting = linked || fullActivity ? savedCounting : preferences.counting) {
    return JSON.stringify({ ...(fullActivity ? baseline : preferences), counting, countingSystem: undefined, offbeat: undefined, presentation: undefined, convention: undefined });
  }
  return {
    preferences,
    notice: link.notice,
    isLinked: () => linked || Boolean(fullActivity),
    serialize: () => serialize(),
    /** A failed browser write leaves the session isolated and can be retried. */
    saveAsDefaults(write: (raw: string) => void) {
      const counting = captureCountingPreferences(preferences.counting);
      write(serialize(counting));
      savedCounting = counting;
      linked = false;
    },
  };
}
