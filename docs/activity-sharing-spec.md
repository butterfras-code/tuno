# Suite activity sharing specification

Status: Implemented locally for validation. See [the version one format and integration contract](activity-sharing-format.md) for the selected transport, app field ownership, and remaining release checks.

## Purpose

Teachers can configure an activity, copy a link into their LMS, and have students open the exercise ready to start. Sharing is available across tUno, tuNotes, and Uno234 through a common control and link system that future suite apps can reuse.

The link captures the exercise and settings represented by the current screen. Students do not need an account, a saved preset, or another trip through a configurator. Class time should be spent on the activity.

## Scope

The first version covers Tune, Tone, and UnoMet in tUno; Practice, Challenge, and Multiplayer in tuNotes; and Counts and Perform in Uno234. It includes unsaved custom configurations and sharing from setup, active exercise, and results screens.

Links open a fresh activity. They do not resume a running timer, restore answers or results, activate audio or microphones, enter fullscreen, or join a networked multiplayer room. Multiplayer links configure the existing local multiplayer activity.

Student identities, profile IDs, learning history, device calibration, and microphone measurements are excluded. Sharing does not introduce assignment submission, teacher dashboards, access controls, or locked exercises. Students may edit the loaded setup.

## Teacher and student experience

The teacher configures the activity using existing controls, selects Share activity, and copies the link. Copy link is the primary action; an operating-system share action may be offered where supported. Clipboard failure exposes a selectable link. Cancellation of an operating-system share action is not an error.

The recipient sees the completed activity with a concise description and its normal primary action: Start practice, Start challenge, Start round, or the appropriate tool control. Uno234 displays the shared passage with the selected Counts or Perform panel. No extra confirmation or import step is required for a valid link.

Show a small indication that a shared activity is loaded. Its summary describes meaningful settings in plain language, for example “Two players · Head to Head · Treble E4–F5 · 60 seconds.” The URL itself need not be human-readable.

### Placement and capture rules

Use one shared Share activity component in each activity toolbar. Preserve the Start action's prominence. On narrow screens, a compact icon button must retain an accessible name and adequate touch target. Keep sharing available in fullscreen activity layouts without obscuring notation or response controls.

- Setup screens share the completed, valid selection currently shown.
- Active exercises and results share the configuration used for that exercise, with a fresh attempt on receipt.
- Settings and Options retain an identifiable activity context. The shared control states which activity it will share; it does not share the settings page itself.
- An unfinished configurator must be applied before its draft becomes shareable. Do not silently mix draft and applied values.
- Invalid input prevents sharing and identifies the field that needs attention. Do not silently substitute defaults.

Capture a detached snapshot when Share is invoked. Later edits must not change the already generated link. Sharing must not reset, answer, or advance the sender's exercise.

### Current exercise and pending settings

Uno234 already separates the displayed exercise from settings pending for New exercise. Share activity captures the displayed score and its captured counting/generation configuration, plus the applicable current performance and presentation settings. Pending changes must not be represented as if they produced the displayed passage.

If pending changes exist, explain in the share UI that the link contains the current exercise and that New exercise applies the pending setup. The first version does not add a second, ambiguous default for sharing a future generated exercise. Existing legacy counting-preferences sharing remains a separate compatibility behavior until explicitly retired.

## Activity definitions

Each app owns a validated portable definition containing everything needed to reproduce its instructional setup. Definitions exclude runtime objects, DOM state, persistence snapshots, and derived data that can be reconstructed from canonical sources.

### tUno

Capture the selected tool and the relevant musical settings: reference tuning and transposition, tuner accuracy, selected tone or manual frequency, octave and sustain, tempo, meter, subdivisions, accents, sounds, and instructional display choices where applicable.

Because tUno exposes companion tools on the same screen, the scope includes their configured musical settings as well as the focused tool. A teacher can share a tone and metronome setup together. All playback and microphone states begin inactive.

Device volume remains local. This exception must be documented in the setting inventory so “as presented” does not imply copying every device preference.

### tuNotes

The guided chooser and link loader must both produce the same resolved range selection. Normalize the current preset and custom callback paths into a shared value containing the portable range definition, adaptation choice, and accidental/key-signature display choice.

Capture the full meaning of the range: endpoints, clefs, lines/spaces, key and enabled accidental modifiers, plus any versioned range semantics needed to preserve its note pool. A custom preset's local ID is never sufficient. Unsaved custom selections must work on a fresh device.

