# tuNotes single-writer storage — 2026-10-26

Fixes audit issue 01: one tab’s stale snapshot could overwrite a profile or progress saved by another tab. The [ownership contract](../architecture.md#tunotes-writer-ownership) explains the lock, memory-only recovery, lifecycle handling, and compatibility limit for already-open older builds.

The saved-data key and schema-4 backup format are unchanged. A tab that cannot own saving can practice and export its local state. It cannot alter shared data, even through import, deletion, a deferred flush, or after the owner closes. Explicit reload reads the current saved snapshot before requesting a new writable session.

## Validation

- Node 24.22.1, `npm ci`.
- `npm run check`: TypeScript, 468 unit tests, and hosted builds passed.
- After final cleanup: TypeScript, all nine storage-specific unit tests, and the build passed again.
- `scripts/notes-storage-browser-check.mjs`: Chromium and Firefox passed six groups covering real same-origin tabs, concurrent startup, stale settings and progress, import/deletion, export/reload, lifecycle revocation, and storage/lock failures. Recovery controls were exercised at 320px and during head-to-head play at 390px.
- Existing `scripts/notes-stage2-browser-check.mjs`: Chromium and Firefox passed profile persistence, backup round trips, cached offline operation, and denied/corrupt/quota-storage checks.
- Existing `scripts/notes-multiplayer-browser-check.mjs`: Chromium and Firefox passed hosted and cached-offline multiplayer checks, including profile defaults, input isolation, pause/retry, and phone/tablet layouts.
- `git diff --check` passed.

The new browser regression is registered in `npm run test:browser` and `npm run verify`. To run it independently after a build:

```sh
node scripts/notes-storage-browser-check.mjs
TUNO_BROWSER=firefox node scripts/notes-storage-browser-check.mjs
```

Reports and screenshots are under `dist/validation/notes-storage-{chromium,firefox}/`. The final browser fixture used tuNotes build `f936b1e8d3096d61`, based on revision `0915969fbbeff23dbbe0f4b5b6c6cb2724b5b5da` with local changes. A subsequent build replaces `dist/` and its reports.

Full release verification, physical devices, OS suspension, and physical BFCache acceptance were not performed. Lifecycle regression uses synthetic `pagehide`/`pageshow` and `freeze` events plus real navigation away and back; it does not assert that a particular browser restored a page from BFCache. The existing deferred-save window can still lose recent work if the browser is abruptly terminated. No publication or branch integration occurred.
