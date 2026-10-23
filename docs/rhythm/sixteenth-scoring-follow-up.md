# Dense assessment follow-up example

The sixteenth vocabulary slice changes no scoring formulas, thresholds, tempo fitting or results UI. It preserves the scoring-refinement commit `8f0c8b7` inherited from the handoff branch.

A Node 24.21.0 run of the existing assessment on `dense-sixteenths` (four 4/4 bars, 64 attacks, 120 BPM, exact down/up evidence, no calibration) took approximately **8.6 seconds** for Tap in this workspace. The full preset assessment unit test now takes approximately 18 seconds. Rhythm credit remains 100, tempo 120 BPM, no missing/extra attacks; Hold also receives full credit for exact durations. This is a synchronous assessment latency concern for a later performance/scoring pass, not an integration timing error or proposed formula change.

Run `node scripts/rhythm-dense-assessment-example.ts` from the repository root. The [reproducer](../../scripts/rhythm-dense-assessment-example.ts) creates canonical fixture capture and logs elapsed time and compact assessment results for both styles. CPU/runtime dependent elapsed times are diagnostic, not a benchmark threshold. Review analytical tempo search cost and main-thread completion responsiveness separately from numerical teaching policy. No workaround limiting selected vocabulary or reducing scoring accuracy is introduced here.

Resumed-work verification reproduced **8,823 ms for Tap** and **8,646 ms for Tap + Hold** on Node 24.21.0. Both retained rhythm credit 100, 120 BPM, and zero missing/extra attacks; Hold retained hold credit 100. No scoring files were modified.
