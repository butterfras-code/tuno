# Uno234 musical assessment: first slice

These are initial tuning defaults, not mastery standards. There is no combined score,
pass/fail, progression, diagnosis, or history. The canonical written-event passage
is the source for sounding attacks, rests, durations and tied chains. All current
presets, meters and generated lengths use the same implementation.

## Layers and immutable interpretation

[Capture](../../src/apps/rhythm-walk/capture.ts) records original down/up timestamps,
accepted/rejected input and regions. [Evidence](../../src/apps/rhythm-walk/evidence.ts)
derives paired edges with the existing constant input-specific session correction.
The same correction applies to both edges, preserving measured durations. Session
calibration is separate: the existing first-session estimate/manual setup remains;
assessment never estimates an offset, fits an intercept, moves individual notes or
stretches sections. Retry snapshots current preferences and the saved session offset.

[Assessment](../../src/apps/rhythm-walk/assessment.ts) is a pure deterministic function
of the canonical exercise and attempt, with no clock, randomness, storage or UI access.
Attempts snapshot [assessment policy version 1](../../src/apps/rhythm-walk/assessment-policy.ts)
and the centralized articulation policy. Legacy evidence lacking a scoring policy
uses the version-1 defaults. Completed results retain their original exercise, target
BPM, style, offset and policy when settings/mode change. JSON evidence downloads keep
all raw events and include the policy, computed assessment, estimates, counts, matched
indices, residuals, unavailable reasons and interval coverage; replay is deterministic.
[Presentation](../../src/apps/rhythm-walk/results.ts) owns rounding and learner labels.

The old target-relative 180 ms attack association, rest feedback, score coloring and
received timelines remain independent. Analytical tempo association never overwrites
them. A high percentage at performed tempo can coexist with visible target drift.
Accepted early attacks at rest boundaries retain their raw intrusion evidence without
an additional numerical penalty. Actual bars use corrected received edges, never
analytically scaled edges.

## Bounded tempo association and confidence

Expected attack positions are derived in seconds at target tempo, then multiplied by
one overall scale `s`, anchored to calibrated exercise start (intercept exactly zero).
The performed beat is `targetBeat × s`; performed BPM is `targetBPM / s`. Pulse is a
quarter in supported simple meters and a dotted quarter in 6/8, independent of writing
counts and unequal note values/rests.

The scale search is bounded to **2/3–1.5** (BPM 150%–66.7% of target), excluding half
and double tempo. Candidates include target, a uniform 120-step inclusive grid, and
observed-time/positive-expected-time ratios rounded to .001 within bounds. Ordered
one-to-one edit association searches all captured eligible attacks, independently of
surviving target-time matches. Missing and extra attacks each cost 1; a match costs
absolute onset residual divided by the zero-credit window. Residuals beyond 1.5 times
that window cannot match. Stable cost ties prefer more matches.

Each candidate is refined twice using the median of matched `actualTime/expectedTime`
ratios at positive expected positions, clamped to bounds, followed by reassociation.
This robust anchored fit accounts for unequal durations and silence, rather than
averaging inter-tap intervals. Candidates sort by edit cost, then coverage, then
proximity to target. Two distinct paths are retained for a final best-scale ambiguity
check. A different association within `max(.12, .02 × max(expected, observed))` edit
cost of the best is ambiguous, including alternatives at the same tempo. Ratios and
search are bounded; more than 128 expected or 256 captured eligible attacks withholds
assessment and preserves raw evidence. This bound exceeds the reviewed repertoire.

Measured tempo requires **four matched attacks spanning three performance beats**,
a nonambiguous association, and median absolute anchored residual no greater than
15% of the performed beat. It is not inferred from releases. Dense inconsistent or
ambiguous attempts withhold rhythm percentage and explain why. Sparse attempts (fewer
than four attacks or insufficient span) use **Rhythm accuracy at target tempo**, only
if target association is unambiguous. They do not use an uncertain relative-pattern
fit. Empty or completely missed nonempty exercises receive 0%; rest-only exercises
receive rest feedback with no fabricated percentage. Missing every other note cannot
become 100% through a half/double-tempo reinterpretation.

Capture now remains open through `1.5 × target duration + release grace + positive
saved offset`, so the slowest supported fit can retain its final attack/release.
Target duration, count-in, metronome scheduling and received coordinates are unchanged.
This adds a bounded final-input wait, including for faster/exact/silent attempts.
Input beyond this bound remains outside capture; tempos beyond the fitting bounds
have no promised relative-pattern interpretation.

