# Working on tUno

## Production and branching

Cloudflare Pages hosts tUno at https://tuno.cc. The production branch is `main`: pushes and PR merges into `main` automatically trigger a production build and deployment. Treat changes to `main` as publication, including documentation-only changes.

Use feature branches for ongoing development, `dev` for integration and staging, and `main` for production releases. Fetch remote branches before work and ensure `dev` includes `origin/main`, merging without discarding legitimate dev-only commits when needed. Preserve unrelated user changes. Create feature branches from `dev`; feature work may remain on its branch across edits, commits, and testing until it is ready for integration. Do not automatically merge each modification into `dev` or promote it to `main`.

Feature pull requests must target `dev`. Merge completed feature work into `dev` when ready for staging; integrating a feature does not authorize a production release. Multiple changes may accumulate on `dev` before a release.

Before moving work from a feature branch onto `dev` or another branch, give the user a brief update naming the source and target branches, the intended operation, and whether it affects local branches or a remote. Afterward, report the resulting commit and whether anything was pushed.

Production promotion is a separate step performed only on the user's explicit instruction to publish that release. Completing feature work, merging into `dev`, passing validation, or approving a feature PR does not authorize advancing `main`. Validate the release candidate on `dev` and review its Cloudflare preview before promoting it. The only PR permitted to target `main` is a release PR from `dev`, when needed for release review.

`main` must only advance by a fast-forward from the validated `dev` commit (`git merge --ff-only dev` or an equivalent fast-forward ref update). Do not commit directly to `main`, merge feature branches into it, or use merge-commit, squash, or rebase PR merges to promote a release. If `main` cannot fast-forward to `dev`, reconcile the branches on `dev` and validate again; do not force-push or discard history. A release PR is for review and does not override the fast-forward requirement.

Do not fast-forward local `main` or push to remote `main` until the user explicitly instructs you to publish that release. Changes to `main`, including documentation-only changes, publish production. If linked documentation describes a conflicting branching or promotion flow, these rules take precedence.

See [hosting setup](docs/hosting.md) for deployment settings and preview behavior.

## Validation

Use Node.js 24 and install dependencies with `npm ci`. Run checks appropriate to the change; documentation-only edits need link/content review and `git diff --check`, not an application rebuild. For application changes, use `npm run check` and the relevant browser checks. Follow [release instructions](docs/releasing.md) for full candidate verification with `npm run verify` and required physical-device checks.

## Rhythm activities

Before changing rhythm notation, generation, counting or performance logic, read [the canonical rhythm model](docs/rhythm/music-model.md) and [current rhythm direction](docs/rhythm/README.md). Use the shared written-event model and derived time; keep counting conventions and UI support limits separate from the music domain.
