# Canonical rhythm music model

Current integration: [one Uno234 activity](unified-activity.md) shares written events and exact derived time across Write Counts, Tap Rhythms and Both. Their answer and performance evaluations remain separate. Tap / Tap + Hold is a performance preference, never a response mode or an alternative musical model.

Implemented 2026-10-10 at the owner's request. This is the shared source contract for Uno234. It replaces the prototype's stored eighth-note starts and fixed 4/4 music model. It does not expand the currently reviewed UI repertoire or settle counting conventions.

## Compact source

Use [RhythmMeasure and RhythmEvent](../../src/music/measure.ts): one flat, ordered event array per measure. Store written notation, not duplicate starts or computed durations. A passage is an array of measures.

```ts
const example: RhythmMeasure = {
  meter: [4, 4],
  events: [['H'], ['Q'], ['E'], ['E']],
};
```

Each event is `[value, modifiers?]`. Values are `W` whole, `H` half, `Q` quarter, `E` eighth, and `S` sixteenth. Modifiers are omitted unless needed:

```ts
['Q', { rest: true }]         // quarter rest
['E', { dots: 1 }]            // dotted eighth
['Q', { dots: 2 }]            // double-dotted quarter
['E', { tuplet: [3, 2] }]     // 3 written eighths in the time of 2
['Q', { tieNext: true }]      // ties to the next written event
```

Rests stay in chronological order with notes and advance time. Do not encode rests as negative positions. UI labels, preset IDs, assistance and student answers do not belong in the shared musical event. Prototype fixture metadata lives in [fixtures.ts](../../src/apps/rhythm-walk/shared/fixtures.ts).

## Derived time and coordinates

`duration(event)` returns an exact fraction of a whole note. Single dots multiply by 3/2, double dots by 7/4, and a tuplet ratio `[actual, normal]` multiplies by `normal/actual`. `deriveMeasure` accumulates positions and validates that events fill the bar exactly. Its richer output is computed data, not additional authored source.

[Fraction arithmetic](../../src/music/fraction.ts) uses normalized integer pairs `[numerator, denominator]`. This keeps triplets and comparisons exact and JSON-safe. Arithmetic rejects unsafe integer overflow. Convert to decimal only for layout or eventual audio scheduling; do not round source time to a fixed grid. Audio scheduling and tempo mapping live outside this model, in the [performance timing adapter](../../src/apps/rhythm-walk/timing.ts).

`beatCoordinate(derivedMeasure, position)` gives **zero-based coordinates with 12 subdivisions per grouped beat**. For `H Q E E` in 4/4, the starts are decimal coordinates `0, 24, 36, 42`. These correspond to the owner's one-based base-twelve shorthand `10, 30, 40, 46`. That shorthand is for explanation; source files do not contain base-twelve numeric literals.

The beat grid is a coordinate system, not the definition of written note duration. An unusual combination such as eighth-note triplets within dotted-quarter beats produces fractional twelve-grid coordinates. The API retains them exactly instead of rounding or changing the rhythm. Consumers requiring integral ticks must explicitly reject incompatible material or choose a finer derived resolution.

## Meter and counting beats

`meter: [numerator, denominator]` determines bar length. Optional `groups` gives denominator-unit counts in each counting beat:

```ts
{ meter: [3, 4], groups: [1, 1, 1], events: /* ... */ }
{ meter: [6, 8], groups: [3, 3], events: /* ... */ }
{ meter: [6, 8], groups: [1, 1, 1, 1, 1, 1], events: /* ... */ }
{ meter: [7, 8], groups: [2, 2, 3], events: /* ... */ }
```

At the domain level, the same 6/8 notation can therefore be counted as two dotted-quarter beats or six eighth-note beats. Changing grouping changes coordinates, not written durations. For unequal groups, equal coordinate distances need not represent equal musical time; use exact score positions for playback, not an assumption of constant milliseconds per coordinate tick.

Defaults are one denominator unit per beat for numerators 1–4, and groups of three for compound numerators divisible by three greater than 3 with denominator 8 or 16. Other meters require explicit groups. Groups must be positive integers summing to the numerator. Current validation bounds are numerator 1–32 and denominator 2, 4, 8 or 16; this is a domain boundary, not a promise that all combinations have teaching presets.

Count Writing uses a separate counting policy for six numbered eighths in 6/8 while retaining score groups `[3, 3]` and two dotted-quarter performance pulses. It does not override score grouping with six single-unit groups; see [meter decisions](meters.md).

## Tuplets and ties

Supported tuplets are flat 3:2 triplets and 2:3 duplets. Each member carries the ratio. Consecutive members must have the same written value, dots and ratio; the compiler partitions them into complete groups of the specified actual count and exposes a group identifier for future engraving. Notes and rests may coexist in a group. Incomplete groups, mixed-value groups and groups crossing barlines are rejected. Nested tuplets are not supported. Thirty-second note values and quintuplets are outside the requested scope and explicitly rejected, not approximated.

`tieNext` connects the event to the immediately following written event, including across a barline or meter change. This is a monophonic rhythm model; there is no pitch or voice matching yet. Rests cannot start or receive ties.

`deriveMeasure` validates a bar and permits an outgoing final tie because it cannot know the next measure. **Use `derivePassage` to validate complete exercises.** It rejects unresolved final ties and derives an attack list: tied notes produce one attack with their summed duration and references to all written members. Written notation remains intact. A rest creates no attack. Count Writing must use written events and its counting policy, rather than treating every member of a tie as a new performed attack.

