# Configurable counting schemes and inferred notation groups

Status: foundational core, coordinated editor/settings migration and URL/session preferences implemented locally; musical-source ownership migration is implemented locally. Written 2026-10-14 from the owner's design decisions. This document specifies a replacement for the current count-entry and evaluation architecture; it is not a description of shipped behavior or authorization to publish.

## Purpose and authority

Support different teaching conventions through one meter-aware counting plan shared by settings, entry, rendering, and evaluation. Use a deliberately supported MusicXML subset for musical representation, with an application-specific subdivision marker. Preserve individual written notes and derive sounding relationships, exact time, and count positions centrally.

Current integration is documented in [the music model](music-model.md), [settings](settings.md), [ties and syncopation](ties-syncopation.md), and [the unified activity contract](unified-activity.md). The coordinated migration below identifies implemented behavior and remaining work. Older slice tables are retained as historical records and do not override the implemented counting contract.

Product decisions below are settled unless explicitly marked as engineering proposals or implementation gates. Names and illustrative shapes are not mandatory TypeScript declarations. Follow [repository instructions](../../AGENTS.md) for branches, validation, and publication.

## Settled product decisions

1. Every sounding attack receives an input. A written tied continuation does not independently require an input.
2. Long-note and dotted-subdivision rules independently add positions. Required positions are their exact union; duplicate positions produce one input.
3. There is no separate every-beat requirement, no optional extra count positions, and no dotted-quarter required/optional/review setting.
4. Long-note eligibility uses the entire sounding duration, including ties. A duration qualifies at two or more counting pulses. Add positions at pulse intervals from the attack, strictly before the duration's end; do not snap to meter boundaries.
5. In simple meters the pulse is the denominator unit. In 6/8 it is a dotted quarter. Labels remain numbers 1–6 at eighth-note positions in 6/8; a pulse-level span starting on 1 uses 1 and 4, not 1 and 2.
6. Dotted subdivision is triggered only by a written dot, including on a tied continuation. A tied total equivalent to a dotted note does not acquire a dot implicitly.
7. In simple meters, supported singly dotted notes subdivide one level below their undotted value. A dotted half exposes three quarters; a dotted quarter exposes three eighths; a dotted eighth exposes three sixteenths.
8. In 6/8, a written dotted quarter exposes its three eighth-note counts when dotted subdivision is enabled. A written dotted half is treated as a two-pulse long note, not as a dotted-subdivision trigger: long-note subdivision gives 1 and 4, regardless of the dotted setting. With long-note subdivision off it has only its attack input. Two written tied dotted quarters can expose all six counts through their individual dotted subdivisions. Do not recursively subdivide inferred dotted-quarter pulses inside a written dotted half. The musical dot still determines exact duration; this distinction belongs only to counting policy.
9. Tempo does not automatically alter counting preferences. There is no separate compound counting-depth setting in this scope.
10. Rest inputs can be omitted entirely. When included, each written rest follows the same applicable subdivision rules as notes and remains a separate unit. Rests cannot tie.
11. Duration group membership is inferred from the written note/rest or complete sounding tie chain. Students toggle a duration indication; they do not author group boundaries.
12. Rest state is a student toggle per inferred unit and applies to every count in that unit. Parentheses and slashes are alternative renderings of that state.
13. A unit with no internal counts has no duration indication to enter. With internal counts, duration indication is required for notes and included rests only when the configured presentation makes it visible: a visible line or raised/lowered internal counts. When lines are hidden and internal appearance is unchanged, suppress the duration control and exclude duration from scoring.
14. Counting-preference edits apply on New exercise, preserving the current exercise and responses until then.
15. Share links configure the session. Saving a linked configuration as browser defaults is explicit.

## Defaults and available dimensions

| Dimension | New default | Supported choices |
| --- | --- | --- |
| Long-note subdivision | On | On / off |
| Dotted subdivision | Off | On / off |
| Include rests | On | On / off |
| Show duration line | On | On / off; hidden line retains the toggle only with raised/lowered internal counts |
| Duration-line placement | Beside counts | Below / above / beside |
| Internal-count appearance | Raised and smaller | Raised / lowered / unchanged |
| Rest appearance | Parentheses | Parentheses / slashes |
| Counting vocabulary | Preserve existing default | Existing numbers and syllables systems |
| Offbeat display | Preserve existing default | & / + |

No new pedagogical choices are encoded into generation levels. Length, level, repertoire, response mode, tempo, and performance style remain separate. Engineering proposal: visibility is an independent boolean, so hiding a line retains its preferred placement. Do not let changing placement silently reset an explicitly selected internal appearance.

## Changes from the current implementation

| Concern | Before migration | Replacement (core/editor/settings implemented) |
| --- | --- | --- |
| Music source | Compact `RhythmEvent` tuples in `RhythmMeasure` | Supported MusicXML-based source with typed access; one authoritative musical representation |
| Input positions | Dense eighth/sixteenth/triplet storage lattice; available and required positions differ | Exact, sparse required count positions; all exposed positions are required |
| Internal beats | Beat counts required even without attack | Required only when an enabled rule supplies them |
| Dotted convention | Special required/optional/provisional internal & policy | Independent dotted subdivision rule, no optional-count policy |
| Dotted ties | Total sounding dotted-quarter duration controls special rule | Actual written dotted members control dotted subdivision |
| Offbeat long durations | Required meter-beat positions inside the sound | Pulse-sized steps anchored to the sounding attack |
| 6/8 | All six numbered eighth positions required | Attacks plus enabled rules; pulse-level 1/4 or finer counts as applicable |
| Duration answers | Student-authored local or passage spans | One duration-indicated boolean per inferred unit with internal counts |
| Duration endpoints | Hidden-grid endpoint extension and provisional endpoint grading | Inferred full extent; graphical endpoint length is not scored |
| Short ties | A tie may require a line even without another required count | No internal count means no duration indication |
| Rest answers | Independently entered start/end parentheses ranges | Unit-level rest boolean; renderer supplies parentheses/slashes |
| Adjacent rests | Separate manually entered pairs | Separate inferred units; no arbitrary merging |
| Rest omissions | Rest inputs and pairs always expected | Include-rests preference removes rest units from the answer surface |
| Internal appearance | Derived from student spans | Derived from inferred membership plus the duration-indication toggle |
| Preference changes | Many writing preferences act immediately; vocabulary translates answers | Counting configuration is captured for the exercise; edits are pending |
| Shared logic | Measure evaluation followed by passage recomputation; local and tied line editors | One passage-wide plan, answer operation set, evaluator, and rendering projection |
| Sharing | Browser preferences plus testing/fixture URL options | Versioned counting-only URL configuration with explicit save-default action |

