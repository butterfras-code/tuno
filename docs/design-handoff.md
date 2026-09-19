# Figma design handoff

Reviewed 2026-09-19. Source: [tUno — Practice with a friend](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR/?node-id=5-2). This records design intent and implementation planning; the application still uses the temporary pitch explorer.

## Reviewed material

Design context and screenshots were reviewed for the tuner desktop frame (`5:2`), Uno feedback storyboard (`7:133`), and interaction notes (`11:139`). The page inventory also identifies the following reference frames; inspect their full design context before implementing them.

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

Export and retain the exact Uno and bone artwork when implementing the UI. Figma asset URLs expire and must not become runtime dependencies. Obtain font files with their license notices and record asset provenance before bundling. Extend the portable build to embed image/font bytes and update its resource checks, which currently reject all image `src` attributes and CSS `url()` references. The application must not fetch fonts or artwork from Figma or a CDN at runtime.

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
