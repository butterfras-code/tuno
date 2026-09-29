# tuNotes in-phase Stage 2 answer-entry validation

Implemented locally in the existing branch/worktree on 2026-09-27. This updates Stage 2; no publication is implied. The implementation, including the later modifier glow and arrow keycaps, is recorded in local commit `73eba41`. The archived tuNotes build `7bb676f904fff2ea` and [release.json](tunotes-input/release.json) cover the offset-layout revision before those later visual additions; they are not evidence for the current working tree or the concurrent configurator refinement.

## Tap-only follow-up (2026-09-28)

Answer controls now use direct taps/clicks with the offset layout and the hint “Tap a note to answer.” Leaving the pressed target cancels; releasing over another note cannot answer it. Keyboard input and prompt/cancellation protections remain. The earlier gesture behavior and archived checks below describe historical versions. Current browser checks verify mouse and emulated-touch drag cancellation followed by direct submission.

## Behavior and decisions

The accidental dropdown is replaced with a tonic-to-tonic octave. Sharps and flats sit a full half-key width between neighboring naturals, with matching sharp/flat positions aligned vertically. B♯, C♭, E♯ and F♭ are absent from both controls and generated pools. The tonic appears at both ends, and either copy submits the same spelling. Modified tonics stay on their alteration row; B♭ major runs from B♭ to B♭ around the natural row B–C–D–E–F–G–A. Targets outside the active exercise pool are inactive. In-key spellings are outlined. Targets rotate only when the configured key changes, and remain fixed during play. Direct clicks/taps and mouse/touch press-slide-release use the same spelling and availability model. Releasing outside an enabled target cancels; pause, prompt changes, lost pointer capture, pointer cancellation and blur clear pending gestures.

The teacher corrected the keyboard mapping during implementation: unmodified letters are always natural; hold Up + letter for sharp, Down + letter for flat, Right + letter for natural. B alone never submits B♭. Shift is not an alteration modifier. Conflicting arrows do not submit; Enter/Space submits the focused spelling. Inactive targets reject all input methods. Holding one arrow illuminates the corresponding row in themed teal: Up for sharps, Right for naturals, Down for flats. Unavailable spellings receive a muted glow. A matching arrow keycap sits to the left of each row and highlights with it. Release, conflicting arrows, pause, blur and visibility loss clear the highlights. Keycaps remain visible while the note area scrolls on narrow screens.

C♭ major is disabled for new exercises because its tonic has no target. Earlier saved Custom sources validate under their original spelling rules so imports and histories survive; setup requires an unsupported key or now-empty pool to be edited before Start. Pool fingerprints include the resulting pitch list, separating changed exercise histories.

The shared controls can animate a newly enabled spelling in place, with reduced-motion support. Stage 3 must supply the changing active pool; adaptive scheduling and piano-keyboard presentation remain unimplemented.

## Archived offset-layout checks

Node 24.21.0, `npm ci`, and `npm run check` pass: type checking, 60 unit tests, and both builds. Release artifact integrity and `git diff --check` pass.

- [Chromium input checks](tunotes-input/notes-input-chromium.json) and [Firefox input checks](tunotes-input/notes-input-firefox.json): static targets, C/B♭/G layouts, rendered half-key alignment, duplicate tonic submission, key emphasis, disabled spellings, exact keyboard spellings verified against saved observations, held-key rejection, conflicting modifiers, focused answers, mouse sliding from an inactive natural to an enabled flat, outside-release and pause cancellation, and keyboard submission invalidating a pending pointer. Adapter fixtures cover activation animation, initial-session behavior and reduced motion. Unit tests cover every selectable key's octave endpoints, excluded-spelling filtering, empty-pool rejection and legacy configuration import.
- Chromium touch emulation checks direct self-paced answer/Continue, sliding with automatic feedback, cancellation, subsequent direct tapping and duplicate-click rejection. Raw CDP touch sequences test the slide; ordinary Playwright taps test the self-paced controls separately. These are emulation checks, not physical-device evidence.
- [Chromium Practice](tunotes-input/notes-chromium.json) and [Firefox Practice](tunotes-input/notes-firefox.json): hosted offline and relocated portable use, held/stale inputs, pause/visibility handling, focus, zoom, reduced motion, results and lifecycle cleanup.
- [Chromium Stage 2](tunotes-input/notes-stage2-chromium.json) and [Firefox Stage 2](tunotes-input/notes-stage2-firefox.json): Custom configuration, key spelling, profiles, persistence, backup replacement, failure fallback and notation fixtures.

The new input check is included in `test:browser` and both browsers in `verify`. The full `npm run verify` release suite was not run for this UI update.

## Modifier glow and keycap follow-up

After the glow and keycap additions, `npm run check` passed with 60 unit tests, type checking and both builds. Chromium and Firefox input checks passed, including matching-row highlighting, muted inactive keys, keycap alignment and held/released state, conflicting modifiers, blur and pause cleanup. These were implementation-time checks before the concurrent configurator work; this documentation edit does not rerun or certify that newer work. The earlier archived JSON reports above do not contain these follow-up checks.

The [held-flat keycap illustration](tunotes-input/notes-input-chromium-flat-held.png) shows the down-arrow keycap glowing alongside the flat row, with B♭ active and the other flat spellings muted. This illustration was retained from the working-tree browser output during the later configurator work; it is visual evidence only, not an artifact of archived build `7bb676f904fff2ea`.

## Visual review and remaining acceptance

The earlier offset-layout review covered the [B♭ layout](tunotes-input/notes-input-chromium-trombone-starter.png), [C layout](tunotes-input/notes-input-chromium-keyboards-starter.png), [360px phone layout](tunotes-input/notes-input-chromium-360.png) and [desktop layout](tunotes-input/notes-input-chromium-1280.png). Answer targets measured at least 44 × 44 pixels at tested 360/768/1280 widths. The later keycap layout retains these target sizes and fixed row geometry, with internal horizontal scrolling whenever the full octave plus the left-hand keycaps exceed available width; the whole octave need not be simultaneously visible at 360px.

Physical mouse/tablet/phone use, screen-reader review, Safari/iPad and classroom trials remain pending. Current response-time summaries mix physical input methods within a session; they are not standardized keyboard-versus-touch reading-speed comparisons. Speed-based assessment remains future work.
