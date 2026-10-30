import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { runJobs, VerificationPool, TASK_RUNNERS, GLOBAL_RUNNERS, requireLocks } from '../scripts/verification-runner.mjs';
import { selectedBrowserPlan, browserJobs } from '../scripts/verification-browser.mjs';

requireLocks();
const fixture = fileURLToPath(new URL('./fixtures/verification-task.mjs', import.meta.url));
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'tuno-runner-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, pool: join(root, 'pool'), events: join(root, 'events.jsonl') };
}
function events(path) { return existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []; }
function job(env, task, index, { duration = 180, fail = false, exclusive = false, ignoreTermination = false, releaseFile } = {}) {
  const id = `${task}-${index}`;
  return { check: id, exclusive, command: process.execPath, args: ['-e', `
    const {appendFileSync,existsSync}=require('node:fs');
    const emit=phase=>appendFileSync(${JSON.stringify(env.events)},JSON.stringify({phase,id:${JSON.stringify(id)},task:${JSON.stringify(task)},exclusive:${exclusive},pid:process.pid})+'\\n');
    if (${ignoreTermination}) process.on('SIGTERM',()=>{});
    emit('start');
    const end=()=>{emit('end');process.exitCode=${fail ? 7 : 0};};
    const releaseFile=${JSON.stringify(releaseFile) || 'undefined'};
    if(releaseFile) { const timer=setInterval(()=>{if(existsSync(releaseFile)){clearInterval(timer);end();}},10); }
    else setTimeout(end,${duration});
  `] };
}
function task(env, name, jobs, extra = {}) {
  const directory = join(env.root, name); mkdirSync(directory);
  const config = { directory, pool: env.pool, jobs, report: join(directory, 'result.json'), ...extra };
  const path = join(directory, 'config.json'); writeFileSync(path, JSON.stringify(config));
  const child = spawn(process.execPath, [fixture, path], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
  const done = new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal, output })));
  return { child, done, config };
}
async function waitFor(predicate) {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await delay(20); }
  throw Error('Timed out waiting for fixture');
}
function measure(rows) {
  const active = new Map(); let maximum = 0;
  for (const row of rows) {
    if (row.phase === 'start') {
      active.set(row.id, row); maximum = Math.max(maximum, active.size);
      assert.ok(active.size <= GLOBAL_RUNNERS, 'global budget');
      for (const task of new Set([...active.values()].map(r => r.task))) assert.ok([...active.values()].filter(r => r.task === task).length <= TASK_RUNNERS, 'per-task budget');
      if ([...active.values()].some(r => r.exclusive)) assert.equal(active.size, 1, 'exclusive check overlaps another task');
    } else assert.ok(active.delete(row.id));
  }
  assert.equal(active.size, 0); return maximum;
}

test('three independent processes share six slots and each task stays within three', { timeout: 15000 }, async t => {
  const env = setup(t);
  const releaseFile = join(env.root, 'release');
  const tasks = ['a', 'b', 'c'].map(name => task(env, name, Array.from({ length: 6 }, (_, i) => job(env, name, i, { releaseFile }))));
  try { await waitFor(() => events(env.events).length >= 6); }
  finally { writeFileSync(releaseFile, 'go'); }
  const outcomes = await Promise.all(tasks.map(x => x.done));
  for (const outcome of outcomes) assert.equal(outcome.code, 0, outcome.output);
  assert.equal(measure(events(env.events)), 6, 'pool can be fully utilized');
  assert.equal(events(env.events).length, 36);
});

test('an exclusive waiter blocks new admissions while existing jobs drain', { timeout: 15000 }, async t => {
  const env = setup(t); const releaseFile = join(env.root, 'release');
  const first = task(env, 'normal', Array.from({ length: 3 }, (_, i) => job(env, 'normal', i, { releaseFile })));
  await waitFor(() => events(env.events).length >= 3);
  const second = task(env, 'exclusive', [job(env, 'exclusive', 0, { exclusive: true })]);
  try { await waitFor(() => existsSync(join(second.config.directory, '001-exclusive-0.started.json.waiting'))); }
  finally { writeFileSync(releaseFile, 'go'); }
  const third = task(env, 'late', [job(env, 'late', 0)]);
  for (const running of [first, second, third]) assert.equal((await running.done).code, 0);
  const rows = events(env.events); measure(rows);
  assert.ok(rows.findIndex(r => r.id === 'late-0' && r.phase === 'start') > rows.findIndex(r => r.id === 'exclusive-0' && r.phase === 'end'));
});

