Current activity contract: [Rhythm Walk now unifies Write Counts, Tap Rhythms and Both](unified-activity.md). This record preserves earlier implementation decisions; descriptions of separate activities, fixed performance-only repertoire, reset-on-reload preferences and old naming are superseded. Musical counting and notation rules remain applicable.

# Rhythm Walk performance prototype

Implemented for the owner's first playable performance slice. This is a development review surface, not a production release or an approved teaching/scoring policy.

Run Node 24, `npm ci`, then `npm run dev:walk`. Open `http://127.0.0.1:5173/prototypes/rhythm-walk/`. A regular build also emits that review page under `dist/hosted/prototypes/rhythm-walk/`, following the existing Count Writing prototype convention. There is no new suite navigation, service worker, installation entry, portable distribution, generation, persistence, progression, score, or reward. Refresh resets the page. No branch was promoted to `main`.

## Session timing correction

Automatic offset estimation and manual tap-along calibration now extend this prototype. See [session timing rules and validation](timing-calibration.md); those rules supersede the initial no-calibration behavior and count-in/capture-end policies described below. Raw timestamps remain unchanged.

## Requirements and decisions

The [original handoff](reference/RHYTHM_GAME_HANDOFF.md), especially sections 3–5 and 15, distinguishes confirmed principles from proposed architecture and open policies. The owner's implementation request now authorizes this specific slice, including holds, two measures, 4/4, quarter-note BPM, one measure of count-in, fixed fixtures, raw localized review, an exercise metronome toggle, and interrupted rather than graded cancellation. It does not approve the handoff's broader roadmap or numerical mastery policies. [Current direction](README.md) still governs Count Writing's first release; performance work is separate and may proceed in parallel with its meter work.

| Status | Scope |
| --- | --- |
| Confirmed for this slice | Conventional static notation; read through mistakes; press/hold/release; keyboard and pad; silence for rests; one attack for a tied chain; finite capture; separate raw onset/release/rest evidence; completed versus interrupted; deliberate Retry/exercise change |
| Implemented engineering choices | Pure capture and evaluator; scheduled audio-clock transport; monophonic input ownership; ordered bounded attack matching; in-memory raw records and JSON download; compact active layout |
| Provisional, replaceable | 40–180 quarter-note BPM controls, initial 80 BPM; 180 ms attack association window; 750 ms final-release tail; 120 ms scheduling lead; exact window/boundary and interruption policies below |
| Unresolved / deferred | Approved teaching tolerances; hardware-specific latency validation; articulation/legato conventions; absolute versus relational assessments; pulse/tempo mastery and evidence minimums; scores, recovery claims, progression; wider meters, generated content, long passages, final placement/navigation, persistence, physical-device support |

## Reviewed fixed fixtures

[Fixtures](../../src/apps/rhythm-walk/fixtures.ts) are curated and implementation-reviewed for exact bar totals, engraving, attack/hold boundaries, silence, and tie membership. They are not owner-approved difficulty presets or UIL templates. All use two complete 4/4 bars. At 80 quarter-note BPM the count-in is 3 seconds, the exercise is 6 seconds, and capture closes at 6.75 seconds after its start.

| Exercise | Written measures | Expected holds in quarter-note units from exercise start |
| --- | --- | --- |
| Quarter steps | Q Q Q Q / Q Q Q Q | [0,1), [1,2), … [7,8) |
| Hold, rest, and eighths | H Q E E / Q Q-rest E E Q | [0,2), [2,3), [3,3.5), [3.5,4), [4,5), [6,6.5), [6.5,7), [7,8); silence [5,6) |
| Across the barline | H Q-rest Q-tie / Q Q-rest H | [0,2), [3,5), [6,8); silence [2,3) and [5,6). The [3,5) chain references both written quarters. |

The independent renderer uses exact derived positions, a conventional single-line rhythm staff, beams, half-note heads, quarter rests, time signatures, measure labels and outgoing/incoming barline tie hooks. Its reviewed vocabulary is only these fixtures; it is not a general engraver. During capture a compact layout keeps notation, phase, pulse, pad and Stop together. Feedback is textual as well as colored, attached to each relevant SVG note/rest via accessible descriptions and titles; both tied members point to one chain result.

## Interfaces and separation

