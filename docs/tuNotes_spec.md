# tuNotes product and implementation specification

Status: Stages 0–2 implemented as a local Practice preview, 2026-09-27. Independent hosted/portable builds include full clef/key/accidental presets, teacher-reviewed instrument Starters, Custom pools, optional profiles and local backup. The in-phase Stage 2 answer-entry revision below replaces the accidental dropdown with fixed spelling targets and explicit keyboard alterations. Adaptation, Challenge and Flow remain planned. The Stage 2 implementation, including the answer-entry follow-ups, is recorded in local commit `73eba41`; this does not imply publication. See [Stage 2 validation](validation/tunotes-stage2.md) and [answer-entry validation](validation/tunotes-input.md) for automated evidence and remaining human acceptance.

This is the implementation reference derived from the [initial specification](tuNotes_initial-spec.md) and [design conversation](tuNotes_chat.txt), reviewed against repository revision `c3759c8f08ce400c67443d1673f4175e2d088a31`. Preserve those inputs as design history. The [staged build plan](tuNotes_build-plan.md) defines delivery order and acceptance gates.

Requirements inherited from the source documents are commitments. Exact defaults, algorithms, ranges, paths, and interaction rules supplied here are **proposed implementation decisions**, not previously approved classroom findings. Implement these defaults unless changed during review; record changes here before dependent work. The Starter keys/ranges below have teacher approval; expansion bounds and engraving/device acceptance still require the review identified in the build plan.

## 1. Product and release boundary

tuNotes builds recognition of written musical notes through Practice, Challenge, and **Flow** (the proposed public name for Flash/Read-Along). The normal path is activity → preset → Start; Challenge adds players and rules. A first-time student starts with Practice, Treble — Lines + Spaces, adaptive off, and letter buttons. No profile or settings visit is required.

The complete first release includes all three activities, treble/bass/alto/tenor clefs, clef/instrument/custom presets, single accidentals and key signatures, optional adaptation, 1–8 local players, two simultaneous panels, turns/heats/teams/relay, competitive/cooperative results, Uno feedback, and optional local history with backup. Intermediate stages are usable previews, not claims that this full release is complete.

Microphone answers, speed mastery, rest cards, more than two simultaneous panels, alternate naming systems, fingerings, intervals, chords, sight transposition, accounts, network multiplayer, LMS integration, and teacher servers are deferred. Runtime networking, analytics, and external assets are not required. Development may use pinned build/test dependencies.

Deliver a standalone `tunotes.html` that works from a cold offline launch, plus a hosted app with verified offline caching. Downloaded tUno and tuNotes remain independently useful. Do not require a combined launcher or require one app to be installed before the other.

## 2. Screens and session behavior

| Screen | Required behavior |
| --- | --- |
| Home/setup | Activity cards; shared preset picker grouped by Clef, Instrument, Custom; visible preset summary; Start; optional local player selection |
| Practice | One large staff, stable answer controls, correct/attempt count, optional accuracy, streak, Uno, Pause and Finish |
| Challenge setup | Add/remove/reorder players (1–8), local names, preset/adaptive per player; Timed/Target, competition/co-op, turns/pairs/relay, optional teams; plain-language rule summary |
| Challenge ready/play | Name and preset privately visible before start; explicit Ready/count-in; at most two isolated input panels; remaining time or correct-note target; shared pause |
| Results | Participation summary, personal coaching, scoreboard when competitive; Retry, Edit setup, Home; no automatic restart |
| Flow | Current staff and smaller muted Next staff, pacing/hint controls, Start/Pause/Stop, optional click; no answer buttons or score |
| Local data | Remember progress toggle, profiles, export/import, delete selected profile or all tuNotes data; storage explanation |

Use explicit lifecycle states: `setup → ready → countdown → running → feedback → running → finished`. Pause may interrupt countdown/running/feedback; feedback is a per-player substate in simultaneous games. Flow uses running without answer feedback. Session IDs and prompt IDs reject late input, timer callbacks, and duplicate completion events.

Practice is untimed and ends on Finish. Challenge defaults to a three-second countdown; no answers count before running. Configuration freezes when the round starts. Editing requires ending/restarting the round. Finish during Challenge records an unranked partial result, never a qualifying finish. Reload returns to setup, not an active timer.

Visibility loss pauses the entire session and all sound. Require explicit Resume; preserve the current prompt and its remaining time. Exclude pause/countdown/handoff time from active duration. A manually or automatically paused competitive run is marked interrupted and unranked; co-op/Practice may continue with that annotation. A responsive layout change that makes two panels unusable also pauses; let the user restore the layout or restart as turns, never silently change the competition format.

