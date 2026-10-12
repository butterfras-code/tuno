# Uno234: current direction

Updated 2026-10-11. **Uno234 is one activity with three freely interchangeable response modes: Write Counts, Tap Rhythms, and Both.** The current activity is named **Uno234**. **Rhythm Walk** is reserved for an eventual continuous gameplay mode; it is not a current response mode. Existing prototype URLs, source directories, and preference keys retain their historical names for compatibility. Count Writing is the historical name of Write Counts; the original performance-only Rhythm Walk prototype is now Tap Rhythms. This decision supersedes descriptions of separate activities and the earlier Count Writing-first sequencing. It does not authorize production publication.

Configure one exercise, then choose how to respond without changing its identity, notation or configuration. Both exposes writing and the performance pad independently; completing or checking the writing is never required. Each response and its evaluation survives mode switching within the exercise. Switching during count-in, capture or calibration cancels safely and stops scheduled audio. A canceled performance is interrupted, never completed or graded.

The shared repertoire is the actual implemented exercise set: 2/4, 3/4, 4/4 and 6/8; 1–4 measures (default two); half, quarter, eighth and dotted-quarter notes/rests, plus opt-in simple-meter sixteenth notes/rests and dotted-eighth notes; the existing dotted-half review fixture; bounded ties and syncopation; readable versus unintuitive rest spelling; all historical writing and performance review presets. In 6/8, Write Counts uses numbers 1–6 on eighths, grouped 123 / 456, while Tap Rhythms uses two dotted-quarter pulses. See [meter rules](meters.md) and the [canonical music model](music-model.md).

Read [the sixteenth/counting contract](sixteenths.md) for both simple-meter systems, safe switching, exact local grids, new generation policy and current validation evidence.

Read [the unified activity contract](unified-activity.md) for shared ownership, lifecycle, persistence, entry points and validation. Shared generation, presets, settings, meter policy and notation have one implementation. Answer coordinates and count evaluation stay separate from audio timing, capture, calibration and performance evaluation. [Timing calibration](timing-calibration.md) still governs the fixed session offset and raw versus corrected evidence.

The refined [musical assessment slice](assessment.md) now reports rhythm accuracy, optional hold accuracy, performed tempo and typical pulse steadiness. It separates spacing-based tempo, analytical starting displacement, rhythm and own-attack sustain. Shared assessment outcomes color score/timelines while actual received positions and target-relative evidence remain intact. Concise musical feedback replaces the completed pad; numerical review stays in Details. Results are provisional feedback, not mastery standards. Hold policy v4 excludes sounds below 400 ms from hold scoring and waives only a short final tied member in eligible chains, while retaining forgiving own-attack sustain and small overholds; current expected bars show target duration without fixed lift-credit bands. Legacy release policy v2 and its dashed lift bands remain available only for saved older attempts. Internal ties stay continuous, and saved attempts retain their original policy.

## Decisions carried forward

- Performance **How to play** is selectable in shared settings: Tap (default) or Tap + Hold. Both reuse canonical sounding chains and raw capture. Attempts retain the choice/policy used; completed reviews do not change when preferences do. Tap reviews attacks only; Tap + Hold adds actual duration bars and provisional release/articulation feedback. See [performance policy](performance-prototype.md#selectable-tap--tap--hold).

- One shared exercise/configuration with freely switchable Write Counts, Tap Rhythms and Both; writing then performing is optional. Switching preserves the exact exercise; Next replaces it and clears both responses.
- Musical source is a flat written-event sequence with exact fractional time, not stored base-twelve positions. The twelve-subdivision beat coordinate is derived; ties join written members into one sounding attack. Thirty-second notes and quintuplets remain out of scope. Domain support for other values does not imply UI support.
- Default generated length is two measures, configurable 1–4. 6/8 uses six numbered eighth counts, grouped 123 / 456, and two dotted-quarter performance pulses.
- Rest parentheses group each written rest independently; sustained rests include their counts and duration line. Simple-meter line endpoints and optional subdivision grading retain teacher-review conventions.
- Timing normalization estimates one constant, input-specific offset and reuses it for the tab session. Manual tap-along is the fallback; retries do not refit the offset or stretch time. Raw evidence is retained.
- Shared preferences survive reloads; exercise responses/results do not. Calibration uses a separate session store. Prototype routes are compatible entry points, not a production release.

## Document authority

Use this page and the [unified activity contract](unified-activity.md) for product scope and lifecycle; [music-model.md](music-model.md) for canonical musical data; [meters.md](meters.md) and [ties-syncopation.md](ties-syncopation.md) for counting/notation policy; [settings.md](settings.md) for settings ownership and inventory; and [assessment.md](assessment.md), [performance-prototype.md](performance-prototype.md) plus [timing-calibration.md](timing-calibration.md) for performance behavior. Numerical timing thresholds remain provisional. When extending the activity, update the relevant contract and shared fixtures/tests together.

The original handoff and first-release plans preserve provenance, not additional approved requirements. Historical validation counts describe their named slice, not the current suite; see the [reviewed baseline](unified-activity.md#reviewed-baseline).

Supporting documents retain musical decisions and implementation history:

- [Write Counts planning record](count-writing.md), [count editor review](prototype.md), [practice loop](practice-loop.md), and [ties/syncopation](ties-syncopation.md).
- [Settings inventory](settings.md) and [Tap Rhythms performance contract](performance-prototype.md).
- [Original handoff](reference/RHYTHM_GAME_HANDOFF.md) and [reference provenance](reference/README.md), preserved without modification. Their proposals are not approved defaults.

Those records do not override this naming, architecture, persistence or mode-switching contract. Teaching tolerances, mastery scores, adaptive progression, journey mechanics, imported content, additional meters/vocabulary and physical-device acceptance remain unresolved or deferred. Follow [AGENTS.md](../../AGENTS.md), [hosting](../hosting.md), and [release instructions](../releasing.md); feature validation does not authorize publishing to `main`.
