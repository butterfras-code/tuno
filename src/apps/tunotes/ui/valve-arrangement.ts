/** Direction of increasing finger numbers along the panel's horizontal/vertical axis.
 * The horn thumb shares this transform, anchored to valve 1 in hand coordinates.
 * Strings retain their existing policy until their layouts are reviewed separately.
 */
const directions = {
  brass: { bottom: 1, left: 1, right: -1 },
  horn: { bottom: -1, left: -1, right: 1 },
  strings: { bottom: -1, left: 1, right: 1 },
} as const;

export function arrangementDirection(group: keyof typeof directions, position: 'bottom' | 'left' | 'right') {
  return directions[group][position];
}
