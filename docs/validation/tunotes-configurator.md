# tuNotes preset and custom configurator validation

The current tabbed-editor refinement supersedes the inline layout and symbol-cycling controls described in the archived report below. Range / Options / Clefs now share a summary and separate action bar, with one endpoint visible on phones. Use range applies a draft, Cancel restores the prior selection, and Save as preset creates a named copy.

`notes-custom-editor-browser-check.mjs` covers 320–1366 pixel widths, phone landscape, keyboard tab navigation, focus restoration, non-overlapping actions, draft apply/cancel, saving/copying/reloading, invalid pools, older preset repair, zoom, and Challenge/player isolation. The new checks and existing configurator, input, profile/backup, adaptation, and responsive Practice checks passed in Chromium and Firefox. Full release verification and physical-device acceptance remain separate.

## Earlier inline configurator evidence

Implemented on the existing `t3code/create-note-reading-game` branch, 2026-09-27. This is a local preview, not publication. The archived [release metadata](tunotes-configurator/release.json) identifies the tested build.

## Implemented decisions

- Compact modal picker: Clef/Instrument → clef/instrument → existing level, with Back, Escape, focus restoration, saved presets and Create custom. Instrument levels remain the reviewed Starters.
- **tuNotes Your Way!** contains two graphical endpoint staves with note names, tapping, dragging, arrow/Page keys and flat/natural/sharp segments. Endpoint accidentals set inclusive bounds. Crossing edits clamp at the opposite endpoint, including accidental changes, with a status message.
- Lines/Spaces/Both; independent additive Key/Flat/Natural/Sharp modifiers with plus/check state; major keys in the agreed flat/sharp order; and explicit multi-select available clefs.
- Clicking the clef symbol cycles Treble/Bass/Alto/Tenor directly, without a menu; a single help line appears above the pair. Keyboard activation also cycles. Initially linked endpoint clefs preserve pitch. Adding a second endpoint clef implicitly requires Cancel/OK; explicit clef toggles do not. The last enabled clef cannot be removed.
- Ledger extent is derived from the resulting range. Exercise notes use the enabled clef with the fewest ledger lines, breaking ties by distance from the staff center. Content filtering uses that assigned clef.
- Backup schema 2 retains the storage key, migrates schema 0/1, and preserves existing history. New custom settings and comparison fingerprints include versioned modifier/clef identity. Legacy custom ledger clipping converts to effective graphical endpoints on edit.

- Preset names are prefilled deterministically from the range, Line/Space/Both, optional key and selected accidental symbols. Settings update the generated name until the user overrides it; clearing the input restores automatic naming. Saved custom names survive reload.

## Automated evidence

Node 24.21.0, `npm ci`, and `npm run check` passed: type checking, 64 unit tests, application/portable builds and portable resource checks. New domain tests cover additive modifiers, accidental bounds, invalid settings, clef assignment/content filtering, ledger extent, schema migration and graphical settings/history round trips.

[Chromium](tunotes-configurator/notes-configurator-chromium.json) and [Firefox](tunotes-configurator/notes-configurator-firefox.json) configurator checks passed against hosted and cold-offline portable builds. They exercise wizard navigation, Back/Escape/focus, key ordering, actual keyboard and pointer range changes, keyboard/pointer/accidental boundary clamping, generated names and overrides, empty configurations, modifier union, linked clefs, both confirmation outcomes, explicit clef toggles, saving/reloading, and practice rendering both bass and treble. Layout checks cover 360/768/1280 widths and 200% CSS zoom, including opening the picker at zoom. Chromium additionally checks an emulated touch note drag and accidental tap.

The existing `notes-stage2-browser-check` and `notes-input-browser-check` also passed in Chromium and Firefox for the naming/clef/range follow-up, covering profiles, backup replacement, storage failures and answer input. Those runs preceded only the final extreme-ledger clef hit-target fallback; the archived configurator checks were rerun after that adjustment and include clicking the actual glyph with an extreme range. The full `notes-browser-check` passed in both browsers during the preceding configurator implementation. The browser checks use the visible wizard/graphical controls instead of removed native selectors. The configurator check is included in `test:browser` and `verify`.

## Visual review

Reviewed the [phone configurator](tunotes-configurator/notes-configurator-chromium-hosted-360.png), [desktop configurator](tunotes-configurator/notes-configurator-chromium-hosted-1280.png), [phone picker](tunotes-configurator/notes-picker-chromium-hosted-360.png) and [desktop picker](tunotes-configurator/notes-picker-chromium-hosted-1280.png). Endpoint staffs stay side by side; modifiers wrap on narrow screens; no page-level horizontal overflow occurs.

Full release `npm run verify`, physical Safari/mobile/Chromebook checks, screen-reader acceptance and teacher review of the new graphical interaction remain pending. Browser touch emulation is not physical-device evidence.
