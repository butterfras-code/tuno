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
  private submitted?: PromptToken;
  private releaseOpen = false;
  private submit: (mask: FingeringMask, token: PromptToken) => void;
  constructor(submit: (mask: FingeringMask, token: PromptToken) => void) { this.submit = submit; }
  private clearTimer() { clearTimeout(this.timer); this.timer = undefined; }
  cancel() { this.clearTimer(); this.submitted = undefined; this.releaseOpen = false; }
  update(token: PromptToken, locked: boolean, primaryOpen = false) {
    const changed = token.session !== this.token?.session || token.prompt !== this.token?.prompt;
    if (locked || changed) this.clearTimer();
    if (changed) {
      // Only a still-held answer to the immediately preceding card can release
      // into open. Updating a card never submits by itself.
      this.releaseOpen = !locked && primaryOpen && this.mask !== OPEN_FINGERING
        && this.submitted?.session === token.session && this.submitted.prompt + 1 === token.prompt;
      this.submitted = undefined;
    }
    if (locked || !primaryOpen) this.releaseOpen = false;
    this.token = token; this.locked = locked;
  }
  change(mask: FingeringMask, intentional = true) {
    if (mask === this.mask && intentional) return;
    const addedFinger = [...mask].some((bit, i) => bit === '1' && this.mask[i] !== '1');
    this.mask = mask; this.clearTimer();
    if (!intentional || addedFinger) { this.submitted = undefined; this.releaseOpen = false; }
    const releasedOpen = this.releaseOpen && mask === OPEN_FINGERING;
    if (mask === OPEN_FINGERING) { this.releaseOpen = false; this.submitted = undefined; }
    if (!intentional || this.locked || !this.token || mask === OPEN_FINGERING && !releasedOpen) return;
    const token = this.token;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.submitted = mask === OPEN_FINGERING ? undefined : token;
      this.submit(mask, token);
    }, FINGERING_SETTLE_MS);
  }
  open() {
    this.cancel();
    if (!this.locked && this.token) this.submit(OPEN_FINGERING, this.token);
  }
}
