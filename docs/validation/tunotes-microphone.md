# tuNotes microphone input

Mic is the third answer method in Practice and Challenge. Selecting it does not
request microphone access: use the microphone icon (Start mic) inside the panel.
Instrument presets preselect their written-pitch transposition, including the
double bass octave. Manual changes survive prompt updates and switching answer
methods; selecting a different preset instrument applies its default. Without an
instrument preset, the last manual transposition saved on the device is used.
Automatic defaults do not replace that saved preference; microphone access is
never restarted automatically.

The readout shows written pitch and cents at A4 = 440 Hz. Raw shared detector
samples must remain within ±40 cents of the same semitone for at least 300 ms.
Silence, unreliable detection, an out-of-tolerance sample, or a gap longer than
200 ms restarts the hold. Stable wrong pitches submit wrong answers, just like
other answer methods. Octaves are checked; enharmonic sounding pitches match.
A sustained pitch submits once. Brief pitch changes, octave glitches, and missing
or unreliable readings cannot rearm that counted pitch, including during feedback
and across prompt changes. A different pitch must meet the full 300 ms hold before
it counts and becomes the new blocked pitch. Alternatively, at least 250 ms of
continuous measured quiet (below the capture adapter's RMS gate of 0.005) rearms
the same pitch, which then needs a fresh 300 ms hold. Unreliable detection alone
does not establish quiet; gaps longer than 200 ms restart release evidence.
Quiet release is recognized during feedback, while pitch answers stay locked.
The readout stays live and counted pitches show “Note counted — change note or
release to play again.” Prompt changes restart the hold without clearing the
counted pitch or continuous release evidence. Stopping capture or changing
transposition clears both.

| Setting | Concert-to-written offset | Sound expected for written C4 |
| --- | ---: | --- |
| Concert pitch | 0 | C4 |
| B♭ Trumpet, Clarinet, Soprano Sax | +2 | B♭3 |
| F Horn | +7 | F3 |
| E♭ Alto Sax | +9 | E♭3 |
| C Double bass (octave lower) | +12 | C3 |
| B♭ Bass Clarinet, Tenor Sax, Euphonium TC | +14 | B♭2 |
| E♭ Baritone Sax | +21 | E♭2 |

Pause, leaving the activity, finishing, changing input method, hiding the page,
and disposal stop microphone tracks. Rotation preserves microphone input.
The microphone-only adapter in `src/shared/audio/microphone.ts` handles denied
permissions, disconnection, audio interruption, and permission requests completed
after cancellation. tuNotes imports neither the tuner store nor its audio
controller; capture supplies raw pitch without tuner display smoothing. The
existing release integrity check continues to enforce that dependency boundary.
The existing detector covers approximately 55–1760 Hz; this feature does not
extend its acoustic range or provide polyphonic recognition.

Automated coverage:

- `tests/tunotes-microphone.test.ts`: exact hold timing, octave transposition,
  duplicate suppression across prompts and glitches, confirmed quiet release,
  repeated notes, legato changes, evidence loss, stale frames, and locked input.
- `tests/microphone-capture.test.ts`: raw evidence, cancellation and late grants,
  duplicate starts, permission retry, disconnection, interruption, and disposal.
- `scripts/notes-microphone-browser-check.mjs`: synthetic audio through the
  actual detector in Chromium and Firefox, held-note suppression through quiet,
  noisy and pitch glitches, repeated notes after release, legato changes,
  every transposition, track cleanup,
  permission denial/retry, interruption/retry, rotation, and all shared viewport profiles. Screenshots and
  reports are written to `dist/validation/notes-mic-*`.
- Existing note input and fingering checks cover the other methods after adding
  the third selector tab.

The capture boundary repair on 2026-11-05 passed `npm run check` (573 tests),
`npm run release:check`, and all eight focused Chromium/Firefox jobs for
`notes-microphone-browser-check.mjs`, `browser-check.mjs`,
`dual-app-browser-check.mjs`, and `suite-browser-check.mjs`. The working candidate
was built atop `db0f683` with `dirty: true`; tuNotes build `51f40e5073b62064`
contains only shared audio dependencies. The detector implementation is unchanged.
The four primary microphone viewport screenshots were reviewed. These focused
results do not replace full release verification on the integrated candidate.

The held-note gating update on 2026-11-06 passed `npm run check` (579 tests)
using Node.js 24.22.1. The extended microphone browser check and cross-app
viewport smoke check passed in Chromium and Firefox at all 12 shared profiles.
Microphone screenshots were reviewed at all four primary sizes in both engines,
plus Chromium narrow and landscape sizes; counted-note guidance fits without
clipping or page overflow. These runs use synthetic input, including quiet gaps,
audible noise, semitone wobbles, octave glitches, and stable pitch changes.

Physical microphones/instruments, real browser zoom, managed Chromebook,
classroom viewing distance, and physical Fold8 folding remain untested. The
Fold8 viewport fixtures are provisional. Synthetic audio verifies the input
pipeline, not real room noise, instrument harmonics, or hardware latency.
