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

Keep `main` ready to publish. Prefer a short-lived feature branch in a separate worktree, implement and test the change there, and open a PR into `main`. Merge when ready to publish. A permanent `dev` branch is not required. For example, from the repository root:

```sh
git worktree add ../tuno-my-change -b feature/my-change main
cd ../tuno-my-change
npm ci
```

Cloudflare Pages can build non-production branches and provide preview URLs when preview deployments are enabled. Use the deployment URL reported by Cloudflare to review changes before merging; a preview does not update `tuno.cc`.

The hosting build runs `npm run build`, not the full test suite. Follow [release instructions](releasing.md) for validation before publishing and production checks afterward. Do not treat a successful deployment as proof that all tests or physical-device checks passed.

## Offline updates

The first visit requires connectivity. The app reports **Offline ready** after verifying its essential cached resources. A newly downloaded service worker waits until all existing tUno tabs close before activating, so deployment does not interrupt an active practice session. An offline device must reconnect to obtain an update.

Deploy the complete hosted output together, including the matching portable download. The caching, resource-serving, and release-retention requirements are documented in [release instructions](releasing.md).
