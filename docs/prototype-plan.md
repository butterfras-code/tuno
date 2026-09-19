# Prototype plan

## Purpose

Turn feasibility questions into a small playable experiment and recorded evidence. This document tracks proposed work and implementation evidence. The source/build foundation and initial musical rules are implemented; the audio prototype and physical-device benchmarks remain ahead.

## Implementation sequence

Build the prototype in three slices. The first establishes the tuner and audio lifecycle; the second adds the metronome; the third completes integration and release verification. Both distribution formats are exercised from the first slice, rather than leaving portable-file feasibility until the end.

Use the existing small TypeScript application with semantic HTML controls and CSS. The Figma design is now available; the [design handoff](design-handoff.md) records reviewed frames, visual tokens, interaction contracts, and integration order. Bring the designed shell and tuner presentation into slice 1 while audio feasibility work continues. A framework, shared package, and WebAssembly are not prerequisites.

### Slice 1: listen, identify, and compare

**Outcome:** a musician can explicitly start listening, see the detected concert/written note and cents deviation, adjust tuning reference and transposition, play a reference tone, and stop all audio. The same experiment runs in a hosted build and a self-contained HTML file.

Keep this slice free of functional metronome controls, teacher workflows, saved preferences, and installation polish. Use the supplied static artwork; defer animated rewards until pitch reliability and hold behavior are established. These exclusions do not change the full prototype commitments.

#### Work order

1. **Establish the source and build foundation.** Add TypeScript, a development server, a production build, and a small test runner. Generate hosted assets and a single portable HTML from the same application entry point. Check the portable artifact for external resource dependencies. Inventory any proposed reused pitch code, its license, and useful regression cases before importing it; no reusable implementation currently exists in this repository. Resolve project licensing before distributing imported code or assets.
2. **Define and test musical rules.** Implement frequency-to-note and cents conversion, adjustable A4 reference, and written/concert pitch conversion as browser-independent functions. Define transposition as the semitone offset added to concert pitch to obtain written pitch; use an explicit B-flat example in tests and labels. Reference-tone frequency follows the selected concert pitch and A4 calibration, independent of how the note is displayed.
3. **Prove browser audio and packaging early.** Use explicit user actions to request microphone access and start/resume audio. Open the portable file with networking disabled and ordinary browser settings; exercise physical microphone input and a generated tone before investing in the detector. Repeat over HTTPS. Record any file-opening, permission, or audio restrictions as evidence and revisit implementation choices if a required path fails.
4. **Add pitch analysis and feedback.** Select a detector using known-frequency and harmonic-rich fixtures. Expose frequency, signal level, and the detector's evidence/quality measure separately from display smoothing. Keep silence and unreliable estimates out of the displayed stable result; clear stale pitch after input disappears. Profile foreground analysis before deciding on workers or worklets, and verify any chosen execution model in both builds.
5. **Connect the Figma practice surface.** Follow the design handoff for focus navigation, shared persistent audio state, the pitch lane, and static Uno artwork. Provide labeled native controls for listening, A4 calibration, transposition, reference-tone note, independent tone volume, and tone start/stop. Show frequency, note, cents with sharp/flat/in-tune text, and clear idle/requesting/listening/no-signal/unreliable/error/interrupted states. Include an obvious stop-all action. Keep microphone capture out of the tone playback path. Use short gain ramps to avoid abrupt tone clicks.
6. **Add hosted offline preparation and validate the slice.** Cache the essential hosted resources and show readiness only after preparation succeeds. Defer activation of an update until practice is stopped. Verify offline reopening of the hosted app and first launch of the portable file without networking. Record automated results separately from physical-device results, and retain failures and untested cases.

#### Boundaries that let design proceed independently

- **Musical rules:** note naming, calibration, cents, and transposition; no DOM or browser audio dependencies.
- **Pitch analysis:** audio samples in, pitch evidence out; no display smoothing or teacher scoring.
- **Browser audio:** microphone and tone lifecycle, permissions, gain, cleanup, and interruption reporting.
- **Presentation:** subscribes to practice state and invokes explicit actions; owns formatting and display smoothing. Figma-derived controls can replace the plain interface without changing musical calculations or audio ownership.
- **Distribution:** resource loading and offline preparation; the portable build does not depend on a service worker.

Keep these as modules in one application, without introducing a package system or a speculative plugin architecture. Share one audio lifecycle across the practice tools so the metronome can join it in slice 2.