This intentionally changes the assessed task. Learners supply tokens, identify rests, and indicate shared duration. They are no longer assessed on parenthesis placement, arbitrary duration boundaries, or physical line length.

## Musical source and MusicXML profile

### Established concepts to reuse

Use measures containing individual notes/rests, written `type`, repeated `dot` elements, tuplet `time-modification`, and explicit tie relationships. A middle tied note retains its own written attributes. Do not nest full notes inside a tie's first member.

MusicXML references:

- [note](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/note/)
- [divisions](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions/)
- [tie tutorial](https://www.w3.org/2021/06/musicxml40/tutorial/midi-compatible-part/)
- [other-notation](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-notation/)

MusicXML is the musical source format, not a reason to implement arbitrary imported scores, polyphony, custom performed durations, repeats, pitches, or every supported MusicXML notation. Unsupported features must produce explicit capability errors. Standard MusicXML syntax validity and tUno repertoire support are different checks.

### Proposed implementation profile

Use score-partwise structure, one rhythm part and voice, ordered measures, unpitched notes/rests, supported meters, written values/dots, supported tuplets, and supported ties. Choose divisions sufficient for exact supported timing. Compute required MusicXML duration values from written type, dots, and time modification; never expose a second editable custom duration. On import, reject inconsistent duration rather than silently choosing one source.

Provide typed access so editor, generator, and evaluator do not independently traverse XML or parse numeric text. Preserve exact fraction arithmetic internally. A full literal XML DOM versus a typed schema-backed document is an engineering choice, but its serialization must have a defined MusicXML mapping. A merely MusicXML-inspired object is not to be presented as standards-compliant XML.

For a tie, one internal relation is authoritative. Expose read-only `tiedToPrevious` centrally; account for the preceding written event across a barline. Derive serialized start/stop endpoints from that relation. If imported MusicXML contains both endpoints, validate and normalize them into one relation. Rendering tie arcs must not create another editable tie truth.

### Subdivision marker

Use a reserved text marker in a valid extension location rather than adding arbitrary children under MusicXML `note`:

```xml
<notations>
  <other-notation type="single" print-object="no">tuno:subdivide</other-notation>
</notations>
```

`print-object="no"` prevents the application marker from being requested as printed notation. Other applications are not expected to implement its semantics or preserve it through every edit/export cycle.

The marker identifies participation in the application's subdivision policy; it is not sufficient by itself to distinguish long-note and dotted rules. The versioned counting configuration supplies those independent rules. Generate markers and count positions together in one builder. For tied units, the builder has the complete chain plus each written member, not merely the marked node.

Engineering proposal: keep the authored musical document free of generated teaching markers; enrich the exercise's derived document at creation. Persist the counting configuration, not a second independently editable cache of its results. Strip/rebuild stale reserved markers on ingestion. Standard score export can omit markers; an exercise export must include the configuration version if markers are retained. Do not interpret bare `subdivide` text from arbitrary imported content as a trusted tUno rule.

A boolean marker alone must never replace the rule configuration. Two enabled rules may both justify the same count; marker placement is a serialization convenience, not a second counting engine.

## Derived model and ownership

Build one immutable `CountingPlan` per exercise/configuration snapshot. Single measures use the same path as multi-measure passages.

### NotationSymbol

One derived symbol per written event exposes:

- Stable exercise-local source ID, measure/event location, and source reference.
- Note/rest kind, written value, dot count, and tuplet information through typed access.
- Exact measure-local and passage positions, duration, and exclusive end.
- Computed incoming tie status and sounding-unit reference.
- Required count references located within this written event.

No duplicate mutable copies of written attributes. A nested `counts` view and a passage-wide ordered lookup may reference the same immutable count records. A tied member can have no required count at its written onset.

### Count position

Each count has a stable exercise-local key, exact musical position, source symbol, inferred unit, expected atomic token, accessible position label, and the rules that required it. Rule reasons are derived diagnostics, not additional saved preferences. At shared boundaries, a position belongs to the event beginning there; intervals are start-inclusive/end-exclusive.

Available input positions equal required positions. Do not render unused placeholders from a dense hidden grid. Geometry may still use a layout lattice internally, but no answer identity or musical timing may depend on pixels or mutable array indices.

### Inferred unit

A unit represents one untied note, one written rest, or one complete sounding tie chain. It owns source references, exact extent, ordered count references, expected rest state, and whether duration indication is applicable. A rest has no tie chain. An omitted rest has no answer unit or input target.

The unit's first count is its sounding attack/rest onset; all later counts are internal, including counts at written tie continuations and counts after a barline. A unit with two or more count positions requires duration indication only when show-line is on or internal appearance is raised/lowered. This applies equally to notes and included rests: marking a multi-count rest does not satisfy its separate duration requirement. A single-count unit does not require duration indication.

### Student answer

Store only student evidence:

```text
counts: count-position ID → entered token or blank
units: unit ID → { restMarked: boolean, durationIndicated: boolean }
```

Initialize tokens blank and both toggles false. Do not initialize rest toggles from the correct musical answer. A learner can incorrectly mark a sounded unit as rested, leave a rest unmarked, omit a required duration indication, or enter an incorrect token.

Membership is never editable. Do not store span endpoints, parenthesis ranges, duplicated per-count rest flags, or separate booleans for pieces of a cross-bar group. Units with fewer than two counts, or with hidden lines and unchanged internal appearance, have no duration toggle; normalize an inapplicable true value away. When include-rests is off, suppress rest-marking controls for all units and exclude rest identification from scoring; omitted rests have no answer state.

The earlier design discussion about merging groups, inheriting the first count's conflicting state, student-created arbitrary spans, and grading incorrect boundaries is superseded. These operations do not exist in this model.

### Transient editor state

Focus, selected count, popover state, incomplete typed syllables, hover state, and layout geometry belong to the editor. They are not musical or persisted answer data. No endpoint-selection draft is needed.

## Counting algorithm

1. Validate supported written music and derive exact measure positions and complete sounding chains.
2. Create inferred units; omit answer units for rests when include-rests is off.
3. Add the sounding attack/rest onset for every included unit.
4. If long-note subdivision is on and a unit lasts at least two pulses, add attack + k × pulse for positive integers k while the position is strictly before the unit end.
5. If dotted subdivision is on, inspect every written dotted member eligible under the meter-aware policy (in 6/8, dotted quarters qualify and dotted halves do not). Add positions starting at that member's start, at the meter-appropriate step, strictly before that member's end. This may introduce a count at a tied member's start even though ties alone do not.
6. Within each eligible written dotted member, dotted subdivision takes precedence: discard long-note-only pulse positions that are absent from its dotted pattern. Outside those members, keep long-note positions. Merge remaining positions using exact fraction equality. Map each to its source event, unit, and meter-specific token. Reset labels at each measure, not at each note.
7. Derive duration-indication applicability from the unit's final count set and the captured presentation preferences.

Simple-meter dotted step is half the undotted written value for supported singly dotted events, incorporating supported time modification only when the capability contract permits it. In 6/8, apply the one-eighth dotted step to written dotted quarters only; written dotted halves are handled solely by the long-note rule. Apply the same distinction to included rests where the repertoire supports them. Do not treat generated pulse divisions as new written dotted events. Unsupported combinations must not be approximated.

Long-note pulses are quarter notes in 2/4, 3/4, 4/4 and dotted quarters in 6/8. The long-note threshold and step use these pulses, even though the 6/8 denominator is 8. There is no meter-boundary snapping.

Retain existing counting vocabularies, triplet `la`/`li`, and canonical `&` with `+` as display/input alias. Triplet onsets remain available without requiring the dotted or long-note rules. Do not infer new tuplet/tie UI support from MusicXML's broader vocabulary.

## Entry, rendering, and scoring

### Toggles and visual ownership

Selecting any count gives access to its unit's rest toggle when include-rests is on and, where applicable, duration toggle. Equivalent keyboard and touch actions invoke the same answer operation. Toggling from an internal count changes the same unit as toggling from its first count.

Duration on uses the inferred full unit extent and all its required counts. No endpoint selection, drag handles, start/end sliders, or provisional endpoint judgement remains. Toggling off removes the indication, not the inferred membership or rest marking.

Raised/lowered styling is the visual consequence of an entered duration indication. Its first count stays full size; internal counts use the chosen appearance. With show-line off and raised/lowered appearance, the indication and internal styling remain. These invisible lines require a visible selected-state control and accessible announcement so learners can inspect/remove the indication. With show-line off and unchanged appearance, suppress the duration control and do not score the indication; a selected-state control alone is not a substitute for persistent score feedback. Do not automatically supply a correct duration indication through styling before the student toggles it.

Rest marking applies to the whole inferred unit independently of the duration toggle. Parentheses enclose the unit's counts; adjacent written rests remain separate pairs. Slashes mark each displayed count in the marked unit. Incorrectly marked notes render the student's marking and receive correction; do not conceal their error. Missing count tokens do not prevent toggling a unit or change its boundaries.

Cross-bar and wrapped units retain one answer state. Render connected line pieces and internal-count appearance across measures. Parentheses on incorrectly rested tied units must also project coherently across systems without creating separate answer states. Exact bracket/line geometry is a renderer concern and is not scored.

### Evaluation

Evaluate the captured plan and answer without mutation:

- Tokens: every required input must equal its expected canonical token.
- Rest identification: when include-rests is on, each included unit's toggle must match note/rest identity; otherwise this dimension is not applicable.
- Duration indication: every unit with internal counts must have the indication on when the captured presentation provides a visible line or changed internal appearance. Otherwise this dimension is not applicable. Included rests are subject to the same requirement as notes.

Return separate feedback dimensions so a wrong rest marking does not obscure correct tokens. Use not-applicable feedback where no unit requires a dimension; do not award artificial credit for nonexistent tasks. No teacher-review verdict remains for optional counts or endpoints. This does not change performance assessment policies, reward thresholds, or mastery claims.

Feedback references measures/count labels and source IDs, not DOM geometry. Rewrapping, resizing, or changing response mode must not alter the evaluation of the same answer under the same plan. Visible versus invisible lines give equivalent scoring when internal appearance remains raised/lowered. Hidden lines plus unchanged appearance deliberately disable duration scoring in the next exercise's captured plan.

## Settings lifecycle and sharing

Updated 2026-10-28: Settings keeps an unsaved counting draft and previews it on one fixed answered passage. Save rebuilds the active counting plan on the same written score. Preserve tokens at matching count IDs with unchanged expected vocabulary, and applicable rest/connection evidence at matching unit IDs. Newly required and incompatible positions start blank. Retain confirmed counting feedback only when count IDs, expected tokens, rest applicability and duration applicability are unchanged. Performance records and exercise identity survive Save. Unsaved changes leave the active snapshot intact. New exercise uses saved counting preferences and clears both responses; panel switching preserves them.

The owner’s readable-URL follow-up replaces the original base64url proposal: `counting=1` identifies the version, with all nine fields in named `counting.*` query parameters (for example `counting.longNotes=true&counting.dotted=false`). No encoded-format compatibility is retained. URLs carry preferences only, not answers, calibration, fixtures, generation levels, or performance settings.

One schema supplies enum options, validation, defaults, encoding, decoding, and migrations. Reject unsupported versions and malformed payloads with a concise notice and keep normal saved/default preferences. Bound payload size. Never execute payload content.

At initial load, a valid URL configuration overrides saved counting preferences for the session before the first exercise is created. Other preference families retain their normal persistence. Session edits derived from a linked configuration remain session-scoped until Save as my defaults; unrelated saves must not accidentally persist the override. Copy counting link serializes the configuration shown in settings and makes its pending status clear. Preserve unrelated query parameters and current view routing.

## Acceptance examples

Duration-toggle expectations below assume a visible line or raised/lowered internal appearance. With both cues absent, duration indication is not applicable. Positions below are chronological; repeated `&` tokens refer to different exact positions. Superscripts illustrate entered duration indications, not initial answer values. All examples use correct student answers when describing completed display.

| Meter and unit | Long | Dotted | Required counts and grouping |
| --- | --- | --- | --- |
| 4/4 half on 1 | Off | Off | `1`; no duration toggle |
| 4/4 half on 1 | On | Off | `1 2`; one duration toggle |
| 4/4 whole on 1 | On | Off | `1 2 3 4`; completed hidden-line display `1²³⁴` |
| 4/4 dotted quarter on 1, followed by E | On | Off | Dotted unit `1`; next attack `&` of 2; no internal `2` |
| Same dotted quarter | Off | On | `1 & 2` in its unit; next E remains separate |
| 4/4 Q~Q starting on 1 | On | Off | `1 2`, one unit |
| 4/4 Q~E starting on 1 | Off | On | `1` only; no written dot |
| 4/4 E~dotted-Q starting on 1 | Off | On | `1 & 2 &`, one unit |
| 4/4 Q~Q starting on & of 1 | On | Off | `& &`, at the attack and one quarter later; not `& 2 3` |
| Q on 4 tied to Q in next 4/4 bar | On | Off | `4 / 1`, one duration toggle; new bar's `1` is internal |
| Any tied chain | Off | Off | Sounding attack only; no automatic continuation inputs or duration toggle |
| 6/8 dotted half on 1 | Off | Off | `1` |
| 6/8 dotted half on 1 | On | Off | `1 4`, one unit |
| 6/8 dotted half on 1 | Off | On | `1`; written dotted half does not trigger dotted subdivision |
| 6/8 dotted half on 1 | On | On | `1 4`, one unit; dotted option adds nothing |
| 6/8 dotted-Q~dotted-Q | On | Off | `1 4`, one unit |
| 6/8 dotted-Q~dotted-Q | Either | On | All six, one unit; completed display `1²³⁴⁵⁶` |
| 6/8 two untied dotted quarters | On | Off | `1` and `4`, two single-count units |
| 6/8 two untied dotted quarters | Either | On | Two units; completed display `1²³ 4⁵⁶` |
| 6/8 six eighth notes | Either | Either | All six onsets, six units |
| 4/4 half rest on 1, included | On | Off | `1 2`, rest toggle and duration toggle; `(1 2)` or two slashed counts |
| 4/4 two quarter rests on 1 and 2 | On | Off | Separate units, `(1) (2)`; cannot merge |
| Any written rests, omitted | Either | Either | No rest inputs, no rest answers, no rest-duration requirements |

### Owner's two-measure example

Source: 4/4 `Q Q E E E E / H. Q`.

With dotted subdivision on, counts are `1 2 3 & 4 & / 1 2 3 4`. The dotted half owns the second bar's first three counts. With its duration indication entered and a hidden line, that bar displays `1²³ 4`. Long-note subdivision alone also produces the same count positions for this example. Both rules produce the same result without duplicates.

The current eighth-grid answer for the second bar uses symbols `['1', '', '2', '', '3', '', '4', '']`, a duration span `{ start: 0, end: 5 }`, and a separate empty rest-range list. The replacement stores four sparse token answers and the dotted-half unit's duration/rest toggles. Its first three count positions are inferred; neither hidden slots nor the endpoint 5 appear in the answer.

## Review dispositions (2026-10-14)

- Multi-count rests requiring duration indication is intentional when duration assessment is applicable. Silence does not waive the duration rule.
- Hidden lines plus unchanged internal appearance must suppress the duration toggle and scoring. Disabled rest entry similarly suppresses rest controls and scoring.
- Attack-relative long ties may omit the next bar's numbered downbeat. This is accepted; do not add an implicit every-beat or barline rule.
- Available inputs equaling required inputs, and removal of optional/reviewable subdivisions, are accepted changes.
- Compound dotted-half clarification resolved: a written dotted half in 6/8 belongs to long-note subdivision, yielding `1 4` when that rule is enabled. Its dot does not trigger finer counting. Written tied dotted quarters independently trigger dotted subdivision and can yield all six counts. This supersedes the earlier approval of six counts for a single dotted half with dotted subdivision enabled. With long-note subdivision off, the dotted half has only its attack input. This is a meter-aware teaching policy, not a change to the mathematical meaning of a dot.
- MusicXML timing concern: divisions need not cause rounding or replace fraction arithmetic. Keep exact rational arithmetic and centralize conversion. At 12 divisions per quarter, a quarter is 12, an eighth is 6, a sixteenth is 3, and a triplet eighth is 4; a mixed bar sums exactly. This is an example for the current repertoire, not a universal fixed resolution. Derive an adequate scale for the supported profile and reject unsupported/overflowing conversions instead of rounding. No separate floating-point timing engine is introduced. This clarifies the existing exact-time requirement rather than approving broader tuplet support.

## Implementation boundaries and remaining engineering gates

These are not unresolved teaching preferences:

- **6/8 dotted half:** the examples require counting/engraving support, but the old adapter already accepts sounded half values, including dotted halves, in compound meter; generation skips them there. The coordinated editor slice adds an explicit dotted-half engraving/entry fixture. Do not silently broaden default level ingredients or generation pools; decide and document any generation exposure separately.
- **Mixed-meter chains:** current generated exercises use one meter. Do not invent pulse-change semantics for a tied unit across different meters in this overhaul; retain a clear unsupported boundary until separately specified.
- **Tuplets and double dots:** retain current UI repertoire unless explicitly extended. MusicXML representation is not permission to expose every model feature. Preserve existing sounded simple-meter triplets and their exact thirds.
- **Duration presentation:** retain full derived musical extent for line geometry, but validate only indication state. No endpoint tolerance needs to survive.
- **Standard compatibility:** finalize the exact XML profile and serialization fixtures before migrating runtime consumers. Validate standard output and reject unsupported imported constructs. General-purpose import UI is outside this spec.

## Migration and affected code

| Area | Work |
| --- | --- |
| `src/music/measure.ts`, fractions | Preserve derivation/validation semantics behind the new typed source; migrate source ownership once, no parallel editable models |
| Shared generation and fixtures | Produce the chosen source profile through common constructors; retain written spelling, exact totals, and generation constraints |
| `count-writing/positions.ts`, `grid.ts`, `passage.ts` | Replace availability/requirement split and dense answer coordinates with one sparse counting plan |
| `count-writing/evaluation.ts` | Replace symbols/spans/rest-ranges contract and special dotted review paths with plan-based token/unit evaluation |
| `count-writing/editor.ts`, `passage-lines.ts`, palette/popover | Replace endpoint gestures with shared unit toggles; remove separate local/tied editing behavior |
| Notation/layout/CSS | Render from source plus immutable plan and student state; support inferred cross-system pieces and hidden lines |
| Shared settings/catalog, `rhythm-walk/activity.ts`, `main.ts` | Add new schema, pending/active snapshots, URL override/save behavior; remove obsolete controls |
| Performance adapters and assessment | Adapt source access while preserving exact attack timing, holds, calibration, and captured performance policy |
| Unit/browser fixtures and documentation | Replace assertions for deliberately removed behavior; preserve independent lifecycle/performance regressions |

Temporary adapters may facilitate migration, but must be explicitly one-way and removed when callers migrate. The end state must not retain two evaluators, duplicate musical sources, or old span editing behind a hidden alternate mode.

Preferences require a versioned migration. Preserve independently meaningful vocabulary, offbeat, and appearance choices. The old required/optional/review dotted-quarter field has no exact equivalent: do not claim lossless conversion. Engineering proposal: use the new subdivision defaults for migrated users, preserve explicit appearance choices, and show a one-time concise explanation. New users receive the defaults above. Exercise responses are not currently persisted, so no old student-span migration is necessary. Preserve unrelated saved performance/generation settings and any historical performance policy contracts.

## Verification and delivery sequence

1. Add exact source/profile fixtures and round-trip/validation tests, including ties and tuplets; establish one musical source owner.
2. Implement pure counting-plan derivation and acceptance tables before UI replacement.
3. Implement unit toggle operations and pure evaluation; then migrate both one-bar and passage editors to them.
4. Connect pending settings, serialization, migration, and URL/session precedence.
5. Remove superseded paths and update current-behavior contracts together.

Required tests:

- Dotted-member precedence is order-independent and duplicate-free; exposed positions equal required positions.
- Dotted written-member behavior differs deliberately from equivalent undotted tied spelling.
- Offbeat long-note steps are attack-relative; ties across barlines retain one unit and reset labels.
- All compound examples above, including independent dotted-only behavior.
- Rest omission, wrong note marked as rest, unmarked rest, and inheritance from any count's toggle.
- No internal counts means no duration control; toggling duration never changes membership or rest state.
- Parentheses/slashes evaluate identically. Visible/invisible lines evaluate identically when internal appearance is raised/lowered. Hidden lines plus unchanged appearance suppress the duration control and scoring. Include-rests off suppresses all rest controls and rest scoring.
- No custom endpoint, overlap, group-merge, or parenthesis-selection interaction remains reachable.
- Pending preferences preserve current answers/results; New exercise applies them and clears responses.
- URL round-trip, malformed/version rejection, save-default isolation, and unrelated settings preservation.
- Mode switching, wrapping, narrow layouts, keyboard/touch access, screen-reader state, and cross-bar focus retain one logical answer.
- Performance attack/duration/time mapping remains identical for equivalent source fixtures before and after migration.

For application implementation use Node 24, `npm ci`, `npm run check`, and relevant browser validation, following repository instructions. Full release checks and physical-device requirements remain separate. The original specification was documentation-only. Foundation implementation and its validation are recorded below; editor/settings migration and release verification remain separate.

## Foundational implementation (2026-10-14)

Historical foundation handoff at `2d323a00ac142d7a8c755445061a5ff0345a9558`: this slice implemented the replacement's pure contract without switching the running editor to it. The coordinated migration below supersedes its runtime/pending statements. Existing current-behavior documents and tests continue to describe the shipped runtime. The new acceptance tests explicitly target the replacement; no existing grading assertions were rewritten.

### Concrete modules and ownership

| Module | Responsibility |
| --- | --- |
| [`src/music/score.ts`](../../src/music/score.ts) | Typed `RhythmScore`, flat `WrittenNote` members, immutable source construction, exact passage derivation, computed incoming ties and sounding attacks |
| [`src/music/written.ts`](../../src/music/written.ts) | Shared written-duration arithmetic, also used by the legacy `duration` function |
| [`src/music/musicxml.ts`](../../src/music/musicxml.ts) | Strict MusicXML boundary parser, standard score serialization and plan-derived exercise serialization |
| `src/music/legacy-score.ts` (subsequently removed) | Temporary one-way `RhythmMeasure[] → RhythmScore` snapshot adapter |
| [`src/music/counting/preferences.ts`](../../src/music/counting/preferences.ts) | Version 1 preferences, defaults, enum options, validation and detached immutable capture |
| [`src/music/counting/vocabulary.ts`](../../src/music/counting/vocabulary.ts) | Shared atomic vocabulary and exact position-to-token mapping; legacy input/evaluation modules re-export their existing API |
| [`src/music/counting/plan.ts`](../../src/music/counting/plan.ts) | One passage-wide rule interpreter, `NotationSymbol`, exact counts, inferred units and derived marker participation |
| [`src/music/counting/answer.ts`](../../src/music/counting/answer.ts) | Blank initialization, canonical token entry, unit toggles, normalization and independent token/rest/duration evaluation |

Construct sources with `createScore` or `parseMusicXML`; build with `buildCountingPlan(source, preferences)`. A single bar is a one-measure score through that same function. Consumers use typed source references and the plan's count/unit records; XML traversal is confined to `musicxml.ts`, using the pinned `@xmldom/xmldom` parser. Plan/answer operations have no DOM dependency.

A written member owns `id`, `kind`, `type`, `dots`, optional `timeModification`, and `tieNext`. Unknown authored fields are rejected, including stored duration, incoming tie status or teaching markers. `tieNext` alone is authoritative. `deriveScore` computes `tiedToPrevious` across bars and retains every written member in a sounding attack. Fractions remain normalized whole-note quantities with checked safe-integer arithmetic. No layout or performance milliseconds enter this model.

Counts use `count:<zero-based measure ordinal>:<reduced local numerator>/<denominator>` IDs; units use `unit:<attack/rest source ID>`. These identities are local to an immutable exercise: rebuilding with different subdivision preferences preserves shared positions' IDs, while adding/removing exposed counts never renumbers them. They are not dense slot indices or identities across musical source edits. Source edits require a new exercise. Symbols and units reference the same frozen count records as the passage list. Omitted rests retain notation symbols but have `unitId: null` and no count records.

The builder captures all preferences, including presentation. `showDurationLine` is independent of `linePlacement`; changing placement does not reset appearance. There is no optional count list. Marker participation is produced during the same rule interpretation as count positions. Evaluation reads only the finished plan and student evidence, with `correct`, `incorrect`, and `not-applicable` dimension/item verdicts and source/count/label references. Rest and duration toggles never change membership. `normalizeAnswer` removes foreign keys, supplies blank/false missing evidence, and clears inapplicable controls; token entry accepts `+` as canonical `&`. Incomplete syllable composition remains future editor state.

### Supported XML profile, version 1

The serialized format is actual MusicXML 4.0, not JSON described as XML. The deliberately narrow profile is:

- Uncompressed, unnamespaced `score-partwise version="4.0"`; exactly one declared part, ordered full measures, one implicit or explicit voice `1`.
- Every measure explicitly supplies positive integer `divisions` and `time` (`beats`, `beat-type`). Supported meters are 2/4, 3/4, 4/4 and 6/8, with conventional grouping. Attribute inheritance, pickup measures and custom groupings are outside this profile.
- Each note has exactly one empty `unpitched` or `rest`, positive integer `duration`, a required `type` (`whole`, `half`, `quarter`, `eighth`, `16th`), zero to two empty `dot` elements, and optional flat `time-modification` containing `actual-notes` and `normal-notes`. Only homogeneous complete 3:2 or 2:3 groups within a bar are representable. Pitch/staff placement, nested tuplets and performed timing overrides are unsupported.
- Notes have unique ASCII XML IDs. Missing imported IDs receive deterministic measure/event IDs; collisions are rejected. Serialization chooses a part ID that does not collide with any note ID. Measure numbers, part ID/name, and optional voice syntax are normalized; they are not preserved editorial metadata.
- Sound `<tie type="start|stop"/>` endpoints must match through the complete passage. Optional `<notations><tied .../></notations>` arcs must agree with those sound endpoints. Export derives both forms from `tieNext`; there is no second editable arc relationship. Rests cannot start or receive ties.
- Divisions are the least common multiple of the reduced quarter-duration denominators. Export requires exact integral duration values, and import checks those values against written duration. Decimal/overflowing divisions, inconsistent durations and incomplete measures are rejected rather than rounded.
- Only the reserved `<other-notation type="single" print-object="no">tuno:subdivide</other-notation>` text marker is accepted; it is stripped on ingestion. No custom XML child is accepted. Standard `serializeMusicXML` omits teaching data. `serializeCountingExercise(plan)` derives markers from the plan and includes the captured versioned JSON in standard `identification/miscellaneous/miscellaneous-field name="tuno:counting-v1"` metadata. The musical parser discards that metadata; importing an exercise's preferences is a later settings concern, not an implicit instruction to change the session.
- Unknown elements/attributes, multiple parts, chords, backup/forward, repeats, grace/cue notes and unsupported namespaces are explicit profile errors. DTD/entity declarations and documents over 1,000,000 characters are rejected. The parser enforces this profile rather than attempting general MusicXML schema validation at runtime.

The six [golden XML fixtures](../../tests/fixtures/musicxml/README.md) cover binary rests/dots, mixed triplets/sixteenths, a three-member cross-bar tie, the compound dotted half, source-only double dots/duplets, and a derived teaching-marker exercise. They were independently validated against the official [MusicXML 4.0 XSD](https://github.com/w3c/musicxml/blob/v4.0/schema/musicxml.xsd); the automated suite checks their canonical round trips and rejection cases. This does not promise arbitrary third-party score import.

### Capability boundary and migration

The typed source can preserve double dots and duplets, but the counting plan deliberately rejects them. The counting boundary retains the current reviewed sounded, beat-aligned eighth triplets, with no tied/rest/dotted tuplet members. It also retains the restrictions on dotted wholes/sixteenths/eighth rests and simple-meter dotted-half rests. The accepted 6/8 written dotted half is supported in the new pure core (including its rest counterpart), tested independently of generation and current engraving. Its dot never triggers finer counts. Generation pools and levels were unchanged by the foundation. Correction: the old grid accepted sounded half values in compound meter; the coordinated slice below adds explicit fixture coverage.

Mixed-meter written passages can be represented, and source derivation preserves ties across meter changes. Counting rejects a tied unit that crosses a meter change before interpreting rules. Separate units may use different supported meters. No pulse-change teaching policy is inferred.

**Current runtime source owner:** generation/fixtures and `Activity` still own only legacy `RhythmMeasure[]`. Existing grids, span/rest-range editors, evaluator, notation renderer, performance timing and performance scoring remain on that path. The only runtime refactors are shared duration arithmetic and vocabulary; their behavior is preserved. There is no hidden alternate editor and no new stored musical mirror.

**Temporary adapter owner:** the music core owns `scoreFromLegacy` in `legacy-score.ts`. Conversion is strictly legacy → detached frozen typed source; there is no reverse adapter or synchronization/write-back. Current callers are foundation tests (fixture/generated-source equivalence and acceptance examples). The future exercise-creation boundary may call it once and retain only the new immutable score/plan for the migrated exercise, not two editable musical sources. Remove the adapter once shared generation and fixtures construct `RhythmScore` directly and all source consumers migrate. Performance should consume the derived attack/member view with unchanged timing and scoring policy; do not convert the score back into an editable legacy passage.

### Verification and next slice

Foundation tests are [`counting-plan.test.ts`](../../tests/counting-plan.test.ts) and [`musicxml.test.ts`](../../tests/musicxml.test.ts). Existing count-writing tests remain current-runtime regressions. New tests cover all applicable pure acceptance examples, all compound rule combinations, duplicate-free union and stable identities across every existing fixture, complete sounding duration, written-member dot semantics, exact triplet positions, rest omission and inherited toggles, all duration visibility/appearance combinations, independent verdicts, immutable capture, strict XML rejection, and equivalent attacks/durations/performance seconds for every existing fixture. Another 128 seeded generated passages cover all four meters and lengths 1–4 through XML and the new plan builder.

Validation passed on Node 24.21.0: `npm ci`, `npm run check` (421 tests, TypeScript and application builds), independent MusicXML XSD validation, local documentation-link review, and `git diff --check`. Native T3 browser smoke checks ran the exact local built bundle in a same-origin inline frame because the preview's loopback URL returned a different bundle hash. The existing Uno browser scenarios passed 46 assertions at both 1280px and 320px, checking generation, count entry, pending level changes and mode retention. Physical-device checks, completed performance capture, fresh-load browser scenarios and full release verification were not performed. XSD validation was an independent check using Python/lxml and the official v4.0 schema, not a new runtime or `npm check` dependency.

Next, migrate the one-bar and passage editor together to `CountingPlan` and `CountingAnswer`: render only plan counts, connect all rest/duration actions to `toggleUnit`, project one unit across barlines/wraps, and remove endpoint/merge/provisional grading paths. Add the compound dotted-half engraving fixture at that coordinated boundary. Then wire the versioned counting contract into active/pending exercise snapshots, settings controls, URL/session precedence and explicit save-default behavior. Replace source producers/consumers and remove the temporary adapter as one ownership migration. The current persistence/UI semantics have not been partially switched in this slice.

## Coordinated editor/settings migration (2026-10-14)

Write Counts and Both now use `Activity.countingPlan`, `countingAnswer` and `countingResult`. Every replacement creates one plan through `scoreFromLegacy` → `buildCountingPlan`, initializes blank evidence, and clears both response lifecycles. Single measures and passages use the same `createPlanEditor` view, `enterToken`, `toggleUnit` and `evaluateAnswer`. Arrow navigation follows the passage's ordered count IDs, including across empty measures. Zero-input exercises remain checkable with not-applicable dimensions excluded.

`plan-editor.ts` stores only transient focus/composition state. It projects immutable unit extents into measure pieces, so ties retain one answer across bars and systems. Rest and Connect palette buttons expose pressed state and R/C shortcuts (Connect replaces the former Duration label and D shortcut). These keys do not conflict with atomic counts, t+a/e composition, l/i aliases, &/+ input, arrows, Delete/Backspace or Enter. Parentheses/slashes render student rest state, including incorrectly marked sounds. Duration styling is conditional on entered indication; the first unit count stays full size. Hidden lines retain raised/lowered feedback. Hidden lines plus unchanged internal appearance suppress duration controls and assessment.

All nine counting dimensions are working settings, validated and defaulted by the shared version-1 contract. They remain pending until replacement; Check reads the captured plan, and existing results remain intact. Browser persistence keeps the existing outer v1 key with a nested versioned `counting` object. Migration preserves valid old vocabulary, offbeat, line placement and internal appearance; long-note/dotted/include-rest defaults come from the new contract, not the obsolete dotted convention. The first migrated visit explains the changed behavior. Saves omit old counting fields and never overwrite unrelated performance/generation preferences. Reload restores preferences, not answers. URL overrides, sharing and explicit save-default/session isolation remain out of scope.

Source ownership is deliberately temporary: `Activity` retains the frozen legacy passage for engraving and performance and the detached immutable score inside the counting plan. Neither is editable, and no synchronization or reverse adapter exists. Generation and fixture producers are unchanged except for explicit `six-dotted-half`, `six-dotted-tie` and `all-rests` review examples; levels/pools have not expanded. `countGrid`/`positions` still supply engraving geometry and performance timeline layout, never requirements or answer identities. Desktop practice (viewports at least 1000 CSS pixels) uses the available width and keeps all 1–4 measures on one system in every response mode, including dense sixteenth/triplet material. Count targets compact to the available subdivision spacing; desktop rest parentheses sit inside those targets around the token. Notation spacing changes independently of bounded glyph size, retaining note/count alignment, event DOM identity and performance feedback. Below 1000px, writing retains 44px touch targets and the shared minimum width, wrapping whole bars when needed. The passage owns any horizontal scrolling; individual measures never scroll independently. Explicit wrapped fixtures apply only to narrow layouts. Actions stay in normal flow inside measures. See [the responsive audit](responsive-layout-audit.md) for tested widths and limits.

The runtime endpoint editors/popover were deleted. Legacy counting evaluation and passage-answer derivation were moved into `tests/legacy/` solely to preserve independent historical regressions; the application no longer imports them. Existing legacy tests retain their expectations and are explicitly separate from new-core/runtime tests. Remove the core-owned one-way source adapter after generation/fixtures construct typed scores and engraving/performance consume their derived views directly. No PR #40, additional UIL, cut-time or mixed-meter work is included.

Validation: Node 24.21.0, `npm ci`, `npm run check`, documentation-link review and `git diff --check`. The native T3 preview could not reach workspace loopback (connection refused), so browser scenarios used the exact local built JS/CSS in a same-origin frame with isolated in-memory browser storage. [Coordinated browser scenarios](../../scripts/counting-plan-browser-scenarios.js) cover desktop/narrow entry, toggles, compound cases, pending settings, mode retention, Check/Retry/New, suppression, zero inputs and reload migration. Physical touch hardware, assistive-technology testing and full release verification remain separate. The final `npm run check` passed 430 tests, TypeScript and application/portable builds. Native scenarios passed 48 assertions each at 1536px and 320px, plus four fresh-document persistence assertions and native keyboard entry/toggling. Synthetic touch routing was checked; real touch capture was not. An attempted browser performance capture was interrupted by focus loss; its record survived mode changes, but a completed capture was not verified. The standalone Chromium/Firefox runner was authored and syntax-checked, not executed in this session; browser execution used T3 as required. `test:counts:browser` and the count portion of `verify` now select this coordinated suite; the four old endpoint browser scripts remain explicitly historical records.

The URL/session follow-up below completes counting-only URL precedence and explicit adoption. Next, migrate remaining musical source producers/consumers and remove the one-way adapter. Performance scoring and reward policy must remain unchanged.


## Counting URL/session slice implemented (2026-10-15)

The DOM-independent [counting link codec](../../src/music/counting/link.ts) serializes the complete existing version-1 counting contract as readable query parameters: `counting=1`, followed by `counting.longNotes`, `counting.dotted`, `counting.includeRests`, `counting.showDurationLine`, `counting.linePlacement`, `counting.internalAppearance`, `counting.restAppearance`, `counting.vocabulary` and `counting.offbeat`. Booleans use `true`/`false`; enums use their canonical names. The offbeat symbols use normal URL escaping (`%26` or `%2B`). Stable schema-key order makes encoding deterministic. The decoder bounds the counting parameters at 2,048 encoded characters, converts schema primitive types and delegates field/version validation to `captureCountingPreferences`. All nine fields are required; partial links never mix with recipient defaults. The new format replaces base64url entirely, with no compatibility layer. Empty, malformed, duplicate, oversized, unsupported-version and invalid-field parameters are rejected as a whole with a concise notice; saved/default preferences remain in effect.

The [preference session](../../src/apps/rhythm-walk/counting-session.ts) resolves valid links before initial Activity creation. Linked counting and subsequent counting edits stay session-scoped; every ordinary save retains the recipient's counting defaults while persisting unrelated settings normally. **Save as my defaults** explicitly adopts the selected pending counting configuration. Failed storage writes leave the session isolated. Once adopted, subsequent edits use normal automatic persistence. Reloading a URL containing `counting` starts a new linked session from that URL; opening without it restores browser defaults. Active plans, answers and results remain unchanged until New exercise, including during copying and adoption.

**Copy counting preferences link** shares all selections shown in Settings, including pending edits. It replaces existing counting parameters, sorts query keys, preserves unrelated parameters and the current view hash, and removes the known developer controls `fixture` and `testing`. Both normal Uno234 compatibility routes remain usable (`/prototypes/rhythm-walk/` and `/prototypes/count-writing/`); other paths normalize to the rhythm-walk route. Clipboard rejection or absence exposes a focused, selected, labeled read-only URL for manual copying. No answers, generation, tempo, response mode or performance preferences enter the payload.

Validation: Node 24.21.0, `npm ci`, `npm run check` (437 tests, TypeScript, application and portable builds), script syntax checks, documentation-link review and `git diff --check`. [Focused codec/session tests](../../tests/counting-link.test.ts) cover all nine dimensions and every enum combination, deterministic encoding, rejection, precedence, storage isolation/adoption, initial capture and pending-answer retention. [Sharing browser scenarios](../../scripts/counting-link-browser-scenarios.js) passed 20 assertions at both 1536px and 320px; existing coordinated counting scenarios passed 65 at each width, preserving the earlier UI fixes. The shared browser runner now includes the sharing scenarios.

T3 could not reach workspace loopback (connection refused), so browser checks loaded the complete local built JS/CSS into fresh same-origin frames with isolated in-memory storage. Narrow checks used an exact 320px frame after T3 viewport resizing timed out. Clipboard success and rejection were simulated; actual OS clipboard permissions, physical devices, assistive technology, completed performance capture, the standalone Chromium/Firefox runner and full release verification were not exercised. No integration or publication occurred.

Remaining work is the generation/fixture, engraving/layout and performance musical-source ownership migration and removal of the one-way legacy adapter. This slice adds no counting rules, optional counts or editable endpoints and does not change performance scoring.

Readable-URL follow-up: at the owner’s request, replaced encoded payloads entirely with explicit query fields; no backward compatibility. Node 24 `npm run check` passed again (437 tests and builds), and the updated sharing/session browser scenarios passed 20 assertions each at 1280px and 320px in T3 using the same isolated local-bundle harness and simulated clipboard described above.


## Single source migration (2026-10-15)

This section supersedes the historical source-owner and next-slice notes above. Generation and fixtures now construct typed `RhythmScore` values. Activity, CountingPlan, notation and active performance capture share one validated immutable score with stable written IDs. `measure.ts` now provides typed authoring helpers and derived beat/layout views; `legacy-score.ts` is deleted. Imported IDs survive capture; generated IDs are assigned once at construction. Completed evidence carries `exercise.score`, not `exercise.measures`. No reverse adapter or synchronized musical mirror remains.

Empty count input names describe measure, counting beat and exact offset only; they do not reveal the expected vocabulary token. Entered answers and unit flags continue to be announced by the editor. Scoring, hold thresholds, calibration and rewards are unchanged. See [source migration validation](source-migration-validation.md) for evidence and outstanding physical acceptance.


## Count presentation refinement (2026-10-15)

Dotted subdivision owns the internal count pattern of each eligible written dotted member when both subdivision options are enabled. Long-note subdivision still uses complete sounding length and attack-relative pulses elsewhere. For a dotted eighth tied to a dotted quarter starting on beat 1, the tied unit reads `1 e & a e a`; unrelated `2` and `3` pulse counts are omitted. Turning dotted subdivision off restores `1 2 3` under the long-note rule. This supersedes unconditional rule-union language in historical implementation notes above.

Duration lines and rest enclosures terminate at the final depicted count, including across bars, instead of extending to the end of the musical sound/rest. Exact musical durations and Tap + Hold scoring are unaffected. Count-entry palette keys use a cream fill, contrasting outline and darker cream shadow with visible keyboard focus and pressed states.


## Notation settings and in-place Save (2026-10-28)

The current lifecycle in [Settings](settings.md) supersedes the replacement-only behavior recorded in the historical implementation slices above. Counting choices are native notation radio cards and checkboxes, with a fixed three-measure answered preview. Save applies choices to the same exercise; Save as my defaults also adopts them for linked sessions. Copy shares draft choices without applying them. Unsaved choices neither persist as defaults nor affect Next Exercise. The assessment contract, rather than preference-key categories, determines whether confirmed feedback can be retained.
