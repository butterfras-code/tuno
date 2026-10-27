import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTask } from 'node:timers/promises';
import { connectNotesStore, WRITER_LOCK } from '../src/apps/tunotes/persistence/session.ts';
import { NotesStore, STORAGE_KEY, emptySnapshot, parseBackup } from '../src/apps/tunotes/persistence/store.ts';

function memory() {
  const values = new Map<string, string>();
  let writes = 0;
  return { values, get writes() { return writes; }, getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) { writes++; values.set(key, value); },
    removeItem(key: string) { writes++; values.delete(key); } };
}
/** Deterministic exclusive/ifAvailable scheduler. Real browser locks are exercised separately. */
class Locks {
  held = false;
  request = (async (name: string, options: LockOptions, callback: LockGrantedCallback<void>) => {
    assert.equal(name, WRITER_LOCK);
    assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
    await Promise.resolve();
    if (this.held) return callback(null);
    this.held = true;
    try { return await callback({ name, mode: 'exclusive' }); }
    finally { this.held = false; }
  }) as LockManager['request'];
}
function add(store: NotesStore, id: string, deferred = false) {
  store.update(data => data.profiles.push({ id, name: id, results: [], contexts: [], defaultPresetId: data.configuration.presetId }), deferred);
}
const names = (raw: string) => parseBackup(raw).profiles.map(profile => profile.name);

test('simultaneous tabs get exactly one writer; the other keeps exportable memory', async () => {
  const storage = memory(), locks = new Locks();
  const [a, b] = await Promise.all([connectNotesStore(storage, locks), connectNotesStore(storage, locks)]);
  try {
    assert.equal(a.store.durable, true); assert.equal(b.store.durable, false);
    add(a.store, 'Alice'); add(b.store, 'Bob');
    b.store.flush();
    assert.deepEqual(names(storage.getItem(STORAGE_KEY)!), ['Alice']);
    assert.deepEqual(names(b.store.export()), ['Bob']);
    assert.match(b.store.message, /Another tuNotes tab/);
  } finally { a.close(); b.close(); }
});

test('blocked tab cannot take over when owner closes; a fresh session reads current data', async () => {
  const storage = memory(), locks = new Locks();
  const a = await connectNotesStore(storage, locks), b = await connectNotesStore(storage, locks);
  add(a.store, 'Alice'); add(b.store, 'Bob');
  a.close(); await nextTask();
  b.store.flush(); assert.deepEqual(names(storage.getItem(STORAGE_KEY)!), ['Alice']);
  const c = await connectNotesStore(storage, locks);
  try {
    assert.equal(c.store.durable, true); assert.deepEqual(names(c.store.export()), ['Alice']);
    add(c.store, 'Carol'); b.store.clear();
    assert.equal(b.store.durable, false); assert.equal(b.store.canDeleteSavedData, false);
    assert.deepEqual(names(storage.getItem(STORAGE_KEY)!), ['Alice', 'Carol']);
    assert.match(b.store.message, /Saved data is unchanged/);
  } finally { c.close(); b.close(); }
});

test('closing flushes deferred work before release; restored snapshots cannot write', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memory(), locks = new Locks();
  const a = await connectNotesStore(storage, locks);
  add(a.store, 'Alice', true); assert.equal(storage.getItem(STORAGE_KEY), null);
  a.close(); await nextTask();
  assert.deepEqual(names(storage.getItem(STORAGE_KEY)!), ['Alice']);
  const b = await connectNotesStore(storage, locks);
  try {
    b.store.clear();
    add(a.store, 'Late', true); t.mock.timers.tick(1000); a.store.flush(); a.close();
    assert.equal(storage.getItem(STORAGE_KEY), null);
    assert.deepEqual(names(a.store.export()), ['Alice', 'Late']);
    assert.equal(a.store.durable, false);
  } finally { b.close(); }
});

