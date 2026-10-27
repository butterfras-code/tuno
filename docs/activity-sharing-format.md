# Activity link format and integration

Version one uses a self-contained `activity` query parameter on `/tune/`, `/tone/`, `/tempo/`, `/notes/`, or `/rhythm/`. For example, `/notes/?activity=1z.…` opens a complete note activity. The fragment remains available for Uno234's Practice/Settings navigation.

## Wire format

The payload prefix is `1j.` for UTF-8 JSON encoded as unpadded base64url, or `1z.` for the same bytes compressed with the standard zlib-wrapped deflate format before base64url encoding. Compression is selected when it saves more than 16 bytes. When compression is unavailable, generation uses `1j.`. A browser unable to decompress receives an update-browser explanation for compressed links.

The decoded envelope has exactly four fields:

```json
{
  "transport": 1,
  "app": "tunotes",
  "version": 1,
  "activity": {}
}
```

`app` is `tuno`, `tunotes`, or `rhythm`. `version` identifies that app's activity schema independently of the transport version. The adapter owns the complete `activity` definition. Object keys are sorted lexically before encoding, absent optional fields are omitted, and arrays retain their semantic order. Encoding is public data, not encryption or an authenticated assignment.

The payload limit is 16,000 characters; decoded content is limited to 65,536 bytes, nesting to 16 levels, and each collection to 1,024 entries. App limits further restrict notes to eight player ranges and 189 pitches per pool, and rhythm passages to four measures with at most 64 written events per measure. Decoding bounds the decompressed stream while reading it. Exceeding a limit fails without partial application.

Links contain only the activity parameter on the adapter's canonical route. They do not inherit fixture flags, arbitrary query parameters, or hashes. The current origin is retained for local and preview testing; the share dialog labels links created away from `tuno.cc` so teachers can generate classroom links on the public host.

## Adapter integration

[`ActivityAdapter`](../src/shared/sharing/activity-link.ts) defines the app ID, schema version, canonical route, validator, and plain-language description. Each app supplies its own capture and application operations alongside its existing state and UI lifecycle. [`shareControl`](../src/shared/sharing/share-control.ts) owns snapshot capture, URL creation, the share dialog, clipboard fallback, optional system sharing, and a locally generated QR code. The displayed QR and downloadable PNG encode the exact same URL as Copy link. QR generation uses medium error correction and a four-module quiet zone; links that exceed QR capacity remain copyable. The full URL is available under View activity link and expands automatically if clipboard access fails.

Validate before mounting the app. A failed link displays an explanation and an explicit Open app normally action. A valid link displays a shared-activity notice with a Leave shared activity action. These exit links reload the ordinary route so saved preferences are restored. Mode navigation inside an app does not rerun the initial decoder. Switching tUno tool routes removes the original payload from the new history entry while keeping the temporary settings in memory; the original assignment URL remains available through Back or its copied link.

Adding an app requires an adapter, capture/application integration, the common control, and round-trip/compatibility fixtures. A transport-version change belongs in the shared decoder; an app-schema change belongs in the app's version dispatch. Preserve the existing readers when introducing either.

## App contracts

tUno captures the focused tool and companion musical settings, including manual frequency, reference tuning, transposition, note/octave, sustain, tempo, meter, subdivisions, accents, sounds, and relevant display settings. Volume, playback/microphone state, measurements, and errors are excluded. Saved settings are restored before applying the link; automatic preference writes are disabled for the shared session.

tuNotes captures a resolved source definition, the exact pitch-label pool, and the approved expansion pools for each range. Loading verifies the current normalizer and adaptive envelope preserve those meanings. Matching built-ins resolve to the catalog instance so property ordering in the transport cannot disable adaptive expansion. A changed definition fails explicitly. Custom names and local custom IDs are replaced with a generated range name and temporary identity. Note order remains random.

Practice includes pacing and intro behavior. Challenge includes full timed/target rules. Multiplayer includes ordered generic slots, their ranges, round rules, and format. The current multiplayer UI has one round-wide adaptation and accidental-display choice; incoming per-slot values must agree. Loaded multiplayer links bypass the redundant style chooser when starting their configured round.

tuNotes preserves the recipient's selected local profile. Ordinary writes retain saved configuration and profile preferences while allowing local built-in progress to persist. Imported custom definitions and their learning/results remain session-local until explicitly adopted; they are excluded from durable backups written automatically. Saving a custom preset or explicitly selecting a profile default uses the existing save flow. Classroom display remains a device preference.

Uno234 captures its immutable written score, captured counting plan preferences and generation recipe, current response panel, tempo, assistance/display preferences, and Tap/Tap + Hold selection. Validation uses the canonical score validator and counting-plan capability checks. Answers, evaluations, raw timing, calibration, and derived score data are excluded. New exercise uses the captured recipe, and Counts/Perform switching retains the displayed score. Pending generation/counting edits do not replace the current exercise in a shared link.

Full rhythm links keep all setting edits temporary. Save as my defaults persists only the selected counting preferences against the recipient's original saved preferences. Other activity fields remain temporary after that action.

## Legacy links

Readable `counting` and `counting.*` links retain their counting-only behavior, including the existing invalid-link fallback. Their Settings action still shares pending counting selections. It removes any full-activity payload when generating a legacy link. Incoming URLs containing both formats are rejected as ambiguous by the full-activity reader.

Version-one compatibility samples live in [`activity-sharing-v1.json`](../tests/fixtures/activity-sharing-v1.json). Keep these fixtures unchanged when extending the format. Add a reader and fixtures for a new version instead of changing old meanings.

## Validation

See [feature validation results](validation/activity-sharing.md) for the completed checks and remaining release validation.

Run `npm run check` and `npm run test:sharing:browser`. Set `TUNO_BROWSER=firefox` for the second browser engine. The sharing browser check exercises fresh contexts, direct loads, re-sharing, gameplay/results, custom ranges, all multiplayer formats, both rhythm panels, persistence, malformed links, clipboard feedback, and narrow layout. Existing suite, configurator, multiplayer, and counting checks cover surrounding behavior.

The initial default corpus measured 332 characters for a tool link, 565 for eight repeated player ranges, and 683 for a generated four-measure rhythm on `https://tuno.cc`. Eight varied custom ranges measured 1,079 characters and a dense four-measure sixteenth-note passage measured 872. These examples are measurements, not universal maxima or LMS guarantees.

Actual LMS platforms, real operating-system sharing/clipboard permissions, physical touch devices, and assistive technology still require release validation under [releasing.md](releasing.md). Browser automation does not establish those results.
