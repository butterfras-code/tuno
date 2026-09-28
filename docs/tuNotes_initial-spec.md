# tuNotes  
## Note-Reading Practice for tUno

**Implementation follow-up:** See the [full specification](tuNotes_spec.md) and [staged build plan](tuNotes_build-plan.md). This document is retained as the original design input.

**Status:** Initial product specification  
**Parent project:** tUno — Practice with a Friend  
**Core platform constraint:** Offline-first, single-file HTML application with no required server, account, network connection, CDN, or external dependency.

---

# 1. Product Concept

**tuNotes** is a music-reading practice tool within the tUno family.

Its primary purpose is to build fast, confident recognition of written musical notes while retaining the approachable, character-driven experience of tUno.

The starting reference point is the note-reading exercises available from sites such as musictheory.net, but tuNotes should differentiate itself through:

- dramatically simpler preset-based configuration
- adaptive practice
- instrument-specific practice
- classroom-friendly multiplayer
- cooperative and competitive challenges
- non-interactive paced reading
- reuse of tUno's Uno character feedback
- eventual microphone-based playing input
- complete offline operation

tuNotes is specifically a **reading-fluency tool**, not a general music-theory suite.

Advanced skills such as sight transposition, interval identification, chord identification, and unrelated theory exercises are outside the initial scope.

---

# 2. Core Design Principles

## 2.1 Simple first

A student should be able to begin practicing with very little configuration.

The primary flow should usually be:

**Choose activity → choose preset → begin**

Advanced customization should exist without making the default experience feel like configuring a theory worksheet.

---

## 2.2 Presets are the common foundation

All primary activities use the same preset system.

A preset describes the written notes initially available to the learner.

The selected activity determines how those notes are presented or modified.

For example:

- Practice uses the preset directly.
- Adaptive Practice begins with the preset and changes emphasis or scope as needed.
- Challenge uses the selected preset for each player.
- Flash/Flow uses the preset as its pool of automatically presented notes.

---

## 2.3 Written pitch is authoritative

tuNotes operates in **written pitch**.

For example, a B♭ clarinet student sees and answers the note names exactly as they appear in clarinet music.

Concert pitch is not exposed to the learner during ordinary use.

Instrument transposition becomes relevant only when microphone input is introduced.

Example:

- tuNotes displays written C for B♭ clarinet.
- The player produces concert B♭.
- The pitch detector hears concert B♭.
- tuNotes applies the instrument's transposition internally.
- The student's answer remains written C.

Sight-transposition practice is explicitly outside the initial scope.

---

# 3. Pitch Identity

Note names include accidentals as part of their identity.

For example:

- F and F♯ are different answers.
- B♭ and B are different answers.

Accidentals are not decorative metadata.

The internal note model should therefore represent pitch spelling explicitly rather than collapsing notes into pitch class alone.

---

# 4. Key Signatures

Key-signature support should be designed into the note/preset model even if the complete feature is introduced incrementally.

Presets may eventually specify a key signature.

Example:

- `key: "Bb"`
- `key: "G"`

When a key signature is active:

- the key signature is displayed on the staff
- the written pitch remains the same logical note
- accidentals implied by the key signature need not appear beside every note

This will be particularly useful for instrument-specific presets.

---

# 5. Primary Activities

tuNotes should initially revolve around three major activity families:

1. **Practice**
2. **Challenge**
3. **Flash / Flow** — working name for non-interactive paced reading

Microphone input is planned as an extension of Practice rather than a separate initial product.

---

# 6. Practice

Practice is the primary interactive note-reading activity.

A written note is displayed and the student identifies it.

## Initial response method

The first response system is:

**English letter-name buttons**

Examples:

- A
- B♭
- B
- C♯

Accidentals are included in the answer identity.

---

## Future response method

A future input mode allows the student to **play the displayed note into the microphone**.

This should reuse audio and pitch-detection components from tUno wherever practical.

Instrument transposition metadata from the selected preset converts detected concert pitch into written pitch before determining correctness.

---

# 7. Adaptive Practice

Adaptive behavior is an optional toggle rather than a separate preset family.

## Adaptive OFF

The learner practices exactly the selected preset.

## Adaptive ON

The selected preset establishes the starting point.

tuNotes may then:

