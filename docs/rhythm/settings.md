# Rhythm settings inventory and prototype page

Implemented 2026-10-10 after the owner requested the handoff's configurable options be made visible before further editor refinement. Open **Settings** in the Count Writing prototype, or navigate directly to `/prototypes/count-writing/#settings`. The hash identifies a view in the existing prototype; it does not establish the final app route or a separate installation.

## What works now

The page states that settings are saved automatically **for the current tab**. Reloading still restores defaults. **New Exercise** uses the same generation action as practice’s Next exercise, applies the current settings, replaces the answer, returns to practice and focuses the first count. Invalid configurations disable both buttons and keep the current answer. The action and automatic-save explanation appear above the active controls.

- **Counting system:** numbers with `&` or `+`. Both keys enter the chosen offbeat; changing the display preserves answers and grading. Other subdivision systems remain future work.

- **Exercise length and allowed ingredients:** generated 4/4 practice defaults to 2 measures (configurable 1–4) with quarter/eighth/half/dotted-quarter notes and quarter/eighth/half rests enabled. Dotted-quarter rests are unchecked by default. Changes preserve the current answer and apply on Next exercise. Invalid selections explain why and disable Next; see [generation decisions](practice-loop.md).
- **Allow unintuitive notation:** off by default. Quarter and half rests start on whole beats; half rests may start on any whole beat where they fit. Enable this to permit offbeat longer rests and selected dotted-quarter rests in 4/4. A dotted-rest selection without the opt-in produces an explicit validation error. Changes apply on Next and preserve the current answer.
- **Ties and Syncopation:** independent, both off by default. Ties permit one chain of 2–3 selected written note segments, within or across measures. Syncopation permits at most one offbeat sounding attack per measure sustained through the following beat; offbeat eighths ending at that beat remain available when off. Settings with no attainable pattern report an error. Changes apply on Next, retaining the current answer. See [counting, generation and fixture decisions](ties-syncopation.md).
- **Wrap notation into systems:** a presentation button in practice splits the passage at measure boundaries. Tie arcs and duration lines resume at the next system edge; answers and grading are preserved. Narrow systems still share horizontal score scrolling.
- **Practice exercise:** selects generated practice or a reviewed fixture. Changing exercise clears the answer; the page states this before the control is used.
- **Dotted-quarter internal &:** teacher review, required, or optional. This shares state with the existing editor control, preserves the answer, and marks existing feedback stale until Check runs again.
- **Duration-line placement:** below, above, or beside counts, with a visible anchor at every input position. Click or tap one anchor to start a line and another to finish it; Escape cancels. Tied exercises share a passage duration editor: two anchors, Shift+arrows, or labeled start/end selectors can cross barlines and wraps. One saved span projects into measure pieces. Editing preserves the old span until Save; Escape, Check, navigation or blur cancels the draft. Untied previews follow the mouse cursor; touch shows a short line to the right, stopping just before the next anchor (or the measure edge at the last anchor). Tied previews snap to passage positions, including across systems. Existing lines move with their anchors.
- **Sustained-count appearance:** raised and smaller, lowered and smaller, or unchanged. Switching to beside counts selects raised and smaller; an explicit override remains until placement switches to beside again. Onset counts stay full-size. These display settings preserve answers and feedback.
- **Rest parentheses (current fixed rule):** one complete pair per written rest, enclosing all required or entered counts and any duration line. A half rest groups both beats, `(1 2)`; two quarter rests require `(1) (2)`. Groups cannot overlap or nest. This appears as an explanation under Available now, rather than an unavailable choice between individual and grouped counts.
- Count Writing / Settings navigation, keyboard focus on the page heading, browser back/forward, direct settings links and expandable groups.

Navigation alone preserves the current exercise, symbols, markings and feedback. Active choices last in the current page instance only; reload restores the prototype defaults. Generation is active for the limited ingredients above; persistence, settings drafts and performance remain unavailable. The initial editor controls remain available during this settings review.

## Availability and scope

The page distinguishes **Available now**, **Not available yet**, **To be decided**, and **Outside this release**. Unavailable inputs are natively disabled with readable labels and explanations; their values are not serialized or passed to an exercise engine. Open numerical values are blank instead of receiving invented defaults. Current fixed behavior and confirmed future defaults are shown where applicable. Unknown checkbox defaults use an indeterminate indicator; no choice is implied.

The two vocabulary lists are ordinary independent checklists, not three-state controls. Both remain empty and inactive: the limited practice generator uses the separate active ingredient controls above, and these broader progression lists are future settings. When enabled later, the progression goal must contain the starting vocabulary. Meter selection and changes within a passage are separate controls; a UIL preset must never gate meter selection.

Adding a placeholder does not approve a feature, teaching policy, exact option set or release milestone. Thirty-second notes and quintuplets remain out of scope under the owner's later decision. Internal scoring algorithms are documented as unresolved policies, not presented as invented student-adjustable formulas.

## Handoff coverage