#### Proposed acceptance checks

The following numerical targets are initial test hypotheses, not claims of supported instruments or browsers. Revisit them using recorded measurements before accepting the slice.

| Area | Slice 1 check |
| --- | --- |
| Musical rules | Exact A4 calibration cases, octave boundaries, cents direction, and concert/written round trips pass deterministic tests. A concert B-flat displays as C for a B-flat instrument. |
| Synthetic detection | At 44.1 and 48 kHz, clean tones and specified harmonic-rich fixtures from 55–1,760 Hz settle within 500 ms with error no greater than 5 cents and no octave errors; include silence and noise rejection cases. Record fixture amplitudes and harmonic content. |
| Feedback | On the initial physical test device, sustained test notes aim to settle within 1 second; note how the reference frequency was established. Silence clears the prior pitch within 500 ms. Failures inform the eventual supported range. |
| Reference tone | Generated frequency matches the selected concert pitch and calibration in an offline audio test; changing written-pitch display does not retune it. Volume, stop, and restart behave correctly. |
| Lifecycle | Denial, missing input, delayed permission completion after stop, disconnected input, and audio interruption produce clear states. Stop releases microphone tracks and silences output; repeated starts do not create duplicate capture or tone instances. Restart requires an explicit action when needed. |
| Coexistence | Listening and tone playback can run together without routing microphone audio to speakers. Document speaker-to-microphone tone leakage; headphones are a useful comparison, not evidence of acoustic isolation. |
| Basic access | All controls work by keyboard with visible focus and labels. Pitch direction and state remain understandable without color or animation. Avoid announcing every changing pitch sample to screen readers. |
| Distribution | Hosted offline reopening and portable offline first launch both exercise microphone and reference tone. Automated packaging checks show no required external resources in the portable artifact. |

Run the first physical checks on an available device, then cover the managed Chromebook, physical Safari device, and desktop Firefox matrix below before claiming cross-browser support. A missing device is an explicitly untested row, not a pass. Slice 1 implementation can be reviewed while physical validation remains pending.

### Slice 2: keep time

Add BPM, tap tempo, meter, audible accents, visual current-beat/downbeat identification, and common subdivisions. Label the tempo beat unit explicitly, including dotted-quarter grouping in compound meters. Schedule audio independently of rendering and derive visuals from the same musical timeline. Test timeline calculations and measure clicks under UI activity and concurrent pitch analysis in both builds.

### Slice 3: integrated prototype and release checks

Exercise all three tools together, address CPU load and acoustic leakage findings, and complete device, offline, interruption, and readability checks. Finish hosted installation/download affordances and shared artifact versioning. Integrate the evolving Figma design as it becomes available; do not make core feasibility work depend on finished visuals. Set and record final accuracy, settling-time, and timing tolerances before declaring the prototype accepted.

## Validation matrix

Use an actual managed Chromebook, Safari on an available iPhone/iPad, and desktop Firefox. Record device, OS, browser version, input/output route, build revision, and distribution mode for every result. Automated WebKit checks supplement physical Safari checks.

| Question | Evidence to collect |
| --- | --- |
| Does pitch detection cover the required instruments? | Known-frequency fixtures and real instruments, especially low brass; cents error, octave errors, settling time, and missed notes |
| Does the metronome remain steady? | Measured click intervals and missed clicks during UI activity and simultaneous analysis; distinguish scheduling error from output latency |
| Are meter and beat indicators correct? | Check beat counts, downbeat accents, simple/compound grouping, subdivision spacing, and visual alignment with audible beats |
| Can the tools coexist? | Drone/click leakage into microphone, false detections, CPU load, and audio glitches |
| Does offline use work? | Disconnect, close, reopen, and use all core controls; test hosted cache and relocated HTML separately |
| Do permissions fail clearly? | Denied input, absent/disconnected device, delayed permission response, and recovery |
| Does interruption recover? | Background/foreground transitions, screen lock, audio interruption, and explicit restart when required |
| Is classroom use readable? | Projection distance, small screens, keyboard access, non-color feedback, and reduced motion |

Before declaring the prototype accepted, set numerical accuracy, settling-time, and timing tolerances for the chosen pitch range and devices. Distinguish synthetic signal results from physical microphone results. Do not claim background playback or full instrument range without evidence.

## Teacher-workflow follow-up