## Rhythm accuracy

For performed beat duration `b` (or target beat for the explicit sparse fallback):

- Full-credit window: `clamp(.10 × b, .030, .060)` seconds.
- Zero-credit window: `clamp(.30 × b, .090, .180)` seconds.
- Attack credit: 1 within the full window; 0 at/beyond the zero window;
  linear between, using absolute anchored onset residual.
- Missing attacks contribute zero. Silence gives no bonus.

`rhythm = 100 × sum(attack credits) / (expected attacks + extra attacks)`.
One extra attack during a rest increases the denominator once; rest evidence is
retained separately. Eight exact attacks give 100%; seven exact plus one missing
produce 87.5% → **88%**; eight exact plus one extra produce 88.89% → **89%**.
Percentages use `Math.round` only in presentation, never in assessment.

## Hold accuracy (Tap + Hold only)

Use the same tempo basis as rhythm, with sounding-chain duration and end scaled by
`s` (or target for fallback). Centralized release policy v2 (new attempts) uses:

- Ordinary early/late release allowance: `min(.060 s, .10 × sounding duration)`.
- For adjacent separate notes, replace early allowance with
  `min(.25 × sounding duration, .180 s, .25 × final written segment duration)`;
  do not add allowances. For an untied note, final segment duration equals its
  sounding duration. The final-segment cap keeps tie boundaries fully sustained.
- Meaningful sustain: at least `.70 × expected sounding duration`.

Beyond the allowed release window, credit declines linearly to zero over an
additional `min(.25 × sounding duration, .200 s)` error. Missing release earns zero.
To handle short holds deterministically, cap release credit by
`clamp(actual duration / meaningful-sustain minimum, 0, 1)`. Thus a short hold cannot
receive full credit just because its release is close. Negative/zero duration earns
zero. Internal tie boundaries have no allowance: a tied chain is one continuous note;
an internal release truncates it and a reattack is extra.

The separate-note lift allowance was widened from v1's 15% / 80 ms after review
showed that the expected continuous bars suggested an impossible uninterrupted key
hold between separate attacks. At 80 BPM an adjacent quarter permits a 180 ms lift;
an adjacent eighth permits 93.75 ms. The 70% meaningful-sustain rule still applies,
so this is permission to lift briefly, not to omit the note's duration. Beyond this
wider band, the same linear release-credit decay remains. Rest-boundary/final release
allowances, overhold penalties, rhythm accuracy and tempo estimation are unchanged.

Capture snapshots `evaluationPolicy.version: 2` and its numerical values. Existing
v1 snapshots (including snapshots without a version field) keep their original values;
records without any evaluation policy explicitly fall back to frozen v1 defaults.
Policy changes therefore never reinterpret old results or old evidence downloads.

Average credits equally across matched sounding notes, independent of length. Missing
attacks affect rhythm and do not create zero-credit holds. Display the played-note
denominator; no matched notes means unavailable, not 100%. Tap hides this metric while
retaining release evidence.

## Tempo and pulse steadiness

Tempo difference is `100 × (performedBPM / targetBPM − 1)`. Display rounded BPM,
whole-number absolute percent faster/slower, and target. Inclusive descriptions:
up to 5% **On target**; over 5% through 10% **Slightly slower/faster**; over 10%
**Slower/Faster**. Evidence below the confidence minimum says Not enough evidence.

For consecutive matches with consecutive expected and observed indices, divide
observed elapsed seconds by expected elapsed performance beats. Exclude intervals
crossing missing or extra attacks. At least **four usable intervals collectively
spanning four beats**, plus confident tempo association, are required.

Typical variation uses robust spread divided by median local beat duration:

`100 × max(1.4826 × MAD, (Q75 − Q25) / 1.349) / median`.

MAD is the median absolute deviation from the median. Quartiles use linear
interpolation at `(n−1) × q` in sorted local durations. The IQR term prevents MAD from
collapsing to zero for uneven alternating repeated values with an odd interval count.
Both are robust normal-scale estimates. This deliberately extends the starting MAD
proposal; it describes typical variation, not whether every beat was correct.
Inclusive descriptions: up to 5% **Steady**, over 5% through 10% **Mostly steady**,
over 10% **Uneven**. A consistently slower performance can still be Steady.

## Results lifecycle and accessibility

