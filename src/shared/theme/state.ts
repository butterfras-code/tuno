import {
  INITIAL_THEME_ID,
  THEMES,
  getThemeDefinition,
  isThemeId,
  type ThemeId,
} from './registry.ts';
import { ensureThemeGarland } from './garland.ts';

export type { ThemeId } from './registry.ts';

export const THEME_STORAGE_KEY = 'tuno.theme.v1';

type ThemeListener = (theme: ThemeId) => void;
type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

let currentTheme: ThemeId = INITIAL_THEME_ID;
let initialized = false;
const listeners = new Set<ThemeListener>();

/** Read persisted theme with optional non-persisting ?theme=<id> query override. */
export function resolveStoredTheme(storage?: ThemeStorage | null, search = ''): ThemeId {
  if (search) {
    try {
      const param = new URLSearchParams(search).get('theme');
      if (isThemeId(param)) return param;
    } catch { /* Ignore malformed query strings. */ }
  }
  if (storage) {
    try {
      const saved = storage.getItem(THEME_STORAGE_KEY);
      if (isThemeId(saved)) return saved;
    } catch { /* Storage may be blocked in private browsing. */ }
  }
  return INITIAL_THEME_ID;
}

export function applyThemeToDocument(id: ThemeId, doc: Document | undefined = typeof document === 'undefined' ? undefined : document) {
  if (!doc) return;
  if (id === 'default') doc.documentElement.removeAttribute('data-theme');
  else doc.documentElement.dataset.theme = id;
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = getThemeDefinition(id).themeColor;
}

export function getTheme(): ThemeId {
  return currentTheme;
}

export function setTheme(id: ThemeId, persist = true) {
  const next: ThemeId = isThemeId(id) ? id : 'default';
  currentTheme = next;
  applyThemeToDocument(next);
  if (persist && typeof window !== 'undefined') {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Storage may be blocked or full. */ }
  }
  listeners.forEach(listener => listener(next));
}

export function cycleTheme(): ThemeId {
  const index = THEMES.findIndex(theme => theme.id === currentTheme);
  const next = THEMES[(index + 1) % THEMES.length]!.id;
  setTheme(next, true);
  return next;
}

export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Initialize suite-wide theme once per page load, mount decorative garland, and sync across tabs. */
export function initTheme(): ThemeId {
  if (typeof window !== 'undefined') {
    if (!initialized) {
      initialized = true;
      let storage: Storage | null = null;
      try { storage = window.localStorage; } catch { /* Memory-only fallback. */ }
      currentTheme = resolveStoredTheme(storage, window.location.search);
      window.addEventListener('storage', event => {
        if (event.key !== THEME_STORAGE_KEY) return;
        const synced = isThemeId(event.newValue) ? event.newValue : INITIAL_THEME_ID;
        if (synced !== currentTheme) setTheme(synced, false);
      });
    }
    applyThemeToDocument(currentTheme);
    ensureThemeGarland();
  }
  return currentTheme;
}

/** Helper for unit tests to reset module state cleanly. */
export function resetThemeForTests(id: ThemeId = INITIAL_THEME_ID) {
  currentTheme = id;
  initialized = false;
  listeners.clear();
}
