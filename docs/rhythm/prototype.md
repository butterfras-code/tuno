# Count Writing editable-measure prototype

Implemented 2026-10-10 for teacher review; this is not a full release or finalized grading contract.

## Review entry point

Use Node 24, `npm ci`, then `npm run dev:counts`. Open `http://127.0.0.1:5173/prototypes/count-writing/`. The same review-only path is built for the `dev` Cloudflare preview. It has no app navigation placement, manifest, worker, portable download, or saved progress. The path and title do not settle final routing or naming. Do not publish it to `main` without authorization.

## Implemented boundary

All four specified 4/4 fixtures render with original SVG rhythm glyphs on a conventional one-line rhythm staff: hollow half notes, solid quarter/eighth notes, dots, quarter rests, stems, paired-eighth beams, and an isolated eighth flag. Eight fixed positions are shared by the notation and count controls, including empty subdivisions. This deliberately reveals a uniform subdivision grid, not which counts are required. The editor is for student answers; the fixture score itself is fixed.

Physical keyboard and symbol keypad support entry, replacement and erasure. Left/right and Home/End move between positions; Tab reaches all controls; parentheses toggle with `(` or `)`. Rest markings can be toggled even when the count is empty. Check preserves every symbol, span and marking. Editing after Check leaves the previous result visible with an explicit stale-feedback message. Reset clears the answer and returns focus to the first position; fixture switching clears the answer and keeps focus on the selector.

Duration lines use two taps (start action, then an end position), draggable snapping endpoints, arrow/Home/End endpoint keys, and labeled start/end selects. Lines can be removed independently. Counts covered by a line become smaller and raised; the line is below them. The score and count grid scroll together at narrow widths; keyboard navigation scrolls the focused position into view. Focus indicators, semantic labels, state announcements and text verdicts accompany color feedback.

## Audit and architecture

- Existing `src/apps/tunotes/ui/staff.ts` supplies the precedent for project-owned SVG notation without remote assets or a runtime notation package. Its single-pitch/clef geometry is not suitable for timed rhythm layout, so the small rhythm renderer is separate.
- Shared UI controls, Nunito fonts, color tokens and the existing Uno SVG are reused. No new mascot art or notation dependency was introduced.
- `src/music/rhythm.ts` is an audio-clock pulse scheduler. Symbolic event positions do not belong there. `src/music/measure.ts` defines contiguous eighth-note ticks, written values/dots, note/rest kind and meter independently of input, grading and rendering. The four fixtures have starts/durations `[0,4,6,7]/[4,2,1,1]`, `[0,3,4]/[3,1,4]`, `[0,2,4,5,6]/[2,2,1,1,2]`, and `[0,6]/[6,2]`.
- `evaluation.ts` owns the student-answer model and replaceable review policy. The renderer and DOM editor do not supply expected answers. There is no auto-fill or answer-reveal action.
- Distribution was audited before adding a separate build helper. Existing app identities, portable packaging, workers and cache resources are unaffected. The prototype is an unlisted hosted review artifact, not a third installable app.

## Provisional review conventions

Open alphabet: `1 2 3 4 & e a`, with `&` selected as the offbeat convention. `+` is not silently equated with it. The grid has only eighth-note resolution; `e` and `a` remain available in open entry and can be judged incorrect at these positions. Every onset and internal actual beat requires its ordinary number/offbeat symbol. Other valid offbeat entries receive teacher-review status pending agreement about optional subdivisions.

The owner selected **teacher-dependent** for the dotted-quarter internal `&` on 2026-10-10. A fixture-specific review selector offers required, optional, and review-both conventions. Until a teacher selects a convention, both presence and absence receive teacher-review status; neither is definitively wrong. Incorrect symbols at that position can still be identified independently of whether entry is required.

The trial duration line begins at the first internal eighth-note position and ends at the last subdivision before the next event (half note: positions 1–3; dotted quarter: 1–2; final half: 5–7; dotted half: 1–5; positions are zero-based). Matching these endpoints means “Matches trial convention,” not final musical approval. Other endpoints within the same sustained note receive teacher-review status. Missing/extra lines, multiple lines assigned to one note, lines on unsustained notes, and lines crossing the next onset need correction. Teacher review must settle whether the line should instead cover only entered internal counts and the exact visual anchors.

Rest parentheses enclose individual positions. The required rest position is assessed independently of its count symbol, so a missing count does not silently erase a missing-parentheses error. The quarter-rest fixture tests only one required count; grouped parentheses for longer rests remain undecided and outside this chunk.

## Validation evidence

Node 24.21.0; dependencies installed with `npm ci`. `npm run check` passed (106 tests, including eight new tests covering exact fixture positions/durations, unchanged answers after evaluation, correct/incorrect dimensions, provisional variants and rest/count independence). Browser evidence will be recorded after review of the staged build. `git diff --check` is required before completion.

This prototype is not a distributable release candidate: full `npm run verify` and physical-device acceptance have not been performed. Physical phone/tablet touch, managed Chromebook keyboard, Safari and classroom projection remain untested. Automated viewport/pointer checks cannot establish physical-device behavior.

## Next bounded chunk

Teacher-review these four measures first. Choose the teacher convention and agree on other valid optional counts, duration-line endpoints/raised appearance and parentheses grouping; turn the agreed variants into policy tests. Then implement a bounded generator for these reviewed 4/4 values with setup and check/correct/next flow. Keep guided filtering, adaptive progression, UIL presets, saved progress, journey mechanics and Rhythm Walk timed input outside that chunk until explicitly scoped.
