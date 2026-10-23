# Rhythm Walk: ties and syncopation

**Counting migration, 2026-10-14:** the running editor now follows the [counting-schemes specification](counting-schemes-spec.md#coordinated-editorsettings-migration-2026-10-14). Sparse plan counts replace grid answer slots; R/D toggle inferred units; all counting settings are pending until New exercise. There are no optional counts, range endpoints or immediate token translations. 6/8 inputs follow enabled rules, not an every-eighth requirement. The counting/editor tables and validation below record the earlier slice; written notation, generation restrictions and performance timing remain applicable unless explicitly updated.

Historical slice behavior, reconciled 2026-10-11 with `99046ee`. Read alongside the [unified Rhythm Walk contract](unified-activity.md). Validation sections explicitly marked historical describe the original slice.

The original simple-meter rules below now apply in 2/4, 3/4 and 4/4. [Meter decisions](meters.md) define 6/8: six required numbers, exact duration endpoints and syncopation relative to two dotted-quarter pulses.

## Simple-meter counting decision

A tie chain is one sounding attack and one continuous duration, even though its written segments remain separate notes. Require the ordinary number or offbeat at the attack and every actual beat inside the sounding span. A tied continuation on a beat therefore requires that beat number as a sustained count, not a new attack. An offbeat continuation alone does not require a count. An entered offbeat must still have the correct symbol; extra subdivisions retain the existing teacher-review treatment.

Apply dotted-quarter internal-offbeat policy to the **total sounding duration**: a chain totaling a dotted quarter has the same required/optional/review internal offbeat as a single dotted quarter at the same position. A dotted segment inside a longer chain does not independently introduce a dotted-quarter requirement. This makes equivalent sounding spellings follow the same convention. Beat numbers restart in each measure.

Require one duration line for a tied chain (including two eighths tied within one beat), and for an untied note/rest that contains an internal beat. Start at its sounding attack/rest onset; the trial end is the final derived-grid position before its release. Other endpoints inside the same span retain provisional review. A line beginning at a continuation or extending beyond release needs correction. Rest parentheses remain one pair per written rest, confined to its measure.

Duration answers use passage-wide presentation indices derived from the written score, not an authored music clock. A line crossing a barline is one answer, rendered as separate connected-to-edge pieces under each affected measure. At a system wrap the outgoing piece reaches the system edge and the incoming piece resumes at the next system edge. Layout does not change grading, attacks or duration. Tie arcs use one tapered curve between rendered noteheads on the same system, including across barlines. Only visual system breaks split the arc into outgoing/incoming hooks. Curvature uses rendered geometry with bounded depth and updates on resizing and wrapping.

While rest parentheses are open for entry or editing, their keyboard interaction takes precedence over passage duration shortcuts. Shift used to type `)` preserves the pending pair; Shift+arrows continue choosing its closing count. Escape restores an existing saved pair. Browser regression coverage includes physical Shift keydown/keyup around these actions.

## Generation settings

Both controls default off and apply only on Next; changing either preserves the current music and answer.

- **Ties:** permits connections between adjacent written notes, within a beat, across beats and across barlines. At most one chain per exercise, with two or three written segments. Segments always come from enabled ingredients. No rest can start/receive a tie and no tie leaves the exercise. With syncopation off, a resulting offbeat sounding attack may not sustain across the following beat.
- **Syncopation:** permits an offbeat sounding attack to sustain through the following whole beat. With it off, offbeat eighth attacks ending at the next beat remain permitted, but offbeat longer notes and tied offbeat chains crossing that beat do not. On-beat dotted rhythms remain permitted. This is a precise offbeat-sustain restriction, not a general claim to exclude every musicological use of “syncopation.”

Selections permit patterns rather than guaranteeing them in each draw. Generation limits syncopated attacks to at most one per measure and ties to one chain of at most three segments per exercise. An optional pattern with no eligible candidate is skipped without blocking a fillable exercise. Rest-placement opt-in is separate.

## Review examples and limitations

The focused fixture suite covers within-beat ties, beat-crossing ties, barline ties, a three-segment chain, offbeat sustained attacks, untied syncopation, notes adjacent to rests and a wrapped barline tie. These are deterministic development/review examples; implementation and automated review do not claim external teacher approval. The onset-anchored endpoint trial and optional-subdivision teacher-review conventions remain provisional.

2/4, 3/4, 4/4 and 6/8, eighth/quarter/half/dotted-quarter written ingredients, plus [simple-meter sixteenths and dotted eighths](sixteenths.md); the earlier dotted-half review fixture is retained. Ties on rests, tuplets in the UI, alternative compound counting, smaller values than sixteenths, pitch matching, mastery scoring and saved accounts remain unsupported. Tap Rhythms evaluates these same passages, with one attack and uninterrupted hold per tie chain. Feature work does not authorize production publication.

## Fixture review guide

Choose these IDs in **Exercise preset**, or open `?fixture=<id>`. `~` below joins written notes; `/` is a barline. The count examples use the **required** dotted-quarter convention. Counts inside a duration line use the selected sustained appearance.

| Fixture | Written example | Required counts / line decision |
| --- | --- | --- |
| `tie-within-beat` | E~E Q H | `1 2 3 4`; no new attack at the second E. The tied pair has one line, even though an untied quarter normally needs none. |
| `tie-across-beat` | Q~Q H | `1 2 3 4`; beat 2 is sustained inside the first line. |
| `tie-dotted` | Q~E E H | `1 & 2 & 3 4`; the first chain follows the single dotted-quarter count convention. |
| `tie-across-bar` | H Q Q~ / Q H Q | `1 2 3 4 / 1 2 3 4`; one line joins beat 4 to the next measure's beat 1. |
| `tie-chain` | E~E~Q H | `1 2 3 4`; one half-note sound with three written members. |
| `tie-offbeat` | E E~Q H | `1 & 2 & 3 4`; offbeat attack, sustained beat 2, then the chain's teacher-dependent internal offbeat. |
| `syncopation` | E Q E H | `1 & 2 & 3 4`; the offbeat quarter crosses beat 2 without a tie. |
| `tie-rests` | Q-rest E~E Q-rest Q | `(1) 2 (3) 4`; the line belongs only to the tied pair; each rest has its own pair. |
| `tie-wrap` | Same as barline fixture | Identical grading with one measure per visual system; outgoing/incoming tie and duration pieces retain one logical span. |

The enabled-pattern controls permit, rather than force, a pattern. Among eligible candidates, ties use a 65% bounded draw. All-rest bars and repeated exercises remain possible. Syncopation off can make an individual ingredient unreachable; it is skipped while other compatible ingredients fill the bar. Only a configuration with no complete-bar solution blocks Next. Optional ties and syncopations that cannot occur are omitted. Pending changes retain the current answer.

## Original slice implementation and validation

Built on the previous slice at `d99685c` from `t3code/rhythm-game-handoff`, carried into `feature/count-writing-ties` from `dev`. Before work, `dev` included `origin/main`; the working tree was clean. The previous slice's automated checks and documentation were inspected; no PR review or physical-device sign-off was recorded. Neither integration nor production branches are advanced by this slice.

The canonical tie compiler needed no parallel representation or changes. [passage.ts](../../tests/legacy/count-passage.ts) adapts its derived attacks into the existing supported count grid; [evaluation.ts](../../tests/legacy/count-evaluation.ts) grades logical chains independently of layout. `passage-lines.ts` (removed by the coordinated migration) keeps saved spans separate from drafts and projects pieces into the per-measure editor. Untied exercises retain their existing duration controls. The practice **Wrap notation into systems** button uses one measure per system; systems narrower than the minimum readable measure width share horizontal scrolling. Tied endpoints support taps, Shift+arrows and selectors; existing passage-line end handles also support arrows/Home/End. Dragging across systems is not added; touch entry and selectors provide that editing path.

Validation used Node 24.21.0 and `npm ci`. `npm run check` passed all **136 tests**, type checking and hosted/portable build checks. Seeded generation coverage exercises all 256 ingredient subsets, lengths 1–4, both notation policies and independent ties/syncopation modes, including explicit rejection of ineffective settings. Fixed-answer tests cover all required examples, equivalent sounding spellings, chain validation, exercise boundaries and targeted feedback.

`npm run test:counts:browser` passes the existing fixture/practice regressions and new tie/syncopation checks in **Chromium and Firefox**. The new checks solve generated passages through Check → Retry → Next at lengths 1–4 for all four pattern combinations at **1280px and 320px**, review every new fixture, verify wrap-independent grading, single logical cross-bar lines, touch entry, Shift+arrow/Shift+Tab navigation, draft cancellation and settings/answer retention. Existing regressions verify saved rest-group cancellation. Screenshots and reports are under `dist/validation/count-writing-{chromium,firefox}`, `count-practice-{chromium,firefox}` and `count-ties-{chromium,firefox}`. Desktop barline and mobile wrapped notation were visually inspected. A subsequent visual refinement replaced paired barline curves with a single tapered curve; browser checks verify a single same-system path and separate hooks at a wrap. Settings now explains automatic saving for the current tab and offers New Exercise, checked for valid/invalid selections, generation, navigation and focus on desktop and mobile. Rhythm documentation links and `git diff --check` passed.

T3 preview status/open returned an invisible tab and navigation failed; repository browser checks provide the local evidence. Physical phone/tablet, Safari, Chromebook and classroom checks, full release verification and Cloudflare release-candidate review remain unperformed. This is feature work, not a production release or external teacher sign-off.
