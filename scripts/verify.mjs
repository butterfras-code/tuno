import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Verify the existing local release; this command never publishes or pushes it.
const results = [];
function run(label, command, args, env = process.env) {
  const started = Date.now();
  try {
    execFileSync(command, args, { stdio: 'inherit', env });
    results.push({ check: label, result: 'passed', elapsedMs: Date.now() - started });
  } catch (error) {
    results.push({ check: label, result: 'failed', elapsedMs: Date.now() - started, exitCode: error.status });
    throw error;
  }
}
let passed = false;
try {
  run('typecheck, unit tests, build', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'check']);
  run('extended synthetic pitch benchmark', process.execPath, ['scripts/pitch-benchmark.ts', '--check']);
  run('release integrity', process.execPath, ['scripts/release-check.mjs']);
  for (const browser of ['chromium', 'firefox']) {
    for (const check of ['browser-check', 'layout-browser-check', 'tempo-browser-check', 'animation-browser-check', 'offline-check', 'site-browser-check', 'audio-render-check', 'performance-check', 'release-browser-check', 'dual-app-browser-check', 'notes-browser-check', 'notes-stage2-browser-check', 'notes-input-browser-check', 'notes-configurator-browser-check', 'notes-preset-preview-browser-check', 'notes-custom-editor-browser-check', 'notes-adaptive-browser-check', 'notes-ui-browser-check', 'notes-practice-layout-browser-check', 'notes-mode-layout-browser-check', 'notes-misses-browser-check', 'notes-challenge-browser-check', 'notes-multiplayer-browser-check', 'notes-viewport-browser-check']) {
      run(`${browser}: ${check}`, process.execPath, [`scripts/${check}.mjs`], { ...process.env, TUNO_BROWSER: browser });
    }
  }
  passed = true;
} finally {
  mkdirSync('dist/validation', { recursive: true });
  let release = {};
  try { release = JSON.parse(readFileSync('dist/release.json', 'utf8')); } catch { /* Retain failed pre-build results too. */ }
  writeFileSync('dist/validation/summary.json', JSON.stringify({
    build: release.build, revision: release.revision, dirty: release.dirty,
    checkedAt: new Date().toISOString(), automatedChecksPassed: passed,
    physicalAcceptance: 'pending', results,
    untested: ['Managed Chromebook', 'Physical Safari', 'Real microphone/speakers/headphones', 'OS installation', 'Production HTTPS deployment', 'Classroom projection'],
    unavailable: ['Automated WebKit: required system libraries absent on this host'],
  }, null, 2));
}
