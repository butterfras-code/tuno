import assert from 'node:assert/strict';
import test from 'node:test';
import { browserChecks, browserPlan, validateBrowserChecks } from '../scripts/browser-checks.mjs';

test('every browser check in the checkout has an explicit classification', () => {
  validateBrowserChecks();
});

const active = { file: 'example-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] };
test('new, missing and duplicate check files fail classification', () => {
  assert.throws(() => validateBrowserChecks([active], [active.file, 'new-browser-check.mjs']), /Unclassified.*new-browser/);
  assert.throws(() => validateBrowserChecks([active], []), /missing/);
  assert.throws(() => validateBrowserChecks([active, active], [active.file]), /Duplicate/);
  for (const file of ['offline-check.mjs', 'audio-render-check.mjs', 'performance-check.mjs', 'browser-check.mjs', 'new.browser-check.mjs', 'nested/new-browser-check.mjs']) {
    assert.throws(() => validateBrowserChecks([], [file]), /Unclassified/);
  }
});

test('retirement and engine limitations require explanations', () => {
  const validate = entry => validateBrowserChecks([entry], [entry.file]);
  assert.throws(() => validate({ ...active, status: 'retired', engines: [] }), /reason/);
  assert.throws(() => validate({ ...active, engines: ['webkit'] }), /Invalid engines/);
  assert.throws(() => validate({ ...active, engines: ['chromium'] }), /reason/);
  assert.throws(() => validate({ ...active, engines: [] }), /needs an engine/);
  assert.throws(() => validate({ ...active, status: 'disabled' }), /status/);
  validate({ ...active, status: 'retired', engines: [], reason: 'Replaced by the current workspace.' });
});

test('shared plan schedules active checks only on their supported engines', () => {
  const entries = [active, { file: 'old-browser-check.mjs', status: 'retired', engines: [], reason: 'Replaced.' }, { file: 'limited-browser-check.mjs', status: 'active', engines: ['chromium'], reason: 'Engine API.' }];
  assert.deepEqual(browserPlan(undefined, entries), [
    { engine: 'chromium', file: active.file }, { engine: 'chromium', file: 'limited-browser-check.mjs' }, { engine: 'firefox', file: active.file },
  ]);
  assert.throws(() => browserPlan(['typo']), /Unsupported browser/);
  for (const engine of ['chromium', 'firefox']) {
    const files = browserPlan([engine]).map(entry => entry.file);
    for (const name of ['counting-corrections', 'rhythm-uil', 'rhythm-preset-picker', 'responsive-workspace', 'performance-follow', 'rhythm-source', 'notes-storage', 'notes-entry', 'notes-results']) {
      assert.ok(files.includes(`${name}-browser-check.mjs`), `${name} required in ${engine}`);
    }
    assert.equal(files.length, browserChecks.filter(entry => entry.status === 'active').length);
  }
});
