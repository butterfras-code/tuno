# tuNotes Phase 3 validation

Implemented locally on `t3code/create-note-reading-game`, 2026-09-27. No commit, push, merge or deployment is part of this work. The requested branch was fetched, checked out and fast-forward pulled before reading its plans; both involved worktrees were clean. The existing branch was already checked out in another worktree, so this worktree uses Git's explicit same-branch checkout override. That other worktree was not edited.

## Implemented behavior

- Per-player optional adaptation (off by default), profile/configuration/adaptive fingerprints, algorithm version 1, schema 3 migration, isolated benchmarks, bounded ten-outcome pitch histories and existing 128-context/100-result/5 MiB storage limits. Guest learning and preview preferences remain memory-only.
- Error/unseen weighting, no adjacent duplicate pitch when alternatives exist, ten-prompt focus blocks after sufficient evidence, protected every-fifth review and deterministic confusion-pair selection. The final prompt of a focus block still prohibits expansion.
- At least 20 answers since start/expansion, at least 90% on the latest 20, and five most recent correct outcomes on **every** active pitch before adding a position. Latency is observational only. Finite lower/upper/one-sided clef growth; Custom never grows beyond its configured pool. Adaptive-off retains the original pool and shuffled bag.
- The user replaced unapproved instrument envelopes with 1 / 1.5 / 2 octave options and explicitly authorized Starter/smaller options to grow toward the two-octave bounds. All 11 instruments have those levels, preserving their keys and spelling policies. Exact written intervals, including flats, are tested. This resolves the instrument-bound decision; it is not a claim of beginner suitability or engraving acceptance.
- Expansion announcements and existing spelling-button activation animation, preserving the answer layout and keyboard mappings. Session recommendations use session miss totals and never modify settings.
- Optional “Meet your notes”: active starting/restored pool, low-to-high labeled notation, accidental/octave/clef identity, groups of up to four on one full-size staff with internal scrolling on phones, animated ball/streamers and Uno catch, Start/Replay/Skip, silent static reduced motion and per-player preferences. Practice construction waits for explicit Start/Skip. Exposure flags belong to results; old results retain unknown exposure.

## Automated evidence

Node **24.21.0**, dependencies installed with `npm ci`. Final Phase 3 browser evidence uses tuNotes content build **`b5ac9e347a1d73d4`**, Chromium **153.0.8010.12** and Firefox **155.0**, built from the uncommitted working tree based on `e127d6d`.

- `npm run check`: TypeScript, **74 deterministic tests**, dual-app build and portable resource checks passed.
- `tests/tunotes-adaptive.test.ts`: bounded histories/weights, slow and fast mastery equivalence, repeated-error focus/recovery, protected review under contrasts, all-pitch and 20-answer gates, final-focus-prompt exclusion, deterministic lower/upper growth to finite bounds, one-sided levels, singleton/Custom/adaptive-off safety, all instrument intervals, profile/benchmark isolation, expanded backup round-trip, incompatible algorithm reset, schema migration, preview order/grouping and recommendations.
- Chromium and Firefox: `scripts/notes-adaptive-browser-check.mjs` passed hosted and moved/renamed cold-offline portable flows. Covers completion/catch, Replay/Skip, no automatic play, keyboard isolation, no learning during preview, elapsed-time exclusion, exposure metadata, restored adaptive pools, original adaptive-off pools, expansion announcements, in-place new spelling activation, reduced motion, modified labels, profile preferences, Guest reload behavior, confirmed deletion resetting Guest preferences, 360/768/1280 layouts and 200% CSS zoom.
- Existing Practice, Stage 2 storage/backup, fixed-answer input and graphical-configurator browser suites passed in Chromium and Firefox. Their direct-play tests now explicitly disable the optional preview. The input suite also verifies that adding octaves of already enabled spellings creates no new activation animation. They retain keyboard/held-key, pointer/touch emulation, disabled-target, layout, offline, backup, storage-failure and cleanup coverage. Stage 2 storage suites were rerun after schema 3 was introduced.
- `git diff --check` passed. Browser JSON/screenshot artifacts are generated in `dist/validation/notes-adaptive-{chromium,firefox}*`; each JSON records its app content build ID and browser version. Screenshots received developer inspection, not teacher sign-off.

The new browser suite is included in both `test:browser` and `verify`. This task ran relevant suites, not the complete release-candidate `npm run verify` matrix. No physical-device acceptance is claimed.

## Outstanding acceptance

- Teacher review of preview pacing (950 ms/note, 600 ms catch), default beginner classification, grouping/legibility across clefs and keys, and classroom use of the approved instrument ranges. The new range definitions are authorized; their pedagogical suitability is not established by interval tests.
- A classroom trial to evaluate the documented 70%/90% thresholds, five-correct mastery rule, weighting, focus size and confusion-contrast behavior. No speed gate should be added as an incidental tuning change.
- Physical Chromebook/laptop keyboards, iPad/tablet touch and layout, iPhone/Android workflows, actual Safari/WebKit, screen readers and classroom projection. Browser emulation and screenshots do not replace this evidence. Reuse the release acceptance matrix in [releasing](../releasing.md).
- Challenge, multiplayer and Flow remain later phases. This is an Adaptive Practice preview, not the complete first release.

## Full-size staff correction (2026-09-27)

User review replaced the separate note cards with one full-size animated staff. The ball travels between notes on that staff; labels remain beneath revealed notes. Groups change in place, split at clef changes, and can be reviewed with Previous/Next after completion. Narrow screens scroll the full-size notation internally. Uno catches the toy from its last staff position. Start/Replay/Skip, reduced motion, preference persistence and measurement isolation are preserved.

Validated on the uncommitted working tree based on `a2cf1c7`, content build `cb4db1d2dae4ae77`: Node 24.21.0, `npm run check` (74 tests), an additional typecheck/test run after strengthening mixed-clef grouping assertions, and the Phase 3 browser suite in Chromium 153.0.8010.12 and Firefox 155.0 passed. Browser checks now require exactly one preview staff, no figure cards, and complete ordered labels across review groups, including restored ranges. Hosted and cold-offline portable flows, reduced motion, timing isolation, 360/768/1280 layouts and 200% zoom remain covered. Desktop/phone screenshots received developer inspection. Teacher pacing and physical-device acceptance remain outstanding.
