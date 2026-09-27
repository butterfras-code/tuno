# Distribution architecture

## Decision

Maintain two releases in parallel from shared source: a hosted, downloadable app and an offline-only portable HTML file. Both are required delivery formats for the core tuner, metronome, and reference tones. Both artifacts and hosted caching are implemented; physical-device verification remains ahead.

## Hosted app

Serve the app over HTTPS with offline caching of all essential resources. Users can practice in the browser without an account, optionally install it where the browser supports installation, and download the portable HTML release directly from the site. Indicate offline readiness only after the required resources are available locally.

The first hosted visit requires connectivity. After preparation, verify offline reopening and core operation. Updates must not interrupt an active practice session. Keep audio processing and preferences local.

## Portable HTML

Produce one self-contained HTML file that opens directly under `file://`. Bundle code, styles, fonts, sounds, and any audio-processing resources. Require no server, installation, service worker, adjacent files, runtime downloads, or internet connection. Distribute updates as replacement downloads.

The portable release must remain usable without ever visiting the hosted app. Test it with networking disabled and ordinary browser security settings, including physical microphone access. Do not require users to disable browser security or launch with special flags. Record any platform limitations explicitly.

## Shared implementation

Keep musical rules, timing, controls, and feedback shared across both builds. Isolate distribution-specific resource loading, caching, and update behavior behind small adapters. Hosted caching must not become a dependency of the portable build. Maintain equivalent core musical behavior and version both artifacts together.

Separate pitch evidence from display smoothing and teacher scoring. Schedule metronome audio independently of interface rendering, and derive visual beat identity from the same musical timeline. Decide worker/worklet use through profiling and verification in both distribution formats.

## Local data

Preferences and future student records belong to browser storage, not the downloaded HTML itself. Moving or renaming a file may change its storage context. Provide explicit export/import for portable data; opening another build must not silently transfer or overwrite records. Cached hosted resources can also be removed by browser or device policy.

## Release checks

- Build both artifacts from the same source revision.
- Exercise core musical behavior in both formats, including meter, beat identity, and subdivisions.
- Verify hosted offline reopening and portable first launch without networking.
- Check portable packaging for external resource dependencies.
- Test microphone permissions, interruptions, and real input on supported Chromium, WebKit/Safari, and Firefox devices.
- Publish measured limitations and launch instructions alongside releases.

## Implemented execution and update model

One application-owned AudioContext serves capture, tone, and metronome. A 70 ms foreground analysis timer feeds 4,096-sample frames to the adapted detector. A separate 25 ms scheduler places synthesized clicks up to 150 ms ahead on the audio clock. Animation frames only read that timeline for beat identity; they do not schedule audio. Tempo/subdivision changes apply at beat boundaries, and meter changes begin a new bar there. Missed scheduling beyond the allowed lateness stops the metronome for explicit recovery. No background-playback guarantee is made.

Production hosted builds generate a service worker and content-derived version, shared with portable HTML metadata. Installation atomically caches the essential HTML/JS/CSS using generated SHA-256 integrity values. Cache names include registration scope and version. Activation deletes only older caches for that scope. Workers never call skipWaiting: every existing application tab must close before an update activates, preserving concurrent practice across tabs. There is no forced page reload. The first worker claims the page after installation.

The page reports readiness only when its controlling worker confirms all required cache entries and the matching version. Missing entries can be repaired online with integrity checks; failed preparation and verification stay explicit. Portable files exit before worker registration, and development builds disable registration. No runtime remote assets or sound files are needed.

Validation results and remaining device limitations belong in the prototype plan.

## Release candidate packaging

Hosted builds include a relative-scope web manifest, 192/512px PNG app icons derived from approved Uno artwork, and a versioned download identical to the independent portable artifact. These files join the integrity-checked offline cache. Portable HTML includes no hosted manifest/download links and never registers a worker. Both HTML formats display shared release/build identifiers; `dist/release.json` ties the artifact checksums to source revision and working-tree status.

Native install UI is exposed only after a browser install event; menu guidance remains available elsewhere. All audio pauses on page hiding and requires explicit restart. See release validation for automated results and hardware gaps, and release instructions for the atomic-deployment handoff.

## tuNotes shared foundation (Stage 0)

The same build pipeline now packages tUno at `dist/hosted/` and tuNotes at `dist/hosted/notes/`, plus independent `tuno.html` and `tunotes.html` portable files. App descriptors select entry/template, identity, hosted directory and excluded child paths. Build output is cleared once. `dev` retains tUno behavior; `dev:notes` serves the Practice preview at `/notes/` with offline preparation disabled.

Shared Uno renderer/pose types, Uno styles, embedded fonts, generic DOM helpers, and unmount cleanup live in `src/shared/ui/`. Assets and tokens are reused in place. The compatibility export at `src/ui/uno.ts` preserves existing imports. Tuner feedback and audio/state policy remain tUno-specific; tuNotes imports none of them. Uno disposal removes its media-query listener and cancels animations; removal also stops tuner feedback frames and pet tempo subscriptions/listeners.

