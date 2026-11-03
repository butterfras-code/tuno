import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { connectNotesStore } from '../src/apps/tunotes/persistence/session.ts';
import { NotesStore, STORAGE_KEY, emptySnapshot, parseBackup } from '../src/apps/tunotes/persistence/store.ts';
import { openRepository } from '../src/apps/tunotes/persistence/database.ts';
import { Practice } from '../src/apps/tunotes/engine/practice.ts';
import { presets, fingerprint } from '../src/apps/tunotes/domain/presets.ts';
import type { Repository } from '../src/apps/tunotes/persistence/operations.ts';
const preset = presets[0]!;
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) { values.set(key, value); }, removeItem(key: string) { values.delete(key); } };
}
function add(store: NotesStore, id: string) {
  store.update(data => { data.profiles.push({ id, name: id, results: [], contexts: [], defaultPresetId: data.configuration.presetId }); data.configuration.profileId = id; data.configuration.remember = true; });
}
function round(store: NotesStore, id = 'Alice') { const game = new Practice(preset, true); store.beginRound(game, id); return game; }
function answer(store: NotesStore, game: Practice, id = 'Alice') {
  game.answer(game.token, game.pitch); store.observe(id, preset, game.last!, false, undefined, game); game.advance(game.token, true);
}
async function fixture() {
  const storage = memory(), factory = new IDBFactory();
  const a = await connectNotesStore(storage, undefined, factory), b = await connectNotesStore(storage, undefined, factory);
  const repository = await openRepository(factory, emptySnapshot);
  return { a: a.store, b: b.store, repository, storage, factory, async close() { await a.store.close(); await b.store.close(); repository.close(); } };
}

test('two tabs independently create profiles, edit different settings, and finish the same profile without loss', async () => {
  const f = await fixture();
  try {
    add(f.a, 'Alice'); add(f.b, 'Bob'); await Promise.all([f.a.flush(), f.b.flush()]);
    await Promise.all([f.a.refresh(), f.b.refresh()]);
    f.a.update(d => { d.profiles.find(p => p.id === 'Alice')!.name = 'Alicia'; });
    f.b.update(d => { d.profiles.find(p => p.id === 'Alice')!.preview = false; });
    const a = round(f.a), b = round(f.b);
    answer(f.a, a); answer(f.b, b); answer(f.b, b);
    a.finish(); b.finish(); f.a.record('Alice', a); f.b.record('Alice', b);
    await Promise.all([f.a.flush(), f.b.flush()]);
    const saved = (await f.repository.read()).data;
    assert.equal(saved.profiles.length, 2);
    const alice = saved.profiles.find(p => p.id === 'Alice')!;
    assert.equal(alice.name, 'Alicia'); assert.equal(alice.preview, false);
    assert.deepEqual(alice.results.map(r => r.attempts).sort(), [1, 2]);
    assert.equal(Object.values(alice.contexts[0]!.notes).flat().length, 3);
    assert.equal(f.a.durable, true); assert.equal(f.b.durable, true);
  } finally { await f.close(); }
});

test('answers stay in memory; checkpoints and finish upsert one result and never duplicate observations', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = await fixture();
  try {
    add(f.a, 'Alice'); await f.a.flush(); const game = round(f.a);
    answer(f.a, game);
    assert.equal((await f.repository.read()).data.profiles[0]!.results.length, 0);
    t.mock.timers.tick(30_000); await f.a.flush();
    let saved = (await f.repository.read()).data.profiles[0]!;
    assert.equal(saved.results.length, 1); assert.equal(saved.results[0]!.interrupted, true);
    for (let i = 0; i < 20; i++) answer(f.a, game);
    t.mock.timers.tick(0); await f.a.flush();
    saved = (await f.repository.read()).data.profiles[0]!;
    assert.equal(saved.results.length, 1); assert.equal(saved.results[0]!.attempts, 21);
    game.finish(); f.a.record('Alice', game); f.a.record('Alice', game); await f.a.flush();
    saved = (await f.repository.read()).data.profiles[0]!;
    assert.equal(saved.results.length, 1); assert.equal(saved.results[0]!.attempts, 21); assert.equal(saved.results[0]!.interrupted, false);
  } finally { await f.close(); }
});

test('deleting a profile while another tab plays cannot resurrect it or remove another profile', async () => {
  const f = await fixture();
  try {
    add(f.a, 'Alice'); add(f.a, 'Bob'); await f.a.flush(); await f.b.refresh();
    const game = round(f.b); answer(f.b, game);
    f.a.update(d => { d.profiles = d.profiles.filter(p => p.id !== 'Alice'); }); await f.a.flush();
    game.finish(); f.b.record('Alice', game); await f.b.flush();
    assert.deepEqual((await f.repository.read()).data.profiles.map(p => p.id), ['Bob']);
    assert.equal(f.b.durable, true);
  } finally { await f.close(); }
});