test('all failures are collected with separate logs and incremental results', async t => {
  const env = setup(t); const updates = [];
  const jobs = [job(env, 'failures', 0, { fail: true }), job(env, 'failures', 1), { check: 'missing executable', command: '/no/such/tuno-executable', args: [] }, { check: 'exit 200', command: process.execPath, args: ['-e', 'process.exit(200)'] }];
  const result = await runJobs(jobs, { directory: join(env.root, 'run'), pool: new VerificationPool({ directory: env.pool }), progress: () => {}, onUpdate: r => updates.push(structuredClone(r)) });
  assert.deepEqual(result.map(r => r.result), ['failed', 'passed', 'failed', 'failed']);
  assert.deepEqual(result.map(r => r.exitCode), [7, 0, 127, 200]);
  assert.equal(new Set(result.map(r => r.log)).size, 4);
  assert.ok(result.every(r => existsSync(r.log)));
  assert.ok(updates.some(r => r.some(x => x.result === 'failed') && r.some(x => x.result === 'pending' || x.result === 'queued')));
});

test('cancellation terminates children, reports pending jobs and releases locks', { timeout: 15000 }, async t => {
  const env = setup(t);
  const running = task(env, 'cancel', Array.from({ length: 5 }, (_, i) => job(env, 'cancel', i, { duration: 10000 })));
  await waitFor(() => events(env.events).length >= 3);
  const pids = events(env.events).map(r => r.pid);
  running.child.kill('SIGTERM');
  assert.equal((await running.done).code, 1);
  const result = JSON.parse(readFileSync(running.config.report));
  assert.equal(result.length, 5); assert.ok(result.every(r => r.result === 'cancelled'));
  await delay(1100);
  for (const pid of pids) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  const next = task(env, 'after-cancel', [job(env, 'after-cancel', 0, { exclusive: true })]);
  assert.equal((await next.done).code, 0);
});


test('a child ignoring TERM retains its lease until forced termination', { timeout: 15000 }, async t => {
  const env = setup(t);
  const first = task(env, 'stubborn', [job(env, 'stubborn', 0, { duration: 10000, ignoreTermination: true })]);
  await waitFor(() => events(env.events).length === 1);
  const pid = events(env.events)[0].pid;
  first.child.kill('SIGTERM');
  const second = task(env, 'after-stubborn', [{
    check: 'exclusive after stubborn child', exclusive: true,
    command: process.execPath, args: ['-e', `try { process.kill(${pid}, 0); process.exit(9); } catch(e) { if(e.code !== 'ESRCH') throw e; }`],
  }]);
  assert.equal((await first.done).code, 1);
  assert.equal((await second.done).code, 0, 'exclusive job started while a terminated child still ran');
});

test('killing a scheduler does not free the slots of its still-running children', { timeout: 15000 }, async t => {
  const env = setup(t);
  const first = task(env, 'killed', Array.from({ length: 3 }, (_, i) => job(env, 'killed', i, { duration: 700 })));
  await waitFor(() => events(env.events).length >= 3);
  first.child.kill('SIGKILL'); await first.done;
  const second = task(env, 'survivor', [job(env, 'survivor', 0, { exclusive: true })]);
  assert.equal((await second.done).code, 0);
  measure(events(env.events));
});

test('timeouts fail a check and release its lease', { timeout: 15000 }, async t => {
  const env = setup(t);
  const first = task(env, 'timeout', [job(env, 'timeout', 0, { duration: 10000 })], { timeoutMs: 150 });
  assert.equal((await first.done).code, 1);
  const result = JSON.parse(readFileSync(first.config.report)); assert.equal(result[0].timedOut, true); assert.equal(result[0].result, 'failed');
  const second = task(env, 'after-timeout', [job(env, 'after-timeout', 0, { exclusive: true })]);
  assert.equal((await second.done).code, 0);
});

test('same-checkout guard refuses a second verification before it writes artifacts', { timeout: 15000 }, async t => {
  const env = setup(t); const directory = join(env.root, 'checkout'); mkdirSync(directory);
  const ready = join(directory, 'ready'); const config = join(directory, 'config.json'); writeFileSync(config, JSON.stringify({ checkout: true, ready }));
  const launch = () => { const child = spawn(process.execPath, [fixture, config], { cwd: directory, stdio: 'ignore' }); return new Promise(resolve => child.on('exit', resolve)); };
  const first = launch(); await waitFor(() => existsSync(ready));
  assert.equal(await launch(), 200); assert.equal(await first, 0);
  assert.equal(await launch(), 0, 'lock can be reacquired');
});

test('focused selection is explicit, validates typos, and keeps sensitive checks isolated', () => {
  assert.equal(selectedBrowserPlan([], {}).plan.length, 94);
  const selection = selectedBrowserPlan(['--check', 'notes-fingering-browser-check.mjs', '--engine', 'firefox'], {});
  assert.equal(selection.focused, true); assert.equal(selection.plan.length, 1);
  assert.throws(() => selectedBrowserPlan(['--check', 'typo'], {}), /Unknown/);
  assert.throws(() => selectedBrowserPlan(['--engine', 'webkit'], {}), /Unsupported/);
  assert.throws(() => selectedBrowserPlan(['--check'], {}), /Missing/);
  for (const file of ['performance-check.mjs', 'animation-browser-check.mjs', 'browser-check.mjs']) assert.ok(browserJobs().filter(j => j.file === file).every(j => j.exclusive));
});
