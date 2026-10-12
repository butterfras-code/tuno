> Current assessment: [assessment v2 / hold policy v3](assessment.md) supersedes target-release deadline scoring and fixed target lift-band guidance below for new attempts. Sustain is elapsed release minus press; analytical tempo/displacement locate musical rests without moving received evidence. Old snapshots retain their original numerical and visual policy. The sections below retain implementation history where marked provisional/original.

# Tap Rhythms performance contract

Current numerical feedback and completion behavior: see the [current musical assessment](assessment.md). Its versioned policy and results lifecycle supersede historical evidence-only descriptions below; target-relative review remains available.

Current behavior, reconciled 2026-10-11 with the selectable-performance slice. Read alongside the [unified Uno234 contract](unified-activity.md). Validation sections explicitly marked historical describe the original slice.

Implemented for the owner's first playable performance slice. This is a development review surface, not a production release or an approved teaching/scoring policy.

Run Node 24, `npm ci`, then `npm run dev:walk`. Open `http://127.0.0.1:5173/prototypes/rhythm-walk/`. A regular build also emits that review page under `dist/hosted/prototypes/rhythm-walk/`, following the existing Count Writing prototype convention. This is now one shared Uno234 activity with Write Counts, Tap Rhythms and Both. Generation and preferences are shared; reload preserves preferences but clears responses/results. There is no new suite navigation, service worker, installation entry, portable distribution, adaptive progression, mastery score or reward. No branch was promoted to `main`.

The current activity is **Uno234**; historical internal paths stay compatible. Rhythm Walk is reserved for a future continuous game mode outside this slice.

## Selectable Tap / Tap + Hold

**How to play** lives in the existing Performance settings, applies in Tap Rhythms and Both, and saves with shared preferences. **Tap** is the default: “Tap when each note starts.” **Tap + Hold** says: “Hold each note for its length. Release for rests.” Changing it preserves exercise, pending configuration, written response and completed review. It is disabled from activation through count-in/capture and during calibration. Attempts snapshot `playStyle` and `evaluationPolicy`; Retry snapshots current preferences. Legacy JSON with no style remains hold-oriented; older preferences with no style default to Tap.

Tap grades note attacks, missing/extra attacks and attacks inside written rests. It does not grade release, hold duration, incomplete holds or an existing hold extending into a rest. Both down/up edges remain raw evidence. A tied chain has one attack. Tap + Hold additionally grades duration and release: separate notes need release/reattack, tied notes need a single uninterrupted hold through the full derived chain, rests require musical silence, and final-note sustain uses the elapsed-duration policy with the existing finite capture tail. There is no synthetic release at the deadline.

[Current central assessment/hold policy](../../src/apps/rhythm-walk/assessment-policy.ts) defines provisional defaults with no required learner tolerance controls. See [the exact formulas and compatibility behavior](assessment.md).

| Check | Current new-attempt policy |
| --- | --- |
| Attack association | Bounded ordered edit fit with one global tempo and analytical starting displacement; missing/extra penalties retained |
| Attack acceptance | Full credit within 10% of assessment beat, clamped to 30–60 ms; gradual deductions beyond |
| Sustain before separate adjacent notes | Approximately 70% of intended duration from the learner's own attack |
| Sustain before rests/final end | Approximately 80%, with bounded 20 ms allowance, 60% duration floor and 40 ms minimum |
| Small overhold | Accept through intended duration plus min(80 ms, 15% of duration) |
| Written rest intrusion | Allow min(60 ms, 15% of rest length) at the analytical tempo/displacement; then gradual deduction |
| Ties | One continuous physical hold, retaining meaningful sustain in the final written member; no internal lift permission |

Duration and rest evidence produce one hold credit using the strongest issue, never summed penalties. Missing attacks affect rhythm only; their absent holds are not graded. Actual attack positions and sustain bars remain received evidence. Expected bars show written target duration; new attempts have no fixed target-time lift-credit bands. Legacy attempts retain their saved release policy and bands.

