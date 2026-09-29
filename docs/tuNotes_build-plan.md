# tuNotes staged build plan

Status: Stages 0–5 implemented as a local Practice, solo Challenge and Multi Player preview, 2026-09-27. Read the [product specification](tuNotes_spec.md) first. This plan authorizes no publication. The Stage 2 implementation and in-phase answer-entry update below are recorded in local commit `73eba41`; its validation is recorded separately from the original dropdown preview. Phase 5 adds turns and pairs through a separate Multi Player entry; Stages 6–8 remain unimplemented.

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

Exit evidence: each preset expands into an exact tested pool; all key signatures/clefs have notation review fixtures; F versus F♯ and F♯ versus G♭ remain distinct; the notation/domain fixtures retain correct B♯/C♭ octave identity while current exercise pools exclude B♯/C♭/E♯/F♭; changing key updates glyphs and accepted spelling together. Storage denial and corrupted data do not prevent play; valid backup round-trips between hosted and portable; oversized/malformed/future-schema import preserves existing data. tUno preference values survive tuNotes operations.

Stage 2 implementation: 44 clef presets, 11 teacher-reviewed instrument Starters, renderer support for all 15 major signatures and supported single-accidental exercise policies (C♭ major is excluded from new exercises), Custom preview/save, named opt-in profiles, bounded versioned observations/results, contextual first-20 Uno benchmarks, validated replacement backups and storage fallback. The teacher supplied revised written keys/ranges and sounding transposition anchors on 2026-09-27; these are recorded in the specification. Notation fixtures have developer review; physical-device and teacher engraving acceptance remain pending. See [Stage 2 validation](validation/tunotes-stage2.md).

### In-phase update — answer entry (2026-09-27; implemented locally)

