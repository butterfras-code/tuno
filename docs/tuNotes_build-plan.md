# tuNotes staged build plan

Status: Stages 0–1 implemented as a local Practice preview, 2026-09-26. Read the [product specification](tuNotes_spec.md) first. This plan authorizes no publication. Stages 2–8 remain unimplemented.

Use the existing repository and short-lived feature branches/worktrees. Each stage should be reviewable in a PR, with shared-code refactors separated from behavior changes where practical. Merge/push to `main` publishes automatically and requires publication authorization. An integration branch may collect preview stages when main must not expose unfinished navigation. Do not create a permanent second development trunk.

Node 24 and `npm ci` are required for implementation. Application stages require `npm run check`, affected browser checks, and `git diff --check`; full candidate verification uses `npm run verify`.

## Delivery map

| Stage | Deliverable | Depends on | Release label |
| --- | --- | --- | --- |
| 0 | Two app builds and shared Uno boundary | — | Technical preview |
| 1 | Notation, finite presets, basic Practice | 0 | Practice preview |
| 2 | Full presets, profiles, backups and coaching | 1 | Saved-practice preview |
| 3 | Adaptive Practice | 2 | Adaptive preview |
| 4 | Solo Timed/Target Challenge | 3 | Challenge preview |
| 5 | Turns, pairs, heats and scoreboards | 4 | Multiplayer preview |
| 6 | Teams, co-op and relay | 5 | Classroom Challenge preview |
| 7 | Flow with shared timing | 2; integrate with 6 for release | Full-feature candidate |
| 8 | Integrated verification and classroom acceptance | 0–7 | Complete first release |
| Later | Mic Practice, speed mastery, rest cards | Separate specifications | Not in first release |

Flow's domain is independent of scoring and may be implemented after Stage 2 if priorities change; this is a dependency observation, not a requirement to run concurrent agents. Each stage delivers working vertical behavior and relevant tests rather than only interfaces for a future stage.

## Stage 0 — establish two apps without changing tUno behavior

1. Add tuNotes entry/template and a small home shell; keep tUno's current entry and public URLs.
2. Refactor build configuration into per-app descriptors and clear output once. Preserve existing tUno paths/scripts and add tuNotes hosted/portable artifacts and a development command.
3. Extract only Uno renderer/pose type and required styles/helpers. Keep tuner feedback separate; dispose renderer listeners on unmount. Reuse assets/tokens from source, with no copied second asset set.
4. Parameterize distribution metadata, app names, manifest identity, downloads, cache names and release checks. Test root-worker interaction with `/notes/` from the first dual-app build.

Exit evidence: existing `npm run check` and affected tUno browser/release checks pass; both standalone files cold-open with networking disabled; tuNotes loads at `/notes/` and a nested test prefix; root and child worker caches do not collide; tUno look/tuner/tone/tempo behavior is unchanged. Keep tuNotes absent from production navigation until a usable preview is intentionally published.

Stage 0 implementation: separate entries at `src/main.ts` and `src/apps/tunotes/main.ts`; shared presentation in `src/shared/ui/`; per-app distribution identity and builds; `dev:notes`; additive `release.json.apps`. The home describes future activities without exposing a nonfunctional Start control. No notation, gameplay, progress storage, or microphone capture is added to tuNotes. See [foundation validation](validation/tunotes-foundation.md) for evidence and device gaps.

## Stage 1 — correct notation and first practice loop

1. Implement spelling/position/key models, validated preset normalization, injected clock/RNG and SVG staff rendering.
2. Ship treble/bass C-major Lines/Spaces/Both presets first; create reviewed fixtures for all four clef anchors now.
3. Implement setup → Practice → feedback → results, one answer per prompt, stable controls, keyboard/touch, pause/finish and in-memory summaries.
4. Connect Uno progress using default benchmark, positive error feedback and reduced motion.

Exit evidence: treble C4/bass C4 ledger geometry is correct; all natural staff positions are exhaustively mapped; a bag visits its whole pool; single-note pools terminate selection; one prompt cannot submit twice; errors reveal then advance; pauses exclude inactive response time; Practice runs from a moved/renamed portable file offline. Browser checks cover narrow phone, tablet and laptop, focus, zoom, feedback and Uno cleanup. No persistence dependency.

Stage 1 implementation: explicit written spelling and four-clef position fixtures, six validated C-major staff pools, original bundled SVG notation, injected-clock/RNG Practice engine, stable A–G controls, automatic or self-paced feedback, pause/resume/finish and in-memory results. Uno uses a separate correct-count policy with the default benchmark of 10. [Practice validation](validation/tunotes-practice.md) records browser/offline coverage and the remaining teacher/device review; technical implementation does not imply classroom acceptance.

