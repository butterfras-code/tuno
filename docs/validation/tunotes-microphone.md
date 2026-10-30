# tuNotes microphone input

Mic is the third answer method in Practice and Challenge. Selecting it does not
request microphone access: use the microphone icon (Start mic) inside the panel. Transposition is saved
on the device; microphone access is never restarted automatically.

The readout shows written pitch and cents at A4 = 440 Hz. Raw tuner detector
samples must remain within ±40 cents of the same semitone for at least 300 ms.
Silence, unreliable detection, an out-of-tolerance sample, or a gap longer than
200 ms restarts the hold. Stable wrong pitches submit wrong answers, just like
other answer methods. Octaves are checked; enharmonic sounding pitches match.
A sustained pitch submits once until silence or a different pitch rearms it.
Prompt changes restart the hold without reusing the sustained answer.

| Setting | Concert-to-written offset | Sound expected for written C4 |
| --- | ---: | --- |
| Concert pitch | 0 | C4 |
| B♭ Trumpet, Clarinet, Soprano Sax | +2 | B♭3 |
| F Horn | +7 | F3 |
| E♭ Alto Sax | +9 | E♭3 |
| B♭ Bass Clarinet, Tenor Sax, Euphonium TC | +14 | B♭2 |
| E♭ Baritone Sax | +21 | E♭2 |

Pause, leaving the activity, finishing, changing input method, hiding the page,
and disposal stop microphone tracks. Rotation preserves microphone input.
The shared tuner controller handles denied permissions, disconnection, audio
interruption, and permission requests completed after cancellation.
The existing detector covers approximately 55–1760 Hz; this feature does not
extend its acoustic range or provide polyphonic recognition.

Automated coverage:

- `tests/tunotes-microphone.test.ts`: exact hold timing, octave transposition,
  duplicate suppression, evidence loss, stale frames, and locked input.
- `scripts/notes-microphone-browser-check.mjs`: synthetic audio through the
  actual detector in Chromium and Firefox, every transposition, track cleanup,
  permission denial, rotation, and all shared viewport profiles. Screenshots and
  reports are written to `dist/validation/notes-mic-*`.
- Existing note input and fingering checks cover the other methods after adding
  the third selector tab.

Physical microphones/instruments, real browser zoom, managed Chromebook,
classroom viewing distance, and physical Fold8 folding remain untested. The
Fold8 viewport fixtures are provisional. Synthetic audio verifies the input
pipeline, not real room noise, instrument harmonics, or hardware latency.
