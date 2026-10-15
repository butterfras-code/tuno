import { captureCountingPreferences, defaultCountingPreferences } from './preferences.ts';
import type { CountingPreferences } from './preferences.ts';

export const maximumCountingPayloadLength = 2048;
export const invalidCountingLinkNotice = 'Counting link could not be loaded. Using saved or default counting preferences.';
/** Stable schema order, regardless of the caller's object insertion order. ASCII-only contract. */
export function encodeCountingPreferences(value: CountingPreferences): string {
  const preferences = captureCountingPreferences(value);
  const ordered = Object.fromEntries(Object.keys(defaultCountingPreferences).map(key => [key, preferences[key as keyof CountingPreferences]]));
  return btoa(JSON.stringify(ordered)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decodeCountingPreferences(payload: string): CountingPreferences {
  if (!payload || payload.length > maximumCountingPayloadLength || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) throw new Error('Invalid counting link.');
  const json = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
  // Reject noncanonical base64 padding bits as well as invalid schema fields.
  if (btoa(json).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') !== payload) throw new Error('Invalid counting link.');
  return captureCountingPreferences(JSON.parse(json));
}
export function readCountingLink(search: string): { counting?: CountingPreferences; notice: string } {
  const values = new URLSearchParams(search).getAll('counting');
  if (!values.length) return { notice: '' };
  try {
    if (values.length !== 1) throw new Error('Ambiguous counting link.');
    return { counting: decodeCountingPreferences(values[0]!), notice: '' };
  } catch { return { notice: invalidCountingLinkNotice }; }
}
/** Both supported Uno234 entry routes remain usable; never carry developer fixture access. */
export function countingPreferencesUrl(currentUrl: string, preferences: CountingPreferences): string {
  const url = new URL(currentUrl);
  if (!['/prototypes/rhythm-walk/', '/prototypes/count-writing/'].includes(url.pathname)) url.pathname = '/prototypes/rhythm-walk/';
  url.searchParams.delete('testing');
  url.searchParams.delete('fixture');
  url.searchParams.set('counting', encodeCountingPreferences(preferences));
  url.searchParams.sort();
  return url.href;
}
