import { captureCountingPreferences, defaultCountingPreferences } from './preferences.ts';
import type { CountingPreferences } from './preferences.ts';

export const maximumCountingPayloadLength = 2048;
export const invalidCountingLinkNotice = 'Counting link could not be loaded. Using saved or default counting preferences.';
const isCountingParameter = (key: string) => key === 'counting' || key.startsWith('counting.');
/** Readable, complete versioned contract in stable schema order. No DOM dependencies. */
export function encodeCountingPreferences(value: CountingPreferences): string {
  const preferences = captureCountingPreferences(value);
  const params = new URLSearchParams();
  for (const key of Object.keys(defaultCountingPreferences) as (keyof CountingPreferences)[]) {
    params.set(key === 'version' ? 'counting' : `counting.${key}`, String(preferences[key]));
  }
  return params.toString();
}
export function decodeCountingPreferences(search: string): CountingPreferences {
  const entries = [...new URLSearchParams(search)].filter(([key]) => isCountingParameter(key));
  if (new URLSearchParams(entries).toString().length > maximumCountingPayloadLength || entries.length !== Object.keys(defaultCountingPreferences).length) throw new Error('Invalid counting link.');
  const value: Record<string, unknown> = {};
  for (const [parameter, text] of entries) {
    const key = parameter === 'counting' ? 'version' : parameter.slice('counting.'.length);
    if ((key === 'version' && parameter !== 'counting') || !Object.hasOwn(defaultCountingPreferences, key) || Object.hasOwn(value, key)) throw new Error('Invalid counting link.');
    // Convert only the schema's primitive types; the canonical validator owns valid values.
    const type = typeof defaultCountingPreferences[key as keyof CountingPreferences];
    value[key] = type === 'boolean' ? (text === 'true' ? true : text === 'false' ? false : text) : key === 'version' && text === '1' ? 1 : text;
  }
  return captureCountingPreferences(value as unknown as CountingPreferences);
}
export function readCountingLink(search: string): { counting?: CountingPreferences; notice: string } {
  if (![...new URLSearchParams(search).keys()].some(isCountingParameter)) return { notice: '' };
  try { return { counting: decodeCountingPreferences(search), notice: '' }; }
  catch { return { notice: invalidCountingLinkNotice }; }
}
/** Both supported Uno234 entry routes remain usable; never carry developer fixture access. */
export function countingPreferencesUrl(currentUrl: string, preferences: CountingPreferences): string {
  const url = new URL(currentUrl);
  if (!['/prototypes/rhythm-walk/', '/prototypes/count-writing/'].includes(url.pathname)) url.pathname = '/prototypes/rhythm-walk/';
  url.searchParams.delete('testing');
  url.searchParams.delete('fixture');
  for (const key of [...url.searchParams.keys()]) if (isCountingParameter(key)) url.searchParams.delete(key);
  for (const [key, value] of new URLSearchParams(encodeCountingPreferences(preferences))) url.searchParams.set(key, value);
  url.searchParams.sort();
  return url.href;
}
