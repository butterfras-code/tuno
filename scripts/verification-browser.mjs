import { browserPlan, validateBrowserChecks } from './browser-checks.mjs';

// These measure real-time behavior or rely on animation timing. Do not run
// alongside other managed jobs, even when those belong to another worktree.
export const exclusiveChecks = new Set(['performance-check.mjs', 'animation-browser-check.mjs', 'browser-check.mjs']);

export function selectedBrowserPlan(args = [], env = process.env) {
  validateBrowserChecks();
  const engines = [], checks = [];
  let build = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--build') build = true;
    else if (arg === '--engine' || arg === '--check') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw Error(`Missing value for ${arg}`);
      (arg === '--engine' ? engines : checks).push(value);
    } else throw Error(`Unknown argument: ${arg}. Use --build, --engine chromium|firefox, --check <registered filename>.`);
  }
  const chosenEngines = engines.length ? [...new Set(engines)] : env.TUNO_BROWSER ? [env.TUNO_BROWSER] : undefined;
  const all = browserPlan(chosenEngines);
  for (const file of checks) if (!all.some(item => item.file === file)) throw Error(`Unknown or unsupported check: ${file}`);
  return { build, focused: Boolean(chosenEngines || checks.length), plan: checks.length ? all.filter(item => checks.includes(item.file)) : all };
}

export function browserJobs(plan = browserPlan()) {
  return plan.map(({ engine, file }) => ({
    check: `${engine}: ${file}`, engine, file, exclusive: exclusiveChecks.has(file),
    command: process.execPath, args: [`scripts/${file}`], env: { TUNO_BROWSER: engine },
  }));
}
