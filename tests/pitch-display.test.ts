import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PitchDisplay } from '../src/practice/pitch-display.ts';

test('display median suppresses one-frame outliers and follows sustained changes', () => {
  const display = new PitchDisplay();
  assert.equal(display.frame(0, 440), null);
  assert.equal(display.frame(70, 440), null);
  assert.equal(display.frame(140, 660), 440);
  assert.equal(display.frame(210, 660), 660);
});

test('display acquisition resets for missing, invalid, or stale evidence', () => {
  for (const missing of [null, NaN, 0]) {
    const display = new PitchDisplay();
    display.frame(0, 440);
    display.frame(70, 440);
    assert.equal(display.frame(140, missing), null);
    assert.equal(display.frame(210, 440), null);
    assert.equal(display.frame(280, 440), null);
    assert.equal(display.frame(350, 440), 440);
  }
  const stale = new PitchDisplay();
  stale.frame(0, 440);
  stale.frame(70, 440);
  assert.equal(stale.frame(400, 440), null);
});
