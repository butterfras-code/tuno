import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectedBrowserPlan, browserJobs } from './verification-browser.mjs';
import { createRun, runJobs, VerificationPool, withCheckoutLock, writeReport, GLOBAL_RUNNERS, TASK_RUNNERS } from './verification-runner.mjs';

await withCheckoutLock(async signal => {
  const { plan, build, focused } = selectedBrowserPlan(process.argv.slice(2));
  const directory = createRun('browser');
  const started = Date.now();
  const pool = new VerificationPool({ signal });
  let results = [], passed = false, failure;
  const save = () => {
    let release = {};
    try { release = JSON.parse(readFileSync('dist/release.json', 'utf8')); } catch { /* Retain preflight failures. */ }
    const report = {
      build: release.build, revision: release.revision, dirty: release.dirty, checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started, passed, focused, failure, results,
      runners: { global: GLOBAL_RUNNERS, perTask: TASK_RUNNERS }, runDirectory: directory,
      pending: plan.filter(job => !results.some(r => r.engine === job.engine && r.file === job.file && !['pending', 'queued'].includes(r.result))),
    };
    writeReport(join(directory, 'browser-summary.json'), report);
    mkdirSync('dist/validation', { recursive: true });
    writeReport('dist/validation/browser-summary.json', report);
  };
  console.log(`Browser verification (${focused ? 'focused' : 'full'}): reports ${directory}`);
  try {
    if (build) {
      const built = await runJobs([{ check: 'build', command: 'npm', args: ['run', 'build'], exclusive: true }], { directory: join(directory, 'build'), pool });
      if (built[0].result !== 'passed') { results = built; throw Error(`Build failed. See ${built[0].log}`); }
    }
    // Fail before scheduling browser checks when there is no build to serve.
    JSON.parse(readFileSync('dist/release.json', 'utf8'));
    await runJobs(browserJobs(plan), { directory: join(directory, 'browser'), pool, onUpdate: current => { results = current.map(item => ({ ...item })); save(); } });
    passed = results.length === plan.length && results.every(item => item.result === 'passed');
    if (!passed) failure = 'One or more checks failed or were cancelled. See individual logs.';
  } catch (error) { failure = error.message; }
  finally {
    save(); console.log(`Browser verification ${passed ? 'passed' : 'FAILED'} in ${((Date.now() - started) / 60000).toFixed(1)} minutes. ${join(directory, 'browser-summary.json')}`);
    if (failure) console.error(failure);
    if (!passed) process.exitCode = 1;
  }
});
