# Typed source migration validation

2026-10-15, local feature work. No production publication or branch integration.

## Contract

Generation and fixtures produce `RhythmScore`; Activity, CountingPlan, engraving and active capture share its immutable source. The temporary legacy-score adapter is removed. Derived beat/layout views still exist, but contain no separately authored rhythm. Completed JSON evidence now carries `exercise.score` rather than `exercise.measures`; the diagnostic envelope and assessment-policy versions remain unchanged. There is no saved-attempt import UI, and old exported JSON is not automatically migrated.

Count inputs expose position and entered state without an expected-answer token in their accessible name. This does not remove the separately labeled written notation or intentional answer feedback.

## Automated checks

- Node 24.21.0, TypeScript, 441 unit tests, application/portable builds via `npm run check`.
- Independent historical timing oracle: every fixture and seeded generated material across all four meters and 1–4 bars, at 40/80/180 BPM. Exact sounding attacks, tie references, final tied-member duration, rest spans and overall duration agree. Existing scoring/hold/calibration/reward regression expectations remain unchanged.
- Chromium and Firefox counting suites: 320, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920 and 2560 CSS pixels. Editor, responsive geometry, sharing/session preferences, keyboard entry and restoration checks pass. Reports: `dist/validation/counting-plan-{chromium,firefox}/report.json`.
- Completed Tap and Tap + Hold checks use the real audio clock and synthetic keyboard edges at 120 BPM. They verify eight matched attacks, no extras/missing attacks, full hold credit on eight eligible held notes, result focus, typed evidence, mode-switch preservation and Next exercise. Accessibility snapshots record empty and entered count names. Reports: `dist/validation/rhythm-source-{chromium,firefox}/report.json`.

Reproduce with `npm run dev:walk` running, then:

```sh
COUNT_WRITING_URL=http://localhost:5173/prototypes/rhythm-walk/ TUNO_BROWSER=chromium node scripts/counting-plan-browser-check.mjs
COUNT_WRITING_URL=http://localhost:5173/prototypes/rhythm-walk/ TUNO_BROWSER=firefox node scripts/counting-plan-browser-check.mjs
TUNO_BROWSER=chromium node scripts/rhythm-source-browser-check.mjs
TUNO_BROWSER=firefox node scripts/rhythm-source-browser-check.mjs
```

## Physical acceptance still required

No connected touch test device or installed screen reader was available in this environment. Browser touch emulation and accessibility-tree inspection are not substitutes for these checks. WebKit/Safari was not validated.

Before declaring full device acceptance:

1. On a real iPhone/iPad and Android device, finish Tap and Tap + Hold attempts; verify audio activation, repeated touch/release capture, held ties, intentional rests, cancellation and result actions. Test the actual classroom audio route.
2. With VoiceOver/Safari and a desktop screen reader/browser, navigate empty counts, enter/change counts, use R/D and arrow keys, and confirm empty names announce position without the answer. Check feedback announcements, result-heading focus and retry/next navigation.
3. Record browser/OS/device versions and outcomes here; reproduce any failure with downloaded timing evidence. Do not mark these rows passed from simulated input.