## Stage 2 — full presets and optional durable progress

1. Add alto/tenor, ledger envelopes, all single-accidental/key policies and the light Custom form with live preview and empty-pool errors.
2. Review the proposed instrument catalog with the teacher; adjust starting keys/ranges before presenting it as classroom-ready. Verify every instrument transposition sign/octave with written-to-concert fixtures.
3. Add optional profiles, names, versioned summaries, bounded history, stored configurations and contextual Uno benchmarks; keep Guest memory-only.
4. Implement export/validated replacement import, migrations, deletion and storage-failure fallback.

Exit evidence: each preset expands into an exact tested pool; all key signatures/clefs have notation review fixtures; F versus F♯ and F♯ versus G♭ remain distinct; B♯/C♭ retain correct octave identity; changing key updates glyphs and accepted spelling together. Storage denial and corrupted data do not prevent play; valid backup round-trips between hosted and portable; oversized/malformed/future-schema import preserves existing data. tUno preference values survive tuNotes operations.

## Stage 3 — adaptive learning that can be explained

1. Implement bounded per-note observations, weighting, focus blocks, review slots, confusion contrasts, and finite expansion plans as pure functions.
2. Add per-player toggle and independent context fingerprints, expansion announcements and post-session recommendations.
3. Record algorithm version and keep latency observational; no speed gate.

Exit evidence: deterministic traces demonstrate stable learning, repeated errors, recovery, upper/lower growth, one-note sets and reaching bounds. Adaptive-off never changes the configured pool. Custom cannot expand outside its limits. Review slots cannot be starved by confusion pairs. Two local profiles cannot change one another's weights or benchmarks. Tests prove every current pitch meets the mastery gate before expansion. A small classroom trial can tune constants without redesigning the engine.

## Stage 4 — solo Challenge and exact scoring

1. Implement immutable round config, monotonic deadlines, Timed and Target rules, qualification, timeout/finish/interruption and result records.
2. Reuse the Practice answer engine and per-player adaptation; add Ready/countdown and Challenge summary.
3. Render ranked/unranked results with prescribed encouraging text, no hidden bonuses.

Exit evidence: fake-clock tests cover exact deadline, last-moment target completion, feedback past deadline, no attempts, pause, hidden tab, restart and stale events. Formula fixtures: 24 correct/30 attempts yields 19.2 adjusted points; 25/25 yields 25; zero attempts yields zero points and no rank. Target 10/12 qualifies at 80%; 10/13 does not. A timed partial run never ranks. Browser tests verify displayed countdown and score against domain state.

## Stage 5 — 1–8 players, pairs and heats

1. Add player roster, independent presets/adaptation, turns and deterministic two-player heats.
2. Implement panel-local input and progress, simultaneous countdown and independent finish; shared pause.
3. Add final scoreboard, shared ranks, odd-player scheduling, duplicate-name disambiguation, Retry/Edit/Home.
4. Enforce usable viewport checks and small-screen turn fallback before start.

Exit evidence: each of 1–8 players appears exactly once per round; odd rosters receive one final solo turn; no answer or timer affects the other panel; completing one player does not end the other. Concurrent pointer inputs, separate keyboard mappings, held keys and focused text entry behave correctly. Resize/visibility interruption preserves state and invalidates ranking consistently. Retrying resets session state while retaining intended profile learning.

## Stage 6 — classroom teams, co-op and relay

1. Compose social mode, team assignment and scheduler around existing Timed/Target engines.
2. Enforce equal competitive team sizes and per-member allocations; add explicit handoff, Ready, and team cumulative results.
3. Add co-op contribution summaries, pooled accuracy, per-member Target qualification, incomplete-team handling and no leaderboard in co-op.

Exit evidence: table-driven tests cover both goals × turns/pairs/relay × competitive/co-op, with supported team configurations and rejected invalid ones. Team adjusted score uses pooled counts; combined Target time excludes handoffs; a stronger player cannot consume another's target quota. Timeout continues participation but cannot qualify the team. All eight players can complete a session using different presets/adaptive flags without profile leakage. Confirm instructions and handoff controls with a teacher on a shared device.

## Stage 7 — Flow and timing reuse

1. Implement current/Next queue, time/beat pacing, delayed hints, count-in, pause/resume and boundary-applied setting changes.
2. Extract reusable scheduling/lifecycle code from tUno's controller only as needed; preserve tuner store adapter and existing scheduling behavior.
3. Add silent operation and optional click, stop/recovery behavior, and contextual tUno suggestion.

