# Count Writing generated practice loop

Implemented 2026-10-10 on `feature/count-writing-practice`. This extends the reviewed editor, without publishing production or finalizing its provisional counting conventions.

## Practice behavior

A new page session starts with **two generated 4/4 measures**. Settings offers lengths **1–4** and eight independent allowed ingredients: quarter, eighth, half, and dotted-quarter notes, plus the corresponding rests. All eight are enabled by default. Meter remains fixed to 4/4; broader vocabulary, progression, ties, tuplets, other meters and performance controls remain unavailable.

Length and ingredient changes apply when **Next exercise** generates a new passage. They preserve the current music, answer and feedback. Counting-rule changes apply immediately, preserve the answer and mark checked feedback stale. Offbeat display and duration-line presentation changes preserve both answers and grading. Preferences and answers live only in this page instance; reload resets to the defaults.

**Check** evaluates all measures without changing the answer. Feedback sits beneath the relevant measure, with independent count, duration-line and rest-pair results and beat-specific correction guidance. **Retry** dismisses checked feedback and focuses the first count so the learner can correct the same answer. Direct correction after Check also works, with an explicit stale-feedback message. **Next exercise** starts a blank generated passage using the latest valid settings. **Reset answer** clears the current passage's answer while retaining its music.

Each measure has its own notation, count positions and markings in a stacked card. On narrow screens, each card scrolls its notation and answer row together; the page itself does not scroll horizontally. Beat numbers restart at 1. Accessible labels identify both measure and beat. Count entry, arrows, Tab/Shift+Tab and Backspace cross measure boundaries; Home/End stay within a measure. Entry advances into the next measure, while placement commands stay inside the current measure. At the passage ends, Tab exits the count row. Touch count popovers and duration/rest endpoint entry remain available.

Saved rest pairs are retained while an endpoint edit is pending. Escape, changing views or switching placement commands cancels the draft and restores the original group. Closing the edit replaces it; removing the opening explicitly deletes it. Check cancels pending placements before evaluating the saved answer. Every written rest still requires its own complete pair, including adjacent eighth or quarter rests. A sustained rest encloses its required or entered counts and its duration line.

## Generation and grading decisions

[Generation](../../src/apps/count-writing/generation.ts) emits only canonical `RhythmMeasure` / `RhythmEvent` arrays. It uses exact `duration` and fraction subtraction to memoize fillable remainders, then draws only ingredients leaving a fillable remainder. The resulting passage is checked by `derivePassage`. No template answers, duplicate authored timing, fallback ingredients or rejection-until-success loops are used.

An empty pool or impossible bar reports a useful settings error and disables Next. A selected ingredient that cannot occur in any completed bar with the remaining selection is also rejected explicitly. For example, dotted quarters alone cannot fill 4/4; dotted quarters plus halves can fill with halves, but cannot use a dotted quarter, so the learner must add quarters/eighths or remove dots. This prevents a checked ingredient from silently becoming ineffective. A valid bar may use a subset of the allowed pool: selecting an ingredient permits it, rather than requiring it in every measure.

Draws are random choices among viable next events, rather than uniformly distributed complete bars or an adaptive curriculum. Repeated exercises are possible, especially for a one-ingredient pool. All-rest measures, adjacent rests and offbeat onsets are permitted. No difficulty or syncopation restrictions are implied by these ingredient controls. Tests inject seeded randomness; production uses `Math.random`.

The [count grid](../../src/apps/count-writing/grid.ts) derives positions from each written measure and the existing availability policy. [Evaluation](../../src/apps/count-writing/evaluation.ts) derives onset/internal-beat counts, sustained duration lines, dotted-quarter conventions and written-rest pairs. Answer indices remain measure-local presentation positions, separate from exact music time. Ranges cannot accidentally cross bars; out-of-range answers fail evaluation. Eighth-rest engraving and dotted-quarter-rest dots extend the existing renderer. Dotted half notes remain available only as a reviewed fixture.

Teacher-review, required and optional dotted-quarter internal offbeat policies remain available, including for rests and dotted quarters beginning on an offbeat (the internal offbeat is then the final count within the written event). The reviewed duration endpoint policy and provisional acceptance of alternative endpoints within the same sustained event are preserved. Open entry still offers `e`/`a`, which are incorrect in this eighth-spaced exercise repertoire. No answer reveal, scoring, persistence, audio timing or accounts are added.

## Regression fixtures and verification

The six reviewed fixtures remain in [fixtures.ts](../../src/apps/count-writing/fixtures.ts), accessible through **Review fixture** or **Practice exercise** in Settings. Choosing one explicitly clears the current answer; the settings hint says so. `?fixture=half` (or another fixture ID) opens a deterministic development exercise. Next always resumes generated practice using the current generation settings.

[Generation and grading tests](../../tests/count-generation.test.ts) cover all 256 ingredient subsets at lengths 1–4 with seeded draws, exact full-bar duration, selected-only ingredients, deterministic behavior, termination, unsupported inputs, dots, offbeat onsets, sustained/adjacent rests, independent grading and bar boundaries. Existing fixture tests remain intact. `npm run test:counts:browser` runs both fixture regression and [generated practice checks](../../scripts/count-writing-practice-browser-check.mjs); full `npm run verify` also includes both.

Validation for this slice uses Node 24.21.0 and `npm ci`. `npm run check` passes all 128 tests and hosted/portable build checks. Count Writing fixture and generated practice browser checks pass in Chromium and Firefox, including the complete loop for lengths 1–4 at 1280px and 320px, keyboard navigation across measures, touch marking entry, invalid settings, answer retention, rest-edit cancellation, and expanded settings layout. Reports and screenshots are under `dist/validation/count-writing-{chromium,firefox}` and `dist/validation/count-practice-{chromium,firefox}`.

The T3 preview initially loaded, but subsequent collaborative browser interaction/resize calls failed and reopening returned an invisible tab. Browser evidence above comes from the repository's regression checks. Physical-device checks, full release-candidate verification and Cloudflare candidate review remain pending; this feature work does not authorize a production release.