- increase the frequency of troublesome notes
- reduce emphasis on fluent notes
- temporarily narrow the active set
- expand the active range as mastery improves
- deliberately contrast notes the student commonly confuses

The adaptive engine should eventually consider more than correctness.

Potential signals include:

- correct / incorrect
- response time
- recent attempts
- repeated confusion between specific notes
- streak consistency

However, initial adaptive behavior does not require a sophisticated machine-learning system.

A simple transparent per-note fluency model is preferable.

---

# 8. Adaptive Behavior in Challenge

Adaptive behavior is independently toggleable within multiplayer and Challenge activities.

Both use cases are considered valid:

### Adaptive OFF
Every player receives material strictly from their configured preset.

### Adaptive ON
Each player's note stream adapts independently.

This is useful because players may have:

- different instruments
- different clefs
- different ranges
- different ability levels

Adaptive state belongs to the individual player, not the overall match.

---

# 9. Post-Activity Recommendations

tuNotes may analyze performance even when adaptive mode is disabled.

The application may recommend future difficulty changes without automatically changing the student's current exercise.

Examples:

- “Wow — you could try a harder level next time!”
- “You’ve got these notes! Want to add the next ledger line?”
- “Great accuracy. Try adding accidentals next time.”
- “F and A gave you some trouble. Another round could help lock them in.”

These should feel like coaching rather than grading.

---

# 10. Speed Mastery

Speed should not initially define ordinary note mastery.

The first learning progression is:

1. correct
2. consistent
3. fast

A future feature may introduce explicit **speed mastery**, potentially through a Time Trial style activity.

This allows students to revisit already-known material and build automatic recognition without making early learning unnecessarily speed-focused.

---

# 11. Preset System

Presets should be available in every relevant mode.

They should be easy for students to choose and easy for teachers to understand.

Presets fall into three broad categories:

1. Clef-based
2. Instrument-based
3. Custom

---

# 12. Clef-Based Presets

Clef-based presets should provide straightforward reading envelopes.

Examples include:

- Lines
- Spaces
- Lines + Spaces
- +1 ledger line above
- +1 ledger line below
- +1 ledger line both directions
- +2 ledger lines above
- +2 ledger lines below
- +2 ledger lines both directions
- +4 ledger lines above
- +4 ledger lines below

The upper-only and lower-only options are particularly important for instruments whose practical range expands predominantly in one direction, such as flute or tuba.

The exact presets available may differ by clef where musically appropriate.

---

# 13. Instrument Presets

Instrument presets begin with a musically useful subset of that instrument's written range.

Adaptive mode may expand outward from that starting set.

Examples may include:

- Flute — Beginner
- B♭ Clarinet — Beginner
- Alto Saxophone — Beginner
- Trumpet — Beginner
- Horn — Beginner
- Trombone — Beginner
- Euphonium — Beginner
- Tuba — Beginner

Instrument presets may later include different levels.

For example:

- Beginner
- Developing
- Full Range

Instrument presets may also eventually specify a useful key signature.

---

# 14. Custom Preset

Custom configuration should remain powerful but deliberately lightweight.

The initial custom controls should include approximately:

- clef
- lowest written note
- highest written note
- lines / spaces / both
- accidental behavior
- maximum ledger-note range or ledger inclusion
- optional key signature

Avoid excessively granular configuration unless a real classroom need emerges.

The goal is useful customization, not a theory exercise generator with dozens of switches.

---

# 15. Human-Readable Preset Definitions

Preset definitions in the source code must be intentionally understandable.

A teacher with modest JavaScript knowledge should be able to duplicate and modify a preset without reverse-engineering internal note encodings.

Avoid exposing cryptic implementation details such as:

- MIDI numbers
- bit masks
- numeric staff offsets
- opaque range IDs

Preferred style:

```js
{
  id: "clarinet-bb-beginner",
  name: "B♭ Clarinet — Beginner",
  clef: "treble",
  transposition: "Bb",
  range: ["E3", "C6"]
}
```

A clef-oriented preset might resemble:

```js
{
  id: "treble-plus-1-both",
  name: "Treble — 1 Ledger Line",
  clef: "treble",
  content: "lines-and-spaces",
  ledgerLines: {
    above: 1,
    below: 1
  },
  accidentals: "none"
}
```

The runtime may normalize these values into a more efficient internal form.

The source should include brief comments explaining how teachers can create their own presets.

---

