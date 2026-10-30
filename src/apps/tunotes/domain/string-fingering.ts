import { binaryFingering } from '../../../shared/input/fingering-code.ts';
import type { FingerName, FingeringCode } from '../../../shared/input/fingering-code.ts';
import type { FingeringConfiguration } from './fingering.ts';

// Left index through little finger. Lower fingers may remain on the string;
// the highest held finger determines the stopped note. Right-hand controls remain inactive.
const positions: readonly FingerName[] = ['leftIndex', 'leftMiddle', 'leftRing', 'leftLittle'];
const fingers = ['f','d','s','a'].map((key, position) => ({
  position: positions[position]!, key, label: String(position + 1), accessibleLabel: `Finger ${position + 1}`,
}));
function codes(finger: number): FingeringCode[] {
  if (!finger) return ['00000|00000'];
  return Array.from({length: 2 ** (finger - 1)}, (_, lower) =>
    binaryFingering(positions.filter((_, i) => i === finger - 1 || i < finger - 1 && Boolean(lower & (1 << i)))));
}
/** The five diatonic notes above each open string in the existing Big 5 presets.
 * Violin/viola: first-position 0–1–2–3–4, also accepting the next open string.
 * Violin prefers open strings; fourth-finger choices remain accepted alternatives.
 * Cello: 0–1–3–4–0; highest A-string E uses a shift (finger 1).
 * Bass: written octaves, 0–1–4–0–1; highest G-string C/D use shifted 1/4.
 * Sources and the deliberate absence of string/position selection are documented
 * in docs/validation/tunotes-fingering.md.
 */
function chart(instrument: string, opens: number[], pattern: number[], top: number[]): FingeringConfiguration {
  const pitches: Record<number, FingeringCode[]> = {};
  opens.forEach((open, index) => {
    [0,2,4,5,7].forEach((offset, degree) => {
      const finger = (index === opens.length - 1 ? top : pattern)[degree]!;
      const pitch = open + offset;
      pitches[pitch] = [...new Set([...(pitches[pitch] ?? []), ...codes(finger)])];
    });
  });
  if (instrument === 'violin') {
    for (const open of opens) {
      pitches[open] = [...new Set([...codes(0), ...pitches[open]!])];
    }
  }
  return {instrument, fingers, pitches, hand: 'left', control: 'finger'};
}
export const stringFingerings = [
  chart('violin', [55,62,69,76], [0,1,2,3,4], [0,1,2,3,4]),
  chart('viola', [48,55,62,69], [0,1,2,3,4], [0,1,2,3,4]),
  chart('cello', [36,43,50,57], [0,1,3,4,0], [0,1,3,4,1]),
  chart('double-bass', [40,45,50,55], [0,1,4,0,1], [0,1,4,1,4]),
] as const;
