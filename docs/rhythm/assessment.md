# Uno234 musical assessment

Assessment v2 and hold policy v4 are provisional tuning defaults for musical feedback,
not mastery standards. Rhythm accuracy, hold accuracy, tempo and steadiness stay
independent. There is no combined score, progression, new vocabulary or publication.
The canonical written passage supplies attacks, rests, sounding chains and pulse.

## Evidence, calibration and compatibility

Capture preserves raw DOM timestamps, mapped times, input ownership, rejected events,
count-in regions and completion status. The fixed input-specific session correction
subtracts the same constant from press and release, preserving elapsed duration.
Automatic first-session calibration and manual calibration retain their existing rules.

Assessment fits an analytical starting displacement. It never changes that session
correction, rewrites received timestamps, shifts individual notes, snaps bars, or
stretches sections. Displacement cannot distinguish learner timing from residual device
or clock delay; results make no attribution. Expected timelines remain at target time.

New attempts snapshot [assessment policy v2 and hold policy v4](../../src/apps/rhythm-walk/assessment-policy.ts),
as well as the existing capture, articulation and calibration policies. Assessment v1
snapshots and records lacking an assessment policy use the retained
[legacy estimator](../../src/apps/rhythm-walk/legacy-assessment.ts), including their saved
v1/v2 articulation interpretation. They are never silently upgraded. Assessment v2 attempts with a saved hold v3 policy,
or no hold-policy snapshot, retain v3 sustain scoring without a short-note exemption. UI wording may
change, but completed evidence, numerical interpretation and visual policy do not.

Downloads include raw evidence and computed assessment: versions and full policy
values, tempo basis, fit confidence evidence and bounds, analytical displacement,
matched indices, missing/extra counts, attack residuals, actual elapsed durations,
expected durations, full-credit limits, final tied member, eligibility, assessed duration, waived final duration, hold credits, analytical
rest intrusions and reasons for unavailable metrics. Target-relative intersections
remain inspectable in Timing evidence and through raw replay. Interpretation is pure
and deterministic; completed results survive preferences, pages and mode changes.

## Independent tempo and starting displacement

For corrected observed attack `a`, target musical attack time `e`, scale `s` and
starting displacement `d`, fit `a ≈ d + e × s`. Performed BPM is `targetBPM / s`.
One global scale and one displacement apply to the entire passage. Timing uses exact
musical spacing, including unequal note values and rests. 6/8 uses dotted-quarter
pulses; written counts still number six eighths.

The bounded search uses 121 inclusive scale seeds between **2/3 and 1.5** and three
starting displacement seeds (negative bound, zero, positive bound). Displacement is
bounded by **min(150 ms, 30% of the target performance beat)**. These bounds exclude
half/double tempo and discourage shifting repetitive attacks onto neighboring notes.

Each seed uses ordered one-to-one edit association. Missing and extra attacks each
cost 1; matches cost absolute residual divided by the zero-credit attack window.
Residuals above 1.5 times that window cannot associate. Refine three times: scale is
the median of all matched pairwise slopes `(a₂−a₁)/(e₂−e₁)`; displacement is the median
of `a−e×s`. Clamp search parameters, then reassociate. Sort by edit cost, match count,
proximity to target scale and proximity to zero displacement. Release never influences
association. Two distinct paths are retained in the final same-fit ambiguity check.
A competing path within `max(.12, .02 × max(expected, captured))` cost is ambiguous.

Measured tempo needs **four matched attacks spanning three target musical beats**, a
nonambiguous association and median absolute residual at most **15% of a performed
beat**. The unclamped median spacing scale and median displacement must also lie
inside the bounds: a saturated search cannot claim confidence for out-of-range input.
More than 128 expected or 256 eligible captured attacks withholds analysis. Search,
refinement and input volume are finite; no local sections are refitted.