Both performance settings consume the same derived sounding attack list. Tap evaluates chain onsets and ignores releases; Tap + Hold evaluates one continuous hold through the derived chain end. Written tie boundaries allow no release/reattack or articulation gap. Separate sounding notes permit a forgiving elapsed-sustain band measured from the learner’s own attack. Numerical allowances belong to the [performance policy](performance-prototype.md#selectable-tap--tap--hold), not to authored notation or exact musical time. Expected duration bars use derived sounding chains, with lift bands retained only for legacy captured policies; actual bars use input-specific corrected down/up evidence without snapping to musical endpoints.

Numerical [musical assessment](assessment.md) derives the same sounding chains and meter-specific performance pulse from this canonical passage. One global analytical tempo and starting displacement may locate expected times for assessment only; authored fractions, received edges and target-relative timelines remain unchanged. Scoring tolerances and confidence belong to the versioned assessment policy, not the music domain.

## Count Writing integration

The prototype consumes this source through [countGrid](../../src/apps/count-writing/grid.ts). That adapter explicitly restricts rendering and grading to 2/4, 3/4, 4/4 and 6/8, half/quarter/eighth material, including dotted-quarter notes/rests and eighth rests. Tied notes are now supported in this repertoire; [passageGrid](../../src/apps/count-writing/passage.ts) derives sounding attacks, chain durations and answer coordinates from `derivePassage`. Generated practice uses 1–4 consecutive measures in one staff passage; rest pairs stay measure-local while tied duration lines use passage-wide derived answer positions; see [practice loop](practice-loop.md). Beginner rest-placement policy lives in the generator’s [notation policy](../../src/apps/rhythm-walk/shared/notation-policy.ts), keeping uncommon but valid written music available through an explicit practice opt-in. Unsupported model features fail clearly at this boundary instead of being silently engraved or graded incorrectly.

Its eighth-spaced answer storage is a **counting/presentation policy**, not the music clock. Slot indices in student symbols, rest markings and duration spans refer to this generated grid. Do not pass them to performance timing as musical coordinates. The renderer and editor use the same slot geometry; answer size and navigation limits come from the grid. Dotted-quarter policy is identified from total sounding durations and positions for notes, and written durations for rests, not fixture IDs. See the [ties and syncopation rules](ties-syncopation.md).

In simple meters, available inputs always include grouped beat starts and every written note/rest onset. Undotted events longer than the denominator unit expose one level below their written value (a half note exposes quarters, already available as beats in 4/4). Dotted half notes also resolve to quarter positions; dotted quarters resolve to eighths. Shorter or dotted figures use the smallest written component, with exact tuplet ratios; subdivision grids are local to affected beats. Ordinary quarter-only beats expose no unused offbeat. Visibility does not make an internal count required: teacher-selected dotted-quarter grading stays separate. Count navigation and visible duration anchors share the available positions. Duration lines extend through trailing hidden subdivisions within the chosen sounding note chain or written rest; all endpoint controls and dragging select available counts and derive the implied trailing hidden subdivisions. The adapter derives 4, 6, 8 or 6 eighth-spaced storage/layout positions for 2/4, 3/4, 4/4 or 6/8 respectively. Simple meters hide unavailable offbeats; 6/8 exposes and requires all six numbered eighths. See [meter decisions](meters.md) for its exact duration endpoints, readable rest groups and distinct dotted-quarter pulse. Duration-line expected endpoints use the final grid position within the note, including hidden subdivisions, so a half note extends past beat 2 toward beat 3. For half–quarter–eighth–eighth in 4/4, the only extra position beyond the four beats is the final eighth-note onset.

Rest parentheses are explicit answer ranges, separate from count symbols and duration spans. Each written rest requires one complete pair from its onset through its last required or entered count. A half rest encloses `1 2` and its independently entered duration line; two quarter rests require `(1) (2)`. Missing, duplicate, truncated, overlapping or cross-event pairs need correction, even if the count symbols are right. Ghost `(` follows mouse hover without selecting a count; touch and keyboard use the selected count. Opening it reveals teal outlined `)` targets at that count and later available counts, stopping before another group. Ghost openings are suppressed within completed groups. Clicking or touching a completed group’s right parenthesis removes its closing parenthesis, preserves the opening in place and reveals endpoint choices. Clicking or touching any left opening removes it and its pair, if complete. New and edited groups cannot overlap or nest. Keyboard `(` begins a group, arrows choose an available nonoverlapping closing count, Enter or `)` completes it, and Escape cancels. Shift with arrows previews a duration endpoint from available counts, automatically including trailing hidden subdivisions; Shift release commits the line. The rest keypad removes an existing group. Half-rest and adjacent-quarter-rest fixtures extend the reviewed UI, including half-rest engraving and duration-line evaluation for sustained rests.

The position policy can derive finer and grouped-meter positions, but this alone does not expand the reviewed engraving/grading repertoire.

To expose new material: extend the counting convention, input positions, engraving and evaluation together; then add musical and browser fixtures. Supporting a rhythm in the domain alone does not make it playable in either app. Existing duration-line ending rules remain provisional.

## Verification and extension rules

[Domain tests](../../tests/rhythm-model.test.ts) cover exact durations, dots, sixteenths, tuplets, compound/additive grouping, fractional beat coordinates, rests, exact bar totals, tie chains across changing meters, invalid cases and the UI support boundary. [Count Writing tests](../../tests/count-writing.test.ts) preserve the four existing answers and independent feedback dimensions.

Other agents should reuse this model, add examples/tests here when extending it, and avoid introducing separate timing encodings in renderers, generators or evaluators. The [practice generator](../../src/apps/rhythm-walk/shared/generation.ts) now uses this model and validates complete passages. This model does not own notation UI, audio scheduling or preference persistence; their current implementation is documented in the [unified activity contract](unified-activity.md). Follow normal feature-to-dev staging and explicit production-publication rules.
