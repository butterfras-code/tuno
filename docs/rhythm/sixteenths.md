# Uno234 sixteenths and counting systems

**Counting migration, 2026-10-14:** the running editor now follows the [counting-schemes specification](counting-schemes-spec.md#coordinated-editorsettings-migration-2026-10-14). Sparse plan counts replace grid answer slots; R/D toggle inferred units; all counting settings are pending until New exercise. There are no optional counts, range endpoints or immediate token translations. 6/8 inputs follow enabled rules, not an every-eighth requirement. The counting/editor tables and validation below record the earlier slice; written notation, generation restrictions and performance timing remain applicable unless explicitly updated.

This slice extends the shared Uno234 activity, not the reserved future Rhythm Walk game mode. Write Counts, Tap Rhythms and Both use the same canonical written events, generator, fixtures, renderer and exact sounding chains. No scoring formulas, tolerances, tempo fitting or completed-results UI changed. This is feature work; no production promotion is authorized.

## Vocabulary and generation policy

In 2/4, 3/4 and 4/4, `S` notes/rests and `E` with one dot are now supported alongside the existing vocabulary. Sixteenth notes, sixteenth rests and dotted eighth notes are separate opt-in ingredients. Existing defaults remain unchanged: two measures, configurable 1–4, 4/4, the previous ingredient selections, ties/syncopation off. Changes apply on Next/New Exercise, never on a response-mode change.

6/8 retains its existing written vocabulary, six required numbered eighth counts and two dotted-quarter performance pulses. New ingredient selections persist in a mixed meter pool but are omitted from 6/8 generation. Every selected meter must still have a compatible complete-bar solution; unsupported-only 6/8 selections explain why Next is blocked. The generator never inserts unselected values to fill a bar.

For readable simple-meter generation, values shorter than a quarter stay within one quarter-beat group. Dotted eighth notes start on a quarter beat; their completion must use selected compatible ingredients, ordinarily a sixteenth note/rest. These are generator restrictions, not domain limitations. Allow unintuitive notation relaxes these placement restrictions, while the separate syncopation switch still prevents offbeat sounding attacks from crossing the next quarter beat when off. Existing rest placement, bounded tie chains and at most one syncopated attack per measure continue to apply.

Primary beams group short notes within a quarter beat in simple meters and within a dotted-quarter pulse in 6/8. Four sixteenths, E S S, S S E and dotted E S share this rule. Secondary beams join adjacent sixteenths; isolated secondary levels use partial beams pointing into the group. Isolated short notes have one/two flags. Written short rests retain their glyphs inside beam groups; longer values break groups. Sixteenth rests use two hooks, and dotted eighths retain their written dot. Complete sounded eighth triplets are now supported by the separate [triplet slice](triplets.md). Other tuplets, thirty-seconds, quintuplets and dotted-eighth rests remain outside this UI boundary.

## Counting and switching

| Quarter-beat position | `1 e & a` | `1 e + a` display/input | `1 ta-te-ta` |
| --- | --- | --- | --- |
| Beat onset | number | number | number |
| 1/16 after beat | e | e | ta |
| 1/8 after beat | & | + | te |
| 3/16 after beat | a | a | ta |

Hyphens only separate syllables in the system name. `ta` and `te` are atomic stored answers. Their positions, not token uniqueness, determine correctness. `&` and `+` inputs normalize to the same stored `&` token; the independent saved display preference survives selecting syllables and switching back. Missing legacy `countingSystem` preferences default to `numbers` without resetting any other valid preferences or selected ingredients. The existing version-1 storage key stays compatible.

Written note/rest attacks and internal quarter beats of sustained sounds require counts. Tied offbeat continuations alone require no new count; each written rest has its own parentheses. Existing dotted-quarter conventions still apply only to their internal **eighth** positions, including when another event makes the measure's grid finer. Optional local subdivisions remain teacher-review answers, not automatically required counts. A dotted eighth plus sixteenth on beat 1 therefore requires only `1 a` or `1 ta`; optional `e/&` or `ta/te` are not filled automatically.

Switching preserves exercise identity, score nodes, answer coordinates, saved duration/rest ranges, performance evidence and completed results. Recognized `e`, `&`, `a` normally map to `ta`, `te`, `ta`. However an incorrect `e` at the fourth subdivision, or incorrect `a` at the second, is cleared: collapsing the two meanings would silently correct the mistake. On return, `ta` resolves to `e` or `a` only at those coordinates; elsewhere it is cleared rather than guessed. `te` maps back to `&` even at an incorrect coordinate, retaining the error. Numbers stay unchanged. Unsupported tokens clear individually. A visible status explains clearing, and all stale count feedback is removed until Check. 6/8 disables simple-meter controls and retains their preferences.

## Editor and layout coordinates

The count adapter derives an exact 1/16 lattice only for simple-meter measures containing S or dotted E; other measures retain the 1/8 presentation lattice. Available positions come from the shared exact local written-value policy. Fine and coarse measures can coexist, with passage offsets derived from their actual answer sizes. Slot indices are never passed to capture as musical time.

Notation, counts, duration controls and performance timelines use the same derived horizontal mapping. Dense bars take a full-width system. At compact widths, count and duration controls occupy separate subdivision lanes with 44px targets; musical horizontal positions remain shared with the notation/timelines. This adds vertical space instead of shrinking or overlapping count targets. Notation entry targets stop at neighboring onset midpoints; beams do not intercept another note's entry. Fine-grid rest pairs have compact bracket edges and full-size Start/Close/Remove rest actions in the count popup, avoiding ghost targets across neighboring lanes. Count centers remain tappable after adjacent rest pairs are completed. Keyboard parentheses and bracket editing remain available. Duration endpoints still include trailing hidden subdivisions; ties and logical duration spans cross visual systems without changing their musical meaning.

Type `t`, then `a` or `e`, to commit `ta` or `te` once and advance once. The first `t` only starts a transient buffer and announces the next keys. Backspace/Delete cancel an incomplete syllable without removing the saved token. Navigation, Escape, focus loss, pointer entry, system/mode changes and editor suspension clear incomplete input. Arrow/Tab navigation and ordinary saved-token deletion remain unchanged. Touch choices offer every token in the selected system at every available slot; there is no answer filtering or automatic filling.

## Independent fixture expectations

The written fixtures and hand-derived onset tables in [tests](../../tests/rhythm-sixteenths.test.ts) are independent of generator output and expected-symbol iteration. They are implementation review evidence, not external teacher approval.

| Fixture | Independent first-beat required counts | Notes |
| --- | --- | --- |
| `four-sixteenths` | 1 e & a / 1 ta te ta | Followed by Q H; half line ends at final hidden fine slot. |
| `eighth-two-sixteenths` | 1 & a / 1 te ta | E S S, mixed beam levels. |
| `two-sixteenths-eighth` | 1 e & / 1 ta te | S S E, mixed beam levels. |
| `dotted-eighth-sixteenth` | 1 a / 1 ta | Final ta is subdivision four; earlier local subdivisions optional. |
| `sixteenth-rests` | All four subdivisions on each beat | One rest at phase 0, 1, 2 and 3 in successive beats; separate pairs. |
| `sixteenth-all-rests` | All four subdivisions on each beat | Sixteen adjacent written rests and independent pairs. |
| `sixteenth-tie` | 1 & 2 / 1 te 2 | S~S E Q; one line through the two tied sixteenths. |
| `sixteenth-bar-tie` | 1 2 & a / 1 e & 2 (numbers) | Final S ties into next bar's first S; no new attack/count at the offbeat continuation solely because it is written. Two visual duration pieces, one answer. |
| `dense-sixteenths` | 1 e & a … / 1 ta te ta … | Four 4/4 bars, 64 sounding attacks; desktop and 320px target checks. |

## Validation evidence and limits

Node 24.21.0 with `npm ci`; `npm run check` covers type checking, all unit tests and hosted/portable builds. New tests include hand-derived correct/incorrect answers, duplicate ta semantics, safe translation, buffered input, legacy persistence, new ingredient subsets in all meters/lengths and tie/syncopation combinations, exact totals, no 6/8 leakage, optional positions, finer duration/rest endpoints, mixed coarse/fine offsets, and calibrated raw versus corrected Tap/Hold timelines. Existing shared preset tests automatically exercise the new fixtures in both evaluators.

The resumed-work validation passed **279 unit tests**, type checking and hosted/portable builds with `npm run check`, plus `git diff --check`. Native T3 [editor scenarios](../../scripts/rhythm-sixteenths-browser-scenarios.js) passed **111 assertions** covering DOM focus, synthetic keyboard input, touch-menu choices, response/system retention, 6/8 controls, dense hit-testing/target separation/overflow, individual rest pairs, wrapped ties and partial beams at desktop and in a same-origin 320px iframe. Fresh iframe loads also verified real localStorage migration and persistence without resetting tempo, mode, length, ingredients or the independent &/+ preference. Native [performance scenarios](../../scripts/rhythm-sixteenths-performance-scenarios.js) passed **24 assertions at each width (48 total)** for Tap and synthetic-pointer Hold with controlled timestamps, real audio-clock count-in/completion, exact dotted/sixteenth plans, preserved raw evidence/completed results, shared score identity and sustain/timeline alignment. Native clicks established keyboard focus and unlocked audio before synthetic scenarios.

Environment-port navigation failed; localhost navigation reached an older running build. The freshly built HTML/CSS/JS, including fonts, was therefore loaded inline into the native localhost preview. Native resize timed out; the 320px same-origin iframe checks actual CSS layout and interaction geometry, not a physical mobile browser. The final review also fixed overlapping notation entry rectangles across beamed groups and preserved the accessible system-switch announcement after editor refresh.

Physical keyboard/touch capture, hardware latency, physical phones/tablets, Safari/Chromebook, audibility and assistive-technology acceptance were not tested. Full release verification and Cloudflare release-candidate review were not performed. Scoring remains unchanged and provisional. A reproducible dense-assessment latency example is recorded in [scoring follow-up](sixteenth-scoring-follow-up.md).
