# Responsive design standard

All UI work targets four primary contexts: classroom display, student Chromebook,
standard phone, and Galaxy Z Fold8 cover screen. The executable source of viewport
sizes is [viewport-profiles.mjs](../scripts/viewport-profiles.mjs). Sizes are CSS
viewport pixels (available browser content), not hardware resolution or promises
of device emulation. These are test targets, not required CSS breakpoints; use
fluid layout and content-driven breakpoints between them.

## Target profiles

- Classroom: 1920 × 1080; secondary 1280 × 720. Prioritize large notation and
  unmistakable pitch/beat feedback. Review readability from the back of the room.
- Chromebook: 1366 × 650; secondary 1280 × 600. Allow for browser chrome and
  school display scaling. Exercise and primary response controls should be usable
  together without repeated scrolling. All actions must work with a keyboard.
- Phone: 390 × 844; secondary 360 × 640. Prioritize readable music, touch input,
  reachable dialogs, and usable space when browser controls or the keyboard appear.
- Galaxy Z Fold8 cover: **provisional** 400 × 650; short stress case 400 × 550.
  These are chosen layout fixtures, not measured Fold8 specifications. The inner
  screen is a secondary, also provisional 768 × 800 fixture.

Retain 320 × 568 narrow, 844 × 390 landscape, and 768 × 1024 tablet coverage.
Do not remove existing scenario-specific regression sizes when adopting profiles.

## Acceptance criteria

For every affected screen, check setup, active exercise/input, feedback/results,
and relevant menus/dialogs at all four primary profiles and applicable secondary
profiles. Screens must adapt between targets as well as at their exact sizes.

- No accidental page-wide horizontal scrolling, overlapping controls, clipped
  labels, or unreachable actions. Intentional notation/piano scrolling stays in
  its own region and must keep the selected item reachable.
- Dialogs fit the viewport; long contents scroll internally and their close/action
  controls remain reachable. Ordinary page scrolling is allowed.
- Preserve the existing 48px control-height design guidance for primary touch
  controls. Keep visible keyboard focus and equivalent keyboard actions; do not
  depend on hover. See [design handoff](design-handoff.md).
- Keep exercise and primary response controls visible together where feasible;
  short screens must not require repeatedly scrolling between stimulus and input.
  Do not shrink notation or text until it becomes unreadable to force a fit.
- Check 200% browser zoom, enlarged text, reduced motion, and landscape. CSS zoom
  and narrow viewport tests supplement, but do not replace, real browser zoom.
- Resizing, rotating, folding, and unfolding preserve exercise identity, answers,
  settings, and feedback. Input controls remain usable. Honor existing safe audio
  interruption behavior; never introduce automatic playback to restore a session.
- Classroom review checks notation, pitch/beat cues, contrast, and text at actual
  viewing distance. A large screenshot alone cannot establish readability.

## Automated checks

Run `npm run test:responsive` for a build and cross-app viewport smoke check.
Use `TUNO_BROWSER=firefox npm run test:responsive` for Firefox. Both engines run
this check as part of `npm run verify`; `npm run test:browser` includes it too.
To check an existing candidate without rebuilding, run
`node scripts/viewport-browser-check.mjs` (optionally with `TUNO_BROWSER=firefox`).

The smoke check imports the shared profiles, visits the launcher and all five
public tool routes, checks page overflow and common information-dialog containment,
and saves viewport screenshots plus a JSON report under
`dist/validation/viewports-<engine>/`. It does not certify all activity states,
focus styling, touch accuracy, real zoom, or hardware support. Use the existing
activity-specific browser checks and visual review for those acceptance criteria.
New or updated activity checks should import `primaryViewports` or
`viewportProfiles` instead of copying the standard's dimensions.

Review the screenshots for affected screens and record failures honestly. Builds
replace `dist/`; retain candidate evidence before rebuilding.

## Physical review and Fold8 calibration

Before release, record the candidate revision/build, device, OS, browser/version,
browser versus installed mode, display/text scaling, viewport, scenarios, and
pass/fail/untested result. Check a real managed Chromebook, phone, the owner's
Galaxy Z Fold8, and the actual classroom display. Existing microphone, offline,
installation, and other release checks still apply.

On the Fold8, measure the cover and inner screens at normal display/text settings
in the browser used for tUno. Through browser remote debugging, capture:

```js
({
  width: window.innerWidth,
  height: window.innerHeight,
  devicePixelRatio: window.devicePixelRatio,
  visualViewport: window.visualViewport && {
    width: window.visualViewport.width,
    height: window.visualViewport.height,
    scale: window.visualViewport.scale,
  },
})
```

Record browser controls expanded/collapsed and keyboard-open behavior separately.
Replace the provisional cover and inner dimensions in the shared module and this
document with measured defaults, retaining the short-height stress fixture.
Do not mark the profiles measured until those observations are available.

With an exercise in progress, enter an answer and change a setting, then unfold
and fold without reloading. Confirm exercise, answer, settings, and feedback are
retained and controls remain reachable. Repeat with a dialog open and with audio
active; record any browser interruption and verify safe recovery. Automated
viewport resizing cannot establish physical folding or audio behavior.
