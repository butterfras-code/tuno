# tUno design direction

Status: approved design direction; implementation and interaction testing pending.  
Decision date: 2026-09-19.  
Approved by: Justin Butterfras, project founder.

This document records the UI and character decisions made during the first tUno design session. It is intended to become repository canon when committed. Future implementation should preserve these decisions unless the founder explicitly revises them. Exact dimensions, animation timing, and draft control placement remain adjustable through testing.

## Relationship to existing project documents

Read alongside [the charter](charter.md), [distribution architecture](architecture.md), and [prototype plan](prototype-plan.md). Those documents continue to own product commitments, delivery formats, and validation milestones. This document owns the agreed visual identity and interaction direction; it does not claim a working app or verified browser behavior.

Preserve free core tools, no required account, on-device microphone processing, offline operation, inexpensive-school-hardware support, keyboard access, and reduced-motion support. Hosted and portable HTML releases must share the same core musical behavior. Teacher check-ins remain a follow-on workflow, not a prerequisite for ordinary practice.

## 1. Identity and personality

tUno honors Justin’s departed dog, Uno. The character is integral to the interface and feedback, not decorative stock artwork. The founder explicitly approved the first character study and overall visual feel.

- Keep the accessible text name **tUno**. The eventual logo should draw the capital U as a tuning fork. The first screens currently use a text wordmark; final logo artwork remains outstanding.
- Warm, playful, comforting, readable, and accessible.
- Use warm neutral surfaces and softened dark text rather than stark black UI surfaces.
- Uno has a black coat with dark-brown areas, folded ears, warm brown eyes, and a distinctive white chest blaze. Preserve these identifying features in simplified illustrations.
- The approved illustration uses warm charcoal/brown fur, the white blaze, and a muted red collar. His coat must not change with the selected UI accent.
- Use the supplied photos as the visual reference for Uno, and the approved Figma illustration as the character-style reference.

## 2. One practice surface, three focused views

All three tools remain accessible. Focus determines visual prominence, not which tool is available or running. Changing focus must preserve microphone state, tempo, selected reference note, volume, and playback state.

| Focus | Main presentation | Persistent access |
| --- | --- | --- |
| Tuner | Vertical pitch lane, bone marker, pitch readout, Uno feedback | Reference tone and metronome controls |
| Reference tone | Piano keyboard, octave selection, sustain and volume | Compact live tuner and metronome controls |
| Metronome | Uno pulse, or numbered beats when a meter is selected | Compact tuner and reference-tone controls |

The approved desktop concept uses focus navigation across the top and a shared tool dock along the bottom. The dock exposes status and start/stop controls, including tap tempo. Mobile placement still needs design and testing; continuous access is the requirement, not literal reuse of the desktop geometry.

An inspiring app demonstrated useful integration between tuner, tone generator, and metronome. Retain that workflow principle while developing tUno’s own visual language. Do not reproduce its concentric target rings, central smiley, suspicious head tilt, or surrounding pitch-wheel composition.

## 3. Tuner

### Pitch display

- Vertical representation: **sharp above, flat below, correct pitch at the center**.
- A horizontal dog-bone-shaped marker moves vertically. Its narrow middle provides the precise pitch reference.
- Show note name and octave, cents offset, and frequency. Keep concert/written pitch and reference calibration available.
- Include an exact-center reference and readable labels; color must not carry meaning alone.
- Support explicit states for no detected note and uncertain/unstable input. Do not present missing input as an out-of-tune result.

### Authoritative pitch-color correction

**Teal is the correct center. Moving away in either direction, fade through beige to lavender at the extremes.**

Top to bottom: **lavender → beige → teal → beige → lavender**.

This supersedes the initial asymmetric lavender-to-cream-to-teal mockup. The Figma gradient and center target were corrected during the session. The target band still needs a small contrast/opacity refinement so the bone remains clearly visible. Its intended color is teal, not beige.

The pitch palette stays consistent when the user changes their accent color.

### Uno’s feedback and reward sequence

| State | Character behavior |
| --- | --- |
| Clearly out of tune | Lays on his bed, ignores the player, and looks out the window |
| Approaching center | Pays attention and sits up |
| Close enough / within the tuning zone | Wags his tail |
| Sustained in-tune note | Sits up and begs with front paws raised |
| Held in tune a little longer | A bone is tossed to him; he catches it and returns to a happy sit |

The flying reward is a **copy** of the tuner bone. Keep the real marker visible and tracking pitch throughout the celebration.

Character transitions should be more patient than the live pitch marker. Allow small pitch fluctuations without repeatedly resetting progress or making Uno stand and lie down rapidly. Reward one sustained note once; define release/re-arm behavior during prototyping. Exact cents tolerances and hold times are not yet specified and must be tested with students and real instruments.

Uno’s real signature trick was “stick ’em up / bang / play dead.” The selected v1 reward is begging and catching the bone. Do not implement playing dead as failure feedback. A separate signature-trick celebration is an uncommitted future possibility.

## 4. Reference tones

Use a familiar piano keyboard with note labels, a clear selected/sounding key, and explicit octave context. Include independent volume, sustain, and stop controls. A compact live tuner remains visible.

Approved interaction direction:

1. Click or tap a key to select and sound the note.
2. An explicit sustain control keeps a note playing; stopping must be obvious.
3. An inset edge handle reveals an octave rail through an inward swipe or click, inspired by Niagara’s reveal-and-scrub interaction.
4. Drag along the rail to preview/select an octave, with a large readable note/octave reference such as “C4 · Middle C.”
5. Support scrolling over the octave control and visible minus/plus octave buttons, with equivalent keyboard operation.
6. Browsing to another octave changes the displayed keyboard, not the currently sounding note. Selecting a new key changes the tone.