# 16. Challenge Mode

The multiplayer/game activity is called **Challenge**, not Versus.

Challenge supports both:

- single-player play
- multiplayer play

Players may be added through an **Add Player** control.

Maximum session size:

**8 players**

Players may enter names locally.

No account system is required.

---

# 17. Challenge Architecture

Challenge should avoid multiplying game modes unnecessarily.

The core Challenge logic consists of only two scoring structures:

1. **Timed**
2. **Target**

Head-to-head, heats, pass-and-play, relay, competition, and cooperation are configurations around those structures rather than separate games.

---

# 18. Timed Challenge

Each player receives a fixed amount of time.

Two scoring methods are supported:

### Correct Notes
Score equals the number of correct answers.

### Notes × Accuracy
Score is calculated from correct-note output adjusted by accuracy.

Conceptually:

**Correct Notes × Accuracy**

This discourages button spamming while remaining easy to explain.

Example:

30 correct at 80% accuracy → adjusted score 24.

---

# 19. Target Challenge

Players must achieve a selected number of correct answers.

Example:

**Get 10 notes correct**

Performance is scored primarily by:

**time to completion**

An accuracy requirement prevents rapid guessing.

A timeout should exist so an unfinished attempt cannot continue indefinitely.

---

# 20. Accuracy Qualification

Failure to meet the accuracy requirement should not be presented as punishment or failure.

Preferred tone:

**“Improve your accuracy to make finals.”**

A player may complete the challenge but fail to post a qualifying/ranked result.

Example result:

**18 notes — 72% accuracy**  
**Nice run! Improve your accuracy to make finals.**

Uno should still react positively.

The app should encourage improvement rather than displaying a negative failure state.

---

# 21. Multiplayer Configuration

Multiplayer presentation is separate from scoring rules.

Possible configurations include:

- two-player head-to-head
- two-player heats
- larger heats
- pass-and-play / turn-based
- relay
- individual timed turns

The application should not attempt to display all eight players simultaneously when that would harm readability.

Two simultaneous players should work particularly well on tablets, Chromebooks, laptops, and touchscreens.

Larger sessions can use heats or turns.

---

# 22. Per-Player Presets

Every multiplayer player may have an independent preset.

This is required for:

- differentiation
- mixed-instrument classes
- mixed clefs
- mixed reading ability

Example session:

- Mia — Flute preset
- Carlos — Trombone preset
- Jayden — Clarinet preset
- Ava — Horn preset

All may participate in the same Challenge while receiving appropriately configured notes.

A correct answer generally remains worth one correct answer regardless of preset difficulty.

The system should not publicly label one player's material as easier or harder unless a future feature explicitly requires it.

---

# 23. Competitive and Cooperative Play

Challenge supports both:

- **Competitive**
- **Co-op**

These are independent of Timed versus Target scoring.

## Competitive examples

Timed:

- highest qualifying score wins

Target:

- fastest qualifying completion wins

Teams may also compete.

---

## Cooperative examples

Timed:

**“How many notes can we all get right?”**

Each player receives a fixed amount of time and contributes to a shared total.

Target:

**“How long does it take all of us to get 10 right?”**

The group attempts to complete a shared objective.

Co-op allows stronger and developing readers to contribute toward the same classroom goal.

---

# 24. Teams

Challenge should support teams.

This is particularly important for Relay.

Examples:

- Team A versus Team B
- multiple smaller teams
- cooperative whole-class team

Relay may use:

- a cumulative timed score
- a cumulative target
- individual statistics underneath a team result

---

# 25. Results & Scoreboard

Multiplayer sessions conclude with a scoreboard.

Potential results include:

- player name
- correct answers
- total attempts
- accuracy
- score
- completion time
- best streak
- team result where applicable

The scoreboard should emphasize positive participation and useful feedback.

Uno may celebrate top results, but the interface should avoid humiliating lower-scoring players.

---

# 26. Uno Character Feedback

tuNotes should reuse the established Uno visual language from tUno instead of inventing a separate reward system.

The tUno tuner already uses a progressive sequence:

1. Uno asleep/resting
2. Uno looks out the window / becomes interested
3. Uno sits up
4. Uno wags his tail
5. Uno begs
6. Uno receives a treat

tuNotes should reuse these assets and states wherever practical.

---

# 27. Progress-Based Character Reactions

