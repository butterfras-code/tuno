# Uno234 responsive layout audit

Audited locally in the native T3 browser, 2026-10-15. This is feature validation, not release/device acceptance.

## Write Counts workspace — October 18

Counts and Perform use one continuous horizontal system at every width. Counts retains 44px count targets and bounded musical glyph sizes; actual measured overflow determines whether a compact notation overview appears in either panel. Perform uses a 280px minimum measure width when written counts are hidden, instead of stacking measures above the input pad. Showing written counts restores the shared count spacing. Panel switches retain independent scroll positions, and capture keeps the same continuous layout. This supersedes the desktop fit guarantee and phone wrapping described in the historical audit below. The shared minimum measure width still preserves consistent engraving/answer geometry and room for rest parentheses inside the count targets. Parentheses enclose the token rather than the full touch rectangle, preserving a 4px gutter between adjacent targets. The 44px targets are a prototype baseline, not completed physical-device or projector acceptance.

Notation and count targets share the passage scroll container. The overview uses the same score renderer and the main passage's horizontal proportions, with bounded miniature glyphs and projected cross-bar ties. Its viewport follows the exact visible fraction. Pointer tap/drag, arrow keys, Page Up/Down and Home/End navigate without changing answers. The overview has a slider label and a spoken visible-range value; decorative notation is excluded from assistive navigation.

Selection, keyboard navigation and entry reveal counts locally without scrolling the page. Following reserves room for the next actual count, bounded to avoid excessive movement across sparse gaps. Repeated selection does not scroll again. Resizing keeps the focused count visible; manual scrolling otherwise stays under user control. Motion is immediate and does not introduce smooth animations, including with reduced motion enabled.

The palette, Check and Clear remain outside the scrolling music. The global header keeps navigation and Help on one row. Mode sits beside the practice interaction controls. Level and Treat Bag share a row above the music; Customize, level requirements and New exercise remain in Exercise settings below. Level is explicitly labeled for the next exercise, and the current/pending exercise summary remains visible. Responses, evaluation, settings lifecycle and the three response modes are unchanged.

Tap Rhythms and the Perform panel retain their existing fitting/wrapping behavior. Performance following and a playhead are deferred; this slice does not change the audio clock, capture or assessment.

`counting-plan-browser-scenarios.js` now asserts continuous writing at all widths instead of phone wrapping. `writing-workspace-browser-scenarios.js`, included in `npm run test:counts:browser`, covers readable targets, conditional overview, projection, keyboard navigation, local selection following, retained scroll/answers across mode changes, deletion, pending settings and stationary actions. No scoring assertions were relaxed.

### Responsive refinement

The same Treat Bag component now exposes all four existing dimensions at every width: Rhythm, Holding notes, Tempo and Steady beat. Mobile shows short labels, one bone icon and the earned count; desktop retains full labels and five bone graphics per rated dimension. A dash means unscored, not zero. Tap displays an unscored Hold dimension with “Not assessed in Tap”; rewards and assessment policy still omit hold scoring for Tap. Feedback expands in normal flow with the retained musical summary and assessment values. Detailed performance review and timing evidence remain available in the performance panel. Expansion state survives reward refreshes.

On screens up to 768px wide, the existing counting interaction surface can stick to the bottom inside its practice workspace. It reserves normal-flow space and includes safe-area padding. A measured guard prevents it from moving above the score or mode controls. When the initial reading area and controls fit, the workspace reserves a viewport-sized area for bottom docking. That decision uses document coordinates to stay stable while scrolling. Expanded feedback, short screens and reduced visual viewport height fall back to normal flow without an artificial gap. Desktop keeps a compact natural-flow palette. Keyboard hints remain on desktop and in Help; the mobile palette keeps the active measure/beat context.

Perform now follows the audio clock horizontally when notation overflows. Count-in and retry return to the beginning; during playback the current musical position stays one-third across the viewport where scroll limits allow, leaving room to read ahead. Position advances steadily across each rendered measure using its derived musical duration, including rests and ties. Barline spacing is spread across the measure instead of rushing through the gap during its final short note. Pad input does not alter the scroll path or speed. The overview follows the visible range; completion or interruption stops following. The pad and page remain stationary during playback. It does not alter capture, scoring mathematics, calibration or reward thresholds.

Run `node scripts/responsive-workspace-browser-check.mjs` after `npm run build` for the 320/390/768/1024/1440px layout, feedback, short-height and performance-retention scenarios, plus default and expanded-feedback screenshots. `TUNO_BROWSER=firefox` selects Firefox. Run `npm run test:counts:browser` for the existing counting, minimap and sharing regression checks.

Refinement validation: Node 24.21.0 and `npm run check` passed (442 tests, TypeScript and portable builds). Chromium and Firefox passed the five requested widths using dense sixteenths, dotted quarters, cross-bar ties, rests and mixed triplets, including 420/568/844px viewport heights. Browser capture scenarios cover completed Tap + Hold, keyboard Tap, silent attempts, cancellation, retry, reward retention and Next Exercise. Screenshots use actual assessment results from synthetic timestamped input, not fabricated ratings. Native T3 checks also confirmed that unsupported level requirements open their enclosing Exercise settings and that the performance-only checkbox is absent from count entry. Physical-device safe areas, real touch/audio latency and screen-reader acceptance remain unverified.

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
