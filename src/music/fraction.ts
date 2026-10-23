/** Exact, JSON-safe musical quantities. Never use floating-point equality for score time. */
export type Fraction = readonly [numerator: number, denominator: number];
export function fraction(n: number, d = 1): Fraction {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) throw new Error('Invalid or overflowing fraction.');
  if (d < 0) { n = -n; d = -d; }
  let a = Math.abs(n), b = d;
  while (b) { const next = a % b; a = b; b = next; }
  return [n / a, d / a];
}
function integer(n: number): number {
  if (!Number.isSafeInteger(n)) throw new Error('Musical arithmetic exceeds safe integer precision.');
  return n;
}
export const add = (a: Fraction, b: Fraction): Fraction => fraction(integer(integer(a[0] * b[1]) + integer(b[0] * a[1])), integer(a[1] * b[1]));
export const subtract = (a: Fraction, b: Fraction): Fraction => add(a, [-b[0], b[1]]);
export const multiply = (a: Fraction, b: Fraction): Fraction => fraction(integer(a[0] * b[0]), integer(a[1] * b[1]));
export const divide = (a: Fraction, b: Fraction): Fraction => multiply(a, fraction(b[1], b[0]));
export const compare = (a: Fraction, b: Fraction): number => Math.sign(integer(a[0] * b[1]) - integer(b[0] * a[1]));
/** Convert only at a display/audio boundary. */
export const toNumber = (value: Fraction): number => value[0] / value[1];
