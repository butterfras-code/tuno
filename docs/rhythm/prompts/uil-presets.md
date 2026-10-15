# Implementation prompt: UIL Levels I–VI rhythm presets

Implement source-verified, editable UIL Band Sight-Reading Level I–VI preset definitions and their supported application path in Uno234. Read the [shared coordination contract](README.md) first; it is part of this prompt. Work independently of the triplet engine slice.

## Verify the actual criteria

Read the [original handoff](../reference/RHYTHM_GAME_HANDOFF.md), especially the UIL source discussion, as historical context—not sufficient current evidence.

Locate the current official UIL Band Sight-Reading Criteria, starting at https://www.uiltexas.org/music/concert-sight-reading/band-sight-reading-criteria . Browse the official source and inspect its rhythmic figure images/PDFs visually; text extraction alone is insufficient. Record the source's actual revision, retrieval date, and direct links to supporting figures. Do not invent a revision if none is stated.

Create a compact source matrix for Levels I–VI:

- Permitted rhythmic figures and note/rest vocabulary, including combination/placement restrictions.
- Specified meters and within-piece meter-change rules.
- Ties, syncopation, tuplets and relevant exceptions.
- Whether a statement applies generally or only to particular instruments/percussion.
- Which restrictions are implemented, unsupported, or require clarification.

Do not extrapolate higher-level patterns from note names or assume all combinations of allowed values are permitted. Verify any dated exceptions against their stated scope; do not promote an old one-year exception to a permanent rule. Cite each substantive mapping. Clearly distinguish official limits from Uno234 teaching choices.

This is a rhythm practice tool, not a complete UIL composition validator. Do not imply endorsement or compliance with unrelated pitch, instrumentation, length or other composition requirements. Do not claim source verification when a figure cannot be inspected; leave that portion unresolved.

## Definitions and capability resolution

Own the small versioned preset schema/resolver described in the coordination contract. Use stable IDs such as `uil-1` through `uil-6`, labels “UIL I” through “UIL VI”, official provenance, recommended settings, pattern constraints and explicit capability requirements.

Reserve `triplet-eighth` for the parallel slice. It only means three sounded 3:2 eighths in a complete quarter-beat group in simple meters. It does not satisfy requirements for triplet rests, partial groups, other tuplets or ties involving tuplets.

Keep definitions separate from active GenerationSettings so unsupported requirements can be represented honestly. Resolve through one shared capability query. Before the triplet feature lands, dependent configurations must report its absence; they must not fabricate support. Test the resolver with explicit supported/unsupported capability inputs.

An ingredient checklist is insufficient to enforce figure-specific rules. Only mark a preset playable when the existing generator can enforce its represented constraints. Add a narrow shared declarative restriction hook if needed and safe to coordinate; do not build a UIL-only generator, rewrite generation during parallel work, or silently broaden the permitted patterns. Otherwise keep that preset blocked with a precise reason and document the follow-up.

Do not require every allowed element to appear in each short exercise. Avoid unreviewed probability/difficulty claims. Do not force all levels into the currently implemented vocabulary merely to make six buttons usable.

## Settings UI and lifecycle

Provide a compact teaching-preset selector in the existing shared exercise settings. Keep it distinct from the fixed review-fixture selector. All six levels can be inspected; unsupported levels show concise unavailable reasons and do not overwrite active configuration.

Applying a supported preset:

- Updates pending shared generation settings; Next/New Exercise generates through the normal lifecycle.
- Preserves the current exercise and both responses until replacement.
- Preserves response mode, counting convention, Tap/Hold style, tempo, calibration and chosen passage length unless the user explicitly changes them.
- Uses default length two, configurable 1–4, without implying short practice passages reproduce full UIL compositions.
- Suggests meters but never locks them. Teachers may independently choose 6/8 or other currently supported meters.
- Does not turn a multi-meter pool into within-exercise meter changes.
- Marks changes to preset-controlled fields as customized; retain source attribution without presenting the modified configuration as an exact preset.
- Supports deliberate reapplication, pending-settings validation and persistence with safe migration of existing preferences.

Do not add teacher accounts, progress tracking, adaptive unlocks, custom-preset sharing/import, or a second exercise state store. Avoid a large configuration framework.

## Source and implementation boundaries

Do not change scoring formulas, count entry, notation, or triplet generation. Any unsupported skill should be recorded as a capability gap rather than implemented opportunistically in this slice. Preserve existing curated fixtures and free practice.

Do not copy third-party UI or source code. Record source-derived facts with attribution and concise notation examples sufficient to audit the mappings; follow repository policy for any reference assets.

## Validation and delivery

Test source mappings separately from engine mechanics. Include:

- Stable IDs/versioned provenance and complete per-level source coverage.
- Exact pattern restrictions rather than only allowed note-value sets.
- Resolver behavior with and without `triplet-eighth`, plus other independently missing capabilities.
- Unsupported application leaves pending/current exercise and responses intact.
- Supported application, customization, reapplication, persistence and malformed stored values.
- Independent meter override and no implicit mixed-meter passages.
- Identical settings/exercises across Write Counts, Tap Rhythms and Both.
- Generated examples staying within implemented preset restrictions, with independently specified allowed/forbidden fixtures.

Use Node 24 and npm ci; run npm run check and relevant browser scenarios for application changes. Use native T3 browser tools when available. Verify supported and blocked presets, pending-setting behavior, Next, customization, response retention and mobile layout. Document any levels that cannot yet be verified/playable; do not disguise that as completion of their engine support.

Add canonical UIL preset documentation, the source matrix, reviewed mappings, capability gaps and validation evidence. Report the schema/API and shared-file edits so the triplet worker can integrate cleanly. Follow repository PR targeting/linking rules. No automatic integration into other branches or production publication.
