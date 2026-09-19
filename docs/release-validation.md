# Integrated prototype release validation

Status: implementation complete for the integrated release candidate; physical acceptance pending. This is a local prototype, not a published release or a claim of supported school hardware.

## Candidate and evidence

The build writes shared release/build versions into both HTML formats, exposes them in the footer, and records source revision, working-tree status, and SHA-256 checksums in `dist/release.json`. The hosted download is byte-identical to `dist/portable/tuno.html`. The content-derived build identifier covers app source output, HTML template, service worker, manifest, package version, and app icons.

Run `npm run verify` to check the same built candidate in Chromium and Firefox. It writes measured evidence and an explicit physical-acceptance status into `dist/validation/`. The committed evidence under `docs/validation/2026-09-19/` records the initial candidate run; its revision plus `dirty: true` identifies work tested atop that base, and its content build identifies the tested application bytes. It is not a claim that the base commit alone contains this implementation.

## Automated acceptance criteria

These thresholds apply to the specified synthetic fixtures and available test machine. They do not establish real-instrument accuracy, output latency, or low-end-device performance.

| Check | Fixed candidate threshold |
| --- | --- |
| Detector | Every semitone A1–A6 (55–1,760 Hz), 44.1/48 kHz, 4,096 samples, peak scale 0.2, harmonic coefficients `[1]` and `[0.5, 1, 0.4, 0.2]`: error ≤5 cents, no octave errors |
| Detector CPU | p95 execution <35 ms on the recorded test machine, leaving at least half the 70 ms cadence for other work; median/p95/max retained |
| Live synthetic settling | 440 Hz synthetic stream to correct displayed written note ≤500 ms, measured from stream readiness; includes browser automation observation delay |
| Silence clearing | Muted synthetic stream to hidden pitch marker ≤500 ms |
| Reference tone | Offline-rendered A4 at 400/440/442/480 Hz calibration, 44.1/48 kHz: measured error <0.1 cent; silence after stop |
| Click timeline | Thirteen scheduled pulses at 120 dotted-quarter BPM with three subdivisions: interval error <0.01 ms; every click scheduled before its deadline during input, tone, view switching and 20 ms UI load |
| Rendered clicks | Twelve pulses, both sounds at 44.1/48 kHz: onset error <1 ms, correct accent ordering, zero output at zero volume |
| Recovery | Context interruption, cancellation while starting, hidden-page interruption and a deliberate 500 ms UI stall stop affected audio with explicit restart; stop-all releases input and cancels output |
| Offline and update | Prepared hosted app reopens with server access denied; relocated portable file launches without networking; update waits for all existing tabs; missing/failed cache never claims readiness |
| Release | Checksums match every hosted artifact; downloaded file matches portable bytes and plays offline; manifest icons decode at declared dimensions; installation event lifecycle has accepted/cancelled/error handling |
| Readability | All views fit widths 320/390/768/1120, controls retain labels/focus, reduced-motion mode works, pitch/beat meaning has text cues; desktop/mobile screenshots reviewed |

## Recorded candidate results

Build `9c6d0d1fb200f02a` passed all 12 verification stages (type/unit/build, release integrity, and five browser suites per engine). Nineteen unit tests pass. The same application bytes are preserved by the final committed build; evidence records the pre-commit working revision explicitly.

| Browser | Format | Maximum pitch error (cents) | Detector p95 (ms) | Settling (ms) | Silence clearing (ms) |
| --- | --- | --- | --- | --- | --- |
| chromium 153.0.8010.12 | hosted | 1.395 | 1.90 | 85 | 138 |
| chromium 153.0.8010.12 | portable | 1.395 | 1.90 | 93 | 141 |
| firefox 155.0 | hosted | 1.395 | 4.00 | 93 | 81 |
| firefox 155.0 | portable | 1.395 | 4.00 | 92 | 122 |

Environment: Linux 7.2.4-3-cachyos, Intel Core i7-14700K. Synthetic routes only. Both engines passed rendered tone/click limits, update/cache failure checks, localhost HTTPS, unreachable-server downloads, portable playback, and simulated install accept/cancel/failure paths. Raw [verification summary](validation/2026-09-19/summary.json) and per-engine JSON files retain all measured values and timestamps.

