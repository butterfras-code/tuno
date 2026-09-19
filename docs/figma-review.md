# Figma implementation review

Compared the supplied 18-page **tUno — Practice with a friend** PDF against screenshots of the running app at the original 1120×820 desktop and 390×844 mobile frame sizes. Each comparison below shows the PDF on the left and live code on the right. No screenshot pixels were repositioned or masked.

| View | Desktop | Mobile |
| --- | --- | --- |
| Tune | [Comparison](figma-review/1120-tune-comparison.png) | [Comparison](figma-review/390-tune-comparison.png) |
| Tone | [Comparison](figma-review/1120-tone-comparison.png) | [Comparison](figma-review/390-tone-comparison.png) |
| Tempo / Uno | [Comparison](figma-review/1120-tempo-comparison.png) | [Comparison](figma-review/390-tempo-comparison.png) |
| Tempo / Numbers | [Comparison](figma-review/1120-numbers-comparison.png) | [Comparison](figma-review/390-numbers-comparison.png) |

## Changes

- Replaced the outdated rest-pose collar with the exact current Figma export. The tap control uses the exported Uno head SVG; microphone, play, stop and volume-bone assets also come directly from Figma.
- Restored mobile Tinker navigation and the always-visible Uno/Numbers switch. The switch works, including a single numbered free pulse.
- Rebuilt Tempo around separate layout tracks for the number, drag hint, and dog. Start, subdivision, sound and volume controls follow in normal flow. Three-digit tempos fit.
- Numbered beats toggle audible accents, independent of the current-beat highlight. Free pulse has no accents. Subdivisions 1–7 work.
- The lower accuracy, note, octave and subdivision controls open real anchored, scrolling menus. Volume controls open a working bone-thumb slider. Note/octave changes preserve the current focus view. Browsing an octave does not retune an already sounding note.
- Removed the deprecated standalone mobile pickers. Restored the desktop Tone geometry and extended the mobile keyboard so the next octave remains available while scrolling.
- Fixed tablet tuner overflow and clipped quick-tempo values. Kept sample input, downloads, font notices and stop-all access under Tinker → More practice tools.

No dummy controls were added.

## Deliberate differences and remaining limits

The mobile PDF places the tool strip at y=602 while the practice surface ends at y=622. That overlaps the volume control on Tempo and the output controls on Tone. The app places the strip at y=630: after the complete surface with an 8px gap. This is the largest deliberate layout deviation; the source Figma mobile frames should be extended accordingly.

The screenshots exercise the actual audio pipeline with a synthetic B-flat input. Pitch readouts, hold progress, microphone state, and reduced-motion beat feedback remain live. The PDF's example frequency/cents, shared volume values, and transport states are not always internally consistent; the app keeps these values consistent instead of hardcoding the examples. Native Meter/Sound/main Subdivision menus use the browser's picker; the lower shared selectors use the specified scrolling popovers.

[Raw comparison measurements](figma-review/results.json) count pixels with more than 5% difference in any color channel. Desktop frames differ by 3.33–4.69%; mobile frames by 18.52–22.91%, predominantly because the entire lower tool strip moves and live state differs. These are unmasked full-frame measurements, **not a pixel-perfect pass claim**. Inspect the images to distinguish layout corrections from runtime differences.

Physical microphones, speakers, Safari/iOS hardware, and production deployment still require the separate checks in [release instructions](releasing.md). Browser emulation does not establish physical-device acceptance.

## Reproduce

Use Node 24 and `npm ci`.

```sh
npm run verify
node scripts/compare-figma.mjs '/path/to/tUno — Practice with a friend.pdf'
```

The comparison command requires Poppler (`pdftoppm`) and ImageMagick (`magick`). It writes full screenshots, side-by-side comparisons, overlays, difference images, JSON measurements and an HTML index to `dist/validation/figma/`.

The layout regression runs in Chromium and Firefox as part of `npm run verify`. It exercises 320, 360, 375, 390, 414, 430, 650, 768 and 1120px widths; checks visible control intersections and container/viewport overflow; opens the shared menus and volume slider; switches Uno/Numbers; toggles beat accents; edits 240 BPM; and starts/stops actual metronome playback. Each browser produces 54 layout checks and screenshots in `dist/validation/layout/`.
