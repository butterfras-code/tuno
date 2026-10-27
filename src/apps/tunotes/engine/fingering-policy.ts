import { OPEN_FINGERING } from '../domain/fingering.ts';
import type { FingeringMask } from '../domain/fingering.ts';
import type { PromptToken } from './practice.ts';

export const FINGERING_SETTLE_MS = 200;
/** Flashcard timing only. Held input and pitch validation have no dependency on this policy. */
export class FingeringPolicy {
  private token?: PromptToken;
  private locked = true;
  private timer?: ReturnType<typeof setTimeout>;
  private mask = OPEN_FINGERING;
  private submit: (mask: FingeringMask, token: PromptToken) => void;
  constructor(submit: (mask: FingeringMask, token: PromptToken) => void) { this.submit = submit; }
  cancel() { clearTimeout(this.timer); this.timer = undefined; }
  update(token: PromptToken, locked: boolean) {
    if (locked || token.session !== this.token?.session || token.prompt !== this.token?.prompt) this.cancel();
    this.token = token; this.locked = locked;
  }
  change(mask: FingeringMask, intentional = true) {
    if (mask === this.mask && intentional) return;
    this.mask = mask; this.cancel();
    if (!intentional || this.locked || !this.token || mask === OPEN_FINGERING) return;
    const token = this.token;
    this.timer = setTimeout(() => { this.timer = undefined; this.submit(mask, token); }, FINGERING_SETTLE_MS);
  }
  open() {
    this.cancel();
    if (!this.locked && this.token) this.submit(OPEN_FINGERING, this.token);
  }
}
