import { emptySnapshot, MAX_BYTES, validateSnapshot } from './store.ts';
import type { Profile, Snapshot } from './store.ts';
import { applyObservation } from './operations.ts';
import type { Repository, SavedState } from './operations.ts';
import { presets } from '../domain/presets.ts';

export const DATABASE_NAME = 'tunotes-progress';
interface State { generation: string; configuration: Snapshot['configuration']; customPresets: Snapshot['customPresets']; profileIds: string[]; bytes: number }
interface Row { value: Profile; receipts: string[]; resultIds: string[]; bytes: number }
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const request = <T>(value: IDBRequest<T>) => new Promise<T>((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
const complete = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Saving was interrupted.')); tx.onerror = () => {}; });
function normalize(state: State) {
  if (!state.profileIds.includes(state.configuration.profileId!)) state.configuration.profileId = null;
  if (!presets.some(p => p.id === state.configuration.presetId) && !state.customPresets.some(p => p.id === state.configuration.presetId)) state.configuration.presetId = emptySnapshot().configuration.presetId;
}
function writeReplacement(tx: IDBTransaction, data: Snapshot): State {
  const profiles = tx.objectStore('profiles'); profiles.clear();
  let size = 0;
  for (const profile of data.profiles) { const length = bytes(profile); size += length; profiles.put({ value: profile, receipts: [], resultIds: profile.results.map(() => crypto.randomUUID()), bytes: length } satisfies Row, profile.id); }
  const state: State = { generation: crypto.randomUUID(), configuration: data.configuration, customPresets: data.customPresets, profileIds: data.profiles.map(p => p.id), bytes: size };
  tx.objectStore('meta').put(state, 'state'); return state;
}
/** IDB transactions serialize overlapping tabs. Only touched profile records are read/written. */
export async function openRepository(factory: IDBFactory, initial: () => Snapshot): Promise<Repository> {
  const opening = factory.open(DATABASE_NAME, 1);
  opening.onupgradeneeded = () => { opening.result.createObjectStore('meta'); opening.result.createObjectStore('profiles'); };
  const db = await request(opening);
  db.onversionchange = () => db.close();
  try {
    const tx = db.transaction(['meta', 'profiles'], 'readwrite'), done = complete(tx);
    try { if (!await request(tx.objectStore('meta').get('state'))) writeReplacement(tx, validateSnapshot(initial())); }
    catch (error) { try { tx.abort(); } catch { /* Already aborted by IndexedDB. */ } await done.catch(() => {}); throw error; }
    await done;
  } catch (error) { db.close(); throw error; }
  return {
    async read() {
      const tx = db.transaction(['meta', 'profiles']), done = complete(tx);
      const [state, rows] = await Promise.all([request<State>(tx.objectStore('meta').get('state')), request<Row[]>(tx.objectStore('profiles').getAll())]);
      await done;
      const profiles = state.profileIds.map(id => rows.find(row => row.value.id === id)!.value);
      return { data: validateSnapshot({ ...emptySnapshot(), configuration: state.configuration, customPresets: state.customPresets, profiles }), generation: state.generation };
    },
    async commit(operations) {
      const tx = db.transaction(['meta', 'profiles'], 'readwrite'), done = complete(tx);
      let ignored = false;
      try {
        const state = await request<State>(tx.objectStore('meta').get('state'));
        const valid = operations.filter(op => { if (op.generation === state.generation) return true; ignored = true; return false; });
        const ids = [...new Set(valid.flatMap(op => 'profileId' in op.mutation ? [op.mutation.profileId] : []))];
        const table = tx.objectStore('profiles');
        const rows = new Map(await Promise.all(ids.map(async id => [id, await request<Row | undefined>(table.get(id))] as const)));
        const originalBytes = new Map(ids.map(id => [id, rows.get(id)?.bytes ?? 0]));
        for (const op of valid) {
          const m = op.mutation;
          if (m.kind === 'configuration') { Object.assign(state.configuration, m.patch); continue; }
          if (m.kind === 'presets') {
            // Custom definitions are independently added/edited. Deletion of referenced definitions is not exposed by the UI.
            for (const p of m.after) if (JSON.stringify(m.before.find(v => v.id === p.id)) !== JSON.stringify(p)) {
              const index = state.customPresets.findIndex(v => v.id === p.id);
              if (index < 0) state.customPresets.push(p); else state.customPresets[index] = p;
            }
            continue;
          }
          let row = rows.get(m.profileId);
          if (row?.receipts.includes(op.id)) continue;
          if (m.kind === 'profile' && m.create && !row) {
            if (state.profileIds.length >= 32) throw new Error('The profile limit was reached.');
            row = { value: structuredClone(m.create), receipts: [], resultIds: m.create.results.map(() => crypto.randomUUID()), bytes: 0 }; rows.set(m.profileId, row); state.profileIds.push(m.profileId);
          } else if (!row) { ignored = true; continue; }
          if (m.kind === 'profile') {
            if (m.remove) { rows.set(m.profileId, undefined); state.profileIds = state.profileIds.filter(id => id !== m.profileId); continue; }
            if (m.patch) Object.assign(row.value, m.patch);
          } else {
            const fp = m.kind === 'observation' ? m.fingerprint : m.result.context;
            const presetId = JSON.parse(fp)[0];
            if (!presets.some(p => p.id === presetId) && !state.customPresets.some(p => p.id === presetId)) { ignored = true; continue; }
            if (m.kind === 'observation') applyObservation(row.value, m);
            else {
              const index = row.resultIds.indexOf(m.roundId);
              if (index < 0) { row.value.results.push(m.result); row.resultIds.push(m.roundId); }
              else row.value.results[index] = m.result;
              row.value.results = row.value.results.slice(-100); row.resultIds = row.resultIds.slice(-100);
            }
          }
          row.receipts.push(op.id); row.receipts = row.receipts.slice(-1024);
        }
        normalize(state);
        // Validate at the persistence boundary, limited to changed profiles, never on the answer path.
        for (const id of ids) {
          const row = rows.get(id);
          state.bytes -= originalBytes.get(id)!;
          if (!row) { table.delete(id); continue; }
          const single = validateSnapshot({ ...emptySnapshot(), customPresets: state.customPresets, profiles: [row.value] });
          row.value = single.profiles[0]!; row.bytes = bytes(row.value); state.bytes += row.bytes;
        }
        // Leave headroom for backup JSON framing; prune only the profiles participating in this save.
        for (const id of ids) {
          const row = rows.get(id); if (!row) continue;
          while (state.bytes + bytes(state.customPresets) + bytes(state.configuration) + 4096 > MAX_BYTES && (row.value.contexts.length || row.value.results.length)) {
            state.bytes -= row.bytes;
            if (row.value.contexts.length) row.value.contexts.shift(); else { row.value.results.shift(); row.resultIds.shift(); }
            row.bytes = bytes(row.value); state.bytes += row.bytes;
          }
          table.put(row, id);
        }
        if (state.customPresets.length > 100 || state.bytes + bytes(state.customPresets) + bytes(state.configuration) + 4096 > MAX_BYTES) throw new Error('Saved progress is full.');
        tx.objectStore('meta').put(state, 'state');
      } catch (error) { try { tx.abort(); } catch { /* Already aborted by IndexedDB. */ } await done.catch(() => {}); throw error; }
      await done; return { ignored };
    },
    async replace(candidate): Promise<SavedState> {
      const data = validateSnapshot(candidate);
      if (bytes(data) > MAX_BYTES) throw new Error('Backup exceeds 5 MiB.');
      const tx = db.transaction(['meta', 'profiles'], 'readwrite'), done = complete(tx);
      try {
        const state = writeReplacement(tx, data); await done;
        return { data, generation: state.generation };
      } catch (error) { try { tx.abort(); } catch { /* Already finished or aborted. */ } await done.catch(() => {}); throw error; }
    },
    close() { db.close(); },
  };
}