Completion disposes transport, stops scheduled audio and ends capture before replacing
only the performance surface with a compact results panel. Score, target-time feedback
and timelines remain visible; Both restores the independent written answer. The results
heading is focusable but noninteractive and receives focus once on completion, providing
the completion announcement without a second live-region announcement. A finishing
Space/pointer release cannot activate result actions; hidden-pad click synthesis is
ignored. Interrupted attempts show ungraded evidence and retry.

Expected timeline bars retain full written extents at target tempo. Before an
adjacent **separate sounding note**, the allowed early-release portion is dashed and
the preceding sustain section is solid. Titles, SVG accessible text and a visible
review legend explain that lifting in the dashed portion is permitted. Bands use the
attempt's captured release policy and target tempo, while hold accuracy still uses
its labeled assessment tempo. Bands appear at sounding-chain ends only: internal tie
boundaries and tied barline continuations remain solid. A separate note across a
barline gets a band at the preceding note's end. Before rests and at the final note,
no separate-note lift band appears. Received bars and all actual edges are unchanged.

**Try again** keeps exercise identity, notation and written answer, removes performance
results, restores the pad and starts the ordinary count-in with current preferences.
**Next exercise** uses the shared generator/replacement lifecycle and clears writing,
performance results/review and timelines. Invalid generation disables Next and explains
why; fixing settings re-enables it without reinterpreting results. Mode/settings changes
retain completed results. Active mode/page changes cancel capture/calibration safely.

## Validation and remaining limits

[Deterministic fixtures](../../tests/rhythm-assessment.test.ts) independently specify
observed times and expected scores/BPM, covering exact, bounded steady slower/faster,
target-window drift, unequal values/rests, missing/extra/rest-boundary attacks,
alternating pace, gradual acceleration/deceleration, short/allowed/overheld/missing
releases, ties/barline continuations, 6/8, sparse/silent/all-missed/ambiguous attempts,
input-specific fixed correction, duration preservation, policy snapshot/replay,
threshold endpoints, rounding, half/double-tempo protection, and bounded real capture.
Catalogue/generator coverage exercises both styles across every preset and supported
meter/length; those broad exact fixtures use canonical derived times, distinct from
the independently specified numerical examples.

[Native browser scenarios](../../scripts/rhythm-assessment-browser-scenarios.js) exercise
keyboard and synthetic pointer completion/release safety, Both independence, target
review retention, downloads, settings/mode retention, invalid configurations, retry
with current preferences, Next clearing both, cancellation, 6/8 and narrow layout.
Synthetic timestamps allow a small browser-clock tolerance; numerical thresholds are
validated in deterministic tests. Invented pointer capture and background-preview
focus predicates are scoped stubs. These are automation checks, not physical-device
latency, real touch delivery or screen-reader acceptance.

2026-10-11 validation: `npm run check` on Node 24 passes type checking, **252 tests**,
and hosted/portable builds. Native T3 browser passed desktop keyboard, pointer,
steady slower, 6/8 and cancellation scenarios, plus the pointer/results lifecycle
at a 375 CSS-pixel viewport without horizontal overflow. Existing accepted early
rest-boundary scenarios pass in both Tap and Tap + Hold, and the early barline
attack/sustain geometry regression passes at 375 CSS pixels. Browser-local localhost initially
served an older build, so current built JS/CSS were injected into the native preview
(font payload omitted). Preview resize timed out; narrow checks use a 375 CSS-pixel
iframe in that same native browser. Physical devices and release preview acceptance
remain unverified. No production publication is part of this slice.

Release-policy v2 follow-up: `npm run check` passes **258 tests**, type checking and
hosted/portable builds on Node 24. New deterministic cases verify the 180 ms quarter
boundary, shorter-note proportional bands, gradual penalties, truncated holds,
v1 replay (a 60% v1 example becomes 100% only for a new v2 attempt), unchanged rhythm
and tempo, target-time geometry, barline adjacency and final short tie-member sustain.
The [lift browser scenarios](../../scripts/rhythm-lift-browser-scenarios.js) pass
keyboard and synthetic pointer full-credit lifts, rendered bands and accessible
legend/titles, policy retention and cancellation at 375 CSS pixels with no horizontal
overflow. Existing 6/8 tied-barline geometry/retention/retry checks also pass. Native
T3 preview uses the current built code in the same narrow iframe described above;
synthetic focus/pointer/timestamp stubs do not constitute physical-device validation.
The original screenshot's exact attempt cannot be regraded without its timing file;
this tuning deliberately preserves completed attempts' original interpretation.
