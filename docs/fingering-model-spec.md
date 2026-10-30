# Fingering model v2: minimum viable specification

Status: implemented for existing charts and finger-only input; persistence schema 7.

This replaces the eight-position binary mask with ten anatomical finger positions,
supports multiple controls per finger, and optionally identifies a string. The
current input remains binary finger-position input. New woodwind charts, diagrams,
string-selection controls, and simultaneous multi-string input are out of scope.

## Representation

A `FingeringCode` is a string with the form `left|right[|string]`. The brackets
denote an optional section and are not stored. Each hand contains exactly five
tokens, with both thumbs adjacent to the central separator:

```text
left:  little ring middle index thumb
right: thumb index middle ring little
```

This order is anatomical and independent of screen arrangement, Flip, keyboard
bindings, or the order in which controls are displayed.

A finger token is:

- `0`: no active control for this finger.
- `1` through `9`: one active control, identified within that finger's instrument
  definition. `1` is its primary control.
- A parenthesized group of two or more distinct IDs, such as `(137)`: those
  controls are active simultaneously. A group occupies one finger position.

IDs identify controls, not pressure or closure levels. For example, an instrument
definition can assign a main tone hole to `1` and side keys to `2` through `5`.
The syntax can represent combinations without asserting they are physically valid.
Partial hole coverage, more than nine controls per finger, and other control
states require a later extension; they must not silently reuse these meanings.

Examples are illustrative states, not verified musical fingerings:

```text
00000|00000       no active controls
00000|01000       right index primary control
00000|(12)0000   right thumb controls 1 and 2
00000|0(12)000   right index controls 1 and 2
0000(137)|00000  left thumb controls 1, 3 and 7
00010|00000|D    left index primary control, D string
00110|00000|D    left middle and index primary controls, D string
00000|00000|D    open D string
```

The optional string section is one case-sensitive ASCII letter or digit defined
by the instrument. It identifies a physical string, whose tuning is separate
metadata. Readable IDs such as `G`, `D`, `A`, and `E` can be used for standard
violin strings; changing tuning must not change an existing string's identity.
Instruments needing other identifiers require an explicit extension. An omitted
section means unspecified, not a wildcard or proof of which string was played.

## Parsing and validation

Use one shared parser and serializer. Parse into named anatomical positions,
each holding a set of control IDs, plus an optional string ID. Code consumers
must not index characters to find fingers or infer token count from string length.

The parser accepts unordered groups, then canonical serialization sorts IDs in
ascending order: `(31)` becomes `(13)`. Reject duplicate IDs, zero inside groups,
empty or singleton groups, nested groups, whitespace, missing positions, extra
positions or sections, and an empty string section. Canonical codes always have
both hand sections, including zeroes for unused fingers. Compare canonical values.

Separate syntax validation from instrument validation. The instrument definition
specifies supported controls per finger, supported strings, and any allowed
combination restrictions. Reject unsupported controls and string IDs in that
context. Nonzero tokens for unsupported fingers are invalid. Do not interpret a
syntactically valid group as an accepted fingering for a pitch.

Keep control identities stable within an instrument definition. Labels, input
bindings, and future diagram elements refer to those identities; presentation
changes must not reinterpret saved codes. Instruments with different control
assignments need distinct definitions or an explicit definition migration.

## Charts, input, and answer matching

Keep the existing mapping from written chromatic pitch to an ordered list of
accepted fingering codes. The first entry remains the primary fingering;
alternatives remain separate entries, never parenthesized groups. Do not change
transposition, supported pitch ranges, or existing lower-held-finger allowances.

Current controls emit only primary-control states (`0` or `1`) at named finger
positions, with no string section. Preserve source-aware held input, settling,
release, cancellation, and explicit open submission. Grouped controls are data
capability, not a requirement to build a new input interface in this migration.

String-aware matching applies exercise context before comparing hand states:

- Without a string constraint, finger-only input may match any eligible chart
  entry with the same hand states, regardless of its string section.