test('import and clear invalidate old rounds, including imports retaining identical profile IDs', async () => {
  const f = await fixture();
  try {
    add(f.a, 'Alice'); await f.a.flush(); await f.b.refresh();
    const game = round(f.b); answer(f.b, game);
    const replacement = parseBackup(f.a.export()); replacement.profiles[0]!.name = 'Imported';
    await f.a.replace(replacement);
    answer(f.b, game); game.finish(); f.b.record('Alice', game); await f.b.flush();
    let saved = (await f.repository.read()).data;
    assert.equal(saved.profiles[0]!.name, 'Imported'); assert.equal(saved.profiles[0]!.results.length, 0); assert.equal(saved.profiles[0]!.contexts.length, 0);
    await f.b.refresh(); const later = round(f.b); answer(f.b, later);
    await f.a.clear(); later.finish(); f.b.record('Alice', later); await f.b.flush();
    saved = (await f.repository.read()).data; assert.equal(saved.profiles.length, 0);
    await f.b.refresh(); add(f.b, 'New'); await f.b.flush(); assert.equal((await f.repository.read()).data.profiles[0]!.name, 'New');
  } finally { await f.close(); }
});

test('repository retries are idempotent and a checkpoint can be replaced by its final result', async () => {
  const f = await fixture();
  try {
    add(f.a, 'Alice'); await f.a.flush(); const game = round(f.a); answer(f.a, game); game.finish(); f.a.record('Alice', game); await f.a.flush();
    const state = await f.repository.read(), result = state.data.profiles[0]!.results[0]!;
    const operation = { id: 'retry', generation: state.generation, mutation: { kind: 'result' as const, profileId: 'Alice', roundId: 'unique-round', result } };
    await f.repository.commit([operation]); await f.repository.commit([operation]);
    assert.equal((await f.repository.read()).data.profiles[0]!.results.length, 2);
  } finally { await f.close(); }
});

test('migration is automatic, once-only and preserves legacy data on failure', async () => {
  const storage = memory(), legacy = new NotesStore(storage); add(legacy, 'Legacy');
  const factory = new IDBFactory();
  const session = await connectNotesStore(storage, undefined, factory);
  assert.equal(session.store.data.profiles[0]!.name, 'Legacy');
  await session.store.clear(); await session.store.close();
  const reopened = await connectNotesStore(storage, undefined, factory);
  assert.equal(reopened.store.data.profiles.length, 0); await reopened.store.close();
  storage.setItem(STORAGE_KEY, '{broken');
  const broken = await connectNotesStore(storage, undefined, new IDBFactory());
  assert.equal(broken.store.durable, false); assert.equal(storage.getItem(STORAGE_KEY), '{broken'); broken.close();
});

test('failed transactions and failed import retain memory and the last committed data', async () => {
  const f = await fixture();
  try {
    add(f.a, 'Alice'); await f.a.flush();
    const state = await f.repository.read();
    const failing: Repository = { ...f.repository, commit: async () => { throw new Error('quota'); }, replace: async () => { throw new Error('quota'); } };
    f.a.useRepository(failing, state);
    await assert.rejects(async () => f.a.replace(emptySnapshot()), /quota/);
    assert.equal(f.a.data.profiles[0]!.name, 'Alice');
    const game = round(f.a); answer(f.a, game); game.finish(); f.a.record('Alice', game); await f.a.flush();
    assert.equal(f.a.durable, false); assert.equal(parseBackup(f.a.export()).profiles[0]!.results.length, 1);
    assert.equal((await f.repository.read()).data.profiles[0]!.results.length, 0);
  } finally { await f.close(); }
});

test('shared links do not save transient settings or transient preset progress', async () => {
  const f = await fixture();
  try {
    add(f.a, 'Alice'); await f.a.flush(); f.a.beginSharedSession();
    f.a.update(d => { d.configuration.continueAfter = 'correct'; });
    const game = round(f.a); answer(f.a, game); game.finish(); f.a.record('Alice', game); await f.a.flush();
    const data = (await f.repository.read()).data;
    assert.equal(data.configuration.continueAfter, undefined); assert.equal(data.profiles[0]!.results.length, 1);
  } finally { await f.close(); }
});

