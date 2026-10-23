# Canonical rhythm music model

Current integration: [one Uno234 activity](unified-activity.md) shares written events and exact derived time across Write Counts, Tap Rhythms and Both. Their answer and performance evaluations remain separate. Tap / Tap + Hold is a performance preference, never a response mode or an alternative musical model.

Implemented 2026-10-10 at the owner's request. This is the shared source contract for Uno234. It replaces the prototype's stored eighth-note starts and fixed 4/4 music model. It does not expand the currently reviewed UI repertoire or settle counting conventions.

## Typed source

[`RhythmScore`](../../src/music/score.ts) is the sole authored musical source. It contains measures with `meter` and a flat ordered `notes` array. Each `WrittenNote` has a stable `id`, `kind` (`note` or `rest`), `type` (`whole`, `half`, `quarter`, `eighth`, `16th`), `dots`, optional `timeModification: [actual, normal]`, and `tieNext`.

Generation and fixtures construct this source directly. The authoring helpers in [measure.ts](../../src/music/measure.ts) provide compact templates and assign passage-wide IDs at construction:

```ts
const example = score([{ meter: [4, 4], notes: [
  note('half'), note('quarter'), note('eighth'), note('eighth'),
] }]);
// Other templates: note('quarter', { kind: 'rest' }),
// note('eighth', { dots: 1 }), note('eighth', { timeModification: [3, 2] }),
// note('quarter', { tieNext: true }).
```

`score(measures)` assigns deterministic IDs for generated/authored templates. Use `createScore(input)` for a completed external score: it validates, detaches, deep-freezes and preserves authored IDs. Calling it on an already captured score returns the same immutable object. Activity, CountingPlan, engraving and active capture therefore share one source; completed attempt evidence is detached for export. There is no legacy tuple source or runtime conversion adapter.

Rests advance time in chronological order. Store notation, not duplicate starts or computed durations. UI labels, preset IDs, assistance and student answers do not belong in the musical source. Fixture metadata remains separate.

## Derived time and coordinates

`duration(event)` returns an exact fraction of a whole note. Single dots multiply by 3/2, double dots by 7/4, and a tuplet ratio `[actual, normal]` multiplies by `normal/actual`. `deriveMeasure` accumulates positions and validates that events fill the bar exactly. Its richer output is computed data, not additional authored source.

[Fraction arithmetic](../../src/music/fraction.ts) uses normalized integer pairs `[numerator, denominator]`. This keeps triplets and comparisons exact and JSON-safe. Arithmetic rejects unsafe integer overflow. Convert to decimal only for layout or eventual audio scheduling; do not round source time to a fixed grid. Audio scheduling and tempo mapping live outside this model, in the [performance timing adapter](../../src/apps/rhythm-walk/timing.ts).

`beatCoordinate(derivedMeasure, position)` gives **zero-based coordinates with 12 subdivisions per grouped beat**. For `H Q E E` in 4/4, the starts are decimal coordinates `0, 24, 36, 42`. These correspond to the owner's one-based base-twelve shorthand `10, 30, 40, 46`. That shorthand is for explanation; source files do not contain base-twelve numeric literals.

The beat grid is a coordinate system, not the definition of written note duration. An unusual combination such as eighth-note triplets within dotted-quarter beats produces fractional twelve-grid coordinates. The API retains them exactly instead of rounding or changing the rhythm. Consumers requiring integral ticks must explicitly reject incompatible material or choose a finer derived resolution.

## Meter and counting beats

`meter: [numerator, denominator]` determines bar length. The current typed profile accepts 2/4, 3/4, 4/4 and 6/8. Simple-meter performance pulses are quarters; 6/8 has two dotted-quarter pulses. Derived beat views use `[1, 1]`, `[1, 1, 1]`, `[1, 1, 1, 1]` or `[3, 3]` denominator-unit groups respectively. Grouping is derived, not a second authored field.

Count Writing has a separate policy for six numbered eighths in 6/8, grouped visually as 123 and 456; see [meter decisions](meters.md). Counting and performance coordinates do not change written durations. Additional meters and custom grouping require an explicit profile extension; historical broader tuple-model tests do not promise runtime support.

## Tuplets and ties

Supported tuplets are flat 3:2 triplets and 2:3 duplets. Each member carries the ratio. Consecutive members must have the same written value, dots and ratio; the compiler partitions them into complete groups of the specified actual count and exposes a group identifier for future engraving. Notes and rests may coexist in a group. Incomplete groups, mixed-value groups and groups crossing barlines are rejected. Nested tuplets are not supported. Thirty-second note values and quintuplets are outside the requested scope and explicitly rejected, not approximated.

`tieNext` connects the event to the immediately following written event, including across a barline or meter change. This is a monophonic rhythm model; there is no pitch or voice matching yet. Rests cannot start or receive ties.

`deriveMeasure` validates a bar and permits an outgoing final tie because it cannot know the next measure. **Use `derivePassage` to validate complete exercises.** It rejects unresolved final ties and derives an attack list: tied notes produce one attack with their summed duration and references to all written members. Written notation remains intact. A rest creates no attack. Count Writing must use written events and its counting policy, rather than treating every member of a tie as a new performed attack.

