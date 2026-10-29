import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { browserPlan, validateBrowserChecks } from './browser-checks.mjs';
import { browserJobs } from './verification-browser.mjs';
import { createRun, runJobs, VerificationPool, withCheckoutLock, writeReport, GLOBAL_RUNNERS, TASK_RUNNERS } from './verification-runner.mjs';

await withCheckoutLock(async signal => {
  if (process.argv.length > 2) throw Error('verify always runs the full release matrix. Use browser-suite.mjs --check/--engine for focused checks.');
  const directory = createRun('release');
  const pool = new VerificationPool({ signal });
  const started = Date.now();
  let results = [], automatedChecksPassed = false, failure;
  const save = () => {
    let release = {};
    try { release = JSON.parse(readFileSync('dist/release.json', 'utf8')); } catch { /* Preserve pre-build failures. */ }
    const report = {
      build: release.build, revision: release.revision, dirty: release.dirty,
      checkedAt: new Date().toISOString(), elapsedMs: Date.now() - started,
      automatedChecksPassed, physicalAcceptance: 'pending', failure, results,
      runners: { global: GLOBAL_RUNNERS, perTask: TASK_RUNNERS }, runDirectory: directory,
      untested: ['Managed Chromebook', 'Physical Safari', 'Real microphone/speakers/headphones', 'OS installation', 'Production HTTPS deployment', 'Classroom projection', 'Galaxy Z Fold8 measured viewports and physical fold/unfold transition'],
      unavailable: ['Automated WebKit: required system libraries absent on this host'],
    };
    writeReport(join(directory, 'summary.json'), report);
    mkdirSync('dist/validation', { recursive: true });
    writeReport('dist/validation/summary.json', report);
  };
  console.log(`Release verification: 3 runners per task / 6 shared. Reports: ${directory}`);
  try {
    validateBrowserChecks();
    results.push({ check: 'browser check registry', result: 'passed' });
    for (const job of [
      { check: 'typecheck, unit tests, build', command: 'npm', args: ['run', 'check'] },
      { check: 'extended synthetic pitch benchmark', command: process.execPath, args: ['scripts/pitch-benchmark.ts', '--check'] },
      { check: 'release integrity', command: process.execPath, args: ['scripts/release-check.mjs'] },
    ]) {
      // Build/unit subprocesses and benchmark measurements share the same pool.
      const checked = await runJobs([{ ...job, exclusive: true }], { directory: join(directory, `preflight-${results.length}`), pool });
      results.push(...checked); save();
      if (checked.some(item => item.result !== 'passed')) throw Error(`Preflight failed: ${job.check}. See ${checked[0].log}`);
    }
    const preflight = [...results];
    await runJobs(browserJobs(browserPlan()), {
      directory: join(directory, 'browser'), pool,
      onUpdate: browser => { results = [...preflight, ...browser.map(item => ({ ...item }))]; save(); },
    });
    automatedChecksPassed = results.every(item => item.result === 'passed');
    if (!automatedChecksPassed) failure = 'One or more browser checks failed or were cancelled. See individual logs; all checks were collected.';
  } catch (error) { failure = error.message; }
  finally {
    save();
    console.log(`Release verification ${automatedChecksPassed ? 'passed' : 'FAILED'} in ${((Date.now() - started) / 60000).toFixed(1)} minutes. ${join(directory, 'summary.json')}`);
    if (failure) console.error(failure);
    if (!automatedChecksPassed) process.exitCode = 1;
  }
});
