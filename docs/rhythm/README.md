# Uno234: current direction

Updated 2026-10-14. **Uno234 is one activity with three freely interchangeable response modes: Write Counts, Tap Rhythms, and Both.** The current activity is named **Uno234**. **Rhythm Walk** is reserved for an eventual continuous gameplay mode; it is not a current response mode. Existing prototype URLs, source directories, and preference keys retain their historical names for compatibility. Count Writing is the historical name of Write Counts; the original performance-only Rhythm Walk prototype is now Tap Rhythms. This decision supersedes descriptions of separate activities and the earlier Count Writing-first sequencing. It does not authorize production publication.

The shared **Level** selector chooses a generation configuration: **Uno1–Uno4**, UIL I–VI General/Percussion note-only practice, or **Custom**. UIL profiles enforce complete verified figures with meter-specific teaching limits. **Customize…** edits ingredients and musical constraints. Normal practice always generates; fixed rhythms live only in explicitly enabled developer/testing access (`?testing=1` or a valid `?fixture=` link). Level changes are pending until **New exercise**, retaining the current score and responses. Musical edits retain source attribution as customized; length, tempo, mode, counting system and Tap/Tap + Hold are independent. Reload restores the configuration, never a saved fixture mode.

The Uno configurations are cumulative, with independent 1–4 measure length:

| Level | Musical configuration |
| --- | --- |
| Uno1 | 4/4; whole, half, quarter and eighth notes; quarter and half rests; no ties or syncopation. |
| Uno2 | Uno1 plus 2/4 and 3/4, dotted-half and dotted-quarter notes, and ties. |
| Uno3 | Uno2 plus 6/8, sixteenth notes, eighth rests, syncopation, sounded eighth triplets and dotted-eighth notes. |
| Uno4 | All currently supported ingredients (also sixteenth and dotted-quarter rests), ties, syncopation and unintuitive notation in all four meters. |

These are Uno practice configurations, separate from UIL criteria. Each exercise draws one selected meter and uses only its compatible ingredients: whole notes and whole rests require 4/4; dotted halves are skipped in 2/4; half/whole values, sixteenths, dotted eighths and triplets are skipped in 6/8. “Everything” does not expand the supported repertoire.

Configure one exercise, then choose how to respond without changing its identity, notation or configuration. The lower interaction surface shows a contextual counting palette or the performance pad. Both uses a Counts / Perform selector (vertical on wide screens, horizontal on phones); selecting a count box returns to Counts. Tempo, Tap / Tap + Hold and metronome controls belong beside the pad. Rest pairs and duration lines start in the palette and end by selecting a count box, with a visible Cancel option. Both preserves writing and performance independently; completing or checking the writing is never required. Each response and its evaluation survives mode switching within the exercise. Switching during count-in, capture or calibration cancels safely and stops scheduled audio. A canceled performance is interrupted, never completed or graded.

The shared repertoire includes 2/4, 3/4, 4/4, 6/8 and scaled-counting 2/2; 1–4 measures (default two); half, quarter, eighth and dotted-quarter notes/rests, plus opt-in simple-meter sixteenth notes/rests, dotted-eighth notes and complete sounded eighth triplets; opt-in whole notes/rests in 4/4 and dotted-half generation; bounded ties and syncopation; readable versus unintuitive rest spelling; all historical writing and performance testing fixtures. In 6/8, Write Counts uses numbers 1–6 on eighths, grouped 123 / 456, while Tap Rhythms uses two dotted-quarter pulses. See [meter rules](meters.md) and the [canonical music model](music-model.md).

Read [the triplet contract](triplets.md) for complete simple-meter groups, shared capability queries, exact thirds and atomic `la`/`li` entry.

Read [the sixteenth/counting contract](sixteenths.md) for both simple-meter systems, safe switching, exact local grids, new generation policy and current validation evidence.

Read [the unified activity contract](unified-activity.md) for shared ownership, lifecycle, persistence, entry points and validation. Shared generation, teaching levels, settings, meter policy and notation have one implementation. Answer coordinates and count evaluation stay separate from audio timing, capture, calibration and performance evaluation. [Timing calibration](timing-calibration.md) still governs the fixed session offset and raw versus corrected evidence.

The refined [musical assessment slice](assessment.md) now reports rhythm accuracy, optional hold accuracy, performed tempo and typical pulse steadiness. It separates spacing-based tempo, analytical starting displacement, rhythm and own-attack sustain. Shared assessment outcomes color score/timelines while actual received positions and target-relative evidence remain intact. The shared Treat Bag presents independent bone rewards and concise musical feedback; result actions replace the completed pad and numerical review stays in Details. Results are provisional feedback, not mastery standards. Hold policy v4 excludes sounds below 400 ms from hold scoring and waives only a short final tied member in eligible chains, while retaining forgiving own-attack sustain and small overholds; current expected bars show target duration without fixed lift-credit bands. Legacy release policy v2 and its dashed lift bands remain available only for saved older attempts. Internal ties stay continuous, and saved attempts retain their original policy.

