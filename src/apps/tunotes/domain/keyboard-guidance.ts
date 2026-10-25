import { keyAccidental, spelling } from './notation.ts';
import type { Letter, WrittenPitch } from './notation.ts';
import type { Preset } from './presets.ts';

/** Only bare, matching letters can be input-method mistakes. An ordinary natural
 * needs no modifier; a cancellation natural does when shown against a signature.
 */
export function missingAccidentalHint(letter: Letter, pitch: WrittenPitch, preset: Preset, showKeySignature = false): string | undefined {
  if (letter !== pitch.letter) return;
  if (pitch.accidental === 0 && (preset.keyless || !showKeySignature || keyAccidental(letter, preset.key) === 0)) return;
  const arrow = pitch.accidental === -1 ? '↓' : pitch.accidental === 1 ? '↑' : '→';
  const label = pitch.accidental === 0 ? `${letter}♮` : spelling(pitch);
  return `Use ${arrow} + ${letter} for ${label}`;
}