Dense ambiguous, inconsistent or out-of-bounds evidence withholds numerical rhythm
and tempo. Sparse evidence uses an explicitly labeled **target-tempo fallback**, with
zero analytical displacement, only if target association is clear. All-missed attempts
have zero rhythm credit and unavailable hold/tempo, rather than fabricated played
notes. Rest-only attempts have rest evidence but no rhythm/hold/tempo percentage.
Interrupted attempts are ungraded. Missing first notes and extra attacks retain their
penalties; skipping alternating notes cannot produce a perfect interpretation.

Capture ends at `target duration + 300 ms + max(0, fixed session offset)`.
The deadline never scales with performed tempo or the analytical search bounds.
Final holds and rests retain their complete written duration; an unreleased input
stays unreleased at the deadline. Slower unfinished attempts are completed and
scored from captured evidence, including missing notes. Reliable slower-tempo
assessment with missing trailing notes prompts “You fell behind the beat. Try a
slower tempo.” Sparse or ambiguous evidence retains the existing neutral feedback.
Saved attempts retain their captured deadline and timing policy.

## Rhythm and steadiness

For assessment beat `b` (performed, or target in the fallback):

- Full attack credit through `clamp(.10 × b, .030, .060)` seconds.
- Zero attack credit at `clamp(.30 × b, .090, .180)` seconds.
- Linear credit between these limits, using `abs(a−d−e×s)`.
- `rhythm = 100 × sum(attack credits) / (expected attacks + extra attacks)`.

Missing attacks contribute zero; extra attacks increase the denominator once. Silence
is not a score bonus. A small consistent displacement does not reduce relative rhythm.

Steadiness uses consecutive matches with consecutive expected and observed indices,
excluding intervals crossing missing/extra attacks. Divide each observed interval by
its expected musical beat spacing. Require four usable intervals spanning four beats
and confident tempo. Typical pace variation is
`100 × max(1.4826 × MAD, (Q75−Q25)/1.349) / median(local beat durations)`.
Quantiles interpolate at `(n−1)×q`. Presentation descriptions follow reward policy v1: Steady through 7%, Mostly steady
through 12%, Uneven above 12%. Assessment computation is unchanged. A steady slower performance can still be Steady.
Tempo descriptions are On target through 5% difference, Slightly faster/slower through
10%, Faster/Slower above 10%. These are separate descriptions, not mastery claims.

## Hold eligibility and optional tied tail: policy v4

Use **400 ms** at the assessment tempo (confident performed tempo, otherwise the
existing explicit target-tempo fallback). This is a provisional acceptance policy,
not a measured universal hardware limit. A sound shorter than 400 ms has no hold
credit and is excluded from the denominator; exactly 400 ms is eligible. A 1 ns
comparison epsilon only absorbs floating-point conversion at the boundary. Attacks
still count normally. When all matched sounds are short, report **Hold not
assessed—short notes only**, without a percentage or a short-sustain warning.

Eligibility uses the **entire sounding tie chain**, before any exemption. For an
eligible chain, if its final written member alone is shorter than 400 ms, waive that
member from required sustain. Apply the usual sustain formulas below to the remaining
portion and its last retained member. Remove only one member, never successive short
members. A 250 + 250 ms chain is eligible and requires sustain in its first member;
a 375 ms total chain is wholly excluded. A final member of exactly 400 ms is required.

The original full sounding duration still determines the overhold limit and long
penalty curve, and written rest boundaries do not move. Holding through the optional
member is fully accepted. Ties retain one attack and one continuous physical press;
a reattack is extra. This deliberately accepts some shortened tied rhythms without
trying to distinguish a release cue from a continuing rhythmic pattern.

For example, at quarter = 80, a half tied across a barline to an eighth lasts 1,875 ms.
The final 375 ms is optional; assess the preceding 1,500 ms with normal tolerances.
Before a rest, full credit starts at 1,180 ms of elapsed hold and extends through
1,955 ms, including the original overhold allowance. A chain ending in several short
members still requires sustain in the penultimate member.

Short excluded notes retain raw press/release evidence and independent rest-intrusion
feedback. They never enter the hold denominator, even when they intrude into a rest.
Eligible holds still combine duration/rest credit using the strongest issue. Details
report the actual number of assessed notes and identify optional tied tails; score
and timeline feedback do not flag an ordinary exempt tap as short sustain.

