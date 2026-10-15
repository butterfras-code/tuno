# Uno234 responsive layout audit

Audited locally in the native T3 browser, 2026-10-15. This is feature validation, not release/device acceptance.

## Desktop contract

At 1000 CSS pixels and wider, use the available viewport width and keep all 1–4 measures on one system in Write Counts, Tap Rhythms and Both. This includes dense sixteenths and mixed triplets. Neither the document nor the passage should need horizontal scrolling. Fixture wrap hints apply only below the desktop breakpoint.

Musical glyphs have bounded size; wider bars add horizontal space rather than enlarging noteheads, stems and time signatures. The renderer retains the original event nodes, their listeners and feedback while updating geometry. Count inputs remain aligned with their events. Clear and Check stay in normal flow inside their measures.

Desktop inputs compact to the available count spacing. Parentheses enclose the token inside the compact target. This deliberately replaces the former requirement for 44px-wide targets at every width: 64 separate 44px targets cannot fit across a desktop. At 1920px, dense four-bar sixteenth inputs are approximately 22px wide with 14px count text; at 1024–1280px they are smaller, with 10px text. The keyboard and full-sized palette remain available. This is a fit guarantee, not a claim that the densest exercise is equally readable on every display.

Below 1000px, preserve 44px count targets, wrap complete bars as needed, and contain any horizontal scrolling in the passage. Measures must never become independent scroll containers.

## Problems corrected

- The app's roughly 1040px content cap wasted desktop space.
- Width-dependent scaling of an entire 800×150 SVG enlarged notation as bars grew.
- Per-measure minimum widths forced unnecessary wrapping.
- A separate dense-score rule still wrapped Tap Rhythms after the writing layout was fixed.
- Earlier changes had already removed external action gutters and uncontained passage overflow; those corrections remain.

## Browser evidence

Checked widths: **1024, 1280, 1366, 1440, 1536, 1920, 2560px**. Seven fixture families across three modes at each width: single-bar half/quarter/eighth material, cross-bar ties, 6/8 wrapped fixture, three- and four-bar mixed triplets, four dense sixteenth bars, and sixteenth rests. The resulting 147 combinations were checked for one-row placement, document/passage containment, bounded notation and nonoverlapping visible count targets. The first pass exposed 21 dense Tap-mode wrapping failures; all 21 passed after removing that rule's desktop precedence.

The counting browser scenarios additionally passed at 1024/1920px (97 assertions each), 1280px (92 assertions before adding the five explicit desktop row assertions), and 320/390px (94 assertions each). They cover input navigation, rest/duration marking, narrow wrapping, target spacing, mode switching and evaluation. These scenarios run asynchronously to allow resize geometry to settle. The existing browser runner includes the desktop widths for future regression runs.

Typechecking, all 437 unit tests, and hosted/portable builds passed. Physical touch devices, projector legibility and the standalone Chromium/Firefox suite were not exercised in this audit.

## Reproducing with T3

Run `npm run dev:walk`, open a native preview at `http://localhost:5173/prototypes/rhythm-walk/?fixture=dense-sixteenths`, and resize the viewport. Use `triplet-mixed-4` for mixed subdivisions. If a reused preview tab times out, open a fresh tab with `reuseExistingTab: false`; verify the local server is running separately. Native snapshots were needed between background scenario steps to allow rendering/resize callbacks to progress.
