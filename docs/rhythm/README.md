# Rhythm activities: current direction

Updated 2026-10-10. Count Writing now has generated 4/4 practice with two measures by default and a configurable length of 1–4. See [practice-loop behavior and validation](practice-loop.md), and the earlier [prototype review](prototype.md).

## Read this first

**The first rhythm release will focus on functional Count Writing.** Establish notation, count entry, and musical correctness before building Rhythm Walk's real-time performance features. Resolve performance-specific questions when that work begins.

This is the owner's decision following review of the supplied handoff. It supersedes the handoff's Rhythm Walk-first sequencing, its treatment of Count Writing as a later sibling, and its proposed performance prototype as the first deliverable. It does not cancel the longer-term Rhythm Walk requirements.

Read in this order:

1. [Canonical rhythm model](music-model.md): compact written events, exact derived time, beat coordinates and ties.
2. [Settings inventory and page](settings.md): active preferences and the handoff’s unavailable or undecided options.
3. [Count Writing first-release plan](count-writing.md): current requirements, proposed delivery sequence, and unresolved interaction decisions.
4. [Original handoff](reference/RHYTHM_GAME_HANDOFF.md): preserved source context, broader rhythm requirements, and future performance planning. Section 12 contains the original Count Writing requirements.
5. [Reference provenance](reference/README.md): origin and usage of the supplied screenshot and document.

Where these documents differ, this current direction and the Count Writing plan take precedence over the original handoff. The handoff's confirmed/proposal/open labels remain useful; importing it does not approve its proposals. Its Rhythm Walk acceptance matrix is not the first-release checklist for Count Writing.

## Decision record

| Date | Decision | Reason / consequence |
| --- | --- | --- |
| 2026-10-10 | Preserve the supplied handoff and its reference image in the repository. | Future work must not depend on access to another conversation or attachment. |
| 2026-10-10 | Focus the first release on functional Count Writing. | Pin down notation and correctness before real-time performance. |
| 2026-10-10 | Resolve remaining performance questions as that work approaches. | Timing tolerances, latency calibration, performance scores, and interruption policy do not block Count Writing. |
| 2026-10-10 | Dotted-quarter internal `&` is teacher-dependent. | The prototype offers required, optional, and provisional review of both variants. |
| 2026-10-10 | Duration lines begin at the note onset. | Keep the onset count full-size; internal count appearance is configurable. Ending positions remain provisional. |
| 2026-10-10 | Adopt compact written event sequences with derived time, beat grouping and ties as the shared model. | See the [canonical contract](music-model.md); do not build new work on the original fixed eighth-note clock. |
| 2026-10-10 | Build a basic settings page before further prototype UI refinement. | Include the handoff’s configurable areas, with unavailable and undecided controls clearly marked; see [settings](settings.md). |
| 2026-10-10 | Activate above/beside/below duration-line anchors and sustained-count appearance. | Beside defaults to raised and smaller; lowered and smaller and unchanged remain available, including a strikethrough effect. Display changes preserve answers and grading. |
| 2026-10-10 | Show every beat and written onset; activate internal subdivisions only on affected beats. | Longer undotted figures expose one level below their written value (half → quarter); dotted and tuplet figures use their exact finer components. Availability remains separate from required counts. |
| 2026-10-10 | Require one complete parenthesis pair around each written rest’s counts. | Half rests enclose both beats and the duration line; two quarter rests require separate pairs. Hover/touch ghost openings and teal closing targets support grouped entry. Existing right parentheses open for endpoint editing; left openings remove the group; no nesting. |
| 2026-10-10 | Use contextual count popovers with next-position activation. | Beat numbers sit above subdivisions; mouse/touch glyph and box entry, touch-slide selection, dismissal, and viewport-bounded movement follow the active box. |
| 2026-10-10 | Support keyboard correction/navigation and selectable `&`/`+` offbeats. | Backspace returns from empty boxes; Tab/Shift+Tab and arrows follow available positions. Both offbeat keys use the selected display convention without changing musical time or grading. |
| 2026-10-10 | Place duration lines and rest endpoints with the keyboard. | Hold Shift and use arrows to choose an available duration count; release Shift to commit its implied endpoint, including trailing hidden subdivisions. Type `(`, choose a closing count with arrows, and press Enter to close the pair. |
| 2026-10-10 | Add generated Count Writing practice: 2 measures by default, configurable 1–4, with independent note/rest ingredient checkboxes. | Next applies pending generation settings; Check and Retry preserve answers. Reject empty, unfillable or ineffective ingredient pools explicitly. See [practice loop](practice-loop.md). |
| 2026-10-10 | Show consecutive measures in one staff passage; default to readable rest placement. | Quarter/half rests start on whole beats, including half rests on beat 2; dotted-quarter rests in 4/4 and offbeat longer rests require an explicit unintuitive-notation opt-in. The canonical model remains unrestricted by this practice policy. |

## Shared foundation and future work

Both activities use the [canonical music model](music-model.md) for written events and derived positions, durations, rests, ties, and meters. Count Writing evaluates entered counts and markings; Rhythm Walk evaluates timed input. Keep those answer and evaluation models separate. Audit existing code before choosing interfaces, dependencies, or notation rendering technology.

The original handoff preserves the future performance requirements: short/continuous/journey formats, tap and hold, independent presentation/review guidance, bounded vocabulary progression, and separate rhythm/pulse/tempo assessment. Their release order and detailed numerical policies remain unresolved.

Additional performance questions identified during handoff review:

- How much evidence is needed to report each score or claim recovery? Short or sparse passages may need an insufficient-evidence outcome.
- Does capture stop at the target final barline or allow a slower performance and late final release to finish?
- Which measure indicators, page turns, and Uno animations reveal timing in stationary mode?
- Which acceptance criteria belong to each performance release?

These are review questions, not approved behavior. Official UIL figures and source revision must be checked before implementing reference presets; this import does not independently verify the handoff's external-source claims.

## Keeping the record current

Record new product decisions and their rationale here; maintain Count Writing scope, examples, and acceptance criteria in its plan. Mark proposals as approved only when decided. Keep the source handoff intact, and add actual architecture and validation evidence as implementation establishes them.

Follow the repository's [branching instructions](../../AGENTS.md), [hosting workflow](../hosting.md), and [release instructions](../releasing.md). A planning document is not implementation or device-validation evidence.