## Sustain formulas (v3 baseline, applied to eligible v4 sounds)

Tap remains attack-only. Tap + Hold compares **corrected release − corrected press**
with the intended sounding duration at the same assessment tempo. An absolute target
release deadline is evidence, not the sustain rule. Missing attacks do not create
zero-credit holds; hold accuracy averages equally across eligible matched played notes only (all matched
notes for saved v3 attempts).
No eligible matched notes means unavailable. For an eligible hold, a missing release
earns zero without an invented up.

For v4, use the retained portion and its last member for the minimum, short-credit
and final-member formulas; keep the original full duration for maximum and long
credit. All times below are seconds. Let `D` be intended sounding duration, `F` the final
written member's duration (ordinary notes have `F=D`), `L` elapsed hold, and `r=.70`
before a separate adjacent note or `.80` before a rest/final end. Define:

```
m(x) = max(.60*x, r*x - .020, min(.040, x))
minimum = min(D, max(.040, .60*D, r*D-.020, D-F+m(F)))
maximum = D + min(.080, .15*D)
short credit = clamp(1 - (minimum-L)/(.60*minimum), 0, 1)
long credit  = clamp(1 - (L-maximum)/(.75*D), 0, 1)
sustain credit = 1 within [minimum, maximum], otherwise short/long credit
final-member cap = clamp((L-(D-F))/m(F), 0, 1)
duration credit = min(sustain credit, final-member cap)
```

An eligible hold with a null release gives zero credit. The **20 ms** practical allowance is bounded by a
**60%** duration floor and **40 ms** minimum (capped at the whole intended duration for
very short notes). A brief tap cannot satisfy eligible meaningful sustain. For a 500 ms note,
full sustain starts at **330 ms** before a separate note or **380 ms** before rest/end;
350/400 ms holds therefore comfortably earn full credit. Full overhold extends to
575 ms. For saved v3, a 166.7 ms adjacent eighth has a 100 ms minimum; an 83.3 ms domain sixteenth
has a 50 ms minimum. V4 excludes both from hold scoring. This refinement does not expand vocabulary; the PR base now supplies reviewed sixteenth UI support.

For saved v3, the final-member requirement prevents a long tie from hiding omission
of its final short member. V4 applies this requirement to the last retained member
after the optional-tail rule above. Releasing at the start of the required member gets zero chain-duration credit.
Ties still require one physical uninterrupted hold: internal written boundaries have
no articulation permission. A reattack is extra; there is no joining of split holds.
Separate notes still need a real release followed by a new attack.

Gradual short/long curves avoid a sudden collapse just outside full credit. Zero
sustain credit is reserved for holds below 40% of the minimum or overholds beyond the
maximum plus 75% of intended duration. The final-member cap can lower truncated tie
credit sooner, because continuity through the required portion of the chain matters.

## Musical silence without duplicate penalties

Locate written rests at `d + target rest time × s`, using the same analytical basis.
Intersect actual corrected holds, including holds begun in count-in, with those rest
intervals. Preserve every target-relative intersection separately as raw evidence.
A matched accepted early attack for the note immediately following a rest uses its
attack acceptance once; it is not an additional hold/rest mistake.

Allow **min(60 ms, 15% of rest duration)** intrusion. Beyond it, rest credit declines
linearly over an additional **60% of rest duration**. For a 500 ms rest this accepts
60 ms, then reaches zero at 360 ms overlap. A matched hold's final credit is the
**minimum** of duration credit and applicable rest credits, never a sum of deductions.
Rest evidence identifies extra attacks separately from sustained overlap.
Extra rest attacks retain the one extra-attack penalty; their rest evidence supplies
musical feedback without adding another numerical score. Tap assesses rest attacks,
not release/overhold intersections.

## Shared outcomes and child-facing feedback

