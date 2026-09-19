# tUno

Free, local-first music practice tools for students and teachers.

tUno aims to make a dependable tuner, metronome, and reference tones available without purchases or accounts, including offline use. The name honors Uno, the founder's departed dog. The capital **U** will be drawn as a tuning fork; the accessible text name remains **tUno**.

tUno will ship as a hosted, downloadable app and, in parallel, a self-contained offline HTML file. Both releases share the same core practice tools.

The app now implements the Figma visual foundation: a responsive tuner, reference-note keyboard, and metronome preview with shared controls and session state. Manual pitch input, calibration, transposition, note/octave selection, volume/sustain settings, and tempo/meter previews work. Microphone capture, audio playback, animated rewards, and hosted offline caching remain ahead.

## Project documents

- [Project charter](docs/charter.md): why tUno exists, who it serves, and the principles that guide scope.
- [Distribution architecture](docs/architecture.md): the hosted app and portable HTML releases, their shared core, and offline guarantees.
- [Prototype plan](docs/prototype-plan.md): what to build first and how to decide whether it works well enough.
- [Figma design handoff](docs/design-handoff.md): reviewed screens, visual tokens, interaction contracts, and first-slice integration.

Read these in order. Keep commitments in the charter, distribution decisions in the architecture, and implementation milestones and validation results in the prototype plan. Add architecture decisions as implementation establishes them, rather than documenting an imagined finished system.

Open-source distribution is intended; the project source license remains undecided. Bundled artwork/font provenance and font licenses are recorded in [dependency provenance](docs/dependencies.md).

## Development

Use Node.js 24 (also recorded in `.nvmrc`).

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Source changes rebuild automatically; refresh the page to see them. Open **Explore a sample pitch** in the tuner to enter a frequency. **Settings** adjusts A4 calibration, written pitch, and Uno visibility. Focus buttons switch views without clearing selections. Audio transport is visibly unavailable in this design pass.

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

Musical calculations live in `src/music/pitch.ts`; `src/main.ts` mounts the application. The build pipeline is in `scripts/build.mjs`. There are no runtime dependencies or remote assets. See [dependency provenance](docs/dependencies.md) before adding upstream code or assets.

## UI structure

- `src/tokens.css`: global Figma colors, typography, spacing, and radii; `src/styles.css` defines shared controls and responsive layouts.
- `src/practice/state.ts`: one application-owned store, typed actions, validation limits, tool/meter definitions, and derived pitch/frequency values. Views do not own duplicate practice state.
- `src/ui/components.ts`: shared semantic DOM controls, labels, artwork, and pitch formatting. `src/ui/app.ts` owns the header, focus navigation, tool strip, footer, and one settings dialog.
- `src/ui/views/`: focused presentations mounted once and updated in place. Editing a control preserves DOM focus; switching views preserves session values.
- `src/assets/`: exact Figma SVG exports and local font files/notices. The build embeds these assets as data URLs in both distributions and includes the font notices in a collapsible footer.

Keep audio resources outside the view modules when adding playback. Extend shared actions and selectors so focused views and compact tool controls stay synchronized. Keep musical rules independent of the DOM. Add global tokens or shared components for recurring patterns; leave view-specific composition in its view module.

Browser checks cover state persistence, settings Save/Cancel, invalid input, keyboard focus, all views at 1120/768/390/320px, reduced-motion preference, and asset decoding in both builds. For review screenshots, run `TUNO_SCREENSHOT_DIR=/tmp/tuno-review npm run test:browser`.
