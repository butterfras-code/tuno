# Distribution architecture

## PWA distribution

Serve the tools from the official HTTPS site. Standalone HTML downloads are retired: the build produces no `dist/portable/`, versioned HTML downloads, download metadata or portable checksums. Previously saved copies cannot be revoked. Historical specs and validation reports describe the former delivery format; this decision supersedes those distribution requirements.

Tuner, Tone and Tempo share the tUno PWA (manifest identity `/`, start URL `/tune/`, scope `/`). tuNotes and Uno234 have independent manifests, identities, icons and workers under `/notes/` and `/rhythm/`. The launcher links the tUno manifest. All tools use the same underlined footer Install control and shared modal. The control opens the captured browser install prompt directly from a user click when available; cancellation or failure returns to the shared modal. Without a native prompt, the modal opens immediately with menu guidance and an address-bar icon example. Installation never switches the active practice view to Options. Installed-window detection suppresses redundant install actions. A simulated prompt is not evidence of an OS installation.

## Offline use and updates

An initial online visit is required. Each tool reports **Offline ready** only when its controlling worker confirms the expected app identity, content version and complete essential cache. Installation alone is not an offline-readiness guarantee. Cache removal or device policy can require another online visit. Core practice, fonts and artwork need no remote runtime assets.

Workers atomically cache resources against generated SHA-256 integrity values. Cache names include application ID, registration scope and version. Each worker deletes only its own obsolete caches. Updates wait for all existing controlled tabs to close; there is no forced reload or `skipWaiting`. Missing or failed cache preparation remains explicit. Development builds disable offline preparation.

The suite worker caches the launcher, Tone/Tempo aliases and rhythm resources so the launcher remains useful offline. Directory workers retain their own caches and verification. The old root worker remains as a retirement path for older installations. Legacy rhythm URLs still load the canonical assets. See [hosting](hosting.md) for migration details.

## Shared implementation and local data

One build pipeline packages all three applications, with per-app entry/template, identity, directory and resource checksums. `dist/release.json.apps` records `tuno`, `tunotes` and `rhythm`; legacy top-level tUno metadata remains available. Deploy the complete hosted directory atomically.

Shared Uno artwork, fonts, DOM controls and cleanup live in `src/shared/ui/`. Each app owns its practice state; tuNotes does not import tuner audio or policy. Tuner/Tone/Tempo share a mounted store and use History API navigation. Musical rules and timing remain independent of distribution.

Preferences and student records stay in browser storage. tuNotes JSON export/import remains available online and offline, with validation before replacement. Clearing site data can remove both records and offline caches; a PWA installation is not a data backup.

One application-owned AudioContext serves capture, tone, and metronome. A 70 ms foreground analysis timer feeds 4,096-sample frames to the adapted detector. A separate 25 ms scheduler places synthesized clicks up to 150 ms ahead on the audio clock. Animation frames only read that timeline for beat identity; they do not schedule audio. Tempo/subdivision changes apply at beat boundaries, and meter changes begin a new bar there. Missed scheduling beyond the allowed lateness stops the metronome for explicit recovery. No background-playback guarantee is made.

## Validation

Check artifact checksums and manifest identities/icons; assert that no standalone HTML artifacts or download controls remain. Exercise native-prompt acceptance, dismissal and failure, menu fallback, installed-window behavior, accessible focus and narrow layouts. Run core practice and backup round trips after online preparation with networking disabled. Retain update deferral, cache failure and cross-app isolation checks. Physical browser installation, managed-school policies, microphones and device reopening still require manual acceptance. See [release instructions](releasing.md).

## tuNotes Practice (Stage 1)

`src/apps/tunotes/domain/` owns explicitly spelled pitches, diatonic staff coordinates, clefs, C-major key identity and finite preset normalization. It does not use the tuner’s preferred chromatic names. Six frozen pools cover treble/bass staff Lines, Spaces and Lines + Spaces; all four planned clefs have tested natural-position anchors. Original vector clefs and whole-note geometry are bundled directly by `ui/staff.ts`, with exterior ledger geometry derived from diatonic position. Rendering never decides an answer.

`engine/practice.ts` owns session/prompt IDs, shuffled bags, answer locking, response records and pause-aware active time. The clock and randomness are injected. Each accepted answer locks its prompt: correct feedback lasts 250 ms and incorrect feedback lasts 800 ms; the self-paced option waits for Continue. Pausing preserves prompt/feedback time and requires explicit Resume. Finish freezes statistics. No storage or audio controller is imported.

`ui/practice-view.ts` keeps A–G buttons mounted across prompts, consumes physical key presses, captures pointer prompt tokens, and rejects queued events from before a new prompt or Resume. Global shortcuts leave editable controls alone. Visibility loss pauses play. Removing the view disposes its interval, document listeners and shared Uno renderer. `engine/progress.ts` supplies positive, once-per-run milestones against the frozen default benchmark of 10; tuner feedback remains separate. Stage 2 will add history-dependent benchmarks and full key/accidental rendering.

