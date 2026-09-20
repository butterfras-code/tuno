# tUno

Free, local-first music practice tools for students and teachers.

tUno aims to make a dependable tuner, metronome, and reference tones available without purchases or accounts, including offline use. The name honors Uno, the founder's departed dog. The capital **U** will be drawn as a tuning fork; the accessible text name remains **tUno**.

tUno will ship as a hosted, downloadable app and, in parallel, a self-contained offline HTML file. Both releases share the same core practice tools.

The app provides a responsive tuner, reference-note keyboard, and metronome with shared session state. Microphone capture, live pitch detection, reference-tone playback, tap tempo, meter, subdivisions, accents, and click volume/sound work. Hosted builds prepare their essential resources for offline use and verify readiness. Hosted installation controls and a matching offline download are included. Animated Uno rewards and physical-device acceptance checks remain ahead.

## Project documents

- [Hosting setup](docs/hosting.md): Cloudflare Pages, tuno.cc, automatic production deployments, and the feature-branch/PR workflow.
- [Release validation](docs/release-validation.md): candidate thresholds, automated results, and remaining device checks.
- [Release instructions](docs/releasing.md): verification, artifacts, and deployment handoff.
- [Project charter](docs/charter.md): why tUno exists, who it serves, and the principles that guide scope.
- [Distribution architecture](docs/architecture.md): the hosted app and portable HTML releases, their shared core, and offline guarantees.
- [Prototype plan](docs/prototype-plan.md): what to build first and how to decide whether it works well enough.
- [Approved design direction](docs/design-summary.md): identity, corrected pitch colors, and interaction decisions.
- [Figma design handoff](docs/design-handoff.md): reviewed screens, visual tokens, interaction contracts, and first-slice integration.

Read these in order. Keep commitments in the charter, distribution decisions in the architecture, and implementation milestones and validation results in the prototype plan. Add architecture decisions as implementation establishes them, rather than documenting an imagined finished system.

Copyright © 2026 Justin Butterfras. tUno’s code, documentation, and original artwork are licensed under the [GNU General Public License, version 3 only](LICENSE.txt) (`GPL-3.0-only`), without warranty. You may redistribute and modify them under those terms. Bundled fonts retain SIL Open Font License 1.1; design-reference photographs retain their existing rights and are not covered by this grant. See [dependency provenance](docs/dependencies.md) for scope and third-party notices. Both app formats include the complete GPLv3 text and a source-code link in About.

## Development

Use Node.js 24 (also recorded in `.nvmrc`).

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Source changes rebuild automatically; refresh the page to see them. Open **Explore a sample pitch** in the tuner to enter a frequency. **Settings** adjusts A4 calibration, written pitch, and Uno visibility. Focus buttons switch views without clearing selections. On mobile, Tune/Tone/Tempo tabs share one control card. Preferences are saved in browser storage when available; clearing site data removes them. Reloading never starts the microphone or audio. Use **Start listening** for microphone input, hold a piano key to play it when sustain is off, and use **Stop all audio** to release capture and stop output. Start the metronome from any view; in 6/8, BPM counts dotted quarters and **3 per beat** adds eighth-note pulses. Tempo, meter, and subdivision changes take effect at the next unscheduled beat.

```sh
npm run check
npx playwright install chromium firefox
npm run verify
```

`check` runs TypeScript checking, Node's built-in unit tests, and the production build with portable-resource checks. `test:browser` rebuilds and exercises the hosted page and a relocated portable file in Chromium, including offline loading without subresource requests. It also checks hosted offline reopening, update deferral across tabs, failed/incomplete cache preparation, synthetic audio coexistence, scheduler interruption, and rendered click timing. `verify` additionally runs Firefox, rendered reference-tone/CPU measurements, HTTPS/download/install checks, and release integrity checks; it writes reports into `dist/validation/`. These checks do not establish physical-device or microphone support.

## Build outputs

`npm run build` generates both formats from `src/main.ts`:

- `dist/hosted/`: serve this directory over HTTPS for deployment; the first visit requires connectivity. Wait for **Offline ready** before closing and reopening without networking. Updates activate after all existing tUno tabs close; they never replace an active practice session.
- `dist/portable/tuno.html`: open this single file directly in a browser, including offline. It contains the same JavaScript and CSS as the hosted build.

The header **Install** button explains offline use and offers **Download offline HTML**, plus **Install tUno** when the browser offers installation. Footer dialogs contain About, a tribute to Uno, Support with a Ko-fi link, and Privacy information. Both formats display the same build identifier. `dist/release.json` records checksums and source revision; see the release instructions before distribution.

Build outputs are ignored by Git. The build script owns and replaces `dist/`; stop the development server before running a production build or browser checks. Its ES2022 output target is a tooling choice, not a minimum-browser support claim.

Musical calculations live in `src/music/pitch.ts`; `src/main.ts` mounts the application. The build pipeline is in `scripts/build.mjs`. There are no runtime dependencies or remote assets. See [dependency provenance](docs/dependencies.md) before adding upstream code or assets.

## UI structure

- `src/tokens.css`: global Figma colors, typography, spacing, and radii; `src/styles.css` defines shared controls and responsive layouts.
- `src/practice/state.ts`: one application-owned store, typed actions, validation limits, tool/meter definitions, and derived pitch/frequency values. Views do not own duplicate practice state.
- `src/ui/components.ts`: shared semantic DOM controls, labels, artwork, and pitch formatting. `src/ui/app.ts` owns the header, focus navigation, tool strip, footer, and settings and information dialogs.
- `src/ui/views/`: focused presentations mounted once and updated in place. Editing a control preserves DOM focus; switching views preserves session values.
- `src/assets/`: Figma-derived SVG artwork and local font files/notices. The build embeds these assets as data URLs in both distributions and includes complete font notices in the About dialog.

`src/audio/controller.ts` owns microphone, reference tone, and metronome resources. `src/music/rhythm.ts` defines beat/subdivision timing and tap tempo; `src/audio/click.ts` synthesizes click envelopes. `src/distribution/` handles hosted caching and readiness, with no portable-file worker dependency.

Keep audio resources outside the view modules. Extend shared actions and selectors so focused views and compact tool controls stay synchronized. Keep musical rules independent of the DOM. Add global tokens or shared components for recurring patterns; leave view-specific composition in its view module.

Browser checks cover state persistence, settings Save/Cancel, invalid input, keyboard focus, all views at 1120/768/390/320px, reduced-motion preference, and asset decoding in both builds. For review screenshots, run `TUNO_SCREENSHOT_DIR=/tmp/tuno-review npm run test:browser`.

## Offline behavior and timing

Both artifacts carry the same content-derived version in HTML metadata. Production builds emit `sw.js` with versioned, scope-specific caches and integrity checks for HTML, JavaScript, and CSS. All fonts/artwork are already embedded. Readiness requires the controlling worker to confirm every essential file for the current version; missing files are repaired online only if their integrity matches. A failed install discards its cache. Browser storage eviction or policy can remove offline resources later. Development builds disable worker registration to avoid caching edits.

The metronome schedules 150 ms ahead on a 25 ms timer. Visual beat identity follows the audio output timeline. Long foreground stalls stop metronome playback with explicit restart. Hiding the page pauses capture and all output; start a tool explicitly after returning. Background continuity is not supported. Uno currently uses static directional beat cues, with numbered/current-beat text available; tail animation remains a visual follow-up. Microphone input can hear reference tones and clicks through speakers.