Uno's progression should represent progress during the current activity.

Rather than relying only on fixed streak counts, the progression may use the player's previous performance as a benchmark.

Example:

If a student's relevant recent benchmark is 20 correct notes:

- approximately 20% → first reaction
- approximately 40% → next reaction
- approximately 60%
- approximately 80%
- approximately 100% → treat

For a new player with no relevant history:

**Use 10 correct notes as the default benchmark.**

---

# 28. Stable Benchmarking

A single immediately previous score may fluctuate too much.

A more stable benchmark may eventually use something like:

- recent best
- personal best
- best of recent attempts

The exact algorithm may be refined during implementation.

The important requirement is that character progression adapts to the learner's demonstrated performance while remaining predictable.

---

# 29. Streaks

Streaks remain useful as lightweight positive reinforcement.

Progressively longer correct streaks may trigger:

- expressions
- tail wagging
- small dog-treat toast messages
- milestone feedback
- treat-catching animation

The reward system should feel encouraging rather than manipulative or overly game-like.

---

# 30. Difficulty Feedback

When the student substantially exceeds a benchmark or adaptive mode expands their exercise, tuNotes can provide explicit positive feedback.

Examples:

**“Level up! Uno added high C.”**

or

**“Wow — you could try a harder level next time!”**

This makes adaptive behavior understandable instead of invisible.

---

# 31. Flash / Flow Mode

Working names include:

- Flash
- Flow
- Read-Along

The final name can be chosen later.

This is a **non-interactive note-reading activity**.

There are:

- no answer buttons
- no accuracy score
- no adaptation
- no required student input

The goal is paced sight-reading practice.

---

# 32. Flash / Flow Presentation

One primary note appears at a time.

A smaller, muted **Next** note is also visible.

This introduces visual look-ahead without turning the activity into a scrolling notation system.

When the current note expires:

1. the Next note becomes the current note
2. a new Next note appears

This preserves flash-card simplicity while building a real reading skill: preparing the upcoming note before it arrives.

---

# 33. Flash / Flow Timing

Two pacing systems are supported.

## Time-Based

The note changes every selected number of seconds.

Example:

**Change every 2 seconds**

---

## Beat-Based

The note changes every selected number of beats at a configured BPM.

Example:

**Tempo: 60 BPM**  
**Change every: 4 beats**

This should reuse metronome timing code from tUno where practical.

Beat-based operation is especially valuable because it trains students to read within musical time.

---

# 34. Count-In

Flash / Flow should support an optional count-in before playback begins.

This is particularly useful in beat-based mode.

---

# 35. Answer Hint

Flash / Flow includes an optional delayed note-name hint.

The current note initially appears without its letter name.

After a configurable portion of its display time, the written note name fades in.

Default behavior:

**Show the answer during the final 50% of the note's duration.**

Configuration depends on timing mode.

### Time Mode
**Show answer during last X seconds**

### Beat Mode
**Show answer during last X beats**

Additional states may include:

- Off
- Always

The hint applies only to the **current note**.

The Next preview remains unlabeled so students can genuinely look ahead.

---

# 36. Flash / Flow Note Labels

For the initial release, note labels use:

**English letter names**

Examples:

- C
- F♯
- B♭

Accidentals are part of the note name.

Solfège, fingering diagrams, and other labeling systems are not required initially.

---

# 37. Flash / Flow + tUno

Flash / Flow may include a contextual suggestion such as:

**“Open tUno in another window and play each note as it changes.”**

This allows students to combine:

- reading
- instrument playing
- tuning

without technically coupling tuNotes and the tuner.

The two tools remain independently usable offline.

---

# 38. Optional Rest Cards

A future or optional Flash / Flow setting may insert rests or blank intervals periodically.

This is useful for wind players who otherwise may be expected to continuously produce notes without breathing opportunities.

Example:

**Insert a rest every 8 notes**

This is desirable but not required for the first implementation.

---

# 39. Local Persistence

tuNotes follows the tUno principle that the application should remain useful even if all locally stored data disappears.

Persistence enhances the experience but is not required for basic operation.

Configuration is easy to recreate through presets.

---

# 40. Local Data Categories

Data can be considered in three groups.

## Configuration

Mostly disposable.

Examples:

- last selected preset
- recent mode
- display preferences

Losing this information should have little consequence.

---

## Progress / History

