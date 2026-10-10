# Canonical rhythm music model

Implemented 2026-10-10 at the owner's request. This is the shared source contract for Count Writing and future Rhythm Walk work. It replaces the prototype's stored eighth-note starts and fixed 4/4 music model. It does not expand the currently reviewed UI repertoire or settle counting conventions.

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

Rests stay in chronological order with notes and advance time. Do not encode rests as negative positions. UI labels, preset IDs, assistance and student answers do not belong in the shared musical event. Prototype fixture metadata lives in [fixtures.ts](../../src/apps/count-writing/fixtures.ts).

## Derived time and coordinates

`duration(event)` returns an exact fraction of a whole note. Single dots multiply by 3/2, double dots by 7/4, and a tuplet ratio `[actual, normal]` multiplies by `normal/actual`. `deriveMeasure` accumulates positions and validates that events fill the bar exactly. Its richer output is computed data, not additional authored source.

[Fraction arithmetic](../../src/music/fraction.ts) uses normalized integer pairs `[numerator, denominator]`. This keeps triplets and comparisons exact and JSON-safe. Arithmetic rejects unsafe integer overflow. Convert to decimal only for layout or eventual audio scheduling; do not round source time to a fixed grid. Audio scheduling and tempo mapping are not implemented by this model.

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

The same 6/8 notation can therefore be counted as two dotted-quarter beats or six eighth-note beats. Changing grouping changes coordinates, not written durations. For unequal groups, equal coordinate distances need not represent equal musical time; use exact score positions for playback, not an assumption of constant milliseconds per coordinate tick.

Defaults are one denominator unit per beat for numerators 1–4, and groups of three for compound numerators divisible by three greater than 3 with denominator 8 or 16. Other meters require explicit groups. Groups must be positive integers summing to the numerator. Current validation bounds are numerator 1–32 and denominator 2, 4, 8 or 16; this is a domain boundary, not a promise that all combinations have teaching presets.

## Tuplets and ties

Supported tuplets are flat 3:2 triplets and 2:3 duplets. Each member carries the ratio. Consecutive members must have the same written value, dots and ratio; the compiler partitions them into complete groups of the specified actual count and exposes a group identifier for future engraving. Notes and rests may coexist in a group. Incomplete groups, mixed-value groups and groups crossing barlines are rejected. Nested tuplets are not supported. Thirty-second note values and quintuplets are outside the requested scope and explicitly rejected, not approximated.

`tieNext` connects the event to the immediately following written event, including across a barline or meter change. This is a monophonic rhythm model; there is no pitch or voice matching yet. Rests cannot start or receive ties.

`deriveMeasure` validates a bar and permits an outgoing final tie because it cannot know the next measure. **Use `derivePassage` to validate complete exercises.** It rejects unresolved final ties and derives an attack list: tied notes produce one attack with their summed duration and references to all written members. Written notation remains intact. A rest creates no attack. Count Writing must use written events and its counting policy, rather than treating every member of a tie as a new performed attack.

## Count Writing integration

The prototype consumes this source through [countGrid](../../src/apps/count-writing/grid.ts). That adapter explicitly restricts rendering and grading to the currently reviewed 4/4, quarter-beat, half/quarter/eighth material. Unsupported model features fail clearly at this boundary instead of being silently engraved or graded incorrectly.

Its eighth-spaced answer slots are a **counting/presentation policy**, not the music clock. Slot indices in student symbols, rest markings and duration spans refer to this generated grid. Do not pass them to performance timing as musical coordinates. The renderer and editor use the same slot geometry; answer size and navigation limits come from the grid. Dotted-quarter policy is identified from written events and positions, not fixture IDs.

To expose new material: extend the counting convention, input positions, engraving and evaluation together; then add musical and browser fixtures. Supporting a rhythm in the domain alone does not make it playable in either app. Existing duration-line ending rules remain provisional.

## Verification and extension rules

[Domain tests](../../tests/rhythm-model.test.ts) cover exact durations, dots, sixteenths, tuplets, compound/additive grouping, fractional beat coordinates, rests, exact bar totals, tie chains across changing meters, invalid cases and the UI support boundary. [Count Writing tests](../../tests/count-writing.test.ts) preserve the four existing answers and independent feedback dimensions.

Other agents should reuse this model, add examples/tests here when extending it, and avoid introducing separate timing encodings in renderers, generators or evaluators. No notation library, audio scheduler, generator, persistence schema or production route is selected by this change. Follow normal feature-to-dev staging and explicit production-publication rules.
