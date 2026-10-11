Current activity contract: [Rhythm Walk now unifies Write Counts, Tap Rhythms and Both](unified-activity.md). This record preserves earlier implementation decisions; descriptions of separate activities, fixed performance-only repertoire, reset-on-reload preferences and old naming are superseded. Musical counting and notation rules remain applicable.

# Count Writing meters

Implemented slice: 2/4, 3/4, 4/4 and 6/8, one selected meter throughout an exercise. Default is 4/4 and two measures; length is configurable from 1–4. Meter, ingredients, notation policy, ties and syncopation apply only on Next/New Exercise, retaining the current exercise and answer until then. Presentation/view changes retain the answer. Reload restores defaults.

## Four separate concepts

Written values and their exact fractions remain in the [canonical model](music-model.md). Count Writing's [meter policy](../../src/apps/count-writing/meter.ts) distinguishes counting unit, notation grouping and future performance pulse:

| Meter | Counting | Notation groups | Performance pulse | Answer storage positions per bar |
| --- | --- | --- | --- | --- |
| 2/4 | Quarter numbers 1–2, eighth offbeats & or + | Two quarter groups | Quarter, twice per bar | 4 |
| 3/4 | Quarter numbers 1–3, eighth offbeats & or + | Three quarter groups | Quarter, three times per bar | 6 |
| 4/4 | Quarter numbers 1–4, eighth offbeats & or + | Four quarter groups | Quarter, four times per bar | 8 |
| 6/8 | Six numbered eighth positions: 1 2 3 4 5 6 | Two groups of three: 123 / 456 | Dotted quarter, twice per bar | 6 |

Numbers reset each measure. In 6/8 **every position requires its number**, even inside a note, tie or rest. No alternative compound syllables or internal offbeats apply. The &/+ and dotted-quarter teacher preference remain saved for simple meters and are disabled while reviewing a 6/8 exercise. Changing pending meter settings does not alter the current exercise's convention.

6/8 keeps canonical default groups `[3, 3]`. Choosing six numbers does not change the performance pulse to six eighths. Derived `onCount` and `onPulse` flags make this distinction explicit. Answer indices, rest pairs and duration lines are presentation coordinates derived from exact score positions, never authored time or future playback ticks. Passage offsets accumulate actual per-measure grid sizes; visual wraps do not change offsets or grading.

## Duration lines and rests

Simple meters retain the existing required onset/quarter counts and dotted-quarter required/optional/review policy. Untied notes/rests require a duration line when they contain an internal quarter count; ties always require one line for the entire sounding chain.

In 6/8, an untied note or written rest lasting **more than one eighth** requires one line from its onset number through the final numbered position before release. A quarter covers two numbers; a dotted quarter covers three; a half covers four. Endpoints in 6/8 are exact required positions, not the simple-meter provisional endpoint trial. A tied equivalent uses the same counts and one line for the complete sounding chain, regardless of written segments, barlines or wraps. A continuation is never a new attack. Each written rest has its own parenthesis pair, enclosing all of its numbers and its line where required; neighboring rests never share a pair.

Default simple-meter rest policy permits eighth rests anywhere and quarter/half rests only on quarter starts where they fit. Dotted-quarter rests and offbeat longer rests require Allow unintuitive notation. In 6/8, individual rests must fit wholly inside their three-eighth group. Quarter rests can occupy counts 1–2, 2–3, 4–5 or 5–6; dotted-quarter rests normally occupy 1–3 or 4–6, requiring no opt-in. Eighth rests can occupy any count. Half rests cannot fit a group: uncheck them or explicitly permit unintuitive notation. Ingredient selection is preserved on meter changes, so incompatible selections report an error rather than being silently removed.

Silence crossing 3/4 is spelled with separate enabled rests on either side. For example, silence on counts 2–4 uses a quarter rest on 2–3 and an eighth rest on 4, each with its own pair. The generator builds this spelling from selected written values; it does not insert unselected fallback rests. If enabled rests cannot fill groups or a selected value cannot occur in any complete bar, reject the configuration. The opt-in permits longer/off-group rest spellings, retaining the same exact counts and grading.

## Ties, pulse restrictions and bounded generation

Ties permit one chain of 2–3 enabled written note segments per exercise, including across bars; rests cannot start/receive ties. Syncopation permits at most one off-pulse sounding attack per measure sustained **across** the next pulse boundary. In simple meters the boundary is a quarter; in 6/8 it is a dotted quarter. Ending at that boundary is permitted when syncopation is off. Thus a 6/8 quarter at count 2 ends at pulse 4 and is allowed; a quarter at count 3 continues through pulse 4 and needs syncopation. An on-pulse note may cross subsequent pulse boundaries. Apply the restriction to complete sounding tie chains, not their continuations.

