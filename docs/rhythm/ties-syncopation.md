# Count Writing: ties and syncopation in 4/4

## Counting decision for this slice

A tie chain is one sounding attack and one continuous duration, even though its written segments remain separate notes. Require the ordinary number or offbeat at the attack and every actual beat inside the sounding span. A tied continuation on a beat therefore requires that beat number as a sustained count, not a new attack. An offbeat continuation alone does not require a count. An entered offbeat must still have the correct symbol; extra subdivisions retain the existing teacher-review treatment.

Apply dotted-quarter internal-offbeat policy to the **total sounding duration**: a chain totaling a dotted quarter has the same required/optional/review internal offbeat as a single dotted quarter at the same position. A dotted segment inside a longer chain does not independently introduce a dotted-quarter requirement. This makes equivalent sounding spellings follow the same convention. Beat numbers restart in each measure.

Require one duration line for a tied chain (including two eighths tied within one beat), and for an untied note/rest that contains an internal beat. Start at its sounding attack/rest onset; the trial end is the final eighth-spaced position before its release. Other endpoints inside the same span retain provisional review. A line beginning at a continuation or extending beyond release needs correction. Rest parentheses remain one pair per written rest, confined to its measure.

Duration answers use passage-wide presentation indices derived from the written score, not an authored music clock. A line crossing a barline is one answer, rendered as separate connected-to-edge pieces under each affected measure. At a system wrap the outgoing piece reaches the system edge and the incoming piece resumes at the next system edge. Layout does not change grading, attacks or duration. Tie arcs likewise split at measure edges, so they remain visible at wraps.

## Generation settings

Both controls default off and apply only on Next; changing either preserves the current music and answer.

- **Ties:** permits connections between adjacent written notes, within a beat, across beats and across barlines. At most one chain per exercise, with two or three written segments. Segments always come from enabled ingredients. No rest can start/receive a tie and no tie leaves the exercise. With syncopation off, a resulting offbeat sounding attack may not sustain across the following beat.
- **Syncopation:** permits an offbeat sounding attack to sustain through the following whole beat. With it off, offbeat eighth attacks ending at the next beat remain permitted, but offbeat longer notes and tied offbeat chains crossing that beat do not. On-beat dotted rhythms remain permitted. This is a precise offbeat-sustain restriction, not a general claim to exclude every musicological use of “syncopation.”

Selections permit patterns rather than guaranteeing them in each draw. Generation limits syncopated attacks to at most one per measure and ties to one chain of at most three segments per exercise. A setting with no attainable pattern reports an explicit configuration error instead of silently having no effect. Rest-placement opt-in is separate.

## Review examples and limitations

The focused fixture suite covers within-beat ties, beat-crossing ties, barline ties, a three-segment chain, offbeat sustained attacks, untied syncopation, notes adjacent to rests and a wrapped barline tie. These are deterministic development/review examples; implementation and automated review do not claim external teacher approval. The onset-anchored endpoint trial and optional-subdivision teacher-review conventions remain provisional.

4/4 only, eighth/quarter/half/dotted-quarter written ingredients; the earlier dotted-half review fixture is retained. No ties on rests, tuplets, compound meter, smaller values, pitch matching, performance timing, scoring, saved accounts or production publication.

## Fixture review guide

Choose these IDs in **Review fixture**, or open `?fixture=<id>`. `~` below joins written notes; `/` is a barline. The count examples use the **required** dotted-quarter convention. Counts inside a duration line use the selected sustained appearance.

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

The enabled-pattern controls permit, rather than force, a pattern. Among eligible candidates, ties use a 65% bounded draw. All-rest bars and repeated exercises remain possible. Syncopation off may make a previously fillable ingredient combination unusable (for example, dotted-quarter notes plus quarters/halves without eighths); the configuration error is explicit and retains the current answer. Add eighths, enable syncopation, or remove the incompatible selection.

## Implementation and validation

Built on the previous slice at `d99685c` from `t3code/rhythm-game-handoff`, carried into `feature/count-writing-ties` from `dev`. Before work, `dev` included `origin/main`; the working tree was clean. The previous slice's automated checks and documentation were inspected; no PR review or physical-device sign-off was recorded. Neither integration nor production branches are advanced by this slice.

The canonical tie compiler needed no parallel representation or changes. [passage.ts](../../src/apps/count-writing/passage.ts) adapts its derived attacks into the existing supported count grid; [evaluation.ts](../../src/apps/count-writing/evaluation.ts) grades logical chains independently of layout. [passage-lines.ts](../../src/apps/count-writing/passage-lines.ts) keeps saved spans separate from drafts and projects pieces into the per-measure editor. Untied exercises retain their existing duration controls. The practice **Wrap notation into systems** button uses one measure per system; systems narrower than the minimum readable measure width share horizontal scrolling. Tied endpoints support taps, Shift+arrows and selectors; existing passage-line end handles also support arrows/Home/End. Dragging across systems is not added; touch entry and selectors provide that editing path.

Validation used Node 24.21.0 and `npm ci`. `npm run check` passed all **136 tests**, type checking and hosted/portable build checks. Seeded generation coverage exercises all 256 ingredient subsets, lengths 1–4, both notation policies and independent ties/syncopation modes, including explicit rejection of ineffective settings. Fixed-answer tests cover all required examples, equivalent sounding spellings, chain validation, exercise boundaries and targeted feedback.

`npm run test:counts:browser` passes the existing fixture/practice regressions and new tie/syncopation checks in **Chromium and Firefox**. The new checks solve generated passages through Check → Retry → Next at lengths 1–4 for all four pattern combinations at **1280px and 320px**, review every new fixture, verify wrap-independent grading, single logical cross-bar lines, touch entry, Shift+arrow/Shift+Tab navigation, draft cancellation and settings/answer retention. Existing regressions verify saved rest-group cancellation. Screenshots and reports are under `dist/validation/count-writing-{chromium,firefox}`, `count-practice-{chromium,firefox}` and `count-ties-{chromium,firefox}`. Desktop barline and mobile wrapped notation were visually inspected. Rhythm documentation links and `git diff --check` passed.

T3 preview status/open returned an invisible tab and navigation failed; repository browser checks provide the local evidence. Physical phone/tablet, Safari, Chromebook and classroom checks, full release verification and Cloudflare release-candidate review remain unperformed. This is feature work, not a production release or external teacher sign-off.