- [Timing](../../src/apps/rhythm-walk/timing.ts): `musicalSeconds(time, bpm, pulse)` converts canonical whole-note fractions at the scheduling boundary. `planPassage` consumes `derivePassage`, emitting expected sounding notes with written source references, written rest intervals, count-in/exercise pulses, duration and capture end. Performance pulses are an explicit musical fraction, independent of counting labels and `measure.groups`.
- [Capture](../../src/apps/rhythm-walk/capture.ts): `Capture(exercise, bpm, metronome, policy)` snapshots source and settings. `input(down/up, source, time, timestampMs, repeat)`, `advance(time)` and `interrupt(reason, time)` are rendering-independent, deterministic state transitions. Time is seconds relative to the exercise start. `heldBy` exposes monophonic ownership. `setClockEvidence` supplies transport anchors before input. A finished `AttemptRecord` is a detached, versioned snapshot.
- [Transport](../../src/apps/rhythm-walk/transport.ts): maps DOM timestamps onto the AudioContext timeline and schedules the whole bounded short passage once using the existing synthesized `scheduleClick`. It retains stoppable click nodes. A 20 ms poll observes clock-derived phase/end and updates the decorative pulse; that timer never schedules musical events. Audio state changes interrupt immediately. No animation frame or timer chain drives the music clock.
- [Evaluator](../../src/apps/rhythm-walk/evaluation.ts): `evaluateAttempt(record)` consumes expected events plus recorded evidence and returns matches, missing/extra attacks, signed onset/release offsets and rest intersections. Identical records return identical results without mutation or wall-clock dependencies. Interrupted records return an interrupted outcome with no graded results.
- [UI](../../src/apps/rhythm-walk/main.ts): owns ready/count-in/performing/reviewing/interrupted presentation and browser lifecycle binding, not grading math. Controls lock during capture. Space belongs only to the focused active pad. A result survives tempo/metronome edits until Retry/Start or a deliberate exercise change; JSON download preserves it externally.

No shared music-model interfaces changed. Performance imports only the canonical fraction/measure model, shared UI primitives/design tokens, and the audio click primitive. It does not import or modify Count Writing editors, answer grids, meters, generators, or evaluation. The two activity results remain separate.

Future 6/8 performance uses an explicit `[3,8]` dotted-quarter pulse. A test demonstrates two such pulses in a bar even when the measure's counting groups label all six eighths separately. The initial live UI intentionally accepts only the 4/4 fixtures and always names tempo as **quarter-note BPM**. Supporting compound meter requires adding reviewed engraving, fixtures, UI tempo-unit labeling and capture settings; changing Count Writing labels must never change this clock.

## Transport, capture and input policies

All figures below are provisional engineering choices, not approved teaching thresholds.

| Policy | Prototype behavior |
| --- | --- |
| Start and snapshot | Snapshot exercise, BPM, metronome and timing policy before awaiting audio activation. Audio must be running; failed activation/cancelled start produces an interrupted record and Retry. |
| Scheduling | Exercise start = current audio time + 120 ms lead + exact first-bar duration. Count-in has four scheduled quarter pulses; exercise clicks follow the snapshot toggle. Downbeats are accented. |
| Count-in window | `[-countIn, 0)`. Scheduling lead before that is outside capture. Accepted count-in presses/releases are retained separately from exercise attacks. |
| Exercise window | `[0, duration)`. An onset exactly at zero belongs to the exercise. |
| Final tail | `[duration, duration + 0.75)`. New presses here are extra-attack candidates, not a new final note. Releases can finish an earlier hold. At the exclusive deadline, capture completes even if still held. No synthetic release is invented; review says “no release observed.” |
| Held across start | Keep the same physical hold and owner; do not invent an exercise onset. Its count-in attack is excluded from matching. It may overlap a written rest. Release before a subsequent press can create a new attack. |
| Repeat/duplicates | Record and reject key repeats, a down while already held, and an up from a nonowner. A rejected second input is not queued or promoted when the owner releases. |
| Multiple sources | First accepted keyboard or pointer owns the monophonic hold until its release. Other pointer IDs or keyboard presses cannot add attacks or release it. The pad captures the owning pointer so release outside the pad still reaches capture. Nonprimary mouse buttons are ignored. |
| Cancellation | Stop/Cancel, pad/window focus loss, page backgrounding, page exit, audio suspension/closure, cancellation or lost capture of the active pointer end the attempt as interrupted, stop scheduled sound and retain partial raw evidence. Cancellation of an ignored pointer does not end the owning hold. No mid-note resume; Retry gives a fresh count-in. A completed record remains completed if later focus is lost. |
| Rendering | Accepted events are timestamped immediately in input handlers; DOM rendering and pulse animation cannot retime them. Pad focus is visible; status changes are announced politely; pulse changes are decorative and are not repeatedly announced. Ordinary Space behavior is preserved outside the active pad. |

Modern DOM event timestamps use the monotonic performance clock; legacy epoch timestamps are normalized using `performance.timeOrigin`. At transport creation an anchor pairs `performance.now()` with `AudioContext.currentTime`. Input maps as `anchor.audioSeconds + (eventTimestampMs - anchor.performanceMs)/1000 - exerciseStart`. This is an approximate cross-clock correspondence with no latency correction. Expected musical times are never inferred from UI frames or Count Writing slots.