Exit evidence: Next becomes Current exactly once; only Current receives its hint; half-duration default and Off/Always are correct; no scores or adaptive history are fabricated. Fake-clock tests cover boundary changes, stalls, pause and count-in. Audio-render/browser tests verify click and visual timeline alignment, silent mode without audio permission, interruption recovery, and no scheduling bursts. Existing tUno tempo/tone/audio coexistence checks still pass after extraction.

## Stage 8 — full candidate and release evidence

Extend `npm run verify` to build once and validate both apps plus cross-app worker/storage behavior, preserving existing tUno evidence. Update [release instructions](releasing.md), [release validation](release-validation.md), [distribution architecture](architecture.md) and README to describe implemented outputs only. Capture artifact hashes and exact source revision.

Required physical acceptance: Chromebook/laptop keyboard and audio, Windows/macOS/Linux browser file-opening workflows, iPad/tablet multitouch and layout, iPhone/Android turn-based layout and file-opening limitations, and at least one classroom display. Use Chromium/Firefox automated coverage plus actual Safari/WebKit acceptance where available. Record device/browser versions, exact build, results, limitations and untested cases; emulation is not physical evidence. If a platform cannot open downloaded HTML through an ordinary browser workflow, document the supported hosted-offline path and the portable limitation rather than claiming universal file support.

Teacher acceptance: verify all clefs/keys/ledger spelling fixtures and instrument catalog, get from launch to Practice without an account, run differentiated eight-player turns/heats, complete one competitive relay and co-op Target, explain the scoring and adaptive changes, recover an exported backup, and repeat essential flows without internet. Verify answer/control readability and simultaneous input with actual students/devices before asserting classroom readiness.

Gate: all inherited first-release features are implemented; required checks pass; physical acceptance is recorded with remaining limitations explicitly dispositioned; distribution notices/source links/checksums match. Only then prepare a publication PR and follow the existing authorization/deployment process. Re-run production HTTPS/offline/download checks after an authorized publication.

## Requirement coverage

| Initial specification area | Implementation reference | Stage |
| --- | --- | --- |
| Principles, written pitch, spelling, key signatures (§1–4) | Product spec §§1, 3 | 1–2 |
| Practice, adaptive, recommendations, speed scope (§5–10) | §§2, 4–5, 12 | 1, 3; speed/mic later |
| Clef/instrument/custom and human-readable presets (§11–15) | §3 | 1–2 |
| Challenge, scoring, qualification, player presets (§16–22) | §§4, 6 | 4–5 |
| Co-op, teams, relay, scoreboard (§23–25) | §6 | 6 |
| Uno, benchmark, streak and difficulty feedback (§26–30) | §§5, 7 | 1–3 |
| Flow, hints, count-in, tUno suggestion (§31–37) | §8 | 7 |
| Optional rests (§38) | §1 | Deferred |
| Persistence, profiles, backup, loss recovery (§39–45) | §§9–10 | 2, 8 |
| Reuse, architecture and separation (§46–47) | §§11–12 | 0, 7; mic later |
| Non-goals and complete outcome (§48–49) | §§1, 12 | 8 |

## Review decisions and risk controls

The spec selects working defaults so coding can start. Before the relevant stage is accepted, review these concrete choices:

- Stage 1: one answer per card versus retry-on-error; alteration selector and keyboard mappings. The proposed single-submit rule makes accuracy comparable and prevents repeated guesses on a revealed card.
- Stage 2: teacher-approved starter ranges/keys and notation fixtures; alto/tenor coverage; opt-in profiles and replacement-only import. These determine classroom meaning and data expectations.
- Stage 3: adaptive thresholds and maximum envelopes. Tune against observations; speed remains separate from correctness mastery.
- Stages 4–6: 80% Target floor, fixed feedback time, interruption qualification, equal-sized teams and per-member relay targets. These make competition deterministic; adjust the specification and tests together if classroom needs differ.
- Stage 7: Flow name, controls and hint defaults. Audio extraction is a regression risk; require tUno timing tests in the same PR.
- Stage 8: `/notes/` hosted location, navigation exposure and supported device evidence. Root service-worker scope and dual-app updates must be demonstrated before publication.

Do not let pending classroom validation block independent technical stages, and do not mark unreviewed musical/device assumptions as validated. There is no effort estimate here: stage completion is based on observable acceptance, not elapsed time.
