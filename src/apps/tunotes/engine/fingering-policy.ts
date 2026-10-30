import { parseFingering, fingerPositions, canonicalFingering, isOpenFingering } from '../../../shared/input/fingering-code.ts';
import { OPEN_FINGERING } from '../domain/fingering.ts';
import type { FingeringCode } from '../domain/fingering.ts';
import type { PromptToken } from './practice.ts';

export const FINGERING_SETTLE_MS = 350;
/** Flashcard timing only. Held input and pitch validation have no dependency on this policy. */
export class FingeringPolicy {
  private token?: PromptToken;
  private locked = true;
  private timer?: ReturnType<typeof setTimeout>;
  private code = OPEN_FINGERING;
  private submitted?: PromptToken;
  private releaseOpen = false;
  private submit: (code: FingeringCode, token: PromptToken) => void;
  constructor(submit: (code: FingeringCode, token: PromptToken) => void) { this.submit = submit; }
  private clearTimer() { clearTimeout(this.timer); this.timer = undefined; }
  cancel() { this.clearTimer(); this.submitted = undefined; this.releaseOpen = false; }
  update(token: PromptToken, locked: boolean, primaryOpen = false) {
    const changed = token.session !== this.token?.session || token.prompt !== this.token?.prompt;
    if (locked || changed) this.clearTimer();
    if (changed) {
      // Only a still-held answer to the immediately preceding card can release
      // into open. Updating a card never submits by itself.
      this.releaseOpen = !locked && primaryOpen && !isOpenFingering(this.code)
        && this.submitted?.session === token.session && this.submitted.prompt + 1 === token.prompt;
      this.submitted = undefined;
    }
    if (locked || !primaryOpen) this.releaseOpen = false;
    this.token = token; this.locked = locked;
  }
  change(code: FingeringCode, intentional = true) {
    code = canonicalFingering(code);
    if (code === this.code && intentional) return;
    const next = parseFingering(code), previous = parseFingering(this.code);
    const addedFinger = fingerPositions.some(name => next.fingers[name].some(id => !previous.fingers[name].includes(id)));
    this.code = code; this.clearTimer();
    if (!intentional || addedFinger) { this.submitted = undefined; this.releaseOpen = false; }
    const releasedOpen = this.releaseOpen && isOpenFingering(code);
    if (isOpenFingering(code)) { this.releaseOpen = false; this.submitted = undefined; }
    if (!intentional || this.locked || !this.token || isOpenFingering(code) && !releasedOpen) return;
    const token = this.token;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.submitted = isOpenFingering(code) ? undefined : token;
      this.submit(code, token);
    }, FINGERING_SETTLE_MS);
  }
  open() {
    this.cancel();
    if (!this.locked && this.token) this.submit(OPEN_FINGERING, this.token);
  }
}