The Figma screen depicts the expanded rail, not a working gesture. Its collapsed handle, gesture thresholds, scroll behavior, and touch interaction require a functional prototype. Do not rely on hover or an undiscoverable gesture as the only path.

## 5. Metronome

- Uno is primary in the simple/free-pulse presentation; his tail provides the beat visualization.
- Each alternating tail endpoint corresponds to a beat. Motion must follow the same musical timeline as the audible pulse.
- Selecting a time signature brings numbered beats forward and shrinks Uno into a secondary position.
- Provide a view control to restore the larger Uno presentation without silently changing the musical settings.
- Distinguish the current beat and downbeat using labels/shapes as well as color.
- Keep BPM adjustment, tap tempo, start/pause, meter, subdivision, accent, sound, and volume accessible.
- Label the tempo beat unit explicitly. Compound meters such as 6/8 need dotted-quarter grouping and understandable eighth-note pulses.

Common subdivisions and musical correctness remain governed by the charter and prototype plan. Clock-like left/right eye motion was discussed as inspiration, but tail wagging is the selected first direction.

## 6. Initial visual tokens

These are the first Figma values, not a completed accessibility audit or immutable production token specification.

| Role | Value |
| --- | --- |
| Canvas / warm oatmeal | `#F4EFE7` |
| Surface / warm ivory | `#FFFCF7` |
| Primary text | `#342F2D` |
| Secondary text | `#716860` |
| Border | `#DCD2C5` |
| Default accent / plum | `#73556F` |
| Accent tint | `#EDE3EB` |
| Teal text / center reference | `#397A78` |
| Pitch gradient center / soft teal | `#74ACA7` |
| Pitch gradient middle / beige | `#F5E3B9` |
| Pitch gradient extremes / lavender | `#A49ACA` |
| Uno coat | `#302C2B` |
| Uno brown detailing | `#4B3B33` |
| Uno chest blaze | `#F7F0E4` |
| Uno collar | `#A9574D` |

Typography: Nunito Bold for prominent numbers/headings; Nunito Sans for supporting text. Layout: generous spacing, rounded panels and pill-like controls. Keep character colors separate from theme tokens. Accent selection is approved; plum, teal, and muted red are the initial study options, not a finalized settings implementation.

A dark theme, if added, must maintain Uno’s silhouette and markings against the background. Its palette is not yet approved. Package any fonts/assets for offline use and record applicable attribution before release.

## 7. Accessibility and responsive design

- Preserve position, labels, and shape cues independently of the gradient.
- Provide visible focus, keyboard equivalents, and comfortably sized touch targets.
- Offer reduced-motion feedback through static character states and readable progress; rewards must not obscure musical information.
- Validate text, the bone marker, active keys, and beat cues for contrast, including all selectable accents.
- Test actual classroom projection distance and small-screen readability.
- Design microphone permission, unavailable input, and interrupted-audio recovery states explicitly.

Desktop focus layouts are approved as a direction. Mobile/foldable layouts, projection adaptation, pitch-history traces, and instrument-first onboarding remain unresolved. Do not interpret draft default values such as B♭3, 96 BPM, or volume percentages as mandated product defaults.

## 8. Figma reference and implementation status

[Design file: tUno — Practice with a friend](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR)

| Artifact | Figma link |
| --- | --- |
| Tuner focus | [Frame 5:2](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR?node-id=5-2) |
| Reference-tone focus | [Frame 6:37](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR?node-id=6-37) |
| Uno-first metronome | [Frame 6:128](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR?node-id=6-128) |
| Numbered-beat metronome | [Frame 6:216](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR?node-id=6-216) |
| Reward storyboard | [Frame 7:133](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR?node-id=7-133) |
| Interaction notes | [Frame 11:139](https://www.figma.com/design/ubcjXuq2G1t6Fv8dfkJhKR?node-id=11-139) |

The first pass includes editable vector artwork, color variables, typography styles, reusable controls, four desktop screen states, a feedback storyboard, and linked focus navigation. It does **not** implement audio, pitch detection, gesture handling, live animation, or offline verification. “Offline ready” and microphone states shown in screens are mock content, not measured results.

The founder approved the overall character and feel, with the teal-center correction recorded above. Preserve that identity while refining behavior. Figma remains the current design tool; alternative tooling is not a product requirement.

## 9. Included photo references

Original collages supplied by Justin are included unchanged:

- [Uno collage: poses, bed, and markings](design/uno-reference/C1021731-39CF-4952-9E17-959FE7E8B9C7-COLLAGE.jpg)
- [Uno collage: face and expression](design/uno-reference/IMG_20150531_190624-COLLAGE.jpg)

These are character reference assets, not runtime images. Keep their original filenames and retain provenance to the founder. Inclusion in this design bundle does not establish a new license for the photos or project.

## 10. Next implementation steps

1. Refine center-band contrast and retain the corrected symmetric pitch gradient.
2. Export/version approved Uno vectors and screen references in the repo so visual preservation does not depend solely on an external Figma file.
3. Build the shared practice shell with state preserved across focus changes.
4. Prototype the vertical tuner and reward state machine, with adjustable tolerances and hold times.
5. Test piano sustain, octave browsing, and gesture/keyboard alternatives in a browser.
6. Synchronize Uno’s pulse and numbered beats with metronome audio, including compound meter.
7. Complete responsive, permission, interruption, and reduced-motion states; validate on the devices named in the prototype plan.

This ZIP contains the decision document and original photos. It does not contain a Figma export or application code. Extract its `docs/` tree into the repository, add a link to this document from the project README, and commit it with the reference photos.