test('import cancels an older deferred save; stale tabs cannot undo import or deletion', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memory(), locks = new Locks();
  const a = await connectNotesStore(storage, locks), b = await connectNotesStore(storage, locks);
  try {
    add(a.store, 'Before', true); add(b.store, 'Stale', true);
    const replacement = emptySnapshot();
    replacement.profiles.push({ id: 'imported', name: 'Imported', results: [], contexts: [], defaultPresetId: replacement.configuration.presetId });
    a.store.replace(replacement); t.mock.timers.tick(1000);
    b.store.replace(emptySnapshot()); b.store.flush();
    assert.deepEqual(names(storage.getItem(STORAGE_KEY)!), ['Imported']);
    a.store.clear(); t.mock.timers.tick(1000); b.store.flush();
    assert.equal(storage.getItem(STORAGE_KEY), null);
    assert.equal(b.store.durable, false);
  } finally { a.close(); b.close(); }
});

test('clear cancels the writer’s deferred save', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memory(), session = await connectNotesStore(storage, new Locks());
  try {
    add(session.store, 'Pending', true); session.store.clear();
    const writes = storage.writes; t.mock.timers.tick(1000);
    assert.equal(storage.writes, writes); assert.equal(storage.getItem(STORAGE_KEY), null);
  } finally { session.close(); }
});

test('missing/rejected coordination never writes, imports, or deletes shared storage', async () => {
  const rejected = { request: () => Promise.reject(new Error('denied')) } as Pick<LockManager, 'request'>;
  const throws = { request: () => { throw new Error('unavailable'); } } as Pick<LockManager, 'request'>;
  for (const locks of [undefined, rejected, throws]) {
    const storage = memory(); storage.values.set(STORAGE_KEY, JSON.stringify(emptySnapshot()));
    const session = await connectNotesStore(storage, locks);
    add(session.store, 'Memory', true); session.store.flush();
    assert.deepEqual(names(session.store.export()), ['Memory']);
    session.store.replace(emptySnapshot()); session.store.clear(); session.close();
    assert.equal(storage.writes, 0); assert.equal(session.store.durable, false);
    assert.ok(storage.getItem(STORAGE_KEY));
  }
});

test('external snapshot changes permanently revoke flush, replace, and clear permission', () => {
  for (const action of ['flush', 'replace', 'clear'] as const) {
    const storage = memory(), store = new NotesStore(storage);
    add(store, 'Pending', true);
    const other = JSON.stringify(emptySnapshot()); storage.values.set(STORAGE_KEY, other);
    if (action === 'replace') assert.throws(() => store.replace(emptySnapshot()), /not committed/);
    else store[action]();
    assert.equal(store.durable, false); assert.equal(store.canDeleteSavedData, false);
    assert.equal(storage.getItem(STORAGE_KEY), other);
    store.clear(); store.flush(); assert.equal(storage.getItem(STORAGE_KEY), other);
  }
});

test('corrupt data can be explicitly cleared only by the owning session', async () => {
  const storage = memory(), locks = new Locks(); storage.values.set(STORAGE_KEY, '{broken');
  const owner = await connectNotesStore(storage, locks), reader = await connectNotesStore(storage, locks);
  try {
    reader.store.clear(); assert.equal(storage.getItem(STORAGE_KEY), '{broken');
    owner.store.clear(); assert.equal(storage.getItem(STORAGE_KEY), null); assert.equal(owner.store.durable, true);
    add(owner.store, 'Recovered'); assert.deepEqual(names(storage.getItem(STORAGE_KEY)!), ['Recovered']);
  } finally { owner.close(); reader.close(); }
});

test('failed import preserves pending memory and persisted data', async () => {
  const storage = memory(), locks = new Locks(); let full = false;
  const session = await connectNotesStore({ ...storage, setItem(key, value) { if (full) throw new Error('quota'); storage.setItem(key, value); } }, locks);
  try {
    add(session.store, 'Saved'); const saved = storage.getItem(STORAGE_KEY);
    add(session.store, 'Pending', true); const pending = session.store.export(); full = true;
    assert.throws(() => session.store.replace(emptySnapshot()), /not committed/);
    assert.equal(session.store.export(), pending); assert.equal(storage.getItem(STORAGE_KEY), saved);
    session.store.flush(); assert.equal(session.store.durable, false);
    assert.equal(session.store.export(), pending);
  } finally { session.close(); }
});