Both performance settings consume the same derived sounding attack list. Tap evaluates chain onsets and ignores releases; Tap + Hold uses the total sounding chain for hold eligibility and evaluates one continuous hold under the captured assessment policy. Hold v4 excludes sounds below 400 ms and makes a final written tied member below 400 ms optional in eligible chains; this changes scoring, never the exact derived endpoint. Written tie boundaries allow no release/reattack or articulation gap. Separate sounding notes permit a forgiving elapsed-sustain band measured from the learner’s own attack. Numerical allowances belong to the [performance policy](performance-prototype.md#selectable-tap--tap--hold), not to authored notation or exact musical time. Expected duration bars use derived sounding chains, with lift bands retained only for legacy captured policies; actual bars use input-specific corrected down/up evidence without snapping to musical endpoints.

Numerical [musical assessment](assessment.md) derives the same sounding chains and meter-specific performance pulse from this canonical passage. One global analytical tempo and starting displacement may locate expected times for assessment only; authored fractions, received edges and target-relative timelines remain unchanged. Scoring tolerances and confidence belong to the versioned assessment policy, not the music domain.

## Count Writing integration

Write Counts and Both consume one immutable [CountingPlan](../../src/music/counting/plan.ts) and one [CountingAnswer](../../src/music/counting/answer.ts) per exercise. [Activity](../../src/apps/rhythm-walk/activity.ts) owns the typed score, and the plan retains that same score with captured counting preferences. Changing response mode does not reconstruct music or reset answers/results.

The [plan editor](../../src/apps/count-writing/plan-editor.ts) renders only exact plan counts, indexed by count IDs. All rule interpretation and evaluation belong to the core. Sounding attacks always create inputs; tied continuations alone do not. Enabled rules share exact positions; dotted subdivision controls the internal counts of eligible written dotted members, suppressing unrelated long-note pulse counts there: long notes qualify at two pulses using complete sounding duration and attack-relative steps; dotted subdivision uses eligible individual written members. Simple-meter pulses are quarters; the 6/8 pulse is a dotted quarter. In 6/8, a written dotted half has `1 4` with long notes enabled and otherwise `1`; its dot adds nothing. Written tied dotted quarters can expose all six counts through dotted subdivision, in one unit. Untied members remain separate units. Generation pools are unchanged.

Rest and duration evidence are unit booleans. Included rests remain separate written units, with applicable duration indication assessed independently. Omitting rests removes their inputs and suppresses all rest assessment. Duration entry/assessment requires internal counts and either a visible line or raised/lowered internal appearance. Rest (R) and Duration (D) act on the entire selected unit, including across bars and wraps. There are no student-authored ranges or endpoint grades. All counting choices apply on New exercise; pending changes preserve answers/results.

The [grid](../../src/apps/count-writing/grid.ts) supplies derived engraving and performance-timeline geometry directly from typed written notes. Its positions are not answer identities or requirements. The editor maps exact plan fractions onto that geometry. Write Counts uses one continuous passage with aligned counts and a conditional overview; no individual measure scrolls independently. See the [responsive layout contract](responsive-layout-audit.md).

Historical counting evaluators and the former tuple timing implementation live only in `tests/legacy/` as independent regression oracles. The runtime `legacy-score.ts` adapter is removed. Source ownership tests compare generated and fixture timing against the historical implementation and verify immutable identity and imported IDs. Scoring, calibration, hold tolerances and reward thresholds are unchanged.

## Verification and extension rules

[Domain tests](../../tests/rhythm-model.test.ts) preserve historical duration/grouping regressions. Typed score and source-ownership tests cover current supported meters, exact timing, ties, tuplets, validation and consumer identity. [Count Writing tests](../../tests/count-writing.test.ts) preserve historical answers and independent feedback dimensions; [migration tests](../../tests/counting-migration.test.ts) and the counting-plan acceptance suite cover the running contract.

Other agents should reuse this model, add examples/tests here when extending it, and avoid introducing separate timing encodings in renderers, generators or evaluators. The [practice generator](../../src/apps/rhythm-walk/shared/generation.ts) now uses this model and validates complete passages. This model does not own notation UI, audio scheduling or preference persistence; their current implementation is documented in the [unified activity contract](unified-activity.md). Follow normal feature-to-dev staging and explicit production-publication rules.

Duration lines and rest enclosures end at the last depicted count of their unit, not at the musical end or the next attack. Cross-bar visual continuations stop in the bar containing that final count; musical durations and performance holds remain unchanged.

## UIL scope reconciliation (2026-10-22)

UIL I–IV use atomic note-only figures and one meter per exercise (I–II: 4/4; III–IV: 2/4, 3/4, 4/4). IV teaches figures without claiming the composition-level meter-change requirement. V–VI, 2/2 and within-exercise changes are deferred. Existing Uno/Custom 6/8 and triplets are unchanged. Generation, counting, engraving and capture share the immutable typed score. See [UIL scope](uil-presets.md).
