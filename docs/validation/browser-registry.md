# Browser verification registry

2026-10-26. Local work on `t3/tech-debt-audit`, fast-forwarded from `0915969` to remote dev commit `8087a39bad844c761116d3d4d28d863d8ba38683`. The uncommitted issue 01 persistence fix was preserved and reconciled with the incoming note-entry/results refactor. At validation time, nothing had been committed, pushed or published to production.

## Contract

`test:browser` and `verify` consume `scripts/browser-checks.mjs`: 43 active runners, each scheduled in Chromium and Firefox, and five explicitly retired runners. Browser-only execution accepts `TUNO_BROWSER` for one-engine iteration; release verification always schedules both. The registry is checked by `npm test` and by both runners. New unclassified files, duplicate/missing registrations, invalid engines and unexplained retirement or engine limitations fail validation.

Four historical endpoint-editor scripts are retired in favor of current counting-plan/corrections coverage. The historical UI before/after script assumes removed setup tabs and earlier layouts; current note-entry, practice/mobile layout and responsive workspace checks cover the running UI. Their reasons remain alongside the filenames in the registry.

The UIL check now drives the preset dialog, scope selector, length controls and Use preset. It exercises 32 level/scope/length combinations at each of 320px and 1280px, pending-score/answer retention, panel switching, reload and number/syllable input. The completed-capture check now hosts the built app itself and checks the current Feedback focus contract, retaining eight-attack Tap/Hold evidence, retry, interruption and reload coverage. The patterns check now runs in Firefox as well as Chromium, with separate artifacts.

The incoming UI refactor also left stale tuNotes assertions: Normal-mode misses now advance immediately, so locked-input checks use Pause/Resume; result statistics are scoped to the Practice results container; and backup flows return through Edit setup, which replaced Home. Those test repairs retain the incoming behavior.

Enabling the mobile runner exposed a real 320px navigation overflow: the fullscreen button squeezed the Challenge label. At widths up to 360px, the fullscreen control now uses less horizontal space and the navigation columns respect their text width. Mode buttons retain at least 44px touch targets, now asserted by the mobile check.

## Evidence

- Node 24.22.1 and `npm ci`; final `npm run check` passed TypeScript, all **473 unit tests**, and hosted builds. Final `npm run release:check` and `git diff --check` passed.
- The initial `npm run verify` passed the pitch benchmark, release integrity and its first 13 Chromium browser checks, then stopped on the stale Normal-mode input assertion described above. After repairing the stale assertions, the remaining entries were exercised against that same build. The complete matrix produced 84 passes and the two mobile-layout failures that exposed the navigation defect.
- After the CSS fix, the app was rebuilt and **10 checks passed**: mobile layout, practice layout, mode layout, results and two-tab storage in both Chromium and Firefox. All **86 registered engine/check combinations now have passing results** across the matrix and targeted reruns. An uninterrupted final `npm run verify` was not repeated; the evidence does not claim that every check ran against the final CSS build.
- Final tuNotes build: `c9abf027c0d301d0`; initial tuNotes build: `41ffa90b4f7283c8`. The tUno and rhythm builds remained `8334d502633e1c5a` and `47200dcf779bcd1d` respectively.
- Direct 320px setup/play inspection in both engines confirmed no navigation overflow and every mode target at least 44×44px. Both final play screenshots were visually reviewed.
- An intentional `TUNO_BROWSER=typo node scripts/browser-suite.mjs` invocation failed before launching a browser and wrote a failed preflight report. Unit tests also reject newly unclassified files, including nested paths.

Generated evidence: [matrix and final reruns](../../dist/validation/browser-registry.json), [initial stopped verification](../../dist/validation/browser-registry-initial-verify.json), and [intentional preflight failure](../../dist/validation/browser-registry-preflight.json). Final layout/storage reports and `narrow-navigation-{chromium,firefox}-{setup,playing}.png` are under `dist/validation/`. Rebuilding replaces these artifacts.

Physical device, real audio-route, screen-reader and production acceptance remain separate from this automation work.
