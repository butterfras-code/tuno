# Musical keyboard and brass fingering input

Practice and single-player Challenge offer Note Names and Instrument pills. Note Names remains the default. Clicking the Instrument pill opens a popover for Piano, B♭ Trumpet, Horn in F (Dbl), Euphonium – 3V/4V, and B♭ Tuba – 3V/4V. After selection the pill displays the instrument name; clicking it opens the picker again. Escape or clicking outside dismisses the picker. The preset instrument is selected initially; students can choose any chart covering the current written-note range. Charts outside that range remain listed but disabled. Fingering supports B♭ trumpet, three- or four-valve B♭ tuba and bass-clef euphonium, and F/B♭ double horn. Tuba and euphonium valve counts are separate instrument popover choices. J/K/L (Q/W/E for horn) or simultaneous pointer contacts hold valves 1/2/3; semicolon holds valve 4 in four-valve mode; Space or Open explicitly submits no valves. Horn adds a held T thumb pad below the valves, with a live F-side/B♭-side label. The horn rests in F; V holds the trigger to select B♭. Multiplayer retains its existing note-name controls and player keyboard mappings.

Musical keyboard uses the actual tUno piano component and styles extracted from the Tone view. It grades written pitch class in any octave and accepts enharmonic keys without transposing to concert pitch. Keys have no visible note names, but retain screen-reader labels. There are no octave controls, matching checkbox, or piano hint text. It does not generate audio in tuNotes. On mobile the tuNotes piano fits eight white keys (C through C) without horizontal scrolling, with narrower black keys and reduced side padding; the Tone keyboard is unchanged.

The lower answer area uses Uno234’s pill selector and rounded input panel, with shared styles in `src/shared/ui/input-workspace.css`. Switching pills or instruments cancels held input and pending submissions. The selected instrument is saved with each fingering observation so grading and backup validation use the same chart.

## Implementation