New-policy score annotations, received timeline colors and results consume the same
assessment association and accepted outcomes. Small variations within full-credit
bands stay accepted everywhere. Actual received attacks and sustain endpoints remain
at their recorded corrected positions. Unavailable assessment is neutral, not a red
mistake or an accepted-performance claim. Expected bars always show target duration;
new-policy timelines have no fixed target-time shaded/dashed full-credit lift promise.
Guidance is: lift between separate notes, hold through ties, release for rests. Precise
elapsed limits and target timing remain available on inspection/in Details.

Results actions and Details replace the pad after completion. The shared Treat Bag
owns the one short evidence-backed musical summary and at most one suggestion. Numerical percentages, precise BPM/target
comparisons, milliseconds, displacement and technical explanations are in collapsed
**Details** / **Timing evidence**. A high rhythm score with tempo drift says “You kept
the rhythm at a different pace”; Details explains target bars versus received input.

Feedback selection is deterministic:

1. Interrupted, rest-only, unavailable, all-missed and sparse evidence use their own
   truthful messages. Sparse/ambiguous evidence never earns broad rhythm praise.
2. A clear performed-tempo pattern at least 90% can
   say “You kept the rhythm!” (or name the different pace). Otherwise describe partial
   written rhythm without mastery or invented recovery claims.
3. Prefer extra attacks during rests in either style. Only Tap + Hold also considers
   substantial sustained rest intrusion (credit below .5) or repeated intrusion.
   Tap retains overlap as evidence without giving hold-related criticism.
4. Then suggest sustain/release work for two hold credits below .8, or one below .4.
5. Then suggest consistent pace if steadiness is Uneven; then concrete attack guidance
   for missing/extra attacks or rhythm below 85%.

A tiny release deviation does not trigger a hold suggestion. Hold suggestions identify
short sustain, missing releases or prolonged holds, rather than “outside tolerance.”
Rest-only silence praise in Hold requires no sounding overlap, including count-in
holds; Tap remains attack-only. No diagnoses, mastery or recovery are inferred.

## Lifecycle, accessibility and validation

Completion stops transport/audio before replacing the pad. Focus moves once to a
noninteractive results heading. Finishing keyboard/pointer releases and synthesized
hidden-pad clicks cannot activate actions. **Try again** retains exercise and the
independent written response, and snapshots current preferences for a fresh count-in.
**Next exercise** uses shared replacement and clears both responses, review and
timelines. Invalid generation disables Next with an explanation. Preferences and
mode/page changes retain completed results; active changes interrupt safely.

[Deterministic cases](../../tests/rhythm-assessment.test.ts) specify observed timings
independently of scorer formulas. They cover exact/80 ms displaced 120 BPM; slower,
faster and displaced versions; missing first, early extra, alternating skips,
ambiguity, fit bounds, own-attack sustain, 70/80% duration, short eighths and
sixteenths, acceptable/substantial overholds, taps, absent releases, tied final members,
gradual penalties, fixed calibration, snapshots/legacy replay and confidence-dependent
feedback. Existing input ownership/calibration/cancellation tests remain. Legacy lift
geometry tests explicitly replay legacy snapshots; current timelines test received
positions, accepted colors and absence of target-deadline lift promises.

Native [browser scenarios](../../scripts/rhythm-assessment-browser-scenarios.js) cover
concise results, collapsed numerical Details, keyboard/synthetic pointer finish safety,
Both writing retention, retry/Next, settings/mode retention, JSON downloads, cancellation,
6/8 pulse semantics and layout. Synthetic pointer capture and background focus are
scoped automation stubs. The preview cannot reach the workspace loopback server;
current built assets are injected into the native browser (font payload omitted).
This checks the app in that browser, not routing or physical timing accuracy.

Physical-device latency, real held touch capture, audio audibility, Bluetooth/wired
output, mobile Safari/Android/Chromebook and assistive-technology validation remain
unperformed. No Cloudflare release preview, release candidate verification or production
promotion is part of this feature slice. Tuning is provisional pending learner and
physical-device review; out-of-bound/ambiguous fits intentionally withhold metrics.

## Representative comparison with legacy assessment

These independent two-bar quarter-note examples use target 120 BPM, eight attacks,
and an 80% final hold. Values below are rounded for review; calculation keeps precision.

