# Dependency provenance

The current application and equal-tempered pitch calculations were written in this repository. No upstream detector or sounds have been copied. Local Figma artwork and fonts are bundled as described below. The browser application has no runtime package dependencies.

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

The project source license remains undecided. `private: true` prevents accidental npm publication, and `UNLICENSED` records the current absence of a license grant; neither selects the eventual open-source license. Select that license and update this inventory before distributing adapted third-party code or assets. The browser bundle contains project source, generated bundler scaffolding, and the artwork/fonts below. No new npm dependencies were added for the design implementation.

## Bundled visual assets

Imported 2026-09-19. SVG exports are retained byte-for-byte from the user-supplied [tUno Figma design](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR/?node-id=5-2):

| Local asset | Origin | Rights/provenance |
| --- | --- | --- |
| `src/assets/uno-happy.svg` | Tuner instance `5:68`, inner artwork `I5:68;4:3` | User-provided project artwork; Figma describes it as an initial vector study from Uno reference photos. No independent third-party license was supplied. |
| `src/assets/pitch-bone.svg` | Tuner marker `5:66` | User-provided project artwork; retained exact export. |
| `src/assets/fonts/nunito.ttf` | [Google Fonts Nunito source](https://github.com/google/fonts/tree/main/ofl/nunito) | Unmodified `Nunito[wght].ttf`, SIL Open Font License 1.1; notice in `nunito-OFL.txt`. |
| `src/assets/fonts/nunito-sans.ttf` | [Google Fonts Nunito Sans source](https://github.com/google/fonts/tree/main/ofl/nunitosans) | Unmodified `NunitoSans[YTLC,opsz,wdth,wght].ttf`, SIL Open Font License 1.1; notice in `nunito-sans-OFL.txt`. |

Font filenames were simplified locally; font data and internal names were not modified. Both complete font notices are included in both built artifacts via the Font licenses footer. Asset requests never depend on expiring Figma links or a font CDN at runtime. Confirm the eventual project artwork license before an open-source release.
