import { chromatic, diatonic, pitchLabel } from '../domain/notation.ts';
import type { Preset } from '../domain/presets.ts';
export const beginnerPreview = (preset: Preset) => !!preset.instrument && preset.id.endsWith('-starter') || /^((treble|bass|alto|tenor)-(lines|spaces|lines-and-spaces))$/.test(preset.id);
export function previewPitches(preset: Preset) {
  return [...preset.pool].sort((a,b) => chromatic(a)-chromatic(b) || diatonic(a)-diatonic(b) || pitchLabel(a).localeCompare(pitchLabel(b),'en'));
}
