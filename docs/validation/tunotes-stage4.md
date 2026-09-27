# tuNotes Phase 4 validation

Implemented on `feature/tunotes-solo-challenge`, 2026-09-27, based on the existing tuNotes branch at `3c85ae6`. This is a review preview, not production publication.

## Implemented behavior

The existing Challenge mode segment opens solo Timed/Target setup, reusing presets, Custom pools, written-spelling answers, optional adaptation, local profiles and Uno. Ready starts a three-second countdown with no accepted answers or active time. Rules freeze per round. Challenge uses fixed 250 ms correct / 800 ms incorrect feedback, including that time in the allowance, independently of Practice pacing. The note introduction remains a Practice option.

Timed defaults to 60 seconds and correct × accuracy, with optional raw correct count. Target defaults to 10 correct, 120-second timeout and 80% qualifying accuracy. Deadlines reject answers at or after expiry; Target finishes immediately on the final correct submission. Pauses, visibility loss and Options navigation preserve the prompt/remaining time but invalidate ranking. Switching between Practice and Challenge ends the previous activity. Retry starts a fresh Ready state. Reload returns to Practice setup.

Results include local name, counts, accuracy, best streak, rules, active time, score or Target time, completion and qualification. Solo qualifying results receive rank 1; zero-attempt, incomplete and interrupted results remain unranked. No global leaderboard, multiplayer or team behavior is included.

Schema 4 migrates schemas 0–3 on a validated copy and retains bounded Challenge rules/outcomes, including zero-attempt runs. Challenge observations and learning are isolated from Practice. Uno benchmarks additionally compare identical Challenge rules and exclude incomplete/interrupted runs. Guest remains memory-only. Existing backup validation and storage fallback remain in effect.

## Automated evidence

Node **24.21.0**, dependencies installed with `npm ci`. Tested tuNotes content build **`b660d23142bafe4b`** and tUno **`c5a1f922c78f713b`**, built from the working tree based on `3c85ae6`; see [release metadata](tunotes-stage4/release.json).

- `npm run check`: TypeScript, **84 unit tests**, both app builds and portable resource checks passed.
- `tests/tunotes-challenge.test.ts`: immutable/validated rules, count-in input gating, exact deadlines, delayed timers, feedback past expiry, last-moment Target completion, zero attempts, 24/30 = 19.2 and 25/25 = 25 scoring, Target 10/12 versus 10/13 qualification, countdown/feedback pause preservation, stale prompt/session rejection, repeated completion, rule-specific benchmarks and backup migration/rejection.
- `scripts/notes-challenge-browser-check.mjs` passed in Chromium and Firefox, for hosted and relocated cold-offline portable builds. It checks the actual Challenge segment, invalid settings, Ready/countdown, displayed score from an answer derived from the rendered staff, qualifying Timed/Target results, zero attempts, Target timeout, hidden-tab interruption, partial finish, retry and 360/768/1280 layouts. Reports: [Chromium](tunotes-stage4/notes-challenge-chromium.json), [Firefox](tunotes-stage4/notes-challenge-firefox.json).
- Chromium and Firefox regression checks: `notes-ui-browser-check.mjs`, `notes-browser-check.mjs`, `notes-stage2-browser-check.mjs`, `notes-adaptive-browser-check.mjs` and `dual-app-browser-check.mjs` passed. These cover Practice inputs/lifecycle, profiles, cross-format backups, storage failure, adaptive learning/preview, service-worker isolation and independent offline apps.
- Firefox exposed a 0.000015 px rounding difference in the existing adaptive answer-layout assertion. The check now allows less than 0.01 px drift while still checking every target; its rerun passed.
- `npm run release:check` and `git diff --check` passed. The Challenge browser check is included in both `test:browser` and `verify` for future full verification.

Developer visual review covered the [phone setup](tunotes-stage4/notes-challenge-chromium-hosted-360.png) and [desktop setup](tunotes-stage4/notes-challenge-chromium-hosted-1280.png). Rule inputs use at least 44 px height and fit without page overflow.

## Remaining acceptance

The full `npm run verify` release suite was not rerun. Physical Safari, managed Chromebook, touch-device acceptance and classroom timing/wording review remain pending. Browser emulation and developer review do not establish those approvals. Follow the release checklist before production publication.
