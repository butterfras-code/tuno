export interface FingerPosition {
  readonly position: number;
  readonly label: string;
  readonly accessibleLabel: string;
  readonly key: string;
}
/** Physical sources are independent: releasing a key must not release a held touch. */
export class HeldFingers {
  private sources = new Map<string, number>();
  get mask() {
    const bits = Array<string>(8).fill('0');
    for (const position of this.sources.values()) bits[position] = '1';
    return bits.join('');
  }
  down(source: string, position: number) {
    if (!Number.isInteger(position) || position < 0 || position > 7) throw new Error('Finger position must be 0–7.');
    const before = this.mask;
    this.sources.set(source, position);
    return this.mask !== before;
  }
  up(source: string) { const before = this.mask; this.sources.delete(source); return this.mask !== before; }
  reset() { this.sources.clear(); }
}