Teacher review of the Stage 2 preview replaces the accidental dropdown with static, always-visible spelling targets. This is an update within Stage 2. The original Stage 2 evidence describes the earlier dropdown; see [answer-entry validation](validation/tunotes-input.md) for the revised controls. See [the answer-entry specification](tuNotes_spec.md#in-phase-stage-2-update--fixed-accidental-controls-2026-09-27).

1. Build a fixed piano-like layout with a full half-key stagger: sharps above, naturals in the middle, flats below. The follow-up teacher correction removes B♯/C♭/E♯/F♭ from controls and exercise pools. Begin at the configured tonic and repeat it at the right edge; modified tonics stay on their sharp/flat row. Keep supported spellings visible and inactivate those outside the active pool without changing geometry or availability per prompt.
2. Emphasize in-key spellings visually and rotate the octave only when the configured key changes. Per the teacher's implementation-time correction, unmodified letters always submit naturals: B is B♮, never B♭.
3. Support one-tap/click submission on offset targets for both mouse and touch. Release on the pressed target to answer; leaving that target cancels. Share spelling and submission logic with keyboard input. Keep later piano-keyboard presentation possible without adding it to this stage.
4. Use the teacher-confirmed keyboard mapping: hold Up + letter for sharp, Down + letter for flat, Right + letter for natural; these are absolute alterations. Unmodified letters are natural. Ignore conflicting arrow modifiers, held/repeated submissions and shortcuts during text entry; show the mapping on screen. While a single arrow modifier is held, give its entire row a themed teal glow (Up: sharps; Down: flats; Right: naturals), muted on unavailable spellings. Show an Up/Right/Down keyboard keycap to the left of the matching row, highlighted with that row while held. Keep the keycaps visible when the note area scrolls on narrow screens. Clear both highlights on release, conflicting modifiers, pause, blur or visibility loss.
5. Validate phone/tablet/desktop target sizes, fixed positions, disabled targets, key defaults, exact enharmonic spelling, mouse/touch taps, drag cancellation, keyboard focus/repeat, and one submission per prompt. Compare usability with students; response time includes interface effort; physical-input speed comparisons remain future work, and current aggregate latency is not a standardized reading-speed assessment.

Follow-up constraints: C♭ major is unavailable for new exercises; retain old saved configurations/history for editing and backup. Validate C and modified-tonic endpoints, duplicate submission, all supported key layouts, true half-key alignment, excluded-pitch filtering, and 44px answer targets at 360px width. Keep the arrow keycaps fixed to the left; allow the full-octave note area to scroll internally when it cannot fit beside them, without page overflow or shrinking targets.

Stage 3 integration: animate newly enabled spelling targets in place when the active pool expands; respect reduced motion. Existing enabled targets do not move or animate as newly available merely because another octave is added. This requirement does not bring adaptive scheduling into Stage 2.

## Stage 3 — adaptive learning that can be explained

1. Implement bounded per-note observations, weighting, focus blocks, review slots, confusion contrasts, and finite expansion plans as pure functions.
2. Add per-player toggle and independent context fingerprints, expansion announcements and post-session recommendations.
3. Record algorithm version and keep latency observational; no speed gate.
4. Phase 3 addition (2026-09-27): implement the optional “Meet your notes” pre-round preview described in spec section 5. Show the active starting pool low to high with written names, a bouncing ball with streamers, and Uno's final catch. Default on for beginner/Starter presets with a remembered toggle; support one-note-at-a-time review, Start/Replay/Skip, silent operation and a static reduced-motion presentation. Reuse notation/Uno infrastructure and keep the preview independent of the adaptive toggle. Record preview exposure in session results without adding learning observations or measured play time. Challenge integration remains Stage 4.

Exit evidence: deterministic traces demonstrate stable learning, repeated errors, recovery, upper/lower growth, one-note sets and reaching bounds. Adaptive-off never changes the configured pool. Custom cannot expand outside its limits. Review slots cannot be starved by confusion pairs. Two local profiles cannot change one another's weights or benchmarks. Tests prove every current pitch meets the mastery gate before expansion. A small classroom trial can tune constants without redesigning the engine.

Preview exit evidence: correct starting pools, low-to-high order and accidental labels, including altered tonics and restored adaptive pools; usable grouping for large/mixed-clef pools; Skip/Replay/Start and reduced motion work without stale animation callbacks starting play or accepting answers. Preview actions do not affect measured latency, counts, mastery or rewards. Older saved results remain readable, Guest stays memory-only, and the remembered preference follows existing persistence rules. Teacher review covers legibility, pacing and beginner defaults.

Stage 3 implementation: isolated algorithm-v1 contexts, bounded weighted learning, ten-prompt focus blocks, protected fifth-prompt review, confusion contrasts, finite mastered-range expansion, in-place spelling activation, and session recommendations. Adaptive-off keeps the original bag and pool; Custom has no growth beyond its configured pool. The implementation-time instrument decision adds 1 / 1.5 / 2 octave levels for all 11 instruments and authorizes growth toward the new two-octave bounds; it supersedes the earlier proposed envelopes. See the [range decision](tuNotes_spec.md#phase-3-instrument-range-decision-2026-09-27).

The optional preview is implemented with one centered note at a time on a full-size staff, a ball that wraps from the right edge to the left, and Uno to the right with his tail still until the catch. Written names omit octave numbers, and progress appears below each name. Previous/Next are inside the staff panel. Start Practice is enabled after the catch, Replay appears afterward, and Skip appears during playback. Reduced motion is static, with per-profile preferences and memory-only Guest preferences. No Practice engine exists until Start Practice or Skip, so preview time and interactions supply no observations or rewards. Schema 3 migrates earlier snapshots and records exposure without inventing status for older results. [Phase 3 validation](validation/tunotes-stage3.md) separates deterministic/browser evidence from outstanding teacher pacing, classroom constants and physical-device acceptance. No Challenge or Flow behavior is included.

## Stage 4 — solo Challenge and exact scoring

1. Implement immutable round config, monotonic deadlines, Timed and Target rules, qualification, timeout/finish/interruption and result records.
2. Reuse the Practice answer engine and per-player adaptation; add Ready/countdown and Challenge summary.
3. Render ranked/unranked results with prescribed encouraging text, no hidden bonuses.

Exit evidence: fake-clock tests cover exact deadline, last-moment target completion, feedback past deadline, no attempts, pause, hidden tab, restart and stale events. Formula fixtures: 24 correct/30 attempts yields 19.2 adjusted points; 25/25 yields 25; zero attempts yields zero points and no rank. Target 10/12 qualifies at 80%; 10/13 does not. A timed partial run never ranks. Browser tests verify displayed countdown and score against domain state.

Stage 4 implementation: the existing Challenge segment opens the shared preset/adaptation setup with validated Timed or Target rules. Explicit Ready begins a three-second count-in; Challenge always uses fixed 250/800 ms feedback. Monotonic timing rejects answers at or after the deadline, clamps delayed completion to the allowance, and completes Target on its final accepted correct answer. Pauses (including visibility loss and Options navigation) preserve remaining time but invalidate ranking; changing activity ends the previous round. Results show the local player, counts, accuracy, best streak, rule summary, exact score/time and qualification. Schema 4 separates Practice/Challenge learning and retains bounded Challenge rule/outcome records, including zero-attempt rounds. Reward benchmarks also match Challenge rules. Intro remains a Practice option. See [Phase 4 validation](validation/tunotes-stage4.md).

Phase 4 presentation/reward follow-up: keep one note-area panel through Ready/countdown/play/pause/results, center wagging Uno for the count-in, and replace the inline diagnostic result text with a score-first solo scoreboard and optional Round details. Extend treats beyond the initial benchmark using the approved recent-20-answer, performance-responsive interval, including mistake relief and a three-correct minimum. See [the reward specification](tuNotes_spec.md#ongoing-treats-teacher-feedback-2026-09-27) and [follow-up validation](validation/tunotes-challenge-scene.md).

## Stage 5 — 1–8 players, pairs and heats

1. Add player roster, independent presets/adaptation, turns and deterministic two-player heats.
2. Implement panel-local input and progress, simultaneous countdown and independent finish; shared pause.
3. Add final scoreboard, shared ranks, odd-player scheduling, duplicate-name disambiguation, Retry/Edit/Home.
4. Enforce usable viewport checks and small-screen turn fallback before start.

Exit evidence: each of 1–8 players appears exactly once per round; odd rosters receive one final solo turn; no answer or timer affects the other panel; completing one player does not end the other. Concurrent pointer inputs, separate keyboard mappings, held keys and focused text entry behave correctly. Resize/visibility interruption preserves state and invalidates ranking consistently. Retrying resets session state while retaining intended profile learning.

Stage 5 implementation: Multi Player owns a local 1–8 roster, individual preset/adaptive/profile choices, Timed/Target rules, turns and two-player heats. Ready starts a shared three-second count-in for each heat; each lane has its own Challenge, answer controls, timer, feedback and Uno progress. Finished lanes wait while their partner continues. Pauses apply to all active lanes; undersized pair layouts pause with restore-or-restart-as-turns recovery. The final scoreboard ranks only qualified results, shares exact ties, and shows unranked participation in roster order. Retry starts fresh engines and rewards while retaining saved or in-memory learning. See [Phase 5 validation](validation/tunotes-stage5.md) for automated evidence and remaining device/classroom gaps. Teams, co-op, relay and Flow remain Stage 6/7 work.

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

- Stage 1: one answer per card versus retry-on-error; keyboard mappings (the original alteration selector is superseded by the in-phase Stage 2 update). The proposed single-submit rule makes accuracy comparable and prevents repeated guesses on a revealed card.
- Stage 2: teacher-approved starter ranges/keys and notation fixtures; alto/tenor coverage; opt-in profiles and replacement-only import. These determine classroom meaning and data expectations.
- Stage 3: adaptive thresholds and maximum envelopes. Tune against observations; speed remains separate from correctness mastery.
- Stages 4–6: 80% Target floor, fixed feedback time, interruption qualification, equal-sized teams and per-member relay targets. These make competition deterministic; adjust the specification and tests together if classroom needs differ.
- Stage 7: Flow name, controls and hint defaults. Audio extraction is a regression risk; require tUno timing tests in the same PR.
- Stage 8: `/notes/` hosted location, navigation exposure and supported device evidence. Root service-worker scope and dual-app updates must be demonstrated before publication.

Do not let pending classroom validation block independent technical stages, and do not mark unreviewed musical/device assumptions as validated. There is no effort estimate here: stage completion is based on observable acceptance, not elapsed time.

## Preset/configurator refinement

- Replace the long native preset dropdown with a compact accessible Clef/Instrument → selection → level dialog, plus saved/custom entry points.
- Build graphical low/high staff editors with pointer and keyboard selection, endpoint accidental segments, linked clefs and confirmation for implicit mixed-clef activation.
- Add Lines/Spaces/Both, additive Key/Flat/Natural/Sharp modifiers, ordered major keys, and explicit available-clef toggles.
- Derive ledger descriptions from ranges; remove hidden ledger clipping from new configurations.
- Extend normalization, exercise rendering, context identity and validated persistence for accidental boundaries, independent modifiers and multiple clefs; retain older configurations.
- Validate domain semantics, persistence round trips, picker navigation, graphical input and responsive browser layouts, then run npm run check.

Implemented locally: the picker wizard and graphical configurator now drive actual normalized note pools and mixed-clef practice. New Custom definitions use versioned modifiers/clefs and accidental endpoints; backup schema 2 migrates earlier settings/history. Automated evidence includes 63 unit tests, hosted/portable Chromium and Firefox configurator checks, existing practice/input/backup regressions, and emulated touch dragging. See [configurator validation](validation/tunotes-configurator.md) for archived evidence and remaining physical/teacher acceptance. No new instrument ranges or adaptive levels were introduced.

Configurator follow-up: rename the fieldset to “tuNotes Your Way!”, cycle clefs directly from their symbols with one shared help line, clamp edits before the endpoints can cross (including accidentals), and prefill deterministic range/content/key/modifier names with an editable override. Cover pointer/keyboard/accidental limits, four-clef cycling, generated-name updates and override persistence in browser checks.

### Between Stages 3 and 4 — UI simplification

Implemented locally: tUno-style Practice / Challenge / Options navigation (Challenge remains a placeholder); low/high staff previews and compact preset summaries; pressed-state Adapt Range / Show Intro buttons; adaptation help in a question-mark popover supporting hover, focus, tap, outside dismissal and Escape. Continue After is synchronized between Practice and Options; Options also contains existing profile/backup controls. Range previews are capped at 480 px combined, and Start Practice is 270 px wide (twice its previous width), constrained to fit narrow screens. Switching away pauses active practice; leaving an intro returns to setup.

Continue After offers Instant / Delay / Click/Tap. Instant advances correct answers immediately and reveals errors for 800 ms; Delay retains 250 ms correct / 800 ms incorrect feedback; Click/Tap waits for Continue. The optional validated `configuration.continueAfter` setting round-trips in backups; older `selfPaced` choices map to Click/Tap or Delay. Profile adaptation/intro choices remain saved, and Guest choices remain memory-only. Specification explanations and benchmark details are removed from the Practice setup.

Validation: `npm run check`, existing Practice/configurator/adaptive/input/backup browser checks, and `notes-ui-browser-check.mjs` for navigation, persistence, mode-switch pausing, no hidden keyboard answers, and 360/768/1280 layouts. The UI check runs in Chromium and Firefox and is included in full verification. Physical-device acceptance remains outstanding as described above.

Practice feedback follow-up: all displayed supported spellings now accept answers, including those outside the preset pool. Pool membership remains visually indicated; it no longer suppresses guesses. This supersedes the earlier disabled-target input requirement. Wrong answers count as attempts, reset the current streak, and advance after feedback by default. A fourth Continue After option, Correct, counts each guess but retries the same pitch after a miss, with a fresh input token, until answered correctly. Live stats show correct/attempts and current/best streak; encouragement appears as a temporary 2.2-second toast and clears on a miss. `notes-misses-browser-check.mjs` covers pointer, keyboard and assistive-click misses, automatic advancement, Correct retries/persistence, streaks and toast expiry.