Controls permit patterns rather than guaranteeing each draw. Empty, unfillable, ineffective ingredient pools and unattainable ties/syncopation report errors and disable Next/New Exercise. Planning memoizes finite exact-time positions; generation only selects paths known to complete a bar. Randomness is injected for reproducible tests. Tie candidates are finite and use the existing bounded 65% draw.

## Explicit review answers

`Q.` is a dotted quarter; `r` marks a written rest; `~` joins a tie; `/` separates measures. All 6/8 answers require every number. Lines below use one-based count labels, not storage indices. Parentheses are separate answer markings.

| Fixture | Written music | Required answer / duration lines |
| --- | --- | --- |
| `meter-2` | 2/4 Q E E | `1 2 &`; no lines |
| `meter-3` | 3/4 Q E E Q | `1 2 & 3`; no lines |
| `six-eighths` | E E E /group/ E E E | `1 2 3 4 5 6`; no lines; two beams, 123 and 456 |
| `six-dotted` | Q. Q. | `1 2 3 4 5 6`; lines 1–3 and 4–6 |
| `six-quarter-eighth` | Q E Q E | All six; lines 1–2 and 4–5 |
| `six-eighth-quarter` | E Q E Q | All six; lines 2–3 and 5–6 |
| `six-rest-first` | Q.r Q. | `(1 2 3) 4 5 6`; lines 1–3 and 4–6 |
| `six-rest-second` | Q. Q.r | `1 2 3 (4 5 6)`; lines 1–3 and 4–6 |
| `six-adjacent-rests` | Qr Er Q. | `(1 2) (3) 4 5 6`; lines 1–2 and 4–6 |
| `six-rest-boundary` | E Qr Er Q | `1 (2 3) (4) 5 6`; lines 2–3 and 5–6 |
| `six-tied-quarters` | E~E E E~E E | All six; lines 1–2 and 4–5, equivalent to Q E Q E |
| `six-tied` | Q~E E~Q | All six; one line 1–3, one 4–6; continuations at 3 and 5 |
| `six-bar-tie`, `six-wrap` | Q. Q.~ / Q. Q. | All six in both bars; lines bar 1 counts 1–3, bar 1 count 4 through bar 2 count 3, bar 2 counts 4–6 |
| `six-syncopation` | Q Q Q | All six; lines 1–2, 3–4, 5–6; attack 3 crosses pulse 4 and requires syncopation permission |

Open the fixtures in Review fixture or `?fixture=<id>`. [Explicit-answer and generated invariant tests](../../tests/count-meters.test.ts) cover these expectations independently of generated grids, all ingredient subsets, all meters and lengths, numbering resets, exact totals, selected-only values, rest placement, pulse restrictions, and independent grading. [Browser checks](../../scripts/count-writing-meters-browser-check.mjs) cover consecutive/wrapped desktop and narrow mobile layouts, numeric touch entry, keyboard navigation and the practice loop.

## Limits and validation

Mixed meters, additional meters, tuplets, sixteenths/smaller values, alternative compound counting, audio/performance input and saved settings are outside this slice. The earlier dotted-half review fixture remains supported. Cross-system duration editing uses anchors, Shift/arrows and selectors; dragging across systems remains unavailable. Narrow notation uses the existing shared horizontal scroller.

Physical-device, Safari, Chromebook, classroom/teacher review and release acceptance remain separate from automated browser validation. This feature does not publish production.

Validation used Node 24.21.0 and `npm ci`. `npm run check` passed type checking, all **157 unit tests**, and hosted/portable build checks. `npm run test:counts:browser` and `TUNO_BROWSER=firefox npm run test:counts:browser` passed all existing fixture/practice/tie regressions plus the meter suite. Both engines checked every supported meter, lengths 1–4, independent ties/syncopation settings, consecutive/wrapped notation, and the Check → Retry → Next/New Exercise loop at **1280px and 320px**. Fixed musical expectations also check beaming, six-number touch entry, saved rest cancellation, shifted rest navigation and cross-bar line cancellation with no remaining draft. Seeded invariants cover every ingredient subset under both notation policies. Updated rhythm documentation links and `git diff --check` passed.

Browser review found and fixed touch popover scrolling that let a synthetic tap start a duration line, and passage-line Escape cancellation after rendering removed the focused button. The recent rest-parentheses priority fix is preserved, with physical Shift keydown/keyup regression coverage. Desktop and narrow mobile screenshots were visually reviewed. Reports and screenshots are in `dist/validation/count-writing-{chromium,firefox}`, `count-practice-{chromium,firefox}`, `count-ties-{chromium,firefox}` and `count-meters-{chromium,firefox}`. This remains local feature work on `feature/count-writing-meters`; no integration or production branch was advanced and nothing was pushed. Full release verification, Cloudflare candidate review and physical-device acceptance were not performed.
