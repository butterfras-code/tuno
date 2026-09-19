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

**Next:** integrate the Figma shell, tokens, and static tuner presentation with shared practice state, then prove explicit microphone and tone lifecycle in both formats, including portable offline launch on actual devices, before selecting and integrating pitch detection. See the [design handoff](design-handoff.md) for scope and unresolved interaction details.
