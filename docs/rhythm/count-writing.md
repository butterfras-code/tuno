# Count Writing: first-release plan

Updated 2026-10-10. Status: first editable-measure prototype implemented for teacher review; grading conventions and the full release boundary remain provisional. See [prototype review notes](prototype.md). See [current direction](README.md) for document precedence.

## Purpose and confirmed direction

Build a functional activity in which students read conventional rhythm notation and enter counts, sustain markings, and rest parentheses. Use this release to establish notation and answer correctness before adding real-time rhythm performance.

The requirements below are carried forward from section 12 of the [supplied handoff](reference/RHYTHM_GAME_HANDOFF.md). They describe the intended activity; the exact set of meters, rhythms, counting systems, and assistance options shipped in the first release still needs to be bounded.

## Established interaction requirements

- Use fixed semantic count-entry positions beneath the notation, rather than handwriting recognition or a general equation editor.
- Selecting a note/rest glyph or available count box opens a contextual popover with beat numbers above subdivision symbols and an upper-right dismiss button. Popover selection and keyboard symbol entry activate the next available box and an open popover moves below it, bounded by the viewport. The page scrolls to make room below the box instead of covering the notation. Touch users can slide from the indicator to a symbol and release to submit.
- Support physical keyboard entry and a touch symbol keypad. Do not automatically fill in the student's counts.
- The default counting requirement is a count at every note onset and each internal actual beat of a sustained note. Additional subdivision positions can be supported without requiring every possible subdivision.
- The owner's school convention uses ordinary count symbols for rests, with one complete pair of parentheses per written rest. A half rest groups both beats and its duration line; two quarter rests use separate pairs. Sustained internal counts can be raised/smaller with duration lines; exact appearance and line spans need visual review.
- Parenthesis openings follow mouse hover or the selected touch position. Clicking a completed pair’s right parenthesis opens it for endpoint editing; clicking any left opening removes it and its pair, if complete. Nested and overlapping groups are unavailable.
- A student can drag or tap a duration-line endpoint to cover count positions. Line placement is configurable above, beside, or below counts, with an anchor at every input position.
- Evaluate count symbols, duration-line spans, and rest markings separately.
- The intended activity supports open and guided symbol entry. Open entry offers the selected counting system's alphabet. Guided entry filters symbol choices according to context and prior entries, including keyboard input; it does not filter duration-line or parentheses actions. Record assistance separately from correctness.
- Counting systems may differ. Do not silently equate or mix `+`, `&`, or spoken syllables without an explicit convention.

## Proposed first-release workflow

This workflow was recommended after the owner selected Count Writing first. It is a working proposal, not approval of every control or feature.

1. Choose a straightforward preset or customize meter and rhythmic vocabulary.
2. Read a short, static passage with conventional notation and count-entry positions.
3. Enter count symbols, duration lines, and rest parentheses using keyboard or touch.
4. Check the answer, with separate feedback for the three answer dimensions.
5. Correct the answer, retry, or move to another exercise.

Prioritize readable phone layouts and predictable keyboard editing. Proposed deferrals include adaptive progression, journey mechanics, and a complete reference-preset catalogue. Rhythm Walk's timed input and scoring are outside the Count Writing release focus. Route, activity name, persistence, and exact initial content are still open.

## First prototype: one editable measure

Implemented prototype: review a small set of editable one-measure examples before building the full setup and exercise flow. These are design/test fixtures, not approved preset defaults.

| Example | What it should clarify |
| --- | --- |
| 4/4: half note, quarter note, two eighths | Enter `1`, internal sustained `2`, then `3`, `4`, and the chosen offbeat symbol. Establish slot alignment and the half-note duration line, anchored at `1` as confirmed during teacher review. |
| 4/4: dotted quarter, eighth, half | Resolve required versus optional internal subdivisions and duration-line boundaries for the dotted quarter. |
| 4/4: quarter note, quarter rest, two eighths, quarter | Clarify rest parentheses, rest counts, and separate marking feedback. |
| 4/4: dotted half, quarter | Establish multiple sustained internal counts (`2`, `3`) and line editing. |

One ambiguity must be resolved explicitly: the handoff describes `1`, `&`, `2` for a dotted quarter starting on beat 1, while its default rule requires onsets and internal actual beats and does not force all subdivisions. The owner selected **teacher-dependent** on 2026-10-10. The prototype offers required/optional choices and provisionally accepts both until a teacher chooses; other optional subdivisions and exact span endpoints still need review.

The prototype should make entry, deletion, replacement, focus movement, and line editing reviewable with keyboard and touch. It should expose how much the placement or number of empty slots reveals about an answer.

## Decisions to resolve during prototyping

