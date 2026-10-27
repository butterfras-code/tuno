# Activity sharing validation

Validated locally on 2026-10-27 with Node 24.22.1 and dependencies installed using `npm ci`.

`npm run check` passed type checking, all 471 unit tests, and hosted/portable builds. The sharing unit tests cover all built-in ranges, custom range portability, generic multiplayer slots, exact written-score capture, pending settings, malformed and oversized input, bounded decompression, version-one compatibility fixtures, isolated preferences, and explicit save actions.

The new `scripts/activity-sharing-browser-check.mjs` passed in Chromium and Firefox. It covers actual guided-chooser output; fresh recipient contexts; all three tUno tools; Practice, Challenge, and custom note ranges; all multiplayer formats; Counts/Perform; sharing during play and from results; Options/Settings context; pending counting settings; local profile progress; reload/navigation behavior; blocked storage; keyboard activation; simulated clipboard success and failure; invalid-link recovery; and narrow layouts. Generated screenshots are under `dist/validation/activity-sharing-{chromium,firefox}/` and are replaced by builds.

Existing Chromium regression checks passed:

- `node scripts/suite-browser-check.mjs`
- `node scripts/notes-configurator-browser-check.mjs`
- `node scripts/notes-multiplayer-browser-check.mjs`
- `node scripts/counting-plan-browser-check.mjs`

`git diff --check` and relative-link checks for the sharing documentation passed. The [format contract](../activity-sharing-format.md) records the wire format, limits, app-specific persistence behavior, and measured payload corpus. The sharing browser check is included in both `npm run test:browser` and `npm run verify`.

Actual LMS platforms, real operating-system share sheets/clipboard permissions, physical touch devices, and assistive technology remain release checks. Full `npm run verify` was not run for this feature validation. No production deployment is part of these results.