Once basic practice works, reproduce one check-in cycle with synthetic student identities: select target, listen, accept a stable hold, show feedback, optionally advance, require release before another score, and allow teacher correction. Test low/high results, silence, interruptions, and the final student. Use this experiment to establish the teacher-mode boundaries before introducing real student records.

## Deliverables

- A working, small practice surface with documented launch instructions.
- A device-results table with passes, failures, measurements, and limitations.
- Both distribution artifacts, supported by offline and microphone checks.
- A record of adapted modules, attribution, and preserved tests.
- A next milestone based on evidence, including unresolved issues.

Keep the distribution architecture current and document the audio execution model when measurements support a choice. Add contribution and release instructions when contributors can build and test the application. Keep these documents proportional to the working product.

## Implementation evidence — 2026-09-19

The first foundation step and initial musical rules are implemented using TypeScript, esbuild, plain HTML/CSS, and Node's test runner. The temporary pitch explorer takes typed frequencies; it performs no microphone capture or audio playback. Source code for the musical rules is original; no upstream pitch detector has been selected or imported.

| Check | Result | Limits |
| --- | --- | --- |
| Type checking and musical unit tests | Passed; six test groups cover A4 calibration, cents direction, octave boundaries, B-flat transposition, invalid input, and round trips across notes 21–108 at four calibrations | Mathematical rules only; no detector or measured instrument range |
| Production packaging | Hosted assets and inline portable HTML generated from one bundle; static resource checks passed | Future runtime resource loading needs corresponding validation |
| Automated Chromium 153.0.8010.12, Linux environment, hosted loopback HTTP | Pitch explorer, calibration, transposition, and input validation passed; nested hosting path exercised | No production HTTPS or physical audio test |
| Same automated browser, portable `file://` | Copied to a temporary directory and renamed; controls passed with browser offline; no subresource requests | No physical microphone or ordinary user-device test |
| Development server | Working pitch explorer served on loopback port 5173 | Manual refresh; no live reload |
| Managed Chromebook, physical Safari device, desktop Firefox | Untested | Still required for browser-support claims |

These checks cover the uncommitted foundation changes following base revision `2d8d7d8`; commands are documented in the README so they can be rerun against the eventual commit. No input/output route was used because this step has no audio. Hosted offline reopening is not yet implemented.

**Next:** prove explicit microphone and tone lifecycle in both formats, including portable offline launch on actual devices, before selecting and integrating pitch detection. The Figma shell, tokens, static tuner presentation, and shared practice state are now implemented; see the [design handoff](design-handoff.md) for scope and unresolved interaction details.

## Design implementation evidence — 2026-09-19

Implemented against base revision `fbba413`: shared design tokens and controls, a single session-state store, responsive tuner/reference/metronome views, and locally embedded Figma artwork and fonts. The metronome is a visual/settings preview; microphone, tone playback, metronome scheduling, reward animation, and hosted offline preparation are not implemented.

- Type checking and 10 unit-test groups pass, including cross-view state preservation, independent octave browsing, manual-pitch clearing, invalid values, and compound-meter preview grouping.
- Chromium 153.0.8010.12 checks pass for hosted loopback HTTP and a renamed portable file opened with the browser offline. Both fonts and all SVGs decode; the portable file produces no subresource requests.
- Browser checks exercise all three focus views at widths 1120, 768, 390, and 320 without page overflow; the piano scrolls within its container. Settings cancellation restores focus, shared updates preserve the active control, and reduced-motion preference is honored.
- Desktop and mobile screenshots were visually reviewed against the Figma references. Mobile layout and Settings dialog are implementation adaptations because no corresponding frames were supplied.
- Physical microphone/audio routes, actual managed devices, Safari, and Firefox remain untested. These visual checks do not imply audio readiness or hosted offline support.

## Audio implementation progress — 2026-09-19

After merging remote design notes and tracking the missing visual foundation files, the next two implementation increments now have working code:

1. Application-owned microphone/reference-tone controller, shared focused/dock controls, explicit start/stop and stop-all, independent cancellation, gain ramps, short-tone/sustain behavior, volume/calibration updates, disconnected-input and interrupted-context states.
2. Adapted pitch-tracker YIN detector connected to live note/cents/frequency feedback, separate RMS/quality evidence, silence/unreliable rejection, and clearing on every rejected frame. No display smoothing or reward/hold behavior is added yet. Manual sample controls are disabled while live input owns the display.

