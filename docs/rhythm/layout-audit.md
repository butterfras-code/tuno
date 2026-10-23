# Uno234 layout audit

Audited 2026-10-11 on `f24346c`, after pulling `origin/t3code/rhythm-game-handoff`. The activity is now named Uno234; Rhythm Walk is reserved for an eventual continuous gameplay mode. The original measurements predate the rename. Goal: align Uno234 with the existing tUno and tuNotes visual language and practice hierarchy.

## Scope and evidence

Built all three apps locally with Node 24.21.0, `npm ci`, and `npm run build`. Compared `/tune/`, `/notes/`, and `/prototypes/rhythm-walk/` using the T3 collaborative browser and source styles. Measured same-origin frames at 1536, 1280, 768, 390, and 320 CSS pixels wide, all 844px high. Uno234 used the generated two-measure 4/4 exercise. Generated notation varies; coordinates are approximate measurements of the sampled exercise, not fixed acceptance values.

A desktop tUno screenshot was captured. Subsequent native resize calls timed out, although the requested mobile viewport took effect. Screenshot capture then failed across retries and a new tab. The comparison below therefore relies on browser element geometry and computed styles; there is no complete desktop/mobile screenshot set. Frames exercise actual responsive CSS, not physical mobile devices. Active audio recording and completed-attempt review were not exercised in this audit.

## Measured practice entry layout

The table reports the top edge of each app's main practice surface, measured from the document top. Uno234's first notation begins another 13–25px below its card edge in Write Counts mode.

| Frame width | tUno surface top | tuNotes surface top | Uno234 surface top | Uno234 Check row top |
| --- | ---: | ---: | ---: | ---: |
| 1536px | 113px | 91px | 539px | 1037px |
| 1280px | 113px | 91px | 539px | 1013px |
| 768px | 176px | 163px | 536px | 1322px |
| 390px | 138px | 118px | 633px | 1275px |
| 320px | 138px | 129px | 657px | 1294px |

No document horizontal overflow appeared in these comparisons or in follow-up checks of Write Counts, Tap Rhythms, Both, and Settings at 1280, 390, and 320px. Uno234's newer responsive systems already solve horizontal score scrolling. Vertical hierarchy is the larger remaining problem.

## Findings and recommended changes

1. **High priority: consolidate the header and navigation.** tUno and tuNotes have a plum wordmark, short muted tagline, and tinted navigation in a compact header. Uno234 uses an eyebrow, dark heading, subtitle, static mascot, and a separate navigation row. Its desktop header alone is approximately 115px high, versus 47–56px in the other apps, before adding the navigation. Use a stable Uno234 wordmark and short tagline; move the page-specific heading into the activity surface. Match the compact navigation treatment, with a full-width segmented row on mobile. Keep response mode selection distinct from page navigation, and preserve the shared exercise when switching modes.

2. **High priority: reduce setup overhead and clarify the primary action.** Uno234 places a bordered Mode/preset card, separate Next exercise row, separate exercise summary, instruction banner, and (in Both) a written-count checkbox above the passage. The shared-controls region alone is about 228px high on desktop and 307px on mobile. Combine mode selection, preset access, exercise summary, and Next into a compact toolbar at the top of one practice surface. Keep one short counting hint near the score; move extended explanations into help. tUno puts its operating controls inside the practice surface, while tuNotes uses a compact setup toolbar with a clear Start action.

3. **High priority: keep the score and its actions together.** In Write Counts, Check/Reset follow the entire passage, wrapping control, explanatory copy, and an extra section heading. In Tap Rhythms, the pad precedes the Start/Stop controls, tempo and metronome settings, instructions, and prototype notes. Both is especially long. Group the primary action and concise status close to the score/pad, using a compact toolbar and secondary options. Move detailed evidence and guidance below the working area or into disclosures. Preserve the reserved count-in row and stable notation/pad positions during performance. Evaluate four-measure exercises separately; matching tuNotes' fixed-height play surface blindly could clip count editing or the pad.

4. **Medium priority: bound setup width consistently.** Uno234 practice expands to 1920px while Settings returns to a 940px shell. Switching pages changes the alignment of the brand, navigation, and shared controls. tUno uses a 1040px content region; tuNotes uses a 1040px outer shell with a 992px inner surface. Use the shared content-width convention for header and setup, and keep their alignment stable across pages. A wider performance area may be useful, but should be deliberate and independent of header width. Recheck system breaks when changing the score width: Uno234 currently switches to two columns at a 680px score container and four at 1360px.

5. **Medium priority: use the established control and surface styling.** Uno234 inherits white bordered controls, 12px control corners, and body-font button text from Count Writing. tUno and tuNotes use tinted controls, Nunito heading-font button text, plum selected states, and the shared 16px control radius. Uno234's primary Check already uses the correct accent family, and all apps share the palette and bundled fonts. Apply scoped shared styling to shell controls; keep notation inputs and duration/rest editing affordances specialized. Use one broad practice surface rather than multiple equally prominent outlined cards. Match mobile density without shrinking interaction targets further.

6. **Medium priority: move prototype and settings inventory copy out of the practice path.** Settings retains the full Mode/preset/Next setup block above the settings content and a large inventory of planned controls. Practice repeats persistence and pending-setting explanations, and performance includes technical latency/provisional-evidence prose. Keep a compact explanation of when settings apply, show actionable errors where they occur, and place detailed technical/teacher material in help or documentation. Organize implemented settings around common exercise options, writing, and performance; keep planned work out of the normal learner flow.

7. **Lower priority: align footer and companion placement.** Uno234 ends practice with a paragraph explaining preferences, rather than the quiet footer pattern in the other apps. Its static mascot is in the header; tUno and tuNotes place Uno in the practice scene. Use a concise footer treatment and place any companion beside the activity where space allows. Installation/offline functionality is a separate product decision; this audit does not imply that Uno234 already supports it.

## Suggested implementation order

First align the shell, navigation, controls, and page widths. Then consolidate setup into the practice surface and move secondary guidance into help. Finally refine the score/action layout in each mode, with desktop and mobile comparison screenshots once browser capture is available.

Acceptance should include all three response modes and Settings at 1536, 1280, 768, 390, and 320px, plus one- through four-measure passages and 6/8. Require stable header alignment between pages, zero horizontal overflow, legible counts, reachable primary actions, retained responses through mode/settings changes, and stationary score/pad positions through count-in and recording. Run `npm run check` and the relevant rhythm browser scenarios after implementation.

## Source anchors

- [Shared design tokens](../../src/tokens.css)
- [tUno shell](../../src/ui/app.ts) and [styles](../../src/styles.css)
- [tuNotes shell](../../src/apps/tunotes/main.ts), [styles](../../src/apps/tunotes/styles.css), and [play-surface behavior](../../src/apps/tunotes/ui/play-surface.ts)
- [Uno234 shell](../../src/apps/rhythm-walk/main.ts), [styles](../../src/apps/rhythm-walk/styles.css), and [performance controls](../../src/apps/rhythm-walk/performance.ts)
- [Inherited Count Writing styles](../../src/apps/count-writing/styles.css)

This is an audit, with no application layout changes. Local documentation edits were preserved and reconciled with remote updates during the pull. Nothing was committed, pushed, integrated into dev, or published.
