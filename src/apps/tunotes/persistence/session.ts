import { NotesStore, STORAGE_KEY } from './store.ts';
import type { StorageAdapter } from './store.ts';

export const WRITER_LOCK = `${STORAGE_KEY}:writer`;
const unavailable = 'Safe saving is unavailable in this browser. This tab is using memory only. Export your work before closing.';
const occupied = 'Another tuNotes tab is saving. This tab is using memory only. Export your work, then close the other tab and reload saved data.';
const ended = 'Saving stopped for this tab. Export your work before reloading saved data.';
export interface NotesSession { store: NotesStore; close(): void }

/** Hold an exclusive Web Lock for the whole writable session, including synchronous flushes.
 * A non-owner never queues a takeover: its in-memory snapshot may already be stale.
 */
export function connectNotesStore(storage?: StorageAdapter, locks?: Pick<LockManager, 'request'>): Promise<NotesSession> {
  const fallback = (message: string): NotesSession => {
    const store = new NotesStore(storage); store.memoryOnly(message);
    return { store, close() { store.flush(); } };
  };
  if (!storage || !locks) return Promise.resolve(fallback(unavailable));
  return new Promise(resolve => {
    let session: NotesSession | undefined;
    let release: (() => void) | undefined;
    let closed = false;
    const failed = () => {
      if (session) { session.store.memoryOnly(unavailable); release?.(); }
      else { session = fallback(unavailable); resolve(session); }
    };
    try {
      void locks.request(WRITER_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) { session = fallback(occupied); resolve(session); return; }
        const held = new Promise<void>(done => { release = done; });
        // Read only after ownership is granted. No UI edits can precede this snapshot.
        const store = new NotesStore(storage);
        session = { store, close() {
          if (closed) return; closed = true;
          store.flush();
          store.memoryOnly(ended); // Revoke before making the lock available to another tab.
          release!();
        } };
        resolve(session);
        await held;
      }).catch(failed);
    } catch { failed(); }
  });
}
