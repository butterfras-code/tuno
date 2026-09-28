# Hosting and deployment

tUno uses Cloudflare Pages with the custom domain **tuno.cc**, registered at Cloudflare. Cloudflare manages the domain's DNS and HTTPS. The app runs entirely in the browser; production serves the static files generated in `dist/hosted/` and requires no application server or database.

## Pages project settings

The Git-connected Pages project uses these settings:

| Setting | Value |
| --- | --- |
| GitHub repository | `butterfras-code/tuno` |
| Production branch | `main` |
| Framework preset | None |
| Root directory | Repository root |
| Build command | `npm run build` |
| Build output directory | `dist/hosted` |
| Build environment variable | `NODE_VERSION=24` |
| Custom domain | `tuno.cc` |

This is a **Pages** project. Its configuration uses a build output directory; the Workers setup form with a Wrangler deploy command is a different deployment flow.

Manage the domain under the Pages project's **Custom domains** settings. Since the domain is already registered and managed at Cloudflare, no registrar transfer or nameserver change is needed. See Cloudflare's [Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/) and [custom domain guide](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## Changes and automatic deployment

Every push to `main`, including a merged pull request, triggers the production build. A successful deployment updates `https://tuno.cc`; a failed build leaves the previous successful deployment live. Documentation-only pushes can also trigger a build.

Use `dev` for staging and review before promoting to `main`. Fetch first and merge `origin/main` into `dev` when needed, preserving commits unique to `dev`. Push `dev` when ready for a staging deployment; open a PR from `dev` into `main` for production review. Merging or pushing to `main` publishes the site and requires explicit authorization.

Cloudflare Pages can build non-production branches and provide preview URLs when preview deployments are enabled. Use the deployment URL reported by Cloudflare to review changes before merging; a preview does not update `tuno.cc`.

The hosting build runs `npm run build`, not the full test suite. Follow [release instructions](releasing.md) for validation before publishing and production checks afterward. Do not treat a successful deployment as proof that all tests or physical-device checks passed.

## Offline updates

The first visit requires connectivity. The app reports **Offline ready** after verifying its essential cached resources. A newly downloaded service worker waits until all existing tUno tabs close before activating, so deployment does not interrupt an active practice session. An offline device must reconnect to obtain an update.

Deploy the complete hosted output together, including the matching portable download. The caching, resource-serving, and release-retention requirements are documented in [release instructions](releasing.md).

## Site URLs

| URL | Content |
| --- | --- |
| `https://tuno.cc/` | Temporary HTTP 302 redirect to `/tune/` |
| `https://tuno.cc/tune/` | tUno tuner, tones, metronome, and installable offline app |
| `https://tuno.cc/notes/` | Lightweight tuNotes Coming Soon page; no manifest or worker |

The root is reserved for a future tUno family launcher/home page. `src/site/_redirects` is copied to the hosted output and uses [Pages native redirects](https://developers.cloudflare.com/pages/configuration/redirects/); no JavaScript redirect is needed. Directory index files support direct navigation and refresh. A top-level `404.html` prevents Pages from treating missing resources as SPA routes. `_headers` requests revalidation for the app and migration endpoints. The Pages build command/output directory remain unchanged. The local esbuild development server does not interpret Pages redirects: open `/tune/` directly with `npm run dev`.

## PWA migration and isolation

All tUno assets, its versioned portable download, manifest and active worker now live in `/tune/`. Both manifest `start_url` and `scope` are `/tune/`; relative worker registration resolves to `/tune/sw.js` with scope `/tune/`. Caches retain the existing `tuno:<absolute scope>:<build>` naming and integrity verification. No app worker is registered by `/notes/` or the root. Future siblings must use their own manifest identity, directory, worker scope and cache namespace.

The manifest deliberately retains `id: "/"`, equivalent to the former root manifest's `id: "./"`. Identity is separate from scope; changing it could create a duplicate installation. [Manifest identity documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id) explains this distinction. `/manifest.webmanifest` remains a compatibility copy with the new launch/scope URLs and absolute icon paths so existing installations can discover updated metadata. Reserve this identity for tUno; a future tuNotes manifest should use `/notes/` as its identity.

Keep `/sw.js` available as a retirement worker for returning users, including those returning months later. Existing root workers discover it through normal browser update checks. It has no fetch handler, never calls `skipWaiting()` or `clients.claim()`, and waits until all clients of the old worker close. Existing sessions can continue playing and using their old offline cache while it waits. Once activated, it removes only caches with the exact old root-scope prefix and unregisters itself. It leaves preferences, sibling caches and `/tune/` caches alone. Do not remove the compatibility endpoints merely because new installations work.

Migration requires connectivity. An old cached root page may appear on the first return; close all site tabs/app windows after practice and reopen online to finish migration, then visit `/tune/` and wait for **Offline ready**. Before that update is downloaded, offline legacy users retain their old cached app. After retirement, a shortcut whose browser still stores `/` needs the online root redirect until its installation metadata updates; browsers vary in when/whether installed metadata refreshes. Do not promise automatic offline launch of every legacy OS shortcut. Verify existing installations on supported devices; if a shortcut remains stale, recreate it from `/tune/`. New installations launch `/tune/` and work offline after preparation.

## Staging acceptance before promotion

Enable preview deployments for `dev` and test its exact HTTPS deployment URL. Confirm `/` returns a 302 to `/tune/`, both app directories survive refresh, and missing assets return 404. Check MIME types and revalidation headers for both manifests/workers. Confirm fresh installation starts at `/tune/`, then close/reopen it offline and exercise tuner, tone and tempo on real hardware.

Also test an installation from the previous root deployment **on the same staging origin**, without clearing site data: keep two old app windows open through deployment, confirm practice continues and retirement waits, close all controlled windows, reopen online, and wait for offline readiness at `/tune/`. Check that only the `/tune/` registration remains, `/notes/` has no controller, preferences remain, and the existing OS icon launches correctly online and offline after its metadata refreshes. A clean preview origin cannot establish legacy migration. Automated browser tests simulate the old root worker/cache lifecycle; they do not prove OS installation behavior, Cloudflare account-level rules, or physical-device acceptance.
