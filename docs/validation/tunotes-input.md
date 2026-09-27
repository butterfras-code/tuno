# tuNotes in-phase Stage 2 answer-entry validation

Implemented locally in the existing branch/worktree on 2026-09-27. This updates Stage 2; no publication is implied. tuNotes build `7bb676f904fff2ea`; build metadata is retained in [release.json](tunotes-input/release.json).

## Behavior and decisions

The accidental dropdown is replaced with a tonic-to-tonic octave. Sharps and flats sit a full half-key width between neighboring naturals, with matching sharp/flat positions aligned vertically. B♯, C♭, E♯ and F♭ are absent from both controls and generated pools. The tonic appears at both ends, and either copy submits the same spelling. Modified tonics stay on their alteration row; B♭ major runs from B♭ to B♭ around the natural row B–C–D–E–F–G–A. Targets outside the active exercise pool are inactive. In-key spellings are outlined. Targets rotate only when the configured key changes, and remain fixed during play. Direct clicks/taps and mouse/touch press-slide-release use the same spelling and availability model. Releasing outside an enabled target cancels; pause, prompt changes, lost pointer capture, pointer cancellation and blur clear pending gestures.

The teacher corrected the keyboard mapping during implementation: unmodified letters are always natural; hold Up + letter for sharp, Down + letter for flat, Right + letter for natural. B alone never submits B♭. Shift is not an alteration modifier. Conflicting arrows do not submit; Enter/Space submits the focused spelling. Inactive targets reject all input methods.

C♭ major is disabled for new exercises because its tonic has no target. Earlier saved Custom sources validate under their original spelling rules so imports and histories survive; setup requires an unsupported key or now-empty pool to be edited before Start. Pool fingerprints include the resulting pitch list, separating changed exercise histories.

The shared controls can animate a newly enabled spelling in place, with reduced-motion support. Stage 3 must supply the changing active pool; adaptive scheduling and piano-keyboard presentation remain unimplemented.

## Automated checks

Node 24.21.0, `npm ci`, and `npm run check` pass: type checking, 60 unit tests, and both builds. Release artifact integrity and `git diff --check` pass.

- [Chromium input checks](tunotes-input/notes-input-chromium.json) and [Firefox input checks](tunotes-input/notes-input-firefox.json): static targets, C/B♭/G layouts, rendered half-key alignment, duplicate tonic submission, key emphasis, disabled spellings, exact keyboard spellings verified against saved observations, held-key rejection, conflicting modifiers, focused answers, mouse sliding from an inactive natural to an enabled flat, outside-release and pause cancellation, and keyboard submission invalidating a pending pointer. Adapter fixtures cover activation animation, initial-session behavior and reduced motion. Unit tests cover every selectable key's octave endpoints, excluded-spelling filtering, empty-pool rejection and legacy configuration import.
- Chromium touch emulation checks direct self-paced answer/Continue, sliding with automatic feedback, cancellation, subsequent direct tapping and duplicate-click rejection. Raw CDP touch sequences test the slide; ordinary Playwright taps test the self-paced controls separately. These are emulation checks, not physical-device evidence.
- [Chromium Practice](tunotes-input/notes-chromium.json) and [Firefox Practice](tunotes-input/notes-firefox.json): hosted offline and relocated portable use, held/stale inputs, pause/visibility handling, focus, zoom, reduced motion, results and lifecycle cleanup.
- [Chromium Stage 2](tunotes-input/notes-stage2-chromium.json) and [Firefox Stage 2](tunotes-input/notes-stage2-firefox.json): Custom configuration, key spelling, profiles, persistence, backup replacement, failure fallback and notation fixtures.

The new input check is included in `test:browser` and both browsers in `verify`. The full `npm run verify` release suite was not run for this UI update.

## Visual review and remaining acceptance

Reviewed the [B♭ layout](tunotes-input/notes-input-chromium-trombone-starter.png), [C layout](tunotes-input/notes-input-chromium-keyboards-starter.png), [360px phone layout](tunotes-input/notes-input-chromium-360.png) and [desktop layout](tunotes-input/notes-input-chromium-1280.png). All answer targets measure at least 44 × 44 pixels at tested 360/768/1280 widths; narrower viewports retain fixed geometry with internal horizontal scrolling.

Physical mouse/tablet/phone use, screen-reader review, Safari/iPad and classroom trials remain pending. Current response-time summaries mix physical input methods within a session; they are not standardized keyboard-versus-touch reading-speed comparisons. Speed-based assessment remains future work.
