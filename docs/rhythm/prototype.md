# Count Writing editable-measure prototype

Implemented 2026-10-10 for teacher review; this is not a full release or finalized grading contract.

The [generated practice slice](practice-loop.md) now extends this prototype with 1–4 measures (default 2), active ingredients, targeted feedback and Check / Retry / Next. The remaining sections record earlier review stages.

Current interaction update: available count positions are adaptive, while duration lines can extend through hidden subdivisions. Rest parentheses now use one complete group per written rest, entered with a ghost opening and teal closing targets. Half-rest and adjacent-quarter-rest fixtures are included; long rests require a duration line. These behaviors supersede the original uniform-grid and individual-parentheses descriptions below.

## Review entry point

Use Node 24, `npm ci`, then `npm run dev:counts`. Open `http://127.0.0.1:5173/prototypes/count-writing/`. The same review-only path is built for the `dev` Cloudflare preview. It has no app navigation placement, manifest, worker, portable download, or saved progress. The path and title do not settle final routing or naming. Do not publish it to `main` without authorization.

## Settings page — 2026-10-10

The [settings page](settings.md) at `#settings` inventories configurable areas from the handoff. Exercise selection and the dotted-quarter convention work now; future controls are disabled with availability explanations. Switching between Settings and Count Writing preserves the current answer. This updates the implementation sequence: review the configurable surface before further editor refinement or generation work.

## Implemented boundary

All four specified 4/4 fixtures render with original SVG rhythm glyphs on a conventional one-line rhythm staff: hollow half notes, solid quarter/eighth notes, dots, quarter rests, stems, paired-eighth beams, and an isolated eighth flag. Eight fixed positions are shared by the notation and count controls, including empty subdivisions. This deliberately reveals a uniform subdivision grid, not which counts are required. The editor is for student answers; the fixture score itself is fixed.

Physical keyboard and contextual symbol popover support entry and replacement; Backspace/Delete erase counts. The permanent keypad and instructional/editing panel have been removed. Left/right, Tab/Shift+Tab and Home/End move between available positions; Tab exits the count row at its ends; `(` begins a rest group and `)` closes it. Rest markings can be toggled even when the count is empty. Check preserves every symbol, span and marking. Editing after Check leaves the previous result visible with an explicit stale-feedback message. The first available input receives focus on load. Enter evaluates without a placement or native-control context. Reset clears the answer and returns focus to the first position; fixture switching clears the answer and focuses the first available input; choosing a fixture in Settings focuses that input on return to the editor.

Duration lines use two taps (start action, then an end position), draggable snapping endpoints, arrow/Home/End endpoint keys, and labeled start/end selects. Visible Shorten/Lengthen buttons change the ending position one grid step at a time. Set end lets a student tap a new ending position in the measure. These work on touch without dragging. Endpoint dots are larger, with 44px hit targets. Lines can be removed independently. Internal counts covered by a line become smaller and raised; the onset stays full-size; the line is below them. The score and count grid scroll together at narrow widths; keyboard navigation scrolls the focused position into view. Focus indicators, semantic labels, state announcements and text verdicts accompany color feedback.

## Shared model migration — 2026-10-10

The prototype now consumes the [canonical written-event model](music-model.md). Its four fixtures are flat value/modifier sequences in `src/apps/count-writing/fixtures.ts`; starts and durations are derived. `countGrid` isolates the reviewed eighth-spaced 4/4 answer policy from musical time, and unsupported model features are rejected at that adapter. The earlier eighth-tick implementation described in the audit below has been superseded. Count entry, provisional convention controls and visible fixture scope remain the same.

Migration validation: Node 24.21.0 and `npm ci`; `npm run check` passed with 118 tests and the hosted/portable build checks. Existing Count Writing browser regression checks passed in Chromium and Firefox, covering all four fixtures, independent feedback, keyboard/touch entry, line controls and narrow viewport layouts. The T3 local preview could not navigate to the environment server; no successful interactive T3 review is claimed for this migration. Physical-device checks and full release verification remain outstanding.

## Original audit and architecture

- Existing `src/apps/tunotes/ui/staff.ts` supplies the precedent for project-owned SVG notation without remote assets or a runtime notation package. Its single-pitch/clef geometry is not suitable for timed rhythm layout, so the small rhythm renderer is separate.
- Shared UI controls, Nunito fonts, color tokens and the existing Uno SVG are reused. No new mascot art or notation dependency was introduced.
- `src/music/rhythm.ts` is an audio-clock pulse scheduler. Symbolic event positions do not belong there. `src/music/measure.ts` defines contiguous eighth-note ticks, written values/dots, note/rest kind and meter independently of input, grading and rendering. The four fixtures have starts/durations `[0,4,6,7]/[4,2,1,1]`, `[0,3,4]/[3,1,4]`, `[0,2,4,5,6]/[2,2,1,1,2]`, and `[0,6]/[6,2]`.
- `evaluation.ts` owns the student-answer model and replaceable review policy. The renderer and DOM editor do not supply expected answers. There is no auto-fill or answer-reveal action.
- Distribution was audited before adding a separate build helper. Existing app identities, portable packaging, workers and cache resources are unaffected. The prototype is an unlisted hosted review artifact, not a third installable app.