## 3. Musical domain and notation

### Written pitch and answer identity

Represent spelling explicitly: `{ letter: 'F', accidental: 1, octave: 4 }`; accidental is -1, 0, or +1. Scientific pitch naming uses C4 for middle C. Source preset strings use `Bb3`, `F#4`; labels use B♭, F♯. Double accidentals are out of scope. Octave is part of prompt identity and learning statistics, but initial letter answers omit octave: F4 and F5 both accept F; F♯ and G♭ never accept one another in letter mode.

Separate `WrittenPitch`, `AnswerSpelling` (letter + accidental), `Clef`, `KeySignature`, and a rendered prompt. Chromatic number/frequency is a derived value only. Existing `src/music/pitch.ts` is suitable for frequency conversion but its preferred `noteName()` spelling must not generate notation or answer identity.

Staff position is diatonic and independent of accidentals. Define positions in half staff-space steps: bottom line = 0, top line = 8. Bottom-line anchors are E4 treble, G2 bass, F3 alto, D3 tenor. Position parity even = line, odd = space, including outside the staff. Draw ledger lines only at even positions outside 0…8 between the staff and notehead. This gives testable anchors: treble C4 is -2, bass C4 is 10, alto C4 is 4, tenor C4 is 6.

One prompt is an isolated whole note, not a measure of accumulating accidental state. Show clef and active key on each staff. Each prompt resets accidental context; previous prompts and Next never affect the current answer. An accidental matching the key is omitted, a natural cancelling the key displays ♮, and other alterations display ♯/♭. The renderer supports C and all major signatures through seven sharps or seven flats. The current answer layout excludes C♭ major from selectable exercises because its tonic is omitted; minor-key names are deferred because the signature behavior is identical. Use canonical standard symbol order and clef-specific placement tables with reviewed fixtures, not a generic transposition of one clef's key glyphs.

Use a small native SVG renderer for this bounded notation: staff, clef, whole-note head, ledger lines, key and single accidentals. Bundle project-owned or compatible licensed glyphs, with provenance in dependency documentation. No external font fetch. If a notation library proves necessary, decide it in the notation stage with portable packaging and licensing evidence. Scale spacing to fit the selected pool without clipping, including four-ledger clef presets and instrument envelopes beyond them (flute C7 requires five ledger lines above treble staff); Next uses the same renderer. Rendering must not decide answers or mutate the exercise.

### Presets and normalization

Source definitions remain teacher-readable. Normalize once to a finite, nonempty pool of explicitly spelled notes. Invalid definitions produce actionable build/test errors; invalid Custom settings disable Start and describe the conflict.

```ts
// Proposed source shape; instrument metadata is separate from reading scope.
{
  id: 'clarinet-bb-starter', version: 1,
  name: 'B♭ Clarinet — Starter', clef: 'treble',
  instrument: 'clarinet-bb',
  range: ['C4', 'G4'], content: 'lines-and-spaces',
  accidentals: 'key-only', key: 'C',
  expansion: { range: ['C4', 'C6'], direction: 'both' }
}
```

Supported content: lines, spaces, lines-and-spaces. Original Stage 2 accidental policies (the configurator refinement below adds independent modifiers): `key-only` (natural notes when key=C), `sharps`, `flats`, `both`. For each eligible letter/octave position, include its key-implied spelling; other modes additionally allow natural plus the requested alteration(s), deduplicated. Thus sharps in B♭ still contains the key's B♭; explain the UI as “Key notes + extra sharps.” The advanced preview lists the resulting spellings. The written-pitch model, notation renderer and legacy-data validation retain E♯/B♯/C♭/F♭ support, but current exercise pools and answer targets exclude all four, including in matching signatures. Never silently respell them. C♭ major is unavailable for new exercises; renderer support for all 15 major signatures does not imply all are playable.

