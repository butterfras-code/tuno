# Working on tUno

## Production and branching

Cloudflare Pages hosts tUno at https://tuno.cc. The production branch is `main`: pushes and PR merges into `main` automatically trigger a production build and deployment. Treat changes to `main` as publication, including documentation-only changes.

Use `dev` for staging before promotion to `main`. Fetch remote branches before work and ensure `dev` includes `origin/main`, merging without discarding legitimate dev-only commits when needed. Preserve unrelated user changes. Feature worktrees may start from `dev`, but completed staging work belongs on `dev`.

Validate on `dev`, review its Cloudflare preview, then use a PR from `dev` into `main`. Do not merge or push to `main` unless the user has authorized publishing. Changes to `main`, including documentation-only changes, publish production.

See [hosting setup](docs/hosting.md) for deployment settings and preview behavior.

## Validation

Use Node.js 24 and install dependencies with `npm ci`. Run checks appropriate to the change; documentation-only edits need link/content review and `git diff --check`, not an application rebuild. For application changes, use `npm run check` and the relevant browser checks. Follow [release instructions](docs/releasing.md) for full candidate verification with `npm run verify` and required physical-device checks.