Tap Expected/Received timelines show attacks only. Tap + Hold adds thin bars for canonical sounding chains and actual corrected input intervals. Bars split at barlines and automatic system wraps without adding attacks. Accepted gaps stay visible, unmatched holds are shown, and overholds extend until their real release (clipped at the score edge when necessary). An absent release stays null: its observed extent is dashed to capture end, without a release endpoint. SVG titles/labels and the textual review explain missing/extra, early/late/short and incomplete evidence without requiring color. [Current automated and device validation](unified-activity.md#tap--tap--hold-validation) and the [HTML review](tap-hold-review.html) record the slice's evidence and remaining decisions.

### Calibration boundary

Rest-boundary grading honors the same attack tolerance as note feedback: a matched, accepted early attack for the note immediately following a rest does not create a rest violation. Its corrected attack time, `restAttacks` entry and exact `restOverlaps` remain evidence. Unmatched/out-of-tolerance attacks and unrelated holds intruding into the rest still require attention. Hold-duration/release evaluation remains independent of this attack allowance.

Matched duration bars start in their attack marker's expected-note measure, at the same displaced x-coordinate, even when the attack occurs slightly before a barline. They create no stray onset segment in the preceding measure. Later sustained continuations still split at true measure/system boundaries; release times and interval lengths remain actual corrected evidence. Unmatched inputs retain absolute-time placement.

Automatic offset estimation and manual tap-along calibration now extend this prototype. See [session timing rules and validation](timing-calibration.md); those rules supersede the initial no-calibration behavior and count-in/capture-end policies described below. Raw timestamps remain unchanged.

## Requirements and decisions

The [original handoff](reference/RHYTHM_GAME_HANDOFF.md), especially sections 3–5 and 15, distinguishes confirmed principles from proposed architecture and open policies. The initial slice introduced holds, fixed two-bar 4/4 fixtures, one measure of count-in, localized timing review, a metronome toggle and interrupted rather than graded cancellation. Subsequent work added session timing correction and unified all shared presets/generated exercises across 2/4, 3/4, 4/4 and 6/8, with generated lengths 1–4 (default two). [Current direction](README.md) governs both response modes; neither is a prerequisite for the other. The broader handoff roadmap and numerical mastery policies remain unapproved.

| Status | Scope |
| --- | --- |
| Confirmed for this slice | Conventional static notation; read through mistakes; press/hold/release; keyboard and pad; silence for rests; one attack for a tied chain; finite capture; separate raw onset/release/rest evidence; completed versus interrupted; deliberate Retry/exercise change |
| Implemented engineering choices | Pure capture and evaluator; scheduled audio-clock transport; monophonic input ownership; ordered bounded attack matching; in-memory raw records and JSON download; shared score, performance pad and calibrated Expected/Received timelines |
| Provisional, replaceable | 40–180 pulse BPM controls, initial 80 BPM; 180 ms attack association window; 750 ms final-release tail; 120 ms scheduling lead; exact window/boundary and interruption policies below |
| Unresolved / deferred | Approved teaching tolerances; hardware-specific latency validation; teaching approval of the provisional articulation/sustain policy; absolute versus relational assessments; pulse/tempo mastery and evidence minimums; scores, recovery claims, progression; meters beyond the supported four, passages beyond four generated bars, final production navigation, saved performance history, physical-device support |

## Original performance fixtures

[Fixtures](../../src/apps/rhythm-walk/fixtures.ts) are curated and implementation-reviewed for exact bar totals, engraving, attack/hold boundaries, silence, and tie membership. They are not owner-approved difficulty presets or UIL templates. These three retained presets use two complete 4/4 bars; they no longer limit the performance repertoire. The [shared catalogue](../../src/apps/rhythm-walk/activity.ts) includes every writing fixture and generated passage. At 80 quarter-note BPM the count-in is 3 seconds, the exercise is 6 seconds, and uncalibrated capture closes at 6.75 seconds after its start. A positive saved offset extends that capture deadline.

| Exercise | Written measures | Expected holds in quarter-note units from exercise start |
| --- | --- | --- |
| Quarter steps | Q Q Q Q / Q Q Q Q | [0,1), [1,2), … [7,8) |
| Hold, rest, and eighths | H Q E E / Q Q-rest E E Q | [0,2), [2,3), [3,3.5), [3.5,4), [4,5), [6,6.5), [6.5,7), [7,8); silence [5,6) |
| Across the barline | H Q-rest Q-tie / Q Q-rest H | [0,2), [3,5), [6,8); silence [2,3) and [5,6). The [3,5) chain references both written quarters. |

The [shared renderer](../../src/apps/rhythm-walk/shared/notation.ts) uses exact derived positions and serves all modes. It supports the same reviewed notation, rest spelling, grouping and ties as Write Counts. Same-system barline ties use one curve; visual wraps use outgoing/incoming hooks. The pad follows the score (and count rows in Both); completed attempts add score-aligned Expected/Received timelines. Feedback is textual as well as colored, attached to each relevant SVG note/rest via accessible descriptions and titles; both tied members point to one chain result.

## Interfaces and separation

- [Timing](../../src/apps/rhythm-walk/timing.ts): `musicalSeconds(time, bpm, pulse)` converts canonical whole-note fractions at the scheduling boundary. `planPassage` consumes `derivePassage`, emitting expected sounding notes with written source references, written rest intervals, count-in/exercise pulses, duration and capture end. Performance pulses are an explicit musical fraction, independent of counting labels and `measure.groups`.
- [Capture](../../src/apps/rhythm-walk/capture.ts): `Capture(exercise, bpm, metronome, policy?, timingOffset?, playStyle?, evaluationPolicy?)` snapshots source and settings. `input(down/up, source, time, timestampMs, repeat)`, `advance(time)` and `interrupt(reason, time)` are rendering-independent, deterministic state transitions. Time is seconds relative to the exercise start. `heldBy` exposes monophonic ownership. `setClockEvidence` supplies transport anchors before input. A finished `AttemptRecord` is a detached, versioned snapshot.
- [Transport](../../src/apps/rhythm-walk/transport.ts): maps DOM timestamps onto the AudioContext timeline and schedules the whole bounded short passage once using the existing synthesized `scheduleClick`. It retains stoppable click nodes. A 20 ms poll observes clock-derived phase/end and updates the decorative pulse; that timer never schedules musical events. Audio state changes interrupt immediately. No animation frame or timer chain drives the music clock.
- [Evaluator](../../src/apps/rhythm-walk/evaluation.ts): `evaluateAttempt(record)` consumes expected events plus recorded evidence and returns matches, missing/extra attacks, signed onset/release offsets and rest intersections. Identical records return identical results without mutation or wall-clock dependencies. Interrupted records return an interrupted outcome with no graded results.
- [Performance UI](../../src/apps/rhythm-walk/performance.ts): owns ready/count-in/performing/reviewing/interrupted presentation and browser lifecycle binding, not grading math. The [shared shell](../../src/apps/rhythm-walk/main.ts) owns exercise selection, settings and score. Exercise controls lock during capture; mode switching remains available and cancels capture. Space belongs only to the focused active pad. A result survives tempo/metronome/play-style edits until Retry/Start or a deliberate exercise change; JSON download preserves it externally.

Both evaluators consume the same canonical exercise and keep independent response/result state. The shell reuses the count editor for the shared score, while capture derives seconds from canonical musical fractions and the shared meter policy. Count answer indices are never the performance clock.

6/8 performance uses an explicit `[3,8]` dotted-quarter pulse and two pulses per bar; the tempo label names dotted-quarter BPM. Write Counts numbers all six eighths while score grouping remains `[3, 3]`. Simple meters use quarter-note BPM and two, three or four pulses per bar. Count-in is one bar in the exercise's meter. Changing count labels never changes this clock.

## Transport, capture and input policies

All figures below are provisional engineering choices, not approved teaching thresholds.

| Policy | Prototype behavior |
| --- | --- |
| Start and snapshot | Snapshot exercise, BPM, metronome, play style, capture timing policy and evaluation policy before awaiting audio activation. Audio must be running; failed activation/cancelled start produces an interrupted record and Retry. |
| Scheduling | Exercise start = current audio time + 120 ms lead + exact first-bar duration. Count-in has one bar of scheduled meter-appropriate pulses; exercise clicks follow the snapshot toggle. Downbeats are accented. |
| Count-in window | `[-countIn, 0)`. Scheduling lead before that is outside capture. Accepted count-in presses/releases are retained separately from exercise attacks. |
| Exercise window | `[0, duration)`. An onset exactly at zero belongs to the exercise. |
| Final tail | `[duration, duration + 0.75)`. New presses here are extra-attack candidates, not a new final note. Releases can finish an earlier hold. At the exclusive deadline, capture completes even if still held. No synthetic release is invented; review says “no release observed.” |
| Held across start | Keep the same physical hold and owner; do not invent an exercise onset. Its count-in attack is excluded from matching. It may overlap a written rest. Release before a subsequent press can create a new attack. |
| Repeat/duplicates | Record and reject key repeats, a down while already held, and an up from a nonowner. A rejected second input is not queued or promoted when the owner releases. |
| Multiple sources | First accepted keyboard or pointer owns the monophonic hold until its release. Other pointer IDs or keyboard presses cannot add attacks or release it. The pad captures the owning pointer so release outside the pad still reaches capture. Nonprimary mouse buttons are ignored. |
| Cancellation | Stop/Cancel, pad/window focus loss, page backgrounding, page exit, audio suspension/closure, cancellation or lost capture of the active pointer end the attempt as interrupted, stop scheduled sound and retain partial raw evidence. Cancellation of an ignored pointer does not end the owning hold. No mid-note resume; Retry gives a fresh count-in. A completed record remains completed if later focus is lost. |
| Rendering | Accepted events are timestamped immediately in input handlers; DOM rendering and pulse animation cannot retime them. Pad focus is visible; status changes are announced politely; pulse changes are decorative and are not repeatedly announced. Ordinary Space behavior is preserved outside the active pad. |

Modern DOM event timestamps use the monotonic performance clock; legacy epoch timestamps are normalized using `performance.timeOrigin`. At transport creation an anchor pairs `performance.now()` with `AudioContext.currentTime`. Input maps as `anchor.audioSeconds + (eventTimestampMs - anchor.performanceMs)/1000 - exerciseStart`. This raw mapping is an approximate cross-clock correspondence. The evaluator applies any saved session offset separately without rewriting these timestamps. Expected musical times are never inferred from UI frames or Count Writing slots.

Raw JSON includes schema version, source exercise, expected plan, BPM, metronome assistance, play style, capture/evaluation policy values, accepted and rejected events, source IDs, original DOM timestamps, mapped relative times, region/rejection reason, completion/interruption and end time. When audio starts it also includes clock anchors, absolute exercise start, sample rate and browser-reported base/output latency. Those latency values are evidence, not corrections. Evaluation can be rerun with a new policy against the retained raw timings; source events also support deriving a new plan. Download or copy the record before Retry if it needs to outlive the current review. This is not an account/history storage schema.

## Legacy target-relative evidence policy

Grading follows the captured Tap / Tap + Hold selection and provisional policy above; raw release/rest intersections remain available in either setting. Pair accepted downs with their owner releases first; a still-held input retains a null release. Without calibration, exclude count-in attacks from association, but include their audible-time interval in silence/rest intersections. With calibration, classify on corrected time as described in [timing boundaries](timing-calibration.md#evidence-and-boundaries). Attack matching is ordered, one-to-one, maximizing the number of matches within an inclusive ±180 ms window, then minimizing total absolute onset offset. Stable ties prefer the matching candidate, then the missing-input branch. Gaps do not advance both sides, so a missing or extra attack cannot mechanically shift every later match. This bounded policy remains ambiguous if timing deviates far enough to resemble a neighboring note; results describe associations, not inferred intent.

Release times never influence attack matching. Only after association, report `press - expected onset` and `release - expected end` (negative early, positive late). Missing attacks do not receive invented release offsets. Intersect each recorded hold with each written rest's half-open interval, clipping an unreleased hold to capture end and reporting positive overlap duration. An extra attack during a rest can therefore produce both an extra attack and rest overlap; those are separate evidence, not penalties summed into a score. When session timing correction is active, the explicit saved offset is applied equally to both edges; raw results remain available. Attempts are never independently recentered or stretched. Display rounds to milliseconds, with sub-half-millisecond values shown as 0; that is display precision, not an acceptance band.

The prototype makes no rhythm/pulse/tempo mastery claim, percentage, pass/fail, or recovery diagnosis. Error feedback appears after completion, and mistakes do not stop an attempt.

## Latency and calibration boundary

Audio buffering, output hardware (especially Bluetooth), input devices, browser event delivery, clock correspondence and scheduling delays can affect measured offsets. Browser latency reports do not establish end-to-end latency. Automatic session offset estimation and a tap-along fallback are now implemented under the [timing calibration policy](timing-calibration.md), including input context, explicit correction, confidence checks, session lifetime and manual reset/recalibration after setup changes. Separate hardware input/output latency measurement is not implemented. These decisions need review before results become teaching thresholds or mastery claims.

## Original performance-slice validation and limitations

The 149-test results below belong to the initial slice. See [unified validation and review](unified-activity.md#reviewed-baseline) for the current 220-test baseline and deployed browser checks.

Node 24 with `npm ci`; `npm run check` passed: strict typecheck, all 149 tests including 13 performance tests, and application/prototype build. `git diff --check` passed. [Performance tests](../../tests/rhythm-walk.test.ts) use synthetic timestamps to cover exact conversion at several tempos, compound pulse/count independence, fixtures, barline chains, correct/missing/extra input, one-to-one association and recovery, signed onset/releases, rests, deterministic replay, count-in/start boundaries, bounded late/unreleased final holds, repeats/duplicates/multiple sources, settings snapshots, cancellation and interrupted outcomes.

The native T3 collaborative browser exercised the built JS/CSS in its actual browser. Environment-port navigation failed; direct loopback navigation reached a different 404 surface despite the workspace server returning HTTP 200. The built artifacts were therefore loaded through native `preview_evaluate`, without changing app code or switching browser systems. This validates the browser app, not that preview connection or deployment routing.

[Reusable browser scenarios](../../scripts/rhythm-walk-browser-scenarios.js) are expressions for native `preview_evaluate`, after one trusted Start click unlocks audio. Set `window.__walkScenario` to `keyboard`, `tie`, `boundary`, or `interruptions`, then evaluate the file with promise waiting. Each scenario fits the tool's short execution limit. They passed for the played keyboard loop and linked review, scheduled quarter clicks, repeats, separate count-in evidence, snapshots/download, result retention, Retry/Cancel, exercise choice, metronome-off count-in, barline hold, no synthetic onset at the start, finite unreleased final input, pad/window focus loss, actual AudioContext suspension, synthetic pagehide, and synthetic pointer ownership/cancellation. Pointer scenarios stub only `setPointerCapture`, since synthetic pointer IDs cannot acquire browser-owned capture; this does not validate native touch capture. Browser scenarios use audio-clock waiting and synthetic DOM input; they do not prove physical timing accuracy.

Viewport resize/screenshot tools failed during the mobile review, and the preview later lost focus, preventing a final browser rerun after the compact-layout adjustment. Mobile layout verification remains incomplete; the successful lifecycle scenarios preceded that presentation-only adjustment. Actual visibility/background transitions, native held pointers, touch scrolling, hardware keyboard timing, sound audibility, Bluetooth/wired output latency, mobile Safari/Android, Chromebook, accessibility with assistive technology, and physical-device testing were **not performed**. Complete those checks before considering production publication. Full `npm run verify`, Cloudflare preview review and release/device acceptance were not run because this work remains a feature prototype, not a release candidate.
