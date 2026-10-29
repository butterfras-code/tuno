# Musical keyboard and brass fingering input

Practice and single-player Challenge offer Note Names and Instrument pills. Note Names remains the default. Clicking the Instrument pill opens a popover for Piano, B♭ Trumpet, Horn in F (Dbl), Euphonium – 3V/4V, and B♭ Tuba – 3V/4V. After selection the pill displays the instrument name; clicking it opens the picker again. Escape or clicking outside dismisses the picker. The preset instrument is selected initially; students can choose any chart covering the current written-note range. Charts outside that range remain listed but disabled. Fingering supports B♭ trumpet, three- or four-valve B♭ tuba and bass-clef euphonium, and F/B♭ double horn. Tuba and euphonium valve counts are separate instrument popover choices. J/K/L (E/W/Q for horn) or simultaneous pointer contacts hold valves 1/2/3; semicolon holds valve 4 in four-valve mode; Space or Open explicitly submits no valves. Horn adds a held T thumb pad adjacent to valve 1, with a live F-side/B♭-side label. The horn rests in F; V holds the trigger to select B♭. Multiplayer retains its existing note-name controls and player keyboard mappings.

Musical keyboard uses the actual tUno piano component and styles extracted from the Tone view. It grades written pitch class in any octave and accepts enharmonic keys without transposing to concert pitch. Keys have no visible note names, but retain screen-reader labels. There are no octave controls, matching checkbox, or piano hint text. It does not generate audio in tuNotes. On mobile the tuNotes piano fits eight white keys (C through C) without horizontal scrolling, with narrower black keys and reduced side padding; the Tone keyboard is unchanged.

The lower answer area uses Uno234’s pill selector and rounded input panel, with shared styles in `src/shared/ui/input-workspace.css`. Switching pills or instruments cancels held input and pending submissions. The selected instrument is saved with each fingering observation so grading and backup validation use the same chart.

## Implementation

