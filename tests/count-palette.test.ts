import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteSymbols } from '../src/apps/count-writing/palette.ts';

const basic = { sixteenths: false, triplets: false };
test('palette beat numbers stop at the meter numerator', () => {
  assert.deepEqual(paletteSymbols(2, false, 'numbers', basic), ['1', '2', '&']);
  assert.deepEqual(paletteSymbols(3, false, 'numbers', basic), ['1', '2', '3', '&']);
});
test('sixteenth and triplet vocabulary are independently enabled', () => {
  assert.deepEqual(paletteSymbols(4, false, 'numbers', { sixteenths: true, triplets: false }), ['1', '2', '3', '4', '&', 'e', 'a']);
  assert.deepEqual(paletteSymbols(4, false, 'numbers', { sixteenths: false, triplets: true }), ['1', '2', '3', '4', '&', 'la', 'li']);
  assert.deepEqual(paletteSymbols(2, false, 'syllables', basic), ['1', '2', 'te']);
  assert.deepEqual(paletteSymbols(2, false, 'syllables', { sixteenths: true, triplets: true }), ['1', '2', 'ta', 'te', 'la', 'li']);
});
test('compound meter exposes its six numbers without unsupported subdivisions', () => {
  assert.deepEqual(paletteSymbols(6, true, 'syllables', { sixteenths: true, triplets: true }), ['1', '2', '3', '4', '5', '6']);
});