test('Guest answers never queue durable progress', async () => {
  const f = await fixture();
  try {
    const game = new Practice(preset, true); f.a.beginRound(game); game.answer(game.token, game.pitch);
    f.a.observe(undefined, preset, game.last!, false, undefined, game); game.finish(); f.a.record(undefined, game); await f.a.flush();
    assert.deepEqual((await f.repository.read()).data, emptySnapshot());
  } finally { await f.close(); }
});


test('a round save touches only its profile; unrelated history does not enter the answer path', async t => {
  const f = await fixture();
  try {
    const data = emptySnapshot();
    const contexts = presets.slice(0, 40).map(preset => {
      const game = new Practice(preset, true); game.answer(game.token, game.pitch);
      const label = `${game.pitch.letter}${game.pitch.accidental === 1 ? '♯' : game.pitch.accidental === -1 ? '♭' : ''}${game.pitch.octave}`;
      return { fingerprint: fingerprint(preset), version: 1 as const, updated: Date.now(), notes: { [label]: Array.from({ length: 10 }, () => game.last!) } };
    });
    for (let i = 0; i < 32; i++) data.profiles.push({ id: `p${i}`, name: `Player ${i}`, results: [], contexts: structuredClone(contexts), defaultPresetId: preset.id });
    await f.a.replace(data);
    const reads: unknown[] = [], writes: unknown[] = [];
    const originalGet = IDBObjectStore.prototype.get, originalPut = IDBObjectStore.prototype.put;
    t.mock.method(IDBObjectStore.prototype, 'get', function(this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      if (this.name === 'profiles') reads.push(key); return originalGet.call(this, key);
    });
    t.mock.method(IDBObjectStore.prototype, 'put', function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'profiles') writes.push(key); return originalPut.call(this, value, key);
    });
    const game = round(f.a, 'p0'), samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      game.answer(game.token, game.pitch);
      const start = performance.now(); f.a.observe('p0', preset, game.last!, false, undefined, game); samples.push(performance.now() - start);
      game.advance(game.token, true);
    }
    assert.deepEqual(reads, []); assert.deepEqual(writes, [], 'no synchronous database work during answers');
    game.finish(); f.a.record('p0', game); await f.a.flush();
    assert.deepEqual(reads, ['p0']); assert.deepEqual(writes, ['p0']);
    t.diagnostic(`${new TextEncoder().encode(JSON.stringify(data)).length} bytes of unrelated-history fixture; observe median ${samples.sort((a,b) => a-b)[10]!.toFixed(3)} ms on this host (not a Chromebook measurement)`);
  } finally { await f.close(); }
});

test('settings edits between checkpoints retain one in-memory result and one durable result', async () => {
  const f = await fixture();
  try {
    add(f.a, 'Alice'); await f.a.flush(); const game = round(f.a); answer(f.a, game); await f.a.flush();
    f.a.update(d => { d.configuration.continueAfter = 'correct'; });
    answer(f.a, game); game.finish(); f.a.record('Alice', game); await f.a.flush();
    assert.equal(parseBackup(f.a.export()).profiles[0]!.results.length, 1);
    assert.equal((await f.repository.read()).data.profiles[0]!.results.length, 1);
  } finally { await f.close(); }
});


test('replacement aborts atomically if a write throws after clearing the transaction', async t => {
  const f = await fixture();
  try {
    add(f.a, 'Alice'); await f.a.flush();
    const candidate = parseBackup(f.a.export()); candidate.profiles[0]!.name = 'Replacement';
    const put = IDBObjectStore.prototype.put;
    t.mock.method(IDBObjectStore.prototype, 'put', function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'meta') throw new DOMException('full', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await assert.rejects(async () => f.a.replace(candidate), /full/);
    assert.equal((await f.repository.read()).data.profiles[0]!.name, 'Alice');
    assert.equal(f.a.data.profiles[0]!.name, 'Alice');
  } finally { await f.close(); }
});


test('explicit profile selection persists even when its local setting already matches', async () => {
  const f = await fixture();
  try {
    add(f.a, 'Alice'); await f.a.flush(); await f.b.refresh();
    f.b.update(d => { d.configuration.remember = true; }); await f.b.flush();
    f.a.update(d => { d.configuration.remember = false; }); await f.a.flush();
    add(f.b, 'Bob'); await f.b.flush();
    assert.equal((await f.repository.read()).data.configuration.remember, true);
    await f.a.clear(); await f.b.refresh();
    assert.equal(f.b.data.configuration.remember, false, 'a replacement generation resets stale setup defaults');
    add(f.b, 'Fresh'); await f.b.flush();
    assert.equal((await f.repository.read()).data.configuration.remember, true);
  } finally { await f.close(); }
});
