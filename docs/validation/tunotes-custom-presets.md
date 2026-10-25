# tuNotes custom presets and setup migration

Validated locally on 2026-10-24 with Node.js 24.22.1.

## Behavior

- Opening Custom preserves instrument and legacy saved keys, content, spellings and range bounds.
- Custom offers On each note / Key Signature while Key is enabled. Accept and Save Preset apply this choice; closing discards the draft.
- Accept applies the current exercise. Save Preset asks for a nonblank name and stores a new copy without overwriting existing presets.
- My Presets appears when custom presets exist and supports selection in Practice, Challenge and Multi Player, including after reload and offline.
- Range summaries and cards use the actual lowest/highest included pitch, independent of modifier insertion order.
- Choose Notes measures its dialog after the settings tab reveals its parent. Challenge fitting reserves space for the feedback row.

## Automated validation

`npm run check` passed: type checking, 459 unit tests, and hosted builds. `git diff --check` passed.

The tuNotes browser checks were migrated to the current chooser, Custom controls, automatic intro/Skip flow, Normal and Correct Only modes. Removed setup tabs, toggles and self-paced Continue controls are no longer browser-test entry points. Existing unit tests retain engine coverage for legacy pacing.

The following checks passed in Chromium and Firefox: notes-browser, stage2, input, guidance, feedback, configurator, preset-preview, custom-editor, range-picker, saved-presets, adaptive, ui, practice-layout, mode-layout, misses, challenge, multiplayer and viewport (each is a `scripts/notes-*-browser-check.mjs` command, except `scripts/notes-browser-check.mjs`). The new saved-presets check covers cancelled notation drafts, key preservation, blank-name rejection, named saving, reload, offline storage and all activity selectors. The release verifier now includes feedback, range-picker, saved-presets and key-layout checks.

After merging current `dev` (`3da365c`, compact tonic answer alignment), `npm run check` and the key-layout, input, practice-layout, viewport, saved-presets and range-picker checks passed again in Chromium and Firefox.

Desktop and phone Custom/chooser screenshots were inspected. This is local automated and visual validation, not physical-device acceptance or production release verification. No deployment was performed.
