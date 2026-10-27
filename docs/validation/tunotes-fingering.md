# Musical keyboard and brass fingering input

Practice and single-player Challenge offer Note names, Musical keyboard, and instrument-specific Fingering. Note names remain the default. Fingering supports B♭ trumpet, three- or four-valve B♭ tuba and bass-clef euphonium, and F/B♭ double horn. Tuba and euphonium have a 3 valves / 4 valves selector next to Open. J/K/L or simultaneous pointer contacts hold valves 1/2/3; semicolon holds valve 4 in four-valve mode; Space or Open explicitly submits no valves. Horn adds a held T thumb pad below the valves, with a live F-side/B♭-side label. The horn rests in F; N holds the trigger to select B♭. Multiplayer retains its existing note-name controls and player keyboard mappings.

Musical keyboard uses the actual tUno piano component and styles extracted from the Tone view. It grades written pitch class in any octave by default, offers a Match octave checkbox for strict grading, accepts enharmonic keys, and provides octave selection without transposing the instrument to concert pitch. It does not generate audio in tuNotes.

## Implementation

- `src/apps/tunotes/domain/fingering.ts`: instrument configuration, written-pitch validation, answer union, and charts including alternates: trumpet F♯3–C6, euphonium E2–B♭4, B♭ tuba E1–B♭3, and double horn C2–G5. Chart source: [Yamaha trumpet fingering chart](https://www.yamaha.com/en/musical_instrument_guide/common/images/trumpet/fingering.pdf). Low-brass charts are cross-checked against [Micah Everett](https://olemiss.edu/lowbrass/studio/fingeringcharts/euphbcfingering.pdf) and [Yamaha tuba](https://www.yamaha.com/en/musical_instrument_guide/tuba/play/play002.html); horn uses [Colin Dorman’s double-horn chart](https://colindorman.com/french-horn-exercises/fingering_charts/). Chromatic numbers come from the existing written-pitch model; there is no concert-pitch conversion or reverse lookup from masks.
- `src/shared/input/held-fingers.ts` and `fingering-input.ts`: source-aware held state and instrument-independent controls. Keys and pointer contacts are tracked independently, with pointer capture and cancellation cleanup. Array order configures arrangement; each finger configures its mask position, labels, and key.
- `src/shared/input/piano-keyboard.ts` and `piano-keyboard.css`: shared keyboard geometry, interaction handlers, and responsive styling; `src/ui/views/tone.ts` and `src/styles.css` consume this extraction. Tone retains its audio and sustain behavior.
- `src/apps/tunotes/ui/keyboard-answers.ts`: written-pitch answers, octave browsing, and input gating.
- `src/apps/tunotes/ui/play-surface.ts`: reserves sufficient compact-layout height for the additional input methods.
- `src/apps/tunotes/engine/fingering-policy.ts`: isolated 200 ms flashcard settling policy. It cancels stale timers on prompt changes and locks. Zero state never submits automatically. Prompt changes do not trigger a submission.
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

- `npm run check`: 471 tests passed, typecheck and hosted build passed.
- New fingering browser checks: Chromium and Firefox. Real simultaneous touch contacts are exercised in Chromium through CDP, including valves 2+4. Tests cover fourth-valve scoring and backups for both instruments, repeated held keys, configuration switching, and all 16 held-state combinations. Desktop 1280 px and mobile 360 px layouts have no horizontal overflow and valve targets exceed 44 px.
- Existing tUno `browser-check.mjs`: passed in hosted and offline modes after keyboard extraction.
- Existing `notes-input-browser-check.mjs`: passed, including note-name keyboard, pointer, accidental, and touchscreen behavior.
- Existing `notes-challenge-browser-check.mjs`: passed, including hosted/offline gating, scoring, countdowns, navigation, and responsive layout.
- Existing `notes-multiplayer-browser-check.mjs`: passed, including hosted/offline rosters, independent keyboard lanes, concurrent touch, and responsive layouts.
- `git diff --check`: passed.
- Existing `notes-browser-check.mjs`: fails at line 68, expecting two attempts after a second intentional click in Normal (instant advancement) mode. The same assertion fails on an untouched HEAD archive, confirming a pre-existing test expectation mismatch.

## Limits

An intermediate fingering held for at least 200 ms can submit; this is an explicit, unit-tested limitation of the settling policy. Holding a correct combination alone cannot answer a subsequent card. A beat-based activity can consume held state directly without this policy.

Four-valve mode adds 4 as an alternative to 1+3 and 2+4 as an alternative to 1+2+3, plus the documented common alternatives in the current range. Three-valve choices remain acceptable. Switching configurations cancels held states and pending submissions. Valve 4 occupies the last right-hand mask position (`00000001`). Scoring and saved observations accept valid masks independently of the current control layout.

Physical iOS/Android hardware and Safari were not tested. Input method and valve-count choices are session-local. Other tuba tunings, compensating/non-compensating pedal-register extensions, reversed horn triggers, multiplayer instrument mappings, and continuous beat-based evaluation are not implemented. Existing preset ranges are fully covered; no false-tone or compensating-system assumptions are needed.

Keyboard observations store their octave-matching rule. Older observations without that flag retain exact-octave grading when imported. The checkbox is session-local.
