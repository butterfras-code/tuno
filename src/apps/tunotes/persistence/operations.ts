import type { Context, Profile, Result, Snapshot } from './store.ts';
import type { Observation } from '../engine/practice.ts';
import type { Learning } from '../engine/adaptive.ts';
import { pitchLabel } from '../domain/notation.ts';

export type Mutation =
  | { kind: 'configuration'; patch: Partial<Snapshot['configuration']> }
  | { kind: 'presets'; before: Snapshot['customPresets']; after: Snapshot['customPresets'] }
  | { kind: 'profile'; profileId: string; create?: Profile; remove?: true; patch?: Partial<Profile> }
  | { kind: 'observation'; profileId: string; fingerprint: string; observation: Observation; learning?: Learning; at: number }
  | { kind: 'result'; profileId: string; roundId: string; result: Result };
export interface Operation { id: string; generation: string; mutation: Mutation }
export interface SavedState { data: Snapshot; generation: string }
export interface Repository {
  read(): Promise<SavedState>;
  commit(operations: Operation[]): Promise<{ ignored: boolean }>;
  replace(data: Snapshot): Promise<SavedState>;
  close(): void;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function patch<T extends object>(before: T, after: T): Partial<T> {
  return Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => !same(before[key as keyof T], after[key as keyof T]))
    .map(key => [key, after[key as keyof T]])) as Partial<T>;
}
/** Settings edits are captured as field changes, never as an old whole-history replacement. */
export function changes(before: Snapshot, after: Snapshot): Mutation[] {
  const mutations: Mutation[] = [];
  const configuration = patch(before.configuration, after.configuration);
  if (Object.keys(configuration).length) mutations.push({ kind: 'configuration', patch: configuration });
  if (!same(before.customPresets, after.customPresets)) mutations.push({ kind: 'presets', before: before.customPresets, after: after.customPresets });
  for (const previous of before.profiles) {
    const next = after.profiles.find(p => p.id === previous.id);
    if (!next) mutations.push({ kind: 'profile', profileId: previous.id, remove: true });
    else {
      const changed = patch(previous, next);
      // Learning/results use append/upsert operations; a stale settings edit must never replace them.
      delete changed.contexts; delete changed.results;
      if (Object.keys(changed).length) mutations.push({ kind: 'profile', profileId: previous.id, patch: changed });
    }
  }
  for (const next of after.profiles) if (!before.profiles.some(p => p.id === next.id)) mutations.push({ kind: 'profile', profileId: next.id, create: next });
  return structuredClone(mutations);
}
export function applyObservation(profile: Profile, mutation: Extract<Mutation, { kind: 'observation' }>) {
  let context = profile.contexts.find(c => c.fingerprint === mutation.fingerprint);
  if (!context) { context = { fingerprint: mutation.fingerprint, version: 1, updated: mutation.at, notes: {} }; profile.contexts.push(context); }
  const learning = mutation.learning;
  if (learning) {
    if (context.learning && context.learning.algorithmVersion !== learning.algorithmVersion) context.notes = {};
    context.learning = { ...learning, expansionCount: Math.max(learning.expansionCount, context.learning?.algorithmVersion === learning.algorithmVersion ? context.learning.expansionCount : 0) };
  }
  context.updated = Math.max(context.updated, mutation.at);
  const label = pitchLabel(mutation.observation.pitch);
  context.notes[label] = [...(context.notes[label] ?? []), mutation.observation].slice(-10);
  profile.contexts.sort((a: Context, b: Context) => a.updated - b.updated);
  if (profile.contexts.length > 128) profile.contexts.splice(0, profile.contexts.length - 128);
}