Original Stage 2 Custom controls (superseded by [Preset picker and graphical configuration](#preset-picker-and-graphical-configuration-september-2026) as that refinement is implemented): clef, low/high written position, lines/spaces/both, key, accidental policy, maximum ledger lines above/below (0–4). Low/high controls use natural letter/octave positions; accidentals come from policy. Intersect all filters, show pool size and a notation preview, and reject empty ranges. A ledger limit of zero permits adjacent exterior spaces (-1 and 9); “Staff only” is an explicit 0…8 range. Custom adaptation changes weights/narrows within this pool and never expands beyond its configured bounds.

Clef catalog, for each clef: staff Lines (0,2,4,6,8), staff Spaces (1,3,5,7), staff Both (0…8); plus 1 or 2 ledger lines above/below/both and 4 above-only/below-only. Expansion envelopes include all positions from the staff through the last named ledger line, inclusively: +1 above ends at 10, +2 below starts at -4, +4 above ends at 16. Default key C and key-only. Clef adaptation may expand one eligible position at a time within -8…16; Lines/Spaces filters continue to apply. No implicit accidentals or key changes through adaptation.

The teacher-approved Starter catalog follows; expansion bounds remain proposed. These are limited reading exercises, **not certified beginner curricula or full playable ranges**. Retain “Starter” labels. All use key-only, both lines and spaces; expansions keep the starting key. Teacher-reviewed written keys (2026-09-27) are F for flute, oboe and bassoon; G for alto saxophone; C for clarinet, trumpet, horn and keyboards; and B♭ for bass-clef brass. Bounds constrain adaptive growth.

| Instrument/preset | Clef | Starting written range | Expansion bounds | Concert → written semitones |
| --- | --- | --- | --- | --- |
| Flute | Treble | F4–C5 | C4–C7 | 0 |
| Oboe | Treble | F4–C5 | F4–C5 | 0 |
| Bassoon | Bass | F2–C3 | F2–C3 | 0 |
| B♭ clarinet | Treble | C4–G4 | C4–C6 | +2 |
| Alto saxophone | Treble | G4–D5 | D4–F6 | +9 |
| B♭ trumpet | Treble | C4–G4 | F3–C6 | +2 |
| F horn | Treble | C4–G4 | F3–C6 | +7 |
| Trombone | Bass | B♭2–F3 | E2–B♭3 | 0 |
| Euphonium (bass clef) | Bass | B♭2–F3 | E2–B♭3 | 0 |
| Tuba (bass clef) | Bass | B♭1–F2 | E1–B♭2 | 0 |
| Keyboards | Treble | C4–G4 | C4–G4 | 0 |

Table bounds indicate inclusive staff positions; normalize source range boundaries to natural letter/octave strings and derive accidentals from the stated key. Thus trombone starts at source position B2 with key Bb, producing B♭2, C3, D3, E♭3, F3. Expansion bounds are reading limits rather than playable-range promises (including low F in the proposed trumpet/horn pool). The teacher confirmed the starting keys/ranges above on 2026-09-27: clarinet/trumpet sound B♭3–F4, alto saxophone sounds B♭3–F4, and horn sounds F3–C4. Expanded ranges remain proposed; new oboe/bassoon/keyboard envelopes stay at their starter bounds until Stage 3 review; the clef catalog permits core implementation to proceed independently. Instrument metadata must resolve transposition with octave (e.g. +14 for a later tenor-sax profile), not infer it from an ambiguous `Bb` string. Euphonium treble-clef convention is a separate future preset. Do not reuse the initial illustrative clarinet E3–C6 as an endorsed beginner range.

## 4. Answer entry and exercise engine

### In-phase Stage 2 update — fixed accidental controls (2026-09-27)

Teacher feedback on the Stage 2 preview supersedes the accidental dropdown and its per-prompt natural reset. Selecting an alteration and then a letter costs too many taps; searching for answers also distorts response-time measurements. This is an in-phase Stage 2 update, now implemented locally; adaptive scheduling remains Stage 3 work.

- Follow-up teacher correction: use a true half-natural-key stagger, with sharps above and flats below the gap between neighboring naturals. Matching sharp/flat positions align vertically. Omit B♯, C♭, E♯ and F♭ entirely; preserve the gaps between B/C and E/F. Normalize exercise pools to exclude these spellings rather than respelling them enharmonically.
- Start the display at the selected key's tonic and repeat that same spelled tonic at the right edge, spanning one full octave inclusively. In C, the natural row is C–D–E–F–G–A–B–C. In B♭, both B♭ endpoints stay on the flat row, while the natural row runs B–C–D–E–F–G–A half a key inward. Sharp tonics use the corresponding sharp row. Both endpoints submit the same letter-mode answer; they do not require octave entry.
- Geometry remains fixed within an exercise, across prompts and adaptive expansion; only changing the configured key rotates the layout. All supported spellings within the octave remain visible. Maintain 44px targets, preserving the full octave with internal scrolling when the left-hand keyboard hints and 44px targets exceed the available width.
- Spellings outside the active exercise pool remain visible but inactive. Enable a spelling if any active pitch uses that letter/accidental, since these answers omit octave. Availability follows the exercise pool, never the current answer; it must not reveal which prompt is being asked.
- Emphasize the in-key spelling for each letter as its default. In F major, B♭ is emphasized in its fixed flat position; B♮ remains in its fixed natural position. This emphasis does not change keyboard letter meanings. Tonic rotation happens at setup, never per prompt.
- Every enabled spelling accepts a direct, single click or tap. Also support press, slide and release through the visible targets with both touch and mouse; highlight the pending spelling and submit on release. Alternatives stay visible without a long press or a gesture. Preserve one-answer-per-prompt, cancellation, and stale/held-input protections.
- When Stage 3 adaptation makes a previously inactive spelling available, enable its existing target with a brief animation, respecting reduced motion. Adding another octave of an already enabled spelling does not create or move an answer button; the staff/expansion announcement conveys that new pitch.
- Share spelling identities, availability, key defaults and answer submission across direct input and slide input. This should support a later piano-keyboard input presentation without duplicating answer logic. Piano geometry and enharmonic-answer semantics remain future design work, not additional Stage 2 scope.

C♭ major is unavailable for new exercises because C♭ has no answer target. Other keys keep their signatures but omit the four excluded spellings from their pools; an empty resulting Custom pool disables Start. Earlier saved Custom configurations and histories remain importable; an unsupported key or now-empty pool needs editing before play.

Single-player keyboard (teacher correction during implementation, 2026-09-27): unmodified A–G always submits the natural letter, independently of the key signature. Hold Up + letter for sharp, Down + letter for flat, Right + letter for natural. These are absolute spellings: B alone is B♮, never B♭. Inactive spellings reject input. Multiple simultaneous arrow modifiers are ignored until only one remains. Enter/Space activates the exact focused spelling. Show these mappings on screen, prevent arrow scrolling while playing, ignore key repeat, reset held modifiers on blur/visibility loss, and disable global shortcuts while editing names/settings. Shift is not an alteration modifier. While a single arrow modifier is held, give its entire row a themed teal glow (Up: sharps; Down: flats; Right: naturals), muted on unavailable spellings. Show an Up/Right/Down keyboard keycap to the left of the matching row, highlighted with that row while held. Keep the keycaps visible when the note area scrolls on narrow screens. Clear both highlights on release, conflicting modifiers, pause, blur or visibility loss. This supersedes the earlier proposal for unmodified letters to use the key signature.

Response times include interface effort. The current preview reports aggregate session response time, not a standardized comparison of keyboard and pointer speed; separating physical input methods for speed benchmarks remains required before introducing speed-based assessment.

Two-panel keyboard controls remain a later-stage design: disjoint letter mappings (left Q–U maps A–G, right Z–M maps A–G) were proposed with left 1/2/3 and right 8/9/0 for ♭/♮/♯. Reconcile alteration mappings with the revised controls before Stage 5 acceptance. Print mappings on screen, retain touch/mouse access, and verify simultaneous key rollover on classroom hardware; turns remain available. Pointer ownership and prompt IDs prevent one panel's event changing the other.

Every prompt accepts exactly one answer. Correct or incorrect, lock input, show feedback, then advance to a new prompt. Wrong answers reveal the expected spelling; there is no repeatedly guessing the same card. Defaults: correct feedback 250 ms, incorrect feedback 800 ms, both included in Challenge time. Practice offers a “Continue after feedback” option for self-paced accessibility; Challenge uses fixed feedback to keep rules comparable. Response time runs from prompt visibility to accepted answer, excluding pauses. A new input requires a new press after feedback.

Use a shuffled bag for adaptive-off sessions, visiting every pitch before reshuffling; avoid adjacent identical prompts when possible. Inject RNG and monotonic clock for reproducible tests. Same-preset competitive streams use the same initial seed; different presets/adaptation have independent streams. Do not promise identical difficulty after differing responses. A one-note pool is legal and explained in setup.

Statistics: attempts count accepted submissions; correct counts correct submissions; wrong resets streak; unanswered timeout cards do not count as attempts. Accuracy = correct / attempts, displayed as a percentage; zero attempts displays “—” and qualifies nowhere. Record per-prompt spelling including octave, selected answer, first-response correctness, active response time, and activity/preset context. Late submissions at or after the deadline are rejected. A Target completion strictly before its deadline counts even if feedback extends past it.

## 5. Adaptive learning and coaching

Adaptive is a per-player toggle in Practice and Challenge, off by default; Flow has none. Maintain state by local profile (or ephemeral session player), preset version/configuration fingerprint, clef, and written pitch. Shared devices must not pool different players' learning records. Turning adaptive off uses exactly the configured pool, regardless of saved adaptive expansion; observations may still inform recommendations.

Initial algorithm (transparent, configurable constants):

1. Retain up to 10 recent outcomes per pitch. Mastered means at least five observations with the last five correct; latency is recorded but does not gate mastery.
2. Weight each active pitch by `1 + 3 × recentErrorRate + unseenBonus`, where unseenBonus=1 with no observations, otherwise 0. Sample by weight, excluding the immediately previous pitch when alternatives exist.
3. Every 10 answers, evaluate the last 20 (no narrowing before 20 exist). Below 70% accuracy, focus the next 10 prompts on up to four highest-error notes; reserve every fifth prompt for the rest of the active set. Never remove notes from the configured learning envelope or lose their history. With fewer than four available notes, use all.
4. Expand only after at least 20 answers since start/last expansion, at least 90% accuracy over the last 20, and mastery of every currently active pitch. Add one eligible outer position from the preset's expansion plan, including its allowed spellings. Alternate lower/upper growth for `both`, starting lower; honor one-sided plans. No expansion during a focus block.
5. Record confusions by expected spelling → selected spelling. If a pair has been confused at least three times in the last 20 answers, schedule one two-prompt contrast pair in the next 10 prompts when both are present; this replaces weighted slots, not the every-fifth review slot. Choose the most frequent pair, deterministic lexical tie-break. No forced adjacent identical pitches.

Precompute the ordered expansion candidates from each preset's filters/bounds. Expansion is finite. Show “Uno added high C” with octave or staff preview when needed for clarity. No speed requirement, hidden difficulty multiplier, or automatic key/accidental-policy change. Store an algorithm version with learned state; incompatible versions reset adaptive working state while retaining summaries.

After 20+ attempts, recommend a broader preset when accuracy ≥90%; suggest revisiting the two most-missed notes when accuracy <70%. Otherwise offer neutral encouragement. Recommendations never modify adaptive-off play. These thresholds are hypotheses to tune after classroom observation, with deterministic tests protecting whichever constants are adopted.

## 6. Challenge rules

All configuration dimensions use one engine: Timed/Target × competitive/co-op × turns/pairs/relay, plus optional teams. Presets and adaptive toggles are always individual. One correct note has the same value across presets; display that this is differentiated practice, not a standardized ranking.

Defaults/ranges: Timed 60 seconds (15–300); Target 10 correct (1–100), timeout 120 seconds (15–600); Target accuracy floor 80% (50–100%); Timed scoring Correct Notes × Accuracy by default, optionally Correct Notes. Timed has no separate qualifying accuracy floor. Setup shows all effective rules before Ready. Numeric settings accept finite integers only.

Let C=correct, A=attempts. Timed raw score=C. Adjusted score=`C*C/A` for A>0, otherwise 0. Compute with full precision, display two decimals, and rank by unrounded score. Target stops immediately on the Nth correct or timeout; ranking requires completion, A>0, accuracy ≥ configured floor, and an uninterrupted run. Exact ties in primary score/time share rank; do not invent streak bonuses or hidden tiebreakers. Time is recorded in integer milliseconds and displayed to hundredths.

Unqualified Target completion displays its time and accuracy without rank: “Nice run! Improve your accuracy to make finals.” Timeout displays correct/target and “Nice practice — try another round.” These words do not imply an automatic finals bracket. No elimination/finals scheduling in v1.

### Scheduling and aggregation

| Format | Allocation and completion |
| --- | --- |
| Turns | Each player receives one full Timed allowance or one Target + timeout; explicit Ready between turns |
| Pairs/heats | Pair players in setup order; up to two play concurrently, each with own clock/target; odd final player plays alone; every player has one turn; completed panel waits without input |
| Relay | One active player per team, at most two teams on screen; timed member turns or target contributions as below; explicit handoff/Ready excludes transition time |

Non-relay co-op Target means **each player reaches N**, not a pool one player can finish for everyone. Group completion requires all participants to complete; display sum of individual active completion times as “Combined playing time,” so sequential/pair formats use the same metric. Show an incomplete group result if anyone times out or ends early. Apply the accuracy floor to each member for a qualifying group result, while still showing pooled accuracy and celebrating contribution.

For all Timed teams/co-op, each player receives T seconds. Aggregate C and A, then apply the chosen formula to the totals (do not sum adjusted individual scores). Unequal competitive teams must be rejected in setup to avoid unequal time budgets. Competitive teams use turns/pairs for individual allocations or relay for ordered handoffs; there are 2–4 equal-sized teams, maximum eight total players. Co-op uses one team and no leaderboard.

Relay Timed: each member gets T active seconds, ordered once through the roster; shared score accumulates, team playing time is memberCount×T. Relay Target: each member contributes N correct with their own timeout; team target is memberCount×N, team time sums active leg times. A timed-out member hands off, and the team result is incomplete/unranked; remaining members can still participate. This deliberately prevents one strong player consuming all target notes. A freely shared target without per-member contributions is deferred. Per-player presets, outcomes, accuracy qualification and coaching remain intact under the team result. Pausing one lane pauses all currently active lanes.

Competitive non-relay teams rank Target by summed member times only when every member qualifies; Timed ranks by the aggregate score and requires every allocated turn to finish uninterrupted. Group/team accuracy is pooled C/A, never the mean of percentages. Individual competitive Timed likewise requires a completed, uninterrupted allowance to rank. All zero-attempt/unfinished/interrupted results are shown but unranked. Keep matches with different rules separate; v1 has no global high-score leaderboard.

Scoreboard: local name, C/A, accuracy, score or active completion time, best streak, completion/qualification status; team totals when applicable. List qualified ranks first, then participation results in roster order. Co-op leads with combined achievement and contribution, never a worst-player list. Duplicate names are permitted but receive visible session numbers; identity uses generated IDs, not names.

## 7. Uno feedback

Reuse the actual existing renderer/poses (`sleep`, `rest`, `wag`, `beg`, `catch`, `happy`), not an assumed six-frame asset sequence. Add a tuNotes-specific progress policy; do not feed note answers into tuner hold-duration logic.

Freeze benchmark B at session start: max(10, best correct count from last five comparable completed sessions). Comparable means same profile, activity, preset fingerprint, adaptive toggle, input method, and Challenge rule/time/target; Practice uses correct counts within the first 20 submitted prompts per session for benchmark comparison so unbounded duration does not inflate rewards; only sessions reaching 20 submissions supply a Practice benchmark. Target uses its N as B. Interrupted/partial runs do not set benchmarks. With no history B=10 (except Target N). This is a reward benchmark, not a mastery rule.

Use correct-count progress B: start sleep/rest; 20% interested/rest with look gesture; 40% wag; 60% wag with nod; 80% beg; 100% catch then happy. Fire each milestone once per run, including when small targets cross several thresholds at once; coalesce to the highest reaction. Wrong answers reset streak only, not accumulated progress or earned treats. Streaks 5/10/20 trigger small positive text/nod, without scoring bonuses or overlapping treat animations. Reduced motion uses static poses and text. Flow uses quiet resting Uno, no fabricated mastery or rewards for unanswered notes.

## 8. Flow timing

Defaults: time mode, 2 seconds per note, hint during final 1 second, Next visible. Time interval 0.5–30 seconds in 0.5 increments; beat mode 30–240 BPM, 1–16 beats/note (quarter-note pulse), default 60 BPM and 4 beats/note. Optional count-in off or 1–8 beats (default 4 when enabled); time-mode count-in uses one-second pulses. Click off by default and independently toggleable.

Hints: Off, Always, or Last X seconds/beats. Default X is half duration, fractional beats allowed; validate 0<X≤duration. Current label reveals at `promptStart + duration - hintDuration`, with reduced-motion-compatible appearance. Next is never labeled. Queue current/next in advance; each transition promotes exactly the previewed note. At count-in show “Ready” without exposing the first current note until play begins.

Use absolute monotonic deadlines in time mode and a musical timeline in beat mode, never accumulate setInterval drift. Share tUno's scheduling primitives; visuals read the timeline. Pacing edits apply on the next note boundary, preserve the preview, and recalculate the hint for the new interval. Resume preserves remaining current duration and hint state. If a stall skips a whole interval, pause with “Resume reading”; do not flash through missed cards. Failure to start optional audio still permits silent timing. Stop returns to setup and discards the preview queue. No response, accuracy, adaptive, or scored history is recorded.

## 9. Local data, privacy and recovery

No account or saved name is necessary. Guest sessions are memory-only by default; users opt into Remember progress and choose/create local profiles. Names: 1–40 trimmed characters, rendered as text; fallback Player 1 etc. Config preferences may save independently of progress. Explain: “Progress is saved on this device. Clearing browser or site data may erase it. Export a backup if you want to keep it.” File moves/renames and browser differences can change storage context; the HTML file does not contain saved progress.

Use a tuNotes-only versioned localStorage namespace, never overwrite tUno preferences. Keep a single validated data snapshot so replacement is one storage write; if its size exceeds available quota, retain the in-memory snapshot and offer export. No IndexedDB dependency is needed for these bounded summaries. Stage 2 uses schema version 1; the explicitly supported version 0 backup shape has identical records but no configuration, migrated to Guest/default setup on a copy. No other legacy format is inferred. Initial JSON store has schemaVersion, appId, profiles (IDs/names), custom presets, configuration, versioned adaptive summaries, and recent results. Cap at 32 profiles, 100 summaries per profile, and 10 outcomes per tracked pitch; do not retain unlimited event logs. Keep at most 128 preset-context records per profile, pruning least-recently-used records. Custom presets are capped at 100. If the complete compact snapshot exceeds 5 MiB, prune oldest observation contexts across profiles, then oldest results if necessary, so exported backups remain importable. Practice keeps only the latest 100 raw in-session observations plus aggregate totals and first-20 correct counts. Debounce saves after answers and flush at safe lifecycle boundaries without relying on unload. Storage denial/quota/corrupt content switches to usable in-memory mode with an unobtrusive explanation and export still available.

Export is a local JSON download with app ID/schema version and no executable content. Import limit 5 MiB; validate all types, sizes, IDs, finite numbers, bounds, references, and schema before writing. Reject future versions with a useful message; migrate supported older versions on a copy. Ignore neither invalid fields nor corrupt records silently. Preview counts and offer explicit **Replace tuNotes data** (initial import mode; merging deferred). Retain the previous snapshot in memory until the validated replacement storage write succeeds; on write failure preserve existing saved data and report that import was not committed. In a storage-unavailable session, explicit replacement may update memory only, with that limitation shown before confirmation. Names never become HTML. Do not restore an active game or audio permission state. Delete controls explain their local scope and require confirmation; deleting a profile removes its learning/results. Export/import must work for hosted and portable modes, with manual Save As guidance if the browser cannot trigger download normally.

## 10. Accessibility and layouts

Keyboard, mouse and touch must support every setup/control path. Visible focus, semantic buttons/labels, no color-only feedback, 44 CSS-pixel minimum answer targets, usable 200% zoom, reduced motion, and independent named panel regions are required. Proposed pairs threshold: available content width ≥960 CSS pixels and height ≥600; verify actual staff/key/control fit and fall back to turns at setup if insufficient. Phones support all features through turns, not shrunken simultaneous panels.

Do not leak the expected answer into hidden DOM labels before submission. The staff's accessible description names clef/key/position (e.g. “Treble clef, C major, third space”), not the target spelling; this permits an alternative positional exercise but is not equivalent to visual reading. Feedback reveals the answer in a polite live region. Avoid announcing every timer tick; announce start, final ten seconds once, and end. Flow's answer hints are announced only when configured visible; Next remains unlabeled. Evaluate actual screen-reader usability and document the visual nature of staff reading.

## 11. Same-repository architecture and DRY boundaries

Keep one package.json, lockfile, TypeScript toolchain and build/verification pipeline. Two application entry points share small internal modules; do not introduce a workspace/package-publishing system for two apps. A single-file deliverable does **not** require single-file source. No application imports the other application's store or screen shell.

Proposed destination layout (created incrementally, not a prerequisite mass move):

```text
src/
  main.ts, index.html       # existing tUno entry kept compatible
  ui/, practice/           # existing tUno-specific UI/state/feedback
  apps/tunotes/
    main.ts, index.html, styles.css
    domain/                # spelling, presets, instrument metadata, scoring
    engine/                # exercise, adaptive, challenge scheduler, flow
    state/                 # reducer, events, clock/input adapters
    ui/                    # screens, staff renderer, answer panels
    persistence/           # schema, migrations, backup
  shared/
    ui/                    # Uno renderer/pose type, genuinely common controls
    audio/                 # extracted lifecycle/scheduler when second use exists
  music/, audio/, assets/   # existing pure utilities/assets reused in place first
  distribution/            # shared distribution behavior parameterized by app
scripts/
  build.mjs                # app descriptors; builds both before packaging release
  ...                      # existing tests plus tuNotes and cross-app checks
```

| Existing source | Reuse decision and boundary |
| --- | --- |
| `src/ui/uno.ts`, `src/assets/uno-*.svg` | Share renderer/assets; move pose type out of tuner feedback; add disposal for listeners/animations before repeated mounts |
| `src/practice/feedback.ts` | Keep tuner feedback specific; new tuNotes progress policy consumes answer counts |
| `src/music/pitch.ts` | Reuse numeric conversion/transposition; new explicit spelling domain owns notation |
| `src/music/rhythm.ts`, `src/audio/click.ts` | Reuse pure timeline/click synthesis; extract scheduler at Flow stage with tuner regression coverage |
| `src/audio/controller.ts` | Currently imports PracticeStore, display and tuner state; do not import wholesale into tuNotes; extract lifecycle/capture adapters only when needed |
| `src/tokens.css`, `src/ui/components.ts` | Share tokens and generic element/control helpers; scope app-specific layout and Uno CSS to prevent collisions |
| `src/practice/preferences.ts` | Keep tUno key/schema; share safe-storage utility only if useful, not app data models |
| `scripts/build.mjs`, `src/distribution/*` | Parameterize product identity, paths, metadata and release manifest; retain existing tUno outputs and update invariants |

Dependency direction: app UI → app engine/domain and shared presentation; engine → pure domain and injected services; shared modules → no app store/UI imports. Audio context belongs to each running document; two windows cannot assume a shared context, mic, or clock. Shared source appears in each independent portable bundle by design; DRY concerns maintenance, not requiring a common runtime file.

Build descriptors supply app ID/name, entry/template, portable filename, hosted subdirectory, manifest identity, metadata prefix, and offline resources. Continue `dist/hosted/` for tUno, add `dist/hosted/notes/` for tuNotes, and `dist/portable/tunotes.html`. Use hosted `/notes/` only as the proposed published path; no deployment changes are part of this spec task. `npm run build` builds both, clearing dist once. Keep existing `npm run dev` behavior; add `npm run dev:notes`. Existing scripts remain available; `check` and `verify` must cover both apps before full release.

Use separate manifest IDs, download names, cache namespaces, and `/notes/` worker scope. The root tUno worker has broader path scope: explicitly test/update its request handling so it never serves tUno HTML for tuNotes navigation/assets, even before the narrower worker takes control. No HTML fallback for missing resources. Retain scope-isolated cache deletion, integrity verification, deferred activation while tabs remain open, and independent offline-ready status. First-visit tUno caching must not claim tuNotes is offline-ready. Portable apps register no worker and need no sibling file. Cross-app links are optional conveniences; portable copy explains the sibling tool without assuming it is present.

Use one repository release version initially, per-app content build IDs/checksums, and common source revision/dirty metadata. Extend release.json additively so existing tUno checks remain compatible; include each app's hosted resources and portable checksum. Include both apps' source/license notices. Hosted deployment contains both products atomically; regression gates cover tUno even when a shared change originated in tuNotes. Production publication still follows [hosting](hosting.md) and [release instructions](releasing.md).

## 12. Deferred microphone contract

Define an input adapter that submits a prompt-scoped answer observation, so letter input does not couple engine code to DOM events. Future mic Practice maps detected concert pitch to written pitch with octave-aware instrument metadata and uses chromatic pitch plus octave for matching. A detector cannot distinguish enharmonic spellings; the displayed target supplies spelling. Keep this explicitly different from letter-mode spelling validation.

Mic mode is solo Practice initially. Acceptance stability, silence/re-articulation gating, confidence/noise thresholds, cents tolerance, octave policy and device evidence must be specified and tested before enabling it. It must not inherit tuner display smoothing as answer evidence or submit continuously held notes to several prompts. Permission rejection leaves letter mode available. Do not request microphone access in the initial release. A4 calibration belongs to that future input configuration, not ordinary written-name practice.

## Preset picker and graphical configuration (September 2026)

The preset control opens a compact, keyboard-accessible modal popover. Choose Clef or Instrument, then a specific clef/instrument, then an existing level. Back navigation retains context. Saved custom presets and Create custom remain directly accessible. Instrument levels currently consist of Starter; do not invent unreviewed ranges.

Custom configuration layout:
1. Lowest note and Highest note, side by side: selectable staff positions, draggable notes, keyboard arrows, readable pitch labels, clickable clefs, and full-width flat/natural/sharp endpoint segments.
2. Lines / Spaces / Both, mutually exclusive.
3. Modifiers, multiple selection with + off / check on: Key (inline major-key dropdown), Flat, Natural, Sharp. Key order: C, F, Bb, Eb, Ab, Db, Gb, G, D, A, E, B, F#. Choosing a key enables Key. Modifiers add spellings independently; endpoint accidentals bound the range rather than enabling spellings throughout it.
4. Available clefs: Treble / Bass / Alto / Tenor, multiple selection, initially inferred from endpoint clefs, then explicitly editable. At least one is required.

Endpoint clefs initially move together and preserve pitch. Changing the opposite endpoint to a different clef asks confirmation before enabling mixed-clef practice. Explicit clef toggles require no confirmation. Assign pitches to an enabled clef with the fewest ledger lines (then closest to staff center); apply Lines/Spaces in that clef. Ledger lines are derived descriptive information, never a second range restriction. Show the resulting note count and actionable errors for reversed/empty ranges. Preserve previous custom settings and backup round trips.
