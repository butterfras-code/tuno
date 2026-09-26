# Tuner investigation (2026-09-26)

Local review only; no physical acceptance or publication. Base: `0b6310b90734a6ac9ecc698e4abafc659bde4eba`; worktree `t3code-166c8502`, branch `t3code/improve-tuner-accuracy`. Node 24.21.0, Intel i7-14700K. The existing feature worktree was clean; the checkout at `/home/justinb/repos/tuno` was not changed.

## Confirmed problems and fixes

- **Octave-down readings with weak/missing fundamentals at high pitches.** Integer-lag YIN valley scores penalized fractional periods; a two-period candidate could have a much lower sampled score. For example, 1,547.288 Hz at 44.1 kHz could be reported near 773.759 Hz. Compare parabolically interpolated valley depths before selecting the shortest sufficiently good candidate. Keep the filter, gate, quality threshold, frequency interpolation, cadence and display median unchanged. Regression tests vary phase, harmonics and sample rate.
- **Capture starts after interruption during a permission request.** Context interruption previously checked only established streams/voices/timelines. Include pending microphone/tone/metronome starts in cancellation. Late microphone permission now releases every returned track and leaves explicit restart instructions. The new unit regression failed before the one-line fix; browser checks exercise suspension while permission is pending.

No visual redesign, dependency, network processing, device-specific threshold, worker or worklet was added.

## Reproducible measurements

Run `node scripts/pitch-benchmark.ts` for JSON or `node scripts/pitch-benchmark.ts --check` for assertions and `dist/validation/pitch-benchmark.json`. `npm run verify` includes this benchmark. To reproduce the baseline:

```sh
git show 0b6310b:src/audio/detector.ts > /tmp/tuno-baseline-detector.ts
TUNO_DETECTOR=/tmp/tuno-baseline-detector.ts node scripts/pitch-benchmark.ts
```

[Before](before.json) and [after](after.json) use identical fixtures. These are synthetic frame/sequence measurements, not recorded instruments. No real audio recordings were found in the repository. CPU timings are individual synchronous calls on this development host, not low-end device or audio-output latency measurements.

The stationary sweep covers every semitone A1–A6 within 55–1,760 Hz, detuning −49/−23/0/+23/+49 cents, 44.1/48 kHz, 4,096 samples, fixed nonzero phase and five spectra (602 frames each). Spectra are pure `[1]`, rich `[.5,1,.4,.2]`, weak `[.1,1,.4,.2]`, missing `[0,1,.4,.2]`, and rich plus deterministic uniform noise (peak scale .1 versus signal scale .2). Out-of-range detuned endpoints are excluded. The practical physical supported range remains unestablished.

| Measurement | Before | After |
| --- | ---: | ---: |
| Detected / pitched frames | 3,009 / 3,010 | 3,009 / 3,010 |
| Detected within 5 cents / all pitched frames | 3,003 / 3,010 | 3,009 / 3,010 |
| Octave errors | 6 / 3,010 | 0 / 3,010 |
| Weak fundamental maximum absolute error | 1,199.74 cents | 1.40 cents |
| Missing fundamental maximum absolute error | 1,199.74 cents | 1.40 cents |
| Pure / rich maximum absolute error | 1.38 / 1.42 cents | unchanged |
| Noisy maximum absolute error, detected frames | 2.80 cents | unchanged |
| False positives / rejection fixtures | 0 / 600 | 0 / 600 |
| Detector median / p95 | 1.903 / 1.938 ms | 1.903 / 1.922 ms |
| Detector maximum | 3.816 ms | 3.970 ms |
| Synthetic first displayed pitch after onset | 210 ms | 210 ms |
| Synthetic A4 → E5 settling after transition | 210 ms | 210 ms |
| Abrupt silence clearing | 140 ms | 140 ms |

Rejection fixtures include 100 frames each of silence, below-gate sine, white noise, colored noise (one-pole coefficient .85), DC and isolated impulses, across both rates. The one missed noisy pitched frame (55 Hz at 48 kHz) is retained in coverage; rejection is not counted as accurate detection. These finite fixtures cannot establish noise rejection in a room, distinguish a fan's periodic hum from an instrument, or resolve a physically absent fundamental when only even harmonics remain.

Continuous-phase sequences at both sample rates cover 100 ms attack, sustained rich tone, A4→E5 step, ±20-cent 5 Hz vibrato, exponential decay and silence. JSON retains each raw/display frame. The analyser's trailing window and 70 ms cadence are modeled; browser scheduling/output latency is not. First reading is measured from the onset, not from page load or permission. Sustained non-vibrato peak-to-peak display variation is <0.004 cents in these ideal signals. The median and analysis window attenuate vibrato (roughly 5.2-cent display span in the sampled sustained interval); this is a limitation, not an accuracy improvement. Decay falls below the gate before the final hard stop, so its post-stop clearing is zero.

