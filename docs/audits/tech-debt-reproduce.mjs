// Run from the repository root with Node 24.22.1:
// node docs/audits/tech-debt-reproduce.mjs
// Uses synthetic data and memory storage only; does not modify application data.
import assert from 'node:assert/strict';
import { NotesStore, STORAGE_KEY, emptySnapshot, parseBackup } from '../../src/apps/tunotes/persistence/store.ts';
import { presets, fingerprint } from '../../src/apps/tunotes/domain/presets.ts';
import { pitchLabel } from '../../src/apps/tunotes/domain/notation.ts';

const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
const a = new NotesStore(storage), b = new NotesStore(storage);
a.update(data => data.profiles.push({ id: 'alice', name: 'Alice', results: [], contexts: [], defaultPresetId: data.configuration.presetId }));
b.update(data => { data.configuration.showKeySignature = true; });
const saved = JSON.parse(storage.getItem(STORAGE_KEY));
assert.equal(saved.profiles.length, 0); // Confirms the audited defect, not desired behavior.
assert.equal(a.data.profiles[0].id, 'alice');
console.log(JSON.stringify({ reproduction: 'stale tab overwrites newer profile', savedProfiles: saved.profiles, staleWriterReportsDurable: b.durable }));

const data = emptySnapshot();
const contexts = presets.slice(0, 20).map(preset => ({
  fingerprint: fingerprint(preset), version: 1, updated: 1,
  notes: Object.fromEntries(preset.pool.slice(0, 8).map(pitch => [pitchLabel(pitch), Array.from({ length: 10 }, () => ({
    pitch, answer: { letter: pitch.letter, accidental: pitch.accidental }, correct: true,
    responseMs: 500, activity: 'practice', preset: preset.id,
  }))])),
}));
for (let i = 0; i < 16; i++) data.profiles.push({ id: `p${i}`, name: `Player ${i}`, results: [], contexts: structuredClone(contexts), defaultPresetId: data.configuration.presetId });
const raw = JSON.stringify(data);
parseBackup(raw); // Reject a fixture above the actual import size limit.
const store = new NotesStore({ getItem: () => raw, setItem: () => {}, removeItem: () => {} });
assert.equal(store.durable, true);
assert.equal(store.data.profiles.length, 16);
const samples = [];
for (let i = 0; i < 7; i++) {
  const start = performance.now();
  store.update(snapshot => { snapshot.configuration.showKeySignature = !snapshot.configuration.showKeySignature; }, true);
  samples.push(performance.now() - start);
}
store.flush();
console.log(JSON.stringify({ benchmark: 'synchronous update, no-op storage writes', bytes: Buffer.byteLength(raw), profiles: 16, contextsPerProfile: 20, samplesMs: samples, medianMs: [...samples].sort((x, y) => x - y)[3] }));
