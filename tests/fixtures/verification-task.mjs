import { readFileSync, writeFileSync } from 'node:fs';
import { runJobs, VerificationPool, withCheckoutLock } from '../../scripts/verification-runner.mjs';
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (config.checkout) {
  await withCheckoutLock(async () => { writeFileSync(config.ready, 'ready'); await new Promise(r => setTimeout(r, 500)); });
} else {
  const abort = new AbortController();
  process.on('SIGTERM', () => abort.abort());
  const results = await runJobs(config.jobs, { directory: config.directory, pool: new VerificationPool({ directory: config.pool, signal: abort.signal, timeoutMs: config.timeoutMs }), progress: () => {} });
  writeFileSync(config.report, JSON.stringify(results));
  process.exitCode = results.every(r => r.result === 'passed') ? 0 : 1;
}