Raw JSON includes schema version, source exercise, expected plan, BPM, metronome assistance, policy values, accepted and rejected events, source IDs, original DOM timestamps, mapped relative times, region/rejection reason, completion/interruption and end time. When audio starts it also includes clock anchors, absolute exercise start, sample rate and browser-reported base/output latency. Those latency values are evidence, not corrections. Evaluation can be rerun with a new policy against the retained raw timings; source events also support deriving a new plan. Download or copy the record before Retry if it needs to outlive the current review. This is not an account/history storage schema.

## Deterministic evaluation policy

Pair accepted downs with their owner releases first; a still-held input retains a null release. Exclude count-in attacks from association, but include their audible-time interval in silence/rest intersections. Attack matching is ordered, one-to-one, maximizing the number of matches within an inclusive ±180 ms window, then minimizing total absolute onset offset. Stable ties prefer the matching candidate, then the missing-input branch. Gaps do not advance both sides, so a missing or extra attack cannot mechanically shift every later match. This bounded policy remains ambiguous if timing deviates far enough to resemble a neighboring note; results describe associations, not inferred intent.

Release times never influence attack matching. Only after association, report `press - expected onset` and `release - expected end` (negative early, positive late). Missing attacks do not receive invented release offsets. Intersect each recorded hold with each written rest's half-open interval, clipping an unreleased hold to capture end and reporting positive overlap duration. An extra attack during a rest can therefore produce both an extra attack and rest overlap; those are separate evidence, not penalties summed into a score. When session timing correction is active, the explicit saved offset is applied equally to both edges; raw results remain available. Attempts are never independently recentered or stretched. Display rounds to milliseconds, with sub-half-millisecond values shown as 0; that is display precision, not an acceptance band.

The prototype makes no rhythm/pulse/tempo mastery claim, percentage, pass/fail, or recovery diagnosis. Error feedback appears after completion, and mistakes do not stop an attempt.

## Latency and calibration boundary

Audio buffering, output hardware (especially Bluetooth), input devices, browser event delivery, clock correspondence and scheduling delays can affect measured offsets. Browser latency reports do not establish end-to-end latency. Automatic session offset estimation and a tap-along fallback are now implemented under the [timing calibration policy](timing-calibration.md), including input context, explicit correction, confidence checks, session lifetime and manual reset/recalibration after setup changes. Separate hardware input/output latency measurement is not implemented. These decisions need review before results become teaching thresholds or mastery claims.

## Validation evidence and limitations

Node 24 with `npm ci`; `npm run check` passed: strict typecheck, all 149 tests including 13 performance tests, and application/prototype build. `git diff --check` passed. [Performance tests](../../tests/rhythm-walk.test.ts) use synthetic timestamps to cover exact conversion at several tempos, compound pulse/count independence, fixtures, barline chains, correct/missing/extra input, one-to-one association and recovery, signed onset/releases, rests, deterministic replay, count-in/start boundaries, bounded late/unreleased final holds, repeats/duplicates/multiple sources, settings snapshots, cancellation and interrupted outcomes.

The native T3 collaborative browser exercised the built JS/CSS in its actual browser. Environment-port navigation failed; direct loopback navigation reached a different 404 surface despite the workspace server returning HTTP 200. The built artifacts were therefore loaded through native `preview_evaluate`, without changing app code or switching browser systems. This validates the browser app, not that preview connection or deployment routing.

[Reusable browser scenarios](../../scripts/rhythm-walk-browser-scenarios.js) are expressions for native `preview_evaluate`, after one trusted Start click unlocks audio. Set `window.__walkScenario` to `keyboard`, `tie`, `boundary`, or `interruptions`, then evaluate the file with promise waiting. Each scenario fits the tool's short execution limit. They passed for the played keyboard loop and linked review, scheduled quarter clicks, repeats, separate count-in evidence, snapshots/download, result retention, Retry/Cancel, exercise choice, metronome-off count-in, barline hold, no synthetic onset at the start, finite unreleased final input, pad/window focus loss, actual AudioContext suspension, synthetic pagehide, and synthetic pointer ownership/cancellation. Pointer scenarios stub only `setPointerCapture`, since synthetic pointer IDs cannot acquire browser-owned capture; this does not validate native touch capture. Browser scenarios use audio-clock waiting and synthetic DOM input; they do not prove physical timing accuracy.

Viewport resize/screenshot tools failed during the mobile review, and the preview later lost focus, preventing a final browser rerun after the compact-layout adjustment. Mobile layout verification remains incomplete; the successful lifecycle scenarios preceded that presentation-only adjustment. Actual visibility/background transitions, native held pointers, touch scrolling, hardware keyboard timing, sound audibility, Bluetooth/wired output latency, mobile Safari/Android, Chromebook, accessibility with assistive technology, and physical-device testing were **not performed**. Complete those checks before considering production publication. Full `npm run verify`, Cloudflare preview review and release/device acceptance were not run because this work remains a feature prototype, not a release candidate.