## Environment and limits

| Environment | Status | Input/output and limits |
| --- | --- | --- |
| Linux development host, Chromium 153.0.8010.12 | Automated checks available and exercised | Synthetic MediaStream / virtual output / OfflineAudioContext; no physical microphone route |
| Same host, Playwright Firefox 155.0 | Automated checks available and exercised | Same synthetic routes; this is automated Firefox, not classroom hardware validation |
| Local HTTPS | Exercised in both engines | Ephemeral self-signed localhost certificate. Chromium trusts only its public-key fingerprint for this test; contexts allow that test certificate. No production certificate or deployment has been tested |
| Native installation | UI lifecycle simulated | Manifest/icons and download verified; OS installation and installed-window launching require manual checks |
| Automated WebKit | Unable to launch | Host lacks required ICU/XML, Flite, AVIF, HarfBuzz ICU, Manette, Enchant and Hyphen libraries. No WebKit pass recorded |
| Managed Chromebook | Untested | Device, policies and real microphone/output routes unavailable |
| Physical iPhone/iPad Safari | Untested | Device, screen-lock interruption, installation and file-opening behavior unavailable |
| Real instruments, headphones/speakers, projection | Untested | Acoustic leakage, instrument settling, sustained use and distance readability require physical measurements |

The initial native HTML download could bypass the worker cache and fail with the server unreachable. The control now fetches the cached HTML through the worker before saving a local Blob; the unreachable-server download regression runs in both engines.

The offline harness denies server responses as well as enabling browser offline emulation. This matters because Firefox's emulated offline flag did not consistently prevent service-worker repair requests in the initial test. Firefox also omits the top-level file-navigation request event; portable assertions therefore prohibit all observed subresource requests rather than requiring that navigation event. These test-harness differences are retained here, not reported as app failures.

## Integration decisions

Foreground profiling supports retaining the current detector execution model on this host. No worker/worklet is justified by these results alone; repeat measurements on the managed Chromebook before deciding. Tone parameter automation now changes only when pitch/calibration/volume changes, avoiding redundant scheduling on every input frame.

Hiding the page pauses capture and output, clears pending starts, and requires an explicit restart after return. The app does not promise background playback. A timing underrun stops the metronome rather than attempting a burst of missed clicks.

Reference tone and metronome output can leak acoustically into the microphone. The app states this and suggests comparing headphones. Microphone nodes are never routed to speakers, but this does not provide acoustic isolation. No acoustic-cancellation or real-room rejection claim is made. Uno remains static with timed beat cues; animated rewards and tail motion are still visual follow-ups.

## Physical acceptance still required

For each trial, record device/model, OS and browser versions, school policy restrictions, input/output route, release/build identifier, hosted versus relocated portable format, and a pass/failure with measurements. Do not turn missing devices into passes.

1. Load over production HTTPS, prepare offline, close, disconnect networking, reopen, and run all tools together. Separately open a relocated portable HTML offline under ordinary browser settings.
2. Exercise microphone denial, missing/disconnected input, delayed permission after stop, repeated starts, screen lock/background/foreground, and explicit recovery. Check installed launch on each browser that offers installation.
3. Use known-frequency input and real instruments, including low brass. Initial physical targets remain provisional: ≤5 cents after ≤1 second settling, silence clearing ≤500 ms. Record calibration/source uncertainty and octave/missed-note failures before selecting a supported range.
4. Record five minutes of clicks during concurrent practice and UI activity. Initial target: zero missed clicks and interval error ≤5 ms; separate scheduling error, recording uncertainty and output latency. Final device tolerances must be accepted from measurements.
5. Compare speakers and headphones for false pitch detections, CPU/glitches and volume behavior. Verify keyboard-only operation, zoom, reduced motion, small-screen controls and actual projection-distance readability.

The prototype remains unaccepted until these device results, final physical tolerances and source/artwork redistribution licensing are resolved. Teacher records and animated rewards are not part of this release candidate.