- `src/apps/tunotes/domain/fingering.ts`: instrument configuration, written-pitch validation, answer union, and charts including alternates: trumpet F♯3–C6, euphonium E2–B♭4, B♭ tuba E1–B♭3, and double horn C2–G5. Chart source: [Yamaha trumpet fingering chart](https://www.yamaha.com/en/musical_instrument_guide/common/images/trumpet/fingering.pdf). Low-brass charts are cross-checked against [Micah Everett](https://olemiss.edu/lowbrass/studio/fingeringcharts/euphbcfingering.pdf) and [Yamaha tuba](https://www.yamaha.com/en/musical_instrument_guide/tuba/play/play002.html); horn uses [Colin Dorman’s double-horn chart](https://colindorman.com/french-horn-exercises/fingering_charts/). Chromatic numbers come from the existing written-pitch model; there is no concert-pitch conversion or reverse lookup from masks.
- `src/shared/input/held-fingers.ts` and `fingering-input.ts`: source-aware held state and instrument-independent controls. Keys and pointer contacts are tracked independently, with pointer capture and cancellation cleanup. Array order configures arrangement; each finger configures its mask position, labels, and key.
- `src/shared/input/piano-keyboard.ts` and `piano-keyboard.css`: shared keyboard geometry, interaction handlers, and responsive styling; `src/ui/views/tone.ts` and `src/styles.css` consume this extraction. Tone retains its audio and sustain behavior.
- `src/apps/tunotes/ui/keyboard-answers.ts`: written-pitch answers and input gating.
- `src/apps/tunotes/ui/play-surface.ts`: reserves sufficient compact-layout height for the additional input methods.
- `src/apps/tunotes/engine/fingering-policy.ts`: isolated 200 ms flashcard settling policy. It cancels stale timers on prompt changes and locks. An intentional release can submit open only after a held answer advances to the immediately next primary-open card. Prompt changes and input cleanup do not trigger a submission.
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

An intermediate fingering held for at least 200 ms can submit; this is an explicit, unit-tested limitation of the settling policy. Holding a correct combination alone cannot answer a subsequent card. A beat-based activity can consume held state directly without this policy.

Four-valve mode adds 4 as an alternative to 1+3 and 2+4 as an alternative to 1+2+3, plus the documented common alternatives in the current range. Three-valve choices remain acceptable. Switching configurations cancels held states and pending submissions. Valve 4 occupies the last right-hand mask position (`00000001`). Scoring and saved observations accept valid masks independently of the current control layout.

Physical iOS/Android hardware and Safari were not tested. Input method and valve-count choices are session-local. Other tuba tunings, compensating/non-compensating pedal-register extensions, reversed horn triggers, multiplayer instrument mappings, and continuous beat-based evaluation are not implemented. Existing preset ranges are fully covered; no false-tone or compensating-system assumptions are needed.

Keyboard observations store their octave-matching rule. Older observations without that flag retain exact-octave grading when imported. The current piano always submits octave-agnostic answers; historical strict results remain importable.

## String Big 5 input

Violin, viola, cello and double bass are available in the same instrument picker when the exercise pitches are covered by their Big 5 charts. The shared held-input component displays four round fingertip pads, with left index = 1 through little finger = 4. F/D/S/A match those fingers on the keyboard; Space or Open submits an open string. On touch devices in landscape, strings default to the right edge with finger 1 at the top. No string or position selector is required: the displayed pitch is the grading target.

The highest held left-hand finger determines a stopped note. Any lower fingers may remain held; right-hand bits are rejected. Violin/viola use 0–1–2–3–4 and accept the next open string instead of finger 4 where available. Cello uses 0–1–3–4–0 across adjacent strings; the A-string Big 5's upper E requires a shift and accepts finger 1. Bass uses written-pitch octaves and 0–1–4–0–1 across adjacent strings; the highest G-string Big 5 uses shifted 1/4 for C/D. This is a limited Big 5 chart, not a general fingerboard, shift trainer or validator of every possible fingering. Unsupported pitches disable that instrument choice.

Chart references: [Yamaha violin fingering and finger numbering](https://www.yamaha.com/en/musical_instrument_guide/violin/play/play003.html), [Ailbhe McDonagh's cello first-position lesson](https://www.ailbhemcdonagh.com/cello-basics-07-introduction-to-first-position.html), [CelloGuide position chart](https://celloguide.com/wp-content/uploads/2017/09/celloguide-note-chart.pdf), and [Patrick Fowler's double-bass first/third-position lesson](https://www.fowlerbass.com/switching-to-the-double-bass-chapter-2). No chart artwork is reproduced.

Validation includes exhaustive held-mask checks, all 16 string Big 5 preset pools, grading and backup round trips, rolling keyboard input, repeated notes, explicit Open, multitouch cancellation and method switching. Browser coverage uses all primary and secondary viewport profiles for setup, input/feedback, picker and results, plus both landscape regression sizes. Fold8 profiles remain provisional; real-device ergonomics and browser zoom need physical release review.


## Compact grip controls

Move and Flip live beside Open inside the fingering panel. Move cycles left → bottom → right; Flip reverses the finger arrangement without changing mask positions, labels, keyboard bindings, or grading. Horn's trigger stays reachable and follows the flipped arrangement. Narrow portrait layouts reserve a slim column below navigation; short landscape layouts reserve a bottom panel when selected. Neither control opens a new toolbar or dialog.

Preferences are device-local, per instrument/valve configuration and portrait/landscape orientation. Storage denial falls back to session memory. Layout changes clear held input and pending submissions, and Space activates the focused layout button rather than submitting Open. Touch landscape defaults remain right/bottom-to-top for brass and left/bottom-to-top for horn; strings default to right/top-to-bottom. Other contexts initially use the bottom panel. Slide/spread adjustment is not part of this change.

The fingering browser check exercises all three placements and Flip across the primary and secondary viewport profiles, including panel containment, no horizontal overflow, keyboard activation without scoring, preference reload, and cancellation during the settling window. Screenshot review supplements these checks. Physical grip comfort, Safari, real browser zoom, and the provisional Fold8 dimensions still require device review.

Validation for the compact controls: Node 24.22.1; `npm run check` (514 tests, typecheck, build); expanded fingering checks in Chromium and Firefox; viewport smoke checks in both engines; existing Chromium note-input checks; and `git diff --check` passed. After final landscape spacing changes, focused Practice/Challenge checks at 844 × 390, 667 × 375, 1280 × 600, and 1280 × 720 passed in both engines, including count/control separation and companion containment. Reviewed screenshots are under `dist/validation/grip-*` (generated, not committed).


## Release to open

After a held fingering submits an answer, releasing all fingers on the immediately next card submits Open after the normal 200 ms settling window, provided that card's primary fingering in the selected chart is the all-zero mask. Primary means the first chart entry; an open alternate alone does not enable this shortcut. Partial releases may roll into the full release within the settling window. Adding a finger cancels the release shortcut.

The first card, repeated open cards, and release before the next card appears still need Open or Space. Both explicit controls remain available. Cancelled pointers, lost focus, rotation, Move/Flip, instrument changes, pauses, and stale prompts cannot submit open. A hold retained through feedback can release once the next card is active; a release during feedback is not queued.

Policy tests cover the settling boundary, synchronous advancement, delayed advancement, interrupted releases, stale sessions/prompts, explicit Open, and repeated open cards. The browser fixture exercises keyboard and pointer releases through the production note-entry and scoring engine, plus pointer cancellation and layout cleanup.

Release-to-open validation: Node 24.22.1 with `npm ci`; `npm run check` passed (518 tests, typecheck, build). Chromium and Firefox completed the existing viewport/activity sections and the new keyboard/pointer release cases. After updating the horn test's former release-does-nothing expectation, the complete deterministic input-fixture section passed in both engines. `git diff --check` passed. No visual layout changes were made for this behavior.
