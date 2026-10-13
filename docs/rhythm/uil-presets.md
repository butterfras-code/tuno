# UIL teaching presets

Uno234 offers **UIL I / UIL II · note-only practice**. Levels III–VI can be inspected but cannot be applied. The shared **Level** selector applies these generation configurations immediately to pending settings. **Customize…** edits their musical fields; **Custom** retains free-form settings without assigning a UIL level. Fixed rhythms are separate testing fixtures, exposed only by `?testing=1` or valid `?fixture=` links. Saved fixtures never enable testing on ordinary visits.

These are editable rhythm teaching templates, not complete composition validators or claims of UIL endorsement. Short passages do not reproduce contest compositions.

## Reviewed source matrix

Source: [official band criteria](https://www.uiltexas.org/music/concert-sight-reading/band-sight-reading-criteria), heading **Revised 2022**, retrieved **2026-10-12**. All 17 unique notation images were downloaded from that page and visually inspected, including meters. The historical handoff was background only. Reference images are linked, not bundled or relicensed.

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

## Teaching choices and capability gaps

I–II deliberately practice **general note figures only** in 4/4: Q, H, H., W and complete beat-aligned E E pairs. Rests, ties and percussion figures are not selected. This narrower focus is qualified in the selector, status and attribution; it is not a claim of full instrumental/vocabulary coverage. Pair alignment is a conservative teaching choice. Nothing requires every permitted figure to appear in a short random passage. No probabilities or difficulty rankings are promised.

The shared hooks `restrictions.pairedEighths` and `restrictions.noQuarterRestBeatOne` are independent of UIL. The first restricts basic simple-meter practice and forces the second eighth before another value can begin. The second excludes an initial quarter rest. Complete-bar feasibility uses those same rules, without retrying or inventing fill notes. Test-only quarter-rest generation exercises the second hook even though the live note-only presets omit all rests.

Whole notes were added at the owner's explicit request: an opt-in `whole` ingredient, a hollow stemless head, four numbered counts and one complete duration line in 4/4. Whole rests and dotted wholes remain unsupported. Existing dotted-half engraving/counting is now exposed as the opt-in `dotted-half` ingredient. Defaults are preserved. Both values stay out of 6/8 generation; whole-only selections cannot fill 2/4, 3/4 or 6/8. Other compatible selected ingredients may fill those meters.

| Levels | Application | Remaining work |
| --- | --- | --- |
| I–II | Available, qualified note-only focus | Clarify broader rest/tie policy before expanding focus; percussion is outside this template. |
| III | Unavailable | Enforce Q. E and the exact general figure set; review rest/tie policy. |
| IV | Unavailable | Enforce sixteenth/dotted-eighth/syncopated combinations; review rest/tie policy. |
| V–VI | Unavailable | IV gaps, `triplet-eighth`, cut-time application; review rest/tie policy. |

`triplet-eighth` is reserved for three sounded 3:2 eighths occupying one quarter beat in simple meters. Enabling it alone never unlocks V–VI. Tuplet rests, partial groups, other ratios and ties involving tuplets need distinct capabilities. Multiple selected meters still choose one meter for the entire passage. Within-piece changes are source metadata, not an implemented setting or a requirement for these short exercises.

## Schema and integration handoff

The UIL slice owns [teaching-presets.ts](../../src/apps/rhythm-walk/shared/teaching-presets.ts): stable IDs `uil-1`–`uil-6`, definition version 1, provenance, scoped exact figures, official meter/change metadata, restrictions, unresolved items, recommended settings and required capabilities. Recommendations remain separate from active settings. `resolveTeachingPreset(definition, capabilities?)` returns `{ supported: true, settings }` or `{ supported: false, reasons }`. Tests can inject explicit capability inputs; production uses one [generationCapabilities()](../../src/apps/rhythm-walk/shared/capabilities.ts) query.

The aggregate query now derives from `rhythmCapabilities(meter)` in the generator, so it includes integrated simple-meter triplets without duplicating support lists. `GenerationCapabilities` contains global `ingredients`, `patterns`, `meters`, and a `byMeter` map with ingredient/pattern support. Production returns the map; minimal explicit test inputs may omit it. Resolution checks required patterns in each selected meter, requires a capability description for every selected meter, and requires each ingredient to be supported by at least one selected meter. Pools intentionally use compatible subsets (whole notes only in 4/4); global catalogue membership alone cannot satisfy a requirement. The narrow paired-eighth hook rejects unsupported compound use explicitly. Higher figure capabilities must only be advertised after the generator actually consumes and enforces their declarative restrictions. Do not simply add their IDs to the query. Triplet generation, counting and engraving come from the prerequisite triplet PR.

Shared edits: `generation.ts` adds the two ingredients, optional attribution and two narrow restriction flags; `settings.ts` adds inspection/application/customization; `activity.ts` sanitizes persisted attribution and flags; `grid.ts`/`notation.ts` add whole-note presentation; `fixtures.ts` adds a whole-note review fixture. Existing fixture IDs, scoring and count entry stay intact.

`applyTeachingPreset(current, definition)` is a pure pending-settings operation. It preserves chosen length; UI application does not replace the current exercise or clear either response. Next/New Exercise performs replacement through the existing lifecycle. Mode, counting convention/system, Tap/Hold, tempo and calibration are independent. Default length remains two, adjustable 1–4.

Changing a preset-controlled field retains source attribution as **customized** and drops the preset restrictions so teachers can choose 6/8 or another supported configuration. Changing length alone preserves the template status. Reapplication deliberately restores its controlled fields. A selected unavailable level changes only inspection, and Apply level remains disabled, including after controls unlock. Pending settings still undergo the normal complete-bar validation.

Preference storage remains version 1. Old records preserve their valid settings; saved fixture IDs are ignored on ordinary visits. Restriction flags require booleans; unknown IDs/versions or malformed attribution are dropped. An exact saved label is restored only when controlled fields match a currently supported definition; otherwise attribution becomes customized. Unknown stored fields are not carried into active settings. Responses remain transient and calibration retains its separate store.

## Validation

See [source/resolver/lifecycle/whole-note tests](../../tests/rhythm-teaching-presets.test.ts). Source expectations are independently written, including percussion scope and forbidden unlisted figures. Seeded I–II passages are checked independently for note vocabulary, complete beat-aligned pairs, no rests/ties/tuplets and exact bar totals. Resolver tests remove independent capabilities and verify triplets cannot bypass other gaps. Lifecycle tests cover pending application, blocked application, reapplication, customization, migration, malformed storage, independent meters and all response modes. Whole-note tests independently specify counts 1–4, the final hidden duration endpoint and one four-second sound at quarter=60.

Node **24.21.0**, `npm ci`, and `npm run check` passed: **309 tests**, TypeScript checks and hosted/portable builds. `git diff --check` and local documentation-link review passed.

Native T3 [browser scenarios](../../scripts/rhythm-uil-browser-scenarios.js) passed **52 assertions at desktop and 52 at 320px**, plus **10 fresh-document persistence/migration assertions**. They cover both available templates, all blocked levels, score identity and writing/performance-response retention, independent preference preservation, length, 6/8 customization, reapplication, mode switching, Next clearing, source-detail overflow, whole-note glyphs and touch-sized Apply controls. Reload checks cover exact attribution, ingredients, length, tempo/mode/counting system, blank transient responses and malformed stored attribution/restrictions.

The environment's new server port could not be reached by the native browser. The fresh built JS/CSS was therefore loaded into a same-origin inline frame in the reachable localhost preview; existing font CSS was reused. An initial run completed a real-clock performance and retained its review through preset application. Subsequent runs backgrounded the preview and correctly produced ungraded interruptions; the final 104 lifecycle assertions retained those interruption responses instead. The first run stopped on a test assertion using `innerText` for a hidden result; the corrected assertions use `textContent` to test retained data independently of visibility. This is not a full completed-capture browser acceptance claim. Independent whole-note timing and completed scoring are covered by unit tests.

320px is an actual CSS/DOM frame-layout check, not a physical phone. Physical devices, hardware latency, release-candidate Cloudflare preview and full release verification were not performed. The owner requested a PR against `t3code/rhythm-game-handoff` for this slice; no branches are automatically integrated or published.

## Stacked integration validation (2026-10-12)

PR #39 is rebased onto PR #38 (`958dd49`). The generator's `rhythmCapabilities(meter)` is the single support policy; `generationCapabilities()` is only its aggregate view for presets. Whole/dotted-half meter limits, triplet exclusion from 6/8, complete triplet atoms, paired-eighth restrictions and unchanged defaults are retained. A regression test rejects UIL I when ingredients exist globally but are absent in its selected meter. Higher levels remain blocked by their independent figure/policy requirements.

Node 24.21.0 with npm ci: npm run check passed all **328 tests**, type checking and hosted/portable builds. Native T3 UIL checks passed **52 assertions at 1280px and 52 at 320px**, retaining interrupted performance evidence. The preview was unfocused: audio correctly interrupted, and the full triplet keyboard suite stopped at a focus-dependent syllable-advance assertion; no completed audio or full keyboard acceptance is claimed for this integration. Combined triplet/whole fixtures and mode identity were additionally inspected. The preview served an older bundle, so the newly built JS/CSS were injected explicitly (font payload omitted); this is not deployed-preview or physical-device acceptance.

## Level selection follow-up

The header now owns one Level selector across all response modes. Supported selection applies pending generation configuration immediately; Source and pattern requirements retains inspection and deliberate reapplication. Customize… contains ingredients, meters, patterns, rest spelling and independent length. The current-exercise summary uses the configuration captured by the shared Activity at replacement, while the selector identifies the next exercise. Generated practice is no longer a selectable fixture/preset option. Explicit testing access exposes the separate fixed-fixture catalogue, with all historical IDs intact.

Node 24.21.0, `npm ci`, and `npm run check` passed (330 tests, TypeScript and builds). Local documentation links and `git diff --check` passed. Native T3 [level scenarios](../../scripts/rhythm-level-browser-scenarios.js) passed 43 assertions and [UIL scenarios](../../scripts/rhythm-uil-browser-scenarios.js) passed 52 assertions at desktop (1265px document) and narrow (305px document inside a 320px preview). Coverage includes lengths 1–4, independent preferences, customized source attribution, pending score/response retention, mode switching, blocked application, fresh-document persistence/migration and explicit fixture access. Layout review found no level/source-detail overflow; keyboard Tab/Enter opened Customize…, and Escape closed it and restored focus.

Loopback navigation initially worked, then returned connection failures. Later checks used the complete local JS/CSS in same-origin inline review documents through the native preview; fixture-query inputs were supplied explicitly to those documents. This does not validate server routing. The hidden preview interrupted real-clock performance, so response retention covered interruption evidence rather than newly completed graded performances. Physical devices, assistive technology and the full release/browser suite were not verified in this follow-up. No publication is included.
