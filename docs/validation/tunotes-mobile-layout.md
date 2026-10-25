# tuNotes mobile layout audit

[Open the illustrated HTML report](tunotes-mobile-layout.html) for matching before/after screenshots, measured overflow, and multiplayer layout options.

Audited the current tuNotes UI at 320×667, 360×800, 390×844, 600×800, 768×1024, and 844×390 CSS pixels. Browser emulation covers layout and pointer geometry; it does not replace checking an actual phone's keyboard, browser chrome, or simultaneous touches.

## Layout fixes

- Saved presets change the range chooser to two columns. Mobile tiles now put icons above labels, preventing Clef, Instrument, Custom, My Presets, and Copy from player from spilling into adjacent tiles.
- Instrument shortcuts use a narrower icon column when the chooser has one column.
- Long user-created preset/player names wrap inside chooser tiles, chooser headings, and profile preset controls. The active Practice heading truncates with an ellipsis to preserve room for notation and answers.
- Option checkboxes now sit beside their labels with 24px checkboxes and at least 44px label height.
- Narrow Practice controls reserve enough space for the native Coming soon selector. Normal/Correct Only labels and selection marks stack within their own buttons.
- The active phone header reserves space between the wordmark and fullscreen button.
- Profile footer actions can wrap on narrow displays.

These changes are CSS only. Note selection, copying, adaptation, scoring, timing, player order, and round behavior are unchanged.

## Coverage

`notes-mobile-layout-browser-check.mjs` checks horizontal containment of controls and text across setup, clef/instrument/preset selection, custom editing, key selection, preset saving, adaptation choices, player editing/copying, play-style selection, Practice/Challenge results, multiplayer results, and profile/backup options. Every clef and instrument preset list is also checked at 360px. It includes an 80-character unbroken preset name and a 40-character player name. Intentional horizontal scrolling in the player roster/answer keyboard and explicit ellipsis truncation are exempt.

`notes-viewport-browser-check.mjs` checks gameplay, feedback, pause/resume, resizing, and both multiplayer arrangements. Existing range-picker and mode-layout checks cover editing interactions, focus restoration, validation, and tab navigation. Screenshots and diagnostics from the mobile check can be generated with `TUNO_SCREENSHOTS=1` under `dist/validation/mobile-layout-<browser>/`.

## Larger decisions left for review

### Multiplayer setup: recommended single-page arrangement

The current mobile toolbar mixes choosing notes for the selected player, copying those notes to everyone, and the next required setup action. Before setup is complete, “Choose Notes for all players” occupies the primary Start position. Combined with a horizontally scrolling roster, separate fullscreen row, preview, and mode selector, the screen lacks a clear sequence.

Keep the existing workflow but reorganize its presentation:

1. Compact player rows or wrapping player chips, with the selected player clearly marked and Add player always visible.
2. One Choose Notes action labeled with the selected player's name.
3. A secondary “Use these notes for everyone” action underneath; retain the existing distinction between copying one range and choosing each player's range.
4. A compact note-range preview. Put fullscreen beside the play controls rather than in a separate setup row.
5. Mode and play style, followed by a full-width Start round action. Show a brief “Choose notes for N more players” status while setup is incomplete.

This reduces competing actions while preserving per-player ranges. Moving/relabeling the primary action needs a deliberate design decision, so this audit does not implement it.

### Alternative: guided setup

Use three steps: Players → Notes → Mode & Start. Show progress and allow returning to any earlier step. This makes classroom setup easier to understand, but adds navigation and requires decisions about saving drafts and validating incomplete players.

### Small-screen multiplayer play

Side by Side and Head to Head fit through scaling, but simultaneous keyboards have much smaller targets on narrow phones. Geometry checks alone cannot establish comfortable two-person play. Options: recommend Pass and Play on portrait phones; suggest rotating for simultaneous play; or design a reduced keyboard suited to touch. Keep any recommendation advisory unless explicitly choosing to change which play styles are allowed.

### Tall custom-range and result screens

Scrolling remains necessary on short landscape phones. A sticky Accept/Save action area could reduce scrolling in the custom editor, but must account for nested key/save dialogs and the on-screen keyboard. A collapsible note preview could shorten setup; that changes what is immediately visible. Both are separate follow-up choices.

## Validation results

- `npm run check`: type checking, 459 unit tests, and hosted build passed with Node 24.22.1.
- `node scripts/notes-mobile-layout-browser-check.mjs`: all six sizes passed in Chromium and Firefox, including all clef/instrument lists and multiplayer results.
- `node scripts/notes-mode-layout-browser-check.mjs`: passed.
- `node scripts/notes-range-picker-browser-check.mjs`: passed. Updated its stale Flute expectations to include the existing B♭ starter preset and its key signature.
- `node scripts/notes-viewport-browser-check.mjs`: passed the five play modes, feedback, pause/resume, resize, fullscreen, classroom display, and introduction checks.
- `git diff --check`: passed.
