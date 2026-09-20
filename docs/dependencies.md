# Dependency provenance

The current application and equal-tempered pitch calculations were written in this repository. The detector and signal fixtures now adapt code from the user-owned pitch-tracker repository. Local Figma artwork and fonts are bundled as described below. The browser application has no runtime package dependencies.

Development dependencies are pinned in `package.json`; exact transitive versions and registry integrity hashes are recorded in `package-lock.json`. The initial inventory below uses the installed package manifests.

| Package | Version | License | Use |
| --- | --- | --- | --- |
| TypeScript | 7.0.2 | Apache-2.0 | Static type checking |
| esbuild | 0.28.2 | MIT | Bundling and local development server |
| @types/node | 24.13.6 | MIT | Types for the Node test runner |
| Playwright | 1.63.0 | Apache-2.0 | Automated browser checks |
| playwright-core | 1.63.0 | Apache-2.0 | Transitive browser automation implementation |
| undici-types | 7.18.2 | MIT | Transitive Node type definitions |

Platform-specific tool binaries are development tooling as well. Browser binaries downloaded for Playwright are test infrastructure and are not shipped in either app artifact. Retain upstream licenses if redistributing tools or their binaries.

The project code, documentation, and original artwork are licensed under GNU GPL version 3 only (`GPL-3.0-only`); see [the full license](../LICENSE.txt). Copyright © 2026 Justin Butterfras. `private: true` continues to prevent accidental npm publication. Bundled fonts retain their SIL Open Font License 1.1 terms; development dependencies retain the licenses listed above. Design-reference photographs retain their existing rights and are excluded from the project license grant. The browser bundle contains project source, generated bundler scaffolding, and the artwork/fonts below. No new npm dependencies were added for the design implementation.

## Bundled visual assets

Imported 2026-09-19 from the user-supplied [tUno Figma design](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR/?node-id=5-2). Exports retain their original geometry except for the coordinate adaptation and issue #15 refinements documented below:

| Local asset | Origin | Rights/provenance |
| --- | --- | --- |
| `src/assets/uno-happy.svg` | Shared component `4:2`, inner artwork `4:3` | User-provided project artwork; the current 320px tail path is scaled into the existing 300px animation canvas. Figma describes it as an initial vector study from Uno reference photos. Covered by the project’s GPLv3 grant. |
| `src/assets/pitch-bone.svg` | Tuner marker `5:66` | User-provided project artwork; retained exact export. |
| `src/assets/tempo-drag-hint.svg` | Metronome gesture hint `45:401` | User-provided project artwork; retained exact vector geometry for the visible hold/drag affordance. |
| `src/assets/fonts/nunito.ttf` | [Google Fonts Nunito source](https://github.com/google/fonts/tree/main/ofl/nunito) | Unmodified `Nunito[wght].ttf`, SIL Open Font License 1.1; notice in `nunito-OFL.txt`. |
| `src/assets/fonts/nunito-sans.ttf` | [Google Fonts Nunito Sans source](https://github.com/google/fonts/tree/main/ofl/nunitosans) | Unmodified `NunitoSans[YTLC,opsz,wdth,wght].ttf`, SIL Open Font License 1.1; notice in `nunito-sans-OFL.txt`. |

Font filenames were simplified locally; font data and internal names were not modified. Both complete font notices are included in both built artifacts via Font licenses in the About dialog. Asset requests never depend on expiring Figma links or a font CDN at runtime. Original project artwork is covered by the project’s GPLv3 grant.

## Pitch-tracker reuse — 2026-09-19

Source: local sibling `pitch-tracker`, revision `75214e7452f286fa50ac317ed06f5c552025275e`, reused at the owner's explicit request.

- `src/audio/detector.ts` adapts `src/domain/pitch.ts` YIN detection and Butterworth filtering. It returns separate frequency, RMS, and YIN quality evidence, extends the candidate range to 1,760 Hz, and includes the upper-boundary period candidate. Quality is a periodicity measure, not a calibrated probability.
- `tests/fixtures/pitch-signal.ts` retains the deterministic upstream fixture generator. Regression cases cover clean and overtone-rich signals, silence, noise, and low amplitude.
- `src/audio/controller.ts` adapts microphone cancellation generations, capture constraints, disconnected-track cleanup, and gain-ramp patterns from `src/audio/microphone.ts`. The controller is rewritten around tUno's store; teacher scoring and DOM dependencies are excluded. Microphone and tone have independent cancellation.

No license file was found in the source checkout. The owner authorized this reuse and subsequently selected GPLv3 for tUno, including these project adaptations; this does not relicense the separate upstream checkout. No runtime dependencies were added.

## Installation assets — 2026-09-19

`src/assets/icons/app-icon.svg` wraps the existing approved Uno vector in the warm canvas color with padding. Its paths retain the original artwork; it is an installation icon, not a replacement wordmark or new character design. The committed 192px and 512px PNGs were rasterized with `rsvg-convert -w SIZE -h SIZE -o src/assets/icons/icon-SIZE.png src/assets/icons/app-icon.svg`. Builds copy these files without requiring a rasterizer or adding dependencies. Artwork rights remain as described above.

The manifest and install-event behavior follow [MDN's installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable). The optional prompt depends on browser support; native OS installation remains a manual verification item.

## Uno animation assets — 2026-09-19

Additional SVG exports from the same user-owned Figma file:

| Asset | Figma node |
| --- | --- |
| `src/assets/uno-rest.svg` | Rest artwork `7:141` |
| `src/assets/uno-beg.svg` | Raised-paw artwork `7:193` |
| `src/assets/uno-head-left.svg` | Left-facing head `32:478` |

`src/ui/uno.ts` assembles the existing happy-sit paths into independent body, head and tail groups, uses the exported beg paws and left head, and reuses the existing bone for the reward. The current Figma tail is coordinate-scaled into the retained 300px happy-sit canvas; the beg and left-head exports remain unchanged. Issue #15 refines the rest window and adds a closed eye plus moon/stars for the microphone-off scene. The volume slider bone (`src/assets/volume-bone.svg`) has also been redrawn for a cleaner small-size silhouette. All artwork is embedded in both builds, with no runtime Figma requests or added packages. Rights/provenance are unchanged from the bundled visual assets above.
