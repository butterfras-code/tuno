import type { FingeringConfiguration } from './fingering.ts';

// Left index through little finger. Lower fingers may remain on the string;
// the highest held finger determines the stopped note. Right-hand bits stay zero.
const fingers = ['f','d','s','a'].map((key, position) => ({
  position, key, label: String(position + 1), accessibleLabel: `Finger ${position + 1}`,
}));
function masks(finger: number): string[] {
  if (!finger) return ['00000000'];
  return Array.from({length: 2 ** (finger - 1)}, (_, lower) =>
    Array.from({length: 8}, (_, i) => i === finger - 1 || i < finger - 1 && Boolean(lower & (1 << i)) ? '1' : '0').join(''));
}
/** The five diatonic notes above each open string in the existing Big 5 presets.
 * Violin/viola: first-position 0–1–2–3–4, with the next open string as an alternate.
 * Cello: 0–1–3–4–0; highest A-string E uses a shift (finger 1).
 * Bass: written octaves, 0–1–4–0–1; highest G-string C/D use shifted 1/4.
 * Sources and the deliberate absence of string/position selection are documented
 * in docs/validation/tunotes-fingering.md.
 */
function chart(instrument: string, opens: number[], pattern: number[], top: number[]): FingeringConfiguration {
  const pitches: Record<number, string[]> = {};
  opens.forEach((open, index) => {
    [0,2,4,5,7].forEach((offset, degree) => {
      const finger = (index === opens.length - 1 ? top : pattern)[degree]!;
      const pitch = open + offset;
      pitches[pitch] = [...new Set([...(pitches[pitch] ?? []), ...masks(finger)])];
    });
  });
  return {instrument, fingers, pitches, hand: 'left', control: 'finger'};
}
export const stringFingerings = [
  chart('violin', [55,62,69,76], [0,1,2,3,4], [0,1,2,3,4]),
  chart('viola', [48,55,62,69], [0,1,2,3,4], [0,1,2,3,4]),
  chart('cello', [36,43,50,57], [0,1,3,4,0], [0,1,3,4,1]),
  chart('double-bass', [40,45,50,55], [0,1,4,0,1], [0,1,4,1,4]),
] as const;