Type checking, 13 unit tests, and both packaging outputs pass. Detector fixtures cover 55, 65.406, 110, 233.082, 440, 880, 1,600, and 1,760 Hz at 44.1/48 kHz with peak scale 0.2 and harmonics `[1]` or `[0.5, 1, 0.4, 0.2]`, within five cents. Noise uses seeded uniform amplitude 0.2; low-amplitude rejection uses 0.001. These discrete fixtures do not establish a measured instrument range. The upper-boundary octave failure found during adaptation was corrected by including its rounded period candidate.

Controller tests cover delayed permissions after stop, duplicate starts, denial, independent microphone/tone ownership, transposition-independent tone frequency, and context interruption. Browser checks additionally exercise real Web Audio with synthetic input, live transposition, concurrent playback, silence clearing, and track release in hosted loopback and offline portable builds. Synthetic input replaces getUserMedia and does not establish hardware access or ordinary permission behavior.

Remaining before accepting these increments: physical HTTPS/portable microphone and tone checks, managed Chromebook/Safari/Firefox matrix, actual interruption/background recovery, offline rendered-tone frequency measurement, detector foreground profiling, measured settling/stale-display latency, and any smoothing justified by those findings. Analysis currently uses a foreground 70 ms timer and 4,096-sample analyser; workers/worklets require profiling evidence. Hosted offline caching remains the following increment.

## Offline and metronome implementation — 2026-09-19

The next two increments now implement hosted offline support and functional timekeeping:

- Hosted worker installation caches HTML/JS/CSS with per-file integrity checks and a shared build version; readiness checks actual entries, failed installs remove incomplete caches, and matching missing files can be repaired online. Updates wait for all existing tabs to close. Portable first launch remains independent of workers/networking.
- Metronome start/stop and tap tempo work in both the focused view and dock. Settings include 30–240 BPM, free pulse/3/4/4/4/6/8, 1–4 pulses per beat, independent downbeat accent, two synthesized sounds, and volume. Compound BPM is explicitly dotted quarter; three subdivisions produce eighth notes in 6/8.
- Scheduled clicks and current-beat/downbeat indicators share the audio timeline. Audio survives focus changes and coexists with tone and capture. Stop-all and context interruption cancel queued clicks; a long scheduler stall stops for explicit restart instead of emitting catch-up bursts. Static Uno side cues and text work with reduced motion; tail animation remains deferred.
- Live input updates preserve an in-progress tempo edit. Rhythm changes apply at the next unscheduled beat, with a new bar when changing meter. Previously scheduled sound/volume settings can take up to the 150 ms lookahead to change.

Validation: type checking, 19 unit tests, production packaging and extended Chromium browser checks pass. Pure rhythm tests cover simple/compound grouping, subdivisions, tempo/meter transitions, 10,000 pulses of arithmetic drift, and tap reset/outliers. Controller tests cover repeated metronome starts, cancelled pending starts, independent microphone stop, and context interruption.

| Automated evidence | Result and limit |
| --- | --- |
| Hosted loopback, prepared then closed/reopened offline | Core views and synthetic input/tone/metronome work after fresh offline navigation |
| Relocated portable file, offline first launch | Same core checks pass, with no subresource requests |
| Update lifecycle | A downloaded update stays waiting during tone playback and while another tab remains; after all tabs close the new version opens offline; unrelated-scope caches survive |
| Cache failures | Missing file prevents readiness offline and repairs on online reload; a failed essential-resource fetch discards installation cache and reports failure |
| Concurrent scheduler | 13 clicks at 1/6-second spacing in each distribution while synthetic pitch analysis, tone playback, view switching and 20 ms UI load run; all starts scheduled in advance (minimum observed lead 50 ms in the initial run). Scheduled-time intervals agree within 0.01 ms; this is not measured speaker-output latency |
| Rendered audio | OfflineAudioContext at 44.1/48 kHz, both sounds: 12 pulse onsets within 1 ms of expected times; downbeat/beat/subdivision amplitudes ordered correctly; volume zero produces silence |
| Deliberate 500 ms UI stall | Metronome stops and displays explicit restart guidance in both builds |

Physical microphone/audio routes, HTTPS deployment, managed Chromebook, physical Safari, desktop Firefox, real acoustic leakage, and classroom readability remain untested. These results do not close physical acceptance for the earlier tuner increments or establish background continuity. The next implementation slice is integrated prototype/release validation, including installation/download affordances and measured device tolerances.
