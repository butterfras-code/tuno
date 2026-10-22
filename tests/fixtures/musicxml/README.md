# MusicXML foundation fixtures

Canonical outputs of `serializeMusicXML`, except `derived-exercise.musicxml`, which uses `serializeCountingExercise`. Tests require exact serialization and semantic parse/export/parse equality.

| Fixture | Coverage |
| --- | --- |
| binary-rests | Half rest, written dotted quarter, eighth |
| triplet-binary | Sounded eighth triplet, sixteenths, eighth, half; divisions 12 |
| cross-bar-tie | Three written quarters in one sounding chain crossing a barline |
| compound-dotted-half | One written dotted half in 6/8; pure counting support only |
| double-dot-duplet | Source-only double dots and duplets, rejected by the counting capability boundary |
| derived-exercise | Standard text marker plus versioned counting metadata |

All six validated against the official [MusicXML v4.0 schema](https://github.com/w3c/musicxml/blob/v4.0/schema/musicxml.xsd) on 2026-10-14 using `lxml.etree.XMLSchema.assertValid`. For independent revalidation, download `musicxml.xsd`, `xml.xsd` and `xlink.xsd` from that tag, resolve the schema's XML/XLink imports to those local files, and validate each `.musicxml` file. This external schema check is separate from the automated Node test suite (after `npm ci`); the application parser enforces the narrower [documented profile](../../../docs/rhythm/counting-schemes-spec.md#supported-xml-profile-version-1).
