# Rhythm activities: current direction

Updated 2026-10-10. An editable one-measure Count Writing prototype is implemented for teacher review; see [implementation and validation](prototype.md).

## Read this first

**The first rhythm release will focus on functional Count Writing.** Establish notation, count entry, and musical correctness before building Rhythm Walk's real-time performance features. Resolve performance-specific questions when that work begins.

This is the owner's decision following review of the supplied handoff. It supersedes the handoff's Rhythm Walk-first sequencing, its treatment of Count Writing as a later sibling, and its proposed performance prototype as the first deliverable. It does not cancel the longer-term Rhythm Walk requirements.

Read in this order:

1. [Count Writing first-release plan](count-writing.md): current requirements, proposed delivery sequence, and unresolved interaction decisions.
2. [Original handoff](reference/RHYTHM_GAME_HANDOFF.md): preserved source context, broader rhythm requirements, and future performance planning. Section 12 contains the original Count Writing requirements.
3. [Reference provenance](reference/README.md): origin and usage of the supplied screenshot and document.

Where these documents differ, this current direction and the Count Writing plan take precedence over the original handoff. The handoff's confirmed/proposal/open labels remain useful; importing it does not approve its proposals. Its Rhythm Walk acceptance matrix is not the first-release checklist for Count Writing.

## Decision record

| Date | Decision | Reason / consequence |
| --- | --- | --- |
| 2026-10-10 | Preserve the supplied handoff and its reference image in the repository. | Future work must not depend on access to another conversation or attachment. |
| 2026-10-10 | Focus the first release on functional Count Writing. | Pin down notation and correctness before real-time performance. |
| 2026-10-10 | Resolve remaining performance questions as that work approaches. | Timing tolerances, latency calibration, performance scores, and interruption policy do not block Count Writing. |
| 2026-10-10 | Dotted-quarter internal `&` is teacher-dependent. | The prototype offers required, optional, and provisional review of both variants. |
| 2026-10-10 | Duration lines begin at the note onset. | Keep the onset count full-size; raise internal counts. Ending positions remain provisional. |

## Shared foundation and future work

Both activities should consume a shared symbolic representation of musical positions, durations, rests, ties, and meters. Count Writing evaluates entered counts and markings; Rhythm Walk evaluates timed input. Keep those answer and evaluation models separate. Audit existing code before choosing interfaces, dependencies, or notation rendering technology.

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