- Initial meter/rhythm set and counting convention; treatment of compound beats, ties, and tuplets when introduced.
- Required versus optional count positions, especially dotted rhythms and rests; whether optional valid counts are accepted.
- Span endpoints and snapping. Parentheses grouping is now one complete pair per written rest. Raised/smaller, lowered/smaller and unchanged internal counts are now selectable; beside placement defaults to raised/smaller.
- Keyboard navigation/editing and a tap alternative for every drag interaction.
- Whether open and guided entry both ship initially; precise filtering rules and how to handle an earlier incorrect count without trapping later entry.
- Check/retry behavior: when answers are revealed, how partial correctness appears, and how corrections are recorded.
- Entry point, final naming, initial preset values, saved settings/progress, and device acceptance targets.

Resolve these through concrete examples and implementation proposals. The owner need not supply algorithms or every technical parameter before exploratory work can begin. Do not represent unresolved musical rules as established grading policy.

## Implementation sequence (proposed)

1. Audit the current notation, shared UI, distribution, and settings code. Define the smallest shared symbolic music model needed for the reviewed fixtures.
2. Build the editable-measure prototype and review notation, count positions, lines, parentheses, and input behavior.
3. Convert agreed examples into correctness fixtures; implement separate symbol/span/rest evaluation.
4. Add constrained exercise generation, setup, and the check/correct/next flow. Generated bars must have valid durations and obey the selected vocabulary and pattern restrictions.
5. Complete responsive/accessibility behavior and agreed persistence/distribution integration; validate the release candidate.

Keep notation/content independent of DOM input and evaluation. Count Writing does not require an audio-clock implementation. Avoid selecting a notation library, route, or storage API solely from the historical handoff's suggestions.

## Proposed acceptance checklist

Finalize this against the agreed first-release content before declaring the release complete.

- Every supported fixture renders legibly with correct musical duration, grouping, and count alignment.
- Keyboard and touch can enter, replace, and remove symbols and edit all supported markings; symbols are not auto-filled.
- The evaluator accepts agreed correct variants and independently identifies wrong counts, wrong spans, and missing/incorrect rest parentheses.
- Required and optional positions follow the chosen counting convention; valid optional subdivisions are treated consistently.
- Checking preserves the student's answer and supports correction without silently rewriting it.
- If guided entry ships, its symbol filtering works for both input methods and its results retain assistance provenance.
- Generated exercises obey selected rhythmic constraints and fill each measure correctly; impossible configurations produce a useful explanation.
- Editing works at narrow widths and zoom, with visible focus, understandable labels, and no drag-only essential action.
- Relevant unit and browser checks pass. Run `npm run check` for application changes and follow the full [release instructions](../releasing.md) for candidate verification and required physical-device checks.

The editable-measure prototype and application checks are complete; see [implementation and validation evidence](prototype.md). Physical-device validation and full release-candidate verification remain pending.

Keyboard count entry advances through available positions. Tab/Shift+Tab and left/right arrows move between them; Tab exits the row at its ends. Delete clears the current position. Backspace clears a filled position, or returns to and clears the previous available position when the current one is empty. The popover follows keyboard navigation below the active box. The active counting-system setting chooses `&` or `+`; either key enters that selected symbol. Input aliases and displayed symbols are separate from canonical answer tokens and musical time, allowing later subdivision systems to define their own mappings.

With a count selected, holding Shift previews duration placement. Left/right arrows choose its endpoint from available counts; choosing beat 2 under a half note includes the hidden offbeat after 2; releasing Shift commits a nonzero line. Escape, focus loss, or switching to another command cancels. Shift alone and shifted count symbols do not create lines. Typing `(` opens rest parentheses; arrows move the closing candidate between available counts without crossing the opening or an existing group, and Enter or `)` closes it. The chosen closing candidate is highlighted in teal.

The editor now shows notation, count inputs and contextual popover/marking targets without the permanent instruction text, selected-beat status, keypad or duration-editing panel. The first available count receives focus on load and after selecting a new rhythm. A rhythm selected in Settings receives that focus when returning to the editor. Enter evaluates when no other action owns it: rest placement closes its pair, duration endpoint placement sets its endpoint, and a focused popover button submits that symbol. Native controls keep their Enter behavior and Settings does not evaluate. Lines remain editable by dragging their dots or using dot arrow keys; Delete/Backspace on a focused dot removes the line. Check and Reset remain accessible for mouse and touch. Selection and placement announcements remain available to screen readers.

Each position can be covered by only one duration line. Activating a duration position inside an existing line or at its endpoint edits that line’s end; clicking or touching its starting dot removes it. Shift placement from a count within an existing line edits its endpoint instead of adding a second line. Placement and endpoint adjustments stop before another line.