The unchanged three-frame median costs 140 ms after the first valid frame, rejects one isolated outlier and follows a sustained change on the second new reading. It resets on missing evidence. This investigation found no justification for adding smoothing or shortening acquisition based on these fixtures. At a nearest-note boundary, detector error can change the chosen label within roughly the measured error of 50 cents; no note-label hysteresis was introduced. Calibration/transposition mathematics remain covered by the existing round-trip and boundary tests.

## Execution and reliability review

The detector runs on the foreground thread; browser capture/rendering use native Web Audio nodes, with no custom audio-thread processing. p95 detector cost is about 2.8% of the 70 ms interval on this host. Code inspection finds approximately 20 KB of typed-array storage allocated per analysed frame (filter plus difference arrays), in addition to small display/state objects. This is an allocation estimate, not a heap/GC profile. No allocation refactor is justified by current timings. Low-end sustained profiling remains required.

The application retains one shared AudioContext, a reusable capture frame, independent click scheduling, bounded click cleanup and a three-element display history. Tone automation changes only with relevant settings. The tuner animation samples state with requestAnimationFrame; input updates notify UI subscribers at the analysis cadence. Concurrent synthetic capture/tone/click/UI-load tests check scheduling headroom. No background playback guarantee is made.

Capture already requests echo cancellation, noise suppression and automatic gain control off; new browser assertions retain that contract. Browsers/devices may ignore constraints, so actual processing must be checked on hardware. Input is never connected to speakers. Tone/click acoustic leakage remains possible and should be compared with headphones. Track-ended handling releases capture; an input-device replacement requires explicit restart. Simulated end/interruption events do not establish physical hotplug behavior.

## Validation and remaining acceptance

`npm ci`, `npm run check` (35 tests, typecheck, both builds) and `npm run verify` passed: all 19 stages, including Chromium 153.0.8010.12 and Firefox 155.0. Final expanded benchmark and live-calibration browser assertions were also run separately against the same build. `git diff --check` passed. Saved verification JSON identifies build `71a0158acf65565e`, base revision and dirty working tree explicitly.

Automated browser coverage: injected permission denial/retry; real AudioContext suspension during pending permission and release of the late stream; stop/restart; simulated track-ended disconnection; page hiding/resume; tool switching with simultaneous capture, tone and clicks; A4=442 with +2 written transposition on 440 Hz input; requested unprocessed input constraints; stop-all cleanup; intentional scheduler underrun; hosted offline reload/cache/update; relocated portable offline launch; rendered tones/clicks; responsive/keyboard/reduced-motion interactions; localhost HTTPS/download/install lifecycle. Browser evidence is synthetic, including permission and track events. Existing browser detector benchmark p95 was 1.90 ms in Chromium and 3.00 ms in Firefox; rendered calibration error stayed below 0.1 cent.

Final browser observations (synthetic stream readiness to displayed written note; includes automation observation delay):

| Browser | Format | Settling | Silence clearing |
| --- | --- | ---: | ---: |
| Chromium | Hosted | 257 ms | 139 ms |
| Chromium | Portable | 256 ms | 156 ms |
| Firefox | Hosted | 246 ms | 141 ms |
| Firefox | Portable | 262 ms | 156 ms |

Saved evidence: [full verification summary](summary.json), [Chromium integration](chromium-integrated.json), [Firefox integration](firefox-integrated.json), [Chromium performance](chromium-performance.json), [Firefox performance](firefox-performance.json). Integration JSON reflects the final added calibration/lifecycle checks against the same application bytes. Historical browser numbers from the initial release are not a controlled before/after comparison with this worktree.

Initial failures were retained as findings: the pre-fix interruption unit regression failed; the baseline browser suite expected ADV although the current default is BEG, and 750 Hz subdivisions although current click synthesis uses 2,000 Hz. Those stale test expectations were corrected without changing product behavior. An early added browser test timed out because its injected getUserMedia property was non-writable; making that test double writable resolved the harness failure. No remaining automated failures.

WebKit was not run (the repository documents missing host libraries); physical Safari, managed Chromebook, real input/output, OS installation and production HTTPS were not tested. Five-minute hardware/GC/thermal profiling, actual permission UI and physical device switching remain unverified. Physical microphone/device acceptance remains pending.

Physical checklist (record build, device, OS/browser, route and both formats):

1. Deny permission, allow and retry; unplug/switch input; stop during a delayed permission prompt; background/lock/resume and restart.
2. Compare known-frequency input and real instruments across low/high notes, weak fundamentals, ±detuning, attacks, vibrato and decay. Record coverage, octave errors, cents and onset/change/silence latency; include near-boundary notes and A4/transposition changes.
3. Run all tools together for at least five minutes on school hardware. Compare headphones/speakers for leakage, glitches, CPU and missed clicks.
4. Reopen the prepared hosted build offline and first-launch a relocated portable file offline under normal permissions, including physical Safari and managed Chromebook policies.

No decision is required to review these local fixes. Selecting supported devices/range and physical acceptance tolerances requires the user's hardware results; the existing provisional targets remain ≤5 cents after ≤1 second and silence clearing ≤500 ms.
