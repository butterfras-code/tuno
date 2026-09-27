# tuNotes Stage 1 validation

Stage 1 Practice preview, 2026-09-27. Implemented on `feature/tunotes-practice`, building on the clean Stage 0 foundation `015de2ce55e37569c46384714d4044a4ebe64730`. This evidence describes that revision plus Stage 1 working changes (`dirty: true`), not a production release. No main-branch push, merge or production deployment is part of this stage.

Environment: Linux, Node 24.21.0; pinned dependencies installed with `npm ci`. Chromium 153.0.8010.12 and Firefox 155.0 via Playwright.

| App | Content build | Portable SHA-256 |
| --- | --- | --- |
| tuno | `e50faeca7e6762c3` | `8b88c7bac08d0354bf30ccc84bc163710ab333a1cbd40f6d7a173396282b796f` |
| tunotes | `ad25f42b25599545` | `80f10e127b1cf552ae5fdfec91f0a983551adea04eecbd04346a1c308fe35a5c` |

## Implemented behavior

Setup defaults to Practice, Treble — Lines + Spaces, C major and automatic feedback. The six selectable pools are treble/bass staff Lines (5 notes), Spaces (4) and Lines + Spaces (9). There are no profile, persistence, accidental/key, adaptive, Challenge or Flow controls.

A whole note appears on an original bundled SVG staff. All seven A–G answers stay in stable locations and remain available as choices regardless of the pool. Letter keys, focused-button Enter/Space, mouse and touch submit one answer. Correct feedback lasts 250 ms; incorrect feedback reveals the expected letter for 800 ms. The optional self-paced setting waits for Continue. A physical press held across feedback, a duplicate submission, an old prompt/session token, an old pointer gesture or a queued pre-prompt/pre-Resume key event cannot answer the new prompt.

Pause and visibility loss preserve the prompt and remaining feedback time. Resume is explicit. Response time and active duration exclude pauses. Finish freezes the summary; Retry creates a fresh session, and Edit setup/Home return to setup. Results report correct/attempt counts, accuracy (— for no attempts), best streak, active duration and average response time. Answer records retain octave, spelling, selected answer and preset context in memory only.

Uno uses the shared renderer and an independent policy with benchmark 10. Progress survives errors; milestones fire once, with positive streak text, a treat at 10 correct and static poses/text under reduced motion. Removing the Practice view cancels its interval, keyboard/visibility listeners and Uno resources.

## Automated evidence

- `npm run check`: TypeScript, all 44 unit tests and both app builds pass. Nine new tests cover exact pools and invalid/empty definitions, explicit enharmonic spelling, every natural pitch across supported octaves for all four clefs, staff-position fixtures, middle-C ledger coordinates, five-ledger geometry, shuffled-bag cycles and boundaries, one-note termination, correct/incorrect lock timing, stale session/prompt events, pause timing, self-paced progression, press gating and reward milestones.
- `node scripts/notes-browser-check.mjs`, in Chromium and Firefox: full Practice loop from a moved/renamed cold-offline portable file and a prepared hosted app reloaded with both server availability and browser networking disabled. Includes both feedback modes, bag coverage, incorrect reveal, duplicate/held/stale event rejection, pause/resume, a synthetic visibility-loss fixture, results/retry/edit/home, A–G and focused-button keyboard input, visible focus, 44-pixel targets, layouts at 360/768/1280 CSS pixels, 200% CSS zoom, reduced motion, and listener/timer disposal. Chromium additionally exercises touch emulation. The visibility fixture verifies event handling; it is not physical OS backgrounding evidence.
- `node scripts/dual-app-browser-check.mjs`, in both engines: relocated portable cold launches, root and nested hosting, root-worker first visits, independent manifests/caches, scope-limited cache deletion, offline reload/download, preserved tUno storage sentinel, and repeated Uno disposal. Both apps remain independent. The Practice bundle does not import tuner state, audio or feedback.
- Existing `scripts/browser-check.mjs` and `scripts/animation-browser-check.mjs`, in both engines: tUno hosted and relocated portable interaction, synthetic pitch/audio coexistence, timing recovery, keyboard/layout controls, Uno poses/rewards, pet interactions, animation cancellation and reduced motion pass. The tUno content build is unchanged between the initial and final Stage 1 browser passes; only tuNotes notation/input refinements followed those regression runs.
- `node scripts/release-check.mjs`: both builds’ checksums, matching downloads, manifest/icon identities, source metadata, standalone packaging and cross-app import boundaries pass.
- `git diff --check`: passes. Documentation links and implemented/deferred scope reviewed.

Retained reports: [Chromium Practice](tunotes-practice/notes-chromium.json), [Firefox Practice](tunotes-practice/notes-firefox.json), [Chromium isolation](tunotes-practice/dual-app-chromium.json), [Firefox isolation](tunotes-practice/dual-app-firefox.json). The new Practice browser check is included in `test:browser` and both browser passes of `verify`. The full `npm run verify` release suite was **not** rerun for this stage; the commands above are the actual validation scope.

Visual review: [four-clef middle-C fixtures](tunotes-practice/notes-chromium-clefs.png), [phone](tunotes-practice/notes-chromium-portable-360.png), [tablet](tunotes-practice/notes-chromium-portable-768.png), [laptop](tunotes-practice/notes-chromium-portable-1280.png). Clef reference lines and treble/bass ledger placement were inspected; the treble curl alignment was corrected during this review. Alto/tenor are fixture-only, not selectable. These are developer-reviewed geometry fixtures, not teacher approval of engraving quality.

## Remaining acceptance and deferred scope

Physical Chromebook/laptop keyboards, iPad/tablet multitouch, iPhone/Android file-opening workflows, Safari/WebKit, actual screen readers, classroom projection and teacher/student notation review remain unverified. Browser emulation does not establish those results. The accessible staff description gives clef/key/position without the answer spelling; the positional alternative is not equivalent to visual staff reading. Synthetic visibility loss does not replace device background/resume acceptance.

Full key signatures/accidentals, ledger/instrument/custom presets, selectable alto/tenor, profiles, persistence and contextual benchmarks belong to Stage 2; adaptation, Challenge and Flow remain in their planned stages. No speed-based mastery or microphone input is implemented. A future publication candidate still needs the release procedure and physical acceptance. No claim of complete first-release or classroom readiness is made.

## Stage 1 review follow-up — lost key releases

Reviewed `23e128164bc1ae716a3fdb54d11102699df7f1b5` against the Stage 1 plan and the preceding design thread. The held-key gate could retain a key when its release happened outside the page, discarding the first fresh answer after returning. The added browser regression failed on the original build in both Chromium and Firefox.

The follow-up clears keyboard and pointer state on window blur and document hiding, preserves repeat rejection and explicit Resume after visibility loss, and removes the blur listener on disposal. Regression fixtures exercise letter, Enter and Space input with omitted keyup, repeated events and a fresh press after each type of interruption. These are synthetic event fixtures, not physical tab-switch acceptance.

Validation on Node 24.21.0 with `npm ci`: `npm run check` passes all 45 unit tests and both builds; Practice and dual-app browser checks pass in Chromium and Firefox, including hosted offline and relocated portable operation; release integrity and `git diff --check` pass. Reports are generated in `dist/validation/`. Full `npm run verify` and physical-device acceptance were not performed for this follow-up; the gaps above remain.
