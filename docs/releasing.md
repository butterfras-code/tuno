# Building and reviewing a release

Use Node 24.22.1 from `.nvmrc` and the pinned lockfile. Confirm `node --version` before validation. Install dependencies with `npm ci`, and install test browsers with `npx playwright install chromium firefox`. Browser system libraries, OpenSSL (for the local TLS fixture), and util-linux `flock` on PATH are required. The shared verification scheduler runs on Linux (including WSL); native Windows verification is not supported by this scheduler. Ordinary application builds do not use `flock`. No runtime package, account, or remote asset service is needed.

Run `npm run verify` from the repository root. It type-checks, runs unit tests, builds once, verifies checksums/manifest/icon dimensions, and runs Chromium and Firefox integration, offline/update, audio-render, performance, HTTPS and installation-lifecycle checks. A preflight failure stops before browser work. Once the browser matrix starts, all selected checks run and all failures are collected; any failed, timed-out, or cancelled check makes the command fail. Results are updated incrementally in `dist/validation/summary.json`. Physical acceptance is always recorded separately. See [release validation](release-validation.md) for thresholds, measurements and gaps.

## Responsive acceptance

Follow [the responsive design standard](responsive-design.md). Review the shared viewport screenshots and affected activity states. Record physical Chromebook, phone, Galaxy Z Fold8 cover/inner transition, and classroom viewing-distance checks against the candidate build. Automated viewport passes do not complete physical acceptance; unmeasured Fold8 dimensions remain provisional.

## Outputs

| Path | Purpose |
| --- | --- |
| `dist/hosted/` | Complete directory to serve over HTTPS, including service worker, manifest, icons |
| `dist/hosted/rhythm/` | Uno234, independently scoped worker/manifest and offline cache |
| `dist/hosted/notes/` | tuNotes technical preview, independently scoped worker/manifest |
| `dist/release.json` | Release/build identifiers, source revision/dirty flag, and SHA-256 checksums |
| `dist/validation/` | Machine-readable test results and measured timing/accuracy data |

Each app shows its build identifier and the common release version in its installation controls. Install opens the browser prompt when available, otherwise it shows menu guidance and an example address-bar icon. Simulated prompt tests do not establish native OS installation support. Standalone HTML downloads are no longer built or distributed; existing saved copies are not revoked. JSON backup exports remain supported.

`npm run build` replaces `dist/`, including its previous validation reports. Stop the development server before a release build. Save the candidate's reports with its artifacts before building again. `npm run release:check` rechecks an existing build without replacing it. The source revision is captured at build time; use a clean committed tree for a distributable candidate, or retain the explicit dirty flag when reviewing work in progress.

## Deployment handoff

Local build and verification commands prepare artifacts without publishing them. Cloudflare Pages automatically builds and deploys pushes to `main` at https://tuno.cc; see [hosting setup](hosting.md) for project settings and the feature-branch/PR workflow. Before public distribution, complete the required physical validation. The project uses GPLv3; retain the embedded license, copyright, and font notices. Publish from a clean committed revision and make that revision publicly available in the source repository before distributing its build. About links to that exact source revision, which includes the TypeScript/SVG sources, lockfile, build scripts, and build instructions. When redistributing elsewhere, keep corresponding source available alongside the download or through an equivalent clearly identified source location; do not rely on an unpublished commit or a moving branch.

Serve `dist/hosted/` at the origin root, keeping its `/tune/`, `/notes/` and `/rhythm/` directories and Pages routing files together. Serve `sw.js`/`app.js` as JavaScript, `.webmanifest` as `application/manifest+json`, PNGs as `image/png`, CSS as `text/css`, and HTML as `text/html`. Avoid immutable caching for `index.html`, `sw.js`, the manifest, and unversioned JS/CSS; revalidate them on deployment. Deploy the directory atomically so integrity checks do not see mixed revisions. New deployments no longer serve standalone download URLs; older cached pages may retain downloads until their normal update activates. Returning users should reopen the official site online. Existing installed PWAs update through their normal worker lifecycle.

