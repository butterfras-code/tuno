# Implementation prompt: simple-meter triplets

Implement eighth-note triplets in Uno234 across Write Counts, Tap Rhythms and Both. Start by reading the [shared coordination contract](README.md); it is part of this prompt. Fetch remote, inspect the latest code and docs, and preserve concurrent UIL work.

## Scope and music

- Add opt-in `triplet-eighth` for 2/4, 3/4 and 4/4; existing defaults stay unchanged.
- A group is exactly three sounded eighths, each with canonical `tuplet: [3, 2]`, filling one quarter beat and starting on a quarter-beat boundary.
- Use the existing flat written-event model and exact fractions. Treat a complete group as an atomic generation choice, then emit its three ordinary canonical events. Never generate incomplete tuplets or round them onto a sixteenth grid.
- Mix triplets with ordinary eighths/sixteenths on different beats in the same exercise. Do not mix binary and ternary subdivisions within a single beat in this slice.
- Defer triplet rests, partial/mixed-value groups, ties involving triplet members, nested tuplets, duplets and other tuplets. Existing ties/syncopation elsewhere in the passage continue working. Ensure the tie-generation pass cannot accidentally attach a tie to/from a triplet.
- Preserve 6/8 vocabulary, numbers 1–6 and dotted-quarter performance pulse. A meter pool can retain the triplet selection while omitting it from 6/8 generation, with existing complete-bar validation.

## Counting: 1 la li

Both existing counting systems use **1 la li, 2 la li, 3 la li…** for triplets. No separate triplet-counting preference.

- Required triplet tokens are the beat number at the first attack, `la` at one-third, and `li` at two-thirds of the quarter beat.
- Each syllable is one atomic count token. Extend the existing multi-character keyboard entry and touch keypad; `l` is an incomplete prefix and must not commit/advance prematurely.
- Preserve predictable Backspace, navigation, blur, cancellation and incomplete-input handling.
- Switching between e-&-a (or +) and ta-te-ta keeps triplet tokens and positions unchanged. Preserve incorrect answers rather than silently correcting them. Invalidate stale count feedback when appropriate.
- Ordinary binary beats retain their selected convention. Do not show irrelevant binary subdivision slots within triplet beats or require hidden syllables.
- Derive exact local positions from musical time. A shared derived twelve-subdivision quarter grid is acceptable, but not a new authored music model. Audit editor navigation, duration/rest spans, slot geometry and timelines for assumptions about uniform sixteenth steps.
- Existing rest parentheses, sustained counts and duration lines elsewhere in mixed passages must remain correct.

## Generator and notation

Expose triplet support through the shared capability query described in the coordination contract. Keep selected-ingredient reachability bounded and deterministic under injected test randomness. No unselected ingredients added to fill a bar; all meters must validate independently.

Engrave conventional groups with a clear 3 and correct beams/brackets. Group IDs come from canonical derivation, not fixture names. Keep each triplet group together through layout; no collisions with counts, syllables, neighboring beams or ties. Provide accessible descriptions identifying the tuplet.

Dense mixed passages must be usable at 320px without horizontal score/page overflow or unusably small input targets. Preserve the current score/pad behavior during count-in and capture.

Add shared review fixtures for isolated groups, consecutive groups, groups on different numbered beats, triplets adjacent to binary beats, and mixed 1–4-measure passages. Use the same fixtures in every response mode.

## Performance and scope boundaries

Tap and Tap + Hold derive attack times/durations from the same fractions, with quarter-note BPM and the existing count-in. Keep calibration, assessment policy snapshots, short-note hold exemptions, result actions and actual timing evidence intact. Do not special-case fixtures or alter scoring formulas to make a test pass.

When denser input reveals an assessment issue, record exact events and a reproducible case for scoring follow-up. Fix coordinate/timing integration errors here; leave policy changes separate.

Do not modify UIL definitions/resolver or invent official restrictions. Do not implement progression, longer sessions, new modes or production navigation.

## Verification and delivery

Add meaningful tests with independently specified expectations:

- Exact durations/bar totals, complete groups and allowed ingredient/meter combinations.
- No accidental tuplets in 6/8 or ties involving triplets.
- Correct/incorrect `la`/`li` positions; both counting systems; mixed subdivision passages.
- Atomic syllable keyboard/touch input, incomplete-prefix cancellation, answer retention.
- Correct beams/group labels, exact onset times, sustain/timeline geometry and responsive layout.
- Shared generated exercises/presets across Write Counts, Tap Rhythms and Both; Tap/Hold capture, result retention, Retry/Next and cancellation.

Use Node 24 and npm ci, run npm run check and relevant browser scenarios. Use native T3 browser tools when available; check desktop and 320px, 1–4 measures, mixed groups and unchanged 6/8. Distinguish synthetic checks from physical-device validation.

Update canonical docs and add a focused triplet contract. Report capability API, shared-file edits, tests and any UIL integration dependencies. Follow repository PR targeting/linking rules. Do not merge into another branch or publish production without the corresponding authorization.
