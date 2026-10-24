# UI refinements — 23 October 2026

Implemented on `t3/refine-practice-ui`; no deployment or branch integration.
The supplied revised audit and the task's eight decisions govern this change.

## Presentation decisions

- Check begins the compact action row immediately beneath the counting palette.
  The current Counts workspace is a continuous horizontally scrolling passage;
  a final-barline action would disappear offscreen during earlier measures.
  The palette keeps submission reachable at every score position. Erase actions
  remain secondary. Enter-to-check and correction focus behavior are retained.
- Uno234 exposes setup/input/review presentation on deliberate exercise, check,
  panel-switch and performance events. Edits after review restore input emphasis;
  first count entry does not initiate a layout transition. Changes primarily use
  backgrounds and borders. Unscored feedback is quiet; scored feedback retains
  the existing ratings and expandable detail. Input target sizes are unchanged.
- Stop and Calibrate are in a normal-flow toolbar outside the outlined pad.
  The pad says “Tap to start.” Timing and capture handlers are unchanged.
- Settings retain working preferences, next-exercise application and persistence,
  with bounded responsive columns, inline checkbox labels and a help disclosure.
  Development status labels and future-controls scaffolding are removed.
- tuNotes setup panels follow content height; the top action stays in its established
  position across setup tabs. Suite headers share the existing 1040px width token;
  active music surfaces retain independent widths.
- The complete answer map and eligibility are unchanged. Pool-derived classes
  now remove fill, border and default-key shadow from unused notes. Labels remain
  fully opaque and readable; keyboard modifier and focus treatments still work.
- The resting artwork's 218-square viewBox contains the window/bed scene at roughly
  x=7–198, y=18–200. It needs no asset cropping. Practice allocates a 220–320px
  companion region on larger screens and a 96px scene beside the staff on phones.
  Each pose shares fixed frame geometry and treat progress stays beneath it.
- The Tune/Tone/Tempo utility strip and mobile chooser implementation are untouched.

## Verification

Node 24.22.1; dependencies installed with `npm ci`.

Passed:

- `npm run check`: TypeScript, all 450 unit tests, application builds.
- `node scripts/ui-refinements-browser-check.mjs`: rendered 360×800, 390×844,
  768×1024, 1024×768, 1366×768 and 1920×1080; no page overflow; stable answer/palette
  positions; ghost styling and eligibility; lifecycle emphasis; Check proximity;
  calibration toolbar separation and settings reachability. Desktop rhythm pages
  also pass CSS enlargement at 200%.
- `node scripts/counting-corrections-browser-check.mjs`.
- `node scripts/responsive-workspace-browser-check.mjs`: responsive layouts and
  eight completed/interrupted/keyboard/retry performance scenarios, including
  independent counting results, timing evidence and next-exercise behavior.
- `node scripts/notes-input-browser-check.mjs` and
  `node scripts/notes-adaptive-browser-check.mjs`: keyboard/touch answers,
  distractor scoring, adaptive expansion, modifier highlighting and reduced motion.
- `node scripts/notes-viewport-browser-check.mjs`: practice, challenge and all
  multiplayer layouts from phones through 4K displays.
- `node scripts/notes-practice-layout-browser-check.mjs`: setup, intro, practice,
  pause, results and custom editing. One concurrent run observed a transient
  results-fit failure; the isolated final rerun passed all target sizes.
- `node scripts/browser-check.mjs`: concurrent pitch analysis, reference tone
  and metronome, shared state, mobile utilities, keyboard and responsive controls.
- `node scripts/tempo-browser-check.mjs` and `node scripts/layout-browser-check.mjs`
  (126 layout checks).
- `git diff --check`.

Browser checks used Chromium and the repository's Playwright workflow after the
collaborative preview twice returned “Preview automation snapshot timed out after
15000ms.” Physical devices, screen-reader testing and native browser-menu zoom
were not verified. CSS zoom and responsive viewport checks are not a substitute
for that final native-zoom check. No microphone hardware certification is claimed.

## Screenshot evidence

The focused browser script writes to `/tmp/tuno-ui-refinements/after` by default;
set `TUNO_UI_ARTIFACTS` to retain it elsewhere. `--before` captures a baseline.
This session retained before and after captures under `/tmp/tuno-ui-refinements`,
including Chromebook active tuNotes practice and Uno234 setup/input/review/pad
states at all six requested sizes. Other browser reports are under
`dist/validation` and are replaced by builds.