- `src/apps/tunotes/domain/fingering.ts`: instrument configuration, written-pitch validation, answer union, and charts including alternates: trumpet F♯3–C6, euphonium E2–B♭4, B♭ tuba E1–B♭3, and double horn C2–G5. Chart source: [Yamaha trumpet fingering chart](https://www.yamaha.com/en/musical_instrument_guide/common/images/trumpet/fingering.pdf). Low-brass charts are cross-checked against [Micah Everett](https://olemiss.edu/lowbrass/studio/fingeringcharts/euphbcfingering.pdf) and [Yamaha tuba](https://www.yamaha.com/en/musical_instrument_guide/tuba/play/play002.html); horn uses [Colin Dorman’s double-horn chart](https://colindorman.com/french-horn-exercises/fingering_charts/). Chromatic numbers come from the existing written-pitch model; there is no concert-pitch conversion or reverse lookup from masks.
- `src/shared/input/held-fingers.ts` and `fingering-input.ts`: source-aware held state and instrument-independent controls. Keys and pointer contacts are tracked independently, with pointer capture and cancellation cleanup. The shared `fingering-layout.ts` supplies presentation coordinates; each finger retains its mask position, labels, and key.
- `src/shared/input/piano-keyboard.ts` and `piano-keyboard.css`: shared keyboard geometry, interaction handlers, and responsive styling; `src/ui/views/tone.ts` and `src/styles.css` consume this extraction. Tone retains its audio and sustain behavior.
- `src/apps/tunotes/ui/keyboard-answers.ts`: written-pitch answers and input gating.
- `src/apps/tunotes/ui/play-surface.ts`: reserves sufficient compact-layout height for the additional input methods.
- `src/apps/tunotes/engine/fingering-policy.ts`: isolated 350 ms flashcard settling policy. It cancels stale timers on prompt changes and locks. An intentional release can submit open only after a held answer advances to the immediately next primary-open card. Prompt changes and input cleanup do not trigger a submission.
- `src/apps/tunotes/ui/note-entry.ts` and `practice-view.ts`: compact method selection, Open action, keyboard routing, lifecycle cleanup, and the existing shared feedback surface.
- `src/apps/tunotes/engine/practice.ts` and `challenge.ts`: accept a fingering answer through existing scoring and advancement. Held physical state survives advancement; a new intentional input change is necessary to answer again.
- `src/apps/tunotes/engine/adaptive.ts`: continues observing accuracy, but does not invent a guessed pitch from a valve mask for spelling contrast exercises.
- `src/apps/tunotes/persistence/store.ts`: snapshot version 5 stores and validates fingering and musical-keyboard observations. Earlier snapshots migrate on read. Older application versions cannot read version 5 backups.
- `src/apps/tunotes/ui/multiplayer-view.ts`: accepts the shared answer type; its input behavior remains note names.
- `src/apps/tunotes/styles.css`: simple outlined valve caps, stems, and casings inside fixed touch-safe targets. Held caps move downward and tint; the casing stays still. Horn’s T control uses a compact outlined lever. Reduced motion removes the transition while preserving the pressed position. Existing shared UI tokens and element helpers are reused.
- `tests/tunotes-fingering.test.ts`, `scripts/notes-fingering-browser-check.mjs`, and `package.json`: unit and browser coverage, with the new browser script included in `test:browser`.
- Existing adaptive, challenge, and configurator tests now expect migrated snapshot version 5.

## Validation

Node 24.22.1, dependencies installed with `npm ci`.

- `npm run check`: 472 tests passed, typecheck and hosted build passed.
- New fingering browser checks: Chromium and Firefox. Real simultaneous touch contacts are exercised in Chromium through CDP, including valves 2+4. Tests cover fourth-valve scoring and backups for both instruments, repeated held keys, configuration switching, and all 16 held-state combinations. Desktop 1280 px and mobile 360 px layouts have no horizontal overflow and valve targets exceed 44 px.
- Existing tUno `browser-check.mjs`: passed in hosted and offline modes after keyboard extraction.
- Existing `notes-input-browser-check.mjs`: passed, including note-name keyboard, pointer, accidental, and touchscreen behavior.
- Existing `notes-challenge-browser-check.mjs`: passed, including hosted/offline gating, scoring, countdowns, navigation, and responsive layout.
- Existing `notes-multiplayer-browser-check.mjs`: passed, including hosted/offline rosters, independent keyboard lanes, concurrent touch, and responsive layouts.
- Shared input-panel update: Uno234 `counting-plan-browser-check.mjs` passed; tuNotes pill switching and available-method coverage passed in Chromium and Firefox. Note names retain 44px touch targets.
- `git diff --check`: passed.
- Existing `notes-browser-check.mjs`: fails at line 68, expecting two attempts after a second intentional click in Normal (instant advancement) mode. The same assertion fails on an untouched HEAD archive, confirming a pre-existing test expectation mismatch.

## Limits

An intermediate fingering held for at least 350 ms can submit; this is an explicit, unit-tested limitation of the settling policy. Holding a correct combination alone cannot answer a subsequent card. A beat-based activity can consume held state directly without this policy.

Four-valve mode adds 4 as an alternative to 1+3 and 2+4 as an alternative to 1+2+3, plus the documented common alternatives in the current range. Three-valve choices remain acceptable. Switching configurations cancels held states and pending submissions. Valve 4 occupies the last right-hand mask position (`00000001`). Scoring and saved observations accept valid masks independently of the current control layout.

Physical iOS/Android hardware and Safari were not tested. Input method and valve-count choices are session-local. Other tuba tunings, compensating/non-compensating pedal-register extensions, reversed horn triggers, multiplayer instrument mappings, and continuous beat-based evaluation are not implemented. Existing preset ranges are fully covered; no false-tone or compensating-system assumptions are needed.

Keyboard observations store their octave-matching rule. Older observations without that flag retain exact-octave grading when imported. The current piano always submits octave-agnostic answers; historical strict results remain importable.

## String Big 5 input

Violin, viola, cello and double bass are available in the same instrument picker when the exercise pitches are covered by their Big 5 charts. The shared held-input component displays four round fingertip pads, with left index = 1 through little finger = 4. F/D/S/A match those fingers on the keyboard; Space or Open submits an open string. On touch devices in landscape, strings default to the right edge with finger 1 at the top. No string or position selector is required: the displayed pitch is the grading target.

The highest held left-hand finger determines a stopped note. Any lower fingers may remain held; right-hand bits are rejected. Violin/viola use 0–1–2–3–4 and accept the next open string instead of finger 4 where available. Violin prioritizes its open strings (G3, D4, A4, E5); D4, A4, and E5 retain all fourth-finger combinations as alternatives. This also enables release-to-open for those violin notes. Cello uses 0–1–3–4–0 across adjacent strings; the A-string Big 5's upper E requires a shift and accepts finger 1. Bass uses written-pitch octaves and 0–1–4–0–1 across adjacent strings; the highest G-string Big 5 uses shifted 1/4 for C/D. This is a limited Big 5 chart, not a general fingerboard, shift trainer or validator of every possible fingering. Unsupported pitches disable that instrument choice.

Chart references: [Yamaha violin fingering and finger numbering](https://www.yamaha.com/en/musical_instrument_guide/violin/play/play003.html), [Ailbhe McDonagh's cello first-position lesson](https://www.ailbhemcdonagh.com/cello-basics-07-introduction-to-first-position.html), [CelloGuide position chart](https://celloguide.com/wp-content/uploads/2017/09/celloguide-note-chart.pdf), and [Patrick Fowler's double-bass first/third-position lesson](https://www.fowlerbass.com/switching-to-the-double-bass-chapter-2). No chart artwork is reproduced.

Validation includes exhaustive held-mask checks, all 16 string Big 5 preset pools, grading and backup round trips, rolling keyboard input, repeated notes, explicit Open, multitouch cancellation and method switching. Browser coverage uses all primary and secondary viewport profiles for setup, input/feedback, picker and results, plus both landscape regression sizes. Fold8 profiles remain provisional; real-device ergonomics and browser zoom need physical release review.


## Compact grip controls

Move, Flip, and Spacing live beside Open inside the fingering panel. Move cycles left → bottom → right; Flip reverses the finger arrangement without changing mask positions, labels, keyboard bindings, or grading. Horn's trigger stays reachable and follows the flipped arrangement. Narrow portrait layouts reserve a slim column below navigation; short landscape layouts reserve a bottom panel when selected. These controls do not open a new toolbar or dialog.

Preferences are device-local, per instrument/valve configuration and portrait/landscape orientation. Storage denial falls back to session memory. Layout changes clear held input and pending submissions, and Space activates the focused layout button rather than submitting Open. Touch landscape defaults are right/bottom-to-top for other brass and left/top-to-bottom for horn; flipping the horn produces 3–2–1–T from top to bottom. Strings default to right/top-to-bottom. Other contexts initially use the bottom panel. Spacing is saved separately per instrument/valve configuration and shared between orientations.

The fingering browser check exercises all three placements and Flip across the primary and secondary viewport profiles, including panel containment, no horizontal overflow, keyboard activation without scoring, preference reload, and cancellation during the settling window. Screenshot review supplements these checks. Physical grip comfort, Safari, real browser zoom, and the provisional Fold8 dimensions still require device review.

Validation for the compact controls: Node 24.22.1; `npm run check` (514 tests, typecheck, build); expanded fingering checks in Chromium and Firefox; viewport smoke checks in both engines; existing Chromium note-input checks; and `git diff --check` passed. After final landscape spacing changes, focused Practice/Challenge checks at 844 × 390, 667 × 375, 1280 × 600, and 1280 × 720 passed in both engines, including count/control separation and companion containment. Reviewed screenshots are under `dist/validation/grip-*` (generated, not committed).


## Release to open

After a held fingering submits an answer, releasing all fingers on the immediately next card submits Open after the normal 350 ms settling window, provided that card's primary fingering in the selected chart is the all-zero mask. Primary means the first chart entry; an open alternate alone does not enable this shortcut. Partial releases may roll into the full release within the settling window. Adding a finger cancels the release shortcut.

The first card, repeated open cards, and release before the next card appears still need Open or Space. Both explicit controls remain available. Cancelled pointers, lost focus, rotation, Move/Flip, instrument changes, pauses, and stale prompts cannot submit open. A hold retained through feedback can release once the next card is active; a release during feedback is not queued.

Policy tests cover the settling boundary, synchronous advancement, delayed advancement, interrupted releases, stale sessions/prompts, explicit Open, and repeated open cards. The browser fixture exercises keyboard and pointer releases through the production note-entry and scoring engine, plus pointer cancellation and layout cleanup.

Release-to-open validation: Node 24.22.1 with `npm ci`; `npm run check` passed (518 tests, typecheck, build). Chromium and Firefox completed the existing viewport/activity sections and the new keyboard/pointer release cases. After updating the horn test's former release-does-nothing expectation, the complete deterministic input-fixture section passed in both engines. `git diff --check` passed. No visual layout changes were made for this behavior.

Violin open-string priority validation: `npm run check` passed with 519 tests. Exhaustive mask checks retain every fourth-finger alternative for D4/A4/E5 and keep B5 fingered. The deterministic browser input fixture passed in Chromium and Firefox, including E4 → D4, B4 → A4, and F♯5 → E5 release-to-open transitions. No visual layout changes were required.


## Finger spacing and horn hand geometry

`src/shared/input/fingering-layout.ts` defines Compact (68 px), Regular (84 px, the default), and Wide (100 px) center-to-center steps. Main finger positions lie on one local axis. A thumb descriptor supplies its index, anchor finger, and along/across offsets; the horn trigger is three quarters of a step beyond valve 1 and one step toward the thumb. The input component renders these centered coordinates without changing held state, masks, keyboard bindings, or fingering definitions.

CSS maps these coordinates onto horizontal or vertical layouts using the instrument's hand. Flip turns both axes together so the thumb follows the fingers without changing handedness. Move only repositions the panel. Flipped vertical horn order is valve 3, valve 2, valve 1, then T below and to the left of valve 1, on either panel side. No viewport-specific trigger anchoring or reordering remains. Container bounds constrain the same step for all controls, including the trigger. Short portrait columns keep the method selector in one row and place Open/Move/Flip/Spacing in two rows; short landscape uses a horizontal action row. Touch targets remain 64 × 64 px across presets; `--play-scale` compensates for the existing play-surface scaling so large displays do not enlarge hand distances.

Spacing cycles immediately, with the current preset exposed through its accessible label and title. `tunotes:finger-spacing:<instrument-choice>` uses the same local-storage/session-memory convention as Move and Flip, while retaining one spacing preference through orientation changes. The existing shared `FINGERING_SETTLE_MS` in `engine/fingering-policy.ts` is 350; no other evaluation logic changes.

Validation exercises all three presets and both flip states at every Move position for horn, trumpet, four-valve tuba/euphonium, and all four string instruments. It checks target overlap, panel/viewport containment, bounded reach, fixed target size, preference reload/rotation, visible V shortcut, keyboard entry, and automatic evaluation. Chromium also exercises simultaneous valve/trigger touches and partial release under every spacing preset. Generated screenshots live under `dist/validation/`; they are not committed.

Physical hand comfort, Safari, actual browser zoom/enlarged text, and classroom viewing distance require device review. Fold8 dimensions remain provisional.

The deterministic input fixture can be run independently against an existing build with `TUNO_FINGERING_FIXTURE_ONLY=1 node scripts/notes-fingering-browser-check.mjs` (add `TUNO_BROWSER=firefox` for Firefox). It also covers keyboard activation of Spacing and session persistence when a storage write fails but an older preference remains readable.

Refinement validation (2026-10-29): Node 24.22.1 with `npm ci`; `npm run check` (528 tests, typecheck, hosted build); the expanded fingering activity checks and focused input fixtures in Chromium and Firefox; viewport smoke checks in both engines; existing Chromium note-input checks; and `git diff --check` passed. Reviewed screenshots include all primary profiles, narrow/short columns, compact/wide spacing, landscape bottom/side layouts, and low-brass/string regressions.

Handedness correction: the thumb side comes from the instrument, never the panel edge. The browser regression checks the signed orientation of valve 1, valve 2, and T across all presets, Move positions, and Flip states; flipped vertical T must be below and left of valve 1. `npm run check` (528 tests) and `TUNO_FINGERING_INSTRUMENTS=horn-f node scripts/notes-fingering-browser-check.mjs` passed in Chromium and Firefox, including all 12 viewport profiles and the full input fixtures. Reviewed portrait, landscape, and classroom screenshots confirm the corrected thumb side.


## Touchscreen gesture protection

The complete `.fingering-input` surface, including spaces between targets, uses `touch-action: none`. Non-passive `touchstart`/`touchmove` handlers and Safari `gesturestart`/`gesturechange` guards on that component cancel browser gestures while it is enabled. The previous button-level touch guard is delegated to the containing surface. Pointer capture, held-source tracking, release/cancellation, and evaluation timing are unchanged. Page zoom outside the playing surface remains available; there is no document-wide gesture handler or restrictive viewport metadata. See the [Pointer Events touch-action specification](https://www.w3.org/TR/pointerevents/#the-touch-action-css-property) and [Apple gesture-event handling](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html).

Validation: `npm run check` passed (528 tests, typecheck, hosted build). The horn viewport matrix and full input fixture passed in Chromium and Firefox. Chromium touchscreen checks at 1366 × 650 and 360 × 740 enter T, then valve 1, then valve 2 for each spacing preset, move the held contacts in a pinch-like pattern, and add/move/remove a contact in a gap. T+1+2 remains held, viewport scale stays unchanged, and partial release retains the other contacts. Synthetic guard checks in both engines verify cancellation inside the surface and ordinary event handling outside it. Actual laptop hardware/browser confirmation and native Safari gesture recognition remain untested.

Horn keyboard mirroring: E holds valve 1, W holds valve 2, Q holds valve 3, and V holds the trigger. This mapping stays fixed across Move, Flip, spacing, and orientation changes. The displayed key hints, accessible shortcuts, and Practice help match. Fingering masks and accepted answers are unchanged. Validation passed: `npm run check` (528 tests), the horn viewport matrix and full input fixtures in Chromium/Firefox, including all horn key chords in both Flip states and both trigger press orders, plus screenshot review and `git diff --check`.


## Larger hand controls after Fold8 cover-screen feedback

Targets are now 64 × 64 CSS px, with 56 px valve caps and 48 px string pads. Spacing stays independent of target size. The shared hand coordinates keep the horn trigger diagonally adjacent to valve 1 (along −0.75, across 1), preserving its left-hand geometry through Move and Flip. Full trigger evaluation and the 350 ms settling window are unchanged.

Standard narrow side panels grow to 136 px and give the instrument label more width, keeping four-valve labels from consuming finger space. Side-panel widths reserve additional space for thumb controls: up to 176 px on narrow screens (leaving at least 160 px before page insets) and a 168 px hand lane beside the layout tools on larger screens. The music uses the remaining width. Horizontal thumb layouts reserve 168 px of height; other instruments retain their 112 px row. The input panel compensates for play-stage scaling so its width can accommodate the fixed targets. Compact thumb layouts reserve additional stage height; landscape Challenge places actions beside the scene and uses the available scene height for notation. Presets remain capped at 68/84/100 CSS px rather than growing with the display.

The user's cover-screen screenshots motivated this revision; their screenshot resolution does not establish a CSS viewport or physical pixel size. Fold8 viewport fixtures remain provisional. Actual comfort and simultaneous thumb/valve reach need another check on that device.

Validation: Node 24.22.1, `npm ci`, `npm run check` (528 tests, typecheck, hosted build), and the final hosted build passed. The complete fingering browser check passed in Chromium and Firefox for all eight instruments across all 12 primary/secondary viewport profiles, including all placements, Flip states, spacing presets, rotation, persistence, and the deterministic input fixtures. Reviewed primary-profile and narrow/landscape screenshots, including horn and string/four-valve layouts. `git diff --check` passed. Real browser zoom, Safari, and physical-device comfort remain unverified.
