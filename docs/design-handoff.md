# Figma design handoff
Figma Project:
https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR/tUno-%E2%80%94-Practice-with-a-friend?m=auto&t=sTX4k0dwu6eH7m9T-6

 This records design intent and implementation planning. The first visual implementation is now in the application; audio and animation remain pending.

## Reviewed material

Design context and screenshots were reviewed for the tuner desktop frame (`5:2`), Uno feedback storyboard (`7:133`), and interaction notes (`11:139`). The reference-tone and both metronome frames were subsequently inspected with full design context during implementation. The inventory below records the source frames.

| Frame | Figma node | Role |
| --- | --- | --- |
| Foundations · Warmth, clarity, Uno | `3:2` | Palette and visual principles |
| Components · Controls | `3:30` | Primary and quiet controls |
| Uno / Happy sit | `4:2` | Shared character artwork |
| Tuner focus / Desktop | `5:2` | First implementation reference |
| Reference tone focus / Desktop | `6:37` | Piano, sustain, volume, octave browsing, live tuner |
| Metronome focus / Uno pulse | `6:128` | Free-pulse presentation |
| Metronome / Numbered beats | `6:216` | Meter and beat identity |
| Uno feedback / Animation storyboard | `7:133` | Rest, wag, beg, catch states |
| Interaction notes / Design intent | `11:139` | Cross-view behavior and accessibility intent |

The reviewed page contains desktop practice frames at 1120 × 820. No mobile frames were present in that page inventory. The interaction notes describe static visual states and linked navigation; audio and motion are not simulated.

## Visual foundation

Use CSS custom properties in the existing plain TypeScript/HTML/CSS app. The generated React/Tailwind reference is inspection output, not a reason to change stacks.

| Token | Value observed in tuner/interaction design context |
| --- | --- |
| Canvas | `#f4efe7` |
| Surface | `#fffcf7` |
| Accent | `#73556f` |
| Tint | `#ede3eb` |
| Ink | `#342f2d` |
| Muted | `#716860` |
| Teal | `#397a78` |
| Line | `#dcd2c5` |
| Collar | `#a9574d` |
| Control radius | 16px |
| Main practice surface radius | 32px |

The design uses Nunito for headings/controls and Nunito Sans for supporting text. Shared control descriptions specify a minimum 48px height. Preserve visible keyboard focus, semantic buttons and inputs, and readable feedback at zoom. Implement layout with responsive grid/flex flow; the desktop coordinates are a visual reference rather than fixed page positioning.

Export and retain the exact Uno and bone artwork when implementing the UI. Figma asset URLs expire and must not become runtime dependencies. Obtain font files with their license notices and record asset provenance before bundling. The portable build now embeds image/font bytes as data URLs and validates that CSS references are embedded; browser checks verify decoded assets and no external requests. The application must not fetch fonts or artwork from Figma or a CDN at runtime.

## Interaction contracts

- Focus navigation changes presentation only. Microphone state, selected sounding note, reference-tone playback, and eventual metronome timing persist. Main views and compact tool controls invoke the same actions against shared state; rendering a view must not recreate audio resources.
- The tuner shows note, frequency, signed cents, and text feedback. Sharp is above center and flat below. The bone's thin center is the precise marker; the gradient and Uno supplement the numerical feedback.
- Keep immediate pitch evidence, display smoothing, and patient character transitions separate. A catch uses a duplicate bone so the live pitch marker remains visible and accurate.
- The storyboard progresses through rest, wag, beg, and catch. Silence says “Play a note”; uncertain input says “Listening…”. Reduced motion uses static poses and progress. These are presentation states, not student scoring or records.
- Selecting a piano key selects and sounds that concert note. Sustain keeps it playing. Browsing octaves changes the keyboard viewport without retuning an existing tone. Octave navigation has explicit buttons alongside optional gestures/scrolling.
- Future metronome free-pulse motion follows the audio timeline, with each tail endpoint on a beat. Meter selection prioritizes numbered beats; downbeat identification includes a label. Compound meter displays dotted-quarter BPM.
- Accent selection is separate from Uno's coat and the fixed pitch gradient. Theme customization can follow the initial implementation.

## First-slice integration

1. Add the design tokens, reusable controls, responsive shell, and tuner presentation. Bring across exact static Uno/bone assets with offline packaging support. Keep the existing pitch explorer available as clearly labeled manual test input until microphone analysis is connected; do not label typed data as live listening.
2. Add shared practice state with independent focus, microphone status, selected concert note, octave viewport, calibration, and transposition. Preserve existing tested musical functions.
3. Implement explicit microphone and tone lifecycle in both builds. Connect tuner/reference-tone focus views and their compact controls to the same state. Supply accessible tone selection and volume; add the piano after inspecting its detailed design context.
4. Connect detector evidence to the numerical display and pitch lane. Initially use static Uno artwork; introduce timed pose/progress behavior after pitch reliability and hold rules are tested.
5. Complete offline preparation and state-driven readiness indicators. Show “Offline ready” only when verified for the active distribution, and show listening/playing labels only when those states are real.

Metronome controls become functional in slice 2. During slice 1, omit unavailable navigation/transport or explicitly identify it as unavailable; do not expose buttons that appear functional but do nothing. The designed three-tool strip is the full-prototype destination.

## Details to resolve during implementation

