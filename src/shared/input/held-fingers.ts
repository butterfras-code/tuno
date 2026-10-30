import { binaryFingering, fingerPositions } from './fingering-code.ts';
import type { FingerName } from './fingering-code.ts';
export interface FingerPosition {
  readonly position: FingerName;
  readonly label: string;
  readonly accessibleLabel: string;
  readonly key: string;
}
/** Physical sources are independent: releasing a key must not release a held touch. */
export class HeldFingers {
  private sources = new Map<string, FingerName>();
  get code() {
    return binaryFingering(this.sources.values());
  }
  down(source: string, position: FingerName) {
    if (!fingerPositions.includes(position)) throw new Error('Unknown finger position.');
    const before = this.code;
    this.sources.set(source, position);
    return this.code !== before;
  }
  up(source: string) { const before = this.code; this.sources.delete(source); return this.code !== before; }
  reset() { this.sources.clear(); }
}