| Observed performance | Legacy BPM / rhythm / hold | Current BPM / rhythm / hold |
| --- | --- | --- |
| 500 ms spacing, start 80 ms late, other holds 500 ms | 115.38 / 94.71% / 86.92% | 120 / 100% / 100% |
| Same late start, adjacent holds 350 ms | 115.38 / 94.71% / 67.02% | 120 / 100% / 100% |
| 700 ms spacing, start 80 ms late, adjacent holds 490 ms | 83.33 / 97.92% / 70.83% | 85.71 / 100% / 100% |

Missing one exact quarter still gives 87.5% rhythm; adding an extra gives 88.89%.
A 10 ms tap on a 500 ms note receives zero hold credit. Under saved v3, omitting a tied chain’s final member receives zero chain hold credit.
V4 waives a final member shorter than 400 ms as described above.
Substantial rest intrusion still produces silence guidance and a single hold deduction.

## Validation evidence for this refinement (2026-10-11)

Node **24.21.0**, `npm ci`, and `npm run check` pass strict type checking, **270 tests**,
and hosted/portable builds; `git diff --check` passes. Native T3 checks pass keyboard,
steady slower, 6/8 and cancellation scenarios at **1280 CSS pixels**, plus synthetic
pointer lifecycle and displaced 70/80% accepted-sustain scenarios at **375 CSS pixels**.
Accepted sustain produces no score/timeline warning colors or target lift-credit bands.
Results focus, collapsed Details, downloads, preference/mode retention, retry/Next and
Both writing independence pass. Preview resize timed out; narrow/desktop checks used
same-origin iframes in the native preview with the current built assets, without a
standalone automation browser. Fonts were omitted from asset injection. A browser
clock offset pushed the first 180 BPM synthetic displaced case outside its 100 ms
bound; it correctly withheld assessment. The accepted browser case uses 120 BPM to
leave room for synthetic cross-clock uncertainty; deterministic tests still require
exact 80 ms displacement and unchanged 120 BPM. Device and release checks remain
outstanding as listed above.

### PR base integration

The requested PR targets `t3code/rhythm-game-handoff`. After merging its existing
sixteenth/counting update (`f50e1d8`) into this feature branch, `npm run check` passes
**291 tests**, strict type checking and builds on Node 24.21.0. The inherited vocabulary
and counting systems are preserved; this assessment slice adds neither. The existing
64-attack dense-sixteenth reproducer retains 100% rhythm, 120 BPM, and no missing/extra
attacks in both styles, plus 100% Hold accuracy. Diagnostic assessment times were
1,292 ms (Tap) and 1,344 ms (Hold) in this workspace; those are runtime observations,
not acceptance thresholds. Native browser evidence above precedes this base merge;
post-merge verification here is automated Node/build validation. Physical-device and
production acceptance remain outstanding.


## Validation evidence for short-sound policy v4 (2026-10-12)

Node 24.21.0, `npm ci`, `npm run check` (296 tests, strict type checking, hosted and
portable builds), and `git diff --check` pass. Deterministic cases cover eighths and
sixteenths at 80 BPM, the exact 400 ms boundary, performed-tempo eligibility, 6/8,
mixed-score denominators, missing notes/releases, a half tied across a barline to an
eighth, single-member-only exemption, reattacks, unchanged overhold/rest boundaries,
raw timeline endpoints, and saved v3/absent-policy replay.

Native T3 browser scenarios `short`, `tied`, and `accepted` pass against the local
app: keyboard short taps show no hold percentage or sustain warnings; an omitted
short tied tail earns full credit with an accurate assessed-note count; synthetic
pointer long holds remain accepted. Downloads retain v4 policy/evidence, and result
focus, writing retention, retry/Next, settings retention and layout checks pass.
Synthetic input does not establish physical keyboard/touch tolerances. The 400 ms
threshold remains provisional pending actual playing; no staging or production
publication was performed.


### Tap feedback and mobile pad follow-up (2026-10-12)

