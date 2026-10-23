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
| Build environment variable | `NODE_VERSION=24.22.1` (production and preview) |
| Custom domain | `tuno.cc` |

Keep the production and preview `NODE_VERSION` settings aligned with `.nvmrc`, and confirm the resolved Node version in each deployment's build log. The settings above describe the required configuration; editing this document does not update the Cloudflare dashboard. Cloudflare supports explicit versions through [`NODE_VERSION` or `.nvmrc`](https://developers.cloudflare.com/pages/configuration/build-image/), and its v3 build system does not select Node from `package.json` engines.

Node 24.22.1 includes the [October 21, 2026 security fixes](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases). The package engine minimum excludes earlier Node 24 releases, but the Node executable itself must be upgraded; installing npm dependencies does not patch it. Future Node security updates should advance the pin, engine minimum, matching lockfile metadata, and Cloudflare settings together.

This is a **Pages** project. Its configuration uses a build output directory; the Workers setup form with a Wrangler deploy command is a different deployment flow.

Manage the domain under the Pages project's **Custom domains** settings. Since the domain is already registered and managed at Cloudflare, no registrar transfer or nameserver change is needed. See Cloudflare's [Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/) and [custom domain guide](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## Changes and automatic deployment

Every push to `main`, including a merged pull request, triggers the production build. A successful deployment updates `https://tuno.cc`; a failed build leaves the previous successful deployment live. Documentation-only pushes can also trigger a build.

Use `dev` for staging and review before promoting to `main`. Fetch first and merge `origin/main` into `dev` when needed, preserving commits unique to `dev`. Push `dev` when ready for a staging deployment; open a PR from `dev` into `main` for production review. Merging or pushing to `main` publishes the site and requires explicit authorization.

Cloudflare Pages can build non-production branches and provide preview URLs when preview deployments are enabled. Use the deployment URL reported by Cloudflare to review changes before merging; a preview does not update `tuno.cc`.

The hosting build runs `npm run build`, not the full test suite. Follow [release instructions](releasing.md) for validation before publishing and production checks afterward. Do not treat a successful deployment as proof that all tests or physical-device checks passed.

## Offline updates

The first visit requires connectivity. The app reports **Offline ready** after verifying its essential cached resources. A newly downloaded service worker waits until all existing tUno tabs close before activating, so deployment does not interrupt an active practice session. An offline device must reconnect to obtain an update.

Deploy the complete hosted output together, including each app’s manifest, icons and worker. The caching, resource-serving, and release-retention requirements are documented in [release instructions](releasing.md).

## Site URLs

| URL | Content |
| --- | --- |
| `https://tuno.cc/` | Uno's Practice Tools launcher |
| `https://tuno.cc/tune/` | tUno tuner |
| `https://tuno.cc/tone/` | tUno reference tones |
| `https://tuno.cc/tempo/` | tUno metronome |
| `https://tuno.cc/notes/` | tuNotes |
| `https://tuno.cc/rhythm/` | Uno234 |

All destinations have real directory index files. No SPA rewrite or additional Cloudflare setting is required. `src/site/_redirects` canonicalizes slashless app paths; the root no longer redirects. A top-level `404.html` keeps missing resources from returning an app shell. `_headers` requests revalidation for app resources and worker endpoints.

Tune, Tone and Tempo share one bundle and use History API navigation without recreating the store or audio controller. Direct loads select the view named by the path, overriding the last saved focus. Settings remains a dialog. Cross-app and Tools links use normal document navigation, preserving app isolation and normal browser history. Existing page-hide/visibility handlers stop or pause active practice resources. Portable HTML retains local view switching without rewriting its file URL; its Tools link opens the hosted launcher.

Both `/prototypes/rhythm-walk/` and `/prototypes/count-writing/` remain compatible entry pages using the canonical `/rhythm/` assets. Their query strings and hashes, including counting preferences and Settings links, remain intact. Uno234 is included in the existing tUno PWA: the suite worker precaches its HTML, JavaScript and CSS even before the first rhythm visit. Uno234 also has an independent installation with its own `/rhythm/` manifest identity, worker and offline-readiness status. Standalone HTML releases are retired across all apps.

`npm run dev` now serves all three apps and the launcher on port 5173. The notes/counts/walk development aliases serve the same complete site. Offline preparation stays disabled in development.

## PWA migration and isolation

The existing `/tune/sw.js` and `/notes/sw.js` registrations retain their directory scopes, integrity checks, cache namespaces and deferred updates. tUno keeps manifest identity `/` and start URL `/tune/`; its manifest scope expands to `/` so `/tone/` and `/tempo/` stay within the installed application. tuNotes keeps its independent manifest identity and scope. The root `/manifest.webmanifest` remains a compatibility copy of tUno's manifest.

A separate root registration at `/suite-sw.js` caches the launcher, the Tone/Tempo entry pages, Uno234 and the enumerated tUno resources they require. Its build identifier includes the rhythm assets so rhythm changes invalidate the suite cache. It does not intercept tuNotes, prototype routes or unknown files. A root scope is necessary because the new entry paths are siblings. More-specific existing app workers still take precedence. Each app header prepares this cache so Tools can return to the launcher offline after preparation; tuNotes still requires its own online preparation. Tone/Tempo direct loads verify the suite worker's build before reporting Offline ready. No practice state or preferences are shared by this worker.

Suite updates also wait for existing controlled tabs to close: no `skipWaiting` or forced reload. Its cache name includes scope and build. The suite worker retires only obsolete suite caches and the exact former root-scoped tUno cache, leaving directory-scoped app caches and browser preferences intact.

Keep `/sw.js` available as the retirement endpoint for older installations. It still has no fetch handler and waits for legacy clients to close before removing their cache and unregistering. A visitor who opens the new launcher may instead replace that root registration with `/suite-sw.js`; the suite worker performs the same narrowly targeted legacy-cache cleanup on activation. Both paths preserve active old sessions until they close.

Migration requires connectivity. An old cached root page may appear on the first return. Close all site tabs/app windows after practice and reopen online to finish migration. A stale OS shortcut pointing at `/` now opens the launcher; tUno's manifest still starts at `/tune/`. Browser installation metadata refresh varies, so verify existing installations on real devices and recreate stale shortcuts if needed.

## Staging acceptance before promotion

Enable preview deployments for `dev` and test its exact HTTPS deployment URL. Confirm `/` displays the launcher, all six routes survive direct loading and refresh, and missing assets return 404. Check MIME types and revalidation headers for all app manifests/workers. Confirm fresh installations start at their respective app paths, then close/reopen them offline and exercise the core controls on real hardware.

Also test an installation from the previous root deployment **on the same staging origin**, without clearing site data: keep two old app windows open through deployment, confirm practice continues and retirement waits, close all controlled windows, reopen online, and wait for offline readiness at `/tune/`. Check that the legacy `/sw.js` registration is retired or replaced by `/suite-sw.js` while `/tune/` and `/notes/` retain separate registrations, preferences remain, and the existing OS icon launches correctly online and offline after its metadata refreshes. A clean preview origin cannot establish legacy migration. Automated browser tests simulate the old root worker/cache lifecycle; they do not prove OS installation behavior, Cloudflare account-level rules, or physical-device acceptance.
