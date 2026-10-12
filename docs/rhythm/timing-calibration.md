# Uno234 session timing correction

This policy belongs to Tap Rhythms within the [unified Uno234 activity](unified-activity.md). Mode switches preserve the saved offset; active calibration/capture is canceled safely. Shared preferences use a separate store.

Tap / Tap + Hold does not change calibration. Every new attempt snapshots its play style and evaluation policy alongside the fixed, input-specific session offset. Corrected down/up edges subtract the same constant, so `correctedUp − correctedDown = rawUp − rawDown`; changing the play style cannot refit or stretch an attempt. Completed results retain their original style and correction. Tap still records both edges even though release/sustain are not graded; Tap + Hold uses corrected actual durations for evaluation and timeline bars. [Policy/geometry tests](../../tests/rhythm-play-style.test.ts) cover retained raw evidence, duration invariance, input isolation and detached snapshots. The existing automatic first-session estimate and explicit manual replacement remain unchanged; no later attempt changes this session correction. Assessment v2 may fit a separate analytical starting displacement to interpret musical spacing and rests; it does not move either received edge or attribute that displacement to learner/device delay. See [assessment policy](assessment.md).

The owner requested automatic normalization of a consistent timing offset, with tap-along calibration as a fallback, measured once per session. This extends the first performance prototype; it does not introduce mastery scores or stretch a performance to match the score.

## Learner behavior

In Tap Rhythms or Both, **Calibrate** beneath the performance pad opens the Timing setup dialog. Escape, Close timing setup or backdrop dismissal cancels active calibration and preserves the previous offset. Timing setup defaults to automatic estimation. After a completed performance with enough consistent attacks, the app estimates one constant offset, displays it, corrects that review, and saves it for this tab's session (including reloads). Every subsequent attempt snapshots the saved value. Retry does not refit it. Reset timing clears it; turn automatic estimation off to continue without automatic correction. The automatic-estimation checkbox is page-local and defaults on again after reload; the measured offset persists for the tab session. Tap-along calibration can replace it explicitly.

The value belongs to the input method used to measure it: keyboard or touch/mouse. Other input methods remain uncorrected. Use the same audio output and input setup; explicitly recalibrate when changing headphones, speakers, or input method. Browser device-change detection is not relied on. Session storage failures fall back to memory. Stored values are validated before use.

The label is **estimated timing offset**, not measured hardware latency. Performance evidence cannot distinguish output/input delay from a learner's consistent anticipation or lateness. An estimate includes both. No correction is silently inferred from sparse, interrupted, inconsistent, mixed-input, or ambiguously aligned evidence.

## Automatic estimation

`offset.ts` uses the same ordered one-to-one attack association as grading, extracted into `alignment.ts`. Candidate offsets lie within ±400 ms. Each is refined using the median matched attack difference. Acceptance requires at least six attacks, at least 80% coverage of the larger expected/observed sequence, residual matching within 80 ms, and first-half versus last-half median difference no greater than 60 ms. A competing candidate more than 100 ms away with almost as many matches and similar mean error rejects the estimate. These are provisional engineering thresholds. Dense, repetitive eighth-note patterns can be ambiguous; Quarter steps or manual calibration is the fallback.

Only downs are used to estimate timing. Releases do not influence attack association. One constant is subtracted from both edges, retaining intervals, hold lengths, tempo drift, mistakes, and raw evidence. No time scaling or per-note correction occurs. Signed offsets support both anticipation and delay. A saved offset is never replaced merely because a later exercise has a different offset.

## Tap-along fallback

Listen to four warm-up clicks, then tap once with each of twelve clicks at 80 quarter-note BPM. Clicks are scheduled on the same audio clock with the same click sound as performance. Input uses the same performance-to-audio timestamp mapping. Warm-up taps are ignored. At least nine distinct taps are required; duplicate taps for one click are discarded, and offsets outside ±350 ms are excluded. Median residual and drift checks reject inconsistent sessions. Cancellation, focus/background changes, audio interruption, and pointer cancellation stop playback and preserve the previous correction. Practice controls lock during calibration.

This is a tap-along estimate of perceived timing, not an instrument-grade measurement of separate input and output latency. Delays beyond the bounded search and beat-phase ambiguities are outside the reliable range. It does not compensate for changing or unstable Bluetooth latency.

## Evidence and boundaries

Raw `InputEvent.time`, original DOM timestamps, accepted/rejected flags and capture regions remain unchanged. `AttemptRecord.timingOffset` snapshots the applied value, input kind, estimation method, sample count, spread, and version. The evaluator accepts an explicit null offset to reproduce raw grading; the review exposes raw results and downloads retain all original events. Corrected hold coordinates exist only in derived evaluation.

For the calibrated input, an attack whose corrected time falls within the first attack's early matching window can associate with it, even if its raw capture region was count-in. Earlier held count-in input still creates no synthetic attack. Capture now includes the bounded slower-tempo tail described in [musical assessment](assessment.md), plus an additional positive saved offset so the final release retains the same grace period after correction. Rest-overlap calculations use corrected edges, including correction of an unreleased hold's end bound. Uncalibrated input retains the original count-in policy.

## Validation

Deterministic tests reproduce the owner's eight taps at 80 BPM (0.287, 0.999, 1.754, 2.525, 3.271, 4.000, 4.696, 5.476 seconds): raw association finds no matches, while a median offset of about 252 ms recovers all eight. Coverage includes ambiguous rhythms, sparse/noisy/drifting patterns, signed offsets, fixed correction on later attempts, raw-data retention, source isolation, releases/rest overlaps, session validation, and manual duplicates/misses.

`scripts/rhythm-walk-offset-browser-scenarios.js` provides native-browser scenarios for automatic correction, fixed reuse, manual calibration and cancellation. Synthetic browser timestamps and audio-clock waits verify the UI/lifecycle, not physical-device timing accuracy. Hardware output/input testing remains a separate acceptance step.

Original calibration-slice validation on 2026-10-11 (177 tests at that commit; see [unified validation](unified-activity.md#validation-and-remaining-limits) for the later 220-test baseline): `npm run check` passed all **177 tests**, type checking, and hosted/portable builds. Native browser checks passed automatic estimation of a simulated 250 ms delay, unchanged correction on a later 320 ms-delay attempt, manual keyboard and synthetic touch calibration, cancellation preserving the prior value, restoration after page navigation/reinitialization, raw review/evidence, and existing keyboard/tie/boundary/interruption scenarios. Layout had no horizontal overflow at 375 CSS pixels. Local-server access was unavailable to the remote browser, so the actual built JS/CSS were loaded into a native preview document for these checks; deployment routing is checked separately. Synthetic touch capture was stubbed as documented in the scenario file. Real hardware timing remains unverified.
