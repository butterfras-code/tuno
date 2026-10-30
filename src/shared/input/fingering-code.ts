/** Anatomical order, with thumbs adjacent. Never use serialized character offsets. */
export const fingerPositions = ['leftLittle', 'leftRing', 'leftMiddle', 'leftIndex', 'leftThumb',
  'rightThumb', 'rightIndex', 'rightMiddle', 'rightRing', 'rightLittle'] as const;
export type FingerName = typeof fingerPositions[number];
export type FingeringCode = string;
export interface FingeringState {
  readonly fingers: Readonly<Record<FingerName, readonly string[]>>;
  readonly string?: string;
}
export const OPEN_FINGERING: FingeringCode = '00000|00000';
export function parseFingering(code: string): FingeringState {
  const sections = code.split('|');
  if (sections.length < 2 || sections.length > 3 || sections.length === 3 && !/^[A-Za-z0-9]$/.test(sections[2]!)) throw new Error('Invalid fingering code.');
  const tokens = sections.slice(0, 2).flatMap(hand => {
    const tokens = hand.match(/[0-9]|\([1-9]{2,9}\)/g) ?? [];
    if (tokens.length !== 5 || tokens.join('') !== hand) throw new Error('A hand needs five finger tokens.');
    return tokens.map(token => {
      const ids = token === '0' ? [] : token.startsWith('(') ? [...token.slice(1, -1)] : [token];
      if (new Set(ids).size !== ids.length) throw new Error('Duplicate fingering control.');
      return ids.sort();
    });
  });
  return { fingers: Object.fromEntries(fingerPositions.map((name, i) => [name, tokens[i]!])) as unknown as FingeringState['fingers'],
    ...(sections[2] === undefined ? {} : {string: sections[2]}) };
}
export function serializeFingering(state: FingeringState): FingeringCode {
  const tokens = fingerPositions.map(name => {
    const ids = [...state.fingers[name]].sort();
    if (ids.some(id => !/^[1-9]$/.test(id)) || new Set(ids).size !== ids.length) throw new Error('Invalid fingering controls.');
    return !ids.length ? '0' : ids.length === 1 ? ids[0]! : `(${ids.join('')})`;
  });
  if (state.string !== undefined && !/^[A-Za-z0-9]$/.test(state.string)) throw new Error('Invalid string ID.');
  return tokens.slice(0, 5).join('') + '|' + tokens.slice(5).join('') + (state.string === undefined ? '' : `|${state.string}`);
}
export function canonicalFingering(code: string) { return serializeFingering(parseFingering(code)); }
export function validFingering(code: string) { try { parseFingering(code); return true; } catch { return false; } }
export function handCode(code: string) { const {fingers} = parseFingering(code); return serializeFingering({fingers}); }
export function isOpenFingering(code: string) { return handCode(code) === OPEN_FINGERING; }
export function fingerHeld(code: string, finger: FingerName) { return parseFingering(code).fingers[finger].includes('1'); }
export function binaryFingering(held: Iterable<FingerName>): FingeringCode {
  const names = new Set(held);
  return serializeFingering({fingers: Object.fromEntries(fingerPositions.map(name => [name, names.has(name) ? ['1'] : []])) as unknown as FingeringState['fingers']});
}
