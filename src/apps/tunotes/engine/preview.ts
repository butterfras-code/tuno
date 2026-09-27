import { chromatic, diatonic, pitchLabel } from '../domain/notation.ts';
import type { Preset } from '../domain/presets.ts';
export const beginnerPreview = (preset: Preset) => !!preset.instrument && preset.id.endsWith('-starter') || /^((treble|bass|alto|tenor)-(lines|spaces|lines-and-spaces))$/.test(preset.id);
export function previewGroups(preset: Preset) {
  const sorted = [...preset.pool].sort((a,b) => chromatic(a)-chromatic(b) || diatonic(a)-diatonic(b) || pitchLabel(a).localeCompare(pitchLabel(b),'en'));
  return Array.from({ length: Math.ceil(sorted.length/4) },(_,i) => sorted.slice(i*4,i*4+4));
}
