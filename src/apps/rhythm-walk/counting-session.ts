import { readCountingLink } from '../../music/counting/link.ts';
import { captureCountingPreferences } from '../../music/counting/preferences.ts';
import { readPreferences } from './activity.ts';

/** Pending settings, saved counting defaults, and Activity's captured plan have separate ownership. */
export function createPreferenceSession(raw: string | null, search: string) {
  const preferences = readPreferences(raw);
  let savedCounting = preferences.counting;
  const link = readCountingLink(search);
  let linked = Boolean(link.counting);
  if (link.counting) preferences.counting = link.counting;
  function serialize(counting = linked ? savedCounting : preferences.counting) {
    return JSON.stringify({ ...preferences, counting, countingSystem: undefined, offbeat: undefined, presentation: undefined, convention: undefined });
  }
  return {
    preferences,
    notice: link.notice,
    isLinked: () => linked,
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
