/** Distances in CSS pixels, independent of display size and touch-target size. */
export const fingerSpacing = { compact: 68, regular: 84, wide: 100 } as const;
export type FingerSpacing = keyof typeof fingerSpacing;
export const spacingPresets = Object.keys(fingerSpacing) as FingerSpacing[];

export interface ThumbPlacement {
  index: number;
  anchor: number;
  along: number;
  across: number;
}

/** A hand-local coordinate system. CSS rotates and mirrors the whole arrangement.
 * Thumb coordinates are offsets from a finger, never from the containing panel.
 */
export function fingerLayout(count: number, thumb?: ThumbPlacement) {
  let next = 0;
  const points = Array.from({ length: count }, (_, index) => ({
    along: index === thumb?.index ? 0 : next++, across: 0,
  }));
  if (thumb && points[thumb.index] && points[thumb.anchor]) {
    const anchor = points[thumb.anchor]!;
    points[thumb.index] = { along: anchor.along + thumb.along, across: anchor.across + thumb.across };
  }
  const along = points.map(p => p.along), across = points.map(p => p.across);
  const minAlong = Math.min(0, ...along), maxAlong = Math.max(0, ...along);
  const minAcross = Math.min(0, ...across), maxAcross = Math.max(0, ...across);
  return {
    along: maxAlong - minAlong, across: maxAcross - minAcross,
    points: points.map(p => ({ along: p.along - (minAlong + maxAlong) / 2, across: p.across - (minAcross + maxAcross) / 2 })),
  };
}
