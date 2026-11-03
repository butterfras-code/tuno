import { NotesStore, STORAGE_KEY, emptySnapshot, parseBackup } from './store.ts';
import type { StorageAdapter } from './store.ts';
import { openRepository } from './database.ts';

// Retained only to coordinate first migration with an already-open older build.
export const WRITER_LOCK = `${STORAGE_KEY}:writer`;
export interface NotesSession { store: NotesStore; close(): void }
export async function connectNotesStore(storage?: StorageAdapter, locks?: Pick<LockManager, 'request'>, factory?: IDBFactory): Promise<NotesSession> {
  const store = new NotesStore(storage);
  try {
    factory ??= globalThis.indexedDB;
    if (!factory) throw new Error('Storage unavailable');
    const open = () => openRepository(factory!, () => {
      // Called only when the database has no committed state. Failed migration leaves the source intact.
      if (!storage) throw new Error('Legacy storage unavailable');
      const raw = storage.getItem(STORAGE_KEY);
      return raw === null ? emptySnapshot() : parseBackup(raw);
    });
    const repository = locks ? await locks.request(WRITER_LOCK, { mode: 'exclusive', signal: AbortSignal.timeout(1500) }, async lock => {
      if (!lock) throw new Error('Close older tuNotes tabs once to finish updating.');
      return open();
    }) : await open();
    store.useRepository(repository, await repository.read());
    // Keep the legacy source as a recovery copy; new writes live only in the transactional database.
  } catch {
    if (factory) store.allowRecovery(async () => {
      const repository = await openRepository(factory!, emptySnapshot);
      const state = await repository.replace(emptySnapshot());
      store.useRepository(repository, state);
      try { storage?.removeItem(STORAGE_KEY); } catch { /* Recovery is committed in the database. */ }
    });
    store.memoryOnly('Progress couldn’t be saved on this device. You can keep playing. Your progress is still in memory.');
  }
  return { store, close() { void store.close(); } };
}