This table maps the [original handoff](reference/RHYTHM_GAME_HANDOFF.md) to the page. The [current direction](README.md) and [canonical music model](music-model.md) still take precedence.

| Settings group | Options represented | Handoff sections |
| --- | --- | --- |
| Available now | Counting system, review exercise, teacher-dependent dotted-quarter rule, duration-line placement, sustained-count appearance and the fixed rest-parentheses rule | 4, 12; subsequent teacher decisions |
| Count Writing | Open vs guided symbol entry, required counts / extra subdivisions, keyboard and touch, line endpoints, hints / answer visibility | 12 |
| Activity & exercises | Count Writing / Rhythm Walk, all three performance formats, passage length, fixed / generated / curated content, developmental presets and UIL I–VI, custom preset saving/sharing, quick-start defaults and instructions | 1, 3, 6, 7 |
| Rhythm vocabulary | Starting and optional goal checklists: whole, half, quarter, single/paired/triplet eighths, sixteenths, dotted half/quarter, whole/half/quarter/eighth rests, ties; pattern/syncopation restrictions, dotted-eighth figures, ties across beats/bars, rest placement, sixteenth rests, double dots, duplets; undecided accents, articulation, swing, pickups and multiple parts | 4, 6, 7, 15 |
| Meter & beat grouping | Meter pool, counting beat / custom grouping, separate meter-change permission and limit, change placement, denominator changes and adaptation | 4, 6, 15 |
| Adaptation & progression | Bounded practice / goal progression, tempo/density/length/rest/help adaptation, unlock approval, mastery/evidence policy, teacher assistance locks, fading support, skill rollback, journey/rewards | 6, 8, 15 |
| Rhythm Walk input & timing | Tap/hold, tempo and bounds/steps, count-in, calibration/offset and device handling, onset/release tolerances, separate score dimensions and recovery/pass policies, interruptions/partial attempts; deferred microphone/MIDI/gamepad inputs | 3, 4, 5, 15 |
| Metronome & sound | Adaptive/manual assistance, audible pulse, beat/subdivision clicks, sound/accent/volume, tap feedback sound/volume | 3, 4, 7, 15 |
| Guidance, review & appearance | Stationary/cursor guidance, live correctness, independent post-review, optional focused replay, score pagination, Uno/motion, accessible notation alternatives and shortcuts | 2, 4, 7, 15 |
| Saved preferences & progress | Remember settings, save progress, history/retention, profiles/teacher permissions, reset/delete, offline availability | 6, 8, 15 |

Account dashboards, multiplayer, leaderboards, assignment reporting, and external content import are deferred feature work, not fabricated settings in this page. Algorithm details such as input matching, tempo estimators, confidence and penalty weights belong to the timing/scoring policy discussion; the page exposes that unresolved policy area without inventing numerical controls for every implementation detail.

## Implementation boundary

- [settings-catalog.ts](../../src/apps/count-writing/settings-catalog.ts) is the review inventory with stable identifiers, grouping and source sections. It is not a settings persistence schema or a music model.
- [settings.ts](../../src/apps/count-writing/settings.ts) renders available controls and inactive options with shared UI primitives.
- [main.ts](../../src/apps/count-writing/main.ts) coordinates generated passages and supported preferences; [editor.ts](../../src/apps/count-writing/editor.ts) owns each measure’s count/rest entry and feedback; [passage-lines.ts](../../src/apps/count-writing/passage-lines.ts) owns logical duration spans for tied exercises. The rest-parentheses explanation documents existing behavior without adding state or an alternate grading convention. Future controls have no callbacks that can change its state.
- Musical source and checking still use the [canonical model](music-model.md). Do not infer that disabling a UI placeholder means the underlying model cannot represent that rhythm, or that model support means an exercise can be rendered/graded.

When implementing a setting, replace its placeholder with a real state contract, connect it to the appropriate activity, and add behavior tests. Resolve open defaults before enabling them. Enforce starting⊆goal and valid generation only when that functionality exists; do not simulate a working generator by storing ineffective selections.

## Validation

The subsequent [ties/syncopation validation](ties-syncopation.md#implementation-and-validation) covers the new controls and passage duration editor. Evidence below records the earlier settings slice.

Browser regression coverage includes two-way convention synchronization, retaining answers across views, explicit clearing on exercise change, stale feedback, keyboard navigation, back navigation, settings deep links, reload semantics, independent future guidance controls and disabled placeholders. Expanded settings are checked for horizontal overflow at 320, 375, 768 and 1280 CSS pixels. Screenshots and reports are written by `npm run test:counts:browser` under `dist/validation/count-writing-{chromium,firefox}/`.

Node 24.21.0 and `npm ci` were used. Type checking, all 118 unit tests, hosted/portable build checks and Count Writing browser checks passed in Chromium and Firefox. Local T3 preview navigation failed; repository browser regression checks supplied the local interaction and layout evidence. Physical-device checks and full release acceptance remain separate requirements; this page is a prototype on a feature branch.
