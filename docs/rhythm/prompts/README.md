# Parallel Uno234 slices: triplets and UIL presets

Prepared 2026-10-12 against rhythm handoff commit `6878465`. These are implementation prompts, not claims that the features already exist.

- [Triplets and 1 la li counting](triplets.md)
- [UIL Levels I–VI presets](uil-presets.md)

## Shared coordination contract

Read the current [direction](../README.md), [music model](../music-model.md), [sixteenth contract](../sixteenths.md), and repository [AGENTS.md](../../../AGENTS.md). Uno234 is the activity; Rhythm Walk is reserved for a future game mode. Both slices must reuse the same canonical exercises, generation, notation and response modes.

Use separate branches/worktrees, never change the other worker's checked-out branch. Follow AGENTS.md for branch creation and PR targets (`dev`). Include the latest authorized rhythm handoff baseline in each working branch without publishing to main. Review current remote history before choosing the baseline; avoid duplicating already integrated work. No automatic cross-branch integration is authorized by these prompts.

### Ownership

- Triplet worker: canonical adapter support, generator atom/group handling, counting grid/input/evaluation, engraving, triplet fixtures and focused tests.
- UIL worker: official-source research, level definitions, capability resolution, preset application/UI, source evidence and focused tests.
- Shared hotspots: `shared/generation.ts`, `shared/settings.ts`, `activity.ts`, shared fixtures, persistence, and canonical docs. Keep edits narrowly scoped; describe integration points in each handoff. The UIL worker must not implement a second generator or preemptively add triplet engine code.

### Integration contract

Reserve **`triplet-eighth`** as the ingredient/capability identifier. It means one complete group of three sounded eighth-note 3:2 tuplets filling one quarter beat in 2/4, 3/4 or 4/4. It does not imply triplet rests, partial groups, ties involving tuplets, or compound-meter support.

The triplet implementation must expose one shared capability query (or extend an existing one) describing supported ingredients/patterns by meter. Agree its concrete TypeScript shape through the repo/handoff before integrating both slices. Avoid a broad plugin framework. UIL definitions must remain representable while a capability is unavailable; do not cast unknown strings into `IngredientId` or mutate active settings to bypass validation.

A preset definition includes a stable ID/version, level label, official source URL/revision/retrieval date, recommended configuration, exact pattern constraints, and required capabilities. Resolution returns either a supported generation configuration or explicit unsupported reasons. Pattern support and meter support matter, not merely the presence of note-value checkboxes. The UIL worker owns this schema and resolver; the triplet worker owns implementation of `triplet-eighth`.

UIL presets configure exercises; they are distinct from fixed review fixtures and never select a response mode, counting system, Tap/Hold style, or calibration. Preserve these preferences and the default two-measure/configurable 1–4 length. Applying a preset updates pending exercise settings; Next/New Exercise creates the passage and clears responses through the existing lifecycle.

Unsupported preset requirements remain visible and unavailable for full application. No silently reduced configuration may carry an unqualified UIL level label. Independent teacher overrides remain possible after applying a supported preset; show that the configuration is customized. Multiple selected meters never imply meter changes within a passage.

## Integration acceptance

Each slice must pass independently when the other is absent. Once both are present, verify triplet capability resolution, preset application/generation, both counting systems, all three response modes, and unchanged 6/8 behavior. Do not mark a blocked level fully supported just because triplets become available: all its pattern restrictions must be enforceable. Keep scoring refinement outside both slices; record reproducible scoring limitations instead.
