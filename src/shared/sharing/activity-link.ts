/** Version one is self-contained canonical JSON, optionally deflate-compressed. */
export const activityLimits = Object.freeze({ encoded: 16000, decodedBytes: 65536, depth: 16, collection: 1024 });
export interface ActivityAdapter<T> {
  app: string;
  version: number;
  path(value: T): string;
  validate(value: unknown): T;
  describe(value: T): string;
}
export type ActivityLink<T> = { kind: 'none' } | { kind: 'loaded'; value: T } | { kind: 'error'; message: string };
export function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new Error('Unsupported activity fields.');
  return value as Record<string, unknown>;
}
export function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error('Unsupported activity option.');
  return value as T;
}
export function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('Invalid activity setting.'); return value; }
export function number(value: unknown, min: number, max: number, integer = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value)) throw new Error('Invalid activity number.');
  return value;
}
export function text(value: unknown, max = 160): string {
  if (typeof value !== 'string' || !value.length || value.length > max) throw new Error('Invalid activity text.');
  return value;
}
export function list(value: unknown, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) throw new Error('Invalid activity list.'); return value; }
function bounded(value: unknown, depth = 0): void {
  if (depth > activityLimits.depth) throw new Error('Activity is too deeply nested.');
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length > activityLimits.collection) throw new Error('Activity contains too many items.');
    for (const [key, child] of entries) {
      if (['__proto__','prototype','constructor'].includes(key)) throw new Error('Unsupported activity field.');
      bounded(child, depth + 1);
    }
  }
}
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([k,v]) => [k,canonical(v)]));
  return value;
}
async function transform(bytes: Uint8Array, decompress: boolean): Promise<Uint8Array> {
  if (decompress && typeof DecompressionStream === 'undefined') throw new Error('Update your browser to open compressed activity links.');
  if (!decompress && typeof CompressionStream === 'undefined') return bytes;
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(decompress ? new DecompressionStream('deflate') : new CompressionStream('deflate'));
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.length;
      if (length > activityLimits.decodedBytes) throw new Error('Activity exceeds the size limit.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk,offset); offset += chunk.length; }
  return result;
}
function encode64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
function decode64(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid activity encoding.');
  return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')), c => c.charCodeAt(0));
}
export async function activityUrl<T>(base: string, adapter: ActivityAdapter<T>, input: T): Promise<string> {
  const value = adapter.validate(structuredClone(input));
  const envelope = { transport: 1, app: adapter.app, version: adapter.version, activity: value };
  bounded(envelope);
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(envelope)));
  if (bytes.length > activityLimits.decodedBytes) throw new Error('This activity is too large to share. Reduce its size and try again.');
  const compressed = await transform(bytes,false);
  const payload = compressed.length + 16 < bytes.length ? `1z.${encode64(compressed)}` : `1j.${encode64(bytes)}`;
  if (payload.length > activityLimits.encoded) throw new Error('This activity is too large to share. Reduce its size and try again.');
  const url = new URL(adapter.path(value),base); url.search = ''; url.hash = ''; url.searchParams.set('activity',payload);
  return url.href;
}
export async function readActivityLink<T>(href: string, adapter: ActivityAdapter<T>): Promise<ActivityLink<T>> {
  const url = new URL(href); const payloads = url.searchParams.getAll('activity');
  if (!payloads.length) return {kind:'none'};
  try {
    if (payloads.length !== 1 || [...url.searchParams.keys()].some(k => k === 'counting' || k.startsWith('counting.'))) throw new Error('This link contains conflicting activity settings.');
    const payload = payloads[0]!;
    if (payload.length > activityLimits.encoded) throw new Error('Activity exceeds the size limit.');
    const match = /^(1[zj])\.(.+)$/.exec(payload);
    if (!match || !['1z','1j'].includes(match[1]!)) throw new Error('This activity link uses an unsupported version.');
    let bytes: Uint8Array = decode64(match[2]!);
    if (match[1] === '1z') bytes = await transform(bytes,true);
    if (bytes.length > activityLimits.decodedBytes) throw new Error('Activity exceeds the size limit.');
    const raw: unknown = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); bounded(raw);
    const envelope = record(raw,['transport','app','version','activity']);
    if (envelope.transport !== 1 || envelope.app !== adapter.app || envelope.version !== adapter.version) throw new Error('This activity link uses an unsupported app or version.');
    const value = adapter.validate(envelope.activity);
    if (url.pathname !== adapter.path(value)) throw new Error('This activity link does not match this page.');
    return {kind:'loaded',value};
  } catch (error) { return {kind:'error',message:`Shared activity could not be loaded. ${error instanceof Error ? error.message : 'Invalid link.'}`}; }
}
export function ordinaryUrl(href: string) { const url = new URL(href); url.search = ''; url.hash = ''; return url.href; }