The staff’s accessible description identifies clef, C major and position without naming the target before feedback. This offers a positional alternative, not equivalent nonvisual music reading. Browser automation covers focus, 44-pixel controls, responsive layouts, 200% zoom and reduced motion; screen-reader and physical-device acceptance remain manual.

## tuNotes presets and local progress (Stage 2)

`domain/presets.ts` expands explicit written positions, content, key and accidental policies into finite unique pools. Built-in clef presets and teacher-reviewed instrument Starters share this normalization with Custom. Instrument transposition metadata is independent of letter-answer spelling. `ui/staff.ts` uses original vector accidental glyphs and clef-specific signature placement tables; note accidentals cancel or alter the signature independently on every prompt.

`persistence/store.ts` owns the `tunotes:data:v1` snapshot and strict backup validation/migration. Guest has no persisted observations or results. Named profiles have bounded versioned pitch observations and summaries; comparison fingerprints include preset ID/version, clef, key, policy, exact spelled pool, activity, adaptive toggle and input method. Uno freezes its benchmark at session start using the last five uninterrupted comparable sessions reaching 20 answers. Practice records the first-20 correct count separately from unbounded-session aggregate totals.

Setup saves configuration and Custom definitions independently of progress. Answer observations update memory immediately and debounce storage writes; Finish, visibility loss and disposal flush pending saves. Import validates before replacement and writes once before changing memory; failure preserves both previous snapshots. Corrupt/blocked/full storage uses memory with an explanation and export. No active game is restored. Export is compact JSON capped at 5 MiB through bounded records and oldest-history pruning. See [Stage 2 validation](validation/tunotes-stage2.md).

### tuNotes writer ownership

`persistence/session.ts` acquires an exclusive Web Lock named `tunotes:data:v1:writer` before loading the writable snapshot. One mounted tab owns saving for that session. Other tabs read the saved snapshot once and can practice with exportable in-memory data; they cannot flush, import into, or delete shared storage. They never automatically take over. The Saving status notice remains available across modes, with export and an explicitly confirmed reload. After closing the saving tab, reload another tab to read fresh saved data and request ownership.

Normal writes, deferred flushes, backup replacement and deletion all occur under that same held lock. `NotesStore` also compares the current stored value with its last observed value before writes/deletion, revoking saving if an external change is detected. This comparison detects stale data; the [Web Lock](https://www.w3.org/TR/web-locks/) supplies mutual exclusion. Direct `NotesStore` adapters are for already-coordinated storage and synchronous unit fixtures; browser code must use `connectNotesStore`.

Page hiding for navigation (`pagehide`), page freezing, and unmount flush pending data before releasing ownership and permanently revoke that snapshot’s write permission. Ordinary visibility loss flushes but retains ownership. A restored page remains memory-only until reload. Missing or rejected lock support also uses memory-only mode; there is no localStorage lock flag or uncoordinated fallback. Corrupt data may still be explicitly deleted by the owner. A tab without ownership can delete only its own in-memory copy. Abrupt browser termination can still lose the existing 400 ms of deferred work; this change does not promise crash-proof storage.

The storage key and schema-4 backup format are unchanged; existing supported backups load without a new migration. Coordination applies to tabs running this implementation. Older already-open builds do not honor its lock: close those tabs when adopting the update. The external-value check cannot make writes by old code atomic, and old code may still overwrite data after a new tab’s save.

Regression checks: `tests/tunotes-storage.test.ts` and `scripts/notes-storage-browser-check.mjs` (Chromium and Firefox, included in `verify`). Browser scenarios use real same-origin tabs and include simultaneous startup, stale edits, import/deletion, export/reload, lifecycle handlers, and storage/coordination failure. Synthetic lifecycle events do not establish physical mobile suspension or BFCache support.

### Graphical preset configuration

`ui/preset-picker.ts` owns the modal Clef/Instrument → selection → level flow. `ui/range-editor.ts` maps SVG coordinates and keyboard steps to explicit written endpoints; `ui/custom-configurator.ts` coordinates linked endpoint clefs, explicit available clefs, independent modifiers and derived ledger descriptions. These controls use the existing staff renderer and theme tokens.

New Custom definitions use `editorVersion: 2`. Normalization unions enabled modifier spellings, intersects inclusive chromatic endpoints and written positions, assigns each pitch to its most readable enabled clef, then applies Lines/Spaces. `clefForPitch` is shared by normalization, summaries and practice rendering. Disabling Key removes its signature but retains the saved key choice. The backup schema is now 2 under the existing `tunotes:data:v1` storage key; schema 0/1 migrate on a copy, preserving existing profiles, history and legacy range policies. New comparison fingerprints append versioned clef/modifier identity. Older custom definitions retain their semantics until opened in the graphical editor, which converts their effective clipped extent to endpoints.