Keep each worker at its application scope. Do not rewrite unknown resource requests to the HTML entry point. tUno keeps its `/` manifest identity and canonical `/tune/` launch with `/` manifest scope; tuNotes uses relative URLs under `/notes/`. Keep the legacy root manifest and retirement worker; see [migration and staging checks](hosting.md#pwa-migration-and-isolation). Offline preparation includes installation metadata, and only reports readiness after verifying all required files. Each app’s updates wait until its existing controlled tabs close. Readiness checks require the correct worker URL, app identity, and build. Installation uses the browser's normal facilities; no device-security changes should be required.

After deployment, repeat production-HTTPS, offline-reopening and installation checks using the exact published build. Publish measured limitations with the release, retain failures/untested cases, and do not infer hardware support from synthetic browser results.

`release.json.apps.tuno`, `.tunotes` and `.rhythm` contain per-app build IDs, hosted-relative checksums, hosted directory, and common revision/dirty metadata. Legacy top-level tUno fields remain available. Release checks validate all three entries; cross-app browser checks cover separate workers and caches under root and nested test prefixes. Physical-device acceptance remains required before publication.

Uno234 uses `/rhythm/manifest.webmanifest` and `/rhythm/sw.js`, with its own relative manifest identity, directory scope and integrity cache. Tuner/Tone/Tempo retain the shared tUno installation. The launcher links the root tUno manifest. Verify each installation and offline reopening separately.

## Browser check registration

[`scripts/browser-checks.mjs`](../scripts/browser-checks.mjs) is the shared inventory for `npm run test:browser` and `npm run verify`. Both run every active check in Chromium and Firefox; `TUNO_BROWSER=firefox npm run test:browser` selects one engine for local iteration. `verify` always uses both engines. `node scripts/browser-suite.mjs` runs the browser matrix against an existing build without rebuilding. Browser-only results are written to `dist/validation/browser-summary.json`; release verification retains `dist/validation/summary.json`. Both use the shared scheduler described below and collect every browser failure.

When adding a `*browser-check.mjs`, register its filename, active/retired status and supported engines. The inventory also includes `offline-check.mjs`, `audio-render-check.mjs` and `performance-check.mjs`. Unit validation rejects unclassified files, missing files, duplicates, unknown engines and unexplained retirement or engine limitations. Registration is explicit so a new file cannot silently disappear from release verification. The registry classifies executable check entry points, not helper/scenario modules. A new scenario must be called by an active registered runner to enter verification.

Four `count-writing-*` endpoint-editor runners are historical; the current editor is covered by counting-plan and counting-corrections. `ui-refinements-browser-check.mjs` is a historical before/after visual audit tied to removed setup tabs and previous layouts. Current note entry, practice/mobile layouts and responsive rhythm workflows supersede it. These files stay in the inventory with retirement reasons; failures in an active workflow are repaired rather than retired.

## Verification scheduling and focused checks

Verification has a six-runner pool shared by all participating processes and worktrees for the current OS user on this machine. Each invocation uses at most three runners. A runner is one check command, not each browser page or subprocess that command creates. Locks live in the OS temporary directory, outside the checkout, so using another worktree does not create another six slots. Different users or machines have separate pools. Directly executing an individual check script bypasses this scheduler; use the commands below when sharing the machine.

`verify` and `test:browser` use the same runner. Performance, animation, and integrated real-time audio checks run exclusively across the entire pool. Preflight builds, unit tests and pitch benchmarks also run exclusively. Exclusive work runs before parallel browser work; an exclusive waiter reserves admission so existing jobs can finish without being replaced by new shared jobs. It starts only when other managed jobs have released their locks. Unrelated applications and development servers are not controlled by this pool.

A second verification in the same checkout is rejected before it builds or writes reports. Concurrent tasks must use separate worktrees. Stop that checkout's development server before building, as before; the checkout lock does not lock out manually launched builds or dev servers. The scheduler never stops other worktrees' servers.

Every invocation creates a unique ignored `.verification-runs/<timestamp>-<kind>-<id>/` directory. It retains individual stdout/stderr logs, timings (execution and slot-wait time), and an atomic incremental/final summary even if a later build replaces `dist/`. The conventional `dist/validation/summary.json` or `browser-summary.json` contains the same summary and links to that retained run. Screenshots and detailed fixture measurements still live in `dist/validation/`; archive them with the build before rebuilding. No successful test results are cached or silently reused. Failed checks are not automatically retried.

Use focused runs during repairs, then run one complete `npm run verify` against the final release candidate:

```sh
# Build once, then run only the named check in both browsers.
npm run test:browser -- --check notes-fingering-browser-check.mjs

# Reuse an existing build; run one browser and one check.
node scripts/browser-suite.mjs --engine firefox --check notes-mobile-layout-browser-check.mjs

# Repeat --check or --engine to select more than one.
node scripts/browser-suite.mjs --engine chromium --check notes-entry-browser-check.mjs --check notes-results-browser-check.mjs

# Full release verification always uses both engines and rejects filters.
npm run verify
```

After source changes, rebuild before using the direct `node scripts/browser-suite.mjs` command; it deliberately reuses existing artifacts and does not certify that they match current source.

`TUNO_BROWSER=firefox npm run test:browser` remains supported. Explicit `--engine` options override that environment selection. Names must match active registered filenames; unknown or unsupported selections fail rather than silently skipping coverage. Focused summaries are marked `focused: true` and do not establish release acceptance.

Each check has a ten-minute execution timeout (time waiting for a pool slot does not count). Ctrl-C/SIGTERM cancels pending checks and terminates active command process groups, with SIGKILL escalation after one second. Kernel locks release when their holders exit; killing just the scheduler does not prematurely release the slots held by still-running check wrappers. Do not delete pool lock files while verification is running: replacing a locked inode would create a second independent lock. A killed scheduler may leave its last incremental summary incomplete; only a final passing summary establishes success. Pool coordination uses OS locks, not PID files or stale-lock time guesses.

### Local benchmark

On the development Linux host with Node 24.22.1, the full 92-check Chromium/Firefox matrix plus preflight completed in **18.7 minutes** with three task runners, compared with **44.9 minutes** for the preceding sequential release run (about 58% less elapsed time). All checks passed without retries; the new run also included the scheduler unit tests. This is one local measurement, not a guaranteed runtime. Concurrent verification tasks share the six slots and exclusive checks, so contention increases queue time; reports record that separately from execution time.
