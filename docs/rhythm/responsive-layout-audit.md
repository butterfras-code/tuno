# Uno234 responsive layout audit

Audited locally in the native T3 browser, 2026-10-15. This is feature validation, not release/device acceptance.

## Write Counts workspace — October 18

Write Counts, including the Counts panel in Both, now uses one continuous horizontal system at every width. It retains 44px count targets and bounded musical glyph sizes; actual measured overflow determines whether a compact notation overview appears. This supersedes the desktop fit guarantee and phone wrapping described in the historical audit below. The shared minimum measure width still preserves consistent engraving/answer geometry and room for rest parentheses inside the count targets. Parentheses enclose the token rather than the full touch rectangle, preserving a 4px gutter between adjacent targets. The 44px targets are a prototype baseline, not completed physical-device or projector acceptance.

Notation and count targets share the passage scroll container. The overview uses the same score renderer and the main passage's horizontal proportions, with bounded miniature glyphs and projected cross-bar ties. Its viewport follows the exact visible fraction. Pointer tap/drag, arrow keys, Page Up/Down and Home/End navigate without changing answers. The overview has a slider label and a spoken visible-range value; decorative notation is excluded from assistive navigation.

Selection, keyboard navigation and entry reveal counts locally without scrolling the page. Following reserves room for the next actual count, bounded to avoid excessive movement across sparse gaps. Repeated selection does not scroll again. Resizing keeps the focused count visible; manual scrolling otherwise stays under user control. Motion is immediate and does not introduce smooth animations, including with reduced motion enabled.

The palette, Check and Clear remain outside the scrolling music. The header contains the mode selector; Level, Customize and New exercise are in a collapsed Exercise settings disclosure below the interaction area. Pending-settings/current-exercise text remains visible, and Treat Bag follows the workspace. Responses, evaluation, settings lifecycle and the three response modes are unchanged.

Tap Rhythms and the Perform panel retain their existing fitting/wrapping behavior. Performance following and a playhead are deferred; this slice does not change the audio clock, capture or assessment.

`counting-plan-browser-scenarios.js` now asserts continuous writing at all widths instead of phone wrapping. `writing-workspace-browser-scenarios.js`, included in `npm run test:counts:browser`, covers readable targets, conditional overview, projection, keyboard navigation, local selection following, retained scroll/answers across mode changes, deletion, pending settings and stationary actions. No scoring assertions were relaxed.

### First-slice validation

Node 24.21.0, `npm ci`, `npm run check` (442 tests, TypeScript and builds), and `git diff --check` passed. Final TypeScript/build checks also passed after the pointer-coordinate and viewport-restoration refinements.

`npm run test:counts:browser` passed in Chromium and Firefox at 320, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920 and 2560px: 1,466 scenario assertions per engine, plus native pointer tap/drag, reduced-motion navigation, keyboard entry and fresh-document checks. Generated reports/screenshots are in `dist/validation/counting-plan-{chromium,firefox}/`. Layout assertions now check that rest parentheses enclose the text inside the target; musical evaluation assertions remain unchanged. Historical performance scenario selectors now find Mode by its accessible label after its move into the header.

Native T3 inspection covered dense phone/desktop layouts, a stationary whole-note passage with four 44px count targets at 390px, and preserving a focused count while resizing to 320px without page scrolling. The native Uno-level scenario passed 46 assertions for pending configurations, current-response retention and shared modes (fresh-document Uno-level checks were not repeated there). At 390 × 844, the dense passage viewport began at y=194, palette at y=470, and Check ended at y=764. Screenshots were reviewed at 390 and 1440px. Physical touch devices, screen readers, projector legibility and full performance-capture acceptance remain untested in this slice. No integration, commit, push or publication occurred.

## Previous desktop contract (superseded for Write Counts)

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
