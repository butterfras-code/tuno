# tuNotes multi-tab storage — 2026-11-02

Replaces the lifetime writer lock and export/reload workflow with short IndexedDB transactions. Each tab can save independently. See the [storage contract](../architecture.md#tunotes-writer-ownership).

## Behavior and boundaries

- Answers update bounded memory only. Finish saves results and learning together. Partial checkpoints run after 20 answers, after 30 seconds with unsaved answers, and at lifecycle/activity boundaries.
- Checkpoints and Finish share one round ID, so partial saves do not create extra sessions. Partial results are marked interrupted and excluded from uninterrupted benchmarks.
- Concurrent tabs append their own observations and upsert their own results against the latest saved profile. A save reads/writes only affected profile records, plus small shared metadata.
- Import/clear changes the database generation. Old rounds cannot recreate replaced data, including imports with the same profile IDs. Deleted profiles remain deleted. A new profile added after another tab clears data still remembers progress after reload.
- Settings changes are field-level operations. Explicit configuration assignments persist even if the local value already matched, and saved-status acknowledgments wait for queued writes.
- Existing supported JSON backups migrate to schema 7 as before. Existing localStorage progress migrates automatically once into `tunotes-progress`; no account or manual export/import is needed. Already-open older builds should be closed during rollout because they continue using the old storage location.
- Storage errors retain exportable memory. The short saving notice keeps technical recovery controls inside a collapsed **Progress recovery** section. Normal multi-tab use has no warning.

## Automated validation

Node 24.22.1 and `npm ci` were used. `fake-indexeddb` 6.2.7 is a test-only dependency; application builds use native IndexedDB.

- `npm run check`: TypeScript, 562 tests, and hosted builds passed.
- Storage unit tests cover simultaneous same/different-profile saves, checkpoints, duplicate calls/retries, deletion, same-ID replacement, migration, failed saves/imports, synchronous transaction failure after clearing, shared-activity isolation, Guest behavior, and stale configuration defaults.
- `scripts/notes-storage-browser-check.mjs`: Chromium and Firefox passed real same-origin concurrent tabs, independent profile edits, overlapping results, synthetic pagehide/pageshow/freeze, real navigation away/back, deletion/import/clear, resumed saving, quota/denied/corrupt storage, recovery export and explicit corrupt-data recovery.
- Existing Stage 2 browser checks passed in Chromium and Firefox: profiles/results, backup replacement, online/cached-offline round trips, storage failures and notation fixtures.
- Existing adaptive and multiplayer browser checks passed in Chromium, including hosted/cached-offline operation, learning expansion, profile defaults, all roster sizes and playing formats.
- Activity-sharing checks passed in Chromium, including isolated defaults and transient custom ranges.
- The storage browser check captures setup, play, results and Options at all four primary viewport profiles, plus the retained 320px narrow fixture. Error/recovery layouts cover the same profiles; head-to-head recovery retains the 390px fixture. Screenshots were visually reviewed. The cross-app viewport smoke check also passed in Chromium.
- `git diff --check` and documentation link/content review passed.

Scripts read the committed IndexedDB records through `scripts/notes-storage-helpers.mjs` and wait for pending saves, rather than inspecting the obsolete localStorage copy or assuming click completion means a transaction committed.

## Performance evidence

The storage regression builds a roughly 2.75 MB snapshot with 32 profiles and 40 learning contexts per profile. For 20 answers it verifies that no database reads or writes occur synchronously. Finishing reads and writes exactly one profile record. One local run measured a median `observe()` call of 0.007 ms. This is host-only evidence, not a managed-Chromebook timing claim; rendering and the rest of answer handling are outside that timing.

## Evidence and remaining release checks

Browser reports/screenshots are under `dist/validation/notes-storage-{chromium,firefox}/`; other activity checks write their usual validation artifacts. A subsequent build replaces `dist/`.

No physical Chromebook, phone, Fold8, classroom-display, OS-suspension or real-browser-zoom acceptance was performed. Fold8 profiles remain provisional. Synthetic lifecycle events do not prove physical BFCache/freeze behavior. A crash or forced close may lose work since the last committed checkpoint, and lifecycle saves are best-effort. No active round is restored after a full reload.

Full release verification and Cloudflare preview review remain release steps. Nothing was integrated, pushed or published.