`npm run check` passes 298 tests, type checking and builds on Node 24.21.0. Regression
cases distinguish perfect Tap attacks with held rest overlap, the same input in Hold,
brief extra rest attacks in both styles, and accepted early attacks after rests.
Native T3 `tap-rest` and `accepted` browser scenarios pass: Tap overlap produces no
hold criticism, and canceling a synthetic context-menu event on a held pad label does
not release the pointer input. Selection suppression and normal context-menu behavior
outside the pad are checked. Physical mobile long-press verification remains pending.

## Treat Bag rewards (v1)

**Treat Bag: Earn Treats for Uno** is the single visible home for performance bone
ratings, the evidence-based summary and at most one actionable suggestion. These are
initial teaching defaults that can be tuned, **not validated mastery standards**.
Five bones means musically successful playing with room for small mistakes.

[The shared pure mapper](../../src/apps/rhythm-walk/rewards.ts) consumes the existing
assessment once at completion; it does not refit timing, calibration, association or
holds. Version 1 selects the highest tier met using unrounded values:

| Bones | Rhythm | Holding notes | Absolute tempo difference | Typical pace variation (Steady beat) |
| --- | --- | --- | --- | --- |
| 5 | ≥90% | ≥85% | ≤7% | ≤7% |
| 4 | ≥75% | ≥70% | ≤12% | ≤12% |
| 3 | ≥60% | ≥55% | ≤20% | ≤20% |
| 2 | ≥40% | ≥35% | ≤30% | ≤30% |
| 1 | <40% | <35% | >30% | >30% |

Holding notes uses assessed hold credit, including forgiving duration tolerances and
short-note exclusions; it is not a percentage of written duration physically held.
Tempo uses absolute difference, equally rewarding slower and faster playing. Categories
are independent: steady playing can earn five Steady beat bones at another tempo.
Feedback descriptions use the same 7%/12% tempo and steadiness presentation boundaries.
Numerical metrics and technical evidence remain in collapsed Details.

Only completed attempts with assessable evidence earn rewards. Interrupted attempts,
no-input note exercises, and unavailable/nonfinite metrics earn none. Existing tempo
and steadiness confidence gates remain authoritative. Tap hides Holding notes. In
Tap + Hold, excluded short-note holds say “No long notes to check” without bones;
other unavailable metrics say “Not enough evidence”. Rest-only exercises retain
silence feedback without attack, tempo or hold ratings. There is no overall grade,
average, cumulative currency, economy, or Write Counts bone scoring.

The exercise-local Treat Bag retains the completed record, its existing assessment,
reward version and mapped ratings. Mode switching and pending settings do not change
the captured Tap/Tap + Hold choice or completed rewards. Retry labels retained feedback
“Previous completed attempt”; interrupted retries preserve it. A newly completed
attempt replaces it, including truthful unrated feedback for no-input attempts.
New exercise clears it. No feedback persists across reloads.

### Treat Bag validation (2026-10-13)

Node 24.21.0, `npm ci`, `npm run check` (344 tests, strict type checking and builds),
and `git diff --check` pass. Focused reward tests cover every boundary and immediately
adjacent unrounded values, tempo signs, missing/nonfinite metrics, interrupted and
no-input attempts, all-rest silence, short holds, captured style, independent metrics,
wording, mode/preferences retention and retry/replacement state.

Native T3 browser checks passed accepted Tap + Hold and short-note cases at 1536px.
At 375px, accepted holds and steady slower Tap passed reward accessibility markup,
result focus/release safety, Details, writing retention, pending settings/modes,
interrupted retry and Next clearing. No-input and silent-rest cases showed no rewards.
Preview resizing timed out twice; narrow checks used a same-origin 375px iframe
loading the actual local app. The older slower scenario sent final notes beyond the
current capture deadline; its synthetic spacing now uses 1.1× target intervals so all
notes finish inside that unchanged deadline. The resulting slower tempo earns four
Tempo bones and five Steady beat bones. No scoring or capture policy changed.
Physical touch/keyboard timing, audio audibility and real assistive-technology testing
remain unverified. No release, staging integration or production publication occurred.
