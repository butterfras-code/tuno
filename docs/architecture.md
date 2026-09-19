# Distribution architecture

## Decision

Maintain two releases in parallel from shared source: a hosted, downloadable app and an offline-only portable HTML file. Both are required delivery formats for the core tuner, metronome, and reference tones. This is the chosen direction; implementation and device verification are still ahead.

## Hosted app

Serve the app over HTTPS with offline caching of all essential resources. Users can practice in the browser without an account, optionally install it where the browser supports installation, and download the portable HTML release directly from the site. Indicate offline readiness only after the required resources are available locally.

The first hosted visit requires connectivity. After preparation, verify offline reopening and core operation. Updates must not interrupt an active practice session. Keep audio processing and preferences local.

## Portable HTML

Produce one self-contained HTML file that opens directly under `file://`. Bundle code, styles, fonts, sounds, and any audio-processing resources. Require no server, installation, service worker, adjacent files, runtime downloads, or internet connection. Distribute updates as replacement downloads.

The portable release must remain usable without ever visiting the hosted app. Test it with networking disabled and ordinary browser security settings, including physical microphone access. Do not require users to disable browser security or launch with special flags. Record any platform limitations explicitly.

## Shared implementation

Keep musical rules, timing, controls, and feedback shared across both builds. Isolate distribution-specific resource loading, caching, and update behavior behind small adapters. Hosted caching must not become a dependency of the portable build. Maintain equivalent core musical behavior and version both artifacts together.

Separate pitch evidence from display smoothing and teacher scoring. Schedule metronome audio independently of interface rendering, and derive visual beat identity from the same musical timeline. Decide worker/worklet use through profiling and verification in both distribution formats.

## Local data

Preferences and future student records belong to browser storage, not the downloaded HTML itself. Moving or renaming a file may change its storage context. Provide explicit export/import for portable data; opening another build must not silently transfer or overwrite records. Cached hosted resources can also be removed by browser or device policy.

## Release checks

- Build both artifacts from the same source revision.
- Exercise core musical behavior in both formats, including meter, beat identity, and subdivisions.
- Verify hosted offline reopening and portable first launch without networking.
- Check portable packaging for external resource dependencies.
- Test microphone permissions, interruptions, and real input on supported Chromium, WebKit/Safari, and Firefox devices.
- Publish measured limitations and launch instructions alongside releases.

No implementation or browser-support claim is implied by this architecture document; results belong in the prototype plan as validation proceeds.