## Provisional review conventions

Open alphabet: `1 2 3 4 & e a`, with `&` selected as the offbeat convention. The active counting-system setting chooses `&` or `+`; both keyboard keys enter the selected symbol. Answers retain canonical offbeat tokens so switching display conventions preserves grading. The grid has only eighth-note resolution; `e` and `a` remain available in open entry and can be judged incorrect at these positions. Every onset and internal actual beat requires its ordinary number/offbeat symbol. Other valid offbeat entries receive teacher-review status pending agreement about optional subdivisions.

The owner selected **teacher-dependent** for the dotted-quarter internal `&` on 2026-10-10. A fixture-specific review selector offers required, optional, and review-both conventions. Until a teacher selects a convention, both presence and absence receive teacher-review status; neither is definitively wrong. Incorrect symbols at that position can still be identified independently of whether entry is required.

Teacher review confirmed that duration lines start at the note onset, including `1` for a note beginning on beat 1. The current trial ending position remains the last subdivision before the next event (half note: positions 0–3; dotted quarter: 0–2; final half: 4–7; dotted half: 0–5; positions are zero-based). Matching these endpoints means “Matches trial convention,” not final musical approval. Other ending positions within the same sustained note receive teacher-review status; a line starting after the onset needs correction. Missing/extra lines, multiple lines assigned to one note, lines on unsustained notes, and lines crossing the next onset need correction. Teacher review still needs to settle the ending position and exact visual appearance.

Rest parentheses enclose individual positions. The required rest position is assessed independently of its count symbol, so a missing count does not silently erase a missing-parentheses error. The quarter-rest fixture tests only one required count; grouped parentheses for longer rests remain undecided and outside this chunk.

## Validation evidence

The original prototype evidence below refers to the earlier `dev` preview. The feature-branch follow-up passed `npm run check` with 108 tests and the updated Chromium/Firefox browser checks, including onset anchoring, full-size onset counts, touch Shorten/Lengthen/Set end, and 320/375/768px line-editing layouts. Physical-device checks remain unperformed. The updated code stays on `t3code/rhythm-game-handoff`; `dev` and `main` were not advanced. Both browsers also passed against [the exact feature preview for `51a57ac`](https://f8110a13.tuno-864.pages.dev/prototypes/count-writing/). The earlier `dev` preview does not contain this follow-up.

Node 24.21.0; dependencies installed with `npm ci`. `npm run check` passed (107 tests, including nine new tests covering exact fixture positions/durations, unchanged answers after evaluation, correct/incorrect dimensions, provisional variants and rest/count independence). `git diff --check` passed. Chromium and Firefox browser checks passed for all four fixtures, independent correction feedback, answer preservation, teacher-required/optional dotted-quarter rules, keyboard replacement/deletion/navigation, synthetic touch keypad and line taps, mouse dragging, endpoint keyboard/select editing, reset and cancellation. Chromium also passed synthetic touch endpoint dragging. At 320/375/768 CSS pixels the notation and slots remain aligned, the page does not overflow, keyboard focus scrolls into view, and Home restores the time signature. Nonoverlapping lines share a baseline. Screenshots and machine-readable reports are generated under `dist/validation/count-writing-{chromium,firefox}/` by `npm run test:counts:browser` (set `TUNO_BROWSER=firefox` for Firefox); normal builds replace this directory. Set `COUNT_WRITING_URL` to check an exact HTTPS preview.

The T3 collaborative browser was tried first. HTTPS page navigation/evaluation worked, but local navigation, interaction, snapshot capture and recording repeatedly failed/timed out; the user explicitly chose repository Playwright checks and screenshots as the fallback. No T3 capture is claimed. The exact `dev` deployment for commit `3f9a840` passed the Count Writing checks in both Chromium and Firefox: [review the prototype](https://0c92d84e.tuno-864.pages.dev/prototypes/count-writing/). Cloudflare reported deployment success. Local site-routing and dual-app worker/offline/portable-isolation checks passed in both browsers; `npm run release:check` passed. The source tree intentionally still contains unrelated uncommitted README/dependency planning edits, so local distribution metadata retains its dirty flag. The imported handoff is byte-for-byte unchanged (SHA-256 `020131e7d0b7a5102045af3d29b8d8eca0486c643e367d806c53a35e668080c5`).

This prototype is not a distributable release candidate: full `npm run verify` and physical-device acceptance have not been performed. Physical phone/tablet touch, managed Chromebook keyboard, Safari and classroom projection remain untested. Automated viewport/pointer checks cannot establish physical-device behavior.

## Next bounded chunk

Teacher-review these four measures first. Choose the teacher convention and agree on other valid optional counts, duration-line endpoints/raised appearance and parentheses grouping; turn the agreed variants into policy tests. Then implement a bounded generator for these reviewed 4/4 values with setup and check/correct/next flow. Keep guided filtering, adaptive progression, UIL presets, saved progress, journey mechanics and Rhythm Walk timed input outside that chunk until explicitly scoped.
