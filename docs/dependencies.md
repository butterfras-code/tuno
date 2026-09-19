# Dependency provenance

The current application and equal-tempered pitch calculations were written in this repository. No upstream detector, sounds, fonts, images, or other assets have been copied or bundled. The browser application has no runtime package dependencies.

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

The project source license remains undecided. `private: true` prevents accidental npm publication, and `UNLICENSED` records the current absence of a license grant; neither selects the eventual open-source license. Select that license and update this inventory before distributing adapted third-party code or assets. The current browser bundle contains only project source and generated bundler scaffolding.
