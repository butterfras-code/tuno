# tuNotes Stage 2 validation

This records the original Stage 2 preview. The subsequent [in-phase answer-entry update](tunotes-input.md) replaces its accidental dropdown and has separate evidence.

Implemented locally on `t3code/create-note-reading-game`, 2026-09-27, in the existing worktree as requested. Source revision `24ff7dbd79060a889565afd39c1a9bf8af4ce2f2` plus working changes (`dirty: true`). This is a Practice preview, not a production release.

## Scope and teacher decisions

Stage 2 adds 44 clef presets (staff and ledger envelopes across treble/bass/alto/tenor), 11 instrument Starters, 15 major signatures, four accidental policies, Custom preview/save, optional named profiles, stored configurations, bounded observations/results, contextual Uno benchmarks and local JSON backup/replacement/deletion.

The teacher supplied revised starting ranges and written keys in this task. Flute/oboe use F major, F4–C5; bassoon F major, F2–C3; clarinet/trumpet C major, C4–G4 (sounding B♭3–F4); alto saxophone G major, G4–D5 (sounding B♭3–F4); horn C major, C4–G4 (sounding F3–C4); trombone/euphonium B♭ major, B♭2–F3; tuba B♭ major, B♭1–F2; keyboards C major, C4–G4. The saxophone interval identifies alto saxophone. New oboe/bassoon/keyboard expansion bounds remain at their starter range pending Stage 3 review; existing wider envelopes remain proposed.

## Automated evidence

Node 24.21.0 and `npm ci`; `npm run check` passes type checking, 56 unit tests and both builds. `git diff --check` passes.

- Domain tests exhaust the four clefs, 15 signatures and accidental policies against exact spelled pools; verify every catalog envelope and teacher-provided sounding range, B♯/C♭ octave identity, enharmonic answer distinction and empty Custom intersections.
- Persistence tests cover schema migration, invalid fields/types/references, malformed/oversized/future backups, failed replacement preserving old memory and storage, corrupt/denied/full storage, Guest isolation, profile/history/context/outcome limits, LRU pruning, interrupted-session exclusion and last-five first-20 benchmarks. Long sessions retain aggregate totals while bounding raw observations.
- Chromium and Firefox `scripts/notes-browser-check.mjs`: hosted offline and relocated portable Practice; input lock/held/stale events; pause/resume; results/retry; keyboard, touch emulation in Chromium, reduced motion, focus, zoom and lifecycle cleanup.
- Chromium and Firefox `scripts/notes-stage2-browser-check.mjs`: Custom live preview, invalid-pool Start disabling, explicit accidental selection/reset, focused Enter answers, profile/config reload, safe name rendering, Guest isolation, JSON download, hosted ↔ cold-offline portable replacement, invalid/future import rejection, confirmed deletion, storage-failure fallback, 360/768/1280 widths and 200% CSS zoom. Produces 66 notation fixtures covering every clef/key and explicit alterations/ledger extremes.
- Chromium and Firefox `scripts/dual-app-browser-check.mjs`: root/nested hosting, separate workers/manifests/caches, first root-worker control, cold-offline portable apps, downloads, layouts and disposal.
- Chromium and Firefox `scripts/browser-check.mjs`: existing tUno hosted/portable controls, synthetic pitch/audio/timing coexistence, keyboard and responsive behavior. The tUno content build was unchanged through the final tuNotes-only refinements.
- `node scripts/release-check.mjs`: both apps' integrity, downloads, icons and manifest identities pass.

Stage 2 checks are included in `test:browser` and both browsers in `verify`. The complete `npm run verify` release suite was not run for this local stage; the list above is the actual scope.

## Retained artifacts and visual review

Final content builds: tUno `93e7abf5e0405284`; tuNotes `6bf0a5c4674b6772`. Reports are retained under [tunotes-stage2/](tunotes-stage2/): [Chromium Stage 2](tunotes-stage2/notes-stage2-chromium.json), [Firefox Stage 2](tunotes-stage2/notes-stage2-firefox.json), [Chromium Practice](tunotes-stage2/notes-chromium.json), [Firefox Practice](tunotes-stage2/notes-firefox.json), [Chromium isolation](tunotes-stage2/dual-app-chromium.json), [Firefox isolation](tunotes-stage2/dual-app-firefox.json), [Chromium tUno](tunotes-stage2/chromium-integrated.json), [Firefox tUno](tunotes-stage2/firefox-integrated.json).

Developer visual review covered the [66-fixture notation sheet](tunotes-stage2/notes-stage2-chromium-notation.png) and [phone setup/local data screen](tunotes-stage2/notes-stage2-chromium-360.png). These establish rendered geometry and layout review, not teacher approval of engraving quality. Final build checksums are retained in [release.json](tunotes-stage2/release.json).

## Remaining human acceptance

Teacher notation legibility, classroom projection, real screen-reader use, physical Safari/iPad and managed Chromebook checks remain pending. Emulated touch/zoom/visibility tests do not replace device acceptance. Starter keys/ranges were teacher-reviewed in this task; wider adaptive envelopes remain provisional. Adaptation, Challenge and Flow are later stages. Nothing was pushed, merged or deployed.