- In-tune tolerance, stable-hold duration, pose delay/hysteresis, and reset/rearm rules for a single reward per sustained note. Pixel dimensions of the target band are not a numerical specification.
- Responsive arrangements for narrow screens, including piano key access, tool controls, and projection/zoom readability.
- Contents of Settings/Display and the exact calibration/transposition control interactions. Retain accessible native controls until these have an implementation specification.
- Initial, denied, interrupted, silent, and unreliable-input layouts. Do not leave the design's example B-flat or progress visible as a stale measurement.
- The tuner example displays 233.1 Hz and −2 cents at A4 = 440 Hz. These are illustrative values: 233.1 Hz is approximately centered B-flat3. Derive both readouts from the same real estimate rather than copying the example values independently.
- Keyboard note labels remain concert pitch initially, as in the core plan. Make the convention explicit when the tuner is set to written pitch.

Validate both artifacts after assets and fonts are introduced, then check focus switching during active audio, keyboard operation, reduced motion, and narrow/zoomed layouts. Physical-device verification remains required.

## Implemented visual pass

Global tokens, shared control helpers, one practice-state store, and the shared shell now support all focus views. Tuner samples remain explicitly manual, with no initial fake pitch; clearing a sample hides the marker. Reference-note selection and octave browsing are separate. Tempo/meter and numbered/Uno views are interactive previews, with playback and tap tempo disabled and explained. No timed success or live-beat state is simulated.

Desktop layout follows the Figma palette, type, artwork, and composition. Responsive adaptations use wrapping navigation, stacked tool cards, smaller static Uno artwork, and a horizontally scrollable keyboard with touch-sized keys. Settings/Display share one native dialog with explicit Save/Cancel, calibration, transposition, and Uno visibility. This is an implementation choice for the previously unspecified dialog contents.

Intentional departures from the static examples: accurate sample frequency/cents values, unavailable transport, no invented hold progress, no unverified offline-ready label, and outlined downbeat identity without claiming an active beat. Rhythm subdivisions, accents, sound selection, and audio volumes beyond the reference-tone setting remain part of metronome implementation.

## Audio/offline follow-up — 2026-09-19

The preview-only transport descriptions above record the initial visual pass. Microphone, reference tone, and metronome controls now invoke the shared audio controller, and hosted readiness is verified by its worker. Metronome settings add subdivisions, downbeat accent, sound, and independent volume; current beats use an outline and readable text. Uno remains static with side cues; tail animation and tuner reward transitions are still follow-ups. See the prototype plan for automated evidence and physical-device gaps.

## Uno motion implementation — 2026-09-19

The additional [Pet tempo and head poses storyboard (`32:393`)](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR/tUno?node-id=32-393) supplies the forward/nod/left-facing head behavior omitted from the initial handoff. The following values were reviewed and approved for implementation:

- Tuner: enter at ±5 cents, leave beyond ±8; wag at 250 ms, beg at 1.2 s, catch at 2.5 s. Up to 150 ms unreliable/out-of-zone input pauses progress; longer gaps reset it. Rest follows 400 ms invalid/out-of-zone input. One reward per sustained note, rearmed by 500 ms silence, 700 ms out of tune, or a different reliable note stable for 250 ms. Manual samples never earn treats. Evidence older than 250 ms cannot advance progress.
- Pitch marker: 80 ms exponential smoothing, separate from immediate numerical readings and the character state machine. Missing evidence hides the marker immediately.
- Character: 300 ms pose crossfades; happy tail ±20°, 700 ms per full cycle. A copied bone follows a 450 ms arc, remains in the catch pose for 650 ms, then fades over 300 ms into happy sit. The live marker remains visible.
- Metronome: tail ±25° with sinusoidal motion, down on every audio beat and up halfway through; one full cycle spans one beat. Double-clicking or double-tapping Uno’s body switches to a beat-by-beat left/right tail toggle mirrored across Uno's centerline. Phase follows scheduled beat timing, independent of bar numbering and subdivisions. Starting immediately moves the tail from rest in either motion mode; the first side-to-side beat is mirrored left. Stop settles in 200 ms. Numeric tempo drag/wheel controls remain available.
- Meter control: options show only 1–7 in ascending order, with the Meter label outside the list. One remains free pulse; two retains the existing two dotted-quarter beats of 6/8. Five, six, and seven support numbered beats and per-beat accents.
- Pet tempo: one 10°/6-source-pixel nod per tap (90 ms down, 170 ms return). Head contact immediately nods and invokes tap tempo, without waiting for release or double-tap detection. Body taps only change tail motion; keyboard activation of the body button also switches it. All Tap controls use the same callback. Tap tempo uses the median of the latest four intervals; two taps start estimation, a pause longer than 2 s resets it.
- Tempo drag: drag the BPM number or the strip beside the vertical drag marker; activate after 6 CSS px movement and turn left over 180 ms. Up/right increases tempo by 1 BPM per 6 CSS px, down/left decreases; clamp to 30–240 BPM. Holding or dragging Uno does not adjust tempo. Head tilt tracks movement directly without transform smoothing, at 1° per 6 CSS px, capped at ±18°. Release/cancel returns to ready in 220 ms, retains BPM and suppresses the pointer tap. Head pivot is (158,165) in 320px artwork, scaled to the retained 300px SVG coordinate system. Body and tail remain independent.
- Reduced motion: static poses, progress values, catch bone and beat highlights; no wag, nod, flight or animated pose transitions. Keyboard activation and existing numeric controls remain available.

`tests/feedback.test.ts` verifies the timing and reset rules. `scripts/animation-browser-check.mjs` covers hosted/portable poses, rewards, independent audio phase (including 3/4), pet gestures, touch cancellation, keyboard access and reduced motion. These are synthetic browser checks; physical microphone/touch/audio acceptance remains separate.
