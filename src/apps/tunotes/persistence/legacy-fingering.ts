/** Lossless conversion includes incorrect historical answers, not only chart entries. */
export function migrateLegacyFingering(mask: string, instrument: string): string {
  if (!/^[01]{8}$/.test(mask)) throw new Error('Invalid legacy fingering observation.');
  if (!['trumpet-bb', 'euphonium', 'tuba', 'horn-f', 'violin', 'viola', 'cello', 'double-bass'].includes(instrument)) throw new Error('Cannot resolve legacy fingering instrument.');
  const [a,b,c,d] = mask;
  const left = instrument === 'horn-f' ? `0${c}${b}${a}${d}` : `${d}${c}${b}${a}0`;
  return `${left}|0${mask.slice(4)}`;
}
