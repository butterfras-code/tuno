# Prototype plan

## Purpose

Turn feasibility questions into a small playable experiment and recorded evidence. This document tracks proposed work; no prototype or new benchmark has been completed yet.

## First implementation slice

1. Inventory reusable code and attribution; select the minimum pitch modules and regression cases.
2. Build a simple tuner showing frequency, note, cents, and unavailable/unstable input, with adjustable reference pitch and transposition.
3. Add a sustained reference tone and a metronome with BPM, tap tempo, meter, accents, visual current-beat/downbeat identification, and common subdivisions. Make the tempo beat unit explicit, including compound-meter grouping.
4. Exercise all three together. Keep audio timing independent of rendering; profile the selected detector before deciding to move analysis into a worker or worklet.
5. Build both the hosted, downloadable app with offline caching and the self-contained offline HTML release from shared source. Validate both as required release targets.

Start with a small TypeScript application and separate musical rules, browser audio, and presentation. A framework, shared package, and WebAssembly are not prerequisites. Maintain explicit start/stop and interruption handling. Keep teacher identity and storage out of the core tuner interface.

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
