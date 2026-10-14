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

Both performance settings consume the same derived sounding attack list. Tap evaluates chain onsets and ignores releases; Tap + Hold uses the total sounding chain for hold eligibility and evaluates one continuous hold under the captured assessment policy. Hold v4 excludes sounds below 400 ms and makes a final written tied member below 400 ms optional in eligible chains; this changes scoring, never the exact derived endpoint. Written tie boundaries allow no release/reattack or articulation gap. Separate sounding notes permit a forgiving elapsed-sustain band measured from the learner’s own attack. Numerical allowances belong to the [performance policy](performance-prototype.md#selectable-tap--tap--hold), not to authored notation or exact musical time. Expected duration bars use derived sounding chains, with lift bands retained only for legacy captured policies; actual bars use input-specific corrected down/up evidence without snapping to musical endpoints.

Numerical [musical assessment](assessment.md) derives the same sounding chains and meter-specific performance pulse from this canonical passage. One global analytical tempo and starting displacement may locate expected times for assessment only; authored fractions, received edges and target-relative timelines remain unchanged. Scoring tolerances and confidence belong to the versioned assessment policy, not the music domain.

## Count Writing integration

Write Counts and Both now consume one immutable [CountingPlan](../../src/music/counting/plan.ts) and one [CountingAnswer](../../src/music/counting/answer.ts) per exercise. [Activity](../../src/apps/rhythm-walk/activity.ts) calls the core-owned [one-way adapter](../../src/music/legacy-score.ts) once at exercise creation. The plan retains its detached typed score and counting preferences. The legacy exercise passage is frozen and remains the input to generation, engraving and performance; there are no synchronized editable sources and no conversion back from the typed score.

The [plan editor](../../src/apps/count-writing/plan-editor.ts) renders only exact plan counts, indexed by count IDs. All rule interpretation and evaluation belong to the core. Sounding attacks always create inputs; tied continuations alone do not. Enabled rules contribute a union: long notes qualify at two pulses using complete sounding duration and attack-relative steps; dotted subdivision uses eligible individual written members. Simple-meter pulses are quarters; the 6/8 pulse is a dotted quarter. In 6/8, a written dotted half has `1 4` with long notes enabled and otherwise `1`; its dot adds nothing. Written tied dotted quarters can expose all six counts through dotted subdivision, in one unit. Untied members remain separate units. Generation pools are unchanged.

Rest and duration evidence are unit booleans. Included rests remain separate written units, with applicable duration indication assessed independently. Omitting rests removes their inputs and suppresses all rest assessment. Duration entry/assessment requires internal counts and either a visible line or raised/lowered internal appearance. Rest (R) and Duration (D) act on the entire selected unit, including across bars and wraps. There are no student-authored ranges or endpoint grades. All counting choices apply on New exercise; pending changes preserve answers/results.

The old [grid](../../src/apps/count-writing/grid.ts) remains only at engraving/layout and performance-timeline boundaries. Its positions are not answer identities or requirements. The new editor maps exact fractions to that existing geometry. Dense notation and count targets scroll together inside each measure; performance without counts retains its compact score. Remove this layout adapter when engraving/timeline source access migrates. Performance timing and assessment still use the unchanged exact legacy attack derivation.

The old evaluator and passage-answer adapter have moved to [historical test helpers](../../tests/legacy/count-evaluation.ts), preserving independent regression coverage without a competing runtime path. `editor.ts`, `passage-lines.ts` and `count-popover.ts` were removed. The next ownership slice must make generation/fixtures produce typed scores and migrate engraving/performance consumers directly, then remove `scoreFromLegacy`; do not introduce reverse conversion.

## Verification and extension rules

[Domain tests](../../tests/rhythm-model.test.ts) cover exact durations, dots, sixteenths, tuplets, compound/additive grouping, fractional beat coordinates, rests, exact bar totals, tie chains across changing meters, invalid cases and the UI support boundary. [Count Writing tests](../../tests/count-writing.test.ts) preserve historical answers and independent feedback dimensions; [migration tests](../../tests/counting-migration.test.ts) and the counting-plan acceptance suite cover the running contract.

Other agents should reuse this model, add examples/tests here when extending it, and avoid introducing separate timing encodings in renderers, generators or evaluators. The [practice generator](../../src/apps/rhythm-walk/shared/generation.ts) now uses this model and validates complete passages. This model does not own notation UI, audio scheduling or preference persistence; their current implementation is documented in the [unified activity contract](unified-activity.md). Follow normal feature-to-dev staging and explicit production-publication rules.