Useful but optional.

Potentially stored information includes:

- note attempts
- correct / incorrect
- response time
- preset used
- challenge results
- streaks
- adaptive state
- per-note fluency summaries

This data may be stored locally using browser storage.

---

## Portable Backup

The user can explicitly export data.

Two formats serve different purposes.

### JSON

Canonical backup / restore format.

Should preserve enough structured information to reimport tuNotes history and configuration.

### CSV

Human-readable analysis export.

Useful for:

- teachers
- spreadsheets
- classroom analysis
- archival results

CSV does not need to represent every piece of internal state.

---

# 41. Data Import

JSON exports should support reimport into tuNotes.

The format should include a version identifier so future versions can migrate older backups where practical.

---

# 42. Storage Expectations

The application should clearly communicate that progress is stored locally.

Suggested wording:

**“Progress is stored only on this device. Clearing browser or site data may erase it. Export a backup if you want to keep it.”**

Losing progress should never make tuNotes unusable.

A student can simply choose a preset and continue.

---

# 43. Offline Requirement

The fundamental architecture requirement is:

**tuNotes must work completely offline as a single HTML file.**

No required:

- server
- database
- account
- login
- cloud sync
- CDN
- analytics service
- external API
- network connection

All required scripts, styles, notation assets, character assets, and runtime logic must be bundled locally.

---

# 44. Device Support

The single-file application should function on ordinary modern devices capable of opening the HTML application, including:

- Chromebooks
- Windows laptops
- Linux laptops
- macOS
- tablets
- phones
- classroom displays

Touch and mouse input should both be considered.

Microphone features may naturally depend on browser/device permissions.

---

# 45. Local Player Profiles

The broader storage model should allow progress to be associated with named local players if needed.

This is especially useful for:

- shared classroom devices
- Challenge sessions
- local multiplayer

No account system is required.

Player names are local and lightweight.

Detailed profile management is not a prerequisite for the initial note-reading interaction.

---

# 46. Architecture Direction

The implementation should favor reusable modules shared with tUno where sensible.

Likely reuse areas include:

- Uno character artwork and states
- metronome timing
- pitch-detection logic
- audio input
- common styling
- theme tokens
- control patterns
- accessibility behavior

tuNotes should still remain capable of functioning independently as its own offline single-file application.

---

# 47. Recommended Internal Separation

Conceptually, the implementation should separate:

### Note Model
Written note, pitch spelling, octave, clef placement, accidental behavior, key-signature behavior.

### Preset Model
Defines which written notes are initially available.

### Instrument Metadata
Instrument name, written range, transposition, useful preset ranges.

### Exercise Engine
Selects and presents notes.

### Adaptive Engine
Weights, narrows, expands, and evaluates note fluency.

### Challenge Engine
Handles time, targets, scoring, qualification, players, teams, heats, and rounds.

### Persistence Layer
Handles local data, imports, and exports.

### Uno Feedback Layer
Maps progress and outcomes to character states.

The source can remain contained in one HTML file while still maintaining these conceptual boundaries.

---

# 48. Important Non-Goals for Initial Development

Do not allow the project to expand prematurely into:

- sight transposition
- interval training
- chord identification
- full music-theory curriculum
- cloud accounts
- server-side student tracking
- teacher dashboards requiring networking
- complex LMS integration
- automatic classroom roster synchronization
- overly granular custom exercise configuration

These may be reconsidered only if they solve a real later need.

---

# 49. Initial Product Outcome

A successful initial tuNotes release should allow a student or teacher to:

1. Open one offline HTML file.
2. Choose Practice, Challenge, or Flash/Flow.
3. Select a clef, instrument, or custom preset.
4. Practice written note recognition with simple letter-name responses.
5. Optionally use adaptive behavior.
6. Receive encouraging Uno feedback.
7. Run solo or multiplayer Challenges.
8. Differentiate multiplayer material by player or instrument.
9. Run competitive or cooperative classroom activities.
10. Perform timed or target-based challenges.
11. Run paced, non-interactive note-reading exercises by time or BPM.
12. Use delayed answer hints and look-ahead notes.
13. Retain useful local progress when desired.
14. Export and restore data without any server.
15. Continue using the application normally even if all saved data is lost.

The product should feel like **tUno teaching note reading**, rather than a traditional theory worksheet that happens to contain tUno branding.