Built-in preset identity may be retained for labeling, but loading must not depend on the latest definition of that preset. Include a versioned resolved definition so later preset edits cannot silently change old assignments. Preserve the normalization semantics needed to interpret it; a schema version alone does not freeze changing domain behavior.

Practice includes pacing/continuation behavior and introduction settings. Challenge includes the complete timed or target rules, including scoring, timeout, and accuracy requirements where applicable. Multiplayer includes the format, player count, ordered generic player slots, each slot's range/adaptation settings, and round rules. Recipient names and profile associations are optional local changes.

Adaptive activity uses the recipient's local learning context, or the normal new-learner behavior when none exists. The link preserves the adaptation choice, not the sender's current adaptive subset. The summary must identify adaptation. Fixed-range links preserve the selected pool; random note order is not guaranteed to match.

### Uno234

Capture the exact displayed passage, its counting preferences, selected Counts/Perform panel, generation configuration for subsequent exercises, tempo, assistance/display choices, and performance settings such as Tap or Tap + Hold.

Use the canonical [rhythm music model](rhythm/music-model.md): the written score is the source, and timing is derived. Preserve written notes, rests, dots, tuplets, ties, meters, and event identity through a validated round trip. Do not serialize rendered SVG, counting answers, computed timing arrays, capture evidence, or results. A random seed alone is insufficient because generator changes could alter old assignments.

Validate both musical correctness and current UI capabilities. A musically valid passage outside the supported activity repertoire must produce an unsupported-activity explanation rather than approximation. Follow the [current rhythm direction](rhythm/README.md).

New exercise after opening a link generates fresh material from the shared generation settings. It does not repeat the original passage indefinitely. Switching Counts/Perform preserves the shared passage under the existing activity lifecycle.

## Shared architecture

The suite owns transport, link recognition, version dispatch, payload bounds, shared error presentation, copy/share UI, and the session-loading lifecycle. App adapters own instructional fields, domain validation, capture, summaries, and application to their state.

The shared adapter contract has an app identifier, schema version, route, validator, and description. Each app integrates capture and application with its own state lifecycle and owns migrations when its schema advances. Keep capture and validation independently testable without mounting a screen.

Adding an app should require an adapter, its schema/migrations, its acceptance fixtures, and placement of the shared control. It must not require another clipboard implementation or URL codec. Prefer a small registry over a framework that mirrors every screen.

Reuse existing domain validators, including range normalization, challenge-rule validation, counting preference capture, and score validation. Share-specific validation adds completeness and payload limits; it must not establish competing music rules.

## Compact link transport

Version one uses a readable app route with a compact, versioned, self-contained payload. A backend short-link service is outside the first version. Links require the app to be reachable or already available offline; carrying the settings does not make an uncached app available offline.

Keep the logical activity definition explicit and structured. Optimize its transport representation separately. Use URL-safe encoding; base64url alone is not compression. Measure canonical JSON and compressed alternatives against representative activities before fixing the codec. Do not introduce opaque positional fields merely to save a few characters.

The envelope identifies the transport version, app, and app schema version. Decoding must be deterministic and must not rely on mutable application defaults. Omitted values, if supported, use defaults fixed by that schema version.

Use the `activity` query parameter so Uno234's existing hash navigation remains available. The [format contract](activity-sharing-format.md) defines the versioned syntax and limits. Browser route/history checks cover local handling; actual LMS handling remains a release check.

Set and test explicit maximum encoded length, decompressed size, nesting depth, and collection counts before release. Include worst-case supported multiplayer ranges and four-measure rhythm passages in the size corpus. Record actual lengths and browser/LMS results; there is no assumed universal safe URL limit. Reject oversized content with an actionable message instead of truncating it or copying a broken link.

Generated links use the intended public app route and only approved share parameters. Do not carry development fixture flags, arbitrary existing query parameters, or local-only route state into an assignment. Keep preview-host testing possible without silently publishing preview URLs as production assignments.

Compact encoding is not encryption. Treat decoded input as untrusted, bound decompression before allocation grows excessively, and render labels as text. No network retrieval or executable content is permitted inside an activity definition.

## Loading and persistence

Decode, migrate, validate, and resolve the complete activity before applying any state. If any required part fails, apply none of it. A multiplayer link must not load only some players, and a rhythm link must not load settings while replacing its invalid score with a generated one.

Loaded settings and subsequent edits remain session-only until the user explicitly saves defaults or saves a custom preset through the relevant existing action. Link application must not trigger ordinary persistence subscriptions that overwrite saved preferences. Saving a custom preset does not implicitly save all activity settings.

