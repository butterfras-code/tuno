# Working on tUno

## Production and branching

Cloudflare Pages hosts tUno at https://tuno.cc. The production branch is `main`: pushes and PR merges into `main` automatically trigger a production build and deployment. Treat changes to `main` as publication, including documentation-only changes.

Prefer a separate Git worktree with a short-lived feature branch for each task. A feature branch in the current checkout is fine when isolation is unnecessary and the working tree is clean. Preserve unrelated user changes. Use descriptive names such as `feature/uno-animation`, `fix/tuner-accuracy`, or `docs/hosting-workflow`.

Make and validate changes on that branch, then use a pull request into `main` for review. Prefer this worktree/feature-branch/PR flow over direct commits or pushes to `main`. Do not merge or push to `main` unless the user has authorized publishing the changes. A permanent `dev` branch is not required.

See [hosting setup](docs/hosting.md) for deployment settings and preview behavior.

## Validation

Use Node.js 24 and install dependencies with `npm ci`. Run checks appropriate to the change; documentation-only edits need link/content review and `git diff --check`, not an application rebuild. For application changes, use `npm run check` and the relevant browser checks. Follow [release instructions](docs/releasing.md) for full candidate verification with `npm run verify` and required physical-device checks.
