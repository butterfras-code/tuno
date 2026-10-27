# Trumpet fingering input

Practice and single-player Challenge offer an Answer method selector for B♭ trumpet presets. Note names remain the default. Fingering uses held J/K/L or simultaneous pointer contacts for valves 1/2/3; Open (0) explicitly submits no valves. Multiplayer retains its existing note-name controls and player keyboard mappings.

## Implementation

- `src/apps/tunotes/domain/fingering.ts`: instrument configuration, written-pitch validation, answer union, and F♯3–C6 trumpet chart including alternates. Chart source: [Yamaha trumpet fingering chart](https://www.yamaha.com/en/musical_instrument_guide/common/images/trumpet/fingering.pdf). Chromatic numbers come from the existing written-pitch model; there is no concert-pitch conversion or reverse lookup from masks.
- `src/shared/input/held-fingers.ts` and `fingering-input.ts`: source-aware held state and instrument-independent controls. Keys and pointer contacts are tracked independently, with pointer capture and cancellation cleanup. Array order configures arrangement; each finger configures its mask position, labels, and key.
- `src/apps/tunotes/engine/fingering-policy.ts`: isolated 200 ms flashcard settling policy. It cancels stale timers on prompt changes and locks. Zero state never submits automatically. Prompt changes do not trigger a submission.
- `src/apps/tunotes/ui/note-entry.ts` and `practice-view.ts`: compact method selection, Open action, keyboard routing, lifecycle cleanup, and the existing shared feedback surface.
- `src/apps/tunotes/engine/practice.ts` and `challenge.ts`: accept a fingering answer through existing scoring and advancement. Held physical state survives advancement; a new intentional input change is necessary to answer again.
- `src/apps/tunotes/engine/adaptive.ts`: continues observing accuracy, but does not invent a guessed pitch from a valve mask for spelling contrast exercises.
- `src/apps/tunotes/persistence/store.ts`: snapshot version 5 stores and validates fingering observations. Earlier snapshots migrate on read. Older application versions cannot read version 5 backups.
- `src/apps/tunotes/ui/multiplayer-view.ts`: accepts the shared answer type; its input behavior remains note names.
- `src/apps/tunotes/styles.css`: Uno234-inspired pad dimensions, teal borders, tinted pressed states, typography, and touch-safe targets; existing shared UI tokens and element helpers are reused.
- `tests/tunotes-fingering.test.ts`, `scripts/notes-fingering-browser-check.mjs`, and `package.json`: unit and browser coverage, with the new browser script included in `test:browser`.
- Existing adaptive, challenge, and configurator tests now expect migrated snapshot version 5.

## Validation

Node 24.22.1, dependencies installed with `npm ci`.

- `npm run check`: 467 tests passed, typecheck and hosted build passed.
- New fingering browser checks: Chromium and Firefox. Real simultaneous touch contacts are exercised in Chromium through CDP. Desktop 1280 px and mobile 360 px layouts have no horizontal overflow and valve targets exceed 44 px.
- Existing `notes-input-browser-check.mjs`: passed, including note-name keyboard, pointer, accidental, and touchscreen behavior.
- Existing `notes-challenge-browser-check.mjs`: passed, including hosted/offline gating, scoring, countdowns, navigation, and responsive layout.
- Existing `notes-multiplayer-browser-check.mjs`: passed, including hosted/offline rosters, independent keyboard lanes, concurrent touch, and responsive layouts.
- `git diff --check`: passed.
- Existing `notes-browser-check.mjs`: fails at line 68, expecting two attempts after a second intentional click in Normal (instant advancement) mode. The same assertion fails on an untouched HEAD archive, confirming a pre-existing test expectation mismatch.

## Limits

An intermediate fingering held for at least 200 ms can submit; this is an explicit, unit-tested limitation of the settling policy. Holding a correct combination alone cannot answer a subsequent card. A beat-based activity can consume held state directly without this policy.

Physical iOS/Android hardware and Safari were not tested. Input method choice is session-local. Additional instruments, multiplayer fingering mappings, and continuous beat-based evaluation are not implemented.
