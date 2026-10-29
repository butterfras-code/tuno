import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, openSync, closeSync, existsSync, readFileSync, writeFileSync, renameSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const GLOBAL_RUNNERS = 6;
export const TASK_RUNNERS = 3;
const commandRunner = fileURLToPath(new URL('./verification-command.mjs', import.meta.url));
const defaultPool = join(tmpdir(), `tuno-verification-v1-${process.getuid?.() ?? 'user'}`);
const contention = 200;

export function requireLocks() {
  if (process.platform === 'win32') throw Error('Verification requires util-linux flock (use Linux/WSL). App builds do not require flock.');
  try { execFileSync('flock', ['--version'], { stdio: 'ignore' }); }
  catch { throw Error('Verification requires util-linux flock on PATH. Install it before running verify/test:browser.'); }
}

export function writeReport(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  renameSync(temporary, path);
}

// One process group per command, so cancellation reaches npm, Node and children.
function launch(command, args, { cwd, env, output, signal, timeoutMs = 600_000 } = {}) {
  return new Promise(resolveResult => {
    if (signal?.aborted) return resolveResult({ code: null, cancelled: true });
    const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', output ?? 'inherit', output ?? 'inherit'] });
    let cancelled = false, timedOut = false, escalation;
    const kill = sig => { try { process.kill(-child.pid, sig); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
    const stop = () => { kill('SIGTERM'); escalation ??= setTimeout(() => kill('SIGKILL'), 1000); };
    const abort = () => { cancelled = true; stop(); };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    child.once('error', error => finish({ code: null, error: error.message }));
    child.once('close', (code, childSignal) => finish({ code, signal: childSignal }));
    let finished = false;
    function finish(result) {
      if (finished) return; finished = true;
      clearTimeout(timer);
      // Keep escalation alive after the wrapper exits: its descendants may still run.
      signal?.removeEventListener('abort', abort);
      resolveResult({ ...result, cancelled, timedOut });
    }
  });
}

// flock releases locks even after a killed process. Never unlink lock files:
// replacing their inode would create a second independent pool.
export class VerificationPool {
  constructor({ directory = defaultPool, cwd = process.cwd(), signal, timeoutMs = 600_000 } = {}) {
    this.directory = directory; this.cwd = cwd; this.signal = signal; this.timeoutMs = timeoutMs;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  async run(job, log, marker) {
    const queuedAt = Date.now();
    const fd = openSync(log, 'a');
    let outcome;
    try {
      let offset = Math.floor(Math.random() * GLOBAL_RUNNERS);
      do {
        if (this.signal?.aborted) return { result: 'cancelled', elapsedMs: 0, waitMs: Date.now() - queuedAt, log };
        const slot = offset++ % GLOBAL_RUNNERS;
        outcome = await launch(process.execPath, [commandRunner, this.directory, job.exclusive ? 'exclusive' : String(slot), String(this.timeoutMs), marker, job.command, ...job.args], {
          cwd: this.cwd, env: { ...process.env, ...job.env }, output: fd, signal: this.signal,
          // Execution timeout starts inside the wrapper, after acquiring leases.
          timeoutMs: 24 * 60 * 60 * 1000,
        });
        if (outcome.code !== contention || existsSync(marker)) break;
        await delay(40, undefined, { signal: this.signal }).catch(() => {});
      } while (!this.signal?.aborted);
      const startedAt = existsSync(marker) ? JSON.parse(readFileSync(marker, 'utf8')).startedAt : Date.now();
      return {
        result: outcome.cancelled || this.signal?.aborted ? 'cancelled' : outcome.code === 0 ? 'passed' : 'failed',
        exitCode: outcome.code, signal: outcome.signal, error: outcome.error, timedOut: outcome.timedOut || existsSync(`${marker}.timeout`),
        elapsedMs: Date.now() - startedAt, waitMs: startedAt - queuedAt, log,
      };
    } finally { closeSync(fd); }
  }
}

export async function runJobs(jobs, { directory, pool = new VerificationPool(), workers = TASK_RUNNERS, onUpdate = () => {}, progress = console.log } = {}) {
  if (!Number.isInteger(workers) || workers < 1 || workers > TASK_RUNNERS) throw Error(`Workers must be 1–${TASK_RUNNERS}`);
  mkdirSync(directory, { recursive: true });
  const results = jobs.map(job => ({ check: job.check, ...(job.engine ? { engine: job.engine, file: job.file } : {}), exclusive: Boolean(job.exclusive), result: 'pending' }));
  onUpdate(results);
  async function run(index) {
    const job = jobs[index];
    const name = `${String(index + 1).padStart(3, '0')}-${job.check.replace(/[^a-zA-Z0-9_.-]/g, '-')}`;
    results[index].result = 'queued'; onUpdate(results);
    let result;
    try { result = await pool.run(job, join(directory, `${name}.log`), join(directory, `${name}.started.json`)); }
    catch (error) { result = { result: 'failed', error: error.message, elapsedMs: 0, waitMs: 0, log: join(directory, `${name}.log`) }; }
    Object.assign(results[index], result); onUpdate(results);
    progress(`${results.filter(r => !['pending', 'queued'].includes(r.result)).length}/${jobs.length} ${job.check}: ${result.result} (${(result.elapsedMs / 1000).toFixed(1)}s; waited ${(result.waitMs / 1000).toFixed(1)}s)`);
  }
  // Run isolated checks first, without consuming two local workers waiting on
  // their own exclusive gate. Other tasks still coordinate through OS locks.
  for (let i = 0; i < jobs.length; i++) if (jobs[i].exclusive) await run(i);
  const pending = jobs.flatMap((job, i) => job.exclusive ? [] : [i]);
  await Promise.all(Array.from({ length: workers }, async () => { while (pending.length) await run(pending.shift()); }));
  return results;
}

export function createRun(kind) {
  const directory = resolve('.verification-runs', `${new Date().toISOString().replaceAll(':', '-')}-${kind}-${randomUUID().slice(0, 8)}`);
  mkdirSync(directory, { recursive: true });
  return directory;
}

// Guard a checkout before any build can delete dist or two suites overwrite the
// same screenshots. Different worktrees have different locks but share slots.
export async function withCheckoutLock(main) {
  requireLocks();
  const cwd = realpathSync(process.cwd());
  if (process.env.TUNO_VERIFICATION_CHECKOUT === cwd) {
    delete process.env.TUNO_VERIFICATION_CHECKOUT;
    const controller = new AbortController();
    const abort = () => controller.abort();
    process.on('SIGINT', abort); process.on('SIGTERM', abort);
    try { await main(controller.signal); }
    finally { process.off('SIGINT', abort); process.off('SIGTERM', abort); if (controller.signal.aborted) process.exitCode = 130; }
    return;
  }
  mkdirSync(defaultPool, { recursive: true, mode: 0o700 });
  const lock = join(defaultPool, `checkout-${createHash('sha256').update(cwd).digest('hex')}.lock`);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on('SIGINT', abort); process.on('SIGTERM', abort);
  try {
    const outcome = await launch('flock', ['--exclusive', '--nonblock', '--conflict-exit-code', String(contention), lock, process.execPath, ...process.argv.slice(1)], {
      env: { ...process.env, TUNO_VERIFICATION_CHECKOUT: cwd }, signal: controller.signal, timeoutMs: 24 * 60 * 60 * 1000,
    });
    if (outcome.code === contention) console.error('Another verification is using this checkout. Use a separate worktree or wait for it to finish.');
    process.exitCode = outcome.cancelled ? 130 : outcome.code ?? 1;
  } finally { process.off('SIGINT', abort); process.off('SIGTERM', abort); }
}
