/** Scoring follow-up reproducer. Leaves the existing policy/formulas unchanged.
 * Run: node scripts/rhythm-dense-assessment-example.ts */
import { Capture } from '../src/apps/rhythm-walk/capture.ts';
import { assessAttempt } from '../src/apps/rhythm-walk/assessment.ts';
import { sixteenthFixtures } from '../src/apps/rhythm-walk/shared/fixtures.ts';
const fixture = sixteenthFixtures.find(f => f.id === 'dense-sixteenths')!;
for (const style of ['tap', 'hold'] as const) {
  const capture = new Capture({ ...fixture, description: 'Exact dense assessment performance example' }, 120, false, undefined, undefined, style);
  for (const note of capture.plan.notes) {
    capture.input('down', 'keyboard', note.start, note.start * 1000);
    capture.input('up', 'keyboard', note.end, note.end * 1000);
  }
  const record = capture.advance(capture.plan.captureEnd)!;
  const start = performance.now();
  const result = assessAttempt(record);
  console.log(JSON.stringify({ fixture: fixture.id, style, attacks: capture.plan.notes.length, elapsedMs: Math.round(performance.now() - start), rhythm: result.rhythm, hold: result.hold, tempo: result.tempo, missing: result.missing, extra: result.extra }));
}
