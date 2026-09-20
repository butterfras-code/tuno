import { TOOLS, type Action, type PracticeStore } from './state.ts';

export const PREFERENCES_KEY = 'tuno.preferences.v1';
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const fields = {
  tunerAccuracy: 'tuner-accuracy', toneNote: 'tone-note', octave: 'octave',
  sustain: 'sustain', toneVolume: 'tone-volume', toneSound: 'tone-sound',
  tempo: 'tempo', meter: 'meter', numbered: 'numbered', subdivision: 'subdivision',
  accent: 'accent', clickVolume: 'click-volume', clickSound: 'click-sound',
} as const;

/** Persist preferences only: capture, playback, and pitch evidence always start fresh. */
export function keepPreferences(store: PracticeStore, storage: PreferenceStorage | undefined) {
  if (!storage) return;
  try {
    const saved: unknown = JSON.parse(storage.getItem(PREFERENCES_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      const values = saved as Record<string, unknown>;
      const defaults = store.get();
      store.dispatch({ type: 'settings', value: {
        a4: typeof values.a4 === 'number' ? values.a4 : defaults.a4,
        transposition: typeof values.transposition === 'number' ? values.transposition : defaults.transposition,
        showUno: typeof values.showUno === 'boolean' ? values.showUno : defaults.showUno,
      } });
      if (TOOLS.some(tool => tool.id === values.focus)) {
        store.dispatch({ type: 'focus', value: values.focus as typeof defaults.focus });
      }
      for (const [field, type] of Object.entries(fields)) {
        const value = values[field];
        if (typeof value === typeof defaults[field as keyof typeof fields]) {
          // The store validates numeric ranges and enumerated choices.
          store.dispatch({ type, value } as Action);
        }
      }
      if (Array.isArray(values.beatAccents) && values.beatAccents.length === defaults.beatAccents.length
        && values.beatAccents.every(value => typeof value === 'boolean')) {
        values.beatAccents.forEach((value, index) => {
          if (value !== store.get().beatAccents[index]) store.dispatch({ type: 'beat-accent', value: index });
        });
      }
    }
  } catch { /* Invalid or unavailable storage must never prevent practice. */ }
  let previous = '';
  return store.subscribe(state => {
    const values = Object.fromEntries(
      ['a4', 'transposition', 'showUno', 'focus', ...Object.keys(fields), 'beatAccents']
        .map(key => [key, state[key as keyof typeof state]]),
    );
    const serialized = JSON.stringify(values);
    if (serialized === previous) return;
    previous = serialized;
    try { storage.setItem(PREFERENCES_KEY, serialized); } catch { /* Storage may be blocked or full. */ }
  });
}