Local learning progress may continue under the app's existing policy and the recipient's chosen profile. Loading the link must not select or create a profile on the sender's behalf. Settings isolation and progress persistence are separate concerns.

Reloading the original shared URL restores a fresh instance of its assignment. Re-sharing captures the currently applied activity, including recipient edits. Ordinary in-app mode changes must not repeatedly reapply stale URL settings. Explicitly leaving the shared activity restores the saved/default setup without writing the shared settings into storage.

Unavailable, blocked, or full local storage must not prevent using a valid shared activity.

## Compatibility and failures

Continue accepting existing readable counting links with their documented counting-only semantics and session behavior. They do not retroactively become complete exercise links. The new Share activity control generates the new format.

New-format links and legacy counting overrides must never be silently combined. Reject a URL containing both as ambiguous, with an explanation. Preserve the existing fallback behavior for legacy-only invalid links; new full-activity links use the stricter failure behavior below.

Maintain decode fixtures for every released schema and migrate on a detached value. Unknown future versions, unsupported modes, corrupt/truncated data, route/app mismatches, and unsupported musical content receive clear explanations. An invalid new-format link must not leave an unrelated default exercise looking like the assignment. Offer a deliberate action to open the app normally.

Existing assignments should remain usable as the suite evolves. When a future change cannot preserve semantics, fail explicitly; never silently reinterpret the exercise. This requirement covers range resolution, omitted defaults, counting conventions, and activity rules as well as URL syntax.

## Acceptance criteria

1. From each supported mode, configure an activity, share it, and open it in a fresh browser context. The intended mode, effective settings, and summary match without account creation, preset import, or configurator steps.
2. Share built-in, saved custom, and unsaved custom tuNotes ranges. Their fixed pools and display settings survive the round trip. Adaptive links work with both existing and absent recipient history without exposing sender history.
3. Share multiplayer with different ranges per slot and with matching ranges in Head to Head. Slot order, count, format, and rules match; names and profile IDs are absent.
4. Share an Uno234 passage containing supported rests, ties, dots, and tuplets. Written score and counting preferences match exactly, responses are blank, and Counts/Perform switching retains the passage. Pending settings cannot alter the captured exercise.
5. Open tUno links with audio and microphone inactive. The selected tool and agreed musical settings match, and local volume follows the chosen policy.
6. Share during gameplay and from results. The sender's attempt is unchanged, and recipients receive a fresh activity without answers, scores, elapsed time, or capture evidence.
7. Saved settings remain unchanged after load, edits, reload, and exit. Explicit save actions persist only their stated scope. Verify with existing profiles and with unavailable storage.
8. Cover clipboard success/failure, keyboard operation, accessible naming and feedback, desktop/mobile/fullscreen layouts, and changing settings after link creation.
9. Cover malformed, truncated, oversized, unknown-version, ambiguous, and unsupported links. Fail atomically, with no crash or silently substituted assignment. Include bounded decompression tests if compression is used.
10. Retain old counting-link fixtures. Verify migration, browser history, reload, public/preview routing, and representative LMS copy/open flows. Record real link lengths for the agreed worst-case corpus.

For implementation, follow repository validation requirements: Node from `.nvmrc`, `npm ci`, `npm run check`, and relevant browser checks. A production release additionally follows [release instructions](releasing.md), including required preview and physical-device review.

## Implementation sequence

1. Inventory each app's shareable settings and persistence side effects. Establish resolved activity types and fixtures, including the common tuNotes range output and Uno234 current-versus-pending rules.
2. Implement the shared transport, adapter registry, loading lifecycle, and compatibility reader. Measure payloads and finalize the transport decisions below.
3. Add the shared control and app adapters across all supported modes. Integrate session isolation before enabling incoming links.
4. Complete fresh-context round trips, malformed-input tests, accessibility/layout checks, and LMS/device validation. Document the released wire format and compatibility fixtures.

This sequence does not authorize branch integration or production publication.

## Version one decisions and release checks

- Transport uses the `activity` query parameter, optional deflate compression, and explicit bounded payloads documented in the [format contract](activity-sharing-format.md). Existing hash navigation remains available.
- tUno includes companion musical settings and preserves local device volume. tuNotes classroom display remains device-local.
- Share is available in the activity header, including active Head to Head. A shared-activity notice and explicit exit are available on linked activities.
- The current multiplayer UI uses one adaptation and accidental-display choice for the round, with separate ranges per player. Links preserve that supported behavior.
- Validate actual LMS handling, physical devices, operating-system sharing, and assistive technology before production release. Automated browser results do not settle those checks.
