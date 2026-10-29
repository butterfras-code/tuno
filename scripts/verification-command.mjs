// A job owns its kernel locks independently of the scheduling process. flock's
// descriptor mode locks the same open-file description retained by this wrapper.
import { spawn, spawnSync } from 'node:child_process';
import { openSync, closeSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [directory, slot, timeout, marker, command, ...args] = process.argv.slice(2);
const descriptors = [];
function lock(name, mode, wait = false) {
  const fd = openSync(join(directory, name), 'a'); descriptors.push(fd);
  const result = spawnSync('flock', [mode, ...(wait ? [] : ['--nonblock']), '--conflict-exit-code', '200', '3'], {
    stdio: ['ignore', 'ignore', 'inherit', fd],
  });
  if (result.error) { console.error(result.error.message); process.exit(127); }
  if (result.status !== 0) process.exit(result.status ?? 143);
  return fd;
}

// Hold the admission lock only while a shared job acquires its gate and slot.
// An exclusive waiter can then reserve admission and drain existing shared jobs
// without being overtaken by their replacements.
const admission = lock('admission.lock', slot === 'exclusive' ? '--exclusive' : '--shared');
if (slot === 'exclusive') {
  writeFileSync(`${marker}.waiting`, 'exclusive');
  lock('exclusive.lock', '--exclusive', true);
} else {
  lock('exclusive.lock', '--shared');
  lock(`slot-${slot}.lock`, '--exclusive');
  closeSync(admission); descriptors.splice(descriptors.indexOf(admission), 1);
}
writeFileSync(marker, JSON.stringify({ startedAt: Date.now() }));
const child = spawn(command, args, { stdio: 'inherit' });
// Keep this wrapper and its locks alive until a terminated command exits.
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
const timer = setTimeout(() => {
  writeFileSync(`${marker}.timeout`, 'timeout');
  process.kill(-process.pid, 'SIGTERM');
  setTimeout(() => process.kill(-process.pid, 'SIGKILL'), 1000);
}, Number(timeout));
child.on('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 127; });
child.on('exit', (code, signal) => { clearTimeout(timer); process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
