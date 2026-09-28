# Challenge presentation and ongoing rewards

Implemented on `feature/challenge-scene-rewards`, 2026-09-27, based on `ce3ac11`. This records the follow-up to Phase 4's first Challenge preview.

## Behavior

- One persistent note-area panel contains Ready, countdown, remaining time/progress, pause and the final scoreboard. The exercise note is hidden before play and during pauses; an empty staff remains as the backdrop. Uno is centered in his wag pose for Ready/countdown, then moves beside the notes. Reduced motion retains a static pose. Pause requires explicit Resume and retains the existing unranked rule.
- The solo scoreboard leads with points or seconds, correct count, accuracy and best streak. One encouraging sentence and Play again / Change setup replace the dense inline report. Round details contains the optional local name, preset, rules, attempts, active time and qualification. The panel remains in place; expanding details may grow it. Programmatic focus does not scroll the count-in or draw the old large heading outline.
- After the first benchmark treat, the approved gap is `max(3, ceil(max(B, recentPeakStreak) / 5) - ceil(recentWrongs / 4))`, recalculated after each accepted answer. The last 20 answers retain full running streak values (so a continuing streak of 61 contributes 61), plus wrong-answer flags. Old peaks and mistakes expire. Only correct answers advance accumulated treat progress and earn treats; mistakes can lower the gap without awarding a treat. A visible remaining-count cue updates with the schedule. First treats for Target goals below 10 now honor the actual target. Catch reactions continue across subsequent answers and final results without overlapping successive rewards.
- These rewards apply to Practice and Challenge. Retry resets the in-session schedule. Scoring, qualification, saved learning and backup schema remain unchanged. The constants are a starting point for classroom review, not evidence of educational efficacy.

## Evidence

Node **24.21.0**, dependencies installed with `npm ci`. Tested tuNotes build **`61bc293c30703c98`**, tUno **`30f867a5354db0c9`**, from the working tree based on `ce3ac11`; see [release metadata](tunotes-challenge-scene/release.json).

- `npm run check`: TypeScript, **88 unit tests**, both builds and portable resource checks passed.
- `tests/tunotes-rewards.test.ts`: ongoing rewards through 61 correct answers, expanding intervals, mistake relief, expiration of old peaks/misses, retained progress, no rewards on misses or duplicate callbacks, retry isolation, three-correct repeat minimum and small Target goals.
- Chromium and Firefox `notes-challenge-browser-check.mjs`: hosted and relocated cold-offline portable runs passed. Coverage includes the existing rule/deadline/outcome flow, unchanged note-panel document position and size across phases, centered wagging countdown, hidden exercise notes before Go, reduced motion, scoreboard/details, 360/768/1280 widths, and eight actual catch-pose transitions during a 61-correct run. Adding a wrong answer reduces the remaining gap from seven to six without a ninth reward; the final score is 60.02 at 61/62 and 98% displayed accuracy. Reports: [Chromium](tunotes-challenge-scene/notes-challenge-chromium.json), [Firefox](tunotes-challenge-scene/notes-challenge-firefox.json).
- Both browsers also passed `notes-ui-browser-check.mjs`, `notes-browser-check.mjs`, `notes-adaptive-browser-check.mjs` and `dual-app-browser-check.mjs`, covering Practice controls, lifecycle/input isolation, preview/restored adaptation, reduced motion, worker/cache isolation and both apps' independent offline builds.
- `node scripts/release-check.mjs`, local documentation-link review and `git diff --check` passed.

Developer visual review: [countdown](tunotes-challenge-scene/notes-challenge-chromium-hosted-countdown.png), [play](tunotes-challenge-scene/notes-challenge-chromium-hosted-playing.png), [phone scoreboard](tunotes-challenge-scene/notes-challenge-chromium-hosted-360.png), [desktop scoreboard](tunotes-challenge-scene/notes-challenge-chromium-hosted-1280.png).

The full release `npm run verify` suite was not rerun. Physical-device and classroom acceptance of the presentation and reward pacing remain pending. This work does not publish to production.
