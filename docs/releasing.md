# Building and reviewing a release

Use Node 24 and the pinned lockfile. Install dependencies with `npm ci`, and install test browsers with `npx playwright install chromium firefox`. Browser system libraries and OpenSSL (for the local TLS fixture) are required. No runtime package, account, or remote asset service is needed.

Run `npm run verify` from the repository root. It type-checks, runs unit tests, builds once, verifies checksums/manifest/icon dimensions, and runs Chromium and Firefox integration, offline/update, audio-render, performance, HTTPS/download and installation-lifecycle checks. A failure stops the command and is recorded in `dist/validation/summary.json`. Physical acceptance is always recorded separately. See [release validation](release-validation.md) for thresholds, measurements and gaps.

## Outputs

| Path | Purpose |
| --- | --- |
| `dist/hosted/` | Complete directory to serve over HTTPS, including service worker, manifest, icons, and the versioned portable download |
| `dist/hosted/notes/` | tuNotes technical preview, independently scoped worker/manifest and versioned download |
| `dist/portable/tunotes.html` | Independent offline tuNotes HTML |
| `dist/portable/tuno.html` | Independent offline HTML; may be renamed or moved |
| `dist/release.json` | Release/build identifiers, source revision/dirty flag, and SHA-256 checksums |
| `dist/validation/` | Machine-readable test results and measured timing/accuracy data |

Each app’s hosted and portable formats show its own matching build identifier and the common repository release version in their footer. The hosted download filename includes the build identifier so users can distinguish replacement copies. Installation is offered only after the browser supplies an install prompt; other browsers receive concise menu guidance. A simulated prompt test does not establish native installation support.

`npm run build` replaces `dist/`, including its previous validation reports. Stop the development server before a release build. Save the candidate's reports with its artifacts before building again. `npm run release:check` rechecks an existing build without replacing it. The source revision is captured at build time; use a clean committed tree for a distributable candidate, or retain the explicit dirty flag when reviewing work in progress.

## Deployment handoff

Local build and verification commands prepare artifacts without publishing them. Cloudflare Pages automatically builds and deploys pushes to `main` at https://tuno.cc; see [hosting setup](hosting.md) for project settings and the feature-branch/PR workflow. Before public distribution, complete the required physical validation. The project uses GPLv3; retain the embedded license, copyright, and font notices. Publish from a clean committed revision and make that revision publicly available in the source repository before distributing its build. About links to that exact source revision, which includes the TypeScript/SVG sources, lockfile, build scripts, and build instructions. When redistributing elsewhere, keep corresponding source available alongside the download or through an equivalent clearly identified source location; do not rely on an unpublished commit or a moving branch.

Serve the entire hosted directory under one HTTPS path with a trailing slash. Serve `sw.js`/`app.js` as JavaScript, `.webmanifest` as `application/manifest+json`, PNGs as `image/png`, CSS as `text/css`, and HTML as `text/html`. Avoid immutable caching for `index.html`, `sw.js`, the manifest, and unversioned JS/CSS; revalidate them on deployment. Deploy the directory atomically so integrity checks do not see mixed revisions. Retain prior versioned downloads while old pages may still link to them.

Keep the worker at the application scope. Do not rewrite unknown resource requests to the HTML entry point. The app supports nested hosting paths and uses relative manifest/start/download URLs. Offline preparation includes installation metadata and the versioned download, and only reports readiness after verifying all required files. Each app’s updates wait until its existing controlled tabs close. The root worker excludes `notes/`; the child worker scopes itself to that directory. Readiness checks require the correct worker URL, app identity, and build. Installation uses the browser's normal facilities; no device-security changes should be required.

After deployment, repeat production-HTTPS, offline-reopening and download checks using the exact published build. Publish measured limitations with the release, retain failures/untested cases, and do not infer hardware support from synthetic browser results.

`release.json.apps.tuno` and `.tunotes` contain per-app build IDs, hosted-relative checksums, hosted directory, portable filename/checksum, and common revision/dirty metadata. Legacy top-level tUno fields remain available. Release checks validate both entries; cross-app browser checks cover root and nested deployment prefixes, separate cache deletion, and first-visit root-worker control. Physical-device acceptance remains required before publication.
