# Screenshot capture

The dedicated showcase suite builds tUno once, hosts that build locally, and uses
one Chromium process with isolated contexts to capture named activity states.
It does not require a running development server, microphone, account, or network
service. Use the Node 24 version in `.nvmrc` (minimum 24.22.1).

```sh
npm ci
npx playwright install chromium
npm run screenshots -- --replace
```

The resulting `screenshots/latest.zip` contains viewport-sized PNGs organized by
profile, an `index.html` gallery, and `manifest.json` with the source revision,
build ID, dirty status, browser version, viewport dimensions, and scenario names.
Extract the ZIP and open `index.html` to browse the images. Captures use 1× pixel
density, so classroom PNGs are exactly 1920×1080 pixels. The directory is ignored
by Git and survives rebuilds, which replace `dist/`.

## Archive choices

- `--replace`: replace `latest.zip` only after every selected capture succeeds.
  Existing timestamped ZIPs remain untouched. A failed run preserves the previous
  ZIP and removes its temporary screenshots.
- `--new`: create a timestamped ZIP with a unique suffix, preserving earlier ZIPs.
- Neither flag: ask "Replace latest.zip or create a new ZIP?" in an interactive
  terminal. Empty input chooses new. Noninteractive runs also choose new.
- `npm run screenshots:replace`: convenience alias for `--replace`.
- `--output /path/to/folder`: choose another archive directory. Replacement is
  scoped to that directory's `latest.zip`.

The flags `--replace` and `--new` cannot be combined. Only one capture command may
use an output directory at a time. Failed runs clean up automatically. A killed
or interrupted process can leave temporary files; confirm it has stopped before removing that directory's
`.capture.lock` and any `.capture-*` temporary folders.

## Coverage and fast reruns

By default the suite uses every profile from
[`viewport-profiles.mjs`](../scripts/viewport-profiles.mjs), plus a 1440×900
desktop profile. That includes classroom 1920×1080, Chromebook 1366×650, phone
390×844, provisional Fold8 cover 400×650, the smaller/stress profiles, landscape
844×390, tablet, and provisional Fold8 inner screen. These are CSS viewport
fixtures, not hardware resolution or physical device certification.

```sh
npm run screenshots -- --list
npm run screenshots -- --only trumpet,violin --new
npm run screenshots -- --only notes --profiles primary,desktop --replace
npm run screenshots -- --only configurator --profiles phone,desktop --new
npm run screenshots -- --no-build --profiles classroom --new
```

`--only` accepts comma-separated scenario IDs shown by `--list`, or groups
`notes`, `uno234`, `fingering`, and `configurator`. `--profiles` accepts profile
IDs, `primary` (the four repo targets), or `all`. Filters intersect; incompatible
combinations produce no captures and an error. `--jobs` selects 1–8 concurrent
captures (default 2). `--no-build` reuses the existing `dist/` candidate; its
manifest describes that build, which may differ from current source changes.
Stop a development server before building, as with other repo browser workflows.

Scenarios cover:

- Tuner with synthetic A4 input, metronome at 100 BPM, and reference-tone keyboard.
- tuNotes active single-player practice, Pass and Play, Side by Side, and Head
  to Head. Multiplayer freezes just after the countdown so notation and inputs
  appear together consistently. Where the app recommends Pass and Play on small
  screens, that warning remains visible and is recorded in the manifest.
- Trumpet on the landscape phone profile, with input on the right and valves
  **1, 2, 3 bottom to top**.
- Violin on portrait touch profiles, with input keys visible and fingers
  **1, 2, 3, 4 top to bottom**.
- Uno234 Counts with an entered answer, its ready-to-play Perform panel with
  written counts enabled, and
  Settings; tuNotes Options/settings.
- tuNotes preset chooser, custom range, and key/spelling/clef controls; Uno234
  Uno’s Choice, UIL, and Custom configurator views.

The default matrix currently produces 229 PNGs. Orientation-specific fingering
examples only run on matching profiles. Every other scenario runs at every
selected size. The suite verifies finger order, key visibility, page overflow,
and uncaught page errors. It drives existing UI controls and never changes app
styles to make a screenshot fit. Long settings/configurator pages show the
viewport rather than being stretched into a full-page image; the separate
configurator detail scenario scrolls its controls into view.

Each capture starts with fresh storage and a seeded random generator for stable
examples. Offline preparation completes and fonts load before capture; reduced motion and hidden carets limit
transient effects. The tuner receives a synthetic 440 Hz Web Audio stream through
the same fixture technique as the browser checks. No real microphone is accessed
and no audio is sent to speakers. Screenshot
generation is separate from application acceptance: continue to run the checks
and physical reviews required by the [responsive standard](responsive-design.md)
and [release instructions](releasing.md).

To add a capture, extend
[`screenshot-scenarios.mjs`](../scripts/screenshot-scenarios.mjs) with an ID,
title, route, and async setup function. Reuse the existing activity setup helpers
and optionally provide a `matches(profile)` predicate for orientation-specific
examples. Viewport profiles remain owned by the shared module.
