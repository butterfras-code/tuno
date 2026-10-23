# UIL teaching levels

Levels I–IV offer **General / Percussion · note-only practice** in Write Counts,
Tap Rhythms and Both. These are short rhythm teaching configurations informed by
UIL criteria, not full contest-composition validators or claims of UIL endorsement.
The shared Level selector changes pending settings; New exercise replaces the
passage and clears responses. Mode switching preserves both independent responses.

## Reviewed source matrix

Source: [official band criteria](https://www.uiltexas.org/music/concert-sight-reading/band-sight-reading-criteria), heading **Revised 2022**, rechecked **2026-10-14**. All 17 unique notation images were downloaded from that page and visually inspected, including meters. The historical handoff was background only. Reference images are linked, not bundled or relicensed.

`B` below means the five individually linked basic figures in the next table. These rows describe source facts; implementation choices follow separately.

| Level | General figures | Percussion additions | Meters / within-piece changes |
| --- | --- | --- | --- |
| I | B; quarter rest forbidden on beat 1; eighth rests forbidden | E S S; S S S S | 4/4; none |
| II | Same as I | Same as I | Same as I |
| III | B; Q. E | E. S; E S S; S S S S | 2/4, 3/4, 4/4; none |
| IV | B; Q. E; E Q E; E. S; E S S; S S S S | Same as winds | III meters; one change |
| V | IV figures; E E E (3:2); S S E | Same as winds | IV meters, 6/8, cut time; two changes |
| VI | Same as V | Same as winds | Same meters; three changes |

Each row maps the corresponding section of the [official criteria](https://www.uiltexas.org/music/concert-sight-reading/band-sight-reading-criteria). The Level III 4/4→3/4 exception concerns the **2023 composition**, with reading stopped before 3/4; it is not a permanent permission. Ties, other tuplets, triplet rests and broader rest permissions are not specified sufficiently for this implementation. No extra permutations are inferred from note names.

## Direct visual evidence

Dots mean one written dot. These are individual figures, not ingredient sets. Scope is recorded separately in each definition.

| Figure | Official image |
| --- | --- |
| Q (B) | [Quarter](https://www.uiltexas.org/files/music/music-notations/Rquarter.jpg) |
| H (B) | [Half](https://www.uiltexas.org/files/music/music-notations/Rhalf.jpg) |
| H. (B) | [Dotted half](https://www.uiltexas.org/files/music/music-notations/Rdothalf.jpg) |
| W (B) | [Whole](https://www.uiltexas.org/files/music/music-notations/Rwhole.jpg) |
| E E (B) | [Two beamed eighths](https://www.uiltexas.org/files/music/music-notations/R2eighth.jpg) |
| Q. E | [Dotted quarter, eighth](https://www.uiltexas.org/files/music/music-notations/Rdot4-8.jpg) |
| E Q E | [Eighth, quarter, eighth](https://www.uiltexas.org/files/music/music-notations/R8-4-8.jpg) |
| E. S | [Dotted eighth, sixteenth](https://www.uiltexas.org/files/music/music-notations/Rdot8-s.jpg) |
| E S S | [Eighth, two sixteenths](https://www.uiltexas.org/files/music/music-notations/R8-16-16.jpg) |
| S S S S | [Four sixteenths](https://www.uiltexas.org/files/music/music-notations/R4-16.jpg) |
| S S E | [Two sixteenths, eighth](https://www.uiltexas.org/files/music/music-notations/R16-16-8.jpg) |
| Three sounded 3:2 eighths | [Triplet](https://www.uiltexas.org/files/music/music-notations/Rtriplet.jpg) |

Inspected meters: [4/4](https://www.uiltexas.org/files/music/music-notations/meter44.jpg), [2/4](https://www.uiltexas.org/files/music/music-notations/meter24.jpg), [3/4](https://www.uiltexas.org/files/music/music-notations/meter34.jpg), [6/8](https://www.uiltexas.org/files/music/music-notations/meter68.jpg), [cut time](https://www.uiltexas.org/files/music/music-notations/meterC.jpg). The last image has the vertical stroke through C; it is not common time.

## Source recheck

The official Revised 2022 page and all 17 unique notation images were downloaded
and visually inspected again on 2026-10-14. No changes to the inventory above were
found. In particular, meterC.jpg has the vertical stroke of cut time; R8-16-16
is E S S, Rdot8-s is E. S, and Rtriplet is three sounded eighths with a 3 bracket.
Image files remain externally linked rather than bundled or relicensed.

## Playable scope and teaching choices

Let B = Q, H, H., W, and E E. The source matrix above remains authoritative for
instrument scope. This table describes the implemented short-exercise profile:

| Level | General | Percussion | Supported meters |
| --- | --- | --- | --- |
| I–II | B | B + E S S, S S S S | 4/4 |
| III | B + Q. E | General + E. S, E S S, S S S S | 2/4, 3/4, 4/4 |
| IV | B + Q. E, E Q E, E. S, E S S, S S S S | Same | 2/4, 3/4, 4/4 |

Each exercise selects **one meter** for all its measures. Default length is two,
configurable 1–4 independently of level. IV is figure practice; it does not fulfill
the source's composition-level meter-change requirement. V–VI, cut time and
within-exercise meter changes are deferred by the 2026-10-22 scope decision.
The source inventory above remains evidence, not a promise of implemented scope.

Complete figures start on written-quarter boundaries and fit wholly inside a bar.
W requires 4/4; H. requires 3/4 or 4/4. Q. E and E Q E remain indivisible sequences,
not arbitrary permutations of ingredients. Every eligible figure is reachable;
a short exercise need not contain every figure. No contest coverage is promised.

Existing Uno/Custom 6/8 and simple-meter triplets remain available. The six numbered
6/8 counts and dotted-quarter performance pulses are unchanged; counting preferences
determine exposed inputs through the shared counting plan.

## Unresolved source policy and customization

Broader rest vocabulary and tie permissions remain unresolved at every level.
The lower-level quarter-rest-on-count-1 and eighth-rest prohibitions remain recorded
as source facts. They do not establish an exhaustive official rest vocabulary.
These uncertainties do not block the verified note-only profile. Enabling existing
rest/tie controls or editing musical ingredients/constraints retains attribution
as **customized**, removes the exact figure profile, and uses the existing Custom
generator. That is teacher-selected practice, not verified UIL coverage. Reapplying
the level restores its note-only figure profile. No rest or tie rule is invented.

## Implementation and persistence

[figures.ts](../../src/apps/rhythm-walk/shared/figures.ts) represents each figure as
canonical written events and an exact summed fraction. One memoized complete-bar
planner supplies both feasibility and generation choices. There is no unrestricted
fallback, filler note or retry-until-success path. All emitted bars and passages
are validated through the canonical model. Scope selects a subset of that same
catalogue, not a separate generator.

The [capability query](../../src/apps/rhythm-walk/shared/capabilities.ts) describes
Custom ingredient support separately from reachable atomic figures in each meter.
Resolution checks required meters, ingredients, atomic figures and complete-bar
feasibility. Unresolved rest/tie source questions do not globally block practice.

UIL definitions are version **3**; `figureProfile` retains version **1**, level and
instrument scope. Generation constructs the handoff branch's immutable `RhythmScore`
directly with stable note IDs. CountingPlan, notation and capture share that score;
there is no legacy tuple adapter. The new editor, correction cycle, counting links
and session/default preference behavior remain authoritative.

Saved UIL versions 1–2 retain supported ingredient selections but become customized.
Retired V–VI identities retain customized source attribution. Unsupported 2/2 is
removed from saved pools (4/4 is used if no supported meter remains), and old change
budgets are removed. The UI identifies migrated UIL configurations as customized,
single-meter practice; reapply I–IV to restore verified figure generation. No new
vocabulary is added. Uno definitions remain version 1 and unchanged.

Length, tempo, counting system, response mode and Tap/Tap + Hold stay independent.
Fixtures remain explicitly enabled testing tools, never saved practice modes.
Deterministic fixtures `uil-percussion` and `uil-figures` exercise the retained
scope. Cut-time and mixed-meter fixtures are removed.

## Validation and limits

[Independent acceptance tests](../../tests/rhythm-uil-acceptance.test.ts) specify
figure grammar and duration expectations independently of production definitions.
They cover I–IV, both scopes, supported meters, lengths 1–4, figure reachability,
the live counting-plan API with both vocabularies and subdivision options,
immutable source identity, migration, customization and completed synthetic
Tap/Tap + Hold assessment. Existing Uno and Custom regression suites remain.

Browser checks include the repository's counting correction and responsive workspace
suites plus [UIL integration](../../scripts/rhythm-uil-browser-check.mjs).
Physical devices, actual audio latency and release-preview acceptance remain separate.
Earlier six-level validation applied to the superseded implementation, not this scope.

### Reconciliation validation (2026-10-22)

Reconciled locally with remote handoff `5715261`. Node 24.21.0, `npm ci` and
`npm run check` passed (449 tests, TypeScript and hosted/portable builds).
UIL browser scenarios passed 355 assertions per width at 320 and 1280 pixels in
Chromium and Firefox, plus native keyboard entry of explicit percussion counts in
both vocabularies and fresh-load scope/answer checks. The repository counting-plan
suite passed in Chromium; counting correction and responsive workspace/completed
performance suites passed in Chromium and Firefox. Those performance checks use
synthetic timestamps and do not validate device latency. Documentation links and
`git diff --check` passed. No physical-device or release-preview validation was run.
