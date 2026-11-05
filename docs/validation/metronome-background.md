# Background metronome

Implemented on `t3/keep-metronome-running`, 2026-11-05. This is local feature validation, not production promotion or physical-device acceptance.

## Behavior

The metronome runs on an AudioWorklet using the shared beat timeline and the existing synthesized click sounds. Switching away from the page preserves playback and pending metronome starts. Microphone capture and reference tones still stop. Visuals stop polling while hidden and read current audio pulse history on return. Tempo/subdivision changes retain beat-boundary behavior; changing meter starts a new bar at the next beat boundary. Volume, sound, accents and explicit stop controls remain available.

Stop, Stop all audio, page departure and audio-context/processor interruption stop output. A discontinuous audio clock fails safely instead of replaying missed clicks. Engine-load failure remains stopped and supports a later retry. The worklet is bundled into build identity, integrity metadata and offline caches, including the `/tempo/` alias.

## Automated checks

- Node 24.22.1, `npm ci`, `npm run check`: TypeScript, 567 tests and production builds pass.
- Unit tests render 65 seconds at 44.1/48 kHz without UI callbacks: pulse timing stays within one audio sample, accents retain their order, visual history stays bounded, and live tempo/subdivision/meter changes preserve musical boundaries. Cancellation, load failure/retry, processor failure and audio-clock discontinuity are covered.
- `scripts/audio-render-check.mjs` records real AudioWorklet output in Chromium and Firefox at 44.1/48 kHz through a one-second main-thread stall. Output has no missed clicks, burst or phase drift; onset spacing stays within 1 ms. Existing four-sound, zero-volume and reference-tone checks remain in place.
- `scripts/browser-check.mjs` covers online/offline playback, microphone/tone coexistence, explicit stops, a 500 ms UI stall, synthetic visibility loss, no hidden visual polling, and current beat history on return. Animation, tempo, suite routing/offline alias playback and shared viewport checks cover the affected UI.

All 12 focused browser jobs passed for build `6f98feaffb9e91e5` (Chromium 153.0.8010.12 and Firefox 155.0). The metronome screenshots were reviewed at all four primary profiles, plus narrow, landscape and short Fold cover stress sizes; ordinary page scrolling remains available on short screens. Galaxy Z Fold8 profiles remain provisional.

Commands for the focused browser run:

```sh
node scripts/browser-suite.mjs --check browser-check.mjs --check audio-render-check.mjs --check animation-browser-check.mjs --check tempo-browser-check.mjs --check viewport-browser-check.mjs --check suite-browser-check.mjs
```

## Limits and remaining acceptance

The visibility fixture dispatches a synthetic visibility change. A headed browser attempt in this environment did not report the original page as hidden when another page was selected, so it does not establish physical tab-switch acceptance. T3 preview snapshots also timed out twice; the repository's Playwright workflow provides browser evidence. Browser/OS suspension, screen locking, app switching, incoming calls, competing media and mobile audio routing still need real-device checks. An AudioWorklet cannot override an operating-system audio interruption.

The supplementary `npm run release:check` verifies generated checksums, manifests and icons, then fails its pre-existing assertion that tuNotes must not import tUno audio policy (`src/audio/tone.ts`). At the starting commit, tuNotes microphone input already imports the shared audio controller, which imports that tone module. This feature does not change that dependency or claim full release verification.
