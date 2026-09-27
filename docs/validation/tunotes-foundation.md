# tuNotes shared foundation validation

Stage 0 technical preview, 2026-09-26. No gameplay, notation, saved profiles, adaptation, Challenge, or Flow is implemented. No production navigation, deployment, or merge is included.

Environment: Linux, Node 24.21.0, pinned dependencies installed with `npm ci`; Chromium 153.0.8010.12 and Firefox 155.0 via Playwright. Source base: `c3759c8f08ce400c67443d1673f4175e2d088a31`, with working changes (`dirty: true`). A clean committed publication candidate still needs its own release verification.

| App | Content build | Portable SHA-256 |
| --- | --- | --- |
| tuno | `095b396fd1b73141` | `24c64fca55a8df071ab01a5a6765a9cd6f31d115ab5122e245bbf54834c26db9` |
| tunotes | `84f3bed9d487446b` | `7df514951dfb391087bae8010724c863fa51f2624ec9f994defad416c83a743f` |

## Automated evidence

`npm run check` passes TypeScript, all 35 existing unit tests, and both app builds. `npm run release:check` verifies both apps’ hosted checksums, matching portable/download bytes, release/source metadata, manifests and icons, and the absence of tUno state/UI/audio dependencies from the tuNotes bundle. Development smoke checks exercise both `dev` and `dev:notes` from an isolated temporary copy, confirming the correct title/path and no development manifest.

The final `npm run verify` passed all 21 verification stages. Retained evidence: [suite summary](tunotes-foundation/summary.json), [Chromium cross-app checks](tunotes-foundation/dual-app-chromium.json), and [Firefox cross-app checks](tunotes-foundation/dual-app-firefox.json).

`npm run verify` covers the extended synthetic pitch benchmark and the complete tUno browser, layout, tempo, animation, offline/update, rendered-audio, performance, HTTPS/download and install-event suites in Chromium and Firefox. It also runs `scripts/dual-app-browser-check.mjs` in both engines:

- Each independently moved/renamed portable file cold-opens in a fresh offline context without HTTP requests or JavaScript errors.
- Root hosting and `/nested/classroom/` hosting both work, including the child `notes/` path.
- Before the child worker is available, Chromium keeps the notes page root-controlled; Firefox may leave the new document uncontrolled. Both paths load tuNotes without reporting ready or entering the tUno cache. Fetches from a verified root-controlled page also retrieve tuNotes HTML and retain 404 for missing notes resources.
- Manifest IDs resolve to distinct app roots. Caches use separate app/scope namespaces. Child activation removes its own stale cache while preserving tUno and unrelated caches.
- Both prepared apps reopen while the server and browser networking are disabled. The offline tuNotes download is byte-identical to its portable artifact.
- A tUno storage sentinel survives tuNotes use. The shell adds no persistence.
- The tuNotes shell fits widths 360, 768 and 1280. Uno media-query listeners are removed when either app’s DOM is unmounted; repeated explicit disposal cancels active animations and is idempotent.

The first complete run found a Firefox test-fixture assumption (requiring root control on the new document); the test now covers its uncontrolled state and explicitly checks requests from a root-controlled page. An earlier Chromium run exposed and fixed a readiness handoff race by requiring the app’s exact worker URL.

Reports and screenshots are in `dist/validation/`; `summary.json` is the authoritative suite result, and `dual-app-{chromium,firefox}.json` records both build identifiers. `dist/release.json` records per-app SHA-256 checksums. Building again replaces these outputs. Desktop tuNotes and mobile tUno screenshots were visually reviewed.

## Remaining acceptance

These tests establish browser-automated behavior, not physical device support. Safari/WebKit, managed Chromebooks, actual iOS/Android file-opening workflows, tablet multitouch, classroom projection, real microphones/audio hardware, and native OS installation remain unverified for this candidate. Production HTTPS checks must follow a separately authorized publication. Gameplay and teacher/musical acceptance belong to later stages. Existing historical tUno validation is retained separately.

## Review fixes: checkout paths and immediate unmount

The retained 21-stage report above describes the initial Stage 0 candidate. The review fixes use filesystem-relative paths in both browser host fixtures, avoiding URL-encoded path lengths. Uno unmount detection now also checks removal records, so insertion and removal in the same task still dispose listeners and observers. Regression coverage includes immediate direct/ancestor removal, connected moves, cancellation, and exactly-once disposal.

The revised builds are tUno `a0cbb501114192c8` and tuNotes `dfa3a9e97ed05268`. Node 24.21.0, `npm ci`, `npm run check` (35 unit tests and both builds), release integrity, and Chromium/Firefox cross-app checks pass. Targeted browser validation also runs from a copied checkout under a path containing spaces; these results are recorded separately from the initial full-suite report.

The path-with-spaces run passed Chromium tUno interaction and animation checks, plus Chromium/Firefox offline-update and cross-app checks. Retained lifecycle/cross-app reports: [Chromium review](tunotes-foundation/review-chromium.json) and [Firefox review](tunotes-foundation/review-firefox.json). The full 21-stage suite was not repeated for these targeted fixes.