## Decisions carried forward

- Performance **How to play** is selectable in shared settings: Tap (default) or Tap + Hold. Both reuse canonical sounding chains and raw capture. Attempts retain the choice/policy used; completed reviews do not change when preferences do. Tap reviews attacks only; Tap + Hold adds actual duration bars and provisional release/articulation feedback. See [performance policy](performance-prototype.md#selectable-tap--tap--hold).

- One shared exercise/configuration with freely switchable Write Counts, Tap Rhythms and Both; writing then performing is optional. Switching preserves the exact exercise; Next replaces it and clears both responses.
- Musical source is a flat written-event sequence with exact fractional time, not stored base-twelve positions. The twelve-subdivision beat coordinate is derived; ties join written members into one sounding attack. Thirty-second notes and quintuplets remain out of scope. Domain support for other values does not imply UI support.
- Default generated length is two measures, configurable 1–4. 6/8 uses six numbered eighth counts, grouped 123 / 456, and two dotted-quarter performance pulses.
- Rest parentheses group each written rest independently; sustained rests include their counts and duration line. Simple-meter line endpoints and optional subdivision grading retain teacher-review conventions.
- Performance capture ends at the written ending plus 300 ms and any positive fixed calibration offset. Slower playing does not extend the deadline; unfinished notes remain part of the feedback.
- Timing normalization estimates one constant, input-specific offset and reuses it for the tab session. Manual tap-along is the fallback; retries do not refit the offset or stretch time. Raw evidence is retained.
- Shared preferences survive reloads; exercise responses/results do not. Calibration uses a separate session store. Prototype routes are compatible entry points, not a production release.

## Document authority

Use this page and the [unified activity contract](unified-activity.md) for product scope and lifecycle; [music-model.md](music-model.md) for canonical musical data; [meters.md](meters.md) and [ties-syncopation.md](ties-syncopation.md) for counting/notation policy; [settings.md](settings.md) for settings ownership and inventory; and [assessment.md](assessment.md), [performance-prototype.md](performance-prototype.md) plus [timing-calibration.md](timing-calibration.md) for performance behavior. Numerical timing thresholds remain provisional. When extending the activity, update the relevant contract and shared fixtures/tests together.

The original handoff and first-release plans preserve provenance, not additional approved requirements. Historical validation counts describe their named slice, not the current suite; see the [reviewed baseline](unified-activity.md#reviewed-baseline).

Supporting documents retain musical decisions and implementation history:

- [Write Counts planning record](count-writing.md), [count editor review](prototype.md), [practice loop](practice-loop.md), and [ties/syncopation](ties-syncopation.md).
- [Settings inventory](settings.md) and [Tap Rhythms performance contract](performance-prototype.md).
- [Original handoff](reference/RHYTHM_GAME_HANDOFF.md) and [reference provenance](reference/README.md), preserved without modification. Their proposals are not approved defaults.

Those records do not override this naming, architecture, persistence or mode-switching contract. Teaching tolerances, mastery scores, adaptive progression, journey mechanics, imported content, vocabulary beyond the documented meter-specific scope and physical-device acceptance remain unresolved or deferred. Follow [AGENTS.md](../../AGENTS.md), [hosting](../hosting.md), and [release instructions](../releasing.md); feature validation does not authorize publishing to `main`.

## Coordinated implementation prompts

The [simple-meter triplet prompt](prompts/triplets.md) and [source-verified UIL level prompt](prompts/uil-presets.md) follow the [shared ownership and capability contract](prompts/README.md). Their implemented scope is documented in [triplets.md](triplets.md) and [uil-presets.md](uil-presets.md).

[UIL teaching levels](uil-presets.md) provide working I–VI General/Percussion note-only figure configurations. V–VI include conservative 6/8 and scaled-counting 2/2 subsets; IV–VI optionally change meters with constant local-pulse BPM. Source rest/tie questions remain scoped to customization. See the canonical scope matrix for exact applicability and validation.

## Historical Uno level validation (before UIL completion)

The Uno configuration follow-up passed Node 24.21.0, `npm ci` and `npm run check` (333 tests, TypeScript and builds). [Focused unit tests](../../tests/rhythm-uno-presets.test.ts) verify the exact cumulative definitions, independent preferences, source customization/persistence, blocked UIL scope and generated vocabulary across all configured meters and lengths. [Native browser scenarios](../../scripts/rhythm-uno-browser-scenarios.js) passed 50 assertions each at desktop (1265px) and narrow (305px inside a 320px preview), covering application, current-score/writing retention, generation, shared modes, customization, fresh-document restoration and overflow. Loopback navigation failed, so browser checks used the complete local bundle in same-origin inline documents. Physical-device and completed-performance checks were not performed in this follow-up.
