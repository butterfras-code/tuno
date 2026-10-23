import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusForPath, toolPaths } from '../src/shared/ui/tuno-routes.ts';
test('hosted routes identify only the three tUno views, including directory indexes', () => {
  for (const [focus, path] of Object.entries(toolPaths)) {
    for (const variant of [path, path.slice(0, -1), path + 'index.html']) assert.equal(focusForPath(variant), focus);
  }
  for (const path of ['/', '/notes/', '/rhythm/', '/tune/missing.js']) assert.equal(focusForPath(path), null);
});