- For a D-string exercise, first restrict chart entries to explicit string `D`,
  then compare the supplied hand states. An unspecified chart string does not
  establish that the fingering works on D.
- Future input that explicitly selects a string must match that string and any
  exercise constraint. An exercise testing string selection cannot treat omitted
  input as evidence of a correct selection.

Exercise context supplies the string constraint; it must not pretend that the
current input measured string selection. When such exercises are implemented,
persist the constraint needed to revalidate observations. Filter the exercise's
pitch pool to entries supported on the selected string before generating prompts.

Existing string charts omit string identity and therefore remain finger-only
charts in this migration. Adding verified per-string entries and string-specific
exercises is separate work. Simultaneous strings will need a model associating
finger placements with each string; this optional single-string field does not
claim to encode double stops.

Any consecutive-primary-fingering avoidance must compare the answer the current
input can express: string-only differences do not distinguish two finger-only
responses. Exact stored-code equality and input-answer equivalence are separate
operations.

## Migration requirements

The legacy `LLLLRRRR` positions are instrument-dependent. Let `a` through `h`
represent its eight characters in order. Convert supported charts and saved
answers as follows:

| Legacy instrument | New code |
| --- | --- |
| Trumpet, euphonium, tuba | `dcba0|0efgh` |
| Double horn | `0cbad|0efgh` |
| Violin, viola, cello, double bass | `dcba0|0efgh` |

Here letters stand for the original bits, not literal output. In particular,
legacy position 3 is the horn thumb but the string player's little finger.
Do not append zeroes or apply one instrument-independent permutation. Preserve
all eight legacy bits, including incorrect historical answers with nonzero unused
positions. Existing charts keep unused positions zero, but the old observation
validator allowed these incorrect states. Their migrated states remain incorrect.
Validate syntax and historical grading; never discard bits to make an answer valid.

Resolve a saved answer's instrument using its explicit instrument first and its
legacy preset fallback second, as current validation does. If the instrument
cannot be resolved, reject the migration with a useful error rather than guess.
All migrated codes omit the string section: old input did not identify a string.
The open code becomes `00000|00000`.

Version persistence and backup formats so old records are migrated exactly once.
Retain reading of supported legacy backups and write only the new format. Preserve
observation correctness, timestamps, progress, chart alternative order, and
instrument context. Migration must not overwrite valid stored data on failure.
The domain type is `FingeringCode`; answers and held input use `code`, and the
DOM exposes `data-code`. Schema 0–5 reads eight-position `mask` values; schema 6
reads ten-position `mask` values; schema 7 writes ten-position `code` values.
Reject fields from the wrong version, including records containing both names.
Canonicalize valid input before recording attempts and before comparing settled
states. Reject malformed input without adding an attempt. Open-hand checks ignore
optional string identity; finger-only prompt selection compares canonical hand states.
The storage key remains `tunotes:data:v1`; loading migrates in memory and a normal
save writes schema 7. Import/export uses the same validator. Observation validation
preserves incorrect answers, while chart acceptance enforces instrument controls.

## Implementation and acceptance checklist

1. Introduce the parser, canonical serializer, named finger positions, instrument
   validation, and shared answer-matching helpers.
2. Convert current charts, held-input code, display bindings, scoring, and primary
   fingering comparisons. Remove eight-character and character-index assumptions.
3. Migrate profile observations and backup import/export with legacy fixtures,
   including horn thumb versus string little finger and preset fallback cases.
4. Verify token/group validation, canonical equivalence, all ten finger positions,
   optional string matching, unsupported controls, and unchanged accepted answers
   for every existing chart. Use synthetic fixtures for future string constraints.
5. Run `npm run check` and the relevant fingering browser checks using the pinned
   Node version. Review affected screens at the profiles required by
   [the responsive design standard](responsive-design.md). Preserve current control
   layouts, keyboard bindings, and gesture behavior.

Existing behavior and verification history are recorded in
[the fingering validation notes](validation/tunotes-fingering.md).
