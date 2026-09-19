# Distribution architecture

## Decision

Maintain two releases in parallel from shared source: a hosted, downloadable app and an offline-only portable HTML file. Both are required delivery formats for the core tuner, metronome, and reference tones. Both artifacts and hosted caching are implemented; physical-device verification remains ahead.

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

## Implemented execution and update model

One application-owned AudioContext serves capture, tone, and metronome. A 70 ms foreground analysis timer feeds 4,096-sample frames to the adapted detector. A separate 25 ms scheduler places synthesized clicks up to 150 ms ahead on the audio clock. Animation frames only read that timeline for beat identity; they do not schedule audio. Tempo/subdivision changes apply at beat boundaries, and meter changes begin a new bar there. Missed scheduling beyond the allowed lateness stops the metronome for explicit recovery. No background-playback guarantee is made.

Production hosted builds generate a service worker and content-derived version, shared with portable HTML metadata. Installation atomically caches the essential HTML/JS/CSS using generated SHA-256 integrity values. Cache names include registration scope and version. Activation deletes only older caches for that scope. Workers never call skipWaiting: every existing application tab must close before an update activates, preserving concurrent practice across tabs. There is no forced page reload. The first worker claims the page after installation.

The page reports readiness only when its controlling worker confirms all required cache entries and the matching version. Missing entries can be repaired online with integrity checks; failed preparation and verification stay explicit. Portable files exit before worker registration, and development builds disable registration. No runtime remote assets or sound files are needed.

Validation results and remaining device limitations belong in the prototype plan.

## Release candidate packaging

Hosted builds include a relative-scope web manifest, 192/512px PNG app icons derived from approved Uno artwork, and a versioned download identical to the independent portable artifact. These files join the integrity-checked offline cache. Portable HTML includes no hosted manifest/download links and never registers a worker. Both HTML formats display shared release/build identifiers; `dist/release.json` ties the artifact checksums to source revision and working-tree status.

Native install UI is exposed only after a browser install event; menu guidance remains available elsewhere. All audio pauses on page hiding and requires explicit restart. See release validation for automated results and hardware gaps, and release instructions for the atomic-deployment handoff.