Both manifests use relative identities resolving to distinct app roots, including under nested prefixes. Cache names include app ID, scope URL, and content build. Only a worker’s own obsolete caches are deleted. The root worker explicitly excludes `notes/` and only serves its enumerated files; missing resources receive no HTML fallback. Readiness verifies worker URL, app ID and build, so a root-controlled first visit cannot claim tuNotes is ready. Integrity precaching and deferred update activation apply independently to both apps.

The release manifest retains legacy tUno fields and adds an `apps` map with separate checksums/build IDs and common release/source metadata. Each portable bundle includes shared source independently and needs no sibling file. tuNotes provides Practice with optional local profiles and backup and remains absent from tUno navigation. This is a local preview, not publication or classroom acceptance.


## tuNotes Practice (Stage 1)

`src/apps/tunotes/domain/` owns explicitly spelled pitches, diatonic staff coordinates, clefs, C-major key identity and finite preset normalization. It does not use the tuner’s preferred chromatic names. Six frozen pools cover treble/bass staff Lines, Spaces and Lines + Spaces; all four planned clefs have tested natural-position anchors. Original vector clefs and whole-note geometry are bundled directly by `ui/staff.ts`, with exterior ledger geometry derived from diatonic position. Rendering never decides an answer.

`engine/practice.ts` owns session/prompt IDs, shuffled bags, answer locking, response records and pause-aware active time. The clock and randomness are injected. Each accepted answer locks its prompt: correct feedback lasts 250 ms and incorrect feedback lasts 800 ms; the self-paced option waits for Continue. Pausing preserves prompt/feedback time and requires explicit Resume. Finish freezes statistics. No storage or audio controller is imported.

`ui/practice-view.ts` keeps A–G buttons mounted across prompts, consumes physical key presses, captures pointer prompt tokens, and rejects queued events from before a new prompt or Resume. Global shortcuts leave editable controls alone. Visibility loss pauses play. Removing the view disposes its interval, document listeners and shared Uno renderer. `engine/progress.ts` supplies positive, once-per-run milestones against the frozen default benchmark of 10; tuner feedback remains separate. Stage 2 will add history-dependent benchmarks and full key/accidental rendering.

The staff’s accessible description identifies clef, C major and position without naming the target before feedback. This offers a positional alternative, not equivalent nonvisual music reading. Browser automation covers focus, 44-pixel controls, responsive layouts, 200% zoom and reduced motion; screen-reader and physical-device acceptance remain manual.

## tuNotes presets and local progress (Stage 2)

`domain/presets.ts` expands explicit written positions, content, key and accidental policies into finite unique pools. Built-in clef presets and teacher-reviewed instrument Starters share this normalization with Custom. Instrument transposition metadata is independent of letter-answer spelling. `ui/staff.ts` uses original vector accidental glyphs and clef-specific signature placement tables; note accidentals cancel or alter the signature independently on every prompt.

`persistence/store.ts` owns the `tunotes:data:v1` snapshot and strict backup validation/migration. Guest has no persisted observations or results. Named profiles have bounded versioned pitch observations and summaries; comparison fingerprints include preset ID/version, clef, key, policy, exact spelled pool, activity, adaptive toggle and input method. Uno freezes its benchmark at session start using the last five uninterrupted comparable sessions reaching 20 answers. Practice records the first-20 correct count separately from unbounded-session aggregate totals.

Setup saves configuration and Custom definitions independently of progress. Answer observations update memory immediately and debounce storage writes; Finish, visibility loss and disposal flush pending saves. Import validates before replacement and writes once before changing memory; failure preserves both previous snapshots. Corrupt/blocked/full storage uses memory with an explanation and export. No active game is restored. Export is compact JSON capped at 5 MiB through bounded records and oldest-history pruning. See [Stage 2 validation](validation/tunotes-stage2.md).

### Graphical preset configuration

`ui/preset-picker.ts` owns the modal Clef/Instrument → selection → level flow. `ui/range-editor.ts` maps SVG coordinates and keyboard steps to explicit written endpoints; `ui/custom-configurator.ts` coordinates linked endpoint clefs, explicit available clefs, independent modifiers and derived ledger descriptions. These controls use the existing staff renderer and theme tokens.

New Custom definitions use `editorVersion: 2`. Normalization unions enabled modifier spellings, intersects inclusive chromatic endpoints and written positions, assigns each pitch to its most readable enabled clef, then applies Lines/Spaces. `clefForPitch` is shared by normalization, summaries and practice rendering. Disabling Key removes its signature but retains the saved key choice. The backup schema is now 2 under the existing `tunotes:data:v1` storage key; schema 0/1 migrate on a copy, preserving existing profiles, history and legacy range policies. New comparison fingerprints append versioned clef/modifier identity. Older custom definitions retain their semantics until opened in the graphical editor, which converts their effective clipped extent to endpoints.
