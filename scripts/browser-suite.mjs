import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { browserPlan, validateBrowserChecks } from './browser-checks.mjs';

// test:browser builds once before entering here. verify uses the same plan.
let plan = [];
const results = [];
let passed = false;
let failure;
try {
  validateBrowserChecks();
  plan = browserPlan(process.env.TUNO_BROWSER ? [process.env.TUNO_BROWSER] : undefined);
  for (const { engine, file } of plan) {
    console.log(`\n${engine}: ${file}`);
    const started = Date.now();
    try {
      execFileSync(process.execPath, [`scripts/${file}`], { stdio: 'inherit', env: { ...process.env, TUNO_BROWSER: engine } });
      results.push({ engine, file, result: 'passed', elapsedMs: Date.now() - started });
    } catch (error) {
      results.push({ engine, file, result: 'failed', elapsedMs: Date.now() - started, exitCode: error.status });
      throw error;
    }
  }
  passed = true;
} catch (error) {
  failure = error.message;
  throw error;
} finally {
  mkdirSync('dist/validation', { recursive: true });
  let release = {};
  try { release = JSON.parse(readFileSync('dist/release.json', 'utf8')); } catch { /* Preflight can fail before a build exists. */ }
  writeFileSync('dist/validation/browser-summary.json', JSON.stringify({
    build: release.build, revision: release.revision, dirty: release.dirty,
    checkedAt: new Date().toISOString(), passed, failure, results, pending: plan.slice(results.length),
  }, null, 2));
}
