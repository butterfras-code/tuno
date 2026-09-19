# tUno

Free, local-first music practice tools for students and teachers.

tUno aims to make a dependable tuner, metronome, and reference tones available without purchases or accounts, including offline use. The name honors Uno, the founder's departed dog. The capital **U** will be drawn as a tuning fork; the accessible text name remains **tUno**.

tUno will ship as a hosted, downloadable app and, in parallel, a self-contained offline HTML file. Both releases share the same core practice tools.

This repository contains the first implementation foundation: a basic pitch explorer, tested musical calculations, and hosted/portable builds. Microphone listening, reference-tone playback, metronome, and hosted offline caching are not implemented yet.

## Project documents

- [Project charter](docs/charter.md): why tUno exists, who it serves, and the principles that guide scope.
- [Distribution architecture](docs/architecture.md): the hosted app and portable HTML releases, their shared core, and offline guarantees.
- [Prototype plan](docs/prototype-plan.md): what to build first and how to decide whether it works well enough.
- [Figma design handoff](docs/design-handoff.md): reviewed screens, visual tokens, interaction contracts, and first-slice integration.

Read these in order. Keep commitments in the charter, distribution decisions in the architecture, and implementation milestones and validation results in the prototype plan. Add architecture decisions as implementation establishes them, rather than documenting an imagined finished system.

Open-source distribution is intended. A project license and attribution inventory still need to be established before importing and distributing upstream code or assets.

## Development

Use Node.js 24 (also recorded in `.nvmrc`).

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Source changes rebuild automatically; refresh the page to see them. The temporary pitch explorer accepts a manually entered frequency, A4 calibration, and written-pitch transposition. It does not request microphone access or play audio.

```sh
npm run check
npx playwright install chromium
npm run test:browser
```

`check` runs TypeScript checking, Node's built-in unit tests, and the production build with portable-resource checks. `test:browser` rebuilds and exercises the hosted page and a relocated portable file in Chromium, including offline loading without subresource requests. These checks do not establish physical-device or microphone support.

## Build outputs

`npm run build` generates both formats from `src/main.ts`:

- `dist/hosted/`: serve this directory over HTTPS for deployment; it currently requires connectivity and has no service worker.
- `dist/portable/tuno.html`: open this single file directly in a browser, including offline. It contains the same JavaScript and CSS as the hosted build.

Build outputs are ignored by Git. The build script owns and replaces `dist/`; stop the development server before running a production build or browser checks. Its ES2022 output target is a tooling choice, not a minimum-browser support claim.

Musical calculations live in `src/music/pitch.ts`; `src/main.ts` connects the temporary controls. The build pipeline is in `scripts/build.mjs`. There are no runtime dependencies or remote assets. See [dependency provenance](docs/dependencies.md) before adding upstream code or assets.